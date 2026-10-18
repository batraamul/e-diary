/* E-Diary — Monthly Tasks (master list + calendars), Life Roles, Goals & Achievements */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings;
  const D = () => ED.store.data;
  ED.views = ED.views || {};

  const pageHead = (title, addLabel, addAct, extra) =>
    '<div class="pg-head"><h2 class="pg-title">' + title + '</h2>' + (extra || '') +
    (addAct ? '<div class="pg-add"><span>' + e(addLabel) + '</span><button type="button" class="add-btn" data-act="' + addAct + '" aria-label="' + e(addLabel) + '">' + ED.icon('plus') + '</button></div>' : '') + '</div>';

  const progress = (pct, done) =>
    '<div class="prog"><div class="bar' + (done ? ' done' : '') + '"><i style="width:' + pct + '%"></i></div><span class="prog-n num">' + pct + ' %</span></div>';

  /* ======================= Monthly Tasks ======================= */
  ED.views.monthly = {
    id: 'monthly', label: 'Monthly Tasks',
    left() {
      const list = M.masterTasks().map(t => ({ t, k: '', st: t.status || 'open', carried: false, oid: t.id }));
      M.sortOccs(list);
      const rows = ED.tasksUI.rows(list, list);
      const cp = ED.calpanel.st('monthly');
      const m1 = ED.state.mc.m1 || U.firstOfMonth(cp.anchor);
      const m2 = U.addMonths(U.firstOfMonth(m1), 1);
      const mode = ED.habits && ED.state.monthlyLeft === 'habits' ? 'habits' : 'master';
      const seg = ED.habits ? '<div class="seg ml-seg" role="group" aria-label="Left page">' + [['master', 'Master tasks'], ['habits', 'Habit tracker']].map(x => '<button type="button" data-act="monthly-left" data-k="' + x[0] + '" aria-pressed="' + (mode === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' : '';
      if (mode === 'habits') return '<div class="master hb-page">' + pageHead('Habit Tracker', '', '', seg) + '<div class="master-scroll scroll hb-scroll" data-keep-scroll="habits">' + ED.habits.tracker(ED.habits.monthShown()) + '</div></div>';
      return '<div class="master">' +
        pageHead('Master Tasks', '', '', seg) +
        '<form class="addtask" data-form="master-add"><input class="addtask-in" type="text" placeholder="Add Task" autocomplete="off" aria-label="Add a task without a date. Start with A1, B2… to set priority.">' +
        '<button type="button" class="add-btn" data-act="master-new" aria-label="New task with details">' + ED.icon('plus') + '</button></form>' +
        '<div class="master-scroll scroll" data-keep-scroll="master">' +
        (rows ? '<ul class="tlist" data-drop="master">' + rows + '</ul>' : '<div class="empty" data-drop="master">' + ED.icon('list') + '<div><b>No undated tasks.</b><br>Use this list for everything you want to do “some day”. Drag a task onto a date to schedule it.</div></div>') +
        (ED.horizons ? ED.horizons.monthlyScheduled() : '') +
        '</div>' +
        '<p class="hint master-hint">' + ED.icon('hand') + ' Drag a task onto a calendar day to schedule it; drag a dated task here to unschedule it.</p>' +
        (ED.habits ? ED.habits.strip(ED.habits.monthShown()) : '') +
        '<div class="two-cals">' + ED.minical.render('m1', m1, cp.anchor) + ED.minical.render('m2', m2, cp.anchor) + '</div>' +
        '</div>';
    },
    right() { return ED.calpanel.render('monthly'); },
    mount(left, right) { ED.calpanel.afterRender(right); if (ED.charts && ED.state.monthlyLeft === 'habits') ED.charts.bind(left); },
  };

  /* ======================= Life Roles ======================= */
  ED.views.roles = {
    id: 'roles', label: 'Roles',
    left() {
      const ws = S().weekStart;
      const wk = U.startOfWeek(ED.state.rolesWeek || ED.state.date, ws);
      const roles = M.rolesSorted();
      const focus = ED.calpanel.st('roles').filter;
      const cards = roles.map(r => {
        const st = M.roleWeek(r.id, wk);
        const focused = focus && focus.type === 'role' && focus.id === r.id;
        return '<article class="card rcard' + (focused ? ' focused' : '') + '" data-id="' + e(r.id) + '" draggable="true" data-drag="role">' +
          '<div class="card-top"><h3 class="card-title tinted" style="--c:' + e(r.color) + '"><button type="button" class="plain-btn" data-act="role-edit" data-id="' + e(r.id) + '">' + (r.icon ? '<span class="emo">' + e(r.icon) + '</span>' : '') + e(r.name) + '</button></h3>' +
          progress(st.pct, st.total > 0 && st.pct === 100) + '</div>' +
          '<div class="card-bot"><span class="card-sub">' + (st.next
            ? 'Task: <button type="button" class="link-btn plain" data-act="task-open" data-tid="' + e(st.next.t.id) + '" data-k="' + e(st.next.k) + '">' + e(st.next.t.title) + '</button>' + (st.next.k !== U.today() ? ' <span class="hint">(' + e(U.relDay(st.next.k)) + ')</span>' : '')
            : st.total ? 'No Pending Tasks' : 'No tasks this week') +
          ' <span class="hint num">· ' + st.done + '/' + st.total + '</span></span>' +
          '<span class="card-tools">' +
          '<button type="button" class="icon-btn sm" data-act="role-del" data-id="' + e(r.id) + '" aria-label="Delete role" title="Delete">' + ED.icon('trash') + '</button>' +
          '<button type="button" class="icon-btn sm" data-act="role-edit" data-id="' + e(r.id) + '" aria-label="Edit role" title="Edit">' + ED.icon('pencil') + '</button>' +
          '<button type="button" class="icon-btn sm' + (focused ? ' active' : '') + '" data-act="role-focus" data-id="' + e(r.id) + '" aria-pressed="' + focused + '" aria-label="Show this role’s tasks in the calendar" title="Show only this role in the calendar">' + ED.icon('hand') + '</button>' +
          '</span></div></article>';
      }).join('');
      return '<div class="roles">' +
        pageHead('Life Roles <button type="button" class="icon-btn sm" data-act="roles-info" aria-label="About roles" title="About roles">' + ED.icon('info') + '</button>', 'Add Role', 'role-new') +
        '<div class="wk-nav"><button type="button" class="icon-btn sm" data-act="roles-week" data-dir="-1" aria-label="Previous week">' + ED.icon('chevL') + '</button>' +
        '<span class="num">Week ' + U.weekNumber(wk, ws) + ': ' + e(U.fmtRange(wk, U.addDays(wk, 6))) + ', ' + U.addDays(wk, 6).slice(0, 4) + '</span>' +
        '<button type="button" class="icon-btn sm" data-act="roles-week" data-dir="1" aria-label="Next week">' + ED.icon('chevR') + '</button></div>' +
        '<div class="cards scroll" data-keep-scroll="roles" data-sort="roles">' + (cards || '<div class="empty">' + ED.icon('compass') + '<div><b>No roles yet.</b><br>Add the roles you play — Scientist, Parent, Learner — and plan a little for each every week.</div></div>') + '</div>' +
        '</div>';
    },
    right() { return ED.calpanel.render('roles'); },
    mount(left, right) { ED.calpanel.afterRender(right); },
  };

  /* ======================= Goals & Achievements ======================= */
  ED.views.goals = {
    id: 'goals', label: 'Goals',
    left() {
      const vf = ED.state.goalValue ? M.value(ED.state.goalValue) : null;
      const focus = ED.calpanel.st('goals').filter;
      const today = U.today();
      const act = M.activeGoals().filter(g => !vf || g.valueId === vf.id);
      const ach = M.achievements().filter(g => !vf || g.valueId === vf.id);
      const cards = act.map(g => {
        const st = M.goalStats(g.id);
        const late = g.due && g.due < today;
        const focused = focus && focus.type === 'goal' && focus.id === g.id;
        const v = M.value(g.valueId);
        return '<article class="card gcard' + (focused ? ' focused' : '') + '" data-id="' + e(g.id) + '">' +
          '<button type="button" class="gc-check" data-act="goal-achieve" data-id="' + e(g.id) + '" aria-label="Mark “' + e(g.title) + '” as achieved" title="Mark as achieved">' + ED.icon('check') + '</button>' +
          '<div class="gc-main">' +
          '<div class="card-top"><h3 class="card-title gc-title"><button type="button" class="plain-btn" data-act="goal-edit" data-id="' + e(g.id) + '">' + e(g.title) + '</button></h3>' + progress(st.pct, st.pct === 100 && st.total > 0) + '</div>' +
          '<div class="gc-meta num">' +
          (g.due ? '<span class="' + (late ? 'late' : '') + '">Due <b>' + e(U.fmtNum(g.due)) + '</b></span>' : '<span class="hint">No due date</span>') +
          '<span>Tasks <b>' + st.done + '/' + st.total + '</b></span>' +
          (v ? '<span class="chip vchip tinted" style="--c:' + e(v.color) + '">' + e(v.title) + '</span>' : '') +
          '<span class="card-tools">' +
          '<button type="button" class="icon-btn sm" data-act="goal-del" data-id="' + e(g.id) + '" aria-label="Delete goal" title="Delete">' + ED.icon('trash') + '</button>' +
          '<button type="button" class="icon-btn sm" data-act="goal-edit" data-id="' + e(g.id) + '" aria-label="Edit goal" title="Edit">' + ED.icon('pencil') + '</button>' +
          '<button type="button" class="icon-btn sm' + (focused ? ' active' : '') + '" data-act="goal-focus" data-id="' + e(g.id) + '" aria-pressed="' + focused + '" aria-label="Show this goal’s tasks in the calendar" title="Show only this goal in the calendar">' + ED.icon('hand') + '</button>' +
          '</span></div></div></article>';
      }).join('');
      const achs = ach.map(g => {
        const st = M.goalStats(g.id);
        return '<article class="card acard" data-id="' + e(g.id) + '">' +
          '<span class="a-star">' + ED.icon('star') + '</span>' +
          '<div class="a-main"><div class="a-top"><button type="button" class="plain-btn a-title" data-act="goal-edit" data-id="' + e(g.id) + '">' + e(g.title) + '</button>' +
          '<span class="a-when num">Completed: ' + e(U.fmtShort(g.doneAt)) + '</span></div>' +
          '<div class="a-bot num"><span>Tasks ' + st.done + '/' + st.total + '</span><span>Total Days: ' + M.goalDays(g) + '</span>' +
          '<button type="button" class="link-btn" data-act="goal-reopen" data-id="' + e(g.id) + '">Reopen</button></div></div></article>';
      }).join('');
      return '<div class="goals">' +
        pageHead('Active Goals', 'Add Goal', 'goal-new') +
        (vf ? '<div class="filter-row"><span class="chip">' + ED.icon('hand') + 'Value: ' + e(vf.title) + '<button type="button" data-act="goal-unvalue" aria-label="Show all goals">' + ED.icon('x') + '</button></span></div>' : '') +
        '<div class="goals-scroll scroll" data-keep-scroll="goals">' +
        '<div class="cards">' + (cards || '<div class="empty">' + ED.icon('target') + '<div><b>No active goals' + (vf ? ' for this value' : '') + '.</b><br>Add a goal, then link tasks to it — progress fills in as you tick them off.</div></div>') + '</div>' +
        '<h2 class="pg-title pg-sub">Achievements</h2>' +
        '<div class="cards">' + (achs || '<p class="hint">Goals you mark as achieved collect here.</p>') + '</div>' +
        '</div></div>';
    },
    right() { return ED.calpanel.render('goals'); },
    mount(left, right) { ED.calpanel.afterRender(right); },
  };

  /* ---------------- actions for these views ---------------- */
  const A = (ED.actions = ED.actions || {});
  A['master-new'] = () => ED.editors.task({ create: { date: null } });
  A['role-new'] = () => ED.editors.role(null);
  A['role-edit'] = el => ED.editors.role(el.dataset.id);
  A['role-del'] = async el => {
    const r = M.role(el.dataset.id); if (!r) return;
    const n = D().tasks.filter(t => t.roleId === r.id).length;
    const ok = await ED.ui.confirm({ title: 'Delete role', message: 'Delete “' + r.name + '”?' + (n ? ' ' + U.plural(n, 'task') + ' keep their details but lose this role.' : ''), ok: 'Delete', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Delete role');
    D().roles = D().roles.filter(x => x.id !== r.id);
    D().tasks.forEach(t => { if (t.roleId === r.id) t.roleId = null; });
    D().goals.forEach(g => { if (g.roleId === r.id) g.roleId = null; });
    const cf = ED.calpanel.st('roles');
    if (cf.filter && cf.filter.id === r.id) cf.filter = null;
    ED.store.commit(); ED.ui.undoToast('Role deleted');
  };
  A['role-focus'] = el => {
    const s = ED.calpanel.st('roles');
    s.filter = s.filter && s.filter.id === el.dataset.id ? null : { type: 'role', id: el.dataset.id };
    ED.app.render();
  };
  A['roles-week'] = el => {
    const cur = ED.state.rolesWeek || ED.state.date;
    ED.state.rolesWeek = U.addDays(cur, 7 * (+el.dataset.dir));
    ED.calpanel.st('roles').anchor = ED.state.rolesWeek;
    ED.app.render();
  };
  A['roles-info'] = el => ED.ui.popover(el,
    '<div class="info-pop"><h3>Life roles</h3><p>Roles are the parts you play: professional, parent, learner, friend. Planning a little for each role every week keeps any one of them from being neglected.</p>' +
    '<p>The bar shows how many of this week’s tasks in that role are done. The line under it is the next unfinished task. Use ' + ED.icon('hand') + ' to show only that role in the calendar, and drag cards to reorder them.</p></div>', { cls: 'info' });

  A['goal-new'] = () => ED.editors.goal(null, ED.state.goalValue ? { valueId: ED.state.goalValue } : null);
  A['goal-edit'] = el => ED.editors.goal(el.dataset.id);
  A['goal-del'] = async el => {
    const g = M.goal(el.dataset.id); if (!g) return;
    const n = M.goalTasks(g.id).length;
    const ok = await ED.ui.confirm({ title: 'Delete goal', message: 'Delete “' + g.title + '”?' + (n ? ' Its ' + U.plural(n, 'task') + ' stay in your diary.' : ''), ok: 'Delete', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Delete goal');
    D().goals = D().goals.filter(x => x.id !== g.id);
    D().tasks.forEach(t => { if (t.goalId === g.id) t.goalId = null; });
    ED.store.commit(); ED.ui.undoToast('Goal deleted');
  };
  A['goal-achieve'] = async el => {
    const g = M.goal(el.dataset.id); if (!g) return;
    const st = M.goalStats(g.id);
    const ok = await ED.ui.confirm({
      title: 'Goal achieved?', message: '“' + g.title + '” moves to Achievements' + (st.total && st.done < st.total ? ' (' + (st.total - st.done) + ' of its tasks are still open)' : '') + '.',
      ok: 'Mark as achieved',
    });
    if (!ok) return;
    ED.store.checkpoint('Achieve goal');
    g.done = true; g.doneAt = U.today();
    ED.store.commit();
    ED.ui.toast('Well done! “' + g.title + '” is in your Achievements.', { icon: 'trophy', action: 'Undo', onAction: () => ED.store.undo() });
  };
  A['goal-reopen'] = el => {
    const g = M.goal(el.dataset.id); if (!g) return;
    g.done = false; g.doneAt = null; ED.store.commit(); ED.ui.toast('Goal moved back to Active Goals');
  };
  A['goal-focus'] = el => {
    const s = ED.calpanel.st('goals');
    s.filter = s.filter && s.filter.id === el.dataset.id ? null : { type: 'goal', id: el.dataset.id };
    ED.app.render();
  };
  A['goal-unvalue'] = () => { ED.state.goalValue = null; ED.app.render(); };
})();
