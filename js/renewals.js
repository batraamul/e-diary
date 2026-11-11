/* E-Diary — Finance → Insurance & Subscriptions (added in 1.26.0): everything that renews — insurance policies,
   subscriptions, memberships, licences — with its price and renewal date.
   Left page:  the list, by urgency (overdue · due soon · later · stopped), each with a countdown ring; ＋ Add, Paid ✓.
   Right page: at a glance — what it costs a year and a month, what is due in 30 days, a 12-month deadline runway,
               cost by kind and insurance cover.
   Automatic:  a reminder task "🔁 Renew …" in the Daily planner some days before each due date (tk-rn-<id>-<due>);
               on the due date (if "record the payment automatically" is on) — or when you tick the reminder or press
               Paid ✓ — a spending record goes into Money (fr-rn-<id>-<due>, never twice) and the due date moves on by
               one cycle. Optionally an all-day entry on the due date in the diary calendar, copied to Google Calendar.
   Data: ED.store.data.renewals = { list: [{ id, name, kind, provider, ref, cover, cost, cycle, due, remind, auto,
          accountId, categoryId, cal: '' | 'diary' | 'google', link, notes, active, paid: { <due>: <recordId> },
          skipTask: <due>, eventId, holdingId, updatedAt }] } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const CH = (ED.changes = ED.changes || {});
  const FX = () => ED.fx;
  const FN = () => ED.finance;
  const RN = (ED.renewals = {});
  const st = () => ED.state.rn || (ED.state.rn = { g: '' });
  const R = () => { const d = D(); if (!d.renewals || typeof d.renewals !== 'object') d.renewals = { list: [] }; if (!Array.isArray(d.renewals.list)) d.renewals.list = []; return d.renewals; };
  const money = v => FN() ? FN().money(v) : '₹' + Math.round(v || 0).toLocaleString('en-IN');

  const KINDS = [
    ['ins-health', 'Health insurance', '🩺', 'ins'], ['ins-life', 'Life / term insurance', '🛡️', 'ins'], ['ins-vehicle', 'Vehicle insurance', '🚗', 'ins'],
    ['ins-home', 'Home insurance', '🏠', 'ins'], ['ins-travel', 'Travel insurance', '✈️', 'ins'], ['ins-other', 'Other insurance', '☂️', 'ins'],
    ['sub-ott', 'OTT / streaming', '📺', 'sub'], ['sub-music', 'Music', '🎵', 'sub'], ['sub-cloud', 'Software / cloud / apps', '☁️', 'sub'],
    ['sub-news', 'News / magazines / journals', '📰', 'sub'], ['sub-phone', 'Mobile / internet / DTH', '📶', 'sub'], ['sub-member', 'Membership / club / gym', '🏋️', 'sub'],
    ['sub-domain', 'Domain / hosting', '🌐', 'sub'], ['oth-licence', 'Licence / registration / passport', '🪪', 'oth'], ['oth-service', 'Service contract / AMC / warranty', '🛠️', 'oth'],
    ['oth', 'Other renewal', '📦', 'oth'],
  ];
  const GROUPS = [['', 'All'], ['ins', 'Insurance'], ['sub', 'Subscriptions'], ['oth', 'Others']];
  const GCOL = { ins: '#2563eb', sub: '#7c3aed', oth: '#0d9488' };
  const kind = k => KINDS.find(x => x[0] === k) || KINDS[KINDS.length - 1];
  const CYCLES = [['monthly', 'Every month', 1], ['quarterly', 'Every 3 months', 3], ['half', 'Every 6 months', 6], ['yearly', 'Every year', 12], ['2y', 'Every 2 years', 24], ['3y', 'Every 3 years', 36], ['5y', 'Every 5 years', 60], ['10y', 'Every 10 years', 120], ['once', 'One time (does not renew)', 0]];
  const cyc = c => CYCLES.find(x => x[0] === c) || CYCLES[3];
  const perYear = x => { const m = cyc(x.cycle)[2]; return m ? (+x.cost || 0) * 12 / m : 0; };
  RN.next = x => { const m = cyc(x.cycle)[2]; return m && U.isKey(x.due) ? U.addMonths(x.due, m) : null; };
  const live = x => x.active !== false && U.isKey(x.due);
  const remindOn = x => U.addDays(x.due, -Math.max(0, Math.round(+x.remind || 0)));
  const daysTo = x => U.diffDays(U.today(), x.due);
  const whenTxt = n => n < 0 ? (n === -1 ? '1 day overdue' : -n + ' days overdue') : n === 0 ? 'due today' : n === 1 ? 'due tomorrow' : 'in ' + n + ' days';
  const urg = x => { if (!live(x)) return 'off'; const n = daysTo(x); return n < 0 ? 'late' : n <= Math.max(7, +x.remind || 0) ? 'soon' : n <= 30 ? 'near' : 'later'; };
  const defCat = k => {
    const f = D().finance, cats = (f && f.cats) || [], has = id => cats.some(c => c.id === id);
    if (/^ins/.test(k)) return has('fc-ins') ? 'fc-ins' : 'fc-other';
    if (k === 'sub-phone' && has('fc-phone')) return 'fc-phone';
    const c = cats.find(c => c.type !== 'income' && /subscri|entertain|ott|stream/i.test(c.name || '')); return c ? c.id : (has('fc-other') ? 'fc-other' : ((cats[0] || {}).id || null));
  };
  const finCatTask = () => (D().categories.find(c => /financ|money/i.test(c.name || '')) || {}).id || null;
  const RID = (x, k) => 'fr-rn-' + x.id + '-' + k;
  const TID = (x, k) => 'tk-rn-' + x.id + '-' + k;

  /* ---------------- paying: a Money record for this due date, then the next cycle ---------------- */
  const pay = (x, k, on) => {
    const f = D().finance; if (!f || !Array.isArray(f.records)) return false;
    x.paid = x.paid && typeof x.paid === 'object' ? x.paid : {};
    if (!f.records.some(r => r.id === RID(x, k)) && +x.cost > 0) {
      const rec = { id: RID(x, k), date: on || k, type: 'expense', amount: +x.cost, categoryId: x.categoryId || defCat(x.kind), accountId: x.accountId || null, desc: (/^ins/.test(x.kind) ? 'Premium: ' : 'Renewal: ') + x.name + (x.provider ? ' (' + x.provider + ')' : ''), notes: 'From Finance → Insurance & Subscriptions' + (x.ref ? ' · ' + x.ref : '') + ' · due ' + U.fmtShort(k), src: 'renew:' + x.id };
      if (FN() && FN().addRecord) FN().addRecord(rec); else f.records.push(Object.assign({ createdAt: Date.now(), updatedAt: Date.now() }, rec));
    }
    x.paid[k] = RID(x, k);
    const n = RN.next(x);
    if (n) x.due = n; else x.active = false;
    x.updatedAt = Date.now();
    return true;
  };
  RN.pay = id => { const x = R().list.find(y => y.id === id); if (!x || !live(x)) return; ED.store.checkpoint('Paid'); const k = x.due; pay(x, k, U.today()); const t = D().tasks.find(t => t.id === TID(x, k)); if (t && !M.isClosed(t.status)) M.setStatus(t, t.date, 'done'); calSync(x); ED.store.commit(); ED.ui.undoToast('Paid — recorded in Money' + (x.active !== false ? '; next due ' + U.fmtShort(x.due) : '')); };

  /* ---------------- the calendar entry on the due date ---------------- */
  const calSpec = x => ({ on: !!x.cal && live(x), title: kind(x.kind)[2] + ' Renewal due: ' + x.name + (+x.cost ? ' — ' + money(+x.cost) : ''), date: x.due, time: null,
    notes: [kind(x.kind)[1], x.provider, x.ref ? 'Policy / account no. ' + x.ref : '', x.cover ? 'Cover ' + money(+x.cover) : '', cyc(x.cycle)[1], x.link].filter(Boolean).join('\n'), color: (M.EVENT_COLORS || [])[0] });
  const calSync = x => { if (FX() && FX().linkEvent) FX().linkEvent(x, calSpec(x)); };
  const gReady = () => { const G = ED.gcal; if (!G) return false; const g = (D().settings && D().settings.gcal) || {}; return !!(g.on || g.clientId || (G.via && G.via() === 'connector')); };
  const toGoogle = x => {
    if (!x.eventId) return;
    if (gReady() && ED.gcal.setPick) { ED.gcal.setPick('e:' + x.eventId, true); return; }
    if (ED.gcal && ED.gcal.templateUrl) window.open(ED.gcal.templateUrl(calSpec(x).title, x.due, null, null, calSpec(x).notes), '_blank', 'noopener');
  };

  /* ---------------- keeping tasks, records and the calendar in step ---------------- */
  let busy = false;
  RN.reconcile = () => {
    const d = D(); if (busy || !d || !Array.isArray(d.tasks) || !d.renewals) return false;
    busy = true; let ch = false;
    try {
      const today = U.today(), keep = new Set();
      R().list.forEach(x => {
        if (!live(x)) { if (x.eventId) { calSync(x); ch = true; } return; }
        // a reminder you ticked: paid
        let t = d.tasks.find(y => y.id === TID(x, x.due));
        if (t && M.isClosed(t.status) && !(x.paid || {})[x.due]) { pay(x, t.linkDate || x.due, today); calSync(x); ch = true; }
        // due dates that have passed: recorded automatically, one cycle at a time
        for (let i = 0; i < 120 && live(x) && x.auto !== false && x.due <= today; i++) { pay(x, x.due); ch = true; }
        if (ch) calSync(x);
        if (!live(x)) return;
        // the reminder for the current due date
        const id = TID(x, x.due), on = remindOn(x) < today && x.due >= today ? today : remindOn(x);
        const title = '🔁 Renew ' + x.name + (+x.cost ? ' — ' + money(+x.cost) : '') + ' · due ' + U.fmtDM(x.due);
        if (x.skipTask === x.due) return;
        keep.add(id);
        t = d.tasks.find(y => y.id === id);
        if (!t) {
          const notes = '<p>' + e(kind(x.kind)[2] + ' ' + kind(x.kind)[1]) + (x.provider ? ' · ' + e(x.provider) : '') + (x.ref ? ' · ' + e(x.ref) : '') + '</p><p>Due on <b>' + e(U.fmtLong(x.due)) + '</b> · ' + e(cyc(x.cycle)[1].toLowerCase()) + '</p><p>Tick this when paid — it is recorded in Money and the next renewal is set.</p>' + (x.link ? '<p><a href="' + e(x.link) + '">' + e(x.link) + '</a></p>' : '');
          t = M.newTask({ id, title, date: on, prio: 'A', link: { k: 'renewal', id: x.id }, linkTitle: title, linkDate: x.due, notes, categoryId: finCatTask() });
          t.num = M.nextNum(t.prio, t.date); d.tasks.push(t); ch = true;
        } else if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
      });
      // reminders of a past cycle go (ticked ones stay as your record). 1.26.1: a reminder whose item is not in this
      // copy of the diary is left alone — the item may still be on its way from another device (Delete removes its own)
      const before = d.tasks.length, has = new Set(R().list.map(x => x.id));
      d.tasks = d.tasks.filter(t => !t.link || t.link.k !== 'renewal' || keep.has(t.id) || M.isClosed(t.status) || !has.has(t.link.id));
      if (d.tasks.length !== before) ch = true;
    } catch (err) { console.warn('[e-diary] renewals', err); }
    finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => { if (type !== 'change' || (detail && detail.reason === 'renewals')) return; if (RN.reconcile()) ED.store.commit({ reason: 'renewals' }); });
  setTimeout(() => { if (RN.reconcile()) ED.store.commit({ reason: 'renewals' }); }, 0);
  let lastDay = U.today();
  setInterval(() => { const k = U.today(); if (k !== lastDay) { lastDay = k; if (RN.reconcile()) ED.store.commit({ reason: 'renewals' }); } }, 60e3);
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    if (o && o.t.link && o.t.link.k === 'renewal' && R().list.some(x => x.id === o.t.link.id)) { ED.go.tab('renewals'); setTimeout(() => RN.edit(o.t.link.id), 60); return; }
    return open0 && open0(el, ev);
  };
  const del0 = M.deleteTask;
  M.deleteTask = id => { const t = M.task(id); if (t && t.link && t.link.k === 'renewal') { const x = R().list.find(y => y.id === t.link.id); if (x) { x.skipTask = t.linkDate; x.updatedAt = Date.now(); } } return del0(id); };
  /* Money → Overview → Coming up */
  RN.dues = () => { const lim = U.addDays(U.today(), 45); return R().list.filter(x => live(x) && x.due <= lim).map(x => ({ kind: 'renewal', item: x, date: x.due, amount: +x.cost || 0, name: kind(x.kind)[2] + ' ' + x.name + ' — renewal' })); };

  /* ---------------- 1.26.2: usage allowance — an amount (100 % by default) spread evenly over a period (a day,
     a week, a month or some days); each day's share is that amount ÷ the days in the period, and whatever is not used
     carries over to the next day: available today = share × days so far − used on the days before today ---------------- */
  const EVERY = [['day', 'Every day'], ['week', 'Every week'], ['month', 'Every month'], ['days', 'Every few days (set below)']];
  const useOn = x => !!(x.usage && x.usage.on && +x.usage.total > 0);
  const num1 = v => { const r = Math.round(v * 10) / 10; return (Math.abs(r) % 1 ? r.toFixed(1) : String(r)); };
  const unitOf = x => (x.usage && x.usage.unit != null ? String(x.usage.unit) : '%');
  const qty = (x, v) => { const u = unitOf(x); return num1(v) + (u === '%' ? '%' : u ? ' ' + u : ''); };
  RN.period = (x, k) => {
    const u = x.usage || {}, today = k || U.today(), anchor = U.isKey(u.start) ? u.start : today;
    let ps, len;
    if (u.every === 'month') {
      ps = anchor; let g = 0;
      while (ps > today && g++ < 600) ps = U.addMonths(ps, -1);
      while (U.addMonths(ps, 1) <= today && g++ < 1200) ps = U.addMonths(ps, 1);
      len = U.diffDays(ps, U.addMonths(ps, 1));
    } else {
      len = u.every === 'day' ? 1 : u.every === 'days' ? Math.max(1, Math.round(+u.days || 1)) : 7;
      const i = Math.floor(U.diffDays(anchor, today) / len); ps = U.addDays(anchor, i * len);
    }
    return { ps, pe: U.addDays(ps, len), len };
  };
  RN.usage = (x, k) => {
    const today = k || U.today(), P = RN.period(x, today), u = x.usage || {}, log = u.log || {}, share = (+u.total || 0) / P.len;
    const idx = U.diffDays(P.ps, today), days = [];
    let before = 0, all = 0;
    for (let i = 0; i < P.len; i++) {
      const d = U.addDays(P.ps, i), used = +log[d] || 0, avail = share * (i + 1) - all;
      days.push({ k: d, used, avail, has: log[d] != null, past: d < today, today: d === today });
      if (d < today) before += used; all += used;
    }
    const usedToday = +log[today] || 0, availToday = share * (idx + 1) - before;
    const pace = idx > 0 || usedToday ? (before + usedToday) / (idx + 1) : 0;
    return { P, share, idx, days, usedToday, availToday, leftToday: availToday - usedToday, used: all, left: (+u.total || 0) - all, total: +u.total || 0, pace,
      runsOut: pace > 0 && pace * P.len > (+u.total || 0) ? U.addDays(P.ps, Math.max(0, Math.ceil((+u.total || 0) / pace) - 1)) : null };
  };
  const useLine = x => {
    if (!useOn(x)) return '';
    const s = RN.usage(x), cls = s.leftToday < 0 ? 'bad' : s.leftToday < s.share * 0.5 ? 'warn' : 'ok';
    const bar = s.P.len > 1 && s.P.len <= 62 ? '<span class="rn-ubar" aria-hidden="true">' + s.days.map(d => '<i class="' + (d.today ? 'now ' : '') + (d.k > U.today() ? 'fut' : d.used > d.avail + 1e-9 ? 'over' : d.used > 0 ? 'used' : d.has ? 'nil' : 'none') + '" style="--h:' + Math.max(8, Math.min(100, (d.used || (d.k > U.today() ? s.share : 0)) / s.share * 100)).toFixed(0) + '%"></i>').join('') + '</span>' : '';
    return '<span class="rn-use ' + cls + '">' + bar + '<span>Today <b>' + e(qty(x, Math.max(0, s.leftToday))) + '</b> left' + (s.usedToday ? ' (used ' + e(qty(x, s.usedToday)) + ')' : '') + ' · ' + e(qty(x, Math.max(0, s.left))) + ' left this ' + (s.P.len === 7 ? 'week' : s.P.len === 1 ? 'day' : (x.usage.every === 'month' ? 'month' : 'period')) + '</span></span>';
  };
  /* 1.26.3: you enter only the usage meter reading — the total used so far this period, as the service shows it.
     The day's use is worked out: this reading − the last reading before it in the same period (10, then 20 → 10 that day).
     Readings are kept in usage.meter{date: reading}; usage.log{date: used} is rebuilt from them for that period. */
  const meterOf = (x, P) => {
    const u = x.usage, m = (u.meter = u.meter || {}), log = (u.log = u.log || {});
    const inP = d => d >= P.ps && d < P.pe;
    if (!Object.keys(m).some(inP)) {   // a period logged before 1.26.3 (day amounts): turn them into readings once
      let run = 0; Object.keys(log).filter(inP).sort().forEach(d => { run += +log[d] || 0; m[d] = Math.round(run * 100) / 100; });
    }
    return m;
  };
  const relog = (x, P) => {
    const m = meterOf(x, P), log = x.usage.log, inP = d => d >= P.ps && d < P.pe;
    Object.keys(log).filter(inP).forEach(d => { delete log[d]; });
    let prev = 0; Object.keys(m).filter(inP).sort().forEach(d => { log[d] = Math.max(0, Math.round((+m[d] - prev) * 100) / 100); prev = Math.max(prev, +m[d]); });
  };
  const lastReading = (x, P, before) => { const m = (x.usage && x.usage.meter) || {}; const k = Object.keys(m).filter(d => d >= P.ps && d < P.pe && (!before || d < before)).sort().pop(); return k ? { d: k, r: +m[k] } : null; };
  RN.logUse = id => {
    const x = R().list.find(y => y.id === id); if (!x || !useOn(x)) return;
    const s0 = RN.usage(x), P0 = RN.period(x), m0 = (x.usage.meter || {})[U.today()];
    const prev = lastReading(x, P0, U.today()) || (s0.used - s0.usedToday > 0 ? { d: null, r: s0.used - s0.usedToday } : null);
    FX().form({
      title: 'Usage · ' + x.name,
      intro: 'Enter the usage as the service shows it now — the total used so far this period (' + U.fmtDM(P0.ps) + '–' + U.fmtDM(U.addDays(P0.pe, -1)) + '). The diary works out what was used today from the last reading' + (prev ? ' (' + qty(x, prev.r) + (prev.d ? ' on ' + U.fmtDM(prev.d) : '') + ')' : '') + '. Today’s share is ' + qty(x, s0.share) + '; unused share carries over — today you have ' + qty(x, Math.max(0, s0.availToday)) + '.',
      data: { amt: m0 != null ? m0 : null, date: U.today() },
      fields: [
        { k: 'amt', label: 'Used so far this period (' + (unitOf(x) || 'units') + ')', type: 'number', min: 0, step: 'any', hint: prev ? 'Last reading ' + qty(x, prev.r) + ' — today’s use = this − ' + qty(x, prev.r) + '.' : 'The first reading of this period.' },
        { k: 'date', label: 'Reading taken on', type: 'date', req: true, hint: 'Today, unless you are filling in a missed day.' },
      ],
      save(v, api) {
        if (v.amt == null || v.amt === '' || isNaN(+v.amt)) { ED.ui.toast('Fill in: Used so far this period'); return; }
        const P = RN.period(x, v.date), pr = lastReading(x, P, v.date);
        ED.store.checkpoint('Usage');
        meterOf(x, P)[v.date] = Math.round(+v.amt * 100) / 100;
        relog(x, P);
        // readings and the log keep the last year
        const old = U.addDays(U.today(), -400); ['log', 'meter'].forEach(k => Object.keys(x.usage[k] || {}).forEach(d => { if (d < old) delete x.usage[k][d]; }));
        x.updatedAt = Date.now(); ED.store.commit(); api.close();
        const day = x.usage.log[v.date] || 0, s = RN.usage(x);
        ED.ui.toast((pr && +v.amt < pr.r ? 'Lower than the last reading (' + qty(x, pr.r) + ') — counted as 0 used. ' : '') + 'Used ' + qty(x, day) + (v.date === U.today() ? ' today' : ' on ' + U.fmtDM(v.date)) + ' — today ' + qty(x, Math.max(0, s.leftToday)) + ' left, ' + qty(x, Math.max(0, s.left)) + ' this period');
      },
    });
  };
  A['rn-use'] = el => RN.logUse(el.dataset.id);

  /* ---------------- the pages ---------------- */
  const ring = (x, size) => {
    const n = daysTo(x), span = Math.max(60, 2 * (+x.remind || 0)), u = urg(x);   // the ring fills up over the last two months (or twice the reminder time)
    const frac = !live(x) ? 0 : n < 0 ? 1 : Math.max(0.04, Math.min(1, 1 - n / span)), r = 15.5, c = 2 * Math.PI * r;
    const big = !live(x) ? '—' : n < 0 ? '!' : n > 999 ? '999+' : String(n);
    return '<span class="rn-ring u-' + u + '" style="--sz:' + (size || 52) + 'px" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="' + r + '" class="bg"/><circle cx="18" cy="18" r="' + r + '" class="fg" stroke-dasharray="' + (c * frac).toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 18 18)"/></svg><b>' + big + '</b><i>' + (live(x) && n >= 0 ? (n === 1 ? 'day' : 'days') : live(x) ? 'late' : 'off') + '</i></span>';
  };
  const card = x => {
    const k = kind(x.kind), n = live(x) ? daysTo(x) : null;
    return '<li class="rn-card u-' + urg(x) + '" style="--g:' + GCOL[k[3]] + '"><button type="button" class="plain-btn rn-main" data-act="rn-edit" data-id="' + e(x.id) + '">' + ring(x) +
      '<span class="grow rn-m"><b>' + k[2] + ' ' + e(x.name) + '</b><span class="hint">' + e(k[1]) + (x.provider ? ' · ' + e(x.provider) : '') + (x.ref ? ' · ' + e(x.ref) : '') + '</span>' +
      '<span class="rn-when">' + (live(x) ? e(U.fmtShort(x.due)) + ' · <em>' + e(whenTxt(n)) + '</em>' : 'Stopped') + (x.cal ? ' · ' + ED.icon('calendar') : '') + (x.auto !== false && live(x) ? ' · <span class="hint">auto-records</span>' : '') + '</span>' + useLine(x) + '</span>' +
      '<span class="rn-cost num"><b>' + e(money(+x.cost || 0)) + '</b><span class="hint">' + e(cyc(x.cycle)[1].replace('Every ', '/ ').replace('One time (does not renew)', 'one time')) + '</span></span></button>' +
      '<span class="rn-btns">' + (useOn(x) ? '<button type="button" class="btn small rn-usebtn" data-act="rn-use" data-id="' + e(x.id) + '" title="Log how much you used">' + ED.icon('plus') + 'Use</button>' : '') +
      (live(x) ? '<button type="button" class="btn small rn-pay" data-act="rn-pay" data-id="' + e(x.id) + '" title="Record the payment in Money and set the next renewal">' + ED.icon('check') + 'Paid</button>' : '') + '</span></li>';
  };
  const left = () => {
    const s = st(), all = R().list.filter(x => !s.g || kind(x.kind)[3] === s.g);
    const ord = (a, b) => (live(a) ? 0 : 1) - (live(b) ? 0 : 1) || String(a.due || '').localeCompare(String(b.due || ''));
    const sec = (t, l) => l.length ? '<h3 class="gh rn-gh">' + t + ' <span class="hint num">' + l.length + '</span></h3><ul class="rn-list">' + l.sort(ord).map(card).join('') + '</ul>' : '';
    const by = u => all.filter(x => urg(x) === u);
    const seg = '<div class="seg st-seg" role="group" aria-label="Show">' + GROUPS.map(g => '<button type="button" class="seg-b' + (s.g === g[0] ? ' on' : '') + '" data-act="rn-g" data-g="' + g[0] + '" aria-pressed="' + (s.g === g[0]) + '">' + e(g[1]) + '</button>').join('') + '</div>';
    const pol = ((D().finance || {}).holdings || []).filter(h => h.type === 'insurance' && !R().list.some(x => x.holdingId === h.id));
    const body = '<p class="hint">Policies, subscriptions and memberships with their price and renewal date. A reminder goes into the Daily planner before each one is due, and the payment is recorded in Money.</p>' +
      '<div class="xp-filters"><button type="button" class="btn small primary" data-act="rn-edit">' + ED.icon('plus') + 'Add</button>' + seg + '<button type="button" class="btn small ghost" data-act="rn-restore" title="Add the items from a diary backup or device copy (.json) that are missing here — nothing else is changed">' + ED.icon('upload') + 'Bring back from a file…</button></div>' +
      (pol.length ? '<div class="notice rn-import">' + ED.icon('info') + '<span class="grow">' + U.plural(pol.length, 'insurance policy', 'insurance policies') + ' in Money → Accounts &amp; policies ' + (pol.length === 1 ? 'is' : 'are') + ' not here yet.</span><button type="button" class="btn small" data-act="rn-import">Bring ' + (pol.length === 1 ? 'it' : 'them') + ' in</button></div>' : '') +
      (all.length ? sec('Overdue', by('late')) + sec('Due soon', by('soon')) + sec('Within 30 days', by('near')) + sec('Later', by('later')) + sec('Stopped', by('off'))
        : '<div class="empty">' + ED.icon('shield') + '<div><b>' + (R().list.length ? 'Nothing in this group.' : 'Nothing here yet.') + '</b><br>Add your health and vehicle insurance, term plan, OTT and cloud subscriptions, gym, domain, driving licence…</div></div>');
    return FX().page('rn', 'Insurance &amp; Subscriptions', '', body, 'rn-l');
  };

  const right = () => {
    const today = U.today(), l = R().list.filter(live), yr = l.reduce((a, x) => a + perYear(x), 0);
    const in30 = l.filter(x => daysTo(x) <= 30), late = l.filter(x => daysTo(x) < 0), nx = l.slice().sort((a, b) => a.due.localeCompare(b.due))[0];
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('A year', money(yr), money(yr / 12) + ' a month') + FX().tile('Due in 30 days', String(in30.length), in30.length ? money(in30.reduce((a, x) => a + (+x.cost || 0), 0)) : 'nothing', late.length ? 'warn' : '') +
      FX().tile('Next', nx ? e(kind(nx.kind)[2] + ' ' + nx.name) : '—', nx ? whenTxt(daysTo(nx)) : '', nx && daysTo(nx) <= 7 ? 'warn' : '') + FX().tile('Active', String(l.length), late.length ? late.length + ' overdue' : 'all on time', late.length ? 'warn' : '') + '</div>';
    // the runway: the next 12 months, every renewal on it
    const end = U.addMonths(today, 12), span = U.diffDays(today, end), occ = [];
    l.forEach(x => { let k = x.due, i = 0; while (k && k <= end && i++ < 60) { occ.push({ x, k }); const m = cyc(x.cycle)[2]; k = m ? U.addMonths(k, m) : null; } });
    const maxC = Math.max(1, ...occ.map(o => +o.x.cost || 0));
    const months = []; for (let i = 0; i <= 12; i++) { const m = U.addMonths(U.firstOfMonth(today), i); if (m > today && m <= end) months.push(m); }
    const pos = k => Math.max(0, Math.min(100, U.diffDays(today, k) / span * 100));
    const dots = occ.sort((a, b) => (+b.x.cost || 0) - (+a.x.cost || 0)).map(o => { const n = U.diffDays(today, o.k), u = n < 0 ? 'late' : n <= 7 ? 'soon' : n <= 30 ? 'near' : 'later', sz = 10 + Math.round(Math.sqrt((+o.x.cost || 0) / maxC) * 18);
      return '<button type="button" class="rn-dot u-' + u + '" data-act="rn-edit" data-id="' + e(o.x.id) + '" style="left:' + pos(o.k).toFixed(2) + '%;--s:' + sz + 'px;--g:' + GCOL[kind(o.x.kind)[3]] + '" title="' + e(kind(o.x.kind)[2] + ' ' + o.x.name + ' · ' + U.fmtShort(o.k) + ' · ' + money(+o.x.cost || 0) + ' · ' + whenTxt(n)) + '" aria-label="' + e(o.x.name + ', ' + U.fmtShort(o.k)) + '"></button>'; }).join('');
    const runway = '<div class="rn-run" role="group" aria-label="Renewals in the next 12 months"><div class="rn-zone z7" style="width:' + (7 / span * 100).toFixed(2) + '%"></div><div class="rn-zone z30" style="left:' + (7 / span * 100).toFixed(2) + '%;width:' + (23 / span * 100).toFixed(2) + '%"></div><div class="rn-axis"></div>' +
      months.map(m => '<span class="rn-mo" style="left:' + pos(m).toFixed(2) + '%">' + U.MON[+m.slice(5, 7) - 1] + (m.slice(5, 7) === '01' ? ' ’' + m.slice(2, 4) : '') + '</span>').join('') + '<span class="rn-now">Today</span>' + dots + '</div>' +
      '<p class="hint rn-key"><span><i class="k late"></i>overdue</span><span><i class="k soon"></i>this week</span><span><i class="k near"></i>this month</span><span><i class="k later"></i>later</span><span>bigger dot = bigger amount</span></p>';
    // the next ones, as a countdown list
    const soon = occ.slice().sort((a, b) => a.k.localeCompare(b.k)).slice(0, 6).map(o => { const n = U.diffDays(today, o.k);
      return '<li><span class="rn-cd u-' + (n < 0 ? 'late' : n <= 7 ? 'soon' : n <= 30 ? 'near' : 'later') + '"><b>' + (n < 0 ? '!' : n) + '</b><i>' + (n < 0 ? 'late' : n === 1 ? 'day' : 'days') + '</i></span><span class="grow"><b>' + kind(o.x.kind)[2] + ' ' + e(o.x.name) + '</b><span class="hint">' + e(U.fmtShort(o.k)) + (o.x.provider ? ' · ' + e(o.x.provider) : '') + '</span></span><span class="num">' + e(money(+o.x.cost || 0)) + '</span></li>'; }).join('');
    // cost by kind
    const byK = {}; l.forEach(x => { byK[x.kind] = (byK[x.kind] || 0) + perYear(x); });
    const ks = Object.keys(byK).filter(k => byK[k] > 0).sort((a, b) => byK[b] - byK[a]);
    const stack = ks.length ? '<div class="rn-stack">' + ks.map(k => '<i style="width:' + (byK[k] / yr * 100).toFixed(2) + '%;--g:' + GCOL[kind(k)[3]] + ';opacity:' + (0.45 + 0.55 * byK[k] / byK[ks[0]]).toFixed(2) + '" title="' + e(kind(k)[1] + ' · ' + money(byK[k]) + ' a year') + '"></i>').join('') + '</div><ul class="rn-legend">' + ks.map(k => '<li><span>' + kind(k)[2] + ' ' + e(kind(k)[1]) + '</span><b class="num">' + e(money(byK[k])) + '</b><span class="hint num">' + Math.round(byK[k] / yr * 100) + '%</span></li>').join('') + '</ul>' : '<p class="hint">Add a price to see where the money goes.</p>';
    const ins = l.filter(x => /^ins/.test(x.kind) && +x.cover > 0);
    const cover = ins.length ? '<h3 class="gh fin-gap">Insurance cover</h3><ul class="rn-legend">' + ins.map(x => '<li><span>' + kind(x.kind)[2] + ' ' + e(x.name) + '</span><b class="num">' + e(money(+x.cover)) + '</b><span class="hint num">' + e(money(perYear(x))) + ' / yr</span></li>').join('') + '</ul>' : '';
    const tracked = R().list.filter(useOn);
    const usage = tracked.map(x => {
      const s = RN.usage(x), mx = Math.max(s.share, ...s.days.map(d => d.used), ...s.days.map(d => d.k <= today ? d.avail : 0)) || 1;
      const cols = s.P.len <= 62 ? '<div class="rn-ucols" role="img" aria-label="' + e(x.name) + ': use by day this period">' + s.days.map(d => {
        const fut = d.k > today;
        return '<span class="rn-uc' + (d.today ? ' now' : '') + (fut ? ' fut' : '') + '" title="' + e(U.fmtShort(d.k) + (fut ? ' · share ' + qty(x, s.share) : ' · available ' + qty(x, Math.max(0, d.avail)) + ' · used ' + (d.has ? qty(x, d.used) : 'not logged'))) + '">' +
          '<i class="av" style="height:' + ((fut ? s.share : Math.max(0, d.avail)) / mx * 100).toFixed(1) + '%"></i><i class="us' + (d.used > d.avail + 1e-9 ? ' over' : '') + '" style="height:' + (Math.min(d.used, mx) / mx * 100).toFixed(1) + '%"></i><em>' + (s.P.len <= 8 ? 'SMTWTFS'[new Date(d.k + 'T00:00').getDay()] : (+d.k.slice(8)) % 5 === 0 || d.today ? +d.k.slice(8) : '') + '</em></span>'; }).join('') + '</div>' : '';
      const tip = s.runsOut && s.runsOut < U.addDays(s.P.pe, -1) ? 'At this pace it runs out on ' + U.fmtShort(s.runsOut) + '.' : s.pace ? 'At this pace about ' + qty(x, Math.max(0, s.total - s.pace * s.P.len)) + ' will be left at the end.' : 'Nothing logged yet this period.';
      return '<div class="rn-ucard"><div class="rn-uhead"><b>' + kind(x.kind)[2] + ' ' + e(x.name) + '</b><button type="button" class="btn small" data-act="rn-use" data-id="' + e(x.id) + '">' + ED.icon('plus') + 'Log use</button></div>' +
        '<div class="rn-ustats"><span><b class="' + (s.leftToday < 0 ? 'bad' : '') + '">' + e(qty(x, Math.max(0, s.leftToday))) + '</b>left today</span><span><b>' + e(qty(x, s.share)) + '</b>a day</span><span><b>' + e(qty(x, Math.max(0, s.left))) + '</b>left of ' + e(qty(x, s.total)) + '</span><span><b>' + e(U.fmtDM(s.P.ps)) + '–' + e(U.fmtDM(U.addDays(s.P.pe, -1))) + '</b>this period</span></div>' +
        cols + '<p class="hint">' + e(tip) + ' Unused share carries over to the next day.</p></div>';
    }).join('');
    const body = tiles + (usage ? '<h3 class="gh">Daily usage</h3>' + usage : '') + '<h3 class="gh' + (usage ? ' fin-gap' : '') + '">Deadline runway · next 12 months</h3>' + (occ.length ? runway : '<p class="hint">Nothing due in the next 12 months.</p>') +
      (soon ? '<h3 class="gh fin-gap">Countdown</h3><ul class="rn-soon">' + soon + '</ul>' : '') + '<h3 class="gh fin-gap">What it costs a year, by kind</h3>' + stack + cover;
    return '<div class="xp rn-r"><div class="pg-head st-head"><h2 class="pg-title">Renewals at a glance</h2></div><div class="st-scroll scroll" data-keep-scroll="rn-r">' + body + '</div></div>';
  };
  ED.views = ED.views || {};
  ED.views.renewals = { id: 'renewals', label: 'Insurance & Subscriptions', left, right };

  /* ---------------- add / edit ---------------- */
  RN.edit = (id, preset) => {
    const w = R(), x = id ? w.list.find(y => y.id === id) : null, f = D().finance || {};
    const cats = (f.cats || []).filter(c => c.type !== 'income').map(c => [c.id, (c.icon ? c.icon + ' ' : '') + c.name]);
    const accs = [['', '— not set —']].concat((f.accounts || []).map(a => [a.id, a.name]));
    const data = x ? Object.assign({}, x) : Object.assign({ name: '', kind: 'ins-health', provider: '', ref: '', cover: null, cost: null, cycle: 'yearly', due: U.addMonths(U.today(), 1), remind: 15, auto: true, accountId: '', categoryId: '', cal: '', link: '', notes: '', active: true }, preset || {});
    if (!data.categoryId) data.categoryId = defCat(data.kind);
    data.stopped = data.active === false;
    const u0 = data.usage || {};
    Object.assign(data, { useOn: !!u0.on, useTotal: u0.total != null ? u0.total : 100, useUnit: u0.unit != null ? u0.unit : '%', useEvery: u0.every || 'week', useDays: u0.days || 7, useStart: u0.start || U.today() });
    FX().form({
      title: x ? 'Insurance / subscription' : 'Add insurance or subscription', wide: true,
      intro: 'A reminder goes into the Daily planner the chosen number of days before the due date. When it is paid (on the due date automatically, or when you tick the reminder / press Paid), the amount is recorded in Money and the next renewal date is set.',
      data,
      fields: [
        { k: 'name', label: 'Name', req: true, ph: 'Family floater, car insurance, Netflix, Google One, gym…' },
        { k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(k => [k[0], k[2] + ' ' + k[1]]) },
        { k: 'provider', label: 'Company / provider', ph: 'Star Health, LIC, ICICI Lombard, Netflix…' },
        { k: 'ref', label: 'Policy / account no.', ph: 'optional' },
        { k: 'cost', label: 'Price each time (₹)', type: 'number', min: 0, step: '0.01' },
        { k: 'cycle', label: 'Renews', type: 'select', options: CYCLES.map(c => [c[0], c[1]]) },
        { k: 'due', label: 'Next renewal / due date', type: 'date', req: true },
        { k: 'cover', label: 'Cover / sum insured (₹)', type: 'number', min: 0, hint: 'For insurance; optional.' },
        { k: 'remind', label: 'Remind me (days before)', type: 'number', min: 0, max: 120, hint: 'A task “🔁 Renew …” in the Daily planner on that day.' },
        { k: 'auto', label: 'Record the payment in Money automatically on the due date', type: 'check' },
        { k: 'accountId', label: 'Paid from', type: 'select', options: accs },
        { k: 'categoryId', label: 'Money category', type: 'select', options: cats.length ? cats : [['fc-other', 'Other']] },
        { k: 'cal', label: 'Calendar', type: 'select', options: [['', 'No calendar entry'], ['diary', 'Diary calendar (on the due date)'], ['google', 'Diary calendar + Google Calendar']] },
        { k: 'link', label: 'Website / renew link', ph: 'https://…' },
        { k: 'stopped', label: 'Stopped (cancelled / not renewing)', type: 'check' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
        { type: 'head', label: 'Usage allowance (optional)' },
        { k: 'useOn', label: 'Track how much of it I use each day', type: 'check' },
        { k: 'useTotal', label: 'Amount for the period', type: 'number', min: 0, step: 'any', hint: 'e.g. 100 (%) of a weekly limit; spread evenly over the days, unused share carries over.' },
        { k: 'useUnit', label: 'Unit', ph: '%, hours, GB, messages…' },
        { k: 'useEvery', label: 'Resets', type: 'select', options: EVERY },
        { k: 'useDays', label: 'Days in the period (for “every few days”)', type: 'number', min: 1, max: 366 },
        { k: 'useStart', label: 'A day the period starts', type: 'date', hint: 'e.g. the day the weekly limit resets.' },
      ],
      extra: x && live(x) ? '<button type="button" class="btn" data-x="paid">' + ED.icon('check') + 'Paid now</button>' : '',
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Delete', message: 'Delete “' + x.name + '” and its open reminder? Payments already recorded in Money stay.', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Delete renewal'); FX().dropEvent(x); w.list = w.list.filter(y => y !== x); D().tasks = D().tasks.filter(t => !(t.link && t.link.k === 'renewal' && t.link.id === x.id && !M.isClosed(t.status))); ED.store.commit(); ED.ui.undoToast('Deleted'); } : null,
      mount(el, api) {
        const kd = el.querySelector('select[id$="-kind"]'), ct = el.querySelector('select[id$="-categoryId"]');   // the Money category follows the kind until you pick one
        if (kd && ct) { let auto = ct.value === defCat(kd.value); ct.addEventListener('change', () => { auto = false; }); kd.addEventListener('change', () => { if (auto) ct.value = defCat(kd.value); }); }
        const b = el.querySelector('[data-x="paid"]'); if (b) b.addEventListener('click', () => { api.close(); RN.pay(x.id); }); },
      save(v, api) {
        const wasCal = x ? x.cal : '';
        ED.store.checkpoint(x ? 'Renewal' : 'Add renewal');
        const it = x || { id: U.uid('rn'), paid: {} };
        const due0 = it.due;
        Object.assign(it, v, { cost: +v.cost || 0, cover: +v.cover || 0, remind: Math.max(0, Math.round(+v.remind || 0)), active: !v.stopped, updatedAt: Date.now() });
        delete it.stopped;
        const ul = (it.usage && it.usage.log) || {};
        it.usage = { on: !!v.useOn, total: +v.useTotal || 0, unit: v.useUnit == null ? '%' : String(v.useUnit).trim(), every: v.useEvery || 'week', days: Math.max(1, Math.round(+v.useDays || 7)), start: U.isKey(v.useStart) ? v.useStart : U.today(), log: ul };
        ['useOn', 'useTotal', 'useUnit', 'useEvery', 'useDays', 'useStart'].forEach(k => { delete it[k]; });
        if (!it.usage.on && !Object.keys(ul).length) delete it.usage;
        if (due0 !== it.due) delete it.skipTask;
        if (!x) w.list.push(it);
        // a reminder for the old date goes; the new one is made by reconcile
        if (x && due0 !== it.due) D().tasks = D().tasks.filter(t => !(t.id === TID(it, due0) && !M.isClosed(t.status)));
        else if (x) { const t = D().tasks.find(t => t.id === TID(it, it.due)); if (t && !M.isClosed(t.status)) { t.date = remindOn(it) < U.today() ? U.today() : remindOn(it); } }
        calSync(it);
        ED.store.commit(); api.close();
        if (it.cal === 'google' && wasCal !== 'google') toGoogle(it);
        ED.ui.toast((x ? 'Saved' : 'Added') + (live(it) ? ' — reminder on ' + U.fmtShort(remindOn(it) < U.today() ? U.today() : remindOn(it)) : ''));
      },
    });
  };
  A['rn-edit'] = el => RN.edit(el.dataset.id || null);
  A['rn-pay'] = el => RN.pay(el.dataset.id);
  A['rn-g'] = el => { st().g = el.dataset.g || ''; ED.app.render(); };
  /* 1.26.1: bring back items from a backup / device-copy file (or a file holding only this page's items):
     only items that are not here are added; everything else in the diary stays as it is */
  RN.restoreFrom = raw => {
    const o = raw && raw.data ? raw.data : raw, src = (o && o.renewals && o.renewals.list) || (Array.isArray(o) ? o : null);
    if (!Array.isArray(src)) return -1;
    const have = new Set(R().list.map(x => x.id)), add = src.filter(x => x && typeof x.id === 'string' && x.name && !have.has(x.id));
    if (!add.length) return 0;
    ED.store.checkpoint('Bring back');
    const now = Date.now();
    add.forEach(x => { const y = JSON.parse(JSON.stringify(x)); y.updatedAt = now; R().list.push(y); });
    const g = D().meta && D().meta.gone; if (g) add.forEach(x => { delete g[x.id]; });
    ED.store.commit();
    return add.length;
  };
  A['rn-restore'] = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      let raw; try { raw = JSON.parse(await f.text()); } catch (_) { ED.ui.toast('That file could not be read (not a diary .json file)'); return; }
      const n = RN.restoreFrom(raw);
      ED.ui.toast(n < 0 ? 'No Insurance & Subscriptions items in that file' : n === 0 ? 'Everything in that file is already here' : U.plural(n, 'item') + ' brought back — reminders and calendar entries follow');
    });
    inp.click();
  };
  A['rn-import'] = () => {
    const pol = ((D().finance || {}).holdings || []).filter(h => h.type === 'insurance' && !R().list.some(x => x.holdingId === h.id)); if (!pol.length) return;
    ED.store.checkpoint('Bring in policies');
    const cy = { monthly: 'monthly', quarterly: 'quarterly', 'half-yearly': 'half', halfyearly: 'half', yearly: 'yearly', annual: 'yearly', once: 'once', single: 'once' };
    pol.forEach(h => R().list.push({ id: U.uid('rn'), holdingId: h.id, name: h.name || 'Insurance', kind: /health|medi/i.test(h.name || '') ? 'ins-health' : /car|bike|motor|vehicle/i.test(h.name || '') ? 'ins-vehicle' : /life|term|lic/i.test((h.name || '') + ' ' + (h.institution || '')) ? 'ins-life' : 'ins-other',
      provider: h.institution || '', ref: h.ref || '', cost: +h.premium || 0, cover: +h.amount || +h.value || 0, cycle: cy[String(h.frequency || 'yearly').toLowerCase()] || 'yearly', due: U.isKey(h.due) ? h.due : U.addMonths(U.today(), 1), remind: 15, auto: true, accountId: '', categoryId: defCat('ins-health'), cal: '', link: '', notes: h.notes || '', active: true, paid: {}, updatedAt: Date.now() }));
    ED.store.commit(); ED.ui.toast(U.plural(pol.length, 'policy', 'policies') + ' brought in — check their dates and prices');
  };
})();
(function () { const A = (window.ED.actions = window.ED.actions || {}); A['rn-open'] = el => { window.ED.go.tab('renewals'); setTimeout(() => window.ED.renewals.edit(el.dataset.id), 60); }; })();
