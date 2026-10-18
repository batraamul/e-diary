/* E-Diary — Planner → Weekly Tasks and Yearly Tasks: plan from the year down to the day.
   Year item  → schedule to a month → a task in the Monthly master list (planM = 'YYYY-MM')
   Month task → schedule to a week  → a week item (lvl 'week', planW = week start)
   Week item  → schedule to a day   → an ordinary dated task (Daily Tasks)
   The item that was scheduled stays where it was, greyed out, showing where it went and how its copy is doing:
     schedTo = { lvl: 'month'|'week'|'day', key, id (the copy) }; the copy has fromPlan = the item's id.
   Data: ordinary tasks with extra fields — lvl 'year' (planY) or 'week' (planW); the Monthly master list is unchanged
   apart from leaving out year/week items and scheduled tasks (model.js M.idx().plan holds those). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings, D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {}), F = (ED.forms = ED.forms || {});
  const HZ = (ED.horizons = {});
  const st = () => ED.state.hz || (ED.state.hz = {});
  const ws = () => S().weekStart || 0;
  const yearOf = () => st().y || U.today().slice(0, 4);
  const weekOf = () => U.startOfWeek(st().w || ED.state.date || U.today(), ws());
  const monName = key => U.MONTHS[+key.slice(5, 7) - 1] + ' ' + key.slice(0, 4);
  const STL = { open: 'to do', progress: 'in progress', done: 'done', delegated: 'delegated', cancelled: 'cancelled', forwarded: 'forwarded' };

  /* ---------------- links between levels ---------------- */
  HZ.child = t => (t && t.schedTo && M.task(t.schedTo.id)) || null;
  // how an item is doing: follows its scheduled copy all the way down
  HZ.eff = (t, n) => {
    const c = HZ.child(t);
    if (c && (n || 0) < 6) return HZ.eff(c, (n || 0) + 1);
    return t.date && t.repeat ? M.statusOf(t, t.date) : (t.status || 'open');
  };
  HZ.where = t => {
    const s = t.schedTo; if (!s) return '';
    return s.lvl === 'month' ? monName(s.key) : s.lvl === 'week' ? 'week of ' + U.fmtShort(s.key) : U.DAY3[U.dow(s.key)] + ' ' + U.fmtShort(s.key);
  };
  HZ.schedule = (t, lvl, key) => {
    const base = { title: t.title, prio: t.prio, roleId: t.roleId, categoryId: t.categoryId, goalId: t.goalId, notes: t.notes, checklist: U.clone(t.checklist || []), fromPlan: t.id, num: 0 };
    const c = M.addTask(Object.assign(base, lvl === 'month' ? { date: null, planM: key } : lvl === 'week' ? { date: null, lvl: 'week', planW: key } : { date: key, time: null }));
    t.schedTo = { lvl, key, id: c.id }; t.updatedAt = Date.now();
    return c;
  };
  const dropCopies = id => { const c = M.task(id); if (!c) return 0; let n = 1; if (c.schedTo) n += dropCopies(c.schedTo.id); D().tasks = D().tasks.filter(x => x.id !== id); return n; };
  HZ.unschedule = async t => {
    const c = HZ.child(t);
    if (c && M.isClosed(HZ.eff(c))) { const ok = await ED.ui.confirm({ title: 'Unschedule', message: 'Its copy (' + HZ.where(t) + ') is already done. Remove that copy and bring the item back here?', ok: 'Unschedule' }); if (!ok) return; }
    ED.store.checkpoint('Unschedule');
    if (c) dropCopies(c.id);
    delete t.schedTo; t.updatedAt = Date.now();
    ED.store.commit(); ED.ui.undoToast('Back on the list: ' + t.title);
  };
  // copies that were deleted elsewhere free their item again
  HZ.tidy = () => { let ch = false; M.idx().plan.forEach(t => { if (t.schedTo && !M.task(t.schedTo.id)) { delete t.schedTo; ch = true; } }); return ch; };

  /* ---------------- rows ---------------- */
  const tick = (t, dis) => { const s = HZ.eff(t), done = M.isClosed(s);
    return '<button type="button" class="hz-tick' + (done ? ' on' : '') + '" data-act="hz-done" data-tid="' + e(t.id) + '"' + (dis ? ' disabled title="Tick it where it is scheduled"' : '') + ' aria-pressed="' + done + '" aria-label="' + (done ? 'Done' : 'Mark done') + '">' + (done ? ED.icon('check') : '') + '</button>'; };
  const row = (t, sched) => {
    const s = t.schedTo, eff = HZ.eff(t);
    return '<li class="hz-row' + (s ? ' sched' : '') + (M.isClosed(eff) ? ' done' : '') + '">' + tick(t, !!s) +
      '<span class="hz-code num">' + e(M.code(t)) + '</span>' +
      '<button type="button" class="hz-title link-btn" data-act="hz-open" data-tid="' + e(t.id) + '">' + e(t.title) + '</button>' +
      (s ? '<span class="hz-to">' + ED.icon('forward') + 'Scheduled for <b>' + e(HZ.where(t)) + '</b> · ' + e(STL[eff] || eff) + '</span><button type="button" class="link-btn hint" data-act="hz-unsched" data-tid="' + e(t.id) + '">Unschedule</button>'
        : sched) + '</li>';
  };
  const sbtn = (t, lvl) => '<button type="button" class="btn small ghost" data-act="hz-sched" data-lvl="' + lvl + '" data-tid="' + e(t.id) + '">' + ED.icon('calendar') + (lvl === 'month' ? 'Schedule to a month' : lvl === 'week' ? 'Schedule to a week' : 'Schedule to a day') + '</button>';
  const sections = (list, lvl) => {
    const todo = list.filter(t => !t.schedTo && !M.isClosed(HZ.eff(t))), sch = list.filter(t => t.schedTo && !M.isClosed(HZ.eff(t))), done = list.filter(t => M.isClosed(HZ.eff(t)));
    const ul = (l, f) => '<ul class="hz-list">' + l.map(f).join('') + '</ul>';
    const by = (a, b) => M.cmpTask(a, b);
    return (todo.length ? '<h3 class="gh">To schedule <span class="hint num">· ' + todo.length + '</span></h3>' + ul(todo.sort(by), t => row(t, sbtn(t, lvl))) : '') +
      (sch.length ? '<h3 class="gh">Scheduled <span class="hint num">· ' + sch.length + '</span></h3>' + ul(sch.sort(by), t => row(t, '')) : '') +
      (done.length ? '<h3 class="gh">Done <span class="hint num">· ' + done.length + '</span></h3>' + ul(done.sort(by), t => row(t, t.schedTo ? '' : '')) : '');
  };
  const addForm = (lvl, ph) => '<form class="addtask" data-form="hz-add" data-lvl="' + lvl + '"><input class="addtask-in" type="text" placeholder="' + e(ph) + '" autocomplete="off" aria-label="' + e(ph) + '. Start with A1, B2… to set priority.">' +
    '<button type="submit" class="add-btn" aria-label="Add">' + ED.icon('plus') + '</button></form>';
  const head = (title, nav) => '<div class="pg-head"><h2 class="pg-title">' + title + '</h2></div><div class="wk-nav">' + nav + '</div>';

  /* ======================= Yearly Tasks ======================= */
  ED.views = ED.views || {};
  ED.views.yearly = {
    id: 'yearly', label: 'Yearly Tasks',
    left() {
      const y = yearOf(), list = M.idx().plan.filter(t => t.lvl === 'year' && t.planY === y);
      const nav = '<button type="button" class="icon-btn sm" data-act="hz-year" data-dir="-1" aria-label="Previous year">' + ED.icon('chevL') + '</button><span class="num">' + y + '</span>' +
        '<button type="button" class="icon-btn sm" data-act="hz-year" data-dir="1" aria-label="Next year">' + ED.icon('chevR') + '</button>' + (y !== U.today().slice(0, 4) ? '<button type="button" class="link-btn" data-act="hz-year" data-dir="0">This year</button>' : '');
      return '<div class="master hz">' + head('Yearly Tasks', nav) + addForm('year', 'Add a task for ' + y) +
        '<div class="master-scroll scroll" data-keep-scroll="hz-year">' + (list.length ? sections(list, 'month')
          : '<div class="empty">' + ED.icon('flag') + '<div><b>Nothing planned for ' + y + ' yet.</b><br>Add what you want to get done this year, then schedule each one to a month — it moves to Monthly Tasks and shows here as scheduled.</div></div>') +
        '</div><p class="hint master-hint">' + ED.icon('hand') + ' Year → month → week → day: each level hands a copy down and shows here how that copy is doing.</p></div>';
    },
    right() {
      const y = yearOf(), all = M.masterTasks().concat(M.idx().plan.filter(t => !t.lvl));
      const cards = U.MONTHS.map((m, i) => {
        const key = y + '-' + String(i + 1).padStart(2, '0');
        const l = all.filter(t => t.planM === key), d = l.filter(t => M.isClosed(HZ.eff(t))).length, cur = key === U.today().slice(0, 7);
        return '<button type="button" class="hz-mon' + (cur ? ' cur' : '') + '" data-act="hz-month" data-key="' + key + '"><b>' + e(m) + '</b><span class="hint num">' + (l.length ? d + '/' + l.length + ' done' : '—') + '</span>' +
          (l.length ? '<span class="hz-mon-l">' + l.slice(0, 4).map(t => '<i class="' + (M.isClosed(HZ.eff(t)) ? 'done' : '') + '">' + e(t.title) + '</i>').join('') + (l.length > 4 ? '<i class="hint">+' + (l.length - 4) + ' more</i>' : '') + '</span>' : '') + '</button>';
      }).join('');
      return '<div class="hz hz-r"><div class="pg-head"><h2 class="pg-title">Months of ' + y + '</h2></div><div class="st-scroll scroll" data-keep-scroll="hz-year-r"><div class="hz-months">' + cards + '</div>' +
        '<p class="hint">Tasks scheduled to a month appear in <b>Monthly Tasks</b> with the month noted; open a month to see them.</p></div></div>';
    },
    mount() { if (HZ.tidy()) ED.store.commit({ silent: true }); },
  };

  /* ======================= Weekly Tasks ======================= */
  ED.views.weekly = {
    id: 'weekly', label: 'Weekly Tasks',
    left() {
      const w = weekOf(), we = U.addDays(w, 6), list = M.idx().plan.filter(t => t.lvl === 'week' && t.planW === w);
      const nav = '<button type="button" class="icon-btn sm" data-act="hz-week" data-dir="-1" aria-label="Previous week">' + ED.icon('chevL') + '</button>' +
        '<span class="num">Week ' + U.weekNumber(w, ws()) + ': ' + e(U.fmtRange(w, we)) + ', ' + we.slice(0, 4) + '</span>' +
        '<button type="button" class="icon-btn sm" data-act="hz-week" data-dir="1" aria-label="Next week">' + ED.icon('chevR') + '</button>' + (w !== U.startOfWeek(U.today(), ws()) ? '<button type="button" class="link-btn" data-act="hz-week" data-dir="0">This week</button>' : '');
      const months = [w.slice(0, 7), we.slice(0, 7)];
      const pool = M.masterTasks().filter(t => !t.repeat && M.isPending(t.status || 'open')).sort((a, b) => (months.indexOf(b.planM) >= 0) - (months.indexOf(a.planM) >= 0) || M.cmpTask(a, b));
      const poolHtml = pool.length ? '<details class="hz-pool"' + (st().poolOpen !== false ? ' open' : '') + '><summary>From Monthly Tasks <span class="hint num">· ' + pool.length + '</span></summary><ul class="hz-list">' + pool.slice(0, 40).map(t =>
        '<li class="hz-row"><span class="hz-code num">' + e(M.code(t)) + '</span><button type="button" class="hz-title link-btn" data-act="hz-open" data-tid="' + e(t.id) + '">' + e(t.title) + '</button>' +
        (t.planM ? '<span class="chip">' + e(U.MON[+t.planM.slice(5, 7) - 1]) + '</span>' : '') +
        '<button type="button" class="btn small ghost" data-act="hz-toweek" data-tid="' + e(t.id) + '">' + ED.icon('plus') + 'This week</button></li>').join('') + '</ul></details>' : '';
      return '<div class="master hz">' + head('Weekly Tasks', nav) + addForm('week', 'Add a task for this week') +
        '<div class="master-scroll scroll" data-keep-scroll="hz-week">' + (list.length ? sections(list, 'day')
          : '<div class="empty">' + ED.icon('calendar') + '<div><b>Nothing planned for this week.</b><br>Add tasks here or bring them in from Monthly Tasks below, then schedule each to a day.</div></div>') + poolHtml +
        '</div></div>';
    },
    right() {
      const w = weekOf(), today = U.today();
      const days = Array.from({ length: 7 }, (x, i) => U.addDays(w, i)).map(k => {
        const occs = M.sortOccs(M.tasksOn(k, { carry: false })), d = occs.filter(o => M.isClosed(o.st)).length;
        return '<div class="hz-day' + (k === today ? ' cur' : '') + '"><button type="button" class="hz-dayh link-btn" data-act="study-day" data-date="' + k + '" data-go="daily"><b>' + U.DAY3[U.dow(k)] + '</b> <span class="num">' + e(U.fmtShort(k)) + '</span><span class="hint num">' + (occs.length ? d + '/' + occs.length : '') + '</span></button>' +
          (occs.length ? '<ul>' + occs.slice(0, 8).map(o => '<li class="' + (M.isClosed(o.st) ? 'done' : '') + '"><span class="num hint">' + e(M.code(o.t)) + '</span> ' + e(o.t.title) + (o.t.fromPlan ? ' <span class="hint" title="Scheduled from the weekly list">↓</span>' : '') + '</li>').join('') + (occs.length > 8 ? '<li class="hint">+' + (occs.length - 8) + ' more</li>' : '') + '</ul>' : '<p class="hint">—</p>') + '</div>';
      }).join('');
      return '<div class="hz hz-r"><div class="pg-head"><h2 class="pg-title">The week, day by day</h2></div><div class="st-scroll scroll" data-keep-scroll="hz-week-r"><div class="hz-days">' + days + '</div>' +
        '<p class="hint">Click a day to open it in Daily Tasks.</p></div></div>';
    },
    mount() { if (HZ.tidy()) ED.store.commit({ silent: true }); },
  };

  /* Monthly Tasks: master tasks scheduled on to a week, greyed out under the list */
  HZ.monthlyScheduled = () => {
    const l = M.idx().plan.filter(t => !t.lvl && t.schedTo && HZ.child(t)).sort((a, b) => M.isClosed(HZ.eff(a)) - M.isClosed(HZ.eff(b)) || M.cmpTask(a, b));
    if (!l.length) return '';
    return '<div class="hz-msched"><h3 class="gh">' + ED.icon('forward') + ' Scheduled to a week <span class="hint num">· ' + l.length + '</span></h3><ul class="hz-list">' + l.map(t => row(t, '')).join('') + '</ul></div>';
  };

  /* ---------------- actions ---------------- */
  F['hz-add'] = form => {
    const inp = form.querySelector('input'), text = inp.value.trim(), lvl = form.dataset.lvl;
    if (!text) { inp.focus(); return; }
    const p = M.parseQuick(text); if (!p.title) return;
    M.addTask(Object.assign({ title: p.title, prio: p.prio || S().defaultPrio, num: p.num || 0, date: null, lvl }, lvl === 'year' ? { planY: yearOf() } : { planW: weekOf() }));
    inp.value = ''; ED.store.commit();
    setTimeout(() => { const i = document.querySelector('[data-form="hz-add"] input'); if (i) i.focus(); }, 0);
  };
  A['hz-year'] = el => { const d = +el.dataset.dir; st().y = d ? String(+yearOf() + d) : null; ED.app.render(); };
  A['hz-week'] = el => { const d = +el.dataset.dir; st().w = d ? U.addDays(weekOf(), 7 * d) : null; ED.app.render(); };
  A['hz-month'] = el => { ED.state.mc = ED.state.mc || {}; ED.state.mc.m1 = el.dataset.key + '-01'; try { ED.calpanel.st('monthly').anchor = el.dataset.key + '-01'; } catch (err) { /* older calendar state */ } ED.go.tab('monthly'); };
  A['hz-done'] = el => {
    const t = M.task(el.dataset.tid); if (!t || t.schedTo) return;
    ED.store.checkpoint('Task');
    M.setStatus(t, t.date || '', M.isClosed(t.status) ? 'open' : 'done'); ED.store.commit();
  };
  A['hz-open'] = el => { const t = M.task(el.dataset.tid); if (t) ED.editors.task({ id: t.id, k: t.date || null }); };
  A['hz-unsched'] = el => { const t = M.task(el.dataset.tid); if (t) HZ.unschedule(t); };
  A['hz-toweek'] = el => {
    const t = M.task(el.dataset.tid); if (!t) return;
    ED.store.checkpoint('Schedule to a week'); HZ.schedule(t, 'week', weekOf()); ED.store.commit();
    ED.ui.toast('“' + t.title + '” is on this week’s list; in Monthly Tasks it shows as scheduled');
  };
  // from the Monthly master list (task menu): put a copy on a week's list; the task stays here, greyed out
  HZ.pickWeek = (anchor, t) => {
    const s0 = U.startOfWeek(U.today(), ws());
    ED.ui.menu(anchor, Array.from({ length: 6 }, (x, i) => U.addDays(s0, 7 * i)).map((k, i) => ({ label: (i === 0 ? 'This week' : i === 1 ? 'Next week' : 'Week of') + ' · ' + U.fmtRange(k, U.addDays(k, 6)), onClick: () => {
      ED.store.checkpoint('Schedule to a week'); HZ.schedule(t, 'week', k); ED.store.commit();
      ED.ui.toast('“' + t.title + '” scheduled to the week of ' + U.fmtShort(k) + ' — it shows here as scheduled', { action: 'Open Weekly', onAction: () => { st().w = k; ED.go.tab('weekly'); } });
    } })), { placement: 'right-align' });
  };
  A['hz-sched'] = el => {
    const t = M.task(el.dataset.tid); if (!t) return;
    const lvl = el.dataset.lvl, done = (c, msg) => { ED.store.checkpoint('Schedule'); HZ.schedule(t, lvl, c); ED.store.commit(); ED.ui.toast(msg); };
    let items;
    if (lvl === 'month') {
      const y = t.planY || yearOf(), now = U.today().slice(0, 7);
      items = U.MONTHS.map((m, i) => { const key = y + '-' + String(i + 1).padStart(2, '0'); return { label: m + ' ' + y + (key === now ? ' (this month)' : ''), disabled: key < now, onClick: () => done(key, 'Scheduled to ' + monName(key) + ' — it is now in Monthly Tasks') }; });
    } else if (lvl === 'week') {
      const s0 = U.startOfWeek(U.today(), ws());
      items = Array.from({ length: 8 }, (x, i) => U.addDays(s0, 7 * i)).map((k, i) => ({ label: (i === 0 ? 'This week' : i === 1 ? 'Next week' : 'Week of') + ' · ' + U.fmtRange(k, U.addDays(k, 6)), onClick: () => done(k, 'Scheduled to the week of ' + U.fmtShort(k) + ' — see Weekly Tasks') }));
    } else {
      const w = t.planW || weekOf(), today = U.today();
      items = Array.from({ length: 7 }, (x, i) => U.addDays(w, i)).map(k => ({ label: U.DAYS[U.dow(k)] + ', ' + U.fmtShort(k) + (k === today ? ' (today)' : ''), disabled: k < today, onClick: () => done(k, 'Scheduled for ' + U.fmtShort(k) + ' — it is now in Daily Tasks') }));
      items.push({ sep: true }, { label: 'Another date…', icon: 'calendar', onClick: async () => { const k = await ED.ui.prompt({ title: 'Schedule to a day', label: 'Date', type: 'date', value: today, ok: 'Schedule' }); if (k && U.isKey(k)) done(k, 'Scheduled for ' + U.fmtShort(k)); } });
    }
    ED.ui.menu(el, items, { placement: 'right-align' });
  };
})();
