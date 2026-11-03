/* E-Diary — 1.23: values that update themselves (Money → Accounts & policies).
   Fill the details once on an investment (the 📈 button) and Refresh brings its value up to date:
     • Mutual fund — the scheme (searched by name) and the units you hold on a date. NAVs come from AMFI's daily figures
       through api.mfapi.in (free, no sign-in). Every transfer into the fund after that date — each SIP instalment too —
       buys units at the NAV of its day; money taken out sells them. Value = units × the latest NAV.
     • Shares / ETFs / gold ETFs — the symbol (NSE:RELIANCE, BOM:500325, NSE:GOLDBEES) and the quantity. Prices come from
       your own small Google Sheet price reader (GOOGLEFINANCE, set up once, free); exchanges do not let web pages read
       prices directly.
     • Fixed deposit — rate, compounding, start and maturity: the value today and at maturity are worked out (no internet).
     • Recurring deposit — rate, monthly instalment, start and maturity: the same, instalment by instalment.
   Refresh writes the holding's value (value, valueAt — so transfers already counted are not added twice). It runs when
   you press Refresh values, and by itself when Finance opens if the last refresh is over 6 hours old (can be switched off).
   Bank balances stay as they are — banks share them only with licensed Account Aggregators.
   Data: holding.mk = { kind: 'mf' | 'px' | 'fd' | 'rd', code, sname, units, unitsOn, sym, qty, rate, comp: 'q'|'m'|'h'|'y'|'s',
          lots: { <recordId>: { u, nav, d, a } }, nav, navOn, price, at, err }
         finance.mkAt (last refresh), finance.mkAuto (false = only on the button), finance.priceUrl (your price reader) */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const A = (ED.actions = ED.actions || {});
  const MV = (ED.market = {});
  const FN = () => ED.finance;
  const F = () => ED.store.data.finance;
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 10000) / 10000;
  const M$ = v => FN().money(v);
  const API = 'https://api.mfapi.in/mf/';
  const KINDS = [['mf', '📈 Mutual fund (NAV)'], ['px', '💹 Shares / ETF / gold ETF (price)'], ['fd', '🏦 Fixed deposit (interest)'], ['rd', '🔁 Recurring deposit (interest)']];
  const COMP = [['q', 'Every quarter (most banks)'], ['m', 'Every month'], ['h', 'Every half year'], ['y', 'Every year'], ['s', 'Simple interest / paid out']];
  const PER = { q: 4, m: 12, h: 2, y: 1 };
  MV.KINDS = KINDS;
  const st = () => ED.state.mv || (ED.state.mv = { busy: false });
  const timed = (url, ms) => new Promise((ok, bad) => { const c = typeof AbortController !== 'undefined' ? new AbortController() : null; const t = setTimeout(() => { if (c) c.abort(); bad(new Error('timed out')); }, ms || 15000); fetch(url, c ? { signal: c.signal } : {}).then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); bad(err); }); });
  const dmy = s => { const m = String(s || '').match(/^(\d\d)-(\d\d)-(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
  const years = (a, b) => Math.max(0, U.diffDays(a, b)) / 365;

  /* ---------------- FD and RD: worked out ---------------- */
  MV.fdAt = (P, rate, comp, start, k) => {
    const t = years(start, k), r = (+rate || 0) / 100;
    if (!P || !U.isKey(start) || k < start) return P || 0;
    if (comp === 's') return r2(P * (1 + r * t));
    const n = PER[comp] || 4; return r2(P * Math.pow(1 + r / n, n * t));
  };
  MV.rdAt = (inst, rate, comp, start, end, k) => {
    if (!inst || !U.isKey(start) || k < start) return 0;
    const r = (+rate || 0) / 100, n = PER[comp] || 4; let v = 0;
    for (let i = 0; i < 600; i++) {
      const d = U.addMonths(start, i); if (d > k || (U.isKey(end) && d >= end)) break;
      const t = years(d, k); v += comp === 's' ? inst * (1 + r * t) : inst * Math.pow(1 + r / n, n * t);
    }
    return r2(v);
  };
  MV.maturity = h => {
    const m = h.mk || {}; if (!U.isKey(h.due)) return null;
    if (m.kind === 'fd') return MV.fdAt(FN().hInvested(h), m.rate, m.comp, h.start, h.due);
    if (m.kind === 'rd') return MV.rdAt(+h.premium || +m.inst || 0, m.rate, m.comp, h.start, h.due, h.due);
    return null;
  };

  /* ---------------- mutual funds ---------------- */
  const navCache = {};                                    // code → { latest: {nav, on}, hist: Map(date → nav), from, to }
  MV.search = async q => { const r = await timed(API + 'search?q=' + encodeURIComponent(q), 15000); if (!r.ok) throw new Error('search ' + r.status); const j = await r.json(); return (Array.isArray(j) ? j : []).slice(0, 25); };
  const latest = async code => {
    const r = await timed(API + code + '/latest', 15000); if (!r.ok) throw new Error('NAV ' + r.status);
    const j = await r.json(), x = j && j.data && j.data[0];
    if (!x || !(+x.nav > 0)) throw new Error('no NAV for scheme ' + code);
    return { nav: +x.nav, on: dmy(x.date), name: j.meta && j.meta.scheme_name };
  };
  const history = async (code, a, b) => {
    const c = navCache[code] = navCache[code] || {};
    if (c.hist && c.from <= a && c.to >= b) return c.hist;
    const r = await timed(API + code + '?startDate=' + a + '&endDate=' + b, 20000); if (!r.ok) throw new Error('NAV history ' + r.status);
    const j = await r.json(), m = new Map();
    (j.data || []).forEach(x => { const k = dmy(x.date); if (k && +x.nav > 0) m.set(k, +x.nav); });
    c.hist = m; c.from = a; c.to = b; return m;
  };
  /* the NAV a purchase on day k gets: that day's, else the next published one (weekends, holidays) */
  const navFor = (m, k) => { for (let i = 0; i < 10; i++) { const d = U.addDays(k, i); if (m.has(d)) return { nav: m.get(d), d }; } return null; };
  /* transfers into (+) or out of (−) the holding after the units were counted */
  MV.flows = h => { const m = h.mk || {}, from = U.isKey(m.unitsOn) ? m.unitsOn : '0000', today = U.today();
    return F().records.filter(r => r.type === 'transfer' && (r.toHoldingId === h.id || r.fromHoldingId === h.id) && U.isKey(r.date) && r.date > from && r.date <= today)
      .map(r => ({ id: r.id, d: r.date, a: (r.toHoldingId === h.id ? 1 : -1) * (+r.amount || 0), sip: r.sipId || null })); };
  MV.units = h => { const m = h.mk || {}, live = new Set(MV.flows(h).map(f => f.id)); return r4((+m.units || 0) + Object.keys(m.lots || {}).filter(id => live.has(id)).reduce((s, id) => s + (+m.lots[id].u || 0), 0)); };
  const pending = h => { const m = h.mk || {}; return MV.flows(h).filter(f => !(m.lots || {})[f.id] || (m.lots[f.id].a !== f.a)); };
  const doMF = async h => {
    const m = h.mk; const L = await latest(m.code);
    m.nav = L.nav; m.navOn = L.on; if (L.name && !m.sname) m.sname = L.name;
    const need = pending(h); m.lots = m.lots || {};
    const live = new Set(MV.flows(h).map(f => f.id)); Object.keys(m.lots).forEach(id => { if (!live.has(id)) delete m.lots[id]; });
    if (need.length) {
      const a = need.reduce((x, f) => f.d < x ? f.d : x, need[0].d), b = U.addDays(need.reduce((x, f) => f.d > x ? f.d : x, need[0].d), 10);
      const hist = await history(m.code, U.addDays(a, -1), b > U.today() ? U.today() : b);
      need.forEach(f => { const n = navFor(hist, f.d); if (n) m.lots[f.id] = { u: r4(f.a / n.nav), nav: n.nav, d: n.d, a: f.a }; else delete m.lots[f.id]; });
    }
    // money moved in whose NAV is not out yet counts at its amount until the next refresh
    const wait = MV.flows(h).filter(f => !m.lots[f.id]).reduce((s, f) => s + f.a, 0);
    return r2(MV.units(h) * m.nav + wait);
  };

  /* ---------------- shares: your own price reader ---------------- */
  MV.SCRIPT = [
    '// E-Diary price reader — paste into a new Google Apps Script project, then Deploy → New deployment → Web app',
    '// (Execute as: Me · Who has access: Anyone). It reads prices with Google Finance in a sheet it makes in your Drive.',
    'function doGet(e) {',
    '  var s = String((e && e.parameter && e.parameter.s) || "").split(",").map(function (x) { return x.trim().replace(/[^A-Za-z0-9:._&-]/g, ""); }).filter(String).slice(0, 80);',
    '  var props = PropertiesService.getScriptProperties(), id = props.getProperty("sheet"), ss = null;',
    '  try { ss = id ? SpreadsheetApp.openById(id) : null; } catch (err) { ss = null; }',
    '  if (!ss) { ss = SpreadsheetApp.create("E-Diary prices (used by your diary)"); props.setProperty("sheet", ss.getId()); }',
    '  var sh = ss.getSheets()[0], out = {};',
    '  sh.clear();',
    '  if (s.length) {',
    '    sh.getRange(1, 1, s.length, 2).setFormulas(s.map(function (x) { return ["=\\"" + x + "\\"", "=IFERROR(GOOGLEFINANCE(\\"" + x + "\\",\\"price\\"),\\"\\")"]; }));',
    '    SpreadsheetApp.flush();',
    '    sh.getRange(1, 1, s.length, 2).getValues().forEach(function (r) { out[r[0]] = typeof r[1] === "number" ? r[1] : null; });',
    '  }',
    '  return ContentService.createTextOutput(JSON.stringify({ ok: true, at: new Date().toISOString(), prices: out })).setMimeType(ContentService.MimeType.JSON);',
    '}',
  ].join('\n');
  const priceUrl = () => { const v = String(F().priceUrl || '').trim(); return /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(v) ? v : ''; };
  MV.prices = async (syms, url) => {
    const u = url || priceUrl(); if (!u) throw new Error('no price reader');
    const r = await timed(u + (u.indexOf('?') >= 0 ? '&' : '?') + 's=' + encodeURIComponent(syms.join(',')), 30000); if (!r.ok) throw new Error('price reader ' + r.status);
    const j = JSON.parse(await r.text()); if (!j || !j.prices) throw new Error('price reader gave no prices'); return j.prices;
  };
  MV.sym = s => String(s || '').trim().toUpperCase().replace(/\s+/g, '');

  /* ---------------- refresh ---------------- */
  MV.live = () => F().holdings.filter(h => h.mk && h.mk.kind);
  MV.refresh = async opts => {
    opts = opts || {};
    const s = st(); if (s.busy) return null;
    const list = (opts.ids ? MV.live().filter(h => opts.ids.indexOf(h.id) >= 0) : MV.live()); if (!list.length) return { n: 0, bad: 0 };
    s.busy = true; if (!opts.quiet) redraw();
    let n = 0, bad = 0; const today = U.today(), now = Date.now();
    const set = (h, v) => { if (!(v >= 0) || !isFinite(v)) return; h.value = r2(v); h.valueAt = now; h.mk.at = now; h.mk.err = ''; n++; };
    const fail = (h, err) => { h.mk.err = String(err && err.message || err).slice(0, 140); bad++; };
    try {
      list.filter(h => h.mk.kind === 'fd').forEach(h => set(h, MV.fdAt(FN().hInvested(h), h.mk.rate, h.mk.comp, h.start, U.isKey(h.due) && h.due < today ? h.due : today)));
      list.filter(h => h.mk.kind === 'rd').forEach(h => set(h, MV.rdAt(+h.premium || +h.mk.inst || 0, h.mk.rate, h.mk.comp, h.start, h.due, U.isKey(h.due) && h.due < today ? h.due : today)));
      const mfs = list.filter(h => h.mk.kind === 'mf' && h.mk.code);
      await Promise.all(mfs.map(h => doMF(h).then(v => set(h, v), err => fail(h, err))));
      const px = list.filter(h => h.mk.kind === 'px' && h.mk.sym);
      if (px.length) {
        if (!priceUrl()) px.forEach(h => fail(h, 'set up your price reader (⚙ beside Refresh values)'));
        else {
          try {
            const p = await MV.prices(Array.from(new Set(px.map(h => MV.sym(h.mk.sym)))));
            px.forEach(h => { const v = p[MV.sym(h.mk.sym)]; if (+v > 0) { h.mk.price = +v; h.mk.priceOn = today; set(h, (+h.mk.qty || 0) * v); } else fail(h, 'no price for ' + h.mk.sym + ' — check the symbol (NSE:… or BOM:…)'); });
          } catch (err) { px.forEach(h => fail(h, err)); }
        }
      }
      F().mkAt = now;
    } finally { s.busy = false; }
    ED.store.commit();
    if (!opts.quiet) ED.ui.toast(n ? 'Values updated: ' + U.plural(n, 'investment') + (bad ? ' · ' + bad + ' could not be updated (see the note under it)' : '') : bad ? 'Could not update — see the note under each investment' : 'Nothing to update', { kind: bad && !n ? 'err' : undefined });
    return { n, bad };
  };
  function redraw() { if (ED.state.tab === 'finance' && ED.app) ED.app.render(); }
  /* by itself when Finance opens, if the last refresh is over 6 hours old */
  MV.auto = () => { if (F().mkAuto === false || st().busy || !MV.live().length) return; if (F().mkAt && Date.now() - F().mkAt < 6 * 3600e3) return; MV.refresh({ quiet: true }).then(() => redraw()).catch(() => {}); };
  const v0 = ED.views && ED.views.finance;
  if (v0) { const m0 = v0.mount; v0.mount = (L, R) => { if (m0) m0(L, R); setTimeout(MV.auto, 400); }; }

  /* ---------------- on the Accounts & policies page ---------------- */
  const ago = t => { const n = Math.round((Date.now() - t) / 60000); return n < 1 ? 'just now' : n < 60 ? n + ' min ago' : n < 1440 ? Math.round(n / 60) + ' h ago' : Math.round(n / 1440) + ' days ago'; };
  MV.bar = () => {
    const l = MV.live(), s = st();
    return '<div class="mv-bar"><span class="mv-i" aria-hidden="true">📈</span><span class="grow">' + (l.length ? '<b>Live values</b> for ' + U.plural(l.length, 'investment') + ' · ' + (s.busy ? 'updating…' : F().mkAt ? 'updated ' + e(ago(F().mkAt)) : 'not updated yet') :
      '<b>Let values update themselves</b> — click 📈 beside a mutual fund, share, FD or RD and fill its details once.') + '</span>' +
      (l.length ? '<button type="button" class="btn small primary" data-act="mv-refresh"' + (s.busy ? ' disabled' : '') + '>' + ED.icon('sync') + (s.busy ? 'Updating…' : 'Refresh values') + '</button>' : '') +
      '<button type="button" class="icon-btn" data-act="mv-settings" aria-label="Live value settings and the share price reader" title="Settings · share price reader">' + ED.icon('gear') + '</button></div>';
  };
  const LIVE_TYPES = ['mf', 'stocks', 'gold', 'fd', 'rd', 'nps', 'other', ''];
  MV.btn = h => (h.mk && h.mk.kind) || LIVE_TYPES.indexOf(h.type || '') >= 0 ? MV._btn(h) : '';
  MV._btn = h => '<button type="button" class="icon-btn sm mv-btn' + (h.mk && h.mk.kind ? ' on' : '') + '" data-act="mv-setup" data-id="' + e(h.id) + '" title="' + (h.mk && h.mk.kind ? 'Live value — change' : 'Let its value update itself') + '" aria-label="Live value for ' + e(h.name) + '">📈</button>';
  MV.note = h => {
    const m = h.mk; if (!m || !m.kind) return '';
    let t = '';
    if (m.kind === 'mf') t = m.nav ? r3(MV.units(h)) + ' units × NAV ₹' + m.nav.toLocaleString('en-IN', { maximumFractionDigits: 4 }) + (m.navOn ? ' (' + U.fmtDM(m.navOn) + ')' : '') : 'NAV not read yet';
    if (m.kind === 'px') t = m.price ? (+m.qty || 0) + ' × ₹' + m.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' · ' + MV.sym(m.sym) : MV.sym(m.sym) + ' · price not read yet';
    if (m.kind === 'fd' || m.kind === 'rd') { const mt = MV.maturity(h); t = (+m.rate || 0) + '% ' + (COMP.find(c => c[0] === (m.comp || 'q')) || COMP[0])[1].toLowerCase().replace(' (most banks)', '') + (mt != null ? ' · ₹' + Math.round(mt).toLocaleString('en-IN') + ' at maturity' + (h.due ? ' (' + U.fmtShort(h.due) + ')' : '') : ''); }
    const inv = FN().hInvested(h), val = FN().hValue(h), g = val - inv;
    return '<div class="mv-note' + (m.err ? ' bad' : '') + '">📈 ' + e(t) + (inv && m.at && !m.err ? ' · <span class="' + (g >= 0 ? 'fin-ok' : 'fin-bad') + '">' + (g >= 0 ? '+' : '−') + e(M$(Math.abs(g))) + ' (' + (g >= 0 ? '+' : '−') + Math.abs(Math.round(g / inv * 1000) / 10) + '%)</span>' : '') + (m.err ? ' · <b>' + e(m.err) + '</b>' : '') + '</div>';
  };
  /* under a SIP: units bought and what they are worth */
  MV.sipNote = s => {
    const h = FN().holding(s.holdingId); if (!h || !h.mk || h.mk.kind !== 'mf' || !h.mk.nav) return '';
    const lots = h.mk.lots || {}, recs = F().records.filter(r => r.sipId === s.id && lots[r.id]);
    if (!recs.length) return '';
    const u = recs.reduce((a, r) => a + (+lots[r.id].u || 0), 0), paid = recs.reduce((a, r) => a + (+r.amount || 0), 0), v = u * h.mk.nav, g = v - paid;
    return '<div class="hint mv-sip">' + r3(u) + ' units at avg ₹' + (u ? (paid / u).toFixed(2) : '—') + ' · worth <b>' + e(M$(v)) + '</b> <span class="' + (g >= 0 ? 'fin-ok' : 'fin-bad') + '">' + (g >= 0 ? '+' : '−') + e(M$(Math.abs(g))) + '</span></div>';
  };

  /* ---------------- setting up an investment ---------------- */
  MV.setup = id => {
    const h = FN().holding(id); if (!h) return;
    const m0 = h.mk || {}, guess = m0.kind || ({ mf: 'mf', stocks: 'px', gold: 'px', fd: 'fd', rd: 'rd' })[h.type] || 'mf';
    const o = (v, l, s) => '<option value="' + e(v) + '"' + (s ? ' selected' : '') + '>' + e(l) + '</option>';
    const body = '<div class="st-form mv-form"><p class="hint">Fill these once; <b>Refresh values</b> then keeps <b>' + e(h.name) + '</b> up to date. Its invested amount stays as it is (' + e(M$(FN().hInvested(h))) + ').</p>' +
      '<div class="seg mv-kind" role="group" aria-label="How its value is found">' + KINDS.map(k => '<button type="button" data-k="' + k[0] + '" aria-pressed="' + (k[0] === guess) + '">' + e(k[1]) + '</button>').join('') + '</div>' +
      '<div class="st-grid mv-sec" data-k="mf"><label class="lbl" for="mv-q">Scheme</label><div><div class="mv-srow"><input id="mv-q" class="field" placeholder="Search: e.g. Franklin India Flexi Cap Direct Growth" value="' + e(m0.sname || h.name) + '"><button type="button" class="btn small" data-x="find">' + ED.icon('search') + 'Find</button></div>' +
        '<ul class="mv-res" id="mv-res"></ul><p class="hint" id="mv-pick">' + (m0.code ? 'Chosen: <b>' + e(m0.sname || m0.code) + '</b> (' + e(m0.code) + ')' : 'Pick the exact plan — Direct or Regular, Growth or IDCW — as on your statement.') + '</p></div>' +
        '<label class="lbl" for="mv-u">Units you hold</label><div><input id="mv-u" class="field num" type="number" step="0.001" min="0" value="' + e(m0.units != null ? m0.units : '') + '" placeholder="from your statement / app"><span class="hint fx-hint">From your account statement (CAS), the fund’s app or the registrar (CAMS / KFintech). Use 0 for a new SIP.</span></div>' +
        '<label class="lbl" for="mv-uo">Units as on</label><div><input id="mv-uo" class="field" type="date" value="' + e(m0.unitsOn || U.today()) + '"><span class="hint fx-hint">Every transfer into the fund after this date — each SIP instalment too — buys units at that day’s NAV, by itself.</span></div></div>' +
      '<div class="st-grid mv-sec" data-k="px"><label class="lbl" for="mv-s">Symbol</label><div><input id="mv-s" class="field" value="' + e(m0.sym || '') + '" placeholder="NSE:RELIANCE · BOM:500325 · NSE:GOLDBEES"><span class="hint fx-hint">As Google Finance writes it: exchange, colon, symbol.</span></div>' +
        '<label class="lbl" for="mv-qty">Quantity</label><div><input id="mv-qty" class="field num" type="number" step="0.001" min="0" value="' + e(m0.qty != null ? m0.qty : '') + '"><span class="hint fx-hint">Change it when you buy or sell more.</span></div>' +
        '<span class="lbl"></span><p class="hint">' + (priceUrl() ? '✅ Your price reader is set up.' : '⚠️ Prices need your own free price reader — <button type="button" class="link-btn" data-x="reader">set it up (5 minutes, once)</button>.') + '</p></div>' +
      '<div class="st-grid mv-sec" data-k="fd rd"><label class="lbl" for="mv-r">Interest rate (% a year)</label><input id="mv-r" class="field num" type="number" step="0.01" min="0" max="20" value="' + e(m0.rate || '') + '">' +
        '<label class="lbl" for="mv-c">Interest added</label><select id="mv-c" class="field">' + COMP.map(c => o(c[0], c[1], (m0.comp || 'q') === c[0])).join('') + '</select>' +
        '<label class="lbl" for="mv-st">Started on</label><input id="mv-st" class="field" type="date" value="' + e(h.start || '') + '">' +
        '<label class="lbl" for="mv-du">Matures on</label><input id="mv-du" class="field" type="date" value="' + e(h.due || '') + '">' +
        '<label class="lbl mv-rd" for="mv-in">Monthly instalment (₹)</label><input id="mv-in" class="field num mv-rd" type="number" min="0" value="' + e(h.premium || m0.inst || '') + '">' +
        '<span class="lbl"></span><p class="hint" id="mv-fdx"></p></div></div>';
    let kind = guess, pick = m0.code ? { code: m0.code, name: m0.sname } : null;
    ED.ui.modal({
      title: 'Live value — ' + h.name, cls: 'st-modal wide', body,
      footer: (m0.kind ? '<button type="button" class="btn danger" data-x="off">Stop live value</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">' + ED.icon('check') + 'Save and update</button>',
      onMount(el, api) {
        const $ = id => el.querySelector('#mv-' + id);
        const show = () => { U.$$('.mv-kind [data-k]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === kind))); U.$$('.mv-sec', el).forEach(s => { s.hidden = s.dataset.k.split(' ').indexOf(kind) < 0; }); U.$$('.mv-rd', el).forEach(x => { x.hidden = kind !== 'rd'; }); calc(); };
        const calc = () => {
          if (kind !== 'fd' && kind !== 'rd') return;
          const P = FN().hInvested(h), r = +$('r').value, c = $('c').value, s = $('st').value, d = $('du').value, inst = +$('in').value, t = U.today();
          if (!U.isKey(s) || !r) { $('fdx').textContent = 'Fill the rate and the start date to see the value.'; return; }
          const now = kind === 'fd' ? MV.fdAt(P, r, c, s, U.isKey(d) && d < t ? d : t) : MV.rdAt(inst, r, c, s, d, U.isKey(d) && d < t ? d : t);
          const mat = U.isKey(d) ? (kind === 'fd' ? MV.fdAt(P, r, c, s, d) : MV.rdAt(inst, r, c, s, d, d)) : null;
          $('fdx').innerHTML = (kind === 'fd' && !P ? '⚠️ Type the amount put in as “Invested” on the investment first. ' : '') + 'Worth today: <b>' + e(M$(Math.round(now))) + '</b>' + (mat != null ? ' · at maturity: <b>' + e(M$(Math.round(mat))) + '</b>' : '');
        };
        el.addEventListener('input', calc); el.addEventListener('change', calc);
        el.querySelector('.mv-kind').addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (b) { kind = b.dataset.k; show(); } });
        const find = async () => {
          const q = $('q').value.trim(); if (q.length < 3) { ED.ui.toast('Type at least 3 letters of the fund name'); return; }
          $('res').innerHTML = '<li class="hint">Searching…</li>';
          try {
            const l = await MV.search(q);
            $('res').innerHTML = l.length ? l.map(x => '<li><button type="button" class="plain-btn" data-code="' + e(x.schemeCode) + '" data-name="' + e(x.schemeName) + '">' + e(x.schemeName) + ' <span class="hint">' + e(x.schemeCode) + '</span></button></li>').join('') : '<li class="hint">No scheme found — try fewer words (e.g. “flexi cap direct”).</li>';
          } catch (err) { $('res').innerHTML = '<li class="hint">Could not search just now (' + e(err.message || err) + '). Check the internet and try again.</li>'; }
        };
        el.querySelector('[data-x="find"]').addEventListener('click', find);
        $('q').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); find(); } });
        $('res').addEventListener('click', ev => { const b = ev.target.closest('[data-code]'); if (!b) return; pick = { code: b.dataset.code, name: b.dataset.name }; $('pick').innerHTML = 'Chosen: <b>' + e(pick.name) + '</b> (' + e(pick.code) + ')'; $('res').innerHTML = ''; });
        const rd = el.querySelector('[data-x="reader"]'); if (rd) rd.addEventListener('click', () => MV.settings());
        const off = el.querySelector('[data-x="off"]');
        if (off) off.addEventListener('click', () => { ED.store.checkpoint('Live value'); delete h.mk; ED.store.commit(); api.close(); ED.ui.toast('Live value stopped — the last value stays; type it yourself from now'); });
        el.querySelector('[data-x="save"]').addEventListener('click', async () => {
          const mk = { kind, lots: m0.kind === kind ? m0.lots || {} : {} };
          if (kind === 'mf') {
            if (!pick) { ED.ui.toast('Find and pick the scheme first'); return; }
            if ($('u').value === '') { ED.ui.toast('Type the units you hold (0 for a new SIP)'); $('u').focus(); return; }
            Object.assign(mk, { code: String(pick.code), sname: pick.name, units: +$('u').value || 0, unitsOn: U.isKey($('uo').value) ? $('uo').value : U.today() });
            if (m0.code !== mk.code || m0.unitsOn !== mk.unitsOn) mk.lots = {};
          } else if (kind === 'px') {
            if (!MV.sym($('s').value).includes(':')) { ED.ui.toast('Write the symbol with its exchange, e.g. NSE:RELIANCE'); $('s').focus(); return; }
            Object.assign(mk, { sym: MV.sym($('s').value), qty: +$('qty').value || 0 });
          } else {
            if (!(+$('r').value > 0) || !U.isKey($('st').value)) { ED.ui.toast('Fill the interest rate and the start date'); return; }
            Object.assign(mk, { rate: +$('r').value, comp: $('c').value });
            h.start = $('st').value; if (U.isKey($('du').value)) h.due = $('du').value;
            if (kind === 'rd') { mk.inst = +$('in').value || 0; if (mk.inst) h.premium = mk.inst; h.frequency = 'monthly'; }
          }
          ED.store.checkpoint('Live value'); h.mk = mk; ED.store.commit(); api.close();
          await MV.refresh({ ids: [h.id] });
        });
        show();
      },
    });
  };
  MV.settings = () => {
    const f = F();
    ED.ui.modal({
      title: 'Live values — settings', cls: 'st-modal wide',
      body: '<div class="sb-set"><label class="switch"><input type="checkbox" id="mv-auto"' + (f.mkAuto !== false ? ' checked' : '') + '><span class="track"></span><span>Refresh by itself when I open Finance (at most every 6 hours)</span></label>' +
        '<h3 class="set-h">Share price reader</h3><p>Exchanges do not let web pages read share prices, so the diary asks a small Google Sheet in your own Google account, which uses Google Finance. It is free, private to you, and takes about 5 minutes once.</p>' +
        '<ol class="sb-steps"><li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">script.google.com → New project</a> (signed in to Google).</li>' +
        '<li>Delete what is in the editor, paste the script below (<b>Copy the script</b>) and click 💾 Save.</li>' +
        '<li><b>Deploy → New deployment</b> → ⚙ <b>Web app</b>. Execute as: <b>Me</b>. Who has access: <b>Anyone</b>. <b>Deploy</b> → <b>Authorize access</b> → allow it (for your own script Google shows “unverified app”: Advanced → Go to … (unsafe)). It asks to manage spreadsheets: it makes one sheet, “E-Diary prices”, and uses only that.</li>' +
        '<li>Copy the <b>Web app URL</b> (ends in <code>/exec</code>), paste it below, press <b>Test and save</b>.</li></ol>' +
        '<pre class="sb-code">' + e(MV.SCRIPT) + '</pre><div class="row-btns"><button type="button" class="btn small" data-x="copy">' + ED.icon('copy') + 'Copy the script</button></div>' +
        '<label class="lbl" for="mv-url">Web app URL</label><input class="field" id="mv-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + e(f.priceUrl || '') + '">' +
        '<p class="hint" id="mv-test">' + (priceUrl() ? 'Your price reader is on.' : 'Not set yet.') + '</p>' +
        '<p class="hint">Bank balances cannot be read automatically: banks share them only with licensed Account Aggregators. Import your statement in Money (CSV / Excel) instead.</p></div>',
      footer: (f.priceUrl ? '<button type="button" class="btn danger" data-x="rm">Remove the reader</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Close</button><button type="button" class="btn primary" data-x="save">Test and save</button>',
      onMount(el, api) {
        el.querySelector('#mv-auto').addEventListener('change', ev => { f.mkAuto = ev.target.checked; ED.store.commit(); });
        el.querySelector('[data-x="copy"]').addEventListener('click', async () => ED.ui.toast(await U.copy(MV.SCRIPT) ? 'Script copied — paste it into the Apps Script editor' : 'Could not copy — select the text and copy it'));
        const rm = el.querySelector('[data-x="rm"]'); if (rm) rm.addEventListener('click', () => { ED.store.checkpoint('Price reader'); delete f.priceUrl; ED.store.commit(); api.close(); });
        el.querySelector('[data-x="save"]').addEventListener('click', async () => {
          const v = el.querySelector('#mv-url').value.trim(), out = el.querySelector('#mv-test');
          if (!v) { api.close(); return; }
          if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(v)) { out.textContent = 'That is not an Apps Script web app address — it starts with https://script.google.com/macros/s/ and ends in /exec.'; return; }
          out.textContent = 'Testing with NSE:RELIANCE…';
          try {
            const p = await MV.prices(['NSE:RELIANCE'], v);
            ED.store.checkpoint('Price reader'); f.priceUrl = v; ED.store.commit();
            out.textContent = 'Works — Reliance is ₹' + (p['NSE:RELIANCE'] || '?') + '. Saved.'; setTimeout(() => api.close(), 1600);
          } catch (err) { out.textContent = 'Did not work yet (' + (err.message || err) + '). Check “Who has access: Anyone” and that you copied the /exec address, then try again.'; }
        });
      },
    });
  };
  A['mv-refresh'] = () => MV.refresh();
  A['mv-setup'] = el => MV.setup(el.dataset.id);
  A['mv-settings'] = () => MV.settings();
})();
