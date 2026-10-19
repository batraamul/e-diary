/* E-Diary — study planner: data, statistics, Excel/CSV import and export, editors.
   Data lives in ED.store.data.study = { plan, sessions }.
     plan     : title, dates, tracks (subjects), weeks (phase, note, topic per track), notes,
                slots [{no, name, time, min}]  — any number of study slots per day, each with a default start time
                books / lectures [{id, kind, trackId, track, title, use, access, where}] — your reading and course list
                items [{id, kind (the category), trackId, track, title, by, venue, status, due, where, use}] — papers you write or
                  read, patents you write or read, news, Employment News and your own categories (srcCats [{id, name, icon, mode}])
                topics [{id, trackId, name}] — extra topics you add, offered in the session editor next to each week's topic
     sessions : one row per study session (the "Daily Plan" sheet):
                date, slotNo, slot, kind, trackId, min (planned), topic, sourceId (a book/lecture), source (details),
                done, doneOn (the day you actually studied it), spent (minutes actually studied; empty = as planned), note */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const D = () => ED.store.data;
  const X = ED.xlsx;

  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
  const DAYNAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const DAYABBR = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const KINDS = ['Reading', 'Lecture', 'Code', 'Practice', 'Revision', 'Notes', 'Problems', 'Project', 'Test'];

  const ST = (ED.study = {});
  ST.KINDS = KINDS;
  ST.plan = () => (D().study && D().study.plan) || null;
  ST.sessions = () => (D().study && D().study.sessions) || [];
  ST.track = id => { const p = ST.plan(); return p ? p.tracks.find(t => t.id === id) || null : null; };
  ST.color = tr => tr ? (tr.color || SERIES[(tr.idx || 0) % 8]) : 'var(--ink-3)';
  ST.short = tr => tr ? (tr.short || tr.name) : 'Study';
  ST.session = id => ST.sessions().find(s => s.id === id) || null;

  /* ---------------- tidy a plan (older diaries, imports, plans made here) ---------------- */
  const slotBase = t => String(t || '').replace(/^\s*\d+\s*[-–.:]?\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  ST.normalize = st => {
    const p = st && st.plan; if (!p) return;
    const sessions = st.sessions || [];
    if (!Array.isArray(p.slots) || !p.slots.length) {
      const nos = new Set(sessions.map(s => s.slotNo || 1)); if (!nos.size) { nos.add(1); nos.add(2); }
      const times = p.slotTimes || {};
      p.slots = Array.from(nos).sort((a, b) => a - b).map(no => {
        const names = {}, mins = {};
        sessions.forEach(s => { if ((s.slotNo || 1) !== no) return; const b = slotBase(s.slot); if (b) names[b] = (names[b] || 0) + 1; mins[s.min] = (mins[s.min] || 0) + 1; });
        const name = Object.keys(names).sort((a, b) => names[b] - names[a])[0] || 'Slot ' + no;
        const min = +(Object.keys(mins).sort((a, b) => mins[b] - mins[a])[0] || 60);
        return { no, name, time: times[String(no)] || '', min };
      });
    }
    delete p.slotTimes;
    ['books', 'lectures'].forEach(k => {
      if (!Array.isArray(p[k])) p[k] = [];
      p[k].forEach(x => {
        if (!x.id) x.id = U.uid(k === 'books' ? 'bk' : 'lc');
        x.kind = k === 'books' ? 'book' : 'lecture';
        if (!x.trackId && x.track) { const tr = p.tracks.find(t => t.short === x.track || t.name === x.track); if (tr) x.trackId = tr.id; }
      });
    });
    if (!Array.isArray(p.topics)) p.topics = [];
    if (!Array.isArray(p.items)) p.items = [];
    if (!Array.isArray(p.srcCats)) p.srcCats = [];
    p.items.forEach(x => { if (!x.id) x.id = U.uid('ri'); if (!x.kind) x.kind = 'paper-r'; });
    if (!Array.isArray(p.tracks)) p.tracks = [];
    if (!Array.isArray(p.weeks)) p.weeks = [];
  };

  /* ---------------- index (rebuilt when the store changes) ---------------- */
  let ver = -1, ix = null;
  ST.idx = () => {
    if (ix && ver === ED.store.version) return ix;
    ix = { byDate: new Map(), byDone: new Map() };
    ST.sessions().forEach(s => {
      if (!ix.byDate.has(s.date)) ix.byDate.set(s.date, []);
      ix.byDate.get(s.date).push(s);
      if (s.done) { const k = ST.doneOn(s); if (!ix.byDone.has(k)) ix.byDone.set(k, []); ix.byDone.get(k).push(s); }
    });
    const ord = (a, b) => (a.slotNo || 9) - (b.slotNo || 9) || String(a.time || '').localeCompare(String(b.time || '')) || String(a.slot).localeCompare(String(b.slot));
    ix.byDate.forEach(l => l.sort(ord));
    ver = ED.store.version;
    return ix;
  };
  ST.on = k => (ST.idx().byDate.get(k) || []).slice();
  /* sessions planned from day a to day b, in day and slot order */
  ST.inRange = (a, b) => { const out = []; for (let k = a, g = 0; k <= b && g < 800; k = U.addDays(k, 1), g++) out.push.apply(out, ST.idx().byDate.get(k) || []); return out; };
  /* a plan week = the sessions dated in its seven days — exactly what the Week & Day page lists for it (the stored
     week number can be out of step with the date, e.g. after an import with irregular weeks) */
  ST.inWeek = n => { const w = ST.weekByN(n); return w ? ST.inRange(w.start, U.addDays(w.start, 6)) : []; };

  /* ---------------- slots ---------------- */
  ST.slots = () => { const p = ST.plan(); return p && p.slots ? p.slots.slice().sort((a, b) => a.no - b.no) : []; };
  ST.slot = no => ST.slots().find(x => x.no === (no || 1)) || null;
  ST.slotText = (no, kind) => { const sl = ST.slot(no); return no + ' - ' + (sl ? sl.name : 'Slot ' + no) + (kind ? ' (' + kind + ')' : ''); };
  /* planned start time of a session: its own time, else its slot's default time */
  ST.timeOf = s => { if (s.time) return s.time; const sl = ST.slot(s.slotNo || 1); return (sl && sl.time) || null; };
  /* sessions with a time on day k (they appear on the Daily timeline and can go to Google Calendar) */
  ST.timedOn = k => ST.on(k).map(s => {
    const time = ST.timeOf(s); if (!time) return null;
    const tr = ST.track(s.trackId);
    return { s, time, color: ST.color(tr), track: tr ? tr.name : 'Study', short: ST.short(tr) + (s.kind ? ' · ' + s.kind : '') };
  }).filter(Boolean);

  /* ---------------- books, lectures, topics ---------------- */
  /* besides books and lectures: papers and patents you are writing or reading, news, Employment News, and categories of your own */
  const SRC_CATS = [
    { id: 'paper-w', name: 'Papers (writing)', one: 'paper you are writing', icon: '📝', mode: 'write',
      status: ['Idea', 'Drafting', 'With co-authors', 'Submitted', 'Under review', 'Revision', 'Accepted', 'Published', 'Rejected'],
      f: { title: 'Paper title', by: 'Authors', venue: 'Target journal or conference', due: 'Target date', where: 'Draft link (Overleaf, Drive…)' } },
    { id: 'paper-r', name: 'Papers (reading)', one: 'paper to read', icon: '📄', mode: 'read',
      status: ['To read', 'Reading', 'Read', 'Summarised'],
      f: { title: 'Paper title', by: 'Authors', venue: 'Journal or conference, year', due: 'Read by', where: 'Link or DOI' } },
    { id: 'patent-w', name: 'Patents (writing)', one: 'patent you are writing', icon: '💡', mode: 'write',
      status: ['Idea', 'Prior-art search', 'Drafting', 'Filed (provisional)', 'Filed (complete)', 'Published', 'Under examination', 'Granted', 'Refused'],
      f: { title: 'Invention title', by: 'Inventors', venue: 'Patent office / application no.', due: 'Next deadline', where: 'Draft or filing link' } },
    { id: 'patent-r', name: 'Patents (reading)', one: 'patent to read', icon: '📜', mode: 'read',
      status: ['To read', 'Reading', 'Read', 'Summarised'],
      f: { title: 'Patent title', by: 'Inventors / assignee', venue: 'Patent number', due: 'Read by', where: 'Link' } },
    { id: 'news', name: 'News', one: 'news item', icon: '📰', mode: 'read',
      status: ['To read', 'Read', 'Saved'],
      f: { title: 'Headline', by: 'Newspaper / source', venue: 'Section or topic', due: 'Date', where: 'Link' } },
    { id: 'empnews', name: 'Employment News', one: 'Employment News notice', icon: '🗞️', mode: 'read',
      status: ['To check', 'Interested', 'Applied', 'Not for me'],
      f: { title: 'Post / notification', by: 'Organisation', venue: 'Issue (e.g. 26 Sep – 2 Oct 2026)', due: 'Last date to apply', where: 'Link' } },
  ];
  const GENERIC = {
    read: { status: ['To read', 'Reading', 'Done'], f: { title: 'Title', by: 'By / source', venue: 'Where published', due: 'Date', where: 'Link' } },
    write: { status: ['Idea', 'Drafting', 'Submitted', 'Under review', 'Accepted', 'Published', 'Rejected'], f: { title: 'Title', by: 'Authors', venue: 'Target (journal, office…)', due: 'Target date', where: 'Draft link' } },
  };
  const FINISHED = /^(read|summarised|done|saved|accepted|published|granted|applied|not for me|rejected|refused)$/i;
  ST.SRC_CATS = SRC_CATS;
  ST.srcCats = () => SRC_CATS.concat(((ST.plan() || {}).srcCats || []).map(c => Object.assign({ one: c.name, own: true }, GENERIC[c.mode === 'write' ? 'write' : 'read'], c)));
  ST.srcCat = id => ST.srcCats().find(c => c.id === id) || null;
  ST.srcIcon = x => !x ? '' : x.kind === 'lecture' ? '🎓' : x.kind === 'book' ? '📖' : ((ST.srcCat(x.kind) || {}).icon || '📌');
  ST.srcKindName = x => x.kind === 'lecture' ? 'Lecture' : x.kind === 'book' ? 'Book' : ((ST.srcCat(x.kind) || {}).name || 'Reading');
  ST.srcFinished = x => FINISHED.test(x.status || '');
  ST.sources = () => { const p = ST.plan(); return p ? (p.books || []).concat(p.lectures || [], p.items || []) : []; };
  ST.source = id => id ? ST.sources().find(x => x.id === id) || null : null;
  ST.sourceText = s => { const b = ST.source(s.sourceId); return [b ? b.title : '', s.source || ''].filter(Boolean).join(' — '); };
  /* topics offered for a subject: each week's topic in order, then your own list, then any others used */
  ST.topicsFor = trackId => {
    const p = ST.plan(); if (!p) return [];
    const out = [], seen = new Set();
    const add = t => { t = String(t || '').trim(); if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); } };
    ST.weeks().forEach(w => add(w.themes && w.themes[trackId]));
    (p.topics || []).filter(x => x.trackId === trackId).forEach(x => add(x.name));
    ST.sessions().forEach(s => { if (s.trackId === trackId) add(s.topic); });
    return out;
  };

  /* ---------------- weeks ---------------- */
  ST.weeks = () => { const p = ST.plan(); return p && p.weeks ? p.weeks : []; };
  ST.weekOf = k => { for (const w of ST.weeks()) if (k >= w.start && k <= U.addDays(w.start, 6)) return w; return null; };
  ST.weekByN = n => ST.weeks().find(w => w.n === n) || null;
  /* the week shown for day k (Week & Day page, the yearly "This week"): its plan week, else Monday to Sunday */
  ST.weekAt = k => { const w = ST.weekOf(k); const a = w ? w.start : U.startOfWeek(k, 1); return { w, a, b: U.addDays(a, 6) }; };

  /* ---------------- what was actually studied ---------------- */
  /* the day a done session was studied: saved when you tick it; older ticks (no doneOn): the planned day if ticked
     ahead of it, on it or the day after, else the day it was ticked (catching up) — the same rule as markDone */
  ST.doneOn = s => {
    if (!s.done) return null;
    if (s.doneOn) return s.doneOn < s.date ? s.date : s.doneOn;      // ticked ahead of its day: counted on the planned day
    if (!s.doneAt) return s.date;
    const k = U.key(new Date(s.doneAt));
    return k <= s.date || U.diffDays(s.date, k) <= 1 ? s.date : k;
  };
  /* minutes actually studied (empty = as planned) */
  ST.spent = s => s.done ? (s.spent != null && s.spent !== '' ? +s.spent : (s.min || 0)) : 0;

  /* ---------------- statistics ---------------- */
  const sum = (list, f) => list.reduce((a, x) => a + (f(x) || 0), 0);
  /* n / min = planned sessions and minutes; done / covMin = sessions ticked and the planned minutes they cover;
     doneMin = minutes actually studied */
  ST.stats = list => {
    list = list || ST.sessions();
    const done = list.filter(s => s.done);
    return { n: list.length, done: done.length, min: sum(list, s => s.min), covMin: sum(done, s => s.min), doneMin: sum(done, ST.spent) };
  };
  ST.dayStats = k => ST.stats(ST.on(k));
  ST.studied = k => sum(ST.idx().byDone.get(k) || [], ST.spent);                    // minutes studied on day k
  ST.studiedList = k => (ST.idx().byDone.get(k) || []).slice();
  ST.planned = k => sum(ST.on(k), s => s.min);                                        // minutes planned for day k
  /* sessions studied from day a to day b (by the day studied) */
  ST.studiedIn = (a, b) => { const out = []; ST.idx().byDone.forEach((l, k) => { if (k >= a && k <= b) out.push.apply(out, l); }); return out; };
  ST.studiedBetween = (a, b) => sum(ST.studiedIn(a, b), ST.spent);
  ST.plannedBetween = (a, b) => sum(ST.sessions().filter(s => s.date >= a && s.date <= b), s => s.min);
  /* planned minutes that should be covered by the end of day k if you kept to the plan */
  ST.dueBy = k => ST.stats(ST.sessions().filter(s => s.date <= k));
  /* by subject: planned and ticked from `list`; with `studied` (the sessions studied in a period) the minutes studied
     are counted by the day you studied, like every other "studied" figure of that period */
  ST.trackStats = (list, studied) => {
    list = list || ST.sessions();
    const p = ST.plan(); if (!p) return [];
    return p.tracks.map(tr => {
      const x = Object.assign({ tr }, ST.stats(list.filter(s => s.trackId === tr.id)));
      if (studied) x.doneMin = sum(studied.filter(s => s.trackId === tr.id), ST.spent);
      return x;
    }).filter(x => x.n || x.doneMin);
  };
  ST.weekStats = () => ST.weeks().map(w => Object.assign({ w, studied: ST.studiedBetween(w.start, U.addDays(w.start, 6)) }, ST.stats(ST.inWeek(w.n))));
  ST.firstStudy = () => { let f = null; ST.idx().byDone.forEach((l, k) => { if (!f || k < f) f = k; }); return f; };
  ST.lastStudy = () => { let f = null; ST.idx().byDone.forEach((l, k) => { if (!f || k > f) f = k; }); return f; };
  /* consecutive days with some study; days with nothing planned don't break the run */
  ST.streak = () => {
    let k = U.today(), n = 0, guard = 0;
    if (!ST.studied(k)) k = U.addDays(k, -1);
    const first = ST.firstStudy(); if (!first) return 0;
    while (guard++ < 1200 && k >= first) {
      if (ST.studied(k)) n++;
      else if (ST.on(k).length) break;
      k = U.addDays(k, -1);
    }
    return n;
  };
  ST.span = () => {
    const p = ST.plan(); if (!p) return null;
    const list = ST.sessions();
    const a = p.start || (list.length ? list.reduce((m, s) => s.date < m ? s.date : m, list[0].date) : null);
    const b = p.end || (list.length ? list.reduce((m, s) => s.date > m ? s.date : m, list[0].date) : null);
    return a && b ? { a, b } : null;
  };
  /* where you stand against the plan: planned hours covered vs planned hours due before today */
  ST.pace = () => {
    const today = U.today();
    const due = ST.dueBy(U.addDays(today, -1)).min;
    const cov = ST.stats().covMin;
    return { due, cov, diff: cov - due };
  };
  /* the day the study pages open on: the chosen day, else today inside the plan, else its first day */
  ST.focusDay = () => {
    const st = ED.state.study || (ED.state.study = {});
    if (st.day) return st.day;
    const sp = ST.span(); const t = U.today();
    if (!sp) return t;
    return t < sp.a ? sp.a : t > sp.b ? sp.b : t;
  };

  /* ---------------- changes ---------------- */
  const markDone = (s, on) => {
    s.done = on; s.updatedAt = Date.now();
    if (on) { const t = U.today(); s.doneAt = Date.now(); s.doneOn = t <= s.date || U.diffDays(s.date, t) <= 1 ? s.date : t; }
    else { s.doneAt = null; s.doneOn = null; s.spent = null; }
  };
  ST.markDone = markDone;
  ST.toggle = id => {
    const s = ST.session(id); if (!s) return;
    markDone(s, !s.done);
    ED.store.commit();
    if (s.done) {
      const d = ST.dayStats(s.date);
      if (d.n && d.done === d.n) ED.ui.toast('All study for ' + U.fmtDM(s.date) + ' done — ' + fmtH(d.doneMin) + '.', { icon: 'check' });
      else if (s.doneOn !== s.date) ED.ui.toast('Counted as studied ' + (s.doneOn === U.today() ? 'today' : 'on ' + U.fmtDM(s.doneOn)) + ' · ' + ST.fmtMin(ST.spent(s)) + '. Change it in the session if needed.', { action: 'Edit', onAction: () => ST.editSession(s.id) });
    }
  };
  ST.setSpent = (id, minutes) => {
    const s = ST.session(id); if (!s) return;
    const v = Math.max(0, Math.min(900, Math.round(+minutes || 0)));
    if (!s.done && !v) return;
    if (!s.done) markDone(s, true);
    s.spent = v === s.min ? null : v; s.updatedAt = Date.now();
    if (v === 0 && s.done) { s.spent = 0; }
    ED.store.commit();
  };
  ST.patchSession = (id, patch, msg) => {
    const s = ST.session(id); if (!s) return;
    ED.store.checkpoint('Study session');
    Object.assign(s, patch, { updatedAt: Date.now() });
    if (patch.date) { const w = ST.weekOf(patch.date); s.week = w ? w.n : 0; ST.extendWeeks(); }
    ED.store.commit();
    if (msg) ED.ui.undoToast(msg);
  };

  const fmtH = m => { const h = m / 60; return (Math.round(h * 10) / 10) + ' h'; };
  ST.fmtH = fmtH;
  ST.fmtMin = m => { m = Math.round(m || 0); return m < 60 ? m + ' min' : (m % 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : (m / 60) + ' h'); };

  /* ======================= import ======================= */
  const norm = v => String(v == null ? '' : v).trim();
  const low = v => norm(v).toLowerCase();
  const slug = s => low(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'track';
  const findCol = (head, names) => { for (const n of names) { const i = head.findIndex(h => low(h) === n); if (i >= 0) return i; } for (const n of names) { const i = head.findIndex(h => low(h).indexOf(n) === 0); if (i >= 0) return i; } return -1; };

  /* short labels such as "RF & VLSI" (from the Books sheet) matched to full track names */
  const words = s => low(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && ['and', 'the', 'of', 'block', 'systems', 'technologies'].indexOf(w) < 0);
  const matchScore = (label, name) => {
    const nw = words(name), lw = words(label);
    const initials = [];
    for (let i = 0; i < nw.length - 1; i++) initials.push(nw[i][0] + nw[i + 1][0]);
    return lw.reduce((a, w) => a + (nw.indexOf(w) >= 0 ? 2 : initials.indexOf(w) >= 0 ? 1 : nw.some(x => x.indexOf(w) === 0 && w.length >= 4) ? 1 : 0), 0);
  };
  const autoShort = name => {
    if (name.length <= 16) return name;
    const parts = name.split(/,| & | and /i).map(x => x.trim()).filter(Boolean);
    return parts[0].length <= 18 ? parts[0] : parts[0].slice(0, 16) + '…';
  };

  ST.fromSheets = (sheets, fileName) => {
    const bySheet = n => sheets.find(s => low(s.name) === n);
    const headerRow = rows => { for (let i = 0; i < Math.min(rows.length, 12); i++) { const r = rows[i] || []; if (r.filter(c => c != null && c !== '').length >= 3) return i; } return 0; };

    // 1) the sessions sheet: has Date and Track/Subject columns
    let daily = null, dh = 0, dcols = null;
    for (const sh of [bySheet('daily plan')].concat(sheets).filter(Boolean)) {
      const hi = headerRow(sh.rows); const head = (sh.rows[hi] || []).map(norm);
      const c = {
        date: findCol(head, ['date', 'day date', 'on']), track: findCol(head, ['track', 'subject', 'course', 'topic area']),
        min: findCol(head, ['min', 'mins', 'minutes', 'duration (min)', 'duration']), hours: findCol(head, ['hours', 'hrs', 'hour']),
        week: findCol(head, ['week', 'wk']), weekOf: findCol(head, ['week of']), slot: findCol(head, ['slot', 'session', 'period']),
        topic: findCol(head, ['topic', 'chapter', 'what']), source: findCol(head, ['source / task', 'source', 'task', 'resource', 'book / lecture']),
        done: findCol(head, ['done', 'completed', 'status', 'y/n']), time: findCol(head, ['time', 'start', 'start time']), note: findCol(head, ['note', 'notes', 'remarks']),
        doneOn: findCol(head, ['studied on', 'done on', 'completed on']), spent: findCol(head, ['time spent (min)', 'time spent', 'spent', 'actual min', 'actual (min)']),
      };
      if (c.weekOf >= 0 && c.week === c.weekOf) c.week = findCol(head.map((h, i) => i === c.weekOf ? '' : h), ['week', 'wk']);
      if (c.done >= 0 && c.done === c.doneOn) c.done = findCol(head.map((h, i) => i === c.doneOn ? '' : h), ['done', 'completed', 'status', 'y/n']);
      if (c.time >= 0 && c.time === c.spent) c.time = findCol(head.map((h, i) => i === c.spent ? '' : h), ['time', 'start', 'start time']);
      if (c.date >= 0 && (c.track >= 0 || c.topic >= 0)) { daily = sh; dh = hi; dcols = c; break; }
    }
    if (!daily) throw new Error('No sheet with a Date column and a Track or Subject column was found. The first row of the sheet should hold the column names (Date, Track, Min, Topic, Done…).');

    // 2) optional sheets
    const matrix = sheets.find(s => /track matrix/i.test(s.name)) || null;
    const overview = sheets.find(s => /weekly overview|week overview|weeks/i.test(s.name)) || null;
    const readme = sheets.find(s => /read ?me|about|overview$/i.test(s.name) && s !== overview) || null;
    const books = sheets.find(s => /^books?$|reading list/i.test(s.name)) || null;
    const lectures = sheets.find(s => /lectures?|courses?|videos?/i.test(s.name)) || null;

    // tracks: order from the Track Matrix header, else order of appearance
    const tracks = [];
    const addTrack = (name, day) => {
      name = norm(name).replace(/\s+/g, ' ');
      if (!name) return null;
      let tr = tracks.find(t => low(t.name) === low(name));
      if (!tr) { tr = { id: 'tr-' + slug(name), name, short: '', day: null, slot: '', idx: tracks.length }; tracks.push(tr); }
      if (day !== undefined && day !== null) tr.day = day;
      return tr;
    };
    if (matrix) {
      const hi = headerRow(matrix.rows);
      (matrix.rows[hi] || []).forEach(h => {
        const s = norm(h); if (!s || /^week/i.test(s)) return;
        const m = /^(.*?)\s*[[(]\s*([A-Za-z ]+?)\s*[\])]\s*$/.exec(s);
        const name = m ? m[1] : s;
        const d = m ? (/every/i.test(m[2]) ? -1 : DAYABBR[low(m[2]).slice(0, 3)]) : undefined;
        addTrack(name, d === undefined ? null : d);
      });
    }
    // weekly pattern on the Read Me sheet: Day | Second subject | Slot length
    const notes = [], howto = [];
    let title = '', subtitle = '', intro = '';
    if (readme) {
      const R = readme.rows;
      title = norm((R[0] || [])[0]); subtitle = norm((R[1] || [])[0]); intro = norm((R[2] || [])[0]);
      let mode = '';
      R.forEach(r => {
        r = r || [];
        const a = norm(r[0]), b = norm(r[1]), c = norm(r[2]);
        if (!a && !b) { if (mode === 'before') mode = ''; return; }
        if (/^before you start/i.test(a)) { mode = 'before'; return; }
        if (/^how to use/i.test(a)) { mode = 'howto'; return; }
        if (/^weekly pattern/i.test(a)) { mode = 'pattern'; return; }
        if (/^progress$/i.test(a)) { mode = ''; return; }
        if (mode === 'before' && a && b) notes.push({ h: a.replace(/^\d+\s*[-–.]\s*/, ''), text: b });
        else if (mode === 'howto' && a && !/yellow cells|fill in/i.test(a)) howto.push(a);
        else if (mode === 'pattern' && a && b && !/^day$/i.test(a)) {
          const d = DAYNAMES.indexOf(low(a));
          const tr = addTrack(b, d >= 0 ? d : /every/i.test(a) ? -1 : undefined);
          if (tr && c) tr.slot = c;
        } else if (mode === 'pattern' && a && !b) notes.push({ h: 'Weekly pattern', text: a });
      });
    }

    // sessions
    const c = dcols;
    const sessions = [];
    const rows = daily.rows.slice(dh + 1);
    rows.forEach(r => {
      r = r || [];
      const date = X.anyDate(r[c.date]);
      if (!date) return;
      const trackName = c.track >= 0 ? norm(r[c.track]) : 'Study';
      const tr = addTrack(trackName || 'Study');
      let min = c.min >= 0 ? Number(r[c.min]) : NaN;
      if (!(min > 0) && c.hours >= 0) min = Number(r[c.hours]) * 60;
      if (!(min > 0)) min = 60;
      const slot = c.slot >= 0 ? norm(r[c.slot]) : '';
      const sm = /^(\d+)/.exec(slot);
      const km = /\(([^)]+)\)/.exec(slot);
      const doneV = c.done >= 0 ? low(r[c.done]) : '';
      const tv = c.time >= 0 ? r[c.time] : null;
      let time = null;
      if (typeof tv === 'number' && tv < 1) time = U.fromMin(Math.round(tv * 1440));
      else if (tv) {
        const tm = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap])?\.?\s*m?\.?$/i.exec(norm(tv));
        if (tm && +tm[1] < 24 && +tm[2] < 60) { let hh = +tm[1]; const ap = (tm[3] || '').toLowerCase(); if (ap === 'p' && hh < 12) hh += 12; if (ap === 'a' && hh === 12) hh = 0; time = U.pad(hh) + ':' + tm[2]; }
      }
      const done = ['y', 'yes', 'done', '1', 'true', '✓', 'x', 'completed'].indexOf(doneV) >= 0;
      const on = c.doneOn >= 0 ? X.anyDate(r[c.doneOn]) : null;
      const sp = c.spent >= 0 && r[c.spent] !== '' && r[c.spent] != null ? Number(r[c.spent]) : NaN;
      sessions.push({
        id: U.uid('ss'), week: c.week >= 0 ? (parseInt(r[c.week], 10) || 0) : 0, date,
        slot, slotNo: sm ? +sm[1] : 0, kind: km ? km[1] : '',
        trackId: tr.id, min: Math.round(min), topic: c.topic >= 0 ? norm(r[c.topic]) : '', sourceId: '', source: c.source >= 0 ? norm(r[c.source]) : '',
        done, doneAt: null, doneOn: done ? (on || date) : null, spent: done && sp >= 0 && Math.round(sp) !== Math.round(min) ? Math.round(sp) : null,
        time, note: c.note >= 0 ? norm(r[c.note]) : '', updatedAt: Date.now(),
      });
    });
    if (!sessions.length) throw new Error('The sheet “' + daily.name + '” has no rows with a date.');
    sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.slotNo || 9) - (b.slotNo || 9));
    sessions.forEach(s => { if (s.done) s.doneAt = U.parse(s.doneOn || s.date).getTime() + 20 * 3600e3; });
    // slot numbers when the sheet had none: order within the day
    const perDay = new Map();
    sessions.forEach(s => { if (!s.slotNo) { const n = (perDay.get(s.date) || 0) + 1; perDay.set(s.date, n); s.slotNo = n; if (!s.slot) s.slot = 'Session ' + n; } });

    // weeks
    const start = sessions[0].date, end = sessions[sessions.length - 1].date;
    const weeks = [];
    const hasWeekNums = sessions.every(s => s.week > 0);
    if (hasWeekNums) {
      // weeks are seven-day steps from the first week, so a rest day at the start of a week does not shift it
      const ws = new Map();
      sessions.forEach(s => { const w = ws.get(s.week); if (!w || s.date < w) ws.set(s.week, s.date); });
      const nums = Array.from(ws.keys()).sort((a, b) => a - b);
      const n0 = nums[0];
      const base = U.addDays(ws.get(n0), -7 * (n0 - 1));
      const steady = nums.every(n => { const st = U.addDays(base, 7 * (n - 1)); return sessions.every(x => x.week !== n || (x.date >= st && x.date <= U.addDays(st, 6))); });
      nums.forEach(n => weeks.push({ n, start: steady ? U.addDays(base, 7 * (n - 1)) : ws.get(n), label: '', phase: '', note: '', themes: {} }));
    } else {
      let k = start, n = 1;
      while (k <= end) { weeks.push({ n, start: k, label: '', phase: '', note: '', themes: {} }); k = U.addDays(k, 7); n++; }
      sessions.forEach(s => { s.week = Math.floor(U.diffDays(start, s.date) / 7) + 1; });
    }
    const wByN = new Map(weeks.map(w => [w.n, w]));
    // week-of labels, phases and notes from the sessions sheet and the Weekly Overview sheet
    if (c.weekOf >= 0) rows.forEach(r => { const n = parseInt((r || [])[c.week], 10); const w = wByN.get(n); if (w && !w.label && r[c.weekOf]) w.label = norm(r[c.weekOf]); });
    if (overview) {
      const hi = headerRow(overview.rows); const head = (overview.rows[hi] || []).map(norm);
      const cw = findCol(head, ['week']), cp = findCol(head, ['phase']), cn = findCol(head, ['note', 'notes']), cl = findCol(head, ['week of']);
      overview.rows.slice(hi + 1).forEach(r => {
        const w = wByN.get(parseInt((r || [])[cw], 10)); if (!w) return;
        if (cp >= 0 && r[cp]) w.phase = norm(r[cp]);
        if (cn >= 0 && r[cn]) w.note = norm(r[cn]);
        if (cl >= 0 && r[cl] && !w.label) w.label = norm(r[cl]);
      });
    }
    // topic per track per week: Track Matrix, else the most common topic in the sessions
    if (matrix) {
      const hi = headerRow(matrix.rows); const head = (matrix.rows[hi] || []).map(norm);
      const cw = findCol(head, ['week']);
      const colTrack = head.map(h => { const m = /^(.*?)\s*[[(].*$/.exec(h); const name = low(m ? m[1] : h); const tr = tracks.find(t => low(t.name) === name); return tr ? tr.id : null; });
      matrix.rows.slice(hi + 1).forEach(r => {
        const w = wByN.get(parseInt((r || [])[cw], 10)); if (!w) return;
        colTrack.forEach((id, i) => { if (id && r[i]) w.themes[id] = norm(r[i]); });
      });
    }
    weeks.forEach(w => {
      tracks.forEach(tr => {
        if (w.themes[tr.id]) return;
        const cnt = {};
        sessions.forEach(s => { if (s.week === w.n && s.trackId === tr.id && s.topic) cnt[s.topic] = (cnt[s.topic] || 0) + 1; });
        const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
        if (best) w.themes[tr.id] = best;
      });
      if (!w.label) w.label = U.fmtDM(w.start) + ' – ' + U.fmtDM(U.addDays(w.start, 6)) + ' ' + U.addDays(w.start, 6).slice(0, 4);
    });
    // track days from the sessions when the workbook did not say
    tracks.forEach(tr => {
      if (tr.day != null) return;
      const days = [0, 0, 0, 0, 0, 0, 0]; let n = 0;
      sessions.forEach(s => { if (s.trackId === tr.id) { days[U.dow(s.date)]++; n++; } });
      const top = days.indexOf(Math.max(...days));
      tr.day = n && days[top] / n > 0.8 ? top : n && days.filter(x => x).length >= 5 ? -1 : null;
    });

    // books and lectures
    const readList = (sh, kind) => {
      if (!sh) return [];
      const hi = headerRow(sh.rows); const head = (sh.rows[hi] || []).map(norm);
      const ct = findCol(head, ['track', 'subject']), cti = findCol(head, ['title', 'course', 'name', 'book']), cu = findCol(head, ['use in this plan', 'used for', 'use', 'purpose']),
        ca = findCol(head, ['access', 'type']), cwh = findCol(head, ['where', 'link', 'url']);
      return sh.rows.slice(hi + 1).filter(r => r && r[cti]).map(r => ({ id: U.uid(kind === 'book' ? 'bk' : 'lc'), kind, track: norm(r[ct]), title: norm(r[cti]), use: cu >= 0 ? norm(r[cu]) : '', access: ca >= 0 && ca !== cwh ? norm(r[ca]) : '', where: cwh >= 0 ? norm(r[cwh]) : '' }));
    };
    const bookList = readList(books, 'book'), lectureList = readList(lectures, 'lecture');
    // short track names from the source lists ("RF & VLSI", "Cyber"…)
    const labels = Array.from(new Set(bookList.concat(lectureList).map(x => x.track).filter(Boolean)));
    labels.forEach(lb => {
      let best = null, bs = 0;
      tracks.forEach(tr => { const sc = matchScore(lb, tr.name); if (sc > bs) { bs = sc; best = tr; } });
      if (best && !best.short && lb.length < best.name.length) best.short = lb;
    });
    tracks.forEach(tr => { if (!tr.short) tr.short = autoShort(tr.name); });
    bookList.concat(lectureList).forEach(x => { const tr = tracks.find(t => t.short === x.track); if (tr) x.trackId = tr.id; });
    // colours: fixed categorical order; a ninth track reuses the neutral ink
    tracks.forEach((tr, i) => { tr.idx = i; tr.color = i < 8 ? SERIES[i] : 'var(--ink-3)'; });

    const totalMin = sessions.reduce((a, s) => a + s.min, 0);
    const nWeeks = weeks.length;
    const plan = {
      id: U.uid('sp'), title: title || norm(fileName).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') || 'Study plan',
      subtitle: subtitle || (U.fmtShort(start) + ' to ' + U.fmtShort(end) + '  |  ' + nWeeks + ' weeks  |  ' + (Math.round(totalMin / 60 / Math.max(1, nWeeks) * 10) / 10) + ' hours per week  |  ' + Math.round(totalMin / 60) + ' hours'),
      intro, start, end, hoursPerWeek: Math.round(totalMin / 60 / Math.max(1, nWeeks) * 10) / 10,
      tracks, weeks, notes, howto, books: bookList, lectures: lectureList, topics: [],
      source: fileName || '', importedAt: Date.now(), updatedAt: Date.now(),
    };
    const out = { plan, sessions };
    ST.normalize(out);
    return out;
  };

  /* keep the ticks you already made when a newer copy of the same plan is imported */
  const sessKey = (s, tracks) => { const tr = tracks.find(t => t.id === s.trackId); return s.date + '|' + (s.slotNo || 0) + '|' + low(tr ? tr.name : s.trackId); };

  ST.importFile = async () => {
    const file = await U.pickFile('.xlsx,.xlsm,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv');
    if (!file) return;
    let res;
    try { res = ST.fromSheets(await X.readFile(file), file.name); }
    catch (err) { console.error(err); ED.ui.toast('Could not read “' + file.name + '”: ' + (err.message || err), { kind: 'err', timeout: 9000 }); return; }
    const st = ST.stats(res.sessions);
    const old = ST.plan();
    let msg = 'Found ' + U.plural(st.n, 'session') + ' from ' + U.fmtShort(res.plan.start) + ' to ' + U.fmtShort(res.plan.end) + ' in ' + U.plural(res.plan.tracks.length, 'subject') +
      ' (' + fmtH(st.min) + ' planned' + (st.done ? ', ' + st.done + ' already marked done' : '') + ').';
    let choices = [{ id: 'new', label: 'Import plan' }];
    if (old) {
      msg += old.sample ? ' You already have “' + old.title + '”. Replace it?'
        : ' You already have “' + old.title + '”. Add this as another plan (you can switch between them from the Plan menu), or replace it? When you replace it, sessions you ticked stay ticked when the date, slot and subject match; your slot times, books and topics are kept.';
      choices = old.sample ? [{ id: 'new', label: 'Replace plan', primary: true }] : [{ id: 'new', label: 'Replace “' + old.title + '”' }, { id: 'add', label: 'Add as another plan', primary: true }];
    }
    const ok = await ED.ui.confirm({ title: 'Import study plan', message: msg, choices });
    if (!ok) return;
    ED.store.checkpoint('Import study plan');
    let msg2 = '';
    const keepBoth = ok === 'add';
    if (keepBoth) { ST.stash(); msg2 = ' “' + old.title + '” is kept in your plans.'; }
    if (old && !old.sample && !keepBoth) {
      const oldTracks = old.tracks;
      const ticked = new Map(ST.sessions().filter(s => s.done || s.note || s.time).map(s => [sessKey(s, oldTracks), s]));
      res.sessions.forEach(s => {
        const o = ticked.get(sessKey(s, res.plan.tracks)); if (!o) return;
        if (o.done && !s.done) { s.done = true; s.doneAt = o.doneAt; s.doneOn = ST.doneOn(o); s.spent = o.spent; }
        if (o.note && !s.note) s.note = o.note;
        if (o.time && !s.time) s.time = o.time;
      });
      // keep your slot times, your own books/lectures and topics
      (old.slots || []).forEach(sl => { const n = res.plan.slots.find(x => x.no === sl.no); if (n && sl.time) n.time = sl.time; });
      const titles = new Set(res.plan.books.concat(res.plan.lectures).map(x => low(x.title)));
      (old.books || []).forEach(b => { if (!titles.has(low(b.title))) res.plan.books.push(b); });
      (old.lectures || []).forEach(b => { if (!titles.has(low(b.title))) res.plan.lectures.push(b); });
      res.plan.items = (old.items || []).slice(); res.plan.srcCats = (old.srcCats || []).slice();   // papers, patents, news… are yours alone
      res.plan.topics = (old.topics || []).filter(t => res.plan.tracks.some(tr => tr.id === t.trackId));
      // sessions you added in the diary (and the slots and subjects they use) are not in the workbook: keep them
      const inFile = new Set(res.sessions.map(x => sessKey(x, res.plan.tracks)));
      const mine = ST.sessions().filter(x => x.own && !inFile.has(sessKey(x, oldTracks)));
      mine.forEach(x => {
        const ot = oldTracks.find(t => t.id === x.trackId);
        let nt = ot && res.plan.tracks.find(t => low(t.name) === low(ot.name));
        if (!nt && ot) { nt = Object.assign({}, ot, { idx: res.plan.tracks.length, color: res.plan.tracks.length < 8 ? SERIES[res.plan.tracks.length] : 'var(--ink-3)' }); res.plan.tracks.push(nt); }
        if (!res.plan.slots.some(sl => sl.no === (x.slotNo || 1))) { const osl = (old.slots || []).find(sl => sl.no === x.slotNo); if (osl) res.plan.slots.push(Object.assign({}, osl)); }
        res.sessions.push(Object.assign({}, x, { trackId: nt ? nt.id : x.trackId, week: 0 }));   // week number from the new plan's weeks (extendWeeks)
      });
      if (mine.length) { res.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.slotNo || 9) - (b.slotNo || 9)); msg2 = ' ' + U.plural(mine.length, 'session') + ' you added here were kept.'; }
    } else if (old && old.sample) {
      // replacing the example plan: the papers, patents, news… and categories you added to it are still yours
      res.plan.items = (old.items || []).filter(i => !i.sample).map(i => Object.assign({}, i, { trackId: '' }));
      res.plan.srcCats = (old.srcCats || []).slice();
    }
    D().study = { plan: res.plan, sessions: res.sessions, shelf: ST.shelf() };
    ED.state.study = {};
    ST.extendWeeks();
    ED.store.commit();
    ED.ui.undoToast('Study plan imported: ' + res.plan.title + '.' + msg2);
    if (['studyYear', 'studyMonth', 'studyWeek'].indexOf(ED.state.tab) < 0) ED.go.tab('studyYear');
  };

  /* the Daily Plan sheet again, with your ticks — opens in Excel */
  ST.exportCSV = async () => {
    const p = ST.plan(); if (!p) return;
    const rows = [['Week', 'Week of', 'Date', 'Day', 'Slot', 'Track', 'Min', 'Topic', 'Source / task', 'Done', 'Studied on', 'Time spent (min)', 'Start time', 'Note']];
    ST.sessions().slice().sort((a, b) => a.date.localeCompare(b.date) || (a.slotNo || 0) - (b.slotNo || 0)).forEach(s => {
      const w = ST.weekByN(s.week); const tr = ST.track(s.trackId);
      rows.push([s.week || '', w ? w.label : '', s.date, U.DAYS[U.dow(s.date)], s.slot || ST.slotText(s.slotNo, s.kind), tr ? tr.name : '', s.min, s.topic, ST.sourceText(s), s.done ? 'Y' : '', s.done ? ST.doneOn(s) : '', s.done ? ST.spent(s) : '', ST.timeOf(s) || '', s.note || '']);
    });
    await U.download(slug(p.title) + '-progress-' + U.today() + '.csv', X.toCSV(rows), 'text/csv');
  };

  /* ======================= a plan made here (no Excel) ======================= */
  ST.generate = o => {
    // o: {title, start, weeks, tracks:[names], slots:[{name, time}], pattern: {dow: [{track, min} per slot, or null]}}
    const tracks = o.tracks.map((name, i) => ({ id: 'tr-' + slug(name) + '-' + i, name, short: autoShort(name), day: null, slot: '', idx: i, color: i < 8 ? SERIES[i] : 'var(--ink-3)' }));
    const byName = n => tracks.find(t => t.name === n);
    const slots = (o.slots && o.slots.length ? o.slots : [{ name: 'Slot 1' }, { name: 'Slot 2' }]).map((x, i) => ({ no: i + 1, name: x.name || 'Slot ' + (i + 1), time: x.time || '', min: x.min || 60 }));
    const sessions = [], weeks = [];
    for (let w = 0; w < o.weeks; w++) {
      const ws = U.addDays(o.start, w * 7);
      weeks.push({ n: w + 1, start: ws, label: U.fmtDM(ws) + ' – ' + U.fmtDM(U.addDays(ws, 6)) + ' ' + U.addDays(ws, 6).slice(0, 4), phase: '', note: '', themes: {} });
      for (let d = 0; d < 7; d++) {
        const k = U.addDays(ws, d);
        (o.pattern[U.dow(k)] || []).forEach((p, i) => {
          if (!p) return;
          const tr = byName(p.track); if (!tr || !(p.min > 0)) return;
          sessions.push({ id: U.uid('ss'), week: w + 1, date: k, slot: (i + 1) + ' - ' + slots[i].name, slotNo: i + 1, kind: p.kind || '', trackId: tr.id, min: p.min, topic: '', sourceId: '', source: '', done: false, doneAt: null, doneOn: null, spent: null, time: null, note: '', updatedAt: Date.now() });
        });
      }
    }
    tracks.forEach(tr => {
      const days = new Set(sessions.filter(s => s.trackId === tr.id).map(s => U.dow(s.date)));
      tr.day = days.size === 1 ? Array.from(days)[0] : days.size >= 5 ? -1 : null;
    });
    const end = U.addDays(o.start, o.weeks * 7 - 1);
    const total = sessions.reduce((a, s) => a + s.min, 0);
    const out = {
      plan: { id: U.uid('sp'), title: o.title || 'Study plan', subtitle: U.fmtShort(o.start) + ' to ' + U.fmtShort(end) + '  |  ' + o.weeks + ' weeks  |  ' + Math.round(total / 60) + ' hours',
        intro: '', start: o.start, end, hoursPerWeek: Math.round(total / 60 / o.weeks * 10) / 10, tracks, weeks, notes: [], howto: [], books: [], lectures: [], topics: [],
        slots, source: '', importedAt: Date.now(), updatedAt: Date.now() },
      sessions,
    };
    ST.normalize(out);
    return out;
  };

  /* example plan for a brand-new diary (removed with "Clear examples") */
  ST.examplePlan = today => {
    const start = U.startOfWeek(U.addDays(today, -14), 1);
    const pat = {};
    for (let d = 0; d < 7; d++) pat[d] = [{ track: 'Python programming', min: d === 0 || d === 6 ? 60 : 45 }];
    [1, 3, 5].forEach(d => pat[d].push({ track: 'Statistics', min: 45 }));
    [2, 4].forEach(d => pat[d].push({ track: 'English writing', min: 30 }));
    pat[6].push({ track: 'Statistics', min: 60 }); pat[0].push({ track: 'English writing', min: 60 });
    const r = ST.generate({ title: 'Example study plan', start, weeks: 8, tracks: ['Python programming', 'Statistics', 'English writing'], slots: [{ name: 'Morning', time: '06:30', min: 45 }, { name: 'Evening', time: '', min: 45 }], pattern: pat });
    const topics = { 0: ['Variables and types', 'Descriptive statistics', 'Clear sentences'], 1: ['Lists and loops', 'Probability', 'Paragraphs'], 2: ['Functions', 'Distributions', 'Emails that get answers'], 3: ['Files and CSV', 'Sampling', 'Summaries'], 4: ['NumPy', 'Confidence intervals', 'Reports'], 5: ['pandas', 'Hypothesis tests', 'Abstracts'], 6: ['Plotting', 'Regression', 'Editing'], 7: ['Mini project', 'Revision', 'Final essay'] };
    r.plan.weeks.forEach((w, i) => { r.plan.tracks.forEach((tr, j) => { w.themes[tr.id] = topics[i][j]; }); w.phase = i < 3 ? '1 - Basics' : i < 6 ? '2 - Core' : '3 - Project'; });
    let n = 0;
    r.sessions.forEach(s => { const w = r.plan.weeks[s.week - 1]; s.topic = w.themes[s.trackId] || ''; if (s.date < today && (n++ % 5) !== 3) { s.done = true; s.doneOn = s.date; s.doneAt = U.parse(s.date).getTime() + 20 * 3600e3; if (n % 4 === 0) s.spent = Math.max(15, s.min - 15); } });
    const py = r.plan.tracks[0], stt = r.plan.tracks[1], en = r.plan.tracks[2];
    r.plan.books = [{ id: U.uid('bk'), kind: 'book', trackId: py.id, track: py.short, title: 'Think Python (2e)', use: 'Main Python text', access: 'Free online', where: 'greenteapress.com/wp/think-python-2e/' },
      { id: U.uid('bk'), kind: 'book', trackId: stt.id, track: stt.short, title: 'OpenIntro Statistics', use: 'Chapters follow the weekly topics', access: 'Free PDF', where: 'openintro.org/book/os/' }];
    r.plan.lectures = [{ id: U.uid('lc'), kind: 'lecture', trackId: en.id, track: en.short, title: 'Writing in the Sciences (Stanford)', use: 'One video per week', access: '', where: '' }];
    r.plan.notes = [{ h: 'This is an example', text: 'Import your own plan from Excel (Plan menu → Import), or make one here. Tick a session when you finish it and log the time you really spent; every total and graph updates.' }];
    r.plan.sample = true;
    return { plan: r.plan, sessions: r.sessions };
  };

  /* ======================= editors ======================= */
  const opt = (v, label, sel) => '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';
  const NEW = '__new__';
  const slotOpt = (sl, sel) => opt(sl.no, 'Slot ' + sl.no + ' · ' + sl.name + (sl.time ? ' · ' + U.fmtTime(sl.time, ED.store.data.settings.h12) : ''), sel);

  /* the dropdowns shared by the session editor and "Add to the schedule" */
  function topicSelect(id, trackId, cur, extra) {
    const list = ST.topicsFor(trackId);
    const has = cur && list.some(t => t.toLowerCase() === cur.toLowerCase());
    return '<select id="' + id + '" class="field">' + opt('', extra || '— no topic —', !cur) + (cur && !has ? opt(cur, cur, true) : '') +
      (list.length ? '<optgroup label="Topics for this subject">' + list.map(t => opt(t, t, cur && t.toLowerCase() === cur.toLowerCase())).join('') + '</optgroup>' : '') +
      opt(NEW, '＋ A new topic…', false) + '</select>';
  }
  function sourceSelect(id, trackId, cur) {
    const all = ST.sources();
    const mine = all.filter(x => x.trackId === trackId), rest = all.filter(x => x.trackId !== trackId);
    const grp = (label, l) => l.length ? '<optgroup label="' + e(label) + '">' + l.map(x => opt(x.id, ST.srcIcon(x) + ' ' + x.title, x.id === cur)).join('') + '</optgroup>' : '';
    const tr = ST.track(trackId);
    return '<select id="' + id + '" class="field">' + opt('', '— none —', !cur) +
      grp('Books for ' + ST.short(tr), mine.filter(x => x.kind === 'book')) + grp('Lectures for ' + ST.short(tr), mine.filter(x => x.kind === 'lecture')) +
      grp('Other books', rest.filter(x => x.kind === 'book')) + grp('Other lectures', rest.filter(x => x.kind === 'lecture')) +
      ST.srcCats().map(c => grp(c.name, all.filter(x => x.kind === c.id).sort((a, b) => (a.trackId === trackId ? 0 : 1) - (b.trackId === trackId ? 0 : 1)))).join('') +
      opt(NEW, '＋ Add a book or lecture…', false) + '</select>';
  }
  /* wire a topic select: "a new topic" shows a text box */
  function wireTopic(el, sel, box) {
    const upd = () => { const on = sel.value === NEW; box.hidden = !on; if (on) setTimeout(() => box.focus(), 0); };
    sel.addEventListener('change', upd); upd();
  }
  function readTopic(sel, box, trackId) {
    if (sel.value !== NEW) return sel.value;
    const v = box.value.trim(); if (!v) return '';
    const p = ST.plan();
    if (p && !ST.topicsFor(trackId).some(t => t.toLowerCase() === v.toLowerCase())) p.topics.push({ id: U.uid('tp'), trackId, name: v });
    return v;
  }
  function wireSource(el, sel, getTrack) {
    sel.addEventListener('change', () => {
      if (sel.value !== NEW) return;
      sel.value = '';
      ST.editSource(null, { trackId: getTrack(), kind: 'book', after: b => { sel.innerHTML = sourceSelect('x', getTrack(), b.id).replace(/^<select[^>]*>|<\/select>$/g, ''); sel.value = b.id; } });
    });
  }

  ST.editSession = (id, create) => {
    const p = ST.plan(); if (!p) return;
    const s = id ? ST.session(id) : null;
    const slots = ST.slots();
    const d = s ? U.clone(s) : Object.assign({ id: U.uid('ss'), date: ST.focusDay(), slot: '', slotNo: (slots[0] || { no: 1 }).no, kind: '', trackId: p.tracks[0] ? p.tracks[0].id : '', min: (slots[0] || {}).min || 60, topic: '', sourceId: '', source: '', done: false, doneAt: null, doneOn: null, spent: null, time: null, note: '' }, create || {});
    if (!s) { const w = ST.weekOf(d.date); const tr = ST.track(d.trackId); d.week = w ? w.n : 0; if (!d.topic && w && tr) d.topic = w.themes[tr.id] || ''; }
    const h12 = ED.store.data.settings.h12;
    const slotHas = slots.some(x => x.no === d.slotNo);
    const body = '<form class="st-form">' +
      '<div class="st-grid">' +
      '<label class="lbl" for="ss-date">Date</label><input id="ss-date" class="field" type="date" value="' + e(d.date) + '">' +
      '<label class="lbl" for="ss-track">Subject</label><select id="ss-track" class="field">' + (p.tracks.length ? '' : opt('', 'Study', true)) + p.tracks.map(t => opt(t.id, t.name, t.id === d.trackId)).join('') + '</select>' +
      '<label class="lbl" for="ss-slotno">Slot</label><div class="st-inline"><select id="ss-slotno" class="field">' + slots.map(x => slotOpt(x, x.no === d.slotNo)).join('') + (slotHas ? '' : opt(d.slotNo, 'Slot ' + d.slotNo, true)) + opt(NEW, '＋ A new slot…', false) + '</select>' +
      '<input id="ss-kind" class="field" list="ss-kinds" value="' + e(d.kind || '') + '" placeholder="Reading, Lecture, Code…" aria-label="Kind of work"><datalist id="ss-kinds">' + KINDS.map(k => '<option value="' + e(k) + '">').join('') + '</datalist></div>' +
      '<label class="lbl" for="ss-min">Planned minutes</label><input id="ss-min" class="field num" type="number" min="5" max="600" step="5" value="' + (d.min || 60) + '">' +
      '<label class="lbl" for="ss-time">Start time</label><div class="te-dt"><input id="ss-time" class="field" type="time" value="' + e(d.time || '') + '"><span class="hint" id="ss-tdef"></span></div>' +
      '<label class="lbl" for="ss-topic">Topic</label><div class="st-stack">' + topicSelect('ss-topic', d.trackId, d.topic) + '<input id="ss-topic-new" class="field" placeholder="Type the new topic — it is added to this subject’s list" hidden></div>' +
      '<label class="lbl" for="ss-src">Book / lecture</label>' + sourceSelect('ss-src', d.trackId, d.sourceId) +
      '<label class="lbl" for="ss-source">Chapter / task</label><textarea id="ss-source" class="field" rows="2" placeholder="Chapters, pages, lecture numbers, exercises…">' + e(d.source) + '</textarea>' +
      '<label class="lbl" for="ss-note">My notes</label><textarea id="ss-note" class="field" rows="2" placeholder="What you covered, questions, page reached…">' + e(d.note || '') + '</textarea>' +
      '</div>' +
      '<div class="st-donebox"><label class="switch st-done-sw"><input id="ss-done" type="checkbox"' + (d.done ? ' checked' : '') + '><span class="track"></span><span>Done</span></label>' +
      '<div class="st-done-f" id="ss-donef"><label class="lbl" for="ss-on">Studied on</label><input id="ss-on" class="field" type="date" value="' + e(d.done ? ST.doneOn(d) : (U.today() <= d.date || U.diffDays(d.date, U.today()) <= 1 ? d.date : U.today())) + '">' +
      '<label class="lbl" for="ss-spent">Time spent (min)</label><input id="ss-spent" class="field num" type="number" min="0" max="900" step="5" value="' + (d.done ? ST.spent(d) : '') + '" placeholder="' + (d.min || 60) + '"></div></div>' +
      '</form>';
    const foot = (s ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + (s && ED.gcal && ED.gcal.pickBtn ? ED.gcal.pickBtn('s:' + s.id) : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">' + (s ? 'Save' : 'Add session') + '</button>';
    ED.ui.modal({
      title: s ? 'Study session' : 'New study session', cls: 'st-modal', body, footer: foot,
      onMount(el, api) {
        const $ = x => el.querySelector('#ss-' + x);
        const v = x => $(x).value;
        const tdef = () => { const no = +v('slotno'); const sl = ST.slot(no); $('tdef').textContent = sl && sl.time ? 'slot time ' + U.fmtTime(sl.time, h12) + ' if empty' : 'optional — shows it on the day’s timeline'; };
        tdef();
        const trackNow = () => v('track');
        wireTopic(el, $('topic'), $('topic-new'));
        wireSource(el, $('src'), trackNow);
        $('track').addEventListener('change', () => {
          const t = trackNow(); const w = ST.weekOf(v('date'));
          const theme = w && w.themes[t] || '';
          $('topic').outerHTML = topicSelect('ss-topic', t, theme);
          wireTopic(el, $('topic'), $('topic-new'));
          const src = v('src'); $('src').outerHTML = sourceSelect('ss-src', t, src); wireSource(el, $('src'), trackNow);
        });
        $('slotno').addEventListener('change', async () => {
          if (v('slotno') !== NEW) { const sl = ST.slot(+v('slotno')); if (sl && !s && sl.min) $('min').value = sl.min; tdef(); return; }
          const name = await ED.ui.prompt({ title: 'New study slot', label: 'Name of the slot (for example “Night revision”)', value: 'Slot ' + (Math.max(0, ...ST.slots().map(x => x.no)) + 1), ok: 'Add slot' });
          if (!name) { $('slotno').value = String(d.slotNo); return; }
          const no = Math.max(0, ...ST.slots().map(x => x.no)) + 1;
          p.slots.push({ no, name: name.trim(), time: '', min: +v('min') || 60 });
          $('slotno').innerHTML = ST.slots().map(x => slotOpt(x, x.no === no)).join('') + opt(NEW, '＋ A new slot…', false);
          $('slotno').value = String(no); tdef();
        });
        const doneSync = () => { $('donef').classList.toggle('off', !$('done').checked); };
        $('done').addEventListener('change', () => { if ($('done').checked && !$('spent').value) $('spent').value = v('min'); doneSync(); });
        doneSync();
        const save = () => {
          const date = v('date'); if (!U.isKey(date)) { ED.ui.toast('Choose a date'); return; }
          if (v('slotno') === NEW) { ED.ui.toast('Choose a slot'); return; }
          ED.store.checkpoint('Study session');
          const tgt = s || d;
          let trackId = v('track');
          // a plan without subjects: like the Excel import, the session goes under "Study" (so every subject list counts it)
          if (!ST.track(trackId)) trackId = (p.tracks.find(t => t.name === 'Study') || ST.addTrack('Study')).id;
          const slotNo = +v('slotno') || 1, kind = v('kind').trim();
          const min = Math.max(5, Math.min(600, parseInt(v('min'), 10) || 60));
          if (!p.slots.some(x => x.no === slotNo)) p.slots.push({ no: slotNo, name: 'Slot ' + slotNo, time: '', min });
          const src = v('src') === NEW ? '' : v('src');
          Object.assign(tgt, { date, trackId, slotNo, kind, slot: ST.slotText(slotNo, kind), min, time: v('time') || null,
            topic: readTopic($('topic'), $('topic-new'), trackId), sourceId: src, source: v('source').trim(), note: v('note').trim(), updatedAt: Date.now() });
          const done = $('done').checked;
          if (done !== !!tgt.done) markDone(tgt, done);
          if (done) {
            if (!tgt.doneAt) tgt.doneAt = Date.now();
            const on = v('on'); if (U.isKey(on)) tgt.doneOn = on;
            const sp = v('spent') === '' ? null : Math.max(0, Math.min(900, Math.round(+v('spent'))));
            tgt.spent = sp == null || sp === min ? null : sp;
          }
          const w = ST.weekOf(date); tgt.week = w ? w.n : 0;
          if (!s) { tgt.own = true; D().study.sessions.push(tgt); }
          ST.extendWeeks();
          ED.store.commit();
          api.close();
          ED.ui.toast(s ? 'Session saved' : 'Session added');
          if (ED.gcal && ED.gcal.afterDrop && tgt.time) ED.gcal.afterDrop('s:' + tgt.id);
        };
        el.querySelector('[data-x="save"]').addEventListener('click', save);
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
        el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) save(); });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', () => {
          ED.store.checkpoint('Delete session');
          D().study.sessions = ST.sessions().filter(x => x.id !== s.id);
          ED.store.commit(); api.close(); ED.ui.undoToast('Session deleted');
        });
      },
    });
  };

  /* several sessions at once: a subject in a slot on chosen weekdays between two dates */
  ST.bulkAdd = (preset) => {
    const p = ST.plan(); if (!p) return;
    preset = preset || {};
    const slots = ST.slots();
    const sp = ST.span() || { a: U.today(), b: U.addDays(U.today(), 83) };
    const from = preset.from || (U.today() > sp.a && U.today() <= sp.b ? U.today() : sp.a);
    const days = [1, 2, 3, 4, 5, 6, 0];
    const body = '<form class="st-form"><p class="hint" style="margin-bottom:10px">Adds one session on each chosen weekday between the two dates — for example a third slot for revision every evening, or an extra subject on weekends.</p><div class="st-grid">' +
      '<label class="lbl" for="ba-track">Subject</label><select id="ba-track" class="field">' + (p.tracks.length ? '' : opt('', '— choose —', true)) + p.tracks.map((t, i) => opt(t.id, t.name, preset.trackId ? t.id === preset.trackId : i === 0)).join('') + opt(NEW, '＋ A new subject…', false) + '</select>' +
      '<label class="lbl" for="ba-slot">Slot</label><select id="ba-slot" class="field">' + slots.map(x => slotOpt(x, x.no === (preset.slotNo || (slots[slots.length - 1] || {}).no))).join('') + opt(NEW, '＋ A new slot…', !slots.length) + '</select>' +
      '<label class="lbl" for="ba-min">Minutes</label><input id="ba-min" class="field num" type="number" min="5" max="600" step="5" value="' + (preset.min || 45) + '">' +
      '<label class="lbl">Days</label><div class="ba-days">' + days.map(dw => '<label class="chip-check"><input type="checkbox" data-dw="' + dw + '"' + (preset.days ? (preset.days.indexOf(dw) >= 0 ? ' checked' : '') : ' checked') + '><span>' + U.DAY3[dw] + '</span></label>').join('') + '</div>' +
      '<label class="lbl" for="ba-from">From</label><div class="te-dt"><input id="ba-from" class="field" type="date" value="' + from + '"><span class="hint">to</span><input id="ba-to" class="field" type="date" value="' + (preset.to || sp.b) + '" aria-label="To"></div>' +
      '<label class="lbl" for="ba-kind">Kind of work</label><input id="ba-kind" class="field" list="ba-kinds" placeholder="Revision, Reading, Code…"><datalist id="ba-kinds">' + KINDS.map(k => '<option value="' + e(k) + '">').join('') + '</datalist>' +
      '<label class="lbl" for="ba-topic">Topic</label><div class="st-stack">' + topicSelect('ba-topic', preset.trackId || (p.tracks[0] || {}).id, '', 'Each week’s topic for this subject') + '<input id="ba-topic-new" class="field" placeholder="Type the topic" hidden></div>' +
      '<label class="lbl" for="ba-src">Book / lecture</label>' + sourceSelect('ba-src', preset.trackId || (p.tracks[0] || {}).id, '') +
      '<label class="lbl" for="ba-source">Chapter / task</label><input id="ba-source" class="field" placeholder="Optional">' +
      '</div><p class="st-count hint" id="ba-count"></p></form>';
    ED.ui.modal({
      title: 'Add to the schedule', cls: 'st-modal', body,
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="add">Add sessions</button>',
      onMount(el, api) {
        const $ = x => el.querySelector('#ba-' + x);
        const list = () => {
          const a = $('from').value, b = $('to').value;
          const dws = U.$$('[data-dw]', el).filter(x => x.checked).map(x => +x.dataset.dw);
          const out = [];
          if (!U.isKey(a) || !U.isKey(b) || b < a || !dws.length) return out;
          for (let k = a, g = 0; k <= b && g < 800; k = U.addDays(k, 1), g++) if (dws.indexOf(U.dow(k)) >= 0) out.push(k);
          return out;
        };
        const count = () => { const n = list().length; const m = +$('min').value || 0; $('count').textContent = n ? 'Adds ' + U.plural(n, 'session') + ' · ' + fmtH(n * m) + ' of study.' : 'Choose the days and dates.'; };
        el.addEventListener('input', count); el.addEventListener('change', count); count();
        wireTopic(el, $('topic'), $('topic-new'));
        wireSource(el, $('src'), () => $('track').value);
        $('track').addEventListener('change', async () => {
          if ($('track').value === NEW) {
            const name = await ED.ui.prompt({ title: 'New subject', label: 'Subject name', ok: 'Add subject' });
            if (!name || !name.trim()) { $('track').value = (p.tracks[0] || {}).id || ''; return; }
            const tr = ST.addTrack(name.trim());
            $('track').innerHTML = p.tracks.map(t => opt(t.id, t.name, t.id === tr.id)).join('') + opt(NEW, '＋ A new subject…', false);
          }
          const t = $('track').value;
          $('topic').outerHTML = topicSelect('ba-topic', t, '', 'Each week’s topic for this subject'); wireTopic(el, $('topic'), $('topic-new'));
          const src = $('src').value; $('src').outerHTML = sourceSelect('ba-src', t, src); wireSource(el, $('src'), () => $('track').value);
        });
        $('slot').addEventListener('change', async () => {
          if ($('slot').value !== NEW) { const sl = ST.slot(+$('slot').value); if (sl && sl.min) $('min').value = sl.min; count(); return; }
          const no = Math.max(0, ...ST.slots().map(x => x.no)) + 1;
          const name = await ED.ui.prompt({ title: 'New study slot', label: 'Name of the slot (for example “Night revision”)', value: 'Slot ' + no, ok: 'Add slot' });
          if (!name) { $('slot').value = String((ST.slots()[0] || {}).no || ''); return; }
          p.slots.push({ no, name: name.trim(), time: '', min: +$('min').value || 45 });
          $('slot').innerHTML = ST.slots().map(x => slotOpt(x, x.no === no)).join('') + opt(NEW, '＋ A new slot…', false);
        });
        if (!slots.length) $('slot').dispatchEvent(new Event('change'));
        el.querySelector('[data-x="add"]').addEventListener('click', () => {
          const ks = list(); if (!ks.length) { ED.ui.toast('No days match — check the dates and weekdays'); return; }
          const trackId = $('track').value; if (!trackId || trackId === NEW) { ED.ui.toast('Choose a subject'); return; }
          const slotNo = +$('slot').value; if (!slotNo) { ED.ui.toast('Choose a slot'); return; }
          const min = Math.max(5, Math.min(600, +$('min').value || 45));
          const kind = $('kind').value.trim();
          const fixed = readTopic($('topic'), $('topic-new'), trackId);
          const src = $('src').value === NEW ? '' : $('src').value;
          ED.store.checkpoint('Add sessions');
          ks.forEach(k => {
            const w = ST.weekOf(k);
            D().study.sessions.push({ id: U.uid('ss'), week: w ? w.n : 0, date: k, slotNo, kind, slot: ST.slotText(slotNo, kind), trackId, min, topic: fixed || (w && w.themes[trackId]) || '', sourceId: src, source: $('source').value.trim(), done: false, doneAt: null, doneOn: null, spent: null, time: null, note: '', own: true, updatedAt: Date.now() });
          });
          ST.extendWeeks();
          ED.store.commit(); api.close();
          ED.ui.undoToast(U.plural(ks.length, 'session') + ' added to the schedule');
        });
      },
    });
  };

  /* plan weeks cover every session (after adding sessions past the old end) */
  ST.extendWeeks = () => {
    const p = ST.plan(); if (!p) return;
    const list = ST.sessions(); if (!list.length) return;
    const last = list.reduce((m, s) => s.date > m ? s.date : m, list[0].date);
    const first = list.reduce((m, s) => s.date < m ? s.date : m, list[0].date);
    if (!p.weeks.length) p.weeks.push({ n: 1, start: U.startOfWeek(first, 1), label: '', phase: '', note: '', themes: {} });
    let lw = p.weeks[p.weeks.length - 1];
    while (U.addDays(lw.start, 6) < last) {
      const st = U.addDays(lw.start, 7);
      lw = { n: lw.n + 1, start: st, label: U.fmtDM(st) + ' – ' + U.fmtDM(U.addDays(st, 6)) + ' ' + U.addDays(st, 6).slice(0, 4), phase: '', note: '', themes: {} };
      p.weeks.push(lw);
    }
    list.forEach(s => { if (!s.week) { const w = ST.weekOf(s.date); if (w) s.week = w.n; } });
    if (last > p.end) p.end = last;
    if (first < p.start) p.start = first;
  };

  ST.addTrack = name => {
    const p = ST.plan();
    const i = p.tracks.length;
    const tr = { id: 'tr-' + slug(name) + '-' + Date.now().toString(36).slice(-4), name, short: autoShort(name), day: null, slot: '', idx: i, color: i < 8 ? SERIES[i] : 'var(--ink-3)' };
    p.tracks.push(tr);
    return tr;
  };

  /* a book or a lecture course */
  ST.editSource = (id, o) => {
    const p = ST.plan(); if (!p) return;
    o = o || {};
    const x = id ? ST.source(id) : { id: U.uid('bk'), kind: o.kind || 'book', trackId: o.trackId || (p.tracks[0] || {}).id || '', title: '', use: '', access: '', where: '' };
    const body = '<form class="st-form"><div class="seg fin-type" role="group" aria-label="Type"><button type="button" data-k="book" aria-pressed="' + (x.kind !== 'lecture') + '">📖 Book</button><button type="button" data-k="lecture" aria-pressed="' + (x.kind === 'lecture') + '">🎓 Lecture / course</button></div><div class="st-grid">' +
      '<label class="lbl" for="sr-title">Title</label><input id="sr-title" class="field" value="' + e(x.title) + '" placeholder="Author – Title, or course name">' +
      '<label class="lbl" for="sr-track">Subject</label><select id="sr-track" class="field">' + opt('', 'All subjects', !x.trackId) + p.tracks.map(t => opt(t.id, t.name, t.id === x.trackId)).join('') + '</select>' +
      '<label class="lbl" for="sr-use">Used for</label><input id="sr-use" class="field" value="' + e(x.use || '') + '" placeholder="Main text, weeks 3–8, reference only…">' +
      '<label class="lbl" for="sr-access">Access</label><input id="sr-access" class="field" value="' + e(x.access || '') + '" placeholder="Free PDF, Buy, Library…">' +
      '<label class="lbl" for="sr-where">Link / where</label><input id="sr-where" class="field" value="' + e(x.where || '') + '" placeholder="https://… or shelf, drive folder">' +
      '</div></form>';
    ED.ui.modal({
      title: id ? 'Book or lecture' : 'Add a book or lecture', cls: 'st-modal', body,
      footer: (id ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        let kind = x.kind === 'lecture' ? 'lecture' : 'book';
        el.querySelector('.fin-type').addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; U.$$('.fin-type button', el).forEach(y => y.setAttribute('aria-pressed', String(y === b))); });
        setTimeout(() => el.querySelector('#sr-title').focus(), 30);
        el.querySelector('[data-x="save"]').addEventListener('click', () => {
          const title = el.querySelector('#sr-title').value.trim(); if (!title) { ED.ui.toast('Give it a title'); return; }
          ED.store.checkpoint('Book or lecture');
          const trackId = el.querySelector('#sr-track').value;
          const tr = ST.track(trackId);
          const f = { kind, title, trackId, track: tr ? ST.short(tr) : '', use: el.querySelector('#sr-use').value.trim(), access: el.querySelector('#sr-access').value.trim(), where: el.querySelector('#sr-where').value.trim() };
          p.books = p.books.filter(y => y.id !== x.id); p.lectures = p.lectures.filter(y => y.id !== x.id);
          const item = Object.assign(x, f);
          (kind === 'lecture' ? p.lectures : p.books).push(item);
          ED.store.commit(); api.close();
          ED.ui.toast((kind === 'lecture' ? 'Lecture' : 'Book') + ' saved');
          if (o.after) o.after(item);
        });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', async () => {
          const n = ST.sessions().filter(s => s.sourceId === x.id).length;
          const ok = await ED.ui.confirm({ title: 'Delete', message: 'Delete “' + x.title + '”?' + (n ? ' Its name stays written in the ' + U.plural(n, 'session') + ' that use it.' : ''), ok: 'Delete', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Delete book');
          ST.sessions().forEach(s => { if (s.sourceId === x.id) { s.source = [x.title, s.source].filter(Boolean).join(' — '); s.sourceId = ''; } });
          p.books = p.books.filter(y => y.id !== x.id); p.lectures = p.lectures.filter(y => y.id !== x.id);
          ED.store.commit(); api.close(); ED.ui.undoToast('Deleted');
        });
      },
    });
  };
  /* a paper, patent, news item, Employment News notice or an item of your own category */
  ST.editItem = (id, o) => {
    const p = ST.plan(); if (!p) return;
    o = o || {};
    const x = id ? (p.items || []).find(y => y.id === id) : null;
    const d = x ? U.clone(x) : { id: U.uid('ri'), kind: o.kind || 'paper-r', trackId: o.trackId || '', title: '', by: '', venue: '', status: '', due: '', where: '', use: '' };
    const cats = ST.srcCats();
    const c0 = ST.srcCat(d.kind) || cats[0];
    const statusOpts = (c, cur) => (c.status.indexOf(cur) < 0 && cur ? [cur] : []).concat(c.status).map(s => opt(s, s, s === (cur || c.status[0]))).join('');
    const body = '<form class="st-form ri-form"><div class="st-grid">' +
      '<label class="lbl" for="ri-kind">Category</label><select id="ri-kind" class="field">' + cats.map(c => opt(c.id, c.icon + ' ' + c.name, c.id === c0.id)).join('') + '</select>' +
      '<label class="lbl" for="ri-title" id="ri-l-title">' + e(c0.f.title) + '</label><input id="ri-title" class="field" value="' + e(d.title) + '">' +
      '<label class="lbl" for="ri-by" id="ri-l-by">' + e(c0.f.by) + '</label><input id="ri-by" class="field" value="' + e(d.by || '') + '">' +
      '<label class="lbl" for="ri-venue" id="ri-l-venue">' + e(c0.f.venue) + '</label><input id="ri-venue" class="field" value="' + e(d.venue || '') + '">' +
      '<label class="lbl" for="ri-status">Status</label><select id="ri-status" class="field">' + statusOpts(c0, d.status) + '</select>' +
      '<label class="lbl" for="ri-due" id="ri-l-due">' + e(c0.f.due) + '</label><input id="ri-due" class="field" type="date" value="' + e(d.due || '') + '">' +
      '<label class="lbl" for="ri-where" id="ri-l-where">' + e(c0.f.where) + '</label><input id="ri-where" class="field" value="' + e(d.where || '') + '" placeholder="https://…">' +
      '<label class="lbl" for="ri-track">Subject</label><select id="ri-track" class="field">' + opt('', 'All subjects', !d.trackId) + p.tracks.map(t => opt(t.id, t.name, t.id === d.trackId)).join('') + '</select>' +
      '<label class="lbl" for="ri-use">Notes</label><textarea id="ri-use" class="field" rows="3" placeholder="Summary, next step, reviewer comments, eligibility…">' + e(d.use || '') + '</textarea>' +
      '</div></form>';
    ED.ui.modal({
      title: x ? c0.name : 'Add a ' + c0.one, cls: 'st-modal', body,
      footer: (x ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        const $ = k => el.querySelector('#ri-' + k);
        $('kind').addEventListener('change', () => {
          const c = ST.srcCat($('kind').value) || c0;
          ['title', 'by', 'venue', 'due', 'where'].forEach(k => { el.querySelector('#ri-l-' + k).textContent = c.f[k]; });
          const cur = $('status').value; $('status').innerHTML = statusOpts(c, c.status.indexOf(cur) >= 0 ? cur : '');
        });
        setTimeout(() => $('title').focus(), 30);
        el.querySelector('[data-x="save"]').addEventListener('click', () => {
          const title = $('title').value.trim(); if (!title) { ED.ui.toast('Give it a title'); $('title').focus(); return; }
          const tr = ST.track($('track').value);
          const f = { kind: $('kind').value, title, by: $('by').value.trim(), venue: $('venue').value.trim(), status: $('status').value, due: U.isKey($('due').value) ? $('due').value : '', where: $('where').value.trim(), trackId: $('track').value, track: tr ? ST.short(tr) : '', use: $('use').value.trim(), updatedAt: Date.now() };
          ED.store.checkpoint('Reading and writing');
          f.updatedAt = Date.now();
          if (x) Object.assign(x, f); else { p.items = p.items || []; p.items.push(Object.assign(d, f)); }
          ED.store.commit(); api.close(); ED.ui.toast('Saved');
          if (o.after) o.after(x || d);
        });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', async () => {
          const n = ST.sessions().filter(s => s.sourceId === x.id).length;
          const ok = await ED.ui.confirm({ title: 'Delete', message: 'Delete “' + x.title + '”?' + (n ? ' Its name stays written in the ' + U.plural(n, 'session') + ' that use it.' : ''), ok: 'Delete', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Delete');
          ST.sessions().forEach(s => { if (s.sourceId === x.id) { s.source = [x.title, s.source].filter(Boolean).join(' — '); s.sourceId = ''; } });
          p.items = p.items.filter(y => y.id !== x.id);
          ED.store.commit(); api.close(); ED.ui.undoToast('Deleted');
        });
      },
    });
  };
  /* a category of your own (reading or writing), or change one */
  ST.editCat = id => {
    const p = ST.plan(); if (!p) return;
    p.srcCats = p.srcCats || [];
    const x = id ? p.srcCats.find(c => c.id === id) : null;
    const d = x ? U.clone(x) : { id: U.uid('rc'), name: '', icon: '📌', mode: 'read' };
    const body = '<form class="st-form"><div class="st-grid">' +
      '<label class="lbl" for="rc-name">Name</label><input id="rc-name" class="field" value="' + e(d.name) + '" placeholder="e.g. Standards (BIS, WMO), Tenders, Reports, Magazines" maxlength="40">' +
      '<label class="lbl" for="rc-icon">Symbol</label><input id="rc-icon" class="field" value="' + e(d.icon) + '" maxlength="4" style="max-width:80px">' +
      '<span class="lbl">Kind</span><div class="seg" role="group" aria-label="Kind" id="rc-mode"><button type="button" data-k="read" aria-pressed="' + (d.mode !== 'write') + '">Things I read</button><button type="button" data-k="write" aria-pressed="' + (d.mode === 'write') + '">Things I write</button></div>' +
      '</div><p class="hint" style="margin-top:8px">The kind sets the status list: to read → reading → done, or idea → drafting → submitted → published.</p></form>';
    ED.ui.modal({
      title: x ? 'Category' : 'New category', cls: 'st-modal', body,
      footer: (x ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        let mode = d.mode === 'write' ? 'write' : 'read';
        el.querySelector('#rc-mode').addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (!b) return; mode = b.dataset.k; U.$$('#rc-mode button', el).forEach(y => y.setAttribute('aria-pressed', String(y === b))); });
        setTimeout(() => el.querySelector('#rc-name').focus(), 30);
        el.querySelector('[data-x="save"]').addEventListener('click', () => {
          const name = el.querySelector('#rc-name').value.trim(); if (!name) { ED.ui.toast('Name the category'); return; }
          if (ST.srcCats().some(c => c.id !== d.id && c.name.toLowerCase() === name.toLowerCase())) { ED.ui.toast('There is already a category with that name'); return; }
          ED.store.checkpoint('Category');
          const v = { name, icon: el.querySelector('#rc-icon').value.trim() || '📌', mode };
          v.updatedAt = Date.now();
          if (x) Object.assign(x, v); else p.srcCats.push(Object.assign(d, v));
          ED.store.commit(); api.close(); ED.ui.toast('Category saved');
        });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', async () => {
          const n = (p.items || []).filter(i => i.kind === x.id).length;
          const ok = await ED.ui.confirm({ title: 'Delete category', message: n ? 'Delete “' + x.name + '” and its ' + U.plural(n, 'entry', 'entries') + '?' : 'Delete the category “' + x.name + '”?', ok: 'Delete', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Delete category');
          const gone = new Set((p.items || []).filter(i => i.kind === x.id).map(i => i.id));
          ST.sessions().forEach(s => { if (gone.has(s.sourceId)) { const it = p.items.find(i => i.id === s.sourceId); s.source = [it && it.title, s.source].filter(Boolean).join(' — '); s.sourceId = ''; } });
          p.items = (p.items || []).filter(i => i.kind !== x.id); p.srcCats = p.srcCats.filter(c => c.id !== x.id);
          ED.store.commit(); api.close(); ED.ui.undoToast('Category deleted');
        });
      },
    });
  };
  ST.addTopic = async trackId => {
    const p = ST.plan(); const tr = ST.track(trackId); if (!p || !tr) return;
    const v = await ED.ui.prompt({ title: 'New topic · ' + tr.name, label: 'Topic', ok: 'Add topic', hint: 'It appears in the Topic list when you add or edit a session of this subject.' });
    if (!v || !v.trim()) return;
    if (ST.topicsFor(trackId).some(t => t.toLowerCase() === v.trim().toLowerCase())) { ED.ui.toast('That topic is already in the list'); return; }
    ED.store.checkpoint('Topic'); p.topics.push({ id: U.uid('tp'), trackId, name: v.trim() }); ED.store.commit();
  };

  /* plan settings: title, slots (any number, each with a time and a usual length), subjects */
  ST.editPlan = () => {
    const p = ST.plan(); if (!p) return;
    let slots = U.clone(ST.slots());
    let tracks = U.clone(p.tracks);
    const used = no => ST.sessions().filter(s => (s.slotNo || 1) === no).length;
    const usedT = id => ST.sessions().filter(s => s.trackId === id).length;
    const dayOpts = t => opt('', '—', t.day == null) + opt(-1, 'Every day', t.day === -1) + [1, 2, 3, 4, 5, 6, 0].map(d => opt(d, U.DAYS[d], t.day === d)).join('');
    const slotRows = () => slots.map((x, i) => '<div class="st-slotrow"><span class="st-slot-n num">' + x.no + '</span>' +
      '<input class="field" data-sl="' + i + '" data-f="name" value="' + e(x.name) + '" aria-label="Slot ' + x.no + ' name">' +
      '<input class="field" type="time" data-sl="' + i + '" data-f="time" value="' + e(x.time || '') + '" aria-label="Slot ' + x.no + ' start time">' +
      '<input class="field num" type="number" min="5" max="600" step="5" data-sl="' + i + '" data-f="min" value="' + (x.min || 60) + '" aria-label="Slot ' + x.no + ' usual minutes">' +
      '<span class="hint num st-slot-c">' + U.plural(used(x.no), 'session') + '</span>' +
      '<button type="button" class="icon-btn sm" data-x="slotdel" data-i="' + i + '" aria-label="Remove slot ' + x.no + '" title="Remove slot">' + ED.icon('trash') + '</button></div>').join('');
    const trackRows = () => tracks.map((t, i) => '<div class="st-tr"><i class="sw" style="--c:' + ST.color(t) + '"></i>' +
      '<input class="field" data-tr="' + i + '" data-f="name" value="' + e(t.name) + '" aria-label="Subject name">' +
      '<input class="field" data-tr="' + i + '" data-f="short" value="' + e(t.short || '') + '" aria-label="Short name" placeholder="Short name">' +
      '<select class="field" data-tr="' + i + '" data-f="day" aria-label="Day">' + dayOpts(t) + '</select>' +
      '<button type="button" class="icon-btn sm" data-x="trdel" data-i="' + i + '" aria-label="Remove subject" title="Remove subject' + (usedT(t.id) ? ' (and its ' + U.plural(usedT(t.id), 'session') + ')' : '') + '">' + ED.icon('trash') + '</button></div>').join('');
    const body = '<form class="st-form">' +
      '<div class="st-grid">' +
      '<label class="lbl" for="sp-title">Plan name</label><input id="sp-title" class="field" value="' + e(p.title) + '">' +
      '<label class="lbl" for="sp-sub">Subtitle</label><input id="sp-sub" class="field" value="' + e(p.subtitle || '') + '">' +
      '<span class="lbl">Starts on</span><span>' + e(U.fmtShort((p.weeks.slice().sort((a, b) => a.start.localeCompare(b.start))[0] || {}).start || p.start)) + ' <button type="button" class="link-btn" data-x="start">Change the start date…</button> · <button type="button" class="link-btn" data-x="bulk">Change many sessions…</button></span>' +
      '</div>' +
      '<h3 class="set-h">Study slots</h3><p class="hint">As many slots a day as you like. Give a slot a start time and its sessions appear on the Daily Tasks timeline (and in Google Calendar, if you link it). To put a new slot into the days, use <b>Plan → Add to the schedule</b>.</p>' +
      '<div class="st-slotrow st-slotrow-h hint"><span>No.</span><span>Name</span><span>Start time</span><span>Usual min</span><span></span><span></span></div><div id="sp-slots">' + slotRows() + '</div>' +
      '<button type="button" class="btn small" data-x="slotadd">' + ED.icon('plus') + 'Add a slot</button>' +
      '<h3 class="set-h">Subjects</h3><div class="st-tracks" id="sp-tracks">' + trackRows() + '</div>' +
      '<button type="button" class="btn small" data-x="tradd">' + ED.icon('plus') + 'Add a subject</button>' +
      '</form>';
    ED.ui.modal({
      title: 'Plan settings', cls: 'st-modal wide', body,
      footer: '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete plan</button><span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        const readInputs = () => {
          U.$$('[data-sl]', el).forEach(x => { const s = slots[+x.dataset.sl]; if (!s) return; const f = x.dataset.f; s[f] = f === 'min' ? Math.max(5, Math.min(600, +x.value || 60)) : x.value.trim(); });
          U.$$('[data-tr]', el).forEach(x => { const t = tracks[+x.dataset.tr]; if (!t) return; const f = x.dataset.f; if (f === 'day') t.day = x.value === '' ? null : +x.value; else t[f] = x.value.trim(); });
        };
        const redraw = () => { el.querySelector('#sp-slots').innerHTML = slotRows(); el.querySelector('#sp-tracks').innerHTML = trackRows(); };
        el.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-x]'); if (!b) return;
          const k = b.dataset.x;
          if (k === 'start') { api.close(); ST.editStart(); return; }
          if (k === 'bulk') { api.close(); ST.bulkChange(); return; }
          if (k === 'slotadd') { readInputs(); const no = Math.max(0, ...slots.map(x => x.no)) + 1; slots.push({ no, name: 'Slot ' + no, time: '', min: 60 }); redraw(); const inp = el.querySelector('[data-sl="' + (slots.length - 1) + '"][data-f="name"]'); if (inp) { inp.focus(); inp.select(); } }
          else if (k === 'slotdel') {
            readInputs(); const i = +b.dataset.i; const sl = slots[i]; const n = used(sl.no);
            if (n) { const ok = await ED.ui.confirm({ title: 'Remove slot ' + sl.no, message: U.plural(n, 'session') + ' use “' + sl.name + '”. Remove the slot and delete those sessions when you save?', ok: 'Remove with sessions', danger: true }); if (!ok) return; sl.dropSessions = true; }
            slots.splice(i, 1); slots.removed = (slots.removed || []).concat([sl]); redraw();
          }
          else if (k === 'tradd') { readInputs(); const name = await ED.ui.prompt({ title: 'New subject', label: 'Subject name', ok: 'Add' }); if (!name || !name.trim()) return; const i = tracks.length; tracks.push({ id: 'tr-' + slug(name) + '-' + Date.now().toString(36).slice(-4), name: name.trim(), short: autoShort(name.trim()), day: null, slot: '', idx: i, color: i < 8 ? SERIES[i] : 'var(--ink-3)' }); redraw(); }
          else if (k === 'trdel') {
            readInputs(); const t = tracks[+b.dataset.i]; if (!t) return;
            const all = ST.sessions().filter(s => s.trackId === t.id), dn = all.filter(s => s.done).length;
            if (all.length && !(await ED.ui.confirm({ title: 'Remove ' + t.name, message: 'Remove the subject “' + t.name + '” and its ' + U.plural(all.length, 'session') + (dn ? ' (' + dn + ' already ticked)' : '') + ' when you save? You can undo right after.', ok: 'Remove with sessions', danger: true }))) return;
            tracks.splice(+b.dataset.i, 1); tracks.removed = (tracks.removed || []).concat([t.id]); redraw();
          }
          else if (k === 'save') {
            readInputs();
            ED.store.checkpoint('Plan settings');
            p.title = el.querySelector('#sp-title').value.trim() || p.title;
            p.subtitle = el.querySelector('#sp-sub').value.trim();
            const gone = (slots.removed || []).filter(x => x.dropSessions).map(x => x.no);
            if (gone.length) D().study.sessions = ST.sessions().filter(s => gone.indexOf(s.slotNo || 1) < 0);
            p.slots = slots.map(x => ({ no: x.no, name: x.name || 'Slot ' + x.no, time: x.time || '', min: x.min || 60 }));
            // keep slot names in the sessions' labels
            ST.sessions().forEach(s => { const sl = p.slots.find(x => x.no === (s.slotNo || 1)); if (sl) s.slot = ST.slotText(s.slotNo || 1, s.kind); });
            tracks.forEach(t => {
              if (!t.name) t.name = 'Subject';
              // a short name made from the old name follows a renamed subject (chips on every study page show it)
              const o = p.tracks.find(x => x.id === t.id);
              if (o && o.short && o.name !== t.name && t.short === o.short && (o.short === o.name || o.short === autoShort(o.name))) t.short = autoShort(t.name);
            });
            const goneT = (tracks.removed || []).filter(id => !tracks.some(t => t.id === id));
            if (goneT.length) {
              D().study.sessions = ST.sessions().filter(s => goneT.indexOf(s.trackId) < 0);
              if (Array.isArray(p.topics)) p.topics = p.topics.filter(x => goneT.indexOf(x.trackId) < 0);
              (p.weeks || []).forEach(w => { if (w.themes) goneT.forEach(id => { delete w.themes[id]; }); });
            }
            p.tracks = tracks.slice();
            p.updatedAt = Date.now();
            ED.store.commit(); api.close();
            if (goneT.length) ED.ui.undoToast('Plan saved — ' + U.plural(goneT.length, 'subject') + ' removed with its sessions'); else ED.ui.toast('Plan saved');
          }
          else if (k === 'del') {
            const ok = await ED.ui.confirm({ title: 'Delete study plan', message: 'Delete “' + p.title + '” and all its ' + ST.sessions().length + ' sessions and ticks? You can undo right after, or import the Excel file again.', ok: 'Delete plan', danger: true });
            if (!ok) return;
            ED.store.checkpoint('Delete study plan');
            const shelf = ST.shelf().slice(), next = shelf.pop();
            D().study = next ? { plan: next.plan, sessions: next.sessions || [], shelf } : { plan: null, sessions: [], shelf };
            ED.state.study = {};
            ED.store.commit(); api.close(); ED.ui.undoToast('Study plan deleted' + (next ? ' — now showing “' + next.plan.title + '”' : ''));
          }
        });
      },
    });
  };

  /* make a new plan from a weekly pattern with any number of slots */
  ST.newPlan = () => {
    const days = [1, 2, 3, 4, 5, 6, 0];
    const start = U.startOfWeek(U.addDays(U.today(), 7), 1);
    let nSlots = 2;
    const cell = {};  // "d|i" -> {track, min}
    const slotMeta = [{ name: 'Morning', time: '' }, { name: 'Evening', time: '' }];
    const body = '<form class="st-form">' +
      '<div class="st-grid">' +
      '<label class="lbl" for="np-title">Plan name</label><input id="np-title" class="field" placeholder="e.g. Exam preparation">' +
      '<label class="lbl" for="np-start">Starts on</label><input id="np-start" class="field" type="date" value="' + start + '">' +
      '<label class="lbl" for="np-weeks">Weeks</label><input id="np-weeks" class="field num" type="number" min="1" max="104" value="12">' +
      '<label class="lbl" for="np-tracks">Subjects</label><textarea id="np-tracks" class="field" rows="4" placeholder="One per line, e.g.\nAI & Machine Learning\nSignal Processing"></textarea>' +
      '</div>' +
      '<h3 class="set-h">Weekly pattern</h3><p class="hint">Pick what you study in each slot. Leave a slot empty for a rest. <span class="np-tools"><button type="button" class="btn small" data-x="add">' + ED.icon('plus') + 'Add a slot</button><button type="button" class="btn small" data-x="rm">Remove last slot</button></span></p>' +
      '<div class="np-wrap"><div class="np-pat" id="np-pat"></div></div></form>';
    ED.ui.modal({
      title: 'New study plan', cls: 'st-modal wide', body,
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="make">Make plan</button>',
      onMount(el, api) {
        const ta = el.querySelector('#np-tracks');
        const pat = el.querySelector('#np-pat');
        const names = () => ta.value.split('\n').map(x => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
        const read = () => {
          U.$$('[data-s]', pat).forEach(x => { const k = x.dataset.d + '|' + x.dataset.s; cell[k] = Object.assign(cell[k] || { min: 60 }, { track: x.value }); });
          U.$$('[data-m]', pat).forEach(x => { const k = x.dataset.d + '|' + x.dataset.m; cell[k] = Object.assign(cell[k] || {}, { min: +x.value || 0 }); });
          U.$$('[data-sn]', pat).forEach(x => { slotMeta[+x.dataset.sn].name = x.value.trim(); });
          U.$$('[data-stime]', pat).forEach(x => { slotMeta[+x.dataset.stime].time = x.value; });
        };
        const draw = () => {
          const n = names();
          pat.style.gridTemplateColumns = '44px repeat(' + nSlots + ', minmax(140px, 1fr) 64px)';
          let h = '<span></span>';
          for (let i = 0; i < nSlots; i++) { slotMeta[i] = slotMeta[i] || { name: 'Slot ' + (i + 1), time: '' }; h += '<input class="field np-sname" data-sn="' + i + '" value="' + e(slotMeta[i].name) + '" aria-label="Slot ' + (i + 1) + ' name"><input class="field np-stime" type="time" data-stime="' + i + '" value="' + e(slotMeta[i].time) + '" aria-label="Slot ' + (i + 1) + ' time" title="Start time (optional)">'; }
          days.forEach(d => {
            h += '<span class="np-day">' + U.DAY3[d] + '</span>';
            for (let i = 0; i < nSlots; i++) {
              const c = cell[d + '|' + i] || { track: '', min: 60 };
              h += '<select class="field" data-d="' + d + '" data-s="' + i + '" aria-label="' + U.DAYS[d] + ' slot ' + (i + 1) + '">' + opt('', '—', !c.track) + n.map(x => opt(x, x, x === c.track)).join('') + '</select>' +
                '<input class="field num" type="number" min="0" max="600" step="5" value="' + (c.min == null ? 60 : c.min) + '" data-d="' + d + '" data-m="' + i + '" aria-label="' + U.DAYS[d] + ' slot ' + (i + 1) + ' minutes">';
            }
          });
          pat.innerHTML = h;
        };
        ta.addEventListener('input', U.debounce(() => { read(); draw(); }, 250)); draw();
        el.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-x]'); if (!b) return;
          if (b.dataset.x === 'add') { read(); if (nSlots < 8) nSlots++; draw(); return; }
          if (b.dataset.x === 'rm') { read(); if (nSlots > 1) nSlots--; draw(); return; }
          if (b.dataset.x !== 'make') return;
          read();
          const n = names(); if (!n.length) { ED.ui.toast('Add at least one subject'); ta.focus(); return; }
          const st = el.querySelector('#np-start').value; if (!U.isKey(st)) { ED.ui.toast('Choose a start date'); return; }
          const pattern = {};
          days.forEach(d => { pattern[d] = []; for (let i = 0; i < nSlots; i++) { const c = cell[d + '|' + i]; pattern[d].push(c && c.track && c.min > 0 ? { track: c.track, min: c.min } : null); } });
          const weeks = Math.max(1, Math.min(104, +el.querySelector('#np-weeks').value || 12));
          const r = ST.generate({ title: el.querySelector('#np-title').value.trim(), start: st, weeks, tracks: n, slots: slotMeta.slice(0, nSlots), pattern });
          if (!r.sessions.length) { ED.ui.toast('The weekly pattern is empty'); return; }
          let keep = false;
          if (ST.plan()) {
            const cur = ST.plan();
            const ok = cur.sample
              ? await ED.ui.confirm({ title: 'Replace study plan', message: 'This replaces the example plan “' + cur.title + '”. You can undo right after.', ok: 'Replace', danger: true })
              : await ED.ui.confirm({ title: 'New study plan', message: 'Keep “' + cur.title + '” in your plans (switch back any time from the Plan menu), or replace it and its ticks?', choices: [{ id: 'replace', label: 'Replace it', danger: true }, { id: 'keep', label: 'Keep both', primary: true }] });
            if (!ok) return;
            keep = ok === 'keep';
          }
          ED.store.checkpoint('New study plan');
          if (keep) ST.stash();
          r.shelf = ST.shelf(); D().study = r; ED.state.study = {};
          ED.store.commit(); api.close();
          ED.ui.undoToast('Plan made: ' + U.plural(r.sessions.length, 'session') + '. Click a week’s topic to fill it in.');
          ED.go.tab('studyWeek');
        });
      },
    });
  };

  /* week topics: editing one also fills the sessions of that week that had the old topic */
  ST.editTheme = (n, trackId) => {
    const w = ST.weekByN(n); const tr = ST.track(trackId); if (!w || !tr) return;
    const old = w.themes[trackId] || '';
    ED.ui.prompt({ title: 'Week ' + n + ' · ' + tr.name, label: 'Topic for this week', value: old, ok: 'Save' }).then(v => {
      if (v == null) return;
      v = v.trim();
      ED.store.checkpoint('Week topic');
      w.themes[trackId] = v;
      ST.inWeek(n).forEach(s => { if (s.trackId === trackId && (!s.topic || s.topic === old)) { s.topic = v; s.updatedAt = Date.now(); } });
      ED.store.commit();
    });
  };
  ST.editWeekNote = n => {
    const w = ST.weekByN(n); if (!w) return;
    ED.ui.prompt({ title: 'Week ' + n, label: 'Note for this week (e.g. “Diwali week — half load”)', value: w.note || '', ok: 'Save' }).then(v => {
      if (v == null) return;
      w.note = v.trim(); ED.store.commit();
    });
  };

  /* ======================= actions ======================= */
  /* ======================= several plans: one shown at a time, the others kept in study.shelf ======================= */
  ST.shelf = () => (D().study && Array.isArray(D().study.shelf) ? D().study.shelf : []);
  // put the plan now shown on the shelf (the caller then shows another one)
  ST.stash = () => {
    const sd = D().study; if (!sd || !sd.plan) return;
    if (!sd.plan.id) sd.plan.id = U.uid('sp');
    sd.shelf = ST.shelf().filter(x => x.id !== sd.plan.id).concat([{ id: sd.plan.id, plan: sd.plan, sessions: sd.sessions || [], savedAt: Date.now(), updatedAt: Date.now() }]);
  };
  ST.switchTo = id => {
    const x = ST.shelf().find(y => y.id === id); if (!x) return;
    ED.store.checkpoint('Switch study plan');
    const rest = ST.shelf().filter(y => y.id !== id);
    D().study.shelf = rest; ST.stash();
    D().study.plan = x.plan; D().study.sessions = x.sessions || [];
    ED.state.study = {};
    ED.store.commit(); ED.ui.undoToast('Now showing “' + x.plan.title + '”');
  };
  ST.dropShelved = async id => {
    const x = ST.shelf().find(y => y.id === id); if (!x) return;
    const ok = await ED.ui.confirm({ title: 'Delete saved plan', message: 'Delete “' + x.plan.title + '” and its ' + U.plural((x.sessions || []).length, 'session') + '? You can undo right after.', ok: 'Delete', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Delete saved plan'); D().study.shelf = ST.shelf().filter(y => y.id !== id);
    ED.store.commit(); ED.ui.undoToast('Deleted: ' + x.plan.title);
  };
  ST.myPlans = () => {
    const p = ST.plan(), sh = ST.shelf();
    const row = (pl, ss, on) => { const w = (pl.weeks || []).length, n = (ss || []).length, d = (ss || []).filter(s => s.done).length;
      return '<div class="st-pl' + (on ? ' on' : '') + '"><div class="grow"><b>' + e(pl.title) + '</b>' + (on ? ' <span class="chip">showing</span>' : '') +
        '<div class="hint">' + (pl.start ? e(U.fmtShort(pl.start)) + ' – ' + e(U.fmtShort(pl.end)) + ' · ' : '') + U.plural(w, 'week') + ' · ' + d + '/' + n + ' sessions done</div></div>' +
        (on ? '' : '<button type="button" class="btn small primary" data-x="use" data-id="' + e(pl.id) + '">Show this plan</button><button type="button" class="icon-btn sm" data-x="drop" data-id="' + e(pl.id) + '" aria-label="Delete ' + e(pl.title) + '" title="Delete">' + ED.icon('trash') + '</button>') + '</div>'; };
    const body = '<div class="st-pls">' + (p ? row(p, ST.sessions(), true) : '') + sh.slice().reverse().map(x => row(x.plan, x.sessions, false)).join('') + '</div>' +
      '<p class="hint">One plan is shown at a time — on the study pages, in Daily Tasks and in the calendar. The others keep their sessions and ticks until you switch back.</p>' +
      '<div class="row-btns"><button type="button" class="btn small" data-x="imp">' + ED.icon('upload') + 'Import another plan…</button><button type="button" class="btn small" data-x="mk">' + ED.icon('plus') + 'Make a new plan…</button></div>';
    ED.ui.modal({ title: 'My study plans', body, onMount(el, api) {
      el.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'use') { api.close(); ST.switchTo(b.dataset.id); }
        else if (b.dataset.x === 'drop') { api.close(); await ST.dropShelved(b.dataset.id); }
        else if (b.dataset.x === 'imp') { api.close(); ST.importFile(); }
        else if (b.dataset.x === 'mk') { api.close(); ST.newPlan(); }
      });
    } });
  };

  /* lengthen or shorten the plan shown: weeks are added or removed at the end */
  ST.setWeeks = (n, copy) => {
    const p = ST.plan(); if (!p) return 0;
    const wk = p.weeks.slice().sort((a, b) => a.start.localeCompare(b.start)), cur = wk.length;
    if (!cur || n === cur) return 0;
    let changed = 0;
    if (n < cur) {
      const cut = wk[n].start, gone = new Set(wk.slice(n).map(w => w.n));
      const before = ST.sessions().length;
      D().study.sessions = ST.sessions().filter(s => s.date < cut && !gone.has(s.week));
      changed = before - D().study.sessions.length;
      p.weeks = wk.slice(0, n);
    } else {
      const last = wk[cur - 1], tpl = copy ? ST.sessions().filter(s => s.date >= last.start && s.date <= U.addDays(last.start, 6)) : [];
      for (let i = 1; i <= n - cur; i++) {
        const st = U.addDays(last.start, 7 * i), wn = last.n + i;
        p.weeks.push({ n: wn, start: st, label: U.fmtDM(st) + ' – ' + U.fmtDM(U.addDays(st, 6)) + ' ' + U.addDays(st, 6).slice(0, 4), phase: last.phase || '', note: '', themes: {} });
        tpl.forEach(t => { D().study.sessions.push({ id: U.uid('ss'), week: wn, date: U.addDays(t.date, 7 * i), slot: t.slot, slotNo: t.slotNo, kind: t.kind || '', trackId: t.trackId, min: t.min, topic: '', sourceId: '', source: '', done: false, doneAt: null, doneOn: null, spent: null, time: t.time || null, note: '', own: true, updatedAt: Date.now() }); changed++; });
      }
      D().study.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.slotNo || 9) - (b.slotNo || 9));
    }
    const lw = p.weeks[p.weeks.length - 1];
    p.end = U.addDays(lw.start, 6);
    if (/\b\d+ weeks\b/.test(p.subtitle || '')) p.subtitle = p.subtitle.replace(/^.*? to .*?(\s+\|)/, U.fmtShort(p.start) + ' to ' + U.fmtShort(p.end) + '$1').replace(/\b\d+ weeks\b/, n + ' weeks');
    const tot = ST.sessions().reduce((a, x) => a + (x.min || 0), 0);
    if (p.subtitle) p.subtitle = p.subtitle.replace(/\b\d+(\.\d+)? hours per week\b/, (Math.round(tot / 60 / n * 10) / 10) + ' hours per week').replace(/(\|\s*)\d+ hours\s*$/, '$1' + Math.round(tot / 60) + ' hours');
    p.hoursPerWeek = Math.round(tot / 60 / n * 10) / 10;
    p.updatedAt = Date.now();
    return changed;
  };
  ST.editWeeks = () => {
    const p = ST.plan(); if (!p) return;
    const cur = p.weeks.length, wk = p.weeks.slice().sort((a, b) => a.start.localeCompare(b.start));
    const body = '<form class="st-form"><div class="st-grid">' +
      '<span class="lbl">Now</span><span>' + U.plural(cur, 'week') + ' · ' + e(U.fmtShort(p.start)) + ' to ' + e(U.fmtShort(p.end)) + '</span>' +
      '<label class="lbl" for="sw-n">Weeks</label><div class="row-btns"><button type="button" class="icon-btn" data-x="minus" aria-label="One week less">−</button><input id="sw-n" class="field num" type="number" min="1" max="156" value="' + cur + '" style="width:6em"><button type="button" class="icon-btn" data-x="plus" aria-label="One week more">+</button></div>' +
      '<span class="lbl"></span><label class="switch"><input type="checkbox" id="sw-copy" checked><span class="track"></span><span>New weeks repeat the sessions of the last week (week ' + (wk.length ? wk[wk.length - 1].n : 1) + ')</span></label>' +
      '</div><p class="hint" id="sw-msg"></p></form>';
    ED.ui.modal({ title: 'Number of weeks', body, footer: '<button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>', onMount(el, api) {
      const inp = el.querySelector('#sw-n'), msg = el.querySelector('#sw-msg');
      const val = () => Math.max(1, Math.min(156, Math.round(+inp.value || cur)));
      const show = () => {
        const n = val();
        if (n < cur) { const cut = wk[n].start, lose = ST.sessions().filter(s => s.date >= cut), d = lose.filter(s => s.done).length;
          msg.innerHTML = 'Removes the last ' + U.plural(cur - n, 'week') + ' (from ' + e(U.fmtShort(cut)) + ') with ' + U.plural(lose.length, 'session') + (d ? ' — <b>' + d + ' of them already ticked</b>' : '') + '. The plan will end on ' + e(U.fmtShort(U.addDays(wk[n - 1].start, 6))) + '.'; }
        else if (n > cur) msg.textContent = 'Adds ' + U.plural(n - cur, 'week') + ' after ' + U.fmtShort(p.end) + '; the plan will end on ' + U.fmtShort(U.addDays(p.end, 7 * (n - cur))) + '.';
        else msg.textContent = '';
      };
      inp.addEventListener('input', show); show();
      el.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'minus') { inp.value = Math.max(1, val() - 1); show(); return; }
        if (b.dataset.x === 'plus') { inp.value = Math.min(156, val() + 1); show(); return; }
        if (b.dataset.x !== 'save') return;
        const n = val(); if (n === cur) { api.close(); return; }
        if (n < cur) { const d = ST.sessions().filter(s => s.date >= wk[n].start && s.done).length;
          if (d && !(await ED.ui.confirm({ title: 'Remove weeks', message: U.plural(d, 'ticked session') + ' in the removed weeks will be deleted with them. You can undo right after.', ok: 'Remove weeks', danger: true }))) return; }
        ED.store.checkpoint('Plan weeks');
        const c = ST.setWeeks(n, el.querySelector('#sw-copy').checked);
        ED.store.commit(); api.close();
        ED.ui.undoToast(n > cur ? 'Added ' + U.plural(n - cur, 'week') + (c ? ' with ' + U.plural(c, 'session') : '') : 'Removed ' + U.plural(cur - n, 'week') + (c ? ' and ' + U.plural(c, 'session') : ''));
      });
    } });
  };

  /* ---------- 1.15: move the whole plan to a new start date ---------- */
  // every week and every session moves by the same number of days; ticks, minutes and notes stay with their sessions
  // (doneOn — the day you actually studied — is not changed)
  ST.moveStart = newStart => {
    const p = ST.plan(); if (!p || !U.isKey(newStart)) return 0;
    const wk = p.weeks.slice().sort((a, b) => a.start.localeCompare(b.start));
    const old = (wk[0] && wk[0].start) || p.start;
    const delta = U.diffDays(old, newStart); if (!delta) return 0;
    const now = Date.now();
    p.weeks.forEach(w => {
      const auto = !w.label || w.label === U.fmtDM(w.start) + ' – ' + U.fmtDM(U.addDays(w.start, 6)) + ' ' + U.addDays(w.start, 6).slice(0, 4);
      w.start = U.addDays(w.start, delta);
      if (auto) w.label = U.fmtDM(w.start) + ' – ' + U.fmtDM(U.addDays(w.start, 6)) + ' ' + U.addDays(w.start, 6).slice(0, 4);
    });
    const oldStart = p.start, oldEnd = p.end;
    p.start = U.isKey(p.start) ? U.addDays(p.start, delta) : newStart;
    if (U.isKey(p.end)) p.end = U.addDays(p.end, delta);
    if (p.subtitle && oldStart && oldEnd) p.subtitle = p.subtitle.split(U.fmtShort(oldStart)).join(U.fmtShort(p.start)).split(U.fmtShort(oldEnd)).join(U.fmtShort(p.end));
    let n = 0;
    ST.sessions().forEach(s => { if (U.isKey(s.date)) { s.date = U.addDays(s.date, delta); s.updatedAt = now; n++; } });
    p.updatedAt = now;
    return n;
  };
  ST.editStart = () => {
    const p = ST.plan(); if (!p) return;
    const wk = p.weeks.slice().sort((a, b) => a.start.localeCompare(b.start));
    const cur = (wk[0] && wk[0].start) || p.start;
    const body = '<form class="st-form"><div class="st-grid">' +
      '<span class="lbl">Now</span><span>' + e(U.fmtShort(cur)) + ' to ' + e(U.fmtShort(p.end)) + ' · ' + U.plural(wk.length, 'week') + ' · ' + U.plural(ST.sessions().length, 'session') + '</span>' +
      '<label class="lbl" for="ms-d">New start date</label><input id="ms-d" class="field" type="date" value="' + e(cur) + '">' +
      '</div><p class="hint" id="ms-msg"></p><p class="hint">Every week and every session moves by the same number of days, so the timetable stays the same. Ticked sessions keep their tick, minutes and notes. Tip: start on the same weekday (e.g. a Monday) to keep each subject on its usual day.</p></form>';
    ED.ui.modal({ title: 'Change the start date', body, footer: '<button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Move the plan</button>', onMount(el, api) {
      const inp = el.querySelector('#ms-d'), msg = el.querySelector('#ms-msg');
      const show = () => {
        const v = inp.value; if (!U.isKey(v)) { msg.textContent = ''; return; }
        const d = U.diffDays(cur, v);
        msg.innerHTML = !d ? 'Same date — nothing to move.' : 'Moves the plan <b>' + U.plural(Math.abs(d), 'day') + (d > 0 ? ' later' : ' earlier') + '</b>: ' + e(U.fmtShort(v)) + ' to ' + e(U.fmtShort(U.addDays(p.end, d))) + '.' + (U.dow(v) !== U.dow(cur) ? ' <b>The weekday changes</b> (' + e(U.DAYS[U.dow(cur)]) + ' → ' + e(U.DAYS[U.dow(v)]) + '), so each session moves to another weekday too.' : '');
      };
      inp.addEventListener('input', show); show();
      el.addEventListener('click', ev => {
        const b = ev.target.closest('[data-x="save"]'); if (!b) return;
        const v = inp.value; if (!U.isKey(v)) { ED.ui.toast('Choose a date'); return; }
        if (!U.diffDays(cur, v)) { api.close(); return; }
        ED.store.checkpoint('Plan start date');
        const n = ST.moveStart(v);
        ED.store.commit(); api.close();
        ED.ui.undoToast('The plan now starts on ' + U.fmtShort(v) + (n ? ' — ' + U.plural(n, 'session') + ' moved' : ''));
      });
    } });
  };

  /* ---------- 1.15: change many sessions at once ---------- */
  ST.bulkChange = () => {
    const p = ST.plan(); if (!p) return;
    const slots = ST.slots(), today = U.today();
    const from0 = p.start && today < p.start ? p.start : today;
    const days = [1, 2, 3, 4, 5, 6, 0];
    const trOpts = (sel, all) => (all ? opt('', 'All subjects', !sel) : '') + p.tracks.map(t => opt(t.id, t.name, t.id === sel)).join('');
    const slOpts = (sel, all) => (all ? opt('', 'All slots', !sel) : '') + slots.map(x => opt(x.no, x.no + ' - ' + x.name, String(x.no) === String(sel))).join('');
    const body = '<form class="st-form">' +
      '<h3 class="set-h">Which sessions</h3><div class="st-grid">' +
      '<label class="lbl" for="bc-tr">Subject</label><select id="bc-tr" class="field">' + trOpts('', true) + '</select>' +
      '<label class="lbl" for="bc-sl">Slot</label><select id="bc-sl" class="field">' + slOpts('', true) + '</select>' +
      '<span class="lbl">Days</span><div class="bc-days">' + days.map(d => '<label class="chk"><input type="checkbox" data-day="' + d + '" checked> ' + e(U.DAYS[d].slice(0, 3)) + '</label>').join('') + '</div>' +
      '<label class="lbl" for="bc-from">From</label><input id="bc-from" class="field" type="date" value="' + e(from0) + '">' +
      '<label class="lbl" for="bc-to">To</label><input id="bc-to" class="field" type="date" value="' + e(p.end || '') + '">' +
      '<span class="lbl"></span><label class="switch"><input type="checkbox" id="bc-done"><span class="track"></span><span>Include sessions already ticked</span></label>' +
      '</div>' +
      '<h3 class="set-h">What to do</h3><div class="st-grid">' +
      '<label class="lbl" for="bc-act">Change</label><select id="bc-act" class="field">' +
        opt('day', 'Move to another weekday (same week)', true) + opt('shift', 'Move by a number of days', false) + opt('track', 'Change the subject', false) + opt('slot', 'Change the slot', false) + opt('min', 'Change the planned minutes', false) + opt('del', 'Delete them', false) + '</select>' +
      '<label class="lbl bc-o" data-o="day" for="bc-day">To</label><select id="bc-day" class="field bc-o" data-o="day">' + days.map(d => opt(d, U.DAYS[d], d === 4)).join('') + '</select>' +
      '<label class="lbl bc-o" data-o="shift" for="bc-n">Days</label><input id="bc-n" class="field num bc-o" data-o="shift" type="number" value="7" step="1" title="Negative = earlier">' +
      '<label class="lbl bc-o" data-o="track" for="bc-ntr">New subject</label><select id="bc-ntr" class="field bc-o" data-o="track">' + trOpts((p.tracks[0] || {}).id, false) + '</select>' +
      '<label class="lbl bc-o" data-o="slot" for="bc-nsl">New slot</label><select id="bc-nsl" class="field bc-o" data-o="slot">' + slOpts((slots[0] || {}).no, false) + '</select>' +
      '<label class="lbl bc-o" data-o="min" for="bc-min">Minutes</label><input id="bc-min" class="field num bc-o" data-o="min" type="number" min="5" max="600" step="5" value="60">' +
      '</div><p class="hint" id="bc-msg"></p></form>';
    ED.ui.modal({ title: 'Change many sessions', cls: 'st-modal wide', body, footer: '<button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="apply">Apply</button>', onMount(el, api) {
      const $ = id => el.querySelector('#bc-' + id);
      const pick = () => {
        const tr = $('tr').value, sl = $('sl').value, from = $('from').value, to = $('to').value, inc = $('done').checked;
        const dd = new Set(U.$$('[data-day]', el).filter(x => x.checked).map(x => +x.dataset.day));
        return ST.sessions().filter(s => (!tr || s.trackId === tr) && (!sl || String(s.slotNo || 1) === sl) && dd.has(U.dow(s.date)) &&
          (!U.isKey(from) || s.date >= from) && (!U.isKey(to) || s.date <= to) && (inc || !s.done));
      };
      const show = () => {
        const act = $('act').value;
        U.$$('.bc-o', el).forEach(x => { x.hidden = x.dataset.o !== act; });
        const list = pick();
        $('msg').innerHTML = list.length ? '<b>' + U.plural(list.length, 'session') + '</b> will change' + (list.length ? ' (' + e(U.fmtShort(list[0].date)) + ' – ' + e(U.fmtShort(list[list.length - 1].date)) + ')' : '') + '.' + (act === 'del' ? ' They are deleted — you can undo right after.' : '') + (!$('done').checked ? ' Ticked sessions are left as they are.' : '')
          : 'No sessions match.';
      };
      el.addEventListener('input', show); el.addEventListener('change', show); show();
      el.addEventListener('click', async ev => {
        if (!ev.target.closest('[data-x="apply"]')) return;
        const list = pick(), act = $('act').value;
        if (!list.length) { ED.ui.toast('No sessions match'); return; }
        if (act === 'del' && list.some(s => s.done) && !(await ED.ui.confirm({ title: 'Delete sessions', message: U.plural(list.filter(s => s.done).length, 'ticked session') + ' will be deleted too.', ok: 'Delete', danger: true }))) return;
        ED.store.checkpoint('Change sessions');
        const now = Date.now(), ids = new Set(list.map(s => s.id));
        const reWeek = s => { const w = ST.weekOf(s.date); if (w) s.week = w.n; };
        if (act === 'del') D().study.sessions = ST.sessions().filter(s => !ids.has(s.id));
        else list.forEach(s => {
          if (act === 'day') { const d = +$('day').value; s.date = U.addDays(U.startOfWeek(s.date, 1), (d + 6) % 7); reWeek(s); }
          else if (act === 'shift') { s.date = U.addDays(s.date, Math.round(+$('n').value || 0)); reWeek(s); }
          else if (act === 'track') { s.trackId = $('ntr').value; }
          else if (act === 'slot') { s.slotNo = +$('nsl').value; s.slot = ST.slotText(s.slotNo, s.kind); s.time = null; }
          else if (act === 'min') { s.min = Math.max(5, Math.min(600, Math.round(+$('min').value || 60))); }
          s.updatedAt = now;
        });
        if (act === 'day' || act === 'shift') { if (ST.extendWeeks) ST.extendWeeks(); list.forEach(reWeek); }
        D().study.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.slotNo || 9) - (b.slotNo || 9));
        p.updatedAt = now;
        ED.store.commit(); api.close();
        ED.ui.undoToast((act === 'del' ? 'Deleted ' : 'Changed ') + U.plural(list.length, 'session'));
      });
    } });
  };

  const A = (ED.actions = ED.actions || {});
  A['study-toggle'] =el => ST.toggle(el.dataset.sid || el.closest('[data-sid]').dataset.sid);
  A['study-open'] = (el, ev) => { if (ev && ev.target.closest('[data-act="study-toggle"]') && ev.target.closest('[data-act="study-toggle"]') !== el) return; ST.editSession(el.dataset.sid || el.closest('[data-sid]').dataset.sid); };
  A['study-add'] = el => ST.editSession(null, { date: el.dataset.date || ST.focusDay() });
  A['study-log'] = el => { const k = el.dataset.date || U.today(); ST.editSession(null, { date: k, done: true, doneOn: k }); };
  A['study-bulk'] = () => ST.bulkAdd();
  A['study-import'] = () => ST.importFile();
  A['study-export'] = () => ST.exportCSV();
  A['study-plan'] = () => ST.editPlan();
  A['study-new'] = () => ST.newPlan();
  A['study-theme'] = el => ST.editTheme(+el.dataset.week, el.dataset.track);
  A['study-weeknote'] = el => ST.editWeekNote(+el.dataset.week);
  A['study-src'] = el => ST.editSource(el.dataset.id || null, { kind: el.dataset.kind, trackId: el.dataset.track });
  A['study-item'] = el => ST.editItem(el.dataset.id || null, { kind: el.dataset.kind });
  A['study-cat'] = el => ST.editCat(el.dataset.id || null);
  A['study-topic-add'] = el => ST.addTopic(el.dataset.track);
  A['study-topic-del'] = el => { const p = ST.plan(); if (!p) return; ED.store.checkpoint('Topic'); p.topics = p.topics.filter(t => t.id !== el.dataset.id); ED.store.commit(); ED.ui.undoToast('Topic removed'); };
  A['study-day'] = el => { const st = ED.state.study || (ED.state.study = {}); st.day = el.dataset.date; if (el.dataset.go) ED.go.tab(el.dataset.go); else ED.app.render(); };
  A['study-menu'] = el => {
    const p = ST.plan();
    const items = [
      { label: 'Import plan from Excel or CSV…', icon: 'upload', onClick: () => ST.importFile() },
      { label: 'Make a new plan…', icon: 'plus', onClick: () => ST.newPlan() },
    ];
    const sh = ST.shelf();
    if (sh.length) {
      items.push({ sep: true });
      sh.slice().reverse().slice(0, 5).forEach(x => items.push({ label: 'Switch to “' + x.plan.title + '”', icon: 'forward', onClick: () => ST.switchTo(x.id) }));
    }
    if (p || sh.length) items.push({ label: 'My plans (' + (sh.length + (p ? 1 : 0)) + ')…', icon: 'list', onClick: () => ST.myPlans() });
    if (p) items.push({ sep: true },
      { label: 'Add to the schedule (slots, subjects, days)…', icon: 'calendar', onClick: () => ST.bulkAdd() },
      { label: 'Log study time…', icon: 'clock', onClick: () => A['study-log']({ dataset: {} }) },
      { label: 'Change many sessions (move, change, delete)…', icon: 'pencil', onClick: () => ST.bulkChange() },
      { label: 'Change the start date…', icon: 'calendar', onClick: () => ST.editStart() },
      { label: 'Plan settings: slots, times, subjects…', icon: 'gear', onClick: () => ST.editPlan() },
      { label: 'Number of weeks: add or remove…', icon: 'calendar', onClick: () => ST.editWeeks() },
      { label: 'Add a book or lecture…', icon: 'book', onClick: () => ST.editSource(null) },
      { sep: true },
      { label: 'Export progress (.csv for Excel)', icon: 'download', onClick: () => ST.exportCSV() });
    ED.ui.menu(el, items, { placement: 'right-align' });
  };
})();
