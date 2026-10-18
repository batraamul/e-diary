/* E-Diary — Planner → Bucket List: things to do, see, learn or achieve in life.
   Data (ED.store.data.bucket): { list: [ { id, title, cat, status: 'dream'|'planned'|'doing'|'done', target (year 'YYYY' or date),
                                            cost, why, steps: [ { id, text, done, taskId } ], notes, doneOn, createdAt, updatedAt } ] }
   A step can become a planner task; ticking that task in the planner ticks the step. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const FX = () => ED.fx, M = ED.model;
  const A = (ED.actions = ED.actions || {}), CHG = (ED.changes = ED.changes || {});
  const B = () => { const d = ED.store.data; if (!d.bucket || typeof d.bucket !== 'object') d.bucket = { list: [] }; if (!Array.isArray(d.bucket.list)) d.bucket.list = []; return d.bucket; };
  const st = () => ED.state.bucket || (ED.state.bucket = { cat: '', show: 'open' });
  const BK = (ED.bucket = {});

  const CATS = ['Travel & places', 'Adventure', 'Learning & skills', 'Career & research', 'Writing & publishing', 'Family & friends', 'Health & fitness', 'Giving back', 'Experiences', 'Home & things', 'Other'];
  const STATUS = [['dream', 'Someday', 'star'], ['planned', 'Planned', 'calendar'], ['doing', 'In progress', 'clock'], ['done', 'Done', 'check']];
  const sName = v => (STATUS.find(x => x[0] === v) || STATUS[0])[1];
  const IDEAS = [
    ['Travel & places', 'See the Himalayas from Ladakh'], ['Travel & places', 'Visit all the Jyotirlingas'], ['Travel & places', 'Northern lights in Norway'],
    ['Adventure', 'Paragliding at Bir Billing'], ['Adventure', 'Trek to Everest Base Camp'], ['Adventure', 'Scuba dive in the Andamans'],
    ['Learning & skills', 'Learn to play a musical instrument'], ['Learning & skills', 'Get a private pilot licence'], ['Learning & skills', 'Learn a new language'],
    ['Career & research', 'Publish in a Q1 journal'], ['Career & research', 'File a patent'], ['Career & research', 'Give a keynote at a conference'],
    ['Writing & publishing', 'Write and publish a book'], ['Health & fitness', 'Run a half marathon'], ['Giving back', 'Mentor ten students'], ['Family & friends', 'A long holiday with the whole family'],
  ];

  const item = id => B().list.find(x => x.id === id) || null;
  const prog = x => { const s = x.steps || []; return s.length ? s.filter(y => y.done).length / s.length : (x.status === 'done' ? 1 : 0); };
  const tgt = x => !x.target ? '' : /^\d{4}$/.test(x.target) ? x.target : U.isKey(x.target) ? U.fmtShort(x.target) : x.target;
  const overdue = x => x.status !== 'done' && x.target && (/^\d{4}$/.test(x.target) ? +x.target < +U.today().slice(0, 4) : U.isKey(x.target) && x.target < U.today());
  // a step's planner task, ticked there, ticks the step
  const syncSteps = () => {
    let ch = false;
    B().list.forEach(x => (x.steps || []).forEach(s => { if (!s.taskId) return; const t = M.task(s.taskId); if (!t) { delete s.taskId; ch = true; return; } const d = M.isClosed(t.status); if (d && !s.done) { s.done = true; ch = true; } }));
    return ch;
  };

  const card = x => {
    const p = prog(x), steps = x.steps || [];
    return '<article class="bk-card' + (x.status === 'done' ? ' done' : '') + '">' +
      '<div class="bk-h"><button type="button" class="bk-tick" data-act="bk-done" data-id="' + e(x.id) + '" aria-pressed="' + (x.status === 'done') + '" aria-label="' + (x.status === 'done' ? 'Mark as not done' : 'Mark as done') + '">' + (x.status === 'done' ? ED.icon('check') : '') + '</button>' +
      '<button type="button" class="bk-title link-btn" data-act="bk-edit" data-id="' + e(x.id) + '"><b>' + e(x.title) + '</b></button>' +
      '<button type="button" class="icon-btn sm" data-act="bk-menu" data-id="' + e(x.id) + '" aria-label="More" title="More">' + ED.icon('more') + '</button></div>' +
      '<div class="bk-tags"><span class="chip bk-st bk-' + e(x.status || 'dream') + '">' + e(sName(x.status)) + '</span>' + (x.target ? '<span class="hint' + (overdue(x) ? ' err-text' : '') + '">' + ED.icon('flag') + 'by ' + e(tgt(x)) + '</span>' : '') +
      (x.cost ? '<span class="hint">₹' + e(Number(x.cost).toLocaleString('en-IN')) + '</span>' : '') + (x.status === 'done' && x.doneOn ? '<span class="hint">done ' + e(U.fmtShort(x.doneOn)) + '</span>' : '') + '</div>' +
      (x.why ? '<p class="hint bk-why">' + e(x.why) + '</p>' : '') +
      (steps.length ? '<div class="ls-bar"><i style="width:' + Math.round(p * 100) + '%"></i></div><ul class="bk-steps">' + steps.map(s => '<li><label class="chip-check"><input type="checkbox" data-change="bk-step" data-id="' + e(x.id) + '" data-s="' + e(s.id) + '"' + (s.done ? ' checked' : '') + '><span>' + e(s.text) + '</span></label>' +
        (s.taskId ? '<span class="hint">' + ED.icon('checkSq') + 'in planner</span>' : (s.done ? '' : '<button type="button" class="link-btn hint" data-act="bk-task" data-id="' + e(x.id) + '" data-s="' + e(s.id) + '">make a task</button>')) + '</li>').join('') + '</ul>' : '') +
      '</article>';
  };

  const view = {
    id: 'bucket', label: 'Bucket List',
    left() {
      const s = st(), all = B().list, q = (s.q || '').toLowerCase();
      const list = all.filter(x => (!s.cat || x.cat === s.cat) && (s.show === 'all' || (s.show === 'done' ? x.status === 'done' : x.status !== 'done')) && (!q || [x.title, x.why, x.notes, x.cat].join(' ').toLowerCase().indexOf(q) >= 0));
      const yr = U.today().slice(0, 4);
      const tiles = '<div class="tiles xp-tiles">' + FX().tile('On the list', String(all.filter(x => x.status !== 'done').length), U.plural(all.length, 'item') + ' in all') +
        FX().tile('Done', String(all.filter(x => x.status === 'done').length), all.length ? Math.round(all.filter(x => x.status === 'done').length / all.length * 100) + '% of the list' : '') +
        FX().tile('In progress', String(all.filter(x => x.status === 'doing').length), '') +
        FX().tile('Target ' + yr, String(all.filter(x => x.status !== 'done' && String(x.target || '').slice(0, 4) === yr).length), 'still to do this year', all.some(overdue) ? 'warn' : '') + '</div>';
      const cats = Array.from(new Set(CATS.concat(all.map(x => x.cat).filter(Boolean))));
      const filters = '<div class="xp-filters">' +
        '<select class="field" data-change="bk-filter" data-k="show" aria-label="Show">' + [['open', 'Still to do'], ['done', 'Done'], ['all', 'Everything']].map(o => FX().opt(o[0], o[1], s.show === o[0])).join('') + '</select>' +
        '<select class="field" data-change="bk-filter" data-k="cat" aria-label="Category"><option value="">All categories</option>' + cats.map(c => FX().opt(c, c, s.cat === c)).join('') + '</select>' +
        '<input class="field" type="search" placeholder="Search" value="' + e(s.q || '') + '" data-change="bk-q" aria-label="Search the bucket list"></div>';
      const groups = new Map();
      list.slice().sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(a.target || '9999').localeCompare(String(b.target || '9999')) || a.title.localeCompare(b.title))
        .forEach(x => { const g = x.cat || 'Other'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(x); });
      const order = Array.from(groups.keys()).sort((a, b) => (cats.indexOf(a) < 0 ? 99 : cats.indexOf(a)) - (cats.indexOf(b) < 0 ? 99 : cats.indexOf(b)));
      const body = tiles + filters + (list.length ? order.map(g => '<h3 class="gh">' + e(g) + ' <span class="hint num">· ' + groups.get(g).length + '</span></h3><div class="bk-grid">' + groups.get(g).map(card).join('') + '</div>').join('')
        : '<div class="empty">' + ED.icon('star') + '<div><b>' + (all.length ? 'Nothing matches.' : 'Your bucket list is empty.') + '</b>' + (all.length ? '' : '<br>Add the places, skills and milestones you want in your life — or pick from the ideas on the right.') + '</div></div>');
      return FX().page('bk', 'Bucket list', '<button type="button" class="btn small primary" data-act="bk-new">' + ED.icon('plus') + 'Add</button>', body, 'bk-left');
    },
    right() {
      const all = B().list;
      const cats = Array.from(new Set(all.map(x => x.cat || 'Other')));
      const meters = cats.length ? CH().meters({ title: 'Done by category', rows: cats.map(c => { const l = all.filter(x => (x.cat || 'Other') === c), d = l.filter(x => x.status === 'done').length; return { label: c, value: d, valueLabel: d + '/' + l.length }; }), max: Math.max(1, ...cats.map(c => all.filter(x => (x.cat || 'Other') === c).length)) }) : '';
      const have = new Set(all.map(x => x.title.toLowerCase()));
      const ideas = IDEAS.filter(x => !have.has(x[1].toLowerCase()));
      const recent = all.filter(x => x.status === 'done').sort((a, b) => String(b.doneOn || '').localeCompare(String(a.doneOn || ''))).slice(0, 8);
      return '<div class="xp bk-r"><div class="pg-head"><h2 class="pg-title">Progress & ideas</h2></div><div class="st-scroll scroll" data-keep-scroll="bk-right">' + meters +
        (recent.length ? '<h3 class="gh">Achieved</h3><ul class="bk-ach">' + recent.map(x => '<li>' + ED.icon('check') + '<span class="grow">' + e(x.title) + '</span><span class="hint num">' + e(x.doneOn ? U.fmtShort(x.doneOn) : '') + '</span></li>').join('') + '</ul>' : '') +
        (ideas.length ? '<h3 class="gh">Ideas to start with</h3><p class="hint">Click one to add it; change it to suit you.</p><div class="bk-ideas">' + ideas.map(x => '<button type="button" class="chip bk-idea" data-act="bk-idea" data-cat="' + e(x[0]) + '" data-t="' + e(x[1]) + '">' + ED.icon('plus') + e(x[1]) + '</button>').join('') + '</div>' : '') +
        '<p class="hint">Give an item steps to make it real; any step can become a planner task with a date, and ticking it there ticks it here.</p></div></div>';
    },
    mount() { if (syncSteps()) ED.store.commit({ silent: true }); },
  };
  const CH = () => ED.charts;

  BK.edit = (id, pre) => {
    const x = id ? item(id) : null;
    const d = x ? Object.assign({}, x, { steps: (x.steps || []).map(s => s.text).join('\n') }) : Object.assign({ title: '', cat: '', status: 'dream', target: '', cost: '', why: '', steps: '', notes: '' }, pre || {});
    FX().form({
      title: x ? 'Bucket list item' : 'Add to the bucket list', wide: true, data: d,
      fields: [
        { k: 'title', label: 'What', req: true, ph: 'e.g. Trek to Everest Base Camp' },
        { k: 'cat', label: 'Category', list: CATS, ph: 'Choose or type' },
        { k: 'status', label: 'Status', type: 'select', options: STATUS.map(s => [s[0], s[1]]) },
        { k: 'target', label: 'By when', ph: 'a year (2028) or a date (2027-05-01)' },
        { k: 'cost', label: 'Rough cost (₹)', type: 'number', min: 0 },
        { k: 'why', label: 'Why it matters', ph: 'optional' },
        { k: 'steps', label: 'Steps', type: 'textarea', rows: 4, ph: 'One step per line, e.g.\nGet fit: 5 km runs\nBook leave\nBook the trek' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      check: v => v.target && !/^\d{4}$/.test(v.target) && !U.isKey(v.target) ? 'Give “By when” as a year (2028) or a date (2027-05-01)' : '',
      del: x ? async () => { ED.store.checkpoint('Delete bucket item'); B().list = B().list.filter(y => y !== x); ED.store.commit(); ED.ui.undoToast('Removed: ' + x.title); } : null,
      save(v, api) {
        ED.store.checkpoint(x ? 'Bucket item' : 'New bucket item');
        const old = x ? (x.steps || []) : [];
        const steps = String(v.steps || '').split('\n').map(t => t.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean).map(t => old.find(s => s.text === t) || { id: U.uid('bs'), text: t, done: false });
        const o = { title: v.title.trim(), cat: (v.cat || '').trim(), status: v.status || 'dream', target: (v.target || '').trim(), cost: v.cost || '', why: (v.why || '').trim(), steps, notes: v.notes || '', updatedAt: Date.now() };
        if (o.status === 'done' && !(x && x.doneOn)) o.doneOn = U.today();
        if (o.status !== 'done') o.doneOn = null;
        if (x) Object.assign(x, o); else B().list.push(Object.assign({ id: U.uid('bk'), createdAt: Date.now() }, o));
        ED.store.commit(); api.close();
      },
    });
  };

  A['bk-new'] = () => BK.edit(null);
  A['bk-edit'] = el => BK.edit(el.dataset.id);
  A['bk-idea'] = el => BK.edit(null, { title: el.dataset.t, cat: el.dataset.cat });
  A['bk-done'] = el => {
    const x = item(el.dataset.id); if (!x) return;
    ED.store.checkpoint('Bucket item');
    if (x.status === 'done') { x.status = (x.steps || []).some(s => s.done) ? 'doing' : 'planned'; x.doneOn = null; }
    else { x.status = 'done'; x.doneOn = U.today(); }
    x.updatedAt = Date.now(); ED.store.commit();
    if (x.status === 'done') ED.ui.undoToast('Done: ' + x.title + ' 🎉');
  };
  A['bk-task'] = el => {
    const x = item(el.dataset.id), s = x && (x.steps || []).find(y => y.id === el.dataset.s); if (!s) return;
    ED.store.checkpoint('Task from bucket list');
    const t = M.addTask({ title: s.text, date: null, notes: 'Bucket list: ' + x.title });
    s.taskId = t.id; if (x.status === 'dream') x.status = 'planned'; x.updatedAt = Date.now(); ED.store.commit();
    ED.ui.toast(M.code(t) + ' added to the master list (Monthly Tasks)', { action: 'Give it a date', onAction: () => ED.editors.task({ id: t.id, k: U.today() }) });
  };
  A['bk-menu'] = el => {
    const x = item(el.dataset.id); if (!x) return;
    ED.ui.menu(el, STATUS.filter(s => s[0] !== x.status).map(s => ({ label: 'Mark as ' + s[1].toLowerCase(), icon: s[2], onClick: () => { ED.store.checkpoint('Bucket item'); x.status = s[0]; x.doneOn = s[0] === 'done' ? U.today() : null; x.updatedAt = Date.now(); ED.store.commit(); } }))
      .concat([{ sep: true }, { label: 'Edit…', icon: 'pencil', onClick: () => BK.edit(x.id) },
        { label: 'Delete', icon: 'trash', danger: true, onClick: () => { ED.store.checkpoint('Delete bucket item'); B().list = B().list.filter(y => y !== x); ED.store.commit(); ED.ui.undoToast('Removed: ' + x.title); } }]), { placement: 'right-align' });
  };
  CHG['bk-step'] = el => {
    const x = item(el.dataset.id), s = x && (x.steps || []).find(y => y.id === el.dataset.s); if (!s) return;
    s.done = el.checked;
    if (s.done && x.status !== 'done') x.status = x.steps.every(y => y.done) ? x.status : 'doing';
    x.updatedAt = Date.now(); ED.store.commit();
    if (x.steps.every(y => y.done) && x.status !== 'done') ED.ui.toast('All steps done', { action: 'Mark “' + x.title + '” done', timeout: 9000, onAction: () => A['bk-done']({ dataset: { id: x.id } }) });
  };
  CHG['bk-filter'] = el => { st()[el.dataset.k] = el.value; ED.app.render(); };
  CHG['bk-q'] = el => { st().q = el.value; ED.app.render(); };

  ED.views = ED.views || {};
  ED.views.bucket = view;
})();
