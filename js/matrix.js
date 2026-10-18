/* E-Diary — Planner → Eisenhower Matrix.
   Your open tasks, sorted automatically into four boxes:
     1 Do first   (urgent & important)      2 Schedule   (important, not urgent)
     3 Delegate   (urgent, not important)   4 Eliminate  (neither)
   Urgent    = has a date within the next N days (settings.matrix.days, default 2) or is overdue.
   Important = priority A or B (settings.matrix.imp: 'AB' | 'A'), or linked to a goal.
   Delegated tasks sit in "Delegate" so you can follow them up.
   You can move a task to another box (drag it, or its ⋯ menu); that choice is kept on the task (t.eis) until you
   put it back to automatic. Spread: left page = the urgent column (1 over 3), right page = not urgent (2 over 4),
   so the two rows line up across the diary like the classic 2 × 2 grid. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const D = () => ED.store.data, S = () => ED.store.data.settings;
  const A = (ED.actions = ED.actions || {});
  const MX = (ED.matrix = {});

  const Q = [
    { id: 'do', n: 1, title: 'Do first', sub: 'Urgent & important', empty: 'Nothing urgent and important. Well done — spend the time on box 2.' },
    { id: 'plan', n: 2, title: 'Schedule', sub: 'Important, not urgent', empty: 'Add the important things that have no deadline yet — goals, learning, health, planning — and give them a day.' },
    { id: 'delegate', n: 3, title: 'Delegate', sub: 'Urgent, not important', empty: 'No urgent small jobs. Requests and interruptions land here.' },
    { id: 'drop', n: 4, title: 'Eliminate / later', sub: 'Neither urgent nor important', empty: 'Nothing to drop. Someday ideas without a date land here.' },
  ];
  const cfg = () => Object.assign({ days: 2, imp: 'AB', rep: false }, S().matrix || {});
  MX.Q = Q;

  /* the tasks the matrix looks at: open and delegated one-off tasks (overdue ones too, and up to 60 days ahead),
     undated tasks from the master list, and — if chosen — the next open day of each repeating task */
  MX.items = () => {
    const c = cfg(), today = U.today(), ahead = U.addDays(today, 60);
    const out = [], seen = new Set();
    const add = (t, k, st, carried) => { if (seen.has(t.id)) return; seen.add(t.id); out.push({ t, k, st, carried: !!carried }); };
    D().tasks.forEach(t => {
      if (t.repeat && t.repeat.freq) return;
      if (!t.date && t.schedTo) return;   // scheduled to a month/week/day: its copy is the one to do
      const st = t.status || 'open';
      if (!(M.isPending(st) || st === 'delegated')) return;
      if (!t.date) { add(t, null, st); return; }
      if (t.date <= ahead) add(t, t.date, st, t.date < today);
    });
    if (c.rep) M.idx().rep.forEach(t => {
      for (let i = 0; i <= Math.max(1, c.days); i++) {
        const k = U.addDays(today, i);
        if (M.occurs(t.date, t.repeat, k, t.exdates) && M.isPending(M.statusOf(t, k))) { add(t, k, M.statusOf(t, k)); break; }
      }
    });
    return out;
  };
  MX.urgent = x => !!x.k && x.k <= U.addDays(U.today(), cfg().days);
  MX.important = x => { const p = x.t.prio || 'B'; return (cfg().imp === 'A' ? p === 'A' : p === 'A' || p === 'B') || !!x.t.goalId; };
  MX.auto = x => x.st === 'delegated' ? 'delegate' : MX.urgent(x) ? (MX.important(x) ? 'do' : 'delegate') : (MX.important(x) ? 'plan' : 'drop');
  MX.quad = x => x.t.eis && Q.some(q => q.id === x.t.eis) ? x.t.eis : MX.auto(x);
  const sortIn = (a, b) => String(a.k || '9999').localeCompare(String(b.k || '9999')) || M.cmpTask(a.t, b.t);
  MX.byQuad = () => { const m = { do: [], plan: [], delegate: [], drop: [] }; MX.items().forEach(x => m[MX.quad(x)].push(x)); Object.keys(m).forEach(k => m[k].sort(sortIn)); return m; };

  /* ---------------- drawing ---------------- */
  const dueChip = x => {
    if (!x.k) return '<span class="eis-due none">no date</span>';
    const n = U.diffDays(U.today(), x.k);
    const txt = n < 0 ? 'overdue ' + U.plural(-n, 'day') : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 7 ? U.DAYS[U.dow(x.k)] : U.fmtDM(x.k);
    return '<span class="eis-due' + (n < 0 ? ' late' : n <= 1 ? ' soon' : '') + '" title="' + e(U.fmtLong(x.k)) + '">' + e(txt) + (x.t.time ? ' · ' + e(U.fmtTime(x.t.time, S().h12)) : '') + '</span>';
  };
  const card = x => {
    const t = x.t, role = M.role(t.roleId), goal = M.goal(t.goalId), cat = M.category(t.categoryId);
    return '<li class="eis-card st-' + e(x.st) + '" draggable="true" data-eis="' + e(t.id) + '" data-tid="' + e(t.id) + '" data-k="' + e(x.k || '') + '"' + (x.carried ? ' data-carried="1"' : '') + (cat ? ' style="--c:' + e(cat.color) + '"' : '') + '>' +
      '<button type="button" class="tstat" data-act="task-toggle" aria-label="' + e(M.statusLabel(x.st)) + ' — click to ' + (M.isClosed(x.st) ? 'reopen' : 'complete') + '" title="' + e(M.statusLabel(x.st)) + '">' + ED.tasksUI.statusIcon(x.st) + '</button>' +
      '<button type="button" class="plain-btn eis-t" data-act="task-open"><span class="eis-code num">' + e(M.code(t)) + '</span>' + e(t.title || 'Untitled task') +
      '<span class="eis-meta">' + dueChip(x) + (role ? '<span class="eis-tag">' + e(role.icon ? role.icon + ' ' : '') + e(role.name) + '</span>' : '') + (goal ? '<span class="eis-tag goal">' + ED.icon('target') + e(goal.title || goal.name || 'Goal') + '</span>' : '') +
      (x.st === 'delegated' ? '<span class="eis-tag">' + ED.icon('users') + e(t.delegatedTo ? 'with ' + t.delegatedTo : 'delegated') + '</span>' : '') +
      (t.eis ? '<span class="eis-tag pin" title="You placed it in this box">' + ED.icon('pin') + 'placed by you</span>' : '') + '</span></button>' +
      '<button type="button" class="icon-btn sm eis-more" data-act="eis-menu" aria-label="Move or change this task" title="Move or change">' + ED.icon('more') + '</button></li>';
  };
  const box = (q, list) => '<section class="eis-q eis-' + q.id + '" data-eisq="' + q.id + '" aria-label="' + e(q.n + '. ' + q.title + ' — ' + q.sub) + '">' +
    '<header class="eis-h"><span class="eis-n num">' + q.n + '</span><span class="eis-ht"><b>' + e(q.title) + '</b> <span class="hint num">· ' + list.length + '</span><span class="hint eis-sub">' + e(q.sub) + '</span></span>' +
    '<button type="button" class="icon-btn sm" data-act="eis-add" data-q="' + q.id + '" aria-label="Add a task to ' + e(q.title) + '" title="Add a task here">' + ED.icon('plus') + '</button></header>' +
    '<div class="eis-body scroll" data-keep-scroll="eis-' + q.id + '">' + (list.length ? '<ul class="eis-list">' + list.map(card).join('') + '</ul>' : '<p class="hint eis-empty">' + e(q.empty) + '</p>') + '</div></section>';
  const qOf = id => Q.find(q => q.id === id);

  const view = {
    id: 'matrix', label: 'Eisenhower Matrix',
    left() {
      const m = MX.byQuad(), c = cfg();
      return '<div class="eis eis-left"><div class="pg-head"><h2 class="pg-title">Eisenhower Matrix</h2>' +
        '<div class="xp-tools"><button type="button" class="btn small ghost" data-act="eis-settings" title="How tasks are sorted">' + ED.icon('gear') + 'Rules</button></div></div>' +
        '<div class="eis-axis"><b>Urgent</b><span class="hint">due ' + (c.days ? 'within ' + U.plural(c.days, 'day') : 'today') + ' or overdue</span></div>' +
        '<div class="eis-grid"><div class="eis-row"><span class="eis-rl">Important</span>' + box(qOf('do'), m.do) + '</div>' +
        '<div class="eis-row"><span class="eis-rl">Not important</span>' + box(qOf('delegate'), m.delegate) + '</div></div></div>';
    },
    right() {
      const m = MX.byQuad(), c = cfg();
      const n = Object.keys(m).reduce((a, k) => a + m[k].length, 0);
      return '<div class="eis eis-right"><div class="pg-head"><h2 class="pg-title eis-sum">' + U.plural(n, 'open task') + '</h2>' +
        '<div class="xp-tools"><button type="button" class="btn small ghost" data-act="eis-help">' + ED.icon('help') + 'How to use it</button></div></div>' +
        '<div class="eis-axis"><b>Not urgent</b><span class="hint">no date, or due later</span></div>' +
        '<div class="eis-grid"><div class="eis-row">' + box(qOf('plan'), m.plan) + '</div><div class="eis-row">' + box(qOf('drop'), m.drop) + '</div></div>' +
        '<p class="hint eis-foot">Important = priority ' + (c.imp === 'A' ? 'A' : 'A or B') + ' or linked to a goal. Drag a task to another box, or use its ⋯ menu.</p></div>';
    },
    mount(L, R) {
      // drag a card to another box (its own drag handling; the diary's task dragging is not involved)
      let id = null;
      [L, R].forEach(root => {
        root.addEventListener('dragstart', ev => { const c = ev.target.closest && ev.target.closest('[data-eis]'); if (!c) return; id = c.dataset.eis; try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', id); } catch (err) { /* ignore */ } requestAnimationFrame(() => c.classList.add('dragging')); });
        root.addEventListener('dragend', () => { id = null; U.$$('.eis .dragging, .eis .drop-hover').forEach(x => x.classList.remove('dragging', 'drop-hover')); });
        root.addEventListener('dragover', ev => { if (!id) return; const q = ev.target.closest('[data-eisq]'); if (!q) return; ev.preventDefault(); U.$$('.eis .drop-hover').forEach(x => { if (x !== q) x.classList.remove('drop-hover'); }); q.classList.add('drop-hover'); });
        root.addEventListener('drop', ev => { if (!id) return; const q = ev.target.closest('[data-eisq]'); if (!q) return; ev.preventDefault(); const tid = id; id = null; MX.place(tid, q.dataset.eisq); });
      });
    },
  };
  ED.views = ED.views || {};
  ED.views.matrix = view;

  /* put a task in a box by hand (or back to automatic when it is the box the rules would choose anyway) */
  MX.place = (tid, qid) => {
    const t = M.task(tid); if (!t) return;
    const x = MX.items().find(y => y.t.id === tid) || { t, k: t.date, st: t.status || 'open' };
    const was = MX.quad(x);
    if (was === qid) return;
    ED.store.checkpoint('Move in matrix');
    delete t.eis;
    if (MX.auto(x) !== qid) t.eis = qid;
    t.updatedAt = Date.now();
    ED.store.commit();
    ED.ui.undoToast(M.code(t) + ' ' + (t.title || '') + ' → ' + qOf(qid).title + (t.eis ? ' (kept there until you put it back to automatic)' : ''));
  };

  A['eis-menu'] = el => {
    const row = el.closest('[data-eis]'); const t = row && M.task(row.dataset.eis); if (!t) return;
    const x = MX.items().find(y => y.t.id === t.id) || { t, k: t.date, st: t.status || 'open' };
    const cur = MX.quad(x);
    const items = [{ header: 'Move to' }].concat(Q.map(q => ({ label: q.n + '  ' + q.title, checked: q.id === cur, onClick: () => MX.place(t.id, q.id) })));
    if (t.eis) items.push({ label: 'Back to automatic', icon: 'undo', onClick: () => { ED.store.checkpoint('Matrix'); delete t.eis; t.updatedAt = Date.now(); ED.store.commit(); ED.ui.toast('Sorted by the rules again'); } });
    items.push({ sep: true });
    if (!t.repeat) items.push({ label: t.date ? 'Change the date…' : 'Give it a date…', icon: 'calendar', onClick: async () => {
      const v = await ED.ui.prompt({ title: 'Schedule', label: 'Date for ' + M.code(t) + ' ' + (t.title || ''), type: 'date', value: t.date || U.addDays(U.today(), 1), ok: 'Set date' });
      if (v == null) return;
      ED.store.checkpoint('Schedule');
      t.date = U.isKey(v) ? v : null; t.updatedAt = Date.now(); ED.store.commit();
      ED.ui.undoToast(t.date ? 'Scheduled for ' + U.fmtLong(t.date) : 'Date removed — it is on the master list');
    } });
    if (!t.repeat && x.st !== 'delegated') items.push({ label: 'Delegate to…', icon: 'users', onClick: async () => {
      const v = await ED.ui.prompt({ title: 'Delegate', label: 'Who will do ' + M.code(t) + ' ' + (t.title || '') + '?', value: t.delegatedTo || '', ok: 'Delegate' });
      if (v == null) return;
      ED.store.checkpoint('Delegate'); t.delegatedTo = v.trim(); M.setStatus(t, x.k || t.date || U.today(), 'delegated'); ED.store.commit(); ED.ui.undoToast('Delegated' + (t.delegatedTo ? ' to ' + t.delegatedTo : ''));
    } });
    items.push({ label: 'Mark done', icon: 'check', onClick: () => { ED.store.checkpoint('Done'); M.setOccStatus(M.occ(t, x.k || t.date || U.today()), 'done'); ED.store.commit(); ED.ui.undoToast('Done: ' + (t.title || '')); } });
    items.push({ label: 'Open the task', icon: 'pencil', onClick: () => ED.editors.task({ id: t.id, k: x.k || t.date || U.today() }) });
    ED.ui.menu(el, items, { placement: 'right-align' });
  };

  /* a new task straight into a box: priority and date chosen to match it */
  A['eis-add'] = async el => {
    const q = qOf(el.dataset.q); if (!q) return;
    const title = await ED.ui.prompt({ title: 'Add to “' + q.title + '”', label: 'Task', placeholder: q.id === 'plan' ? 'e.g. Read two papers on radar signal processing' : q.id === 'do' ? 'e.g. Reply to the audit para' : '', ok: 'Add' });
    if (!title || !title.trim()) return;
    const today = U.today();
    const f = { do: { prio: 'A', date: today }, plan: { prio: 'B', date: null }, delegate: { prio: 'C', date: today }, drop: { prio: 'D', date: null } }[q.id];
    ED.store.checkpoint('New task');
    const t = M.addTask({ title: title.trim(), prio: f.prio, date: f.date });
    ED.store.commit();
    ED.ui.toast('Added ' + M.code(t) + (t.date ? ' for today' : ' to the master list'), { action: 'Edit', onAction: () => ED.editors.task({ id: t.id, k: t.date || today }) });
  };

  A['eis-settings'] = () => {
    const c = cfg();
    ED.fx.form({
      title: 'How the matrix sorts tasks',
      intro: 'The matrix sorts your open tasks automatically. Tasks you move by hand stay where you put them.',
      data: { days: c.days, imp: c.imp, rep: c.rep },
      fields: [
        { k: 'days', label: 'Urgent = due within (days)', type: 'number', min: 0, max: 14, hint: '0 = only today and overdue tasks are urgent' },
        { k: 'imp', label: 'Important = priority', type: 'select', options: [['AB', 'A or B (or linked to a goal)'], ['A', 'A only (or linked to a goal)']] },
        { k: 'rep', label: 'Show repeating tasks (their next open day)', type: 'check' },
      ],
      save(v, api) {
        S().matrix = { days: Math.max(0, Math.min(14, v.days == null ? 2 : Math.round(v.days))), imp: v.imp === 'A' ? 'A' : 'AB', rep: !!v.rep };
        ED.store.commit(); api.close(); ED.ui.toast('Rules saved');
      },
    });
  };

  A['eis-help'] = () => ED.ui.modal({
    title: 'Using the Eisenhower Matrix', cls: 'small',
    body: '<ol class="set-ol"><li><b>1 · Do first</b> — urgent and important: do these today.</li>' +
      '<li><b>2 · Schedule</b> — important but not urgent: this is where progress comes from. Give each a date (⋯ → Give it a date) and protect the time.</li>' +
      '<li><b>3 · Delegate</b> — urgent but not important: hand over (⋯ → Delegate to…) or keep it short. Delegated tasks stay here so you can follow up.</li>' +
      '<li><b>4 · Eliminate / later</b> — neither: drop it, or leave it on the master list without a date.</li></ol>' +
      '<p class="hint">Tasks are sorted from their date and priority (A/B = important, or linked to a goal). Change the rules with <b>Rules</b>. Drag a task to another box to overrule the sorting for it.</p>',
    footer: '<span class="grow"></span><button type="button" class="btn primary" data-mclose>Got it</button>',
  });
})();
