/* E-Diary — 1.24: Study → Edit the plan, and several plans shown together.
   One screen (Plan ▾ → Edit the plan, or the today card) with three tabs:
     • Subjects — each subject's usual days, time and minutes and its dates. "Change its schedule" re-makes its open
       sessions from a date (the topics, books and notes of those sessions move to the new ones in the same order);
       move its dates; rename; delete it (its ticked sessions stay in your progress). Add a subject.
     • Sessions — every session in a table: date, time, minutes, subject and topic can be changed in place; tick many and
       move them by days, give them a time or minutes, or delete them.
     • Plans — the plan shown, and the other plans you keep. "Show together" puts another plan's subjects and sessions
       into the plan shown (as a part — its subjects keep their own names and times), so the Year, Month, Week & Day and
       Daily pages show both; "Separate again" takes a part back out as its own plan; "Delete" removes a part or a plan.
   Sessions at the same time on the same day are marked ⚠ wherever sessions are listed (the times should differ).
   Ticked sessions are never moved or deleted by these tools; every change can be undone right after.
   Data: plan.parts = [ { id, title, meta: { title, subtitle, start, end, slots, weeks } } ]; track.part, session.part */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const ST = ED.study;
  const A = (ED.actions = ED.actions || {});
  const SE = (ED.studyEdit = {});
  const D = () => ED.store.data;
  const o = (v, l, s) => '<option value="' + e(v) + '"' + (s ? ' selected' : '') + '>' + e(l) + '</option>';
  const DAYS = [1, 2, 3, 4, 5, 6, 0];
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
  const fm = m => ST.fmtMin(m);
  const mode = arr => { const c = new Map(); arr.forEach(x => { if (x != null && x !== '') c.set(x, (c.get(x) || 0) + 1); }); let best = null, n = 0; c.forEach((v, k) => { if (v > n) { n = v; best = k; } }); return best; };
  const after = () => {               // keep weeks, order and week numbers right after any change
    const p = ST.plan(); if (!p) return;
    if (ST.extendWeeks) ST.extendWeeks();
    ST.sessions().forEach(s => { const w = ST.weekOf(s.date); s.week = w ? w.n : (s.week || 0); });
    D().study.sessions.sort((a, b) => a.date.localeCompare(b.date) || String(ST.timeOf(a) || '99').localeCompare(String(ST.timeOf(b) || '99')) || (a.slotNo || 9) - (b.slotNo || 9));
    p.updatedAt = Date.now();
  };
  SE.after = after;
  const mk = (trackId, k, v) => ({ id: U.uid('ss'), week: 0, date: k, slotNo: +v.slotNo || 1, kind: '', slot: ST.slotText(+v.slotNo || 1, ''), trackId, min: Math.max(5, Math.round(+v.min || 30)), topic: '', sourceId: '', source: '', done: false, doneAt: null, doneOn: null, spent: null, time: v.time || null, note: '', own: true, updatedAt: Date.now() });

  /* ---------------- a subject's pattern ---------------- */
  SE.pattern = trId => {
    const t = U.today(), all = ST.sessions().filter(s => s.trackId === trId), open = all.filter(s => !s.done && s.date >= t);
    const src = open.length ? open : all;
    return { n: all.length, done: all.filter(s => s.done).length, open: open.length, days: DAYS.filter(d => src.some(s => U.dow(s.date) === d)),
      time: mode(src.map(s => ST.timeOf(s))), min: mode(src.map(s => s.min)) || 30, slotNo: mode(src.map(s => s.slotNo || 1)) || 1,
      first: src.length ? src[0].date : null, last: src.length ? src[src.length - 1].date : null };
  };
  /* re-make a subject's open sessions between two dates on new days / time / minutes; their topics, books and notes
     move to the new sessions in order (none is lost: extra ones go on after the last date, same pattern) */
  SE.reschedule = (trId, v, dry) => {
    const from = v.from, to = v.to, t = U.today();
    if (!U.isKey(from) || !U.isKey(to) || to < from) return { msg: 'Choose the dates.', n: 0 };
    if (!v.days.length) return { msg: 'Tick at least one day.', n: 0 };
    const old = ST.sessions().filter(s => s.trackId === trId && !s.done && s.date >= from && s.date <= to && s.date >= (from < t ? from : from));
    const dates = U.range(from, U.diffDays(from, to) + 1).filter(k => v.days.indexOf(U.dow(k)) >= 0);
    const carry = old.filter(s => s.topic || s.sourceId || s.source || s.note);
    let k = U.addDays(to, 1), guard = 0; while (dates.length < carry.length && guard++ < 800) { if (v.days.indexOf(U.dow(k)) >= 0) dates.push(k); k = U.addDays(k, 1); }
    const msg = U.plural(old.length, 'open session') + ' between ' + U.fmtShort(from) + ' and ' + U.fmtShort(to) + ' become ' + U.plural(dates.length, 'session') + ' on ' + (v.days.length === 7 ? 'every day' : v.days.map(d => U.DAY3[d]).join(', ')) + (v.time ? ' at ' + ED.fx.time(v.time) : '') + ', ' + fm(+v.min || 30) + ' each' + (carry.length ? '; their ' + U.plural(carry.length, 'topic') + ' move along in order.' : '.');
    if (dry) return { msg, n: old.length + dates.length };
    const ids = new Set(old.map(s => s.id));
    D().study.sessions = ST.sessions().filter(s => !ids.has(s.id));
    const made = dates.map(d => mk(trId, d, v));
    carry.forEach((s, i) => { const n = made[i]; if (!n) return; n.topic = s.topic; n.sourceId = s.sourceId; n.source = s.source; n.note = s.note; });
    const tr = ST.track(trId); if (tr && tr.part) made.forEach(s => { s.part = tr.part; });
    made.forEach(s => D().study.sessions.push(s));
    after();
    return { msg, n: made.length };
  };
  SE.shift = (trId, from, n) => { let c = 0; ST.sessions().forEach(s => { if ((!trId || s.trackId === trId) && !s.done && s.date >= from) { s.date = U.addDays(s.date, n); s.updatedAt = Date.now(); c++; } }); after(); return c; };
  SE.deleteSubject = trId => {
    const p = ST.plan(), l = ST.sessions().filter(s => s.trackId === trId), done = l.filter(s => s.done).length;
    D().study.sessions = ST.sessions().filter(s => s.trackId !== trId || s.done);
    if (!done) { p.tracks = p.tracks.filter(t => t.id !== trId); p.topics = (p.topics || []).filter(x => x.trackId !== trId); p.tracks.forEach((t, i) => { t.idx = i; }); }
    after(); return { removed: l.length - done, kept: done };
  };
  SE.addSubject = (name, v) => { const tr = ST.addTrack(name.trim()); const r = SE.reschedule(tr.id, v); return { tr, n: r.n }; };

  /* ---------------- several plans together ---------------- */
  const metaOf = pl => ({ title: pl.title, subtitle: pl.subtitle || '', start: pl.start, end: pl.end, slots: U.clone(pl.slots || []), weeks: U.clone(pl.weeks || []) });
  SE.combine = id => {
    const sd = D().study, p = ST.plan(), x = ST.shelf().find(y => y.id === id); if (!p || !x) return 0;
    if (!p.id) p.id = U.uid('sp');
    const src = x.plan, slotT = no => { const sl = (src.slots || []).find(z => z.no === (no || 1)); return sl && sl.time || null; };
    const ids = new Set(p.tracks.map(t => t.id)), map = {};
    (src.tracks || []).forEach(t0 => { const t = U.clone(t0); if (ids.has(t.id)) t.id = 'tr-' + U.uid('p'); map[t0.id] = t.id; t.part = id; delete t.color; t.idx = p.tracks.length; p.tracks.push(t); ids.add(t.id); });
    const sids = new Set(ST.sessions().map(s => s.id));
    (x.sessions || []).forEach(s0 => { const s = U.clone(s0); if (sids.has(s.id)) s.id = U.uid('ss'); s.trackId = map[s.trackId] || s.trackId; if (!s.time) s.time = slotT(s.slotNo); s.part = id; sd.sessions.push(s); });
    ['topics', 'books', 'lectures', 'items'].forEach(k => { if (!Array.isArray(src[k]) || !src[k].length) return; p[k] = p[k] || []; src[k].forEach(y0 => { const y = U.clone(y0); if (y.trackId) y.trackId = map[y.trackId] || y.trackId; y.part = id; p[k].push(y); }); });
    p.parts = (p.parts || []).concat([{ id, title: src.title, meta: metaOf(src), at: Date.now() }]);
    if (src.start && (!p.start || src.start < p.start)) p.start = src.start;
    after();
    (src.weeks || []).forEach(w => { if (!w.themes) return; const tw = ST.weekOf(w.start); if (!tw) return; tw.themes = tw.themes || {}; Object.keys(w.themes).forEach(k => { if (map[k] && !tw.themes[map[k]]) tw.themes[map[k]] = w.themes[k]; }); });
    sd.shelf = ST.shelf().filter(y => y.id !== id);
    return (x.sessions || []).length;
  };
  SE.separate = id => {
    const sd = D().study, p = ST.plan(), part = (p && p.parts || []).find(x => x.id === id); if (!part) return 0;
    const trs = p.tracks.filter(t => t.part === id), tids = new Set(trs.map(t => t.id));
    const ss = ST.sessions().filter(s => tids.has(s.trackId) || s.part === id);
    const pl = Object.assign({ id, tracks: trs.map(t => { const c = U.clone(t); delete c.part; return c; }) }, U.clone(part.meta), { updatedAt: Date.now() });
    pl.tracks.forEach((t, i) => { t.idx = i; });
    ['topics', 'books', 'lectures', 'items'].forEach(k => { pl[k] = (p[k] || []).filter(y => y.part === id || (y.trackId && tids.has(y.trackId))).map(y => { const c = U.clone(y); delete c.part; return c; }); p[k] = (p[k] || []).filter(y => !(y.part === id || (y.trackId && tids.has(y.trackId)))); });
    const out = ss.map(s => { const c = U.clone(s); delete c.part; const w = (pl.weeks || []).find(w0 => c.date >= w0.start && c.date <= U.addDays(w0.start, 6)); c.week = w ? w.n : 0; return c; });
    const last = out.reduce((m, s) => s.date > m ? s.date : m, pl.end || ''); if (last) pl.end = last;
    sd.sessions = ST.sessions().filter(s => !(tids.has(s.trackId) || s.part === id));
    p.tracks = p.tracks.filter(t => !tids.has(t.id)); p.tracks.forEach((t, i) => { t.idx = i; });
    p.parts = p.parts.filter(x => x.id !== id);
    sd.shelf = ST.shelf().concat([{ id, plan: pl, sessions: out, savedAt: Date.now(), updatedAt: Date.now() }]);
    after();
    return out.length;
  };
  SE.dropPart = id => {
    const sd = D().study, p = ST.plan(); const tids = new Set(p.tracks.filter(t => t.part === id).map(t => t.id));
    const n = ST.sessions().filter(s => tids.has(s.trackId) || s.part === id).length;
    sd.sessions = ST.sessions().filter(s => !(tids.has(s.trackId) || s.part === id));
    p.tracks = p.tracks.filter(t => !tids.has(t.id)); p.tracks.forEach((t, i) => { t.idx = i; });
    ['topics', 'books', 'lectures', 'items'].forEach(k => { p[k] = (p[k] || []).filter(y => !(y.part === id || (y.trackId && tids.has(y.trackId)))); });
    p.parts = (p.parts || []).filter(x => x.id !== id); after(); return n;
  };
  SE.deletePlan = () => {
    const sd = D().study, sh = ST.shelf();
    if (sh.length) { const x = sh[sh.length - 1]; sd.shelf = sh.slice(0, -1); sd.plan = x.plan; sd.sessions = x.sessions || []; }
    else { sd.plan = null; sd.sessions = []; }
    ED.state.study = {};
  };

  /* ---------------- same time on the same day ---------------- */
  SE.clashes = k => {
    const l = ST.on(k).map(s => { const t = ST.timeOf(s); return { s, a: t ? U.toMin(t) : null }; }), out = new Map();
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const x = l[i], y = l[j];
      const hit = x.a != null && y.a != null ? (x.a < y.a + (y.s.min || 0) && y.a < x.a + (x.s.min || 0)) : (x.a == null && y.a == null && (x.s.slotNo || 1) === (y.s.slotNo || 1));
      if (!hit) continue;
      (out.get(x.s.id) || out.set(x.s.id, []).get(x.s.id)).push(y.s); (out.get(y.s.id) || out.set(y.s.id, []).get(y.s.id)).push(x.s);
    }
    return out;
  };
  /* mark every listed session that clashes — after each render, wherever sessions are shown */
  let marking = false;
  SE.mark = root => {
    if (marking || !ST.plan()) return; marking = true;
    try {
      const els = (root || document).querySelectorAll('[data-sid]'), byDay = new Map();
      els.forEach(el => {
        if (el.classList.contains('stick') || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
        const s = ST.session(el.dataset.sid); if (!s) return;
        if (!byDay.has(s.date)) byDay.set(s.date, SE.clashes(s.date));
        const c = byDay.get(s.date).get(s.id);
        el.classList.toggle('st-clash', !!c);
        if (c) { const msg = '⚠ Same time as ' + c.map(z => ST.short(ST.track(z.trackId))).join(', ') + ' — give one of them another time'; el.setAttribute('data-clash', msg); if (!el.title || el.dataset.clashT) { el.title = msg; el.dataset.clashT = '1'; } }
        else { el.removeAttribute('data-clash'); if (el.dataset.clashT) { el.removeAttribute('title'); delete el.dataset.clashT; } }
      });
    } finally { marking = false; }
  };
  if (typeof MutationObserver !== 'undefined') {
    let t = 0; const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => SE.mark(document), 60); });
    const start = () => { if (document.body) mo.observe(document.body, { childList: true, subtree: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }

  /* ---------------- the editor ---------------- */
  SE.open = tab => {
    const p = ST.plan();
    if (!p && !ST.shelf().length) { ED.ui.toast('Make or import a study plan first'); return; }
    const s = { tab: tab || 'subjects', open: null, f: { tr: '', from: U.today(), to: '', done: false, lim: 80 }, sel: new Set() };
    let api, el;
    const subjects = () => {
      const pl = ST.plan(); if (!pl) return '<p class="hint">No plan is shown — pick one in Plans.</p>';
      const today = U.today();
      const rows = pl.tracks.map(tr => {
        const pt = SE.pattern(tr.id), part = tr.part && (pl.parts || []).find(x => x.id === tr.part), on = s.open === tr.id;
        return '<div class="spe-row' + (on ? ' on' : '') + '" style="--c:' + ST.color(tr) + '"><div class="spe-rh"><i class="spe-sw"></i>' +
          '<input class="field spe-name" data-se="rename" data-tr="' + e(tr.id) + '" value="' + e(tr.name) + '" aria-label="Subject name">' +
          (part ? '<span class="spe-part" title="From the plan “' + e(part.title) + '”">' + e(part.title) + '</span>' : '') +
          '<span class="spe-pat">' + (pt.days.length ? pt.days.map(d => U.DAY3[d]).join(' ') : 'no open sessions') + (pt.time ? ' · ' + e(ED.fx.time(pt.time)) : '') + ' · ' + fm(pt.min) + '</span>' +
          '<span class="hint spe-cnt">' + pt.open + ' to come · ' + pt.done + ' done' + (pt.first ? ' · ' + e(U.fmtDM(pt.first)) + ' – ' + e(U.fmtDM(pt.last)) : '') + '</span>' +
          '<span class="spe-acts"><button type="button" class="btn small' + (on ? ' primary' : '') + '" data-se="open" data-tr="' + e(tr.id) + '">' + ED.icon('calendar') + 'Schedule</button>' +
          '<button type="button" class="icon-btn sm" data-se="del" data-tr="' + e(tr.id) + '" aria-label="Delete ' + e(tr.name) + '" title="Delete this subject">' + ED.icon('trash') + '</button></span></div>' +
          (on ? schedForm(tr.id, pt) : '') + '</div>';
      }).join('');
      return '<p class="hint spe-lead">Change a subject’s days, time and minutes, or move its dates. Ticked sessions never change.</p>' + rows +
        '<div class="spe-row spe-new' + (s.open === '__new' ? ' on' : '') + '"><div class="spe-rh"><span class="spe-sw">➕</span><input class="field spe-name" id="spe-newname" placeholder="A new subject — e.g. Cyber security" value="' + e(s.newName || '') + '" aria-label="New subject name">' +
        '<span class="spe-acts"><button type="button" class="btn small primary" data-se="open" data-tr="__new">' + ED.icon('calendar') + 'Set its schedule</button></span></div>' +
        (s.open === '__new' ? schedForm('__new', { days: [1, 2, 3, 4, 5], time: '', min: 30, slotNo: 1 }) : '') + '</div>';
    };
    const schedForm = (trId, pt) => {
      const pl = ST.plan(), t = U.today();
      return '<div class="spe-sched"><div class="sa-days" role="group" aria-label="Days">' + DAYS.map(d => '<label class="chip-check"><input type="checkbox" data-d="' + d + '"' + (pt.days.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + U.DAY3[d] + '</span></label>').join('') + '</div>' +
        '<div class="sa-row"><label class="sa-f"><span>Time</span><input type="time" class="field" id="spe-time" value="' + e(pt.time || '') + '"></label>' +
        '<label class="sa-f"><span>Minutes</span><input type="number" class="field num" id="spe-min" min="5" max="600" step="5" value="' + e(pt.min || 30) + '"></label>' +
        '<label class="sa-f"><span>From</span><input type="date" class="field" id="spe-from" value="' + t + '"></label>' +
        '<label class="sa-f"><span>To</span><input type="date" class="field" id="spe-to" value="' + e((pl && pl.end && pl.end > t ? pl.end : U.addDays(t, 27))) + '"></label></div>' +
        '<p class="sa-prev" id="spe-prev" role="status" aria-live="polite"></p>' +
        '<div class="row-btns"><button type="button" class="btn small primary" data-se="apply" data-tr="' + e(trId) + '">' + ED.icon('check') + (trId === '__new' ? 'Add the subject' : 'Apply the schedule') + '</button>' +
        (trId !== '__new' ? '<span class="spe-or">or move its dates</span><input type="number" class="field num spe-n" id="spe-shift" value="7" step="1" aria-label="Days to move (negative = earlier)"><button type="button" class="btn small" data-se="shift" data-tr="' + e(trId) + '">days later</button>' : '') +
        '<button type="button" class="btn small ghost" data-se="close">Close</button></div></div>';
    };
    const readSched = () => ({ days: U.$$('.spe-sched [data-d]', el).filter(i => i.checked).map(i => +i.dataset.d), time: (el.querySelector('#spe-time') || {}).value || '', min: +((el.querySelector('#spe-min') || {}).value || 30), from: (el.querySelector('#spe-from') || {}).value, to: (el.querySelector('#spe-to') || {}).value, slotNo: 1 });
    const sessionsTab = () => {
      const pl = ST.plan(); if (!pl) return '<p class="hint">No plan is shown.</p>';
      const f = s.f;
      const l = ST.sessions().filter(x => (!f.tr || x.trackId === f.tr) && (!U.isKey(f.from) || x.date >= f.from) && (!U.isKey(f.to) || x.date <= f.to) && (f.done || !x.done));
      const shown = l.slice(0, f.lim);
      const trOpt = sel => pl.tracks.map(t => o(t.id, t.name, t.id === sel)).join('');
      const head = '<div class="spe-filt"><label class="sa-f"><span>Subject</span><select class="field" data-sf="tr">' + o('', 'All subjects', !f.tr) + trOpt(f.tr) + '</select></label>' +
        '<label class="sa-f"><span>From</span><input type="date" class="field" data-sf="from" value="' + e(f.from || '') + '"></label><label class="sa-f"><span>To</span><input type="date" class="field" data-sf="to" value="' + e(f.to || '') + '"></label>' +
        '<label class="switch"><input type="checkbox" data-sf="done"' + (f.done ? ' checked' : '') + '><span class="track"></span><span>Show ticked ones</span></label></div>';
      const bulk = '<div class="spe-bulk" id="spe-bulk"' + (s.sel.size ? '' : ' hidden') + '><b id="spe-bn">' + s.sel.size + ' chosen</b>' +
        '<span>Move</span><input type="number" class="field num spe-n" id="spe-bd" value="7" step="1" aria-label="Days"><button type="button" class="btn small" data-se="bmove">days</button>' +
        '<input type="time" class="field" id="spe-bt" aria-label="Time"><button type="button" class="btn small" data-se="btime">Set time</button>' +
        '<input type="number" class="field num spe-n" id="spe-bm" min="5" step="5" placeholder="min" aria-label="Minutes"><button type="button" class="btn small" data-se="bmin">Set minutes</button>' +
        '<button type="button" class="btn small danger" data-se="bdel">' + ED.icon('trash') + 'Delete</button></div>';
      const rows = shown.map(x => '<tr class="' + (x.done ? 'done' : '') + '" data-sid="' + e(x.id) + '"><td><input type="checkbox" class="spe-ck" data-ck="' + e(x.id) + '"' + (s.sel.has(x.id) ? ' checked' : '') + (x.done ? ' disabled' : '') + ' aria-label="Choose"></td>' +
        '<td><input type="date" class="field spe-in" data-sv="date" value="' + e(x.date) + '"' + (x.done ? ' disabled' : '') + ' aria-label="Date"><span class="hint spe-dw">' + U.DAY3[U.dow(x.date)] + '</span></td>' +
        '<td><input type="time" class="field spe-in" data-sv="time" value="' + e(ST.timeOf(x) || '') + '" aria-label="Time"></td>' +
        '<td><input type="number" class="field num spe-in spe-m" data-sv="min" value="' + e(x.min) + '" min="5" max="600" step="5" aria-label="Minutes"></td>' +
        '<td><select class="field spe-in" data-sv="trackId" aria-label="Subject">' + trOpt(x.trackId) + '</select></td>' +
        '<td><input class="field spe-in" data-sv="topic" value="' + e(x.topic || '') + '" placeholder="topic" aria-label="Topic"></td>' +
        '<td class="spe-st">' + (x.done ? '✓' : '<button type="button" class="icon-btn sm" data-se="del1" data-sid1="' + e(x.id) + '" aria-label="Delete this session" title="Delete">' + ED.icon('trash') + '</button>') + '</td></tr>').join('');
      return head + bulk + '<p class="hint">' + U.plural(l.length, 'session') + (l.length > shown.length ? ' — showing the first ' + shown.length : '') + '. Change any box; it is saved at once. Tick rows to change many together.</p>' +
        '<div class="spe-tw"><table class="st-table spe-tab"><thead><tr><th><input type="checkbox" data-ck="all" aria-label="Choose all shown"></th><th>Date</th><th>Time</th><th>Min</th><th>Subject</th><th>Topic</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (l.length > shown.length ? '<button type="button" class="btn small" data-se="more">Show more</button>' : '') +
        '<div class="row-btns"><button type="button" class="btn small" data-se="add1">' + ED.icon('plus') + 'Add one session</button></div>';
    };
    const plansTab = () => {
      const pl = ST.plan(), sh = ST.shelf();
      const n = (ss, f) => (ss || []).filter(f || (() => true)).length;
      const main = pl ? '<div class="spe-pl on"><div class="grow"><b>' + e(pl.title) + '</b> <span class="chip">shown</span><div class="hint">' + (pl.start ? e(U.fmtShort(pl.start)) + ' – ' + e(U.fmtShort(pl.end)) + ' · ' : '') + U.plural(pl.tracks.filter(t => !t.part).length, 'subject') + '</div></div>' +
        '<button type="button" class="btn small danger" data-se="pdel">' + ED.icon('trash') + 'Delete this plan</button></div>' +
        (pl.parts || []).map(x => { const tids = new Set(pl.tracks.filter(t => t.part === x.id).map(t => t.id)); const ss = ST.sessions().filter(y => tids.has(y.trackId)); return '<div class="spe-pl part"><div class="grow"><b>＋ ' + e(x.title) + '</b> <span class="chip">shown together</span><div class="hint">' + U.plural(tids.size, 'subject') + ' · ' + n(ss, y => y.done) + '/' + ss.length + ' sessions done</div></div>' +
          '<button type="button" class="btn small" data-se="psep" data-id="' + e(x.id) + '">Separate again</button><button type="button" class="icon-btn sm" data-se="pdrop" data-id="' + e(x.id) + '" aria-label="Delete ' + e(x.title) + '" title="Delete this part">' + ED.icon('trash') + '</button></div>'; }).join('') : '<p class="hint">No plan is shown.</p>';
      const others = sh.slice().reverse().map(x => '<div class="spe-pl"><div class="grow"><b>' + e(x.plan.title) + '</b><div class="hint">' + (x.plan.start ? e(U.fmtShort(x.plan.start)) + ' – ' + e(U.fmtShort(x.plan.end)) + ' · ' : '') + n(x.sessions, y => y.done) + '/' + n(x.sessions) + ' sessions done</div></div>' +
        (pl ? '<button type="button" class="btn small primary" data-se="pjoin" data-id="' + e(x.id) + '">Show together</button>' : '') + '<button type="button" class="btn small" data-se="puse" data-id="' + e(x.id) + '">Show only this</button>' +
        '<button type="button" class="icon-btn sm" data-se="pshdel" data-id="' + e(x.id) + '" aria-label="Delete ' + e(x.plan.title) + '" title="Delete">' + ED.icon('trash') + '</button></div>').join('');
      return '<h4 class="spe-h">Shown now</h4>' + main + '<h4 class="spe-h">Your other plans</h4>' + (others || '<p class="hint">None. Import or make another plan — then “Show together” puts it on the same pages (e.g. your plan and a child’s class plan).</p>') +
        '<p class="hint">Plans shown together keep their own subjects and times; sessions at the same time on the same day are marked ⚠ so you can move one.</p>' +
        '<div class="row-btns"><button type="button" class="btn small" data-se="pimp">' + ED.icon('upload') + 'Import a plan…</button><button type="button" class="btn small" data-se="pnew">' + ED.icon('plus') + 'Make a new plan…</button></div>';
    };
    const draw = () => {
      const tabs = [['subjects', 'Subjects'], ['sessions', 'Sessions'], ['plans', 'Plans']];
      el.querySelector('.spe-body').innerHTML = '<div class="seg spe-tabs" role="tablist">' + tabs.map(x => '<button type="button" role="tab" data-se="tab" data-k="' + x[0] + '" aria-pressed="' + (s.tab === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
        '<div class="spe-pane">' + (s.tab === 'sessions' ? sessionsTab() : s.tab === 'plans' ? plansTab() : subjects()) + '</div>';
      prev();
    };
    const prev = () => {
      const pv = el.querySelector('#spe-prev'); if (!pv || !s.open) return;
      const v = readSched();
      pv.textContent = s.open === '__new' ? (v.days.length && U.isKey(v.from) && U.isKey(v.to) ? 'Adds ' + U.plural(U.range(v.from, Math.max(0, U.diffDays(v.from, v.to)) + 1).filter(k => v.days.indexOf(U.dow(k)) >= 0).length, 'session') + ' of ' + fm(v.min) + (v.time ? ' at ' + ED.fx.time(v.time) : '') + '.' : 'Choose days and dates.') : SE.reschedule(s.open, v, true).msg;
    };
    const commit = (label, fn) => { ED.store.checkpoint(label); const r = fn(); ED.store.commit(); draw(); return r; };
    api = ED.ui.modal({
      title: 'Edit the study plan', cls: 'st-modal wide spe-modal', body: '<div class="spe-body"></div>',
      footer: '<span class="hint">Every change is saved at once; the Undo message that follows takes it back.</span><span class="grow"></span><button type="button" class="btn primary" data-mclose>Done</button>',
      onMount(root) {
        el = root;
        el.addEventListener('input', ev => { if (ev.target.id === 'spe-newname') s.newName = ev.target.value; if (ev.target.closest('.spe-sched')) prev(); });
        el.addEventListener('change', ev => {
          const t = ev.target;
          if (t.closest('.spe-sched')) { prev(); return; }
          if (t.dataset.se === 'rename') { const tr = ST.track(t.dataset.tr); if (!tr || !t.value.trim()) return; commit('Rename subject', () => { tr.name = t.value.trim(); delete tr.short; ST.plan().updatedAt = Date.now(); }); return; }
          if (t.dataset.sf) { s.f[t.dataset.sf] = t.type === 'checkbox' ? t.checked : t.value; s.sel.clear(); draw(); return; }
          if (t.dataset.ck) {
            if (t.dataset.ck === 'all') U.$$('.spe-ck', el).forEach(c => { if (!c.disabled) { c.checked = t.checked; if (t.checked) s.sel.add(c.dataset.ck); else s.sel.delete(c.dataset.ck); } });
            else if (t.checked) s.sel.add(t.dataset.ck); else s.sel.delete(t.dataset.ck);
            const b = el.querySelector('#spe-bulk'); b.hidden = !s.sel.size; el.querySelector('#spe-bn').textContent = s.sel.size + ' chosen'; return;
          }
          if (t.dataset.sv) {
            const x = ST.session(t.closest('[data-sid]').dataset.sid); if (!x) return;
            const k = t.dataset.sv, v = t.value;
            if (k === 'date' && !U.isKey(v)) return;
            commit('Change session', () => { x[k] = k === 'min' ? Math.max(5, Math.min(600, Math.round(+v || x.min))) : k === 'time' ? (v || null) : v; x.updatedAt = Date.now(); if (k === 'date' || k === 'time') after(); });
          }
        });
        el.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-se]'); if (!b) return;
          const a = b.dataset.se, tr = b.dataset.tr;
          if (a === 'tab') { s.tab = b.dataset.k; draw(); }
          if (a === 'open') { s.open = s.open === tr ? null : tr; draw(); const f = el.querySelector('.spe-sched'); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' }); }
          if (a === 'close') { s.open = null; draw(); }
          if (a === 'apply') {
            const v = readSched();
            if (tr === '__new') { const nm = (el.querySelector('#spe-newname') || {}).value || ''; if (!nm.trim()) { ED.ui.toast('Type the new subject’s name'); return; } if (!v.days.length) { ED.ui.toast('Tick at least one day'); return; } const r = commit('Add subject', () => SE.addSubject(nm, v)); s.open = null; s.newName = ''; draw(); ED.ui.undoToast('Added “' + nm.trim() + '” — ' + U.plural(r.n, 'session')); }
            else { const r = SE.reschedule(tr, v, true); if (!r.n) { ED.ui.toast(r.msg); return; } commit('Schedule', () => SE.reschedule(tr, v)); s.open = null; draw(); ED.ui.undoToast('Schedule changed — ' + r.msg); }
          }
          if (a === 'shift') { const n = Math.round(+el.querySelector('#spe-shift').value || 0); if (!n) return; const c = commit('Move dates', () => SE.shift(tr, U.today(), n)); ED.ui.undoToast(U.plural(c, 'session') + ' moved ' + Math.abs(n) + ' days ' + (n > 0 ? 'later' : 'earlier')); }
          if (a === 'del') { const t0 = ST.track(tr); const pt = SE.pattern(tr); if (!await ED.ui.confirm({ title: 'Delete “' + t0.name + '”', message: U.plural(pt.n - pt.done, 'session') + ' not ticked will be deleted' + (pt.done ? '; its ' + pt.done + ' ticked ones stay in your progress' : '') + '.', ok: 'Delete', danger: true })) return; const r = commit('Delete subject', () => SE.deleteSubject(tr)); ED.ui.undoToast('Deleted ' + U.plural(r.removed, 'session')); }
          if (a === 'more') { s.f.lim += 120; draw(); }
          if (a === 'del1') { const x = ST.session(b.dataset.sid1); if (!x) return; commit('Delete session', () => { D().study.sessions = ST.sessions().filter(y => y !== x); s.sel.delete(x.id); }); ED.ui.undoToast('Session deleted'); }
          if (a === 'add1') { api.close(); ST.editSession(null, { date: U.today() }); }
          const chosen = () => ST.sessions().filter(x => s.sel.has(x.id) && !x.done);
          if (a === 'bmove') { const n = Math.round(+el.querySelector('#spe-bd').value || 0); if (!n) return; const l = chosen(); commit('Move sessions', () => { l.forEach(x => { x.date = U.addDays(x.date, n); x.updatedAt = Date.now(); }); after(); }); ED.ui.undoToast(U.plural(l.length, 'session') + ' moved'); }
          if (a === 'btime') { const v = el.querySelector('#spe-bt').value; if (!v) { ED.ui.toast('Choose the time'); return; } const l = chosen(); commit('Set time', () => { l.forEach(x => { x.time = v; x.updatedAt = Date.now(); }); after(); }); ED.ui.undoToast('Time set for ' + U.plural(l.length, 'session')); }
          if (a === 'bmin') { const v = Math.round(+el.querySelector('#spe-bm').value || 0); if (!(v >= 5)) { ED.ui.toast('Type the minutes'); return; } const l = chosen(); commit('Set minutes', () => { l.forEach(x => { x.min = v; x.updatedAt = Date.now(); }); }); ED.ui.undoToast('Minutes set'); }
          if (a === 'bdel') { const l = chosen(); if (!await ED.ui.confirm({ title: 'Delete sessions', message: 'Delete ' + U.plural(l.length, 'session') + '?', ok: 'Delete', danger: true })) return; const ids = new Set(l.map(x => x.id)); commit('Delete sessions', () => { D().study.sessions = ST.sessions().filter(x => !ids.has(x.id)); s.sel.clear(); }); ED.ui.undoToast(U.plural(l.length, 'session') + ' deleted'); }
          if (a === 'pjoin') { const n = commit('Show plans together', () => SE.combine(b.dataset.id)); ED.ui.undoToast('Shown together — ' + U.plural(n, 'session') + ' added to the pages'); }
          if (a === 'psep') { const n = commit('Separate plan', () => SE.separate(b.dataset.id)); ED.ui.undoToast('Separated — ' + U.plural(n, 'session') + ' back in its own plan'); }
          if (a === 'pdrop') { const x = (ST.plan().parts || []).find(y => y.id === b.dataset.id); if (!await ED.ui.confirm({ title: 'Delete “' + x.title + '”', message: 'Delete this part — its subjects and all its sessions, ticked ones too? You can undo right after.', ok: 'Delete', danger: true })) return; const n = commit('Delete part', () => SE.dropPart(b.dataset.id)); ED.ui.undoToast(U.plural(n, 'session') + ' deleted'); }
          if (a === 'pdel') { const pl = ST.plan(); if (!await ED.ui.confirm({ title: 'Delete “' + pl.title + '”', message: 'Delete the plan shown — its ' + U.plural(ST.sessions().length, 'session') + ', ticked ones too' + ((pl.parts || []).length ? ', and the plans shown with it' : '') + '? ' + (ST.shelf().length ? 'Your last other plan is shown instead.' : '') + ' You can undo right after.', ok: 'Delete plan', danger: true })) return; commit('Delete plan', () => SE.deletePlan()); ED.ui.undoToast('Plan deleted'); if (!ST.plan()) { api.close(); ED.app.render(); } }
          if (a === 'puse') { api.close(); ST.switchTo(b.dataset.id); }
          if (a === 'pshdel') { api.close(); await ST.dropShelved(b.dataset.id); }
          if (a === 'pimp') { api.close(); ST.importFile(); }
          if (a === 'pnew') { api.close(); ST.newPlan(); }
        });
        draw();
      },
    });
  };
  A['spe-open'] = el => SE.open(el && el.dataset && el.dataset.k);
})();
