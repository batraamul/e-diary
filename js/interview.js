/* E-Diary — Interview preparation.
   Left page:  the interviews coming up (post, organisation, date, stage, countdown; each can sit in the diary's
               calendar with a reminder), documents to carry, and mock interviews with their scores.
   Right page: the question bank by category (your answer notes, and how ready you are: new → needs work → ready),
               a practice mode (a question at a time, the weakest first, with a two-minute answer clock), and
               readiness charts.
   Data: ED.store.data.interview = {
     list:  [{ id, role, org, ref, date, time, mode, venue, stage, notes, eventId, cal }],
     qs:    [{ id, cat, q, a, level: 0 new | 1 needs work | 2 ready, last, tries, star, forId }],
     cats:  [ 'your own category', … ],
     docs:  [{ id, text, done }],
     mocks: [{ id, date, with, focus, score (1–10), notes }],
     log:   { 'YYYY-MM-DD': questions practised that day } } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const CH = ED.charts, FX = ED.fx;
  const D = () => ED.store.data;
  const IV = () => D().interview || (D().interview = ED.sample.interview());
  const A = (ED.actions = ED.actions || {});
  const CHG = (ED.changes = ED.changes || {});
  const st = () => ED.state.iv || (ED.state.iv = {});
  const I = (ED.interview = {});

  const CATS = ['About me & motivation', 'My field (technical)', 'Projects & achievements', 'Organisation & domain', 'Management & leadership', 'Situations & behaviour', 'Rules, finance & administration', 'Current affairs & policy'];
  const STAGES = ['Preparing', 'Applied', 'Shortlisted', 'Interview scheduled', 'Interview done', 'Selected', 'Not selected', 'Withdrawn'];
  const MODES = [['in-person', 'In person'], ['online', 'Online (video)'], ['phone', 'Phone']];
  const LEVEL = ['New', 'Needs work', 'Ready'];
  const DOCS = ['Updated CV / bio-data', 'Interview call letter', 'Photo ID (Aadhaar, PAN or passport)', 'Educational certificates — originals and self-attested copies', 'Experience or service certificate', 'NOC / forwarding letter from the department', 'Last five APARs (if asked)', 'List of publications, patents and reprints', 'Presentation on a pen drive (and a printed copy)', 'Passport-size photographs', 'Pen, notepad and a folder'];
  /* a starter question bank — general questions; add your own for each post */
  const STARTER = [
    ['About me & motivation', 'Tell us about yourself.'],
    ['About me & motivation', 'Why do you want this post, and why now?'],
    ['About me & motivation', 'Where do you see yourself in five years?'],
    ['About me & motivation', 'What are your strengths and one real weakness?'],
    ['My field (technical)', 'Explain your core area of work to a non-specialist in two minutes.'],
    ['My field (technical)', 'What are the latest developments in your field, and how would you use them here?'],
    ['Projects & achievements', 'Describe your most important project: your role, the problem, the result.'],
    ['Projects & achievements', 'Tell us about a project that did not go to plan. What did you learn?'],
    ['Projects & achievements', 'Which of your publications or patents has had the most impact, and why?'],
    ['Organisation & domain', 'What do you know about this organisation’s mandate and its current priorities?'],
    ['Organisation & domain', 'What would you do in your first 90 days in this role?'],
    ['Management & leadership', 'How do you lead a team of scientists and technical staff with different skills?'],
    ['Management & leadership', 'How have you handled a conflict in your team?'],
    ['Management & leadership', 'How do you plan and track a multi-year project and its budget?'],
    ['Situations & behaviour', 'A deadline is near and a key vendor fails to deliver. What do you do?'],
    ['Situations & behaviour', 'Your senior asks for something you think is against the rules. How do you respond?'],
    ['Rules, finance & administration', 'Explain the main steps of procurement under GFR 2017 and on GeM.'],
    ['Rules, finance & administration', 'When is limited or single tender enquiry allowed?'],
    ['Current affairs & policy', 'Which recent national science or technology policy matters most for this role?'],
    ['Current affairs & policy', 'How can AI be used responsibly in government science services?'],
  ];

  const cats = () => CATS.concat((IV().cats || []).filter(c => CATS.indexOf(c) < 0));
  const lvlCls = l => ['new', 'work', 'ready'][l || 0];
  const upcoming = () => IV().list.filter(x => x.date && x.date >= U.today() && ['Selected', 'Not selected', 'Withdrawn', 'Interview done'].indexOf(x.stage) < 0).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  /* ---------------- left page ---------------- */
  const view = {
    id: 'interview', label: 'Interview',
    left() {
      const d = IV();
      const next = upcoming()[0];
      const qs = d.qs, ready = qs.filter(q => q.level === 2).length, work = qs.filter(q => q.level === 1).length;
      const wk = U.range(U.addDays(U.today(), -6), 7).reduce((a, k) => a + (d.log[k] || 0), 0);
      const avg = d.mocks.length ? Math.round(d.mocks.reduce((a, m) => a + (+m.score || 0), 0) / d.mocks.length * 10) / 10 : null;
      const tiles = '<div class="tiles xp-tiles">' +
        FX.tile('Next interview', next ? e(FX.when(next.date)) : '—', next ? e(next.role || next.org || '') + ' · ' + e(FX.dm(next.date)) : 'add one below', next && U.diffDays(U.today(), next.date) <= 3 ? 'warn' : '') +
        FX.tile('Questions ready', qs.length ? Math.round(ready / qs.length * 100) + '%' : '—', ready + ' of ' + qs.length + (work ? ' · ' + work + ' need work' : '')) +
        FX.tile('Practised', String(wk), 'questions in the last 7 days') +
        FX.tile('Mock interviews', String(d.mocks.length), avg != null ? 'average score ' + avg + '/10' : 'none yet') + '</div>';
      const cards = d.list.slice().sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999'))).map(x => {
        const past = x.date && x.date < U.today();
        const n = x.date ? U.diffDays(U.today(), x.date) : null;
        const done = ['Selected', 'Not selected', 'Withdrawn', 'Interview done'].indexOf(x.stage) >= 0;
        const qn = d.qs.filter(q => q.forId === x.id).length;
        return '<article class="xp-card' + (done || past ? ' dim' : '') + '"><button type="button" class="plain-btn xp-card-b" data-act="iv-edit" data-id="' + e(x.id) + '">' +
          '<span class="xp-date">' + (x.date ? '<b>' + (+x.date.slice(8)) + '</b><span>' + U.MON[+x.date.slice(5, 7) - 1] + '</span>' : '<b>—</b><span>no date</span>') + '</span>' +
          '<span class="xp-m"><b>' + e(x.role || 'Interview') + '</b><span class="hint">' + e([x.org, x.ref].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="hint">' + e([x.time ? FX.time(x.time) : '', (MODES.find(m => m[0] === x.mode) || [0, ''])[1], x.venue].filter(Boolean).join(' · ')) + (qn ? ' · ' + U.plural(qn, 'question') + ' for it' : '') + '</span></span>' +
          '<span class="xp-r"><span class="xp-stage s-' + e(STAGES.indexOf(x.stage)) + '">' + e(x.stage || STAGES[0]) + '</span>' + (n != null && !done && n >= 0 ? '<span class="hint num">' + e(FX.when(x.date)) + '</span>' : '') + (x.eventId ? '<span class="hint">' + ED.icon('calendar') + ' in calendar</span>' : '') + '</span></button></article>';
      }).join('');
      const docsDone = d.docs.filter(x => x.done).length;
      const docs = '<ul class="xp-check">' + d.docs.map(x => '<li class="' + (x.done ? 'done' : '') + '"><label><input type="checkbox" data-change="iv-doc" data-id="' + e(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + e(x.text) + '</span></label><button type="button" class="icon-btn sm" data-act="iv-doc-del" data-id="' + e(x.id) + '" aria-label="Remove ' + e(x.text) + '" title="Remove">' + ED.icon('x') + '</button></li>').join('') + '</ul>' +
        '<form class="addtask xp-add" data-form="iv-doc-add"><input class="addtask-in" type="text" placeholder="Add a document to carry" aria-label="Add a document to carry" autocomplete="off"><button type="submit" class="add-btn" aria-label="Add">' + ED.icon('plus') + '</button></form>' +
        (d.docs.length ? '<div class="row-btns"><button type="button" class="btn small ghost" data-act="iv-doc-reset">Untick all (for the next interview)</button></div>' : '<div class="row-btns"><button type="button" class="btn small" data-act="iv-doc-std">' + ED.icon('checkSq') + 'Add the usual list</button></div>');
      const mocks = d.mocks.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(m => '<li><button type="button" class="plain-btn xp-li" data-act="iv-mock" data-id="' + e(m.id) + '"><span class="num">' + e(FX.dm(m.date)) + '</span><span class="grow">' + e(m.with || 'Mock interview') + (m.focus ? ' <span class="hint">· ' + e(m.focus) + '</span>' : '') + '</span><b class="num">' + (m.score != null ? e(m.score) + '/10' : '') + '</b></button></li>').join('');
      const body = tiles +
        '<h3 class="gh">Interviews</h3>' + (cards ? '<div class="xp-cards">' + cards + '</div>' : '<p class="hint">No interviews yet. Add one to count down to it, keep its details and put it in your calendar.</p>') +
        '<div class="row-btns"><button type="button" class="btn small primary" data-act="iv-new">' + ED.icon('plus') + 'Add an interview</button></div>' +
        '<h3 class="gh fin-gap">Documents to carry <span class="hint num">· ' + docsDone + '/' + d.docs.length + '</span></h3>' + docs +
        '<h3 class="gh fin-gap">Mock interviews</h3>' + (mocks ? '<ul class="xp-list">' + mocks + '</ul>' : '<p class="hint">Practise with a colleague or a friend acting as the panel, and note what went well and what to improve.</p>') +
        '<div class="row-btns"><button type="button" class="btn small" data-act="iv-mock">' + ED.icon('plus') + 'Add a mock interview</button></div>';
      return FX.page('iv', 'Interview preparation', '', body, 'iv-left');
    },

    right() {
      const tab = st().tab || 'bank';
      const seg = FX.seg('iv-tab', tab, [['bank', 'Question bank'], ['practise', 'Practise'], ['ready', 'Readiness']]);
      const body = tab === 'practise' ? practise() : tab === 'ready' ? readiness() : bank();
      return '<div class="xp iv-r"><div class="pg-head"><h2 class="pg-title">' + (tab === 'practise' ? 'Practise' : tab === 'ready' ? 'How ready am I?' : 'Questions') + '</h2>' + seg + '</div><div class="st-scroll scroll" data-keep-scroll="iv-r-' + tab + '">' + body + '</div></div>';
    },
    mount(L, R) { CH.bind(R); tick(R); },
    unmount() { if (clock) { clearInterval(clock); clock = null; } },
  };

  /* ---------------- question bank ---------------- */
  function bank() {
    const d = IV(), s = st();
    const q = (s.q || '').toLowerCase(), fc = s.cat || '', fl = s.lvl == null ? '' : String(s.lvl), ff = s.forId || '';
    const list = d.qs.filter(x => (!fc || x.cat === fc) && (fl === '' || String(x.level || 0) === fl) && (!ff || x.forId === ff) && (!q || (x.q + ' ' + (x.a || '')).toLowerCase().indexOf(q) >= 0));
    const filters = '<div class="xp-filters"><input class="field" type="search" placeholder="Search questions and answers" value="' + e(s.q || '') + '" data-change="iv-q" aria-label="Search questions">' +
      '<select class="field" data-change="iv-fcat" aria-label="Category">' + FX.opt('', 'All categories', !fc) + cats().map(c => FX.opt(c, c, c === fc)).join('') + '</select>' +
      '<select class="field" data-change="iv-flvl" aria-label="Readiness">' + FX.opt('', 'Any readiness', fl === '') + LEVEL.map((l, i) => FX.opt(String(i), l, fl === String(i))).join('') + '</select>' +
      (d.list.length ? '<select class="field" data-change="iv-ffor" aria-label="Interview">' + FX.opt('', 'Any interview', !ff) + d.list.map(x => FX.opt(x.id, x.role || x.org || 'Interview', x.id === ff)).join('') + '</select>' : '') + '</div>';
    const groups = cats().map(c => {
      const l = list.filter(x => x.cat === c); if (!l.length) return '';
      return '<section class="iv-grp"><h3 class="gh">' + e(c) + ' <span class="hint num">· ' + l.length + '</span></h3><ul class="iv-qs">' + l.map(x =>
        '<li class="iv-q l-' + lvlCls(x.level) + '"><button type="button" class="iv-lv l-' + lvlCls(x.level) + '" data-act="iv-level" data-id="' + e(x.id) + '" title="' + e(LEVEL[x.level || 0]) + ' — click to change" aria-label="Readiness: ' + e(LEVEL[x.level || 0]) + '. Change">' + e(LEVEL[x.level || 0]) + '</button>' +
        '<button type="button" class="plain-btn iv-qt" data-act="iv-qedit" data-id="' + e(x.id) + '"><b>' + (x.star ? '⭐ ' : '') + e(x.q) + '</b>' + (x.a ? '<span class="hint iv-a">' + e(x.a.slice(0, 160)) + (x.a.length > 160 ? '…' : '') + '</span>' : '<span class="hint iv-a">No answer notes yet</span>') + '</button>' +
        '<span class="hint num iv-last">' + (x.last ? e(FX.when(x.last)) : '') + '</span></li>').join('') + '</ul></section>';
    }).join('');
    return '<div class="row-btns"><button type="button" class="btn small primary" data-act="iv-qnew">' + ED.icon('plus') + 'Add a question</button>' +
      '<button type="button" class="btn small" data-act="iv-starter">' + ED.icon('list') + 'Add common questions</button><button type="button" class="btn small ghost" data-act="iv-catnew">' + ED.icon('plus') + 'Category</button></div>' +
      filters + (groups || '<p class="hint">' + (d.qs.length ? 'No questions match.' : 'Add the questions you expect, with notes for your answers. “Add common questions” gives you twenty to start with.') + '</p>');
  }

  /* ---------------- practise: one question at a time, weakest first ---------------- */
  function pick() {
    const d = IV(), s = st();
    const pool = d.qs.filter(x => (!s.pcat || x.cat === s.pcat) && (!s.pfor || x.forId === s.pfor));
    if (!pool.length) return null;
    // weight: new 5, needs work 4, ready 1; not practised for a while counts more
    const w = x => (x.level === 2 ? 1 : x.level === 1 ? 4 : 5) * (x.last ? Math.min(3, 1 + U.diffDays(x.last, U.today()) / 7) : 2) * (x.star ? 2 : 1) * (x.id === s.prev ? 0.05 : 1);
    const tot = pool.reduce((a, x) => a + w(x), 0);
    let r = Math.random() * tot;
    for (const x of pool) { r -= w(x); if (r <= 0) return x; }
    return pool[pool.length - 1];
  }
  let clock = null;
  function practise() {
    const d = IV(), s = st();
    let cur = s.cur ? d.qs.find(x => x.id === s.cur) : null;
    if (!cur) { cur = pick(); s.cur = cur ? cur.id : null; s.shown = false; s.t0 = Date.now(); }
    const filt = '<div class="xp-filters"><select class="field" data-change="iv-pcat" aria-label="Category to practise">' + FX.opt('', 'All categories', !s.pcat) + cats().map(c => FX.opt(c, c, c === s.pcat)).join('') + '</select>' +
      (d.list.length ? '<select class="field" data-change="iv-pfor" aria-label="Interview">' + FX.opt('', 'Any interview', !s.pfor) + d.list.map(x => FX.opt(x.id, x.role || x.org || 'Interview', x.id === s.pfor)).join('') + '</select>' : '') + '</div>';
    if (!cur) return filt + '<p class="hint">No questions to practise' + (s.pcat || s.pfor ? ' here' : '') + ' yet. Add some on the Question bank.</p>';
    const today = d.log[U.today()] || 0;
    return filt + '<div class="iv-card"><div class="iv-card-h"><span class="chip">' + e(cur.cat) + '</span><span class="iv-lv l-' + lvlCls(cur.level) + '">' + e(LEVEL[cur.level || 0]) + '</span><span class="grow"></span><span class="iv-clock num" id="iv-clock" data-t0="' + (s.t0 || Date.now()) + '">0:00</span></div>' +
      '<p class="iv-card-q">' + e(cur.q) + '</p>' +
      '<p class="hint">Answer out loud — about two minutes. Then look at your notes and be honest.</p>' +
      (s.shown ? '<div class="iv-card-a">' + (cur.a ? e(cur.a).replace(/\n/g, '<br>') : '<span class="hint">No notes for this question yet — add them so next time you can check yourself.</span>') + '</div>' : '<div class="row-btns"><button type="button" class="btn small" data-act="iv-show">' + ED.icon('eye') + 'Show my notes</button></div>') +
      '<div class="row-btns iv-rate"><button type="button" class="btn small" data-act="iv-rate" data-v="1">Needs work</button><button type="button" class="btn small primary" data-act="iv-rate" data-v="2">' + ED.icon('check') + 'Got it</button>' +
      '<button type="button" class="btn small ghost" data-act="iv-skip">Skip</button><button type="button" class="btn small ghost" data-act="iv-qedit" data-id="' + e(cur.id) + '">' + ED.icon('pencil') + 'Edit notes</button></div></div>' +
      '<p class="hint">' + U.plural(today, 'question') + ' practised today. New and “needs work” questions come up more often; one you mark “got it” comes back less.</p>';
  }
  function tick(root) {
    if (clock) { clearInterval(clock); clock = null; }
    const c = root && root.querySelector('#iv-clock'); if (!c) return;
    const t0 = +c.dataset.t0;
    const upd = () => { const el = document.getElementById('iv-clock'); if (!el) { clearInterval(clock); clock = null; return; } const s = Math.floor((Date.now() - t0) / 1000); el.textContent = Math.floor(s / 60) + ':' + U.pad(s % 60); el.classList.toggle('over', s >= 120); };
    upd(); clock = setInterval(upd, 1000);
  }

  /* ---------------- readiness ---------------- */
  function readiness() {
    const d = IV();
    const rows = cats().map(c => { const l = d.qs.filter(x => x.cat === c); return { c, n: l.length, r: l.filter(x => x.level === 2).length, w: l.filter(x => x.level === 1).length }; }).filter(x => x.n);
    const meters = rows.length ? CH.meters({
      title: 'Ready by category', max: 100,
      sub: 'Dark bar = ready; pale bar = ready or being worked on.',
      rows: rows.map(x => ({ label: x.c, value: x.r / x.n * 100, total: (x.r + x.w) / x.n * 100, valueLabel: x.r + '/' + x.n + ' ready', tip: x.r + ' ready, ' + x.w + ' need work, ' + (x.n - x.r - x.w) + ' new' })),
      table: CH.table(['Category', 'Questions', 'Ready', 'Needs work', 'New'], rows.map(x => [x.c, String(x.n), String(x.r), String(x.w), String(x.n - x.r - x.w)])),
    }) : '<p class="hint">Add questions to see how ready you are in each area.</p>';
    const days = U.range(U.addDays(U.today(), -29), 30);
    const cols = CH.columns({
      title: 'Questions practised each day', h: 160, left: 30, maxLabels: 8, color: 'var(--s2)',
      data: days.map(k => ({ label: String(+k.slice(8)), long: U.fmtLong(k), value: d.log[k] || 0, tip: U.plural(d.log[k] || 0, 'question') })),
      cur: 29, sub: 'The last 30 days.',
      table: CH.table(['Day', 'Questions'], days.filter(k => d.log[k]).map(k => [U.fmtDM(k), String(d.log[k])])),
    });
    const ms = d.mocks.filter(m => m.score != null).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const mock = ms.length >= 2 ? CH.lines({
      title: 'Mock interview scores', labels: ms.map(m => U.fmtDM(m.date)), long: ms.map(m => U.fmtLong(m.date) + (m.with ? ' · ' + m.with : '')), h: 170, left: 30, yMax: 10, fmt: v => String(Math.round(v)),
      series: [{ name: 'Score', color: 'var(--s1)', points: ms.map(m => +m.score) }],
      table: CH.table(['Date', 'With', 'Score'], ms.map(m => [U.fmtDM(m.date), m.with || '', m.score + '/10'])),
    }) : '';
    const next = upcoming()[0];
    const plan = next ? (() => {
      const n = Math.max(1, U.diffDays(U.today(), next.date));
      const left = d.qs.filter(x => x.level !== 2 && (!x.forId || x.forId === next.id)).length;
      return '<div class="notice info iv-plan">' + ED.icon('target') + '<span class="grow"><b>' + e(next.role || 'Your interview') + '</b> is ' + e(FX.when(next.date)) + '. ' + (left ? 'About <b>' + Math.ceil(left / n) + ' question' + (Math.ceil(left / n) === 1 ? '' : 's') + ' a day</b> gets all ' + left + ' not-yet-ready questions practised in time.' : 'Every question is marked ready — keep practising a few a day.') + '</span></div>';
    })() : '';
    return plan + meters + cols + mock;
  }

  /* ---------------- editors ---------------- */
  I.edit = id => {
    const d = IV();
    const x = id ? d.list.find(y => y.id === id) : null;
    const v = x ? Object.assign({ cal: !!x.eventId }, x) : { role: '', org: '', ref: '', date: '', time: '10:00', mode: 'in-person', venue: '', stage: 'Interview scheduled', notes: '', cal: true };
    FX.form({
      title: x ? 'Interview' : 'Add an interview', data: v,
      fields: [
        { k: 'role', label: 'Post / position', req: true, ph: 'e.g. Scientist G, Head of Division, Deputation to …' },
        { k: 'org', label: 'Organisation', ph: 'Ministry, institute, board…' },
        { k: 'ref', label: 'Advertisement / ref. no.', ph: 'Advt. no., file no.' },
        { k: 'date', label: 'Date', type: 'date' },
        { k: 'time', label: 'Time', type: 'time' },
        { k: 'mode', label: 'Mode', type: 'select', options: MODES },
        { k: 'venue', label: 'Venue or link', ph: 'Address, or the video-call link' },
        { k: 'stage', label: 'Stage', type: 'select', options: STAGES.map(s => [s, s]) },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 4, ph: 'Panel members, format (presentation + interview), eligibility, what to stress…' },
        { k: 'cal', label: 'Show it in my calendar, with a reminder an hour before', type: 'check' },
      ],
      del: x ? async () => {
        const ok = await ED.ui.confirm({ title: 'Delete interview', message: 'Delete “' + (x.role || 'this interview') + '”' + (x.eventId ? ' and its calendar entry' : '') + '? Questions linked to it stay in the bank.', ok: 'Delete', danger: true });
        if (!ok) return false;
        ED.store.checkpoint('Delete interview'); FX.dropEvent(x);
        d.list = d.list.filter(y => y.id !== x.id); d.qs.forEach(q => { if (q.forId === x.id) q.forId = ''; });
        ED.store.commit(); ED.ui.undoToast('Interview deleted');
      } : null,
      save(val, api) {
        ED.store.checkpoint(x ? 'Interview' : 'New interview');
        const it = x || { id: U.uid('iv'), createdAt: Date.now() };
        const cal = val.cal; delete val.cal;
        Object.assign(it, val, { updatedAt: Date.now() });
        FX.linkEvent(it, { on: cal && it.stage !== 'Withdrawn', title: 'Interview: ' + it.role + (it.org ? ' — ' + it.org : ''), date: it.date, time: it.time, mins: 60, location: it.venue, notes: [it.ref, it.notes].filter(Boolean).join('\n'), reminder: 60, color: '#c2185b' });
        if (!x) d.list.push(it);
        ED.store.commit(); api.close(); ED.ui.toast(x ? 'Interview saved' : 'Interview added' + (it.eventId ? ' — it is in your calendar too' : ''));
      },
    });
  };

  I.editQ = (id, o) => {
    const d = IV(); o = o || {};
    const x = id ? d.qs.find(y => y.id === id) : null;
    const v = x ? Object.assign({}, x, { level: String(x.level || 0) }) : { cat: o.cat || st().cat || CATS[0], q: '', a: '', level: '0', star: false, forId: st().forId || '' };
    FX.form({
      title: x ? 'Question' : 'Add a question', data: v, wide: true,
      fields: [
        { k: 'cat', label: 'Category', type: 'select', options: () => cats().map(c => [c, c]) },
        { k: 'q', label: 'Question', req: true, type: 'textarea', rows: 2, ph: 'What could the panel ask?' },
        { k: 'a', label: 'My answer (notes)', type: 'textarea', rows: 9, ph: 'Key points, examples with numbers, a short story (situation, task, action, result), what not to say…' },
        { k: 'level', label: 'How ready', type: 'select', options: LEVEL.map((l, i) => [String(i), l]) },
        { k: 'forId', label: 'For which interview', type: 'select', options: () => [['', 'Any interview']].concat(d.list.map(y => [y.id, y.role || y.org || 'Interview'])) },
        { k: 'star', label: 'Important — ask me this one more often', type: 'check' },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete question'); d.qs = d.qs.filter(y => y.id !== x.id); if (st().cur === x.id) st().cur = null; ED.store.commit(); ED.ui.undoToast('Question deleted'); } : null,
      save(val, api) {
        ED.store.checkpoint(x ? 'Question' : 'New question');
        val.level = +val.level || 0;
        if (x) Object.assign(x, val, { updatedAt: Date.now() }); else d.qs.push(Object.assign({ id: U.uid('iq'), last: '', tries: 0, createdAt: Date.now() }, val));
        ED.store.commit(); api.close(); ED.ui.toast(x ? 'Saved' : 'Question added');
      },
    });
  };

  I.editMock = id => {
    const d = IV();
    const x = id ? d.mocks.find(y => y.id === id) : null;
    FX.form({
      title: x ? 'Mock interview' : 'Add a mock interview', data: x || { date: U.today(), with: '', focus: '', score: null, notes: '' },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: true },
        { k: 'with', label: 'With', ph: 'Colleague, mentor, friend…' },
        { k: 'focus', label: 'Focus', ph: 'Technical round, presentation, HR questions…' },
        { k: 'score', label: 'Score out of 10', type: 'number', min: 0, max: 10, step: 0.5 },
        { k: 'notes', label: 'What went well, what to improve', type: 'textarea', rows: 5 },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete'); d.mocks = d.mocks.filter(y => y.id !== x.id); ED.store.commit(); ED.ui.undoToast('Deleted'); } : null,
      save(val, api) {
        if (val.score != null) val.score = Math.max(0, Math.min(10, val.score));
        ED.store.checkpoint('Mock interview');
        if (x) Object.assign(x, val); else d.mocks.push(Object.assign({ id: U.uid('im') }, val));
        ED.store.commit(); api.close();
      },
    });
  };

  ED.views = ED.views || {};
  ED.views.interview = view;

  /* ---------------- actions ---------------- */
  const reR = () => { ED.app.renderPage('right'); const R = document.getElementById('pg-right'); CH.bind(R); tick(R); };
  A['iv-tab'] = el => { st().tab = el.dataset.k; reR(); };
  A['iv-new'] = () => I.edit(null);
  A['iv-edit'] = el => I.edit(el.dataset.id);
  A['iv-qnew'] = () => I.editQ(null);
  A['iv-qedit'] = el => I.editQ(el.dataset.id);
  A['iv-mock'] = el => I.editMock(el.dataset.id || null);
  A['iv-level'] = el => { const q = IV().qs.find(x => x.id === el.dataset.id); if (!q) return; q.level = ((q.level || 0) + 1) % 3; ED.store.commit(); };
  A['iv-starter'] = () => {
    const d = IV(), have = new Set(d.qs.map(q => q.q.toLowerCase()));
    const add = STARTER.filter(s => !have.has(s[1].toLowerCase()));
    if (!add.length) { ED.ui.toast('The common questions are already in your bank'); return; }
    ED.store.checkpoint('Common questions');
    add.forEach(s => d.qs.push({ id: U.uid('iq'), cat: s[0], q: s[1], a: '', level: 0, last: '', tries: 0, star: false, forId: '', createdAt: Date.now() }));
    ED.store.commit(); ED.ui.undoToast(U.plural(add.length, 'question') + ' added — write your answer notes for each');
  };
  A['iv-catnew'] = async () => {
    const v = await ED.ui.prompt({ title: 'New category', label: 'Category', ok: 'Add', hint: 'For example: Presentation, Instrumentation, Meteorology, Vigilance & RTI.' });
    if (!v || !v.trim()) return;
    if (cats().some(c => c.toLowerCase() === v.trim().toLowerCase())) { ED.ui.toast('That category is already there'); return; }
    ED.store.checkpoint('Category'); IV().cats.push(v.trim()); ED.store.commit(); ED.ui.toast('Category added');
  };
  A['iv-show'] = () => { st().shown = true; reR(); };
  A['iv-skip'] = () => { const s = st(); s.prev = s.cur; s.cur = null; reR(); };
  A['iv-rate'] = el => {
    const d = IV(), s = st(), q = d.qs.find(x => x.id === s.cur); if (!q) return;
    const v = +el.dataset.v;
    q.level = v === 2 ? 2 : 1;
    q.last = U.today(); q.tries = (q.tries || 0) + 1;
    d.log[U.today()] = (d.log[U.today()] || 0) + 1;
    s.prev = q.id; s.cur = null;
    ED.store.commit();
  };
  A['iv-doc-std'] = () => { const d = IV(); ED.store.checkpoint('Documents'); DOCS.forEach(t => { if (!d.docs.some(x => x.text === t)) d.docs.push({ id: U.uid('id'), text: t, done: false }); }); ED.store.commit(); };
  A['iv-doc-del'] = el => { const d = IV(); d.docs = d.docs.filter(x => x.id !== el.dataset.id); ED.store.commit(); };
  A['iv-doc-reset'] = () => { IV().docs.forEach(x => { x.done = false; }); ED.store.commit(); };
  CHG['iv-doc'] = el => { const x = IV().docs.find(y => y.id === el.dataset.id); if (x) { x.done = el.checked; ED.store.commit(); } };
  CHG['iv-q'] = el => { st().q = el.value; reR(); };
  CHG['iv-fcat'] = el => { st().cat = el.value; reR(); };
  CHG['iv-flvl'] = el => { st().lvl = el.value === '' ? null : el.value; reR(); };
  CHG['iv-ffor'] = el => { st().forId = el.value; reR(); };
  CHG['iv-pcat'] = el => { const s = st(); s.pcat = el.value; s.cur = null; reR(); };
  CHG['iv-pfor'] = el => { const s = st(); s.pfor = el.value; s.cur = null; reR(); };
  const F = (ED.forms = ED.forms || {});
  F['iv-doc-add'] = form => { const i = form.querySelector('input'); const t = i.value.trim(); if (!t) return; IV().docs.push({ id: U.uid('id'), text: t, done: false }); ED.store.commit(); setTimeout(() => { const n = document.querySelector('[data-form="iv-doc-add"] input'); if (n) n.focus(); }, 30); };
})();
