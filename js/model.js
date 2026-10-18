/* E-Diary — domain logic: tasks, repeat rules, priorities, roles, goals, values, stats */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util;
  const M = (ED.model = {});
  const D = () => ED.store.data;
  const S = () => ED.store.data.settings;

  /* ---------------- constants ---------------- */
  M.PRIOS = ['A', 'B', 'C', 'D'];
  M.PRIO_HELP = { A: 'Vital — must do', B: 'Important — should do', C: 'Nice to do', D: 'Delegate / someday' };
  M.STATUSES = [
    { id: 'open', label: 'Normal' },
    { id: 'progress', label: 'In Progress' },
    { id: 'done', label: 'Completed' },
    { id: 'forwarded', label: 'Forwarded' },
    { id: 'delegated', label: 'Delegated' },
    { id: 'cancelled', label: 'Cancelled' },
  ];
  M.statusLabel = id => (M.STATUSES.find(s => s.id === id) || M.STATUSES[0]).label;
  M.isPending = st => st === 'open' || st === 'progress' || !st;
  M.isClosed = st => st === 'done' || st === 'delegated';
  M.counts = st => st !== 'cancelled' && st !== 'forwarded';

  M.REPEATS = [
    { id: '', label: 'None' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekdays', label: 'Weekdays (Mon–Fri)' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];
  M.repeatBadge = r => !r ? '' : ({ daily: 'D', weekdays: 'W', weekly: 'W', monthly: 'M', yearly: 'Y' })[r.freq] || 'R';
  M.repeatText = r => {
    if (!r) return 'Does not repeat';
    const iv = Math.max(1, r.interval || 1);
    const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq];
    let s;
    if (r.freq === 'weekdays') s = 'Every weekday';
    else s = iv === 1 ? 'Every ' + unit : 'Every ' + iv + ' ' + unit + 's';
    if (r.freq === 'weekly' && r.days && r.days.length) s += ' on ' + r.days.slice().sort((a, b) => a - b).map(d => U.DAY3[d]).join(', ');
    if (r.until) s += ' until ' + U.fmtShort(r.until);
    return s;
  };

  M.EVENT_COLORS = ['#1f6fe0', '#7b4bd6', '#d93025', '#ef6c00', '#2e7d32', '#00897b', '#c2185b', '#8a8f97'];
  M.SWATCHES = ['#b3261e', '#d9542b', '#ef6c00', '#8a6d00', '#2e7d32', '#00838f', '#1f6fe0', '#3949ab', '#7b3fb8', '#c2185b', '#3c4a54', '#8a8f97'];
  M.EMOJI = ['🐸', '📌', '💼', '🏠', '🏡', '💪', '📚', '🎓', '👪', '💰', '🌱', '🛒', '🙏', '🕉️', '✝️', '☪️', '🧘', '🏃', '🚴', '🍎', '💊', '❤️', '⭐', '🎯', '🧭', '🔬', '🛰️', '✈️', '🚗', '📝', '📖', '🎵', '🎨', '💡', '🛠️', '🧾', '📞', '🤝', '🎉', '🌧️'];

  /* ---------------- lookups ---------------- */
  M.find = (coll, id) => (id ? D()[coll].find(x => x.id === id) || null : null);
  M.task = id => M.find('tasks', id);
  M.role = id => M.find('roles', id);
  M.goal = id => M.find('goals', id);
  M.value = id => M.find('values', id);
  M.category = id => M.find('categories', id);
  M.event = id => M.find('events', id);
  M.note = id => M.find('notes', id);
  M.notebook = id => M.find('notebooks', id);
  M.rolesSorted = () => D().roles.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  M.valuesSorted = () => D().values.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  M.catColor = t => { const c = M.category(t.categoryId); return c ? c.color : ''; };

  /* ---------------- repeat rules ---------------- */
  M.occurs = (anchor, r, k, ex) => {
    if (!anchor) return false;
    if (!r || !r.freq) return anchor === k;
    if (k < anchor) return false;
    if (r.until && k > r.until) return false;
    if (ex && ex.length && ex.indexOf(k) >= 0) return false;
    const iv = Math.max(1, (r.interval | 0) || 1);
    switch (r.freq) {
      case 'daily': return iv === 1 || U.diffDays(anchor, k) % iv === 0;
      case 'weekdays': { const d = U.dow(k); return d > 0 && d < 6; }
      case 'weekly': {
        const days = r.days && r.days.length ? r.days : [U.dow(anchor)];
        if (days.indexOf(U.dow(k)) < 0) return false;
        if (iv === 1) return true;
        return Math.floor(U.diffDays(U.startOfWeek(anchor, 0), U.startOfWeek(k, 0)) / 7) % iv === 0;
      }
      case 'monthly': {
        const a = U.ymd(anchor), b = U.ymd(k);
        if (((b[0] - a[0]) * 12 + (b[1] - a[1])) % iv !== 0) return false;
        return b[2] === Math.min(a[2], U.daysInMonth(b[0], b[1] - 1));
      }
      case 'yearly': {
        const a = U.ymd(anchor), b = U.ymd(k);
        if ((b[0] - a[0]) % iv !== 0 || b[1] !== a[1]) return false;
        return b[2] === Math.min(a[2], U.daysInMonth(b[0], b[1] - 1));
      }
    }
    return false;
  };

  /* ---------------- task basics ---------------- */
  M.newTask = o => Object.assign({
    id: U.uid('t'), title: '', prio: S().defaultPrio || 'B', num: 0, status: 'open',
    date: null, time: null, dur: 30, allDay: false, startDate: null,
    roleId: null, categoryId: null, goalId: null, parentId: null, eventId: null, showSub: 'none',
    notes: '', checklist: [], repeat: null, occ: {}, exdates: [],
    alarm: false, alarmBefore: 0, delegatedTo: '',
    createdAt: Date.now(), updatedAt: Date.now(),
  }, o || {});

  M.statusOf = (t, k) => t.repeat ? ((t.occ && t.occ[k] && t.occ[k].st) || 'open') : (t.status || 'open');

  M.setStatus = (t, k, st) => {
    const now = Date.now();
    if (t.repeat) {
      t.occ = t.occ || {};
      if (st === 'open') delete t.occ[k]; else t.occ[k] = { st, at: now };
    } else {
      t.status = st;
      t.doneAt = M.isClosed(st) ? now : null;
    }
    t.updatedAt = now;
  };

  /* occurrence = one task on one day */
  M.occ = (t, k, carried) => ({ t, k, st: M.statusOf(t, k), carried: !!carried, oid: t.repeat ? t.id + '@' + k : t.id });

  /* index rebuilt whenever the store version changes */
  let idxVer = -1, idx = null;
  M.idx = () => {
    if (idx && idxVer === ED.store.version) return idx;
    idx = { byDate: new Map(), rep: [], pending: [], master: [], plan: [], children: new Map() };
    D().tasks.forEach(t => {
      if (t.parentId) { if (!idx.children.has(t.parentId)) idx.children.set(t.parentId, []); idx.children.get(t.parentId).push(t); }
      if (!t.date) { if (t.lvl || t.schedTo) idx.plan.push(t); else idx.master.push(t); return; }   // year/week items and scheduled ones: js/horizons.js
      if (t.repeat && t.repeat.freq) { idx.rep.push(t); return; }
      if (!idx.byDate.has(t.date)) idx.byDate.set(t.date, []);
      idx.byDate.get(t.date).push(t);
      if (M.isPending(t.status)) idx.pending.push(t);
    });
    idxVer = ED.store.version;
    return idx;
  };

  M.tasksOn = (k, opts) => {
    opts = opts || {};
    const I = M.idx(), out = [];
    (I.byDate.get(k) || []).forEach(t => out.push(M.occ(t, k)));
    I.rep.forEach(t => { if (M.occurs(t.date, t.repeat, k, t.exdates)) out.push(M.occ(t, k)); });
    const carry = opts.carry !== false && S().carryForward && k === U.today();
    if (carry) {
      const oldest = S().carryDays ? U.addDays(k, -S().carryDays) : '0000-00-00';
      I.pending.forEach(t => { if (t.date < k && t.date >= oldest) out.push(M.occ(t, k, true)); });
    }
    return out;
  };

  M.masterTasks = () => M.idx().master.slice();
  M.children = id => (M.idx().children.get(id) || []).slice();

  const PR = { A: 0, B: 1, C: 2, D: 3 };
  M.cmpTask = (x, y) =>
    (PR[x.prio] != null ? PR[x.prio] : 9) - (PR[y.prio] != null ? PR[y.prio] : 9) ||
    (x.num || 99) - (y.num || 99) ||
    String(x.time || '99').localeCompare(String(y.time || '99')) ||
    String(x.title).localeCompare(String(y.title));
  M.sortOccs = list => list.sort((a, b) => M.cmpTask(a.t, b.t));
  M.code = t => (t.prio || 'B') + (t.num ? t.num : '');

  M.groupByRole = occs => {
    const groups = M.rolesSorted().map(r => ({ key: r.id, role: r, items: [] }));
    const byId = new Map(groups.map(g => [g.key, g]));
    const other = { key: 'none', role: null, items: [] };
    occs.forEach(o => (byId.get(o.t.roleId) || other).items.push(o));
    const out = groups.filter(g => g.items.length);
    if (other.items.length) out.push(other);
    out.forEach(g => M.sortOccs(g.items));
    return out;
  };
  M.groupByCategory = occs => {
    const cats = D().categories;
    const groups = cats.map(c => ({ key: c.id, cat: c, items: [] }));
    const byId = new Map(groups.map(g => [g.key, g]));
    const other = { key: 'none', cat: null, items: [] };
    occs.forEach(o => (byId.get(o.t.categoryId) || other).items.push(o));
    const out = groups.filter(g => g.items.length);
    if (other.items.length) out.push(other);
    out.forEach(g => M.sortOccs(g.items));
    return out;
  };

  /* ---------------- priority numbers ---------------- */
  M.nextNum = (prio, dateKey, exceptId) => {
    let max = 0;
    const list = dateKey ? M.tasksOn(dateKey, { carry: false }).map(o => o.t) : M.masterTasks();
    list.forEach(t => { if (t.id !== exceptId && t.prio === prio && (t.num || 0) > max) max = t.num; });
    return max + 1;
  };
  M.renumberDay = dateKey => {
    const list = dateKey ? M.tasksOn(dateKey, { carry: false }).map(o => o.t) : M.masterTasks();
    M.PRIOS.forEach(p => {
      list.filter(t => t.prio === p).sort(M.cmpTask).forEach((t, i) => { t.num = i + 1; });
    });
  };

  /* "A1 Call the bank at 5pm" → {prio:'A', num:1, title:'Call the bank', time:'17:00'} */
  M.parseQuick = str => {
    let s = String(str || '').trim(), prio = null, num = null, time = null;
    let m = s.match(/^([ABCD])(\d{1,2})\s+(.+)$/i) || s.match(/^([ABCD])[:.)]\s*(.+)$/i);
    if (m) {
      prio = m[1].toUpperCase();
      if (m.length === 4) { num = +m[2]; s = m[3].trim(); } else { s = m[2].trim(); }
    }
    const tm = s.match(/\s(@|at)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (tm && (tm[1] === '@' || tm[3] || tm[4])) {
      let h = +tm[2]; const mi = +(tm[3] || 0); const ap = (tm[4] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (h < 24 && mi < 60) { time = U.pad(h) + ':' + U.pad(mi); s = s.slice(0, tm.index).trim(); }
    }
    return { title: s, prio, num, time };
  };

  /* ---------------- task changes ---------------- */
  M.addTask = fields => {
    const t = M.newTask(fields);
    if (!t.num) t.num = M.nextNum(t.prio, t.date);
    if (t.repeat && !t.date) t.date = U.today();
    D().tasks.push(t);
    return t;
  };

  M.cloneTask = (t, patch) => {
    const c = U.clone(t);
    c.id = U.uid('t');
    c.createdAt = c.updatedAt = Date.now();
    delete c.sample;
    return Object.assign(c, patch || {});
  };

  /* take one day out of a repeating series as its own task */
  M.detach = (t, k, toKey) => {
    const st = M.statusOf(t, k);
    const c = M.cloneTask(t, { date: toKey || k, repeat: null, occ: {}, exdates: [], status: st, seriesId: t.id, checklist: (t.checklist || []).map(i => Object.assign({}, i)) });
    M.skipOccurrence(t, k);
    D().tasks.push(c);
    return c;
  };
  M.skipOccurrence = (t, k) => {
    t.exdates = (t.exdates || []).concat(k);
    if (t.occ) delete t.occ[k];
    t.updatedAt = Date.now();
  };

  /* move to another day (or to the master list when toKey is null).
     time: undefined = keep, null = no time, 'HH:MM' = at that time.  allDay: true puts it in the all-day strip. */
  M.moveOcc = (o, toKey, time, allDay) => {
    let t = o.t;
    if (t.repeat) {
      if (!toKey) return null;
      t = M.detach(t, o.k, toKey);
    } else {
      if (t.date && toKey !== t.date) t.fwdFrom = t.fwdFrom || t.date;
      t.date = toKey;
      if (!toKey) { t.time = null; t.fwdFrom = null; t.allDay = false; }
    }
    if (time !== undefined) t.time = time;
    if (allDay === true) { t.allDay = true; t.time = null; }
    else if (t.time) t.allDay = false;
    if (t.status === 'forwarded') t.status = 'open';
    t.num = M.nextNum(t.prio, t.date, t.id);
    t.updatedAt = Date.now();
    return t;
  };

  /* status change from a list; a carried task is pulled onto today first */
  M.setOccStatus = (o, st) => {
    if (o.carried && !o.t.repeat) {
      o.t.fwdFrom = o.t.fwdFrom || o.t.date;
      o.t.date = o.k;
    }
    M.setStatus(o.t, o.k, st);
  };

  M.deleteTask = id => {
    const d = D();
    d.tasks.forEach(t => { if (t.parentId === id) t.parentId = null; });
    d.tasks = d.tasks.filter(t => t.id !== id);
  };

  M.forwardUnfinished = (fromKey, toKey) => {
    let n = 0;
    M.tasksOn(fromKey, { carry: false }).forEach(o => {
      if (!M.isPending(o.st) || o.t.repeat) return;
      M.moveOcc(o, toKey);
      n++;
    });
    return n;
  };

  /* ---------------- events ---------------- */
  M.newEvent = o => Object.assign({
    id: U.uid('e'), title: '', date: U.today(), allDay: false, start: '09:00', end: '10:00',
    color: M.EVENT_COLORS[0], repeat: null, exdates: [], location: '', notes: '', reminder: null,
  }, o || {});
  /* move one event (or one day of a repeating event) — patch: {date, start, end, allDay} */
  M.moveEvent = (ev, k, patch) => {
    let x = ev;
    if (ev.repeat) {
      x = Object.assign(U.clone(ev), { id: U.uid('e'), repeat: null, exdates: [], seriesId: ev.id });
      delete x.sample; delete x.gcal;
      ev.exdates = (ev.exdates || []).concat(k);
      D().events.push(x);
    }
    const len = x.allDay ? 60 : Math.max(15, (x.end ? U.toMin(x.end) : U.toMin(x.start) + 60) - U.toMin(x.start));
    if (patch.date) x.date = patch.date;
    if (patch.allDay === true) { x.allDay = true; x.start = null; x.end = null; }
    else if (patch.start) {
      x.allDay = false; x.start = patch.start;
      x.end = patch.end || U.fromMin(Math.min(24 * 60 - 1, U.toMin(patch.start) + (patch.len || len)));
    } else if (patch.end) x.end = patch.end;
    x.updatedAt = Date.now();
    return x;
  };
  M.eventsOn = k => D().events
    .filter(ev => M.occurs(ev.date, ev.repeat, k, ev.exdates))
    .sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || String(a.start || '').localeCompare(String(b.start || '')));

  /* ---------------- roles ---------------- */
  M.roleWeek = (roleId, weekStart) => {
    let total = 0, done = 0;
    const pending = [];
    for (let i = 0; i < 7; i++) {
      const k = U.addDays(weekStart, i);
      M.tasksOn(k, { carry: false }).forEach(o => {
        if (o.t.roleId !== roleId || !M.counts(o.st)) return;
        total++;
        if (M.isClosed(o.st)) done++; else pending.push(o);
      });
    }
    const today = U.today();
    pending.sort((a, b) => ((a.k >= today ? 0 : 1) - (b.k >= today ? 0 : 1)) || a.k.localeCompare(b.k) || M.cmpTask(a.t, b.t));
    return { total, done, pct: total ? Math.round(done / total * 100) : 0, next: pending[0] || null, pending: pending.length };
  };

  /* ---------------- goals ---------------- */
  M.goalTasks = gid => D().tasks.filter(t => t.goalId === gid && !t.schedTo);   // a scheduled plan item counts once, as its scheduled copy
  M.goalStats = gid => {
    let total = 0, done = 0;
    const today = U.today();
    M.goalTasks(gid).forEach(t => {
      if (t.repeat && t.date) {
        const end = t.repeat.until && t.repeat.until < today ? t.repeat.until : today;
        let k = t.date, n = 0;
        while (k <= end && n < 1500) {
          if (M.occurs(t.date, t.repeat, k, t.exdates)) {
            const st = M.statusOf(t, k);
            if (M.counts(st)) { total++; if (M.isClosed(st)) done++; }
          }
          k = U.addDays(k, 1); n++;
        }
      } else {
        const st = t.status || 'open';
        if (M.counts(st)) { total++; if (M.isClosed(st)) done++; }
      }
    });
    return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
  };
  M.activeGoals = () => D().goals.filter(g => !g.done).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
  M.achievements = () => D().goals.filter(g => g.done).sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')));
  M.goalDays = g => {
    const start = g.startDate || (g.createdAt ? U.key(new Date(g.createdAt)) : null);
    if (!start || !g.doneAt) return 0;
    return Math.max(0, U.diffDays(start, g.doneAt));
  };

  /* ---------------- values ---------------- */
  M.valueStats = vid => {
    const gs = D().goals.filter(g => g.valueId === vid);
    const done = gs.filter(g => g.done).length;
    return { total: gs.length, done, pct: gs.length ? Math.round(done / gs.length * 100) : 0 };
  };

  /* ---------------- journal & graph stats ---------------- */
  M.hasNote = k => { const h = D().dayNotes[k]; return !!(h && U.stripHtml(h).trim()); };
  M.diaryStreak = () => {
    let k = U.today(), n = 0;
    if (!M.hasNote(k)) k = U.addDays(k, -1);
    while (M.hasNote(k) && n < 3650) { n++; k = U.addDays(k, -1); }
    return n;
  };
  M.weeklyStats = weeks => {
    const ws = S().weekStart, today = U.today();
    const cur = U.startOfWeek(today, ws);
    const out = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const s = U.addDays(cur, -7 * w);
      let total = 0, done = 0;
      for (let i = 0; i < 7; i++) {
        const k = U.addDays(s, i);
        if (k > today) break;
        M.tasksOn(k, { carry: false }).forEach(o => { if (!M.counts(o.st)) return; total++; if (M.isClosed(o.st)) done++; });
      }
      out.push({ start: s, total, done, pct: total ? Math.round(done / total * 100) : 0 });
    }
    return out;
  };
  M.monthStats = monthKey => {
    const [y, m] = U.ymd(monthKey);
    const days = U.daysInMonth(y, m - 1), today = U.today();
    let total = 0, done = 0, notes = 0;
    for (let i = 1; i <= days; i++) {
      const k = y + '-' + U.pad(m) + '-' + U.pad(i);
      if (k > today) break;
      M.tasksOn(k, { carry: false }).forEach(o => { if (!M.counts(o.st)) return; total++; if (M.isClosed(o.st)) done++; });
      if (M.hasNote(k)) notes++;
    }
    return { total, done, notes };
  };

  /* progress analysis over a date range: how many planned tasks were done, by role, priority, category, weekday */
  M.periodStats = (from, to) => {
    const today = U.today();
    const out = { total: 0, done: 0, byRole: new Map(), byPrio: new Map(), byCat: new Map(), byDow: [0, 1, 2, 3, 4, 5, 6].map(() => ({ total: 0, done: 0 })), status: { done: 0, delegated: 0, open: 0, forwarded: 0, cancelled: 0 } };
    const bump = (m, key, closed) => { const x = m.get(key) || { total: 0, done: 0 }; x.total++; if (closed) x.done++; m.set(key, x); };
    for (let k = from; k <= to && k <= today; k = U.addDays(k, 1)) {
      M.tasksOn(k, { carry: false }).forEach(o => {
        const st = o.st || 'open';
        out.status[M.isPending(st) ? 'open' : st] = (out.status[M.isPending(st) ? 'open' : st] || 0) + 1;
        if (!M.counts(st)) return;
        const closed = M.isClosed(st);
        out.total++; if (closed) out.done++;
        bump(out.byRole, o.t.roleId || 'none', closed);
        bump(out.byPrio, o.t.prio || 'B', closed);
        bump(out.byCat, o.t.categoryId || 'none', closed);
        const d = out.byDow[U.dow(k)]; d.total++; if (closed) d.done++;
      });
    }
    return out;
  };

  /* ---------------- search ---------------- */
  M.search = q => {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const has = s => s && String(s).toLowerCase().indexOf(q) >= 0;
    const out = [];
    const d = D();
    d.tasks.forEach(t => { if (has(t.title) || has(U.stripHtml(t.notes)) || has(t.delegatedTo) || (t.checklist || []).some(c => has(c.text))) out.push({ type: 'task', item: t }); });
    d.events.forEach(e => { if (has(e.title) || has(e.location) || has(e.notes)) out.push({ type: 'event', item: e }); });
    d.goals.forEach(g => { if (has(g.title) || has(g.desc)) out.push({ type: 'goal', item: g }); });
    d.roles.forEach(r => { if (has(r.name) || has(r.desc)) out.push({ type: 'role', item: r }); });
    d.values.forEach(v => { if (has(v.title) || has(v.desc)) out.push({ type: 'value', item: v }); });
    d.notes.forEach(n => { if (has(n.title) || has(U.stripHtml(n.html))) out.push({ type: 'note', item: n }); });
    Object.keys(d.dayNotes).sort().reverse().forEach(k => {
      const txt = U.stripHtml(d.dayNotes[k]);
      if (has(txt)) out.push({ type: 'day', item: { k, text: txt } });
    });
    if (has(U.stripHtml(d.mission.html))) out.push({ type: 'mission', item: {} });
    if (d.study) d.study.sessions.forEach(s => { if (has(s.topic) || has(s.source) || has(s.note)) out.push({ type: 'study', item: s }); });
    if (d.finance) d.finance.records.forEach(r => { if (has(r.desc) || has(r.notes)) out.push({ type: 'money', item: r }); });
    (d.sites || []).forEach(x => { if (has(x.name) || has(x.url) || has(x.notes)) out.push({ type: 'site', item: x }); });
    if (d.finance && d.finance.plan) (d.finance.plan.goals || []).forEach(g => { if (has(g.name) || has(g.notes)) out.push({ type: 'plangoal', item: g }); });
    if (d.habits) (d.habits.list || []).forEach(h => { if (has(h.name) || has(h.notes)) out.push({ type: 'habit', item: h }); });
    if (d.interview) {
      (d.interview.list || []).forEach(x => { if (has(x.role) || has(x.org) || has(x.notes) || has(x.ref)) out.push({ type: 'interview', item: x }); });
      (d.interview.qs || []).forEach(x => { if (has(x.q) || has(x.a)) out.push({ type: 'ivq', item: x }); });
    }
    if (d.health) {
      (d.health.meds || []).forEach(x => { if (has(x.name) || has(x.purpose) || has(x.notes)) out.push({ type: 'med', item: x }); });
      (d.health.treats || []).forEach(x => { if (has(x.name) || has(x.doctor) || has(x.notes)) out.push({ type: 'treat', item: x }); });
      (d.health.visits || []).forEach(x => { if (has(x.doctor) || has(x.purpose) || has(x.outcome) || has(x.place)) out.push({ type: 'visit', item: x }); });
    }
    if (d.meetings) Object.keys(d.meetings.notes || {}).forEach(key => { const n = d.meetings.notes[key]; if (has(n.title) || has(n.agenda) || has(n.notes) || has(n.decisions) || (n.actions || []).some(a => has(a.text))) out.push({ type: 'mnote', item: Object.assign({ key }, n) }); });
    if (d.study && d.study.plan) ((d.study.plan.books || []).concat(d.study.plan.lectures || [], d.study.plan.items || [])).forEach(b => { if (has(b.title) || has(b.use) || has(b.by) || has(b.venue)) out.push({ type: 'book', item: b }); });
    return out.slice(0, 200);
  };

  /* ---------------- text export of one task (sharing) ---------------- */
  M.taskText = (t, k) => {
    const lines = [];
    lines.push('[' + M.code(t) + '] ' + t.title);
    const day = k || t.date;
    if (day) lines.push('Date: ' + U.fmtLong(day) + (t.time ? ' at ' + U.fmtTime(t.time, S().h12) : ''));
    if (t.repeat) lines.push('Repeats: ' + M.repeatText(t.repeat));
    const st = M.statusOf(t, day);
    if (st !== 'open') lines.push('Status: ' + M.statusLabel(st) + (st === 'delegated' && t.delegatedTo ? ' to ' + t.delegatedTo : ''));
    const g = M.goal(t.goalId); if (g) lines.push('Goal: ' + g.title);
    const r = M.role(t.roleId); if (r) lines.push('Role: ' + r.name);
    if (t.checklist && t.checklist.length) {
      lines.push('');
      t.checklist.forEach(c => lines.push((c.done ? '☑ ' : '☐ ') + c.text));
    }
    const notes = U.stripHtml(t.notes);
    if (notes) { lines.push(''); lines.push(notes); }
    return lines.join('\n');
  };

  /* ---------------- calendar file (.ics) ---------------- */
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const icsDate = k => k.replace(/-/g, '');
  const icsDT = (k, t) => icsDate(k) + 'T' + t.replace(':', '') + '00';
  const RR = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
  const rrule = r => {
    if (!r) return null;
    if (r.freq === 'weekdays') return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' + (r.until ? ';UNTIL=' + icsDate(r.until) : '');
    let s = 'RRULE:FREQ=' + RR[r.freq] + ';INTERVAL=' + Math.max(1, r.interval || 1);
    if (r.freq === 'weekly' && r.days && r.days.length) s += ';BYDAY=' + r.days.map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]).join(',');
    if (r.until) s += ';UNTIL=' + icsDate(r.until);
    return s;
  };
  M.ics = items => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//E-Diary//Planner//EN', 'CALSCALE:GREGORIAN'];
    items.forEach(it => {
      const date = it.date || U.today();
      L.push('BEGIN:VEVENT', 'UID:' + it.id + '@e-diary', 'DTSTAMP:' + stamp);
      if (it.start) {
        L.push('DTSTART:' + icsDT(date, it.start));
        L.push('DTEND:' + icsDT(date, it.end || U.fromMin(U.toMin(it.start) + (it.dur || 30))));
      } else {
        L.push('DTSTART;VALUE=DATE:' + icsDate(date), 'DTEND;VALUE=DATE:' + icsDate(U.addDays(date, 1)));
      }
      L.push('SUMMARY:' + icsEsc(it.title));
      if (it.desc) L.push('DESCRIPTION:' + icsEsc(it.desc));
      if (it.location) L.push('LOCATION:' + icsEsc(it.location));
      const rr = rrule(it.repeat); if (rr) L.push(rr);
      if (it.alarm != null && it.start) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(it.title), 'TRIGGER:-PT' + (it.alarm | 0) + 'M', 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  };
  M.taskIcs = t => M.ics([{ id: t.id, title: '[' + M.code(t) + '] ' + t.title, date: t.date, start: t.time, dur: t.dur, desc: M.taskText(t), repeat: t.repeat, alarm: t.alarm ? (t.alarmBefore || 0) : null }]);
  M.eventIcs = e => M.ics([{ id: e.id, title: e.title, date: e.date, start: e.allDay ? null : e.start, end: e.allDay ? null : e.end, desc: e.notes, location: e.location, repeat: e.repeat, alarm: e.reminder }]);
})();
