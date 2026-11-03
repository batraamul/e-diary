/* E-Diary — 1.22: Dreams (Purpose → Dreams).
   What you want to be, have or do — and at what age — with pictures, notes, why it matters and the first steps.
   Left page:  your life line (now, and each dream at its age), the dreams as picture cards, filters by area and status.
   Right page: one dream large — pictures, years to go, notes, why, steps to tick, a linked goal — or the overview
               (dreams by area, by decade of life, the next one coming, the ones achieved).
   Data: ED.store.data.dreams = { dob: 'YYYY-MM-DD', list: [ { id, title, age, area, status: 'dream' | 'working' | 'done',
          pics: [dataURL | https], notes, why, steps: [ { id, text, done } ], goalId, doneOn, createdAt, updatedAt } ] } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const FX = () => ED.fx;
  const A = (ED.actions = ED.actions || {}), CH = (ED.changes = ED.changes || {});
  const D = () => ED.store.data;
  const DR = (ED.dreams = {});
  const AREAS = [['career', 'Career & work', '💼', '#2563eb'], ['learning', 'Learning & research', '🎓', '#7c3aed'], ['health', 'Health & fitness', '💪', '#16a34a'], ['family', 'Family & relations', '👨‍👩‍👦', '#db2777'],
    ['wealth', 'Wealth & home', '🏡', '#ca8a04'], ['travel', 'Travel & adventure', '✈️', '#0891b2'], ['service', 'Service & giving', '🤝', '#ea580c'], ['spirit', 'Spiritual & inner', '🕉️', '#9333ea'], ['self', 'Hobbies & self', '🎨', '#0d9488']];
  const STATUS = [['dream', 'Dreaming', '✨'], ['working', 'Working on it', '🚀'], ['done', 'Achieved', '🏆']];
  DR.AREAS = AREAS;
  const area = id => AREAS.find(a => a[0] === id) || AREAS[AREAS.length - 1];
  const stat = id => STATUS.find(s => s[0] === id) || STATUS[0];
  const DD = () => { const d = D(); if (!d.dreams || typeof d.dreams !== 'object') d.dreams = {}; const x = d.dreams; if (!Array.isArray(x.list)) x.list = []; return x; };
  const st = () => ED.state.dreams || (ED.state.dreams = { area: 'all', status: 'all', sel: null, view: 'dream' });
  /* your age now (years, with a fraction), and the year you turn a given age */
  DR.ageNow = () => { const b = DD().dob; if (!U.isKey(b)) return null; return U.diffDays(b, U.today()) / 365.2425; };
  DR.dateAt = age => { const b = DD().dob; if (!U.isKey(b)) return null; return (+b.slice(0, 4) + age) + b.slice(4); };
  const yearsTo = x => { const n = DR.ageNow(); return n == null || x.age == null ? null : x.age - n; };
  const when = x => {
    const y = yearsTo(x), at = DR.dateAt(x.age);
    if (x.status === 'done') return 'achieved' + (x.doneOn ? ' ' + U.fmtShort(x.doneOn) : '');
    if (y == null) return x.age != null ? 'at ' + x.age : '';
    if (y < 0) return 'at ' + x.age + ' · ' + Math.round(-y) + ' yr ago';
    return 'at ' + x.age + ' · ' + (at ? at.slice(0, 4) : '') + ' · ' + (y < 1 ? Math.max(1, Math.round(y * 12)) + ' months to go' : (Math.round(y * 10) / 10) + ' years to go');
  };
  const sorted = () => DD().list.slice().sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (a.age == null ? 999 : a.age) - (b.age == null ? 999 : b.age) || String(a.title).localeCompare(String(b.title)));
  const pick = () => { const s = st(), l = DD().list; let x = l.find(d => d.id === s.sel); if (!x) { x = sorted().find(d => d.status !== 'done') || sorted()[0] || null; s.sel = x ? x.id : null; } return x; };

  /* ---------------- left page ---------------- */
  const lifeLine = () => {
    const now = DR.ageNow(), l = DD().list.filter(d => d.age != null);
    if (now == null) return '<div class="dr-dob"><span aria-hidden="true">🎂</span><div><b>Your birth date</b><span class="hint">so each dream shows the year you reach that age and how long is left.</span></div><input type="date" class="field" data-change="dr-dob" aria-label="Your birth date"></div>';
    const a0 = Math.max(0, Math.floor(Math.min(now, ...l.map(d => d.age)) / 5) * 5), a1 = Math.max(Math.ceil((Math.max(now + 5, ...l.map(d => d.age)) + 2) / 5) * 5, a0 + 20);
    const x = a => ((a - a0) / (a1 - a0) * 100).toFixed(2) + '%';
    let ticks = ''; for (let a = a0; a <= a1; a += 5) ticks += '<span class="dr-tk" style="left:' + x(a) + '">' + a + '</span>';
    const byAge = {}; l.forEach(d => { (byAge[d.age] = byAge[d.age] || []).push(d); });
    const dots = Object.keys(byAge).map(ag => { const ds = byAge[ag]; return ds.map((d, j) => { const c = area(d.area); return '<button type="button" class="dr-dot s-' + (d.status || 'dream') + '" style="left:' + x(+ag) + ';--c:' + c[3] + ';--j:' + j + '" data-act="dr-sel" data-id="' + e(d.id) + '" title="' + e(d.title + ' — at ' + d.age) + '" aria-label="' + e(d.title + ', at age ' + d.age) + '">' + (d.status === 'done' ? '🏆' : c[2]) + '</button>'; }).join(''); }).join('');
    return '<div class="dr-line" role="group" aria-label="Your life line"><div class="dr-track"><i class="dr-past" style="width:' + x(now) + '"></i><span class="dr-now" style="left:' + x(now) + '"><b>You · ' + Math.floor(now) + '</b></span>' + dots + '</div><div class="dr-ticks">' + ticks + '</div></div>';
  };
  const left = () => {
    const s = st(), all = sorted(), sel = pick();
    const list = all.filter(d => (s.area === 'all' || d.area === s.area) && (s.status === 'all' || (d.status || 'dream') === s.status));
    const usedAreas = AREAS.filter(a => all.some(d => d.area === a[0]));
    const chips = '<div class="dr-filters"><div class="seg dr-seg" role="group" aria-label="Status">' + [['all', 'All']].concat(STATUS.map(x => [x[0], x[2] + ' ' + x[1]])).map(x => '<button type="button" data-act="dr-status" data-k="' + x[0] + '" aria-pressed="' + (s.status === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>' +
      (usedAreas.length > 1 ? '<select class="field dr-areasel" data-change="dr-area" aria-label="Area of life"><option value="all">Every area</option>' + usedAreas.map(a => FX().opt(a[0], a[2] + ' ' + a[1], s.area === a[0])).join('') + '</select>' : '') + '</div>';
    const cards = list.map(d => {
      const c = area(d.area), pic = (d.pics || [])[0], steps = d.steps || [], sd = steps.filter(x => x.done).length;
      return '<button type="button" class="dr-card s-' + (d.status || 'dream') + (sel && sel.id === d.id ? ' sel' : '') + '" style="--c:' + c[3] + '" data-act="dr-sel" data-id="' + e(d.id) + '" aria-pressed="' + !!(sel && sel.id === d.id) + '">' +
        '<span class="dr-cover"' + (pic ? ' style="background-image:url(&quot;' + e(pic) + '&quot;)"' : '') + '>' + (pic ? '' : '<span class="dr-ph" aria-hidden="true">' + c[2] + '</span>') + (d.age != null ? '<span class="dr-age">' + d.age + '</span>' : '') + (d.status === 'done' ? '<span class="dr-won" aria-hidden="true">🏆</span>' : '') + '</span>' +
        '<span class="dr-cb"><b>' + e(d.title) + '</b><span class="hint">' + e(when(d)) + '</span>' + (steps.length ? '<span class="dr-sbar" title="' + sd + ' of ' + steps.length + ' steps"><i style="width:' + Math.round(sd / steps.length * 100) + '%"></i></span>' : '') + '</span></button>';
    }).join('');
    const empty = !all.length ? '<div class="dr-empty"><span aria-hidden="true">🌠</span><b>What do you want to be — and by what age?</b><p class="hint">A professor at 50, a marathon at 45, a home in the hills at 55, a book in your name, a family trip abroad… Add a picture that says it, a few lines on why, and the first steps.</p><button type="button" class="btn primary" data-act="dr-new">' + ED.icon('plus') + 'Add my first dream</button></div>' : '';
    const tools = '<button type="button" class="btn small primary" data-act="dr-new">' + ED.icon('plus') + 'Dream</button>' + (DR.ageNow() != null ? '<button type="button" class="icon-btn" data-act="dr-dobedit" aria-label="Birth date" title="Birth date">🎂</button>' : '');
    return FX().page('dr', 'Dreams', tools, lifeLine() + (all.length ? chips + (cards ? '<div class="dr-cards">' + cards + '</div>' : '<p class="hint">No dream matches these filters.</p>') : empty), 'dr-l');
  };

  /* ---------------- right page ---------------- */
  const right = () => {
    const s = st(), all = DD().list;
    const seg = all.length ? FX().seg('dr-view', s.view, [['dream', 'The dream'], ['overview', 'Overview']], 'Show') : '';
    if (!all.length) return FX().page('dr dr-r', 'Your dreams', '', '<p class="hint dr-intro">Dreams turn into plans when they have an age, a picture and a first step. Each one can become a <b>goal</b> in Purpose → Goals, so its tasks reach your Daily page.</p>', 'dr-r');
    if (s.view === 'overview') return FX().page('dr dr-r', 'Your dreams', seg, overview(), 'dr-r');
    const d = pick(); if (!d) return FX().page('dr dr-r', 'Your dreams', seg, '', 'dr-r');
    const c = area(d.area), pics = d.pics || [], steps = d.steps || [], g = d.goalId && M.goal(d.goalId), y = yearsTo(d);
    const gallery = pics.length ? '<div class="dr-gal' + (pics.length === 1 ? ' one' : '') + '">' + pics.map((p, i) => '<button type="button" class="dr-gi" data-act="dr-pic" data-id="' + e(d.id) + '" data-i="' + i + '" aria-label="See picture ' + (i + 1) + '"><img src="' + e(p) + '" alt="' + e(d.title) + '"></button>').join('') + '</div>'
      : '<button type="button" class="dr-nopic" data-act="dr-edit" data-id="' + e(d.id) + '">' + ED.icon('image') + 'Add a picture of this dream</button>';
    const count = d.status === 'done' ? '<div class="dr-count won"><b>🏆</b><span>Achieved' + (d.doneOn ? ' on ' + e(U.fmtLong(d.doneOn)) : '') + '</span></div>'
      : y != null ? '<div class="dr-count"><b class="num">' + (y < 0 ? '—' : y < 1 ? Math.max(1, Math.round(y * 12)) : Math.floor(y)) + '</b><span>' + (y < 0 ? 'the age has passed — set a new one?' : y < 1 ? 'months to go' : (Math.floor(y) === 1 ? 'year' : 'years') + (Math.round((y % 1) * 12) % 12 ? ' ' + U.plural(Math.round((y % 1) * 12) % 12, 'month') : '') + ' to go') + '</span><i>' + (DR.dateAt(d.age) ? 'you turn ' + d.age + ' on ' + e(U.fmtLong(DR.dateAt(d.age))) : '') + '</i></div>' : '';
    const body = '<div class="dr-hero" style="--c:' + c[3] + '"><div class="dr-ht"><span class="dr-area">' + c[2] + ' ' + e(c[1]) + '</span><h3>' + e(d.title) + '</h3><span class="dr-st s-' + (d.status || 'dream') + '">' + stat(d.status)[2] + ' ' + e(stat(d.status)[1]) + '</span></div>' + count + '</div>' +
      gallery +
      (d.notes ? '<div class="dr-sec"><h4>What it looks like</h4><p>' + e(d.notes).replace(/\n/g, '<br>') + '</p></div>' : '') +
      (d.why ? '<div class="dr-sec why"><h4>Why it matters to me</h4><p>' + e(d.why).replace(/\n/g, '<br>') + '</p></div>' : '') +
      '<div class="dr-sec"><h4>Steps towards it <span class="hint">' + (steps.length ? steps.filter(x => x.done).length + '/' + steps.length : '') + '</span></h4><ul class="xp-check dr-steps">' + steps.map(x => '<li><label><input type="checkbox" data-change="dr-step" data-id="' + e(d.id) + '" data-s="' + e(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + e(x.text) + '</span></label></li>').join('') + '</ul>' +
      '<form class="dr-addstep" data-form="dr-step" data-id="' + e(d.id) + '"><input name="t" class="field" placeholder="A step — e.g. finish the PhD, run 10 km, save ₹5 lakh" aria-label="New step"><button type="submit" class="btn small">' + ED.icon('plus') + 'Add</button></form></div>' +
      '<div class="dr-sec"><h4>Goal</h4>' + (g ? '<button type="button" class="dr-goal" data-act="dr-goal-open" data-id="' + e(g.id) + '" style="--c:' + e(g.color || c[3]) + '"><b>' + e(g.title) + '</b><span class="hint">' + (g.due ? 'due ' + e(U.fmtShort(g.due)) : '') + ' · ' + M.goalStats(g.id).pct + '% of its tasks done</span></button>'
        : '<p class="hint">Turn it into a goal in Purpose → Goals: its tasks then reach your Daily page.</p><button type="button" class="btn small" data-act="dr-goal" data-id="' + e(d.id) + '">' + ED.icon('target') + 'Make it a goal</button>') + '</div>' +
      '<div class="row-btns dr-acts"><button type="button" class="btn small primary" data-act="dr-edit" data-id="' + e(d.id) + '">' + ED.icon('pencil') + 'Edit</button>' +
      (d.status !== 'done' ? '<button type="button" class="btn small" data-act="dr-won" data-id="' + e(d.id) + '">🏆 Achieved!</button>' : '<button type="button" class="btn small ghost" data-act="dr-won" data-id="' + e(d.id) + '">Not achieved yet</button>') + '</div>';
    return FX().page('dr dr-r', 'Your dreams', seg, body, 'dr-r');
  };
  const overview = () => {
    const l = DD().list, now = DR.ageNow(), C = ED.charts;
    const n = s => l.filter(d => (d.status || 'dream') === s).length;
    const next = sorted().filter(d => d.status !== 'done' && d.age != null && (now == null || d.age >= now))[0];
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('Dreams', String(l.length), n('working') + ' being worked on') + FX().tile('Achieved', String(n('done')), n('done') ? 'well done 🏆' : 'the first is coming') +
      FX().tile('Next', next ? String(next.age) : '—', next ? e(next.title) : 'add an age to a dream') + FX().tile('Steps done', String(l.reduce((a, d) => a + (d.steps || []).filter(x => x.done).length, 0)), 'of ' + l.reduce((a, d) => a + (d.steps || []).length, 0)) + '</div>';
    const byA = AREAS.map(a => ({ a, n: l.filter(d => d.area === a[0]).length, w: l.filter(d => d.area === a[0] && d.status === 'done').length })).filter(x => x.n);
    const areas = C.meters({ title: 'Dreams by area of life', rows: byA.map(x => ({ label: x.a[2] + ' ' + x.a[1], value: x.n, color: x.a[3], valueLabel: x.n + (x.w ? ' · ' + x.w + ' achieved' : ''), tip: U.plural(x.n, 'dream') })), max: Math.max(...byA.map(x => x.n), 1) });
    const dec = {}; l.forEach(d => { if (d.age != null) { const k = Math.floor(d.age / 10) * 10; dec[k] = (dec[k] || 0) + 1; } });
    const decades = Object.keys(dec).sort((a, b) => a - b);
    const decHtml = decades.length ? C.columns({ title: 'Dreams by decade of life', h: 140, left: 30, color: 'var(--s7)', data: decades.map(k => ({ label: k + 's', long: 'In your ' + k + 's', value: dec[k], tip: U.plural(dec[k], 'dream') })), cur: now != null ? decades.indexOf(String(Math.floor(now / 10) * 10)) : null }) : '';
    const won = l.filter(d => d.status === 'done');
    const wonHtml = won.length ? '<h3 class="gh fin-gap">Achieved 🏆</h3><ul class="xp-list">' + won.map(d => '<li><button type="button" class="plain-btn xp-li" data-act="dr-sel" data-id="' + e(d.id) + '"><span>' + area(d.area)[2] + '</span><span class="grow"><b>' + e(d.title) + '</b><span class="hint"> ' + e(d.doneOn ? U.fmtShort(d.doneOn) : '') + '</span></span></button></li>').join('') + '</ul>' : '';
    const missing = AREAS.filter(a => !l.some(d => d.area === a[0])).slice(0, 4);
    return tiles + '<div class="dr-two">' + areas + decHtml + '</div>' + wonHtml + (missing.length ? '<p class="hint dr-miss">Areas with no dream yet: ' + missing.map(a => a[2] + ' ' + e(a[1])).join(' · ') + '.</p>' : '');
  };

  /* ---------------- editing ---------------- */
  DR.edit = id => {
    const x = id ? DD().list.find(d => d.id === id) : null; let pe = null;
    const now = DR.ageNow();
    FX().form({
      title: x ? 'Dream' : 'A new dream', wide: true,
      data: x ? Object.assign({}, x, { steps: (x.steps || []).map(s => s.text).join('\n') }) : { area: 'career', status: 'dream', age: now != null ? Math.ceil(now) + 5 : null },
      fields: [{ k: 'title', label: 'What I want to be / do / have', req: true, ph: 'e.g. Professor of Atmospheric Science, run a full marathon, a home near the mountains' },
        { k: 'age', label: 'By what age', type: 'number', min: 1, max: 120, hint: now != null ? 'You are ' + Math.floor(now) + ' now.' : 'Add your birth date on the left to see the year and the time left.' },
        { k: 'area', label: 'Area of life', type: 'select', options: AREAS.map(a => [a[0], a[2] + ' ' + a[1]]) }, { k: 'status', label: 'Status', type: 'select', options: STATUS.map(s => [s[0], s[2] + ' ' + s[1]]) },
        { k: 'notes', label: 'What it looks like', type: 'textarea', rows: 3, ph: 'Picture the day it comes true — where you are, what you do, who is with you' },
        { k: 'why', label: 'Why it matters to me', type: 'textarea', rows: 2 },
        { k: 'steps', label: 'First steps (one a line)', type: 'textarea', rows: 3 }, { k: 'pics', label: 'Pictures', type: 'head' }],
      mount(el) { const h = document.createElement('div'); h.className = 'pi-host'; el.querySelector('.st-form').appendChild(h); pe = ED.pics.editor(h, x ? x.pics : [], { max: 6 }); },
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Delete dream', message: 'Delete “' + x.title + '” and its pictures?', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Delete dream'); DD().list = DD().list.filter(d => d !== x); st().sel = null; ED.store.commit(); ED.ui.undoToast('Dream deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint(x ? 'Dream' : 'New dream');
        const old = x ? (x.steps || []) : [];
        const steps = FX().lines(v.steps).map(t => old.find(s => s.text === t) || { id: U.uid('ds'), text: t, done: false });
        const o = { title: v.title, age: v.age == null ? null : Math.round(v.age), area: v.area, status: v.status, notes: v.notes, why: v.why, steps, pics: pe ? pe.get() : (x ? x.pics : []), updatedAt: Date.now() };
        if (o.status === 'done' && !(x && x.doneOn)) o.doneOn = U.today();
        if (o.status !== 'done') o.doneOn = null;
        if (x) Object.assign(x, o); else { const n = Object.assign({ id: U.uid('dr'), createdAt: Date.now() }, o); DD().list.push(n); st().sel = n.id; st().view = 'dream'; }
        ED.store.commit(); api.close();
      },
    });
  };
  DR.dob = () => FX().form({ title: 'Your birth date', data: { dob: DD().dob || '' }, fields: [{ k: 'dob', label: 'Born on', type: 'date', req: true }], save(v, api) { DD().dob = v.dob; DD().updatedAt = Date.now(); ED.store.commit(); api.close(); } });

  /* ---------------- actions ---------------- */
  A['dr-new'] = () => DR.edit(null);
  A['dr-edit'] = el => DR.edit(el.dataset.id);
  A['dr-sel'] = el => { const s = st(); s.sel = el.dataset.id; s.view = 'dream'; ED.app.render(); };
  A['dr-view'] = el => { st().view = el.dataset.k; ED.app.render(); };
  A['dr-status'] = el => { st().status = el.dataset.k; ED.app.render(); };
  A['dr-dobedit'] = () => DR.dob();
  A['dr-pic'] = el => { const d = DD().list.find(x => x.id === el.dataset.id); if (d) ED.pics.view(d.pics, +el.dataset.i, d.title); };
  A['dr-won'] = el => { const d = DD().list.find(x => x.id === el.dataset.id); if (!d) return; ED.store.checkpoint('Dream'); const won = d.status !== 'done'; d.status = won ? 'done' : 'working'; d.doneOn = won ? U.today() : null; d.updatedAt = Date.now(); ED.store.commit(); if (won) ED.ui.toast('🏆 Dream achieved — ' + d.title); };
  A['dr-goal'] = el => {
    const d = DD().list.find(x => x.id === el.dataset.id); if (!d) return;
    ED.store.checkpoint('Goal from a dream');
    const due = d.age != null && DR.dateAt(d.age) && DR.dateAt(d.age) > U.today() ? DR.dateAt(d.age) : U.addMonths(U.today(), 12);
    const g = { id: U.uid('g'), title: d.title, desc: [d.why, (d.steps || []).map(s => '• ' + s.text).join('\n')].filter(Boolean).join('\n\n'), valueId: null, roleId: null, color: area(d.area)[3], startDate: U.today(), due, done: false, doneAt: null, createdAt: Date.now() };
    D().goals.push(g); d.goalId = g.id; d.status = d.status === 'dream' ? 'working' : d.status; d.updatedAt = Date.now();
    ED.store.commit(); ED.ui.toast('Goal made — add its tasks in Purpose → Goals'); ED.editors.goal(g.id);
  };
  A['dr-goal-open'] = el => ED.editors.goal(el.dataset.id);
  CH['dr-area'] = el => { st().area = el.value; ED.app.render(); };
  CH['dr-dob'] = el => { if (!U.isKey(el.value)) return; ED.store.checkpoint('Birth date'); DD().dob = el.value; DD().updatedAt = Date.now(); ED.store.commit(); };
  CH['dr-step'] = el => { const d = DD().list.find(x => x.id === el.dataset.id); const s = d && (d.steps || []).find(x => x.id === el.dataset.s); if (!s) return; s.done = el.checked; d.updatedAt = Date.now(); if (s.done && d.status === 'dream') d.status = 'working'; ED.store.commit(); };
  (ED.forms = ED.forms || {})['dr-step'] = f => { const d = DD().list.find(x => x.id === f.dataset.id); const t = f.elements.t.value.trim(); if (!d || !t) return; d.steps = d.steps || []; d.steps.push({ id: U.uid('ds'), text: t, done: false }); d.updatedAt = Date.now(); ED.store.commit(); setTimeout(() => { const i = document.querySelector('form[data-form="dr-step"] [name="t"]'); if (i) i.focus(); }, 30); };

  ED.views = ED.views || {};
  ED.views.dreams = { id: 'dreams', label: 'Dreams', left, right, mount(L, R) { if (ED.charts) { ED.charts.bind(L); ED.charts.bind(R); } } };
})();
