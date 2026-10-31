/* E-Diary — Study → Projects (added in 1.18): one place to run each research project.
   Left page:  your projects as cards (status, progress, next milestone), and the chosen project — brief, objectives,
               team, funding, dates — with its work plan: the steps in order, each with what is done in it and the
               tools used. A step with a due date can sit in the daily planner.
   Right page: tiles (progress, milestones, budget, days left) and tabs — Milestones · To procure · Tools & methods ·
               Research links · Log · Timeline.
   Links to the rest of the diary (all kept in step by PR.reconcile, with fixed ids so two devices agree):
     • Milestones → a task on the deadline ("🎯 …", tk-pjm-<p>-<m>) and/or a reminder N days before (default 8,
       "⏰ …", tk-pjr-<p>-<m>), as you choose; ticking the deadline task ticks the milestone and back; moving it moves
       the deadline. "Show in my calendar" makes a calendar event (and Google Calendar, when linked).
     • Steps with "in daily tasks" → a task on the due date (tk-pjs-<p>-<s>), ticked both ways.
     • To procure → an item switched to "Buy" is a task on its need-by date (tk-pjp-<p>-<b>) and a planned purchase in
       Finance → Bills (js/purchases.js, key proj:<p>.<b>); ticking either marks it bought, and the spending goes to
       Money records (fr-pu-proj-<p>.<b>).
     • A project's goal (Purpose → Goals) is set on its tasks, so the goal's progress counts them; research topics
       show their saved papers here and open Research papers / Science bits with the project's words.
   Deleting a project, a step, a milestone or an item takes its tasks, calendar event, bill and record with it.
   Data: ED.store.data.projects = { list: [{ id, name, code, kind, status, start, end, lead, team, agency, budget,
          desc, objectives, keywords, color, goalId, topics: [researchTopicId], steps: [{ id, title, detail, tools,
          status, start, due, plan, doneOn }], milestones: [{ id, title, due, notes, done, doneOn, inTask: ''|'due'|
          'before'|'both', days, cal, eventId }], buys: [{ id, item, spec, qty, unit, vendor, mode, need, status, paid,
          paidOn, paidAmount, noPlan, notes }], tools: [{ id, name, kind, version, link, notes }], log: [{ id, date,
          text }], createdAt, updatedAt }] } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const A = (ED.actions = ED.actions || {});
  const CH = (ED.changes = ED.changes || {});
  const D = () => ED.store.data;
  const FX = () => ED.fx;
  const PR = (ED.projects = {});
  const st = () => ED.state.pr || (ED.state.pr = { sel: null, tab: 'ms', show: 'open' });
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const r2 = v => Math.round(v * 100) / 100;
  const money = v => ED.finance ? ED.finance.money(v) : '₹' + Math.round(v).toLocaleString('en-IN');

  const KINDS = [['research', 'Research project'], ['development', 'Development / engineering'], ['paper', 'Paper / thesis'], ['office', 'Office project'], ['personal', 'Personal project']];
  const STATUS = [['idea', 'Idea'], ['planning', 'Planning'], ['active', 'Active'], ['hold', 'On hold'], ['done', 'Completed'], ['dropped', 'Dropped']];
  const SSTEP = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
  const BSTAT = [['list', 'Listed (not yet buying)'], ['buy', 'Buy — in planner & Bills'], ['ordered', 'Ordered'], ['received', 'Received']];
  const MODES = [['', '—'], ['gem', 'GeM'], ['tender', 'Tender / RFQ'], ['direct', 'Direct purchase'], ['online', 'Online'], ['import', 'Import'], ['inhouse', 'In-house / free']];
  const TKINDS = [['software', 'Software'], ['hardware', 'Hardware / board'], ['instrument', 'Instrument'], ['dataset', 'Dataset'], ['library', 'Library / framework'], ['service', 'Service / cloud'], ['method', 'Method / technique']];
  const INTASK = [['', 'Not in daily tasks'], ['due', 'On the deadline'], ['before', 'Some days before the deadline'], ['both', 'Both — before and on the deadline']];
  const COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#dc2626', '#0d9488'];
  const lab = (l, k) => (l.find(x => x[0] === k) || l[0])[1];

  /* ---------------- data ---------------- */
  const P = () => {
    const d = D();
    if (!d.projects || typeof d.projects !== 'object') d.projects = { list: [] };
    if (!Array.isArray(d.projects.list)) d.projects.list = [];
    return d.projects;
  };
  const norm = p => { ['steps', 'milestones', 'buys', 'tools', 'log', 'topics'].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; }); return p; };
  PR.list = () => P().list.map(norm);
  PR.get = id => PR.list().find(p => p.id === id) || null;
  const touch = p => { p.updatedAt = Date.now(); };
  const live = p => p.status !== 'dropped';
  PR.cur = () => { const s = st(); let p = PR.get(s.sel); if (!p) { p = PR.list().filter(x => x.status !== 'done' && x.status !== 'dropped')[0] || PR.list()[0] || null; s.sel = p ? p.id : null; } return p; };
  const bTotal = b => r2(num(b.qty || 1) * num(b.unit));
  PR.stats = p => {
    const s = p.steps.length, sd = p.steps.filter(x => x.status === 'done').length, sg = p.steps.filter(x => x.status === 'doing').length;
    const m = p.milestones.length, md = p.milestones.filter(x => x.done).length;
    const parts = s + m, pct = parts ? Math.round(100 * (sd + sg * 0.5 + md) / parts) : (p.status === 'done' ? 100 : 0);
    const next = p.milestones.filter(x => !x.done && U.isKey(x.due)).sort((a, b) => a.due.localeCompare(b.due))[0] || null;
    const planned = r2(p.buys.reduce((a, b) => a + bTotal(b), 0)), spent = r2(p.buys.reduce((a, b) => a + (b.paid ? num(b.paidAmount) || bTotal(b) : 0), 0));
    const toBuy = p.buys.filter(b => b.status !== 'list' && !b.paid).length;
    return { s, sd, sg, m, md, pct, next, planned, spent, toBuy };
  };

  /* ---------------- keeping the planner, calendar and Bills in step ---------------- */
  const SID = (p, x) => 'tk-pjs-' + p.id + '-' + x.id, MID = (p, x) => 'tk-pjm-' + p.id + '-' + x.id, RID = (p, x) => 'tk-pjr-' + p.id + '-' + x.id, BID = (p, x) => 'tk-pjp-' + p.id + '-' + x.id;
  const KS = ['projstep', 'projms', 'projrem', 'projbuy'];
  const role = () => ED.lifeRole ? ED.lifeRole(/research|project/i, 'Research & Projects', '🧪', '#4f46e5', null) : null;
  const cat = () => (D().categories.find(c => /research|project/i.test(c.name || '')) || D().categories.find(c => /career|work|office/i.test(c.name || '')) || {}).id || null;
  const evSpec = (p, m) => ({ on: !!m.cal && U.isKey(m.due) && live(p), title: '🎯 ' + p.name + ': ' + m.title, date: m.due, time: null, notes: (m.notes || '') + '\nMilestone of the project “' + p.name + '” (E-Diary → Study → Projects)', color: p.color || '#4f46e5' });
  PR.calSync = (p, m) => { if (FX() && FX().linkEvent) FX().linkEvent(m, evSpec(p, m)); };
  PR.find = id => { const [pid, xid] = String(id || '').split('.'); const p = PR.get(pid); return { p, s: p && p.steps.find(x => x.id === xid), m: p && p.milestones.find(x => x.id === xid), b: p && p.buys.find(x => x.id === xid) }; };

  let busy = false;
  PR.reconcile = () => {
    const d = D();
    if (busy || !d || !Array.isArray(d.tasks) || !d.projects) return false;
    busy = true; let ch = false;
    try {
      const today = U.today(), keep = new Set(); let rl = null;
      const R = () => rl || (rl = role());
      const goalOk = p => p.goalId && M.goal(p.goalId) ? p.goalId : null;
      // make or update one task; `sync(t, done)` is told when the task was ticked / unticked in the planner
      const ensure = (id, spec, isDone, setDone, onMove) => {
        keep.add(id);
        let t = d.tasks.find(x => x.id === id);
        if (!t) {
          t = M.newTask(Object.assign({ id, prio: 'A', roleId: R(), categoryId: cat(), linkTitle: spec.title, linkDate: spec.date, linkSt: isDone ? 'done' : 'open' }, spec));
          t.num = M.nextNum(t.prio, t.date); if (isDone) M.setStatus(t, t.date, 'done');
          d.tasks.push(t); ch = true; return;
        }
        if (t.date !== t.linkDate && U.isKey(t.date)) { if (onMove) onMove(t.date); t.linkDate = t.date; ch = true; }
        else if (t.date !== spec.date) { t.date = spec.date; t.linkDate = spec.date; ch = true; }
        if (t.linkTitle !== spec.title) { if (t.title === t.linkTitle) t.title = spec.title; t.linkTitle = spec.title; ch = true; }
        if ((t.goalId || null) !== (spec.goalId || null)) { t.goalId = spec.goalId || null; ch = true; }
        const tDone = M.isClosed(t.status);
        if (tDone !== (t.linkSt === 'done')) { setDone(tDone); t.linkSt = tDone ? 'done' : 'open'; ch = true; }
        else if (isDone != null && tDone !== isDone) { M.setStatus(t, t.date, isDone ? 'done' : 'open'); t.linkSt = isDone ? 'done' : 'open'; ch = true; }
      };
      PR.list().forEach(p => {
        const g = goalOk(p);
        if (p.goalId && !g) { p.goalId = null; ch = true; }
        const topics = p.topics.filter(id => d.research && Array.isArray(d.research.topics) && d.research.topics.some(t => t.id === id));
        if (topics.length !== p.topics.length) { p.topics = topics; ch = true; }
        if (!live(p)) return;                                    // a dropped project's open tasks go (below)
        const lnk = (k, x) => ({ k, id: p.id + '.' + x.id });
        p.steps.forEach((s, i) => {
          if (!s.plan || !U.isKey(s.due)) return;
          ensure(SID(p, s), { title: '🧪 ' + p.name + ' — step ' + (i + 1) + ': ' + s.title, date: s.due, link: lnk('projstep', s), goalId: g, notes: [s.detail, s.tools ? 'Tools: ' + s.tools : ''].filter(Boolean).join('\n') },
            s.status === 'done', done => { s.status = done ? 'done' : 'doing'; s.doneOn = done ? today : null; touch(p); }, k => { s.due = k; touch(p); });
        });
        p.milestones.forEach(m => {
          if (!U.isKey(m.due) || !m.inTask) return;
          const ttl = p.name + ': ' + m.title;
          if (m.inTask === 'due' || m.inTask === 'both') {
            ensure(MID(p, m), { title: '🎯 Milestone — ' + ttl, date: m.due, link: lnk('projms', m), goalId: g, notes: m.notes || '' },
              !!m.done, done => { m.done = done; m.doneOn = done ? today : null; touch(p); PR.calSync(p, m); }, k => { m.due = k; touch(p); PR.calSync(p, m); });
          }
          if ((m.inTask === 'before' || m.inTask === 'both') && !m.done) {
            const n = Math.max(1, Math.round(num(m.days) || 8)), k = U.addDays(m.due, -n);
            ensure(RID(p, m), { title: '⏰ ' + U.plural(n, 'day') + ' to the milestone — ' + ttl + ' (due ' + U.fmtDM(m.due) + ')', date: k, link: lnk('projrem', m), goalId: g, notes: 'Reminder: the milestone is due on ' + U.fmtShort(m.due) + '.' + (m.notes ? '\n' + m.notes : '') },
              null, () => {}, null);
          }
        });
        p.buys.forEach(b => {
          if (b.status === 'list' || !b.status || b.noPlan) return;
          if (!U.isKey(b.need)) { b.need = today; touch(p); ch = true; }
          ensure(BID(p, b), { title: '🛒 Buy for ' + p.name + ': ' + b.item + (num(b.qty) > 1 ? ' × ' + b.qty : ''), date: b.need, link: lnk('projbuy', b), goalId: g, notes: [b.spec, b.vendor ? 'Vendor: ' + b.vendor : '', b.mode ? 'Mode: ' + lab(MODES, b.mode) : '', bTotal(b) ? 'Estimated ' + money(bTotal(b)) : ''].filter(Boolean).join('\n') },
            !!b.paid, done => { b.paid = done; b.paidOn = done ? today : null; if (done && !num(b.paidAmount)) b.paidAmount = bTotal(b); if (done && b.status === 'buy') b.status = 'received'; touch(p); }, k => { b.need = k; touch(p); });
        });
      });
      // tasks whose step / milestone / item is gone or no longer planned: open ones go; done ones stay unless the thing was deleted
      const before = d.tasks.length;
      d.tasks = d.tasks.filter(t => {
        if (!t.link || KS.indexOf(t.link.k) < 0 || keep.has(t.id)) return true;
        const f = PR.find(t.link.id), there = f.p && (f.s || f.m || f.b);
        if (!there) return false;
        if (t.link.k === 'projrem') return false;
        return M.isClosed(t.status);
      });
      if (d.tasks.length !== before) ch = true;
    } catch (err) { console.warn('[e-diary] projects', err); }
    finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => {
    if (type !== 'change' || (detail && detail.reason === 'projects')) return;
    if (PR.reconcile()) ED.store.commit({ reason: 'projects' });
  });
  setTimeout(() => { if (PR.reconcile()) ED.store.commit({ reason: 'projects' }); }, 0);

  // deleting a task takes that thing out of the planner (the project keeps it)
  const del0 = M.deleteTask;
  M.deleteTask = id => {
    const t = M.task(id);
    if (t && t.link && KS.indexOf(t.link.k) >= 0) {
      const f = PR.find(t.link.id);
      if (f.s && t.link.k === 'projstep') f.s.plan = false;
      if (f.m && t.link.k === 'projms') f.m.inTask = f.m.inTask === 'both' ? 'before' : '';
      if (f.m && t.link.k === 'projrem') f.m.inTask = f.m.inTask === 'both' ? 'due' : '';
      if (f.b && t.link.k === 'projbuy') f.b.noPlan = true;
      if (f.p) touch(f.p);
    }
    return del0(id);
  };
  // clicking the task opens the project at the right place
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    const l = o && o.t.link;
    if (l && KS.indexOf(l.k) >= 0) {
      const f = PR.find(l.id);
      if (f.p) { PR.open(f.p.id, l.k === 'projbuy' ? 'buy' : l.k === 'projstep' ? null : 'ms'); const [, xid] = l.id.split('.'); setTimeout(() => { if (f.s) PR.editStep(f.p.id, xid); else if (f.m) PR.editMs(f.p.id, xid); else if (f.b) PR.editBuy(f.p.id, xid); }, 80); return; }
    }
    return open0 && open0(el, ev);
  };
  PR.open = (pid, tab) => { const s = st(); s.sel = pid; if (tab) s.tab = tab; ED.go.tab('projects'); };

  /* ---------------- Finance → Bills (js/purchases.js asks for these) ---------------- */
  PR.billRows = () => {
    const out = [];
    PR.list().forEach(p => p.buys.forEach(b => {
      if (b.status === 'list' || !b.status || b.noPlan || p.status === 'dropped') return;
      out.push({ key: 'proj:' + p.id + '.' + b.id, kind: 'proj', id: p.id + '.' + b.id, name: 'Project ' + p.name + ': ' + b.item, amount: bTotal(b), date: b.need || null,
        paid: !!b.paid, paidOn: b.paid ? (b.paidOn || b.need || U.today()) : null, paidAmount: b.paid ? (num(b.paidAmount) || bTotal(b)) : 0,
        sub: [num(b.qty) > 1 ? b.qty + ' × ' + money(num(b.unit)) : '', lab(MODES, b.mode || ''), b.vendor, lab(BSTAT, b.status).replace(/ —.*/, '')].filter(x => x && x !== '—').join(' · '), src: 'Projects' });
    }));
    return out;
  };
  PR.buyRef = id => PR.find(id).b || null;
  PR.payBill = async x => {
    const f = PR.find(x.id); if (!f.b) return;
    if (x.paid) { ED.store.checkpoint('Not bought'); f.b.paid = false; f.b.paidOn = null; touch(f.p); ED.store.commit(); ED.ui.undoToast(f.b.item + ' — marked as not bought'); return; }
    const v = await ED.ui.prompt({ title: 'Bought: ' + f.b.item, label: 'What did it cost (₹)?', type: 'number', value: num(f.b.paidAmount) || bTotal(f.b) || '', ok: 'Bought' });
    if (v == null) return;
    ED.store.checkpoint('Bought'); f.b.paid = true; f.b.paidOn = U.today(); f.b.paidAmount = num(v); if (f.b.status === 'buy') f.b.status = 'received'; touch(f.p); ED.store.commit();
    ED.ui.undoToast(f.b.item + ' — bought');
  };
  PR.hideBill = id => { const f = PR.find(id); if (!f.b) return; ED.store.checkpoint('Take out of Bills'); f.b.noPlan = true; touch(f.p); ED.store.commit(); ED.ui.undoToast('Taken out of Bills and the planner (still on the project’s list)'); };
  PR.keyAlive = id => { const f = PR.find(id); return !!f.b; };

  /* ---------------- editors ---------------- */
  const goalOpts = () => [['', '— None —']].concat(M.activeGoals ? M.activeGoals().map(g => [g.id, g.title]) : []);
  PR.edit = id => {
    const x = id ? PR.get(id) : null;
    FX().form({
      title: x ? 'Project' : 'New project', wide: true,
      intro: x ? '' : 'Start with the name and a line on what it is for — steps, milestones, things to buy and tools are added on the project page.',
      data: x ? Object.assign({}, x, { goalId: x.goalId || '' }) : { name: '', code: '', kind: 'research', status: 'planning', start: U.today(), end: '', lead: '', team: '', agency: '', budget: null, desc: '', objectives: '', keywords: '', goalId: '' },
      fields: [
        { k: 'name', label: 'Project name', req: true, ph: 'GlideSonde — balloon-deployed glider' },
        { k: 'code', label: 'Short code / file no.', ph: 'UAID/R&D/2026-03' },
        { k: 'kind', label: 'Kind', type: 'select', options: KINDS }, { k: 'status', label: 'Status', type: 'select', options: STATUS },
        { k: 'start', label: 'Start', type: 'date' }, { k: 'end', label: 'Target end', type: 'date' },
        { k: 'lead', label: 'Lead / PI' }, { k: 'team', label: 'Team', ph: 'Names, one after another' },
        { k: 'agency', label: 'Funding / sanction', ph: 'MoES, DST, in-house…' }, { k: 'budget', label: 'Sanctioned budget (₹)', type: 'number', min: 0 },
        { k: 'desc', label: 'Brief', type: 'textarea', rows: 3, ph: 'What the project is and why it matters' },
        { k: 'objectives', label: 'Objectives / deliverables', type: 'textarea', rows: 4, ph: 'One per line' },
        { k: 'keywords', label: 'Search words', ph: 'stratospheric glider radiosonde', hint: 'Used for Research papers and Science bits from this project.' },
        { k: 'goalId', label: 'Counts towards goal', type: 'select', options: goalOpts, hint: 'Its tasks count in that goal’s progress (Purpose → Goals).' },
      ],
      check: v => v.end && v.start && v.end < v.start ? 'The target end is before the start' : '',
      del: x ? async () => {
        const n = x.steps.length + x.milestones.length + x.buys.length;
        const ok = await ED.ui.confirm({ title: 'Delete “' + x.name + '”?', message: 'This deletes the project' + (n ? ' with its ' + [U.plural(x.steps.length, 'step'), U.plural(x.milestones.length, 'milestone'), U.plural(x.buys.length, 'item')].join(', ') : '') + ', and takes its tasks, calendar entries, bills and Money records with it. Undo is possible right after.', ok: 'Delete', danger: true });
        if (!ok) return false;
        ED.store.checkpoint('Delete project');
        x.milestones.forEach(m => FX().dropEvent(m));
        P().list = P().list.filter(p => p.id !== x.id);
        if (st().sel === x.id) st().sel = null;
        ED.store.commit(); ED.ui.undoToast('Project deleted');
      } : null,
      save(v, api) {
        ED.store.checkpoint('Project');
        v.goalId = v.goalId || null;
        if (x) { Object.assign(x, v); touch(x); if (x.status === 'dropped' || x.status === 'done') x.milestones.forEach(m => PR.calSync(x, m)); }
        else { const p = norm(Object.assign({ id: U.uid('pj'), color: COLORS[P().list.length % COLORS.length], createdAt: Date.now(), updatedAt: Date.now() }, v)); P().list.push(p); st().sel = p.id; }
        ED.store.commit(); api.close();
      },
    });
  };
  const sub = (pid, key, xid) => { const p = PR.get(pid); return { p, x: p && xid ? p[key].find(y => y.id === xid) : null }; };
  const delSub = (p, key, x, label) => async () => { ED.store.checkpoint('Delete'); if (key === 'milestones') FX().dropEvent(x); p[key] = p[key].filter(y => y.id !== x.id); touch(p); ED.store.commit(); ED.ui.undoToast(label + ' deleted'); };

  PR.editStep = (pid, sid) => {
    const { p, x } = sub(pid, 'steps', sid); if (!p) return;
    FX().form({
      title: x ? 'Step ' + (p.steps.indexOf(x) + 1) : 'Add a step', wide: true,
      data: x || { title: '', detail: '', tools: '', status: 'todo', start: '', due: '', plan: false },
      fields: [
        { k: 'title', label: 'Step', req: true, ph: 'Literature survey, CAD model, wind-tunnel test…' },
        { k: 'detail', label: 'What is done in it', type: 'textarea', rows: 5, ph: 'Brief details: method, inputs, outputs, who does what' },
        { k: 'tools', label: 'Tools used', ph: 'MATLAB, XFLR5, ANSYS Fluent, STM32, Python…', hint: 'Separate with commas. They are listed under Tools & methods too.' },
        { k: 'status', label: 'Status', type: 'select', options: SSTEP },
        { k: 'start', label: 'Start', type: 'date' }, { k: 'due', label: 'Due', type: 'date' },
        { k: 'plan', label: 'Put it in my daily tasks on the due date', type: 'check' },
      ],
      check: v => v.plan && !v.due ? 'Give a due date to put it in the daily tasks' : v.due && v.start && v.due < v.start ? 'The due date is before the start' : '',
      del: x ? delSub(p, 'steps', x, 'Step') : null,
      save(v, api) {
        ED.store.checkpoint('Step');
        if (v.status === 'done' && !(x && x.doneOn)) v.doneOn = U.today(); if (v.status !== 'done') v.doneOn = null;
        if (x) Object.assign(x, v); else p.steps.push(Object.assign({ id: U.uid('ps') }, v));
        touch(p); ED.store.commit(); api.close();
      },
    });
  };
  PR.editMs = (pid, mid) => {
    const { p, x } = sub(pid, 'milestones', mid); if (!p) return;
    FX().form({
      title: x ? 'Milestone' : 'Add a milestone',
      data: x ? Object.assign({ days: 8 }, x) : { title: '', due: p.end || '', notes: '', done: false, inTask: 'both', days: 8, cal: true },
      fields: [
        { k: 'title', label: 'Milestone', req: true, ph: 'Design review, first flight, paper submitted…' },
        { k: 'due', label: 'Deadline', type: 'date', req: true },
        { k: 'inTask', label: 'In my daily tasks', type: 'select', options: INTASK },
        { k: 'days', label: 'Days before', type: 'number', min: 1, max: 120, step: 1, hint: 'For the reminder before the deadline (8 days unless you change it).' },
        { k: 'cal', label: 'Show it in my calendar', type: 'check' },
        { k: 'done', label: 'Reached', type: 'check' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, ph: 'What has to be ready, who signs off…' },
      ],
      del: x ? delSub(p, 'milestones', x, 'Milestone') : null,
      save(v, api) {
        ED.store.checkpoint('Milestone');
        v.days = Math.max(1, Math.round(num(v.days) || 8));
        v.doneOn = v.done ? ((x && x.doneOn) || U.today()) : null;
        const m = x || { id: U.uid('pm') };
        Object.assign(m, v); if (!x) p.milestones.push(m);
        PR.calSync(p, m); touch(p);
        ED.store.commit(); api.close();
        ED.ui.toast('Milestone saved' + (m.inTask ? ' — in your daily tasks' : '') + (m.eventId ? ' and calendar' : ''));
      },
    });
  };
  PR.editBuy = (pid, bid) => {
    const { p, x } = sub(pid, 'buys', bid); if (!p) return;
    FX().form({
      title: x ? 'Item to procure' : 'Add an item to procure', wide: true,
      intro: 'Set the status to <b>Buy</b> when you decide to purchase it: it then appears as a task on the need-by date and in Finance → Bills. Ticking either one marks it bought and records the spending.',
      data: x ? Object.assign({ paidAmount: x.paid ? (num(x.paidAmount) || bTotal(x)) : null }, x) : { item: '', spec: '', qty: 1, unit: null, vendor: '', mode: '', need: '', status: 'list', paid: false, paidAmount: null, notes: '' },
      fields: [
        { k: 'item', label: 'Item', req: true, ph: 'Pixhawk 6X flight controller' },
        { k: 'spec', label: 'Specification', type: 'textarea', rows: 2, ph: 'Model, rating, make, accessories' },
        { k: 'qty', label: 'Quantity', type: 'number', min: 0, step: 1 }, { k: 'unit', label: 'Unit price (₹)', type: 'number', min: 0 },
        { k: 'vendor', label: 'Vendor / source' }, { k: 'mode', label: 'How', type: 'select', options: MODES },
        { k: 'need', label: 'Need by', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: BSTAT },
        { k: 'paid', label: 'Bought / paid', type: 'check' }, { k: 'paidAmount', label: 'Amount paid (₹)', type: 'number', min: 0, hint: 'Empty = quantity × unit price.' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, ph: 'Quotation no., file no., warranty…' },
      ],
      del: x ? delSub(p, 'buys', x, 'Item') : null,
      save(v, api) {
        ED.store.checkpoint('Procurement');
        if (v.paid && v.status === 'list') v.status = 'received';
        v.paidOn = v.paid ? ((x && x.paidOn) || U.today()) : null;
        if (!v.paid) v.paidAmount = null;
        if (v.status !== 'list') v.noPlan = false;
        if (x) Object.assign(x, v); else p.buys.push(Object.assign({ id: U.uid('pb') }, v));
        touch(p); ED.store.commit(); api.close();
        if (v.status !== 'list' && !v.paid) ED.ui.toast('In your daily tasks and Finance → Bills');
      },
    });
  };
  PR.editTool = (pid, tid) => {
    const { p, x } = sub(pid, 'tools', tid); if (!p) return;
    FX().form({
      title: x ? 'Tool / method' : 'Add a tool or method',
      data: x || { name: '', kind: 'software', version: '', link: '', notes: '' },
      fields: [{ k: 'name', label: 'Name', req: true, ph: 'ANSYS Fluent, Raspberry Pi 5, ERA5 data…' }, { k: 'kind', label: 'Kind', type: 'select', options: TKINDS }, { k: 'version', label: 'Version / model' }, { k: 'link', label: 'Link', ph: 'https://…' }, { k: 'notes', label: 'What it is used for', type: 'textarea', rows: 3 }],
      del: x ? delSub(p, 'tools', x, 'Tool') : null,
      save(v, api) { ED.store.checkpoint('Tool'); if (x) Object.assign(x, v); else p.tools.push(Object.assign({ id: U.uid('pt') }, v)); touch(p); ED.store.commit(); api.close(); },
    });
  };
  PR.editLog = (pid, lid) => {
    const { p, x } = sub(pid, 'log', lid); if (!p) return;
    FX().form({
      title: x ? 'Log entry' : 'Add to the log',
      data: x || { date: U.today(), text: '' },
      fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'text', label: 'What happened', type: 'textarea', rows: 5, req: true, ph: 'Progress, results, decisions, problems, meeting notes…' }],
      del: x ? delSub(p, 'log', x, 'Entry') : null,
      save(v, api) { ED.store.checkpoint('Project log'); if (x) Object.assign(x, v); else p.log.push(Object.assign({ id: U.uid('pl') }, v)); touch(p); ED.store.commit(); api.close(); },
    });
  };

  /* ---------------- pages ---------------- */
  const pill = (txt, cls) => '<span class="pr-pill ' + (cls || '') + '">' + e(txt) + '</span>';
  const bar = pct => '<span class="pr-bar" role="img" aria-label="' + pct + '% done"><i style="width:' + pct + '%"></i></span>';
  const daysTo = k => U.diffDays(U.today(), k);
  const whenTxt = k => { const n = daysTo(k); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? 'in ' + n + ' days' : -n + ' days late'; };
  const lines = s => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  const chipsOf = s => String(s || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean);
  const btn = (act, label, icon, extra, cls) => '<button type="button" class="btn small ' + (cls || '') + '" data-act="' + act + '"' + (extra || '') + '>' + (icon ? ED.icon(icon) : '') + label + '</button>';

  function left() {
    const list = PR.list(), s = st(), p = PR.cur();
    const shown = list.filter(x => s.show === 'all' || (x.status !== 'done' && x.status !== 'dropped') || x.id === s.sel);
    const cards = shown.map(x => {
      const t = PR.stats(x);
      return '<button type="button" class="pr-card' + (p && x.id === p.id ? ' on' : '') + '" data-act="pr-sel" data-id="' + e(x.id) + '" style="--pc:' + e(x.color || '#4f46e5') + '">' +
        '<span class="pr-cn">' + e(x.name) + '</span>' + pill(lab(STATUS, x.status), 'st-' + x.status) + bar(t.pct) +
        '<span class="hint pr-cs">' + t.pct + '% · ' + (t.next ? '🎯 ' + e(t.next.title) + ' ' + e(whenTxt(t.next.due)) : t.m ? 'all milestones reached' : 'no milestones yet') + (t.toBuy ? ' · 🛒 ' + t.toBuy : '') + '</span></button>';
    }).join('');
    const nDone = list.filter(x => x.status === 'done' || x.status === 'dropped').length;
    const switcher = '<div class="pr-cards">' + cards + '<button type="button" class="pr-card add" data-act="pr-new">' + ED.icon('plus') + '<span>New project</span></button></div>' +
      (nDone ? '<button type="button" class="link-btn pr-showall" data-act="pr-show">' + (s.show === 'all' ? 'Hide completed and dropped' : 'Show completed and dropped (' + nDone + ')') + '</button>' : '');
    if (!p) {
      return FX().page('pr', 'Projects', '', '<div class="pr-welcome"><span class="pr-big" aria-hidden="true">🧪</span><div><b>One place for each project</b><p class="hint">The brief and objectives, the work plan step by step with the tools used, milestones that come into your daily tasks and calendar, things to procure that go to the planner and Finance → Bills, the tools and methods, linked research papers and a dated log.</p>' +
        btn('pr-new', 'Start a project', 'plus', '', 'primary') + '</div></div>', 'pr-left');
    }
    const t = PR.stats(p);
    const meta = [lab(KINDS, p.kind), p.code, p.start ? U.fmtShort(p.start) + (p.end ? ' → ' + U.fmtShort(p.end) : '') : p.end ? 'by ' + U.fmtShort(p.end) : ''].filter(Boolean).map(e).join(' · ');
    const people = [p.lead ? '<b>Lead:</b> ' + e(p.lead) : '', p.team ? '<b>Team:</b> ' + e(p.team) : '', p.agency ? '<b>Funding:</b> ' + e(p.agency) + (num(p.budget) ? ' · ' + e(money(num(p.budget))) : '') : num(p.budget) ? '<b>Budget:</b> ' + e(money(num(p.budget))) : ''].filter(Boolean).join('<br>');
    const goal = p.goalId && M.goal(p.goalId);
    const hero = '<section class="pr-hero" style="--pc:' + e(p.color || '#4f46e5') + '"><div class="pr-hrow"><div class="grow"><h3 class="pr-name">' + e(p.name) + '</h3><div class="hint">' + meta + '</div></div>' + pill(lab(STATUS, p.status), 'st-' + p.status) +
      '<button type="button" class="icon-btn sm" data-act="pr-edit" data-id="' + e(p.id) + '" title="Change or delete the project" aria-label="Change the project">' + ED.icon('pencil') + '</button></div>' +
      '<div class="pr-prog">' + bar(t.pct) + '<span class="num"><b>' + t.pct + '%</b></span></div>' +
      (p.desc ? '<p class="pr-desc">' + e(p.desc) + '</p>' : '') +
      (lines(p.objectives).length ? '<h4 class="pr-h4">Objectives</h4><ul class="pr-obj">' + lines(p.objectives).map(x => '<li>' + e(x.replace(/^[-•*\d.)\s]+/, '')) + '</li>').join('') + '</ul>' : '') +
      (people ? '<p class="pr-people">' + people + '</p>' : '') +
      (goal ? '<p class="hint">' + ED.icon('target') + ' Counts towards the goal <button type="button" class="link-btn" data-act="pr-goal">' + e(goal.title) + '</button></p>' : '') +
      '<div class="pr-links">' + btn('pr-papers', 'Research papers', 'book') + btn('pr-bits', 'Science bits', 'sparkle') + '</div></section>';
    const steps = p.steps.map((x, i) => {
      const late = x.status !== 'done' && x.due && x.due < U.today();
      return '<li class="pr-step s-' + e(x.status || 'todo') + '"><button type="button" class="pr-sn" data-act="pr-step-st" data-id="' + e(x.id) + '" title="' + e(lab(SSTEP, x.status)) + ' — click to change" aria-label="Step ' + (i + 1) + ': ' + e(lab(SSTEP, x.status)) + '">' + (x.status === 'done' ? ED.icon('check') : i + 1) + '</button>' +
        '<div class="pr-sb"><div class="pr-st"><button type="button" class="plain-btn" data-act="pr-step" data-id="' + e(x.id) + '"><b>' + e(x.title) + '</b></button>' +
        (x.due ? '<span class="hint num' + (late ? ' pr-late' : '') + '">' + (x.status === 'done' ? 'done ' + e(U.fmtDM(x.doneOn || x.due)) : 'due ' + e(U.fmtDM(x.due)) + (late ? ' · late' : '')) + '</span>' : '') + (x.plan && x.due ? '<span class="hint" title="In the daily tasks">' + ED.icon('calendar') + '</span>' : '') + '</div>' +
        (x.detail ? '<p class="pr-sd">' + e(x.detail) + '</p>' : '') + (chipsOf(x.tools).length ? '<div class="pr-tools">' + chipsOf(x.tools).map(c => '<span class="pr-tool">' + e(c) + '</span>').join('') + '</div>' : '') + '</div>' +
        '<span class="pr-mv"><button type="button" class="icon-btn sm" data-act="pr-step-mv" data-id="' + e(x.id) + '" data-d="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ED.icon('chevU') + '</button><button type="button" class="icon-btn sm" data-act="pr-step-mv" data-id="' + e(x.id) + '" data-d="1" aria-label="Move down"' + (i < p.steps.length - 1 ? '' : ' disabled') + '>' + ED.icon('chevD') + '</button></span></li>';
    }).join('');
    const work = '<h3 class="gh pr-gh">Work plan <span class="hint num">· ' + t.sd + '/' + t.s + ' steps done</span><span class="grow"></span>' + btn('pr-step', 'Add a step', 'plus', '', 'primary') + '</h3>' +
      (steps ? '<ol class="pr-steps">' + steps + '</ol>' : '<p class="hint">Break the project into steps — what is done in each and with which tools. Click a step’s number to move it from To do → In progress → Done.</p>');
    return FX().page('pr', 'Projects', '', switcher + hero + work, 'pr-left');
  }

  const TABS = [['ms', 'Milestones'], ['buy', 'To procure'], ['tools', 'Tools & methods'], ['links', 'Research links'], ['log', 'Log'], ['time', 'Timeline']];
  function right() {
    const p = PR.cur(), s = st();
    if (!p) return '<div class="xp pr-r"><div class="pg-head"><h2 class="pg-title">Project desk</h2></div><div class="st-scroll scroll"><p class="hint">Start a project on the left page.</p></div></div>';
    const t = PR.stats(p), tab = TABS.some(x => x[0] === s.tab) ? s.tab : 'ms';
    const left = p.end ? daysTo(p.end) : null;
    const tiles = '<div class="tiles pr-tiles">' + FX().tile('Progress', t.pct + '%', t.sd + '/' + t.s + ' steps · ' + t.md + '/' + t.m + ' milestones') +
      FX().tile('Next milestone', t.next ? e(whenTxt(t.next.due)) : '—', t.next ? e(t.next.title) : t.m ? 'all reached' : 'none set') +
      FX().tile('Procurement', e(money(t.spent)), 'spent of ' + e(money(t.planned)) + ' listed' + (num(p.budget) ? ' · budget ' + e(money(num(p.budget))) : '')) +
      FX().tile(left == null ? 'Target end' : left >= 0 ? 'Days left' : 'Past the end', left == null ? '—' : String(Math.abs(left)), p.end ? e(U.fmtShort(p.end)) : 'no end date') + '</div>';
    const seg = '<div class="seg st-seg pr-seg" role="group" aria-label="Show">' + TABS.map(x => '<button type="button" data-act="pr-tab" data-k="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + e(x[1]) + (x[0] === 'buy' && t.toBuy ? ' <span class="num pr-n">' + t.toBuy + '</span>' : '') + '</button>').join('') + '</div>';
    const body = ({ ms: msTab, buy: buyTab, tools: toolsTab, links: linksTab, log: logTab, time: timeTab })[tab](p, t);
    return '<div class="xp pr-r"><div class="pg-head"><h2 class="pg-title">' + e(p.name) + '</h2>' + seg + '</div><div class="st-scroll scroll" data-keep-scroll="pr-r-' + tab + '">' + tiles + body + '</div></div>';
  }

  function msTab(p) {
    const l = p.milestones.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || String(a.due || '9999').localeCompare(String(b.due || '9999')));
    const rows = l.map(m => {
      const n = m.due ? daysTo(m.due) : null, late = !m.done && n != null && n < 0;
      const inT = m.inTask === 'both' ? 'daily tasks: ' + U.plural(m.days || 8, 'day') + ' before & on the day' : m.inTask === 'before' ? 'daily tasks: ' + U.plural(m.days || 8, 'day') + ' before' : m.inTask === 'due' ? 'daily tasks: on the day' : '';
      return '<li class="pr-ms' + (m.done ? ' done' : '') + (late ? ' late' : '') + '"><button type="button" class="pr-tick" data-act="pr-ms-tick" data-id="' + e(m.id) + '" aria-pressed="' + !!m.done + '" aria-label="' + (m.done ? 'Reached — click to undo' : 'Mark as reached') + '">' + ED.icon('check') + '</button>' +
        '<button type="button" class="plain-btn grow pr-msb" data-act="pr-ms" data-id="' + e(m.id) + '"><b>' + e(m.title) + '</b><span class="hint">' + (m.due ? e(U.fmtShort(m.due)) + ' · ' + (m.done ? 'reached' + (m.doneOn ? ' ' + e(U.fmtDM(m.doneOn)) : '') : e(whenTxt(m.due))) : 'no deadline') + '</span>' +
        '<span class="pr-msi">' + (inT ? '<span class="hint">' + ED.icon('check') + ' ' + e(inT) + '</span>' : '') + (m.eventId ? '<span class="hint">' + ED.icon('calendar') + ' calendar</span>' : '') + '</span>' + (m.notes ? '<span class="hint pr-msn">' + e(m.notes) + '</span>' : '') + '</button></li>';
    }).join('');
    return '<div class="row-btns">' + btn('pr-ms', 'Add a milestone', 'plus', '', 'primary') + '</div>' +
      (rows ? '<ul class="pr-mss">' + rows + '</ul>' : '<p class="hint">Milestones with deadlines — each can come into your daily tasks on the deadline, some days before it (8 by default), or both, and into your calendar.</p>');
  }
  function buyTab(p, t) {
    const l = p.buys.slice().sort((a, b) => (a.paid ? 1 : 0) - (b.paid ? 1 : 0) || String(a.need || '9999').localeCompare(String(b.need || '9999')));
    const rows = l.map(b => {
      const on = b.status && b.status !== 'list', late = on && !b.paid && b.need && b.need < U.today();
      return '<li class="pr-buy' + (b.paid ? ' paid' : '') + (late ? ' late' : '') + '"><label class="switch pr-bsw" title="' + (on ? 'In the planner and Bills — switch off to only keep it listed' : 'Select for purchase: puts it in the planner and Finance → Bills') + '"><input type="checkbox" data-change="pr-buy-on" data-id="' + e(b.id) + '"' + (on ? ' checked' : '') + (b.paid ? ' disabled' : '') + '><span class="track"></span></label>' +
        '<button type="button" class="plain-btn grow pr-bb" data-act="pr-buy" data-id="' + e(b.id) + '"><b>' + e(b.item) + (num(b.qty) > 1 ? ' × ' + e(b.qty) : '') + '</b>' + (b.spec ? '<span class="hint">' + e(b.spec) + '</span>' : '') +
        '<span class="hint">' + e([lab(BSTAT, b.status || 'list').replace(/ —.*| \(.*/, ''), lab(MODES, b.mode || ''), b.vendor, b.need ? 'need by ' + U.fmtDM(b.need) : ''].filter(x => x && x !== '—').join(' · ')) + (b.noPlan && on ? ' · <b>taken out of the planner</b>' : '') + '</span></button>' +
        '<span class="num pr-amt">' + (b.paid ? '<b>' + e(money(num(b.paidAmount) || bTotal(b))) + '</b><span class="hint">paid</span>' : bTotal(b) ? e(money(bTotal(b))) : '—') + '</span></li>';
    }).join('');
    const sum = p.buys.length ? '<div class="pr-bsum"><span>Listed <b class="num">' + e(money(t.planned)) + '</b></span><span>Spent <b class="num">' + e(money(t.spent)) + '</b></span>' + (num(p.budget) ? '<span>Budget left <b class="num">' + e(money(num(p.budget) - t.spent)) + '</b></span>' : '') + '<span>To buy <b class="num">' + t.toBuy + '</b></span></div>' : '';
    return '<div class="row-btns">' + btn('pr-buy', 'Add an item', 'plus', '', 'primary') + btn('pr-bills', 'Finance → Bills', 'receipt') + '</div>' + sum +
      (rows ? '<ul class="pr-buys">' + rows + '</ul><p class="hint">Switch an item on to select it for purchase: it becomes a task on its need-by day and a planned purchase in Finance → Bills. Ticking the task or the bill marks it bought; the spending goes to Money records.</p>'
        : '<p class="hint">Equipment, components, software licences, services — with specification, quantity, price, vendor and GeM / tender / direct. Switch one on when you decide to buy it.</p>');
  }
  function toolsTab(p) {
    const fromSteps = {}; p.steps.forEach((s, i) => chipsOf(s.tools).forEach(c => { (fromSteps[c.toLowerCase()] = fromSteps[c.toLowerCase()] || { n: c, at: [] }).at.push(i + 1); }));
    const listed = new Set(p.tools.map(x => (x.name || '').toLowerCase()));
    const rows = p.tools.map(x => '<li><button type="button" class="plain-btn xp-li" data-act="pr-tool" data-id="' + e(x.id) + '"><span class="pr-tk">' + e(lab(TKINDS, x.kind)) + '</span><span class="grow"><b>' + e(x.name) + '</b>' + (x.version ? ' <span class="hint">' + e(x.version) + '</span>' : '') + (x.notes ? '<span class="hint pr-tn">' + e(x.notes) + '</span>' : '') +
      (fromSteps[(x.name || '').toLowerCase()] ? '<span class="hint">used in step ' + fromSteps[(x.name || '').toLowerCase()].at.join(', ') + '</span>' : '') + '</span></button>' + (x.link ? FX().link(x.link) : '') + '</li>').join('');
    const extra = Object.values(fromSteps).filter(x => !listed.has(x.n.toLowerCase()));
    return '<div class="row-btns">' + btn('pr-tool', 'Add a tool or method', 'plus', '', 'primary') + '</div>' +
      (rows ? '<ul class="xp-list pr-tlist">' + rows + '</ul>' : '<p class="hint">Software, boards, instruments, datasets, libraries and methods used in the project — with versions and links.</p>') +
      (extra.length ? '<h4 class="pr-h4">Named in the steps</h4><div class="pr-tools">' + extra.map(x => '<button type="button" class="pr-tool add" data-act="pr-tool-add" data-name="' + e(x.n) + '" title="Add to the list">' + e(x.n) + ' <span class="hint">step ' + x.at.join(', ') + '</span> ' + ED.icon('plus') + '</button>').join('') + '</div>' : '');
  }
  function linksTab(p) {
    const r = D().research || { topics: [], papers: [] };
    const tops = (r.topics || []).filter(t => !t.parentId).sort((a, b) => a.name.localeCompare(b.name));
    const chips = tops.length ? '<div class="pr-tchips">' + tops.map(t => '<button type="button" class="rs-chip' + (p.topics.indexOf(t.id) >= 0 ? ' on' : '') + '" data-act="pr-topic" data-id="' + e(t.id) + '" aria-pressed="' + (p.topics.indexOf(t.id) >= 0) + '">' + e(t.name) + '</button>').join('') + '</div>' : '<p class="hint">No research topics yet — make them on Study → Year → Research papers.</p>';
    const ids = new Set(); p.topics.forEach(id => { ids.add(id); (r.topics || []).filter(t => t.parentId === id).forEach(t => ids.add(t.id)); });
    const papers = (r.papers || []).filter(x => ids.has(x.topicId)).sort((a, b) => +(b.year || 0) - +(a.year || 0));
    const plist = papers.length ? '<ul class="pr-papers">' + papers.slice(0, 40).map(x => '<li><span class="pr-ps st-' + e(x.status || 'toread') + '">' + e((ED.research && ED.research.STATUS.find(y => y[0] === (x.status || 'toread')) || ['', ''])[1]) + '</span><span class="grow">' + ((x.link || x.doi) ? '<a href="' + e(x.link || 'https://doi.org/' + x.doi) + '" target="_blank" rel="noopener noreferrer">' + e(x.title) + '</a>' : e(x.title)) + '<span class="hint">' + e([x.authors, x.venue, x.year].filter(Boolean).join(' · ')) + '</span></span></li>').join('') + '</ul>' : '<p class="hint">' + (p.topics.length ? 'No papers saved under these topics yet.' : 'Pick the topics this project draws on.') + '</p>';
    const goal = p.goalId && M.goal(p.goalId);
    return '<h3 class="gh">Research topics</h3>' + chips + '<h3 class="gh">Papers for this project <span class="hint num">· ' + papers.length + '</span></h3>' + plist +
      '<div class="row-btns">' + btn('pr-papers', 'Search latest papers', 'search') + btn('pr-bits', 'Science bits', 'sparkle') + '</div>' +
      '<h3 class="gh">Elsewhere in the diary</h3><ul class="pr-else"><li>' + ED.icon('target') + (goal ? ' Goal: <button type="button" class="link-btn" data-act="pr-goal">' + e(goal.title) + '</button>' : ' No goal — set one with ✎ on the left page so the tasks count towards it.') + '</li>' +
      '<li>' + ED.icon('calendar') + ' Tasks go under the role <b>Research &amp; Projects</b> in the daily planner.</li><li>' + ED.icon('receipt') + ' Purchases: <button type="button" class="link-btn" data-act="pr-bills">Finance → Bills</button> (Planned purchases).</li></ul>';
  }
  function logTab(p) {
    const l = p.log.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return '<div class="row-btns">' + btn('pr-log', 'Add to the log', 'plus', '', 'primary') + '</div>' +
      (l.length ? '<ol class="pr-log">' + l.map(x => '<li><button type="button" class="plain-btn" data-act="pr-log" data-id="' + e(x.id) + '"><span class="pr-ld num">' + e(U.fmtShort(x.date)) + '</span><span class="pr-lt">' + e(x.text) + '</span></button></li>').join('') + '</ol>' : '<p class="hint">A dated diary of the project: progress, results, decisions, problems and meeting notes.</p>');
  }
  function timeTab(p) {
    const ds = [p.start, p.end].concat(p.steps.map(s => s.start), p.steps.map(s => s.due), p.milestones.map(m => m.due)).filter(U.isKey).sort();
    if (ds.length < 2) return '<p class="hint">Give the project a start and target end, and steps and milestones dates, to see them on a timeline.</p>';
    const a = ds[0], z = ds[ds.length - 1], span = Math.max(1, U.diffDays(a, z)), x = k => (100 * U.diffDays(a, k) / span).toFixed(2) + '%';
    const today = U.today(), now = today >= a && today <= z ? '<i class="pr-now" style="left:' + x(today) + '" title="Today"></i>' : '';
    const months = []; for (let k = a.slice(0, 7) + '-01'; k <= z; k = U.addDays(k, 32).slice(0, 7) + '-01') if (k >= a) months.push(k);
    const rows = p.steps.map((s, i) => {
      const s0 = U.isKey(s.start) ? s.start : U.isKey(s.due) ? s.due : null, s1 = U.isKey(s.due) ? s.due : s0;
      if (!s0) return '';
      return '<div class="pr-tr"><span class="pr-tl" title="' + e(s.title) + '">' + (i + 1) + '. ' + e(s.title) + '</span><span class="pr-tt">' + now + '<i class="pr-tb s-' + e(s.status || 'todo') + '" style="left:' + x(s0) + ';width:max(6px,calc(' + x(s1) + ' - ' + x(s0) + '))"></i></span></div>';
    }).join('');
    const ms = p.milestones.filter(m => U.isKey(m.due)).map(m => '<i class="pr-dm' + (m.done ? ' done' : '') + '" style="left:' + x(m.due) + '" title="' + e(m.title + ' · ' + U.fmtShort(m.due)) + '"></i>').join('');
    return '<div class="pr-time"><div class="pr-tr pr-thead"><span class="pr-tl"></span><span class="pr-tt">' + months.map(k => '<span class="pr-mo" style="left:' + x(k) + '">' + U.MON[+k.slice(5, 7) - 1] + (k.slice(5, 7) === '01' || k === months[0] ? ' ' + k.slice(0, 4) : '') + '</span>').join('') + '</span></div>' +
      '<div class="pr-tr"><span class="pr-tl"><b>Milestones</b></span><span class="pr-tt">' + now + ms + '</span></div>' + rows + '</div>' +
      '<div class="pr-key hint"><span><i class="pr-tb s-todo"></i> to do</span><span><i class="pr-tb s-doing"></i> in progress</span><span><i class="pr-tb s-done"></i> done</span><span><i class="pr-dm"></i> milestone</span>' + (now ? '<span><i class="pr-now k"></i> today</span>' : '') + '</div>';
  }

  ED.views = ED.views || {};
  ED.views.projects = { id: 'projects', label: 'Projects', left, right };

  /* ---------------- actions ---------------- */
  const redraw = () => ED.app.render();
  A['pr-new'] = () => PR.edit(null);
  A['pr-edit'] = el => PR.edit(el.dataset.id);
  A['pr-sel'] = el => { st().sel = el.dataset.id; redraw(); };
  A['pr-show'] = () => { const s = st(); s.show = s.show === 'all' ? 'open' : 'all'; redraw(); };
  A['pr-tab'] = el => { st().tab = el.dataset.k; ED.app.renderPage('right'); };
  A['pr-step'] = el => { const p = PR.cur(); if (p) PR.editStep(p.id, el.dataset.id || null); };
  A['pr-ms'] = el => { const p = PR.cur(); if (p) PR.editMs(p.id, el.dataset.id || null); };
  A['pr-buy'] = el => { const p = PR.cur(); if (p) PR.editBuy(p.id, el.dataset.id || null); };
  A['pr-tool'] = el => { const p = PR.cur(); if (p) PR.editTool(p.id, el.dataset.id || null); };
  A['pr-log'] = el => { const p = PR.cur(); if (p) PR.editLog(p.id, el.dataset.id || null); };
  A['pr-step-st'] = el => {
    const p = PR.cur(), x = p && p.steps.find(y => y.id === el.dataset.id); if (!x) return;
    ED.store.checkpoint('Step');
    x.status = x.status === 'todo' || !x.status ? 'doing' : x.status === 'doing' ? 'done' : 'todo';
    x.doneOn = x.status === 'done' ? U.today() : null; touch(p); ED.store.commit();
  };
  A['pr-step-mv'] = el => {
    const p = PR.cur(); if (!p) return; const i = p.steps.findIndex(y => y.id === el.dataset.id), j = i + (+el.dataset.d);
    if (i < 0 || j < 0 || j >= p.steps.length) return;
    ED.store.checkpoint('Move step'); const t = p.steps[i]; p.steps[i] = p.steps[j]; p.steps[j] = t; touch(p); ED.store.commit();
  };
  A['pr-ms-tick'] = el => {
    const p = PR.cur(), m = p && p.milestones.find(y => y.id === el.dataset.id); if (!m) return;
    ED.store.checkpoint('Milestone'); m.done = !m.done; m.doneOn = m.done ? U.today() : null; PR.calSync(p, m); touch(p); ED.store.commit();
    if (m.done) ED.ui.toast('🎯 ' + m.title + ' — reached');
  };
  CH['pr-buy-on'] = el => {
    const p = PR.cur(), b = p && p.buys.find(y => y.id === el.dataset.id); if (!b) return;
    ED.store.checkpoint('Procurement');
    if (el.checked) { b.status = 'buy'; b.noPlan = false; if (!U.isKey(b.need)) b.need = U.today(); } else { b.status = 'list'; }
    touch(p); ED.store.commit();
    ED.ui.toast(el.checked ? b.item + ' — in your daily tasks (' + U.fmtDM(b.need) + ') and Finance → Bills' : b.item + ' — only listed now (out of the planner and Bills)');
  };
  A['pr-tool-add'] = el => { const p = PR.cur(); if (!p) return; ED.store.checkpoint('Tool'); p.tools.push({ id: U.uid('pt'), name: el.dataset.name, kind: 'software', version: '', link: '', notes: '' }); touch(p); ED.store.commit(); };
  A['pr-topic'] = el => { const p = PR.cur(); if (!p) return; ED.store.checkpoint('Project topics'); const i = p.topics.indexOf(el.dataset.id); if (i >= 0) p.topics.splice(i, 1); else p.topics.push(el.dataset.id); touch(p); ED.store.commit(); };
  A['pr-bills'] = () => { (ED.state.fin = ED.state.fin || {}).rtab = 'bills'; ED.go.tab('finance'); };
  A['pr-goal'] = () => ED.go.tab('goals');
  const words = p => (p.keywords || '').trim() || p.name;
  const toStudy = (ytab, q, topicId) => { (ED.state.study = ED.state.study || {}).ytab = ytab; const rs = ED.state.rs || (ED.state.rs = { res: {}, tab: 'latest', filter: 'all' }); if (ytab === 'research') { rs.topic = topicId || null; rs.sub = null; rs.q = q; } else { const sb = ED.state.sb || (ED.state.sb = { res: {}, tab: 'top' }); sb.q = q; sb.topic = null; } ED.go.tab('studyYear'); };
  A['pr-papers'] = () => { const p = PR.cur(); if (p) toStudy('research', words(p), p.topics[0] || null); };
  A['pr-bits'] = () => { const p = PR.cur(); if (p) toStudy('bits', words(p)); };
})();
