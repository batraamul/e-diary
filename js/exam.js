/* E-Diary — Interview & Exams → Exam preparation.
   Left page:  your exams with their key dates (last date to apply, admit card, exam day, result — each can go into
               the calendar), a countdown, the daily pace you need, and minutes studied for the exam.
   Right page: Syllabus (topics by subject: not started → learning → done → revised), Revision (topics due for
               spaced revision: 1, 3, 7, 15, 30, 60 days after the last pass) and Mock tests (scores over time).
   Data: ED.store.data.exam = {
     list:   [{ id, name, body, date, time, apply, admit, result, centre, link, status, target, notes, cal, eventId, applyEventId }],
     topics: [{ id, examId, subj, name, st: 0 not started | 1 learning | 2 done | 3 revised, rev, last, weak, notes }],
     mocks:  [{ id, examId, date, name, score, max, mins, notes }],
     log:    { 'YYYY-MM-DD': minutes studied for exams } } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const CH = ED.charts, FX = ED.fx;
  const D = () => ED.store.data;
  const EX = () => { const d = D(); if (!d.exam || typeof d.exam !== 'object') d.exam = ED.sample.exam(); ['list', 'topics', 'mocks'].forEach(k => { if (!Array.isArray(d.exam[k])) d.exam[k] = []; }); if (!d.exam.log || typeof d.exam.log !== 'object') d.exam.log = {}; return d.exam; };
  const A = (ED.actions = ED.actions || {});
  const CHG = (ED.changes = ED.changes || {});
  const F = (ED.forms = ED.forms || {});
  const st = () => ED.state.ex || (ED.state.ex = {});
  const XP = (ED.exam = {});

  const STATUS = ['Not started', 'Learning', 'Done', 'Revised'];
  const STAGES = ['Planning', 'Form filled', 'Admit card', 'Appeared', 'Result awaited', 'Qualified', 'Not qualified', 'Dropped'];
  const OVER = ['Appeared', 'Result awaited', 'Qualified', 'Not qualified', 'Dropped'];
  const GAPS = [1, 3, 7, 15, 30, 60];          // days to the next revision after 0, 1, 2… passes
  const today = () => U.today();

  /* ---------------- helpers ---------------- */
  const exams = () => EX().list.slice().sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
  const active = () => exams().filter(x => OVER.indexOf(x.status) < 0 && (!x.date || x.date >= today()));
  const sel = () => { const l = EX().list; let x = l.find(y => y.id === st().sel); if (!x) { x = active()[0] || exams()[0] || null; st().sel = x ? x.id : null; } return x; };
  const topicsOf = id => EX().topics.filter(t => t.examId === id);
  const subjects = id => { const out = []; topicsOf(id).forEach(t => { const s = t.subj || 'General'; if (out.indexOf(s) < 0) out.push(s); }); return out; };
  const nextRev = t => t.st >= 2 && t.last ? U.addDays(t.last, GAPS[Math.min(GAPS.length - 1, t.rev || 0)]) : null;
  XP.nextRev = nextRev;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const stCls = s => ['new', 'learn', 'done', 'rev'][s || 0];
  const when = k => FX.when(k);
  const mocksOf = id => EX().mocks.filter(m => m.examId === id && m.score != null && m.max).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  /* ---------------- left page ---------------- */
  const keyDates = x => [['apply', 'Last date to apply'], ['admit', 'Admit card'], ['date', 'Exam'], ['result', 'Result']].filter(k => x[k[0]]).map(k => {
    const d = x[k[0]], n = U.diffDays(today(), d);
    return '<li class="' + (n < 0 ? 'past' : n <= 7 ? 'soon' : '') + '"><span class="ex-kd-l">' + e(k[1]) + '</span><span class="num">' + e(U.fmtShort(d)) + (k[0] === 'date' && x.time ? ' · ' + e(FX.time(x.time)) : '') + '</span><span class="hint num">' + (n < 0 ? 'done' : e(when(d))) + '</span></li>';
  }).join('');
  const view = {
    id: 'exam', label: 'Exam Preparation',
    left() {
      const d = EX(), x = sel(), nx = active().filter(y => y.date)[0];
      const allT = x ? topicsOf(x.id) : [], doneT = allT.filter(t => t.st >= 2).length;
      const due = x ? allT.filter(t => { const r = nextRev(t); return r && r <= today(); }).length : 0;
      const ms = x ? mocksOf(x.id) : [], last = ms[ms.length - 1];
      const wk = U.range(U.addDays(today(), -6), 7).reduce((a, k) => a + (+d.log[k] || 0), 0);
      const tiles = '<div class="tiles xp-tiles">' +
        FX.tile('Next exam', nx ? e(when(nx.date)) : '—', nx ? e(nx.name) + ' · ' + e(U.fmtDM(nx.date)) : 'add one below', nx && U.diffDays(today(), nx.date) <= 7 ? 'warn' : '') +
        FX.tile('Syllabus done', allT.length ? pct(doneT, allT.length) + '%' : '—', allT.length ? doneT + ' of ' + allT.length + ' topics' : 'add topics on the right') +
        FX.tile('Revision due', String(due), due ? 'topics to revise today' : 'nothing due', due ? 'warn' : '') +
        FX.tile('Mock tests', last ? pct(+last.score, +last.max) + '%' : '—', last ? 'last · ' + ms.length + ' taken' : 'none yet') + '</div>';
      const cards = exams().map(y => {
        const n = y.date ? U.diffDays(today(), y.date) : null, over = OVER.indexOf(y.status) >= 0 || (n != null && n < 0);
        const t = topicsOf(y.id), dn = t.filter(z => z.st >= 2).length;
        return '<article class="xp-card' + (over ? ' dim' : '') + (x && y.id === x.id ? ' ex-sel' : '') + '"><button type="button" class="plain-btn xp-card-b" data-act="ex-sel" data-id="' + e(y.id) + '">' +
          '<span class="xp-date">' + (y.date ? '<b>' + (+y.date.slice(8)) + '</b><span>' + U.MON[+y.date.slice(5, 7) - 1] + '</span>' : '<b>—</b><span>no date</span>') + '</span>' +
          '<span class="xp-m"><b>' + e(y.name || 'Exam') + '</b><span class="hint">' + e([y.body, y.centre].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="ex-bar" title="' + dn + ' of ' + t.length + ' topics done"><i style="width:' + pct(dn, t.length) + '%"></i></span></span>' +
          '<span class="xp-r"><span class="xp-stage">' + e(y.status || STAGES[0]) + '</span>' + (n != null && n >= 0 && !over ? '<span class="hint num">' + e(when(y.date)) + '</span>' : '') + (y.eventId ? '<span class="hint">' + ED.icon('calendar') + ' in calendar</span>' : '') + '</span></button>' +
          '<button type="button" class="icon-btn sm ex-edit" data-act="ex-edit" data-id="' + e(y.id) + '" aria-label="Edit ' + e(y.name || 'exam') + '" title="Edit">' + ED.icon('pencil') + '</button></article>';
      }).join('');
      let detail = '';
      if (x) {
        const n = x.date ? U.diffDays(today(), x.date) : null;
        const left = allT.filter(t => t.st < 2).length;
        const pace = n != null && n > 0 && left ? Math.ceil(left / Math.max(1, n - Math.min(7, Math.floor(n / 4)))) : 0;   // keep the last days for revision
        const mins = (d.log[today()] || 0);
        detail = '<h3 class="gh fin-gap">' + e(x.name) + '</h3>' +
          (keyDates(x) ? '<ul class="ex-kd">' + keyDates(x) + '</ul>' : '<p class="hint">Add the exam date, the last date to apply and the admit-card date with ✎ to see them counted down here.</p>') +
          (pace ? '<div class="notice info ex-pace">' + ED.icon('target') + '<span class="grow"><b>' + U.plural(left, 'topic') + '</b> still to learn and ' + U.plural(n, 'day') + ' to go: about <b>' + U.plural(pace, 'topic') + ' a day</b> keeps the last ' + U.plural(Math.min(7, Math.floor(n / 4)), 'day') + ' free for revision.</span></div>' : '') +
          (x.link ? '<p><a class="link-btn" href="' + e(x.link) + '" target="_blank" rel="noopener noreferrer">' + ED.icon('external') + 'Notification / exam website</a></p>' : '') +
          (x.notes ? '<p class="ex-notes">' + e(x.notes).replace(/\n/g, '<br>') + '</p>' : '') +
          '<form class="ex-log" data-form="ex-log"><label for="ex-log-in">Studied today</label><input id="ex-log-in" class="field num" type="number" min="0" max="900" step="5" value="' + (mins || '') + '" placeholder="min"><span class="hint">minutes · ' + Math.round(wk / 6) / 10 + ' h in the last 7 days</span><button type="submit" class="btn small">Save</button></form>';
      }
      const body = tiles + '<h3 class="gh">Exams</h3>' + (cards ? '<div class="xp-cards">' + cards + '</div>' : '<p class="hint">No exams yet. Add one — a recruitment exam, a departmental exam, a certification — to count down to it and track its syllabus.</p>') +
        '<div class="row-btns"><button type="button" class="btn small primary" data-act="ex-new">' + ED.icon('plus') + 'Add an exam</button></div>' + detail;
      return FX.page('ex', 'Exam preparation', '', body, 'ex-left');
    },
    right() {
      const tab = st().tab || 'syl', x = sel();
      const seg = FX.seg('ex-tab', tab, [['syl', 'Syllabus'], ['rev', 'Revision'], ['mock', 'Mock tests']]);
      const pick = EX().list.length > 1 ? '<select class="field ex-pick" data-change="ex-pick" aria-label="Exam">' + exams().map(y => FX.opt(y.id, y.name || 'Exam', x && y.id === x.id)).join('') + '</select>' : '';
      const body = !x ? '<p class="hint">Add an exam on the left first.</p>' : tab === 'rev' ? revision(x) : tab === 'mock' ? mocks(x) : syllabus(x);
      return '<div class="xp ex-r"><div class="pg-head"><h2 class="pg-title">' + (tab === 'rev' ? 'Revision' : tab === 'mock' ? 'Mock tests' : 'Syllabus') + '</h2>' + seg + '</div>' + (pick ? '<div class="ex-pickrow">' + pick + '</div>' : '') +
        '<div class="st-scroll scroll" data-keep-scroll="ex-r-' + tab + '">' + body + '</div></div>';
    },
    mount(L, R) { CH.bind(R); },
  };
  ED.views = ED.views || {};
  ED.views.exam = view;

  /* ---------------- syllabus ---------------- */
  function syllabus(x) {
    const s = st(), all = topicsOf(x.id), subs = subjects(x.id), f = s.stf == null ? '' : String(s.stf);
    const meters = subs.length ? CH.meters({
      title: 'By subject', max: 100,
      rows: subs.map(sb => { const l = all.filter(t => (t.subj || 'General') === sb), dn = l.filter(t => t.st >= 2).length; return { label: sb, value: pct(dn, l.length), total: 100, valueLabel: dn + '/' + l.length + ' · ' + pct(dn, l.length) + '%', tip: l.filter(t => t.st === 3).length + ' revised · ' + l.filter(t => t.st === 1).length + ' being learnt' }; }),
      table: CH.table(['Subject', 'Topics', 'Done', 'Revised'], subs.map(sb => { const l = all.filter(t => (t.subj || 'General') === sb); return [sb, String(l.length), String(l.filter(t => t.st >= 2).length), String(l.filter(t => t.st === 3).length)]; })),
    }) : '';
    const add = '<form class="ex-add" data-form="ex-topics"><div class="ex-add-r"><input class="field" name="subj" list="ex-subj" placeholder="Subject (e.g. General Studies, Electronics)" aria-label="Subject" value="' + e(s.lastSubj || '') + '">' +
      '<datalist id="ex-subj">' + subs.map(sb => '<option value="' + e(sb) + '">').join('') + '</datalist></div>' +
      '<textarea class="field" name="topics" rows="3" placeholder="Topics — one per line (paste the syllabus here)" aria-label="Topics, one per line"></textarea>' +
      '<div class="row-btns"><button type="submit" class="btn small primary">' + ED.icon('plus') + 'Add topics</button></div></form>';
    const filt = all.length ? '<div class="xp-filters"><select class="field" data-change="ex-stf" aria-label="Show">' + FX.opt('', 'All topics', f === '') + STATUS.map((n, i) => FX.opt(String(i), n, f === String(i))).join('') + FX.opt('weak', 'Marked weak', f === 'weak') + '</select></div>' : '';
    const groups = subs.map(sb => {
      const l = all.filter(t => (t.subj || 'General') === sb && (f === '' || (f === 'weak' ? t.weak : String(t.st || 0) === f)));
      if (!l.length) return '';
      return '<section class="ex-grp"><h3 class="gh">' + e(sb) + ' <span class="hint num">· ' + l.filter(t => t.st >= 2).length + '/' + l.length + '</span></h3><ul class="ex-topics">' + l.map(t => {
        const r = nextRev(t);
        return '<li class="ex-t s-' + stCls(t.st) + '"><button type="button" class="ex-st s-' + stCls(t.st) + '" data-act="ex-st" data-id="' + e(t.id) + '" title="' + e(STATUS[t.st || 0]) + ' — click for the next step" aria-label="' + e(t.name) + ': ' + e(STATUS[t.st || 0]) + '. Change">' + e(STATUS[t.st || 0]) + '</button>' +
          '<button type="button" class="plain-btn ex-tn" data-act="ex-topic" data-id="' + e(t.id) + '">' + (t.weak ? '<span class="ex-weak" title="Marked weak">!</span>' : '') + e(t.name) + '</button>' +
          '<span class="hint num ex-tr">' + (t.rev ? '×' + t.rev : '') + (r ? ' · next ' + e(r <= today() ? 'now' : U.fmtDM(r)) : '') + '</span></li>';
      }).join('') + '</ul></section>';
    }).join('');
    return meters + add + filt + (groups || (all.length ? '<p class="hint">No topics match.</p>' : '<p class="hint">Paste the syllabus: one topic per line, under a subject. Click a topic’s status to move it on: not started → learning → done → revised.</p>'));
  }

  /* ---------------- revision ---------------- */
  function revision(x) {
    const t0 = today(), wk = U.addDays(t0, 7);
    const l = topicsOf(x.id).map(t => ({ t, r: nextRev(t) })).filter(y => y.r);
    const over = l.filter(y => y.r < t0), now = l.filter(y => y.r === t0), soon = l.filter(y => y.r > t0 && y.r <= wk).sort((a, b) => a.r.localeCompare(b.r));
    const weak = topicsOf(x.id).filter(t => t.weak);
    const row = y => '<li class="ex-t"><span class="grow"><b>' + e(y.t.name) + '</b> <span class="hint">' + e(y.t.subj || '') + (y.t.rev ? ' · revised ' + U.plural(y.t.rev, 'time') : ' · first revision') + (y.t.last ? ' · last ' + e(U.fmtDM(y.t.last)) : '') + '</span></span>' +
      '<span class="hint num">' + e(y.r < t0 ? U.plural(U.diffDays(y.r, t0), 'day') + ' late' : y.r === t0 ? 'today' : U.fmtDM(y.r)) + '</span>' +
      '<button type="button" class="btn small" data-act="ex-revised" data-id="' + e(y.t.id) + '">' + ED.icon('check') + 'Revised</button></li>';
    const sec = (h, list, cls) => list.length ? '<h3 class="gh ' + (cls || '') + '">' + h + ' <span class="hint num">· ' + list.length + '</span></h3><ul class="ex-topics">' + list.map(row).join('') + '</ul>' : '';
    const n = x.date ? U.diffDays(t0, x.date) : null;
    return '<p class="hint">Topics come back for revision 1, 3, 7, 15, 30 and 60 days after each pass — the gaps that make things stick. A topic joins once you mark it done.</p>' +
      (n != null && n >= 0 && n <= 10 ? '<div class="notice info">' + ED.icon('target') + '<span class="grow">The exam is ' + e(when(x.date)) + ': revise every topic marked done once more, weak ones first.</span></div>' : '') +
      (sec('Overdue', over, 'ex-late') + sec('Due today', now) + sec('Next 7 days', soon) || '<p class="hint">Nothing due for revision. Mark topics done on the Syllabus tab and they will come back here at the right time.</p>') +
      (weak.length ? '<h3 class="gh">Marked weak <span class="hint num">· ' + weak.length + '</span></h3><ul class="ex-topics">' + weak.map(t => '<li class="ex-t"><button type="button" class="plain-btn grow ex-tn" data-act="ex-topic" data-id="' + e(t.id) + '"><b>' + e(t.name) + '</b> <span class="hint">' + e(t.subj || '') + '</span></button></li>').join('') + '</ul>' : '');
  }

  /* ---------------- mock tests ---------------- */
  function mocks(x) {
    const ms = mocksOf(x.id), all = EX().mocks.filter(m => m.examId === x.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const target = +x.target || 0;
    const chart = ms.length >= 2 ? CH.lines({
      title: 'Score (%)', labels: ms.map(m => U.fmtDM(m.date)), long: ms.map(m => U.fmtLong(m.date) + (m.name ? ' · ' + m.name : '')), h: 180, left: 34, yMax: 100, fmt: v => Math.round(v) + '%', tipFmt: v => Math.round(v) + '%',
      series: [{ name: 'Score', color: 'var(--s1)', points: ms.map(m => pct(+m.score, +m.max)) }].concat(target ? [{ name: 'Target', color: 'var(--ink-3)', dash: true, points: ms.map(() => target) }] : []),
      legend: target ? CH.legend([{ kind: 'line', color: 'var(--s1)', label: 'Score' }, { kind: 'line', color: 'var(--ink-3)', label: 'Target ' + target + '%' }]) : '',
      table: CH.table(['Date', 'Test', 'Score', '%'], ms.map(m => [U.fmtDM(m.date), m.name || '', m.score + '/' + m.max, pct(+m.score, +m.max) + '%'])),
    }) : '';
    const best = ms.reduce((a, m) => Math.max(a, pct(+m.score, +m.max)), 0), avg = ms.length ? Math.round(ms.reduce((a, m) => a + pct(+m.score, +m.max), 0) / ms.length) : 0;
    const tiles = ms.length ? '<div class="tiles xp-tiles">' + FX.tile('Tests', String(ms.length), '') + FX.tile('Average', avg + '%', '') + FX.tile('Best', best + '%', '') + FX.tile('Target', target ? target + '%' : '—', target ? (avg >= target ? 'on track' : (target - avg) + ' points to go') : 'set it with ✎ on the exam', target && avg < target ? 'warn' : '') + '</div>' : '';
    const list = all.map(m => '<li><button type="button" class="plain-btn xp-li" data-act="ex-mock" data-id="' + e(m.id) + '"><span class="num">' + e(U.fmtDM(m.date)) + '</span><span class="grow">' + e(m.name || 'Mock test') + (m.mins ? ' <span class="hint">· ' + m.mins + ' min</span>' : '') + '</span><b class="num">' + (m.max ? pct(+m.score, +m.max) + '%' : '') + '</b><span class="hint num">' + e(m.score != null ? m.score + '/' + (m.max || '?') : '') + '</span></button></li>').join('');
    return '<div class="row-btns"><button type="button" class="btn small primary" data-act="ex-mock">' + ED.icon('plus') + 'Add a mock test</button></div>' + tiles + chart +
      (list ? '<ul class="xp-list">' + list + '</ul>' : '<p class="hint">Take full-length mock tests under exam conditions and note the score; the trend shows here once you have two.</p>');
  }

  /* ---------------- dialogs ---------------- */
  XP.edit = id => {
    const d = EX(), x = id ? d.list.find(y => y.id === id) : null;
    FX.form({
      title: x ? 'Exam' : 'Add an exam', wide: true,
      data: x ? Object.assign({ cal: !!x.eventId }, x) : { name: '', body: '', status: STAGES[0], cal: true },
      fields: [
        { k: 'name', label: 'Exam', req: true, ph: 'e.g. UPSC Combined Geo-Scientist, GATE, departmental exam, AWS certification' },
        { k: 'body', label: 'Conducted by', ph: 'UPSC, SSC, NTA, DoPT, the department…' },
        { k: 'status', label: 'Stage', type: 'select', options: STAGES.map(s => [s, s]) },
        { k: 'apply', label: 'Last date to apply', type: 'date' },
        { k: 'admit', label: 'Admit card from', type: 'date' },
        { k: 'date', label: 'Exam date', type: 'date' }, { k: 'time', label: 'Reporting time', type: 'time' },
        { k: 'result', label: 'Result expected', type: 'date' },
        { k: 'centre', label: 'Centre / city' },
        { k: 'target', label: 'Target score in mocks (%)', type: 'number', min: 0, max: 100 },
        { k: 'link', label: 'Notification / website link', ph: 'https://…' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, ph: 'Pattern, negative marking, books, cut-offs…' },
        { k: 'cal', label: 'Put the exam day and the last date to apply in my calendar', type: 'check' },
      ],
      del: x ? async () => {
        const ok = await ED.ui.confirm({ title: 'Delete exam', message: 'Delete “' + (x.name || 'this exam') + '” with its syllabus topics and mock tests?', ok: 'Delete', danger: true });
        if (!ok) return false;
        ED.store.checkpoint('Delete exam');
        FX.dropEvent(x); FX.dropEvent({ eventId: x.applyEventId });
        d.list = d.list.filter(y => y.id !== x.id); d.topics = d.topics.filter(t => t.examId !== x.id); d.mocks = d.mocks.filter(m => m.examId !== x.id);
        if (st().sel === x.id) st().sel = null;
        ED.store.commit(); ED.ui.undoToast('Exam deleted');
      } : null,
      save(v, api) {
        ED.store.checkpoint(x ? 'Exam' : 'New exam');
        const it = x || { id: U.uid('ex'), createdAt: Date.now() };
        const cal = v.cal; delete v.cal;
        if (v.target == null || v.target === '') delete v.target;
        Object.assign(it, v, { updatedAt: Date.now() });
        const live = OVER.indexOf(it.status) < 0 || it.status === 'Appeared';
        FX.linkEvent(it, { on: cal && live, title: 'Exam: ' + it.name, date: it.date, time: it.time, mins: 180, location: it.centre, notes: [it.body, it.link].filter(Boolean).join('\n'), reminder: 120, color: '#7b4bd6' });
        const ap = { eventId: it.applyEventId };
        FX.linkEvent(ap, { on: cal && it.apply && it.status === STAGES[0], title: 'Last date to apply: ' + it.name, date: it.apply, color: '#d93025', notes: it.link || '' });
        if (ap.eventId) it.applyEventId = ap.eventId; else delete it.applyEventId;
        if (!x) d.list.push(it);
        st().sel = it.id;
        ED.store.commit(); api.close(); ED.ui.toast(x ? 'Exam saved' : 'Exam added' + (it.eventId ? ' — it is in your calendar too' : ''));
      },
    });
  };
  XP.editTopic = id => {
    const d = EX(), t = d.topics.find(y => y.id === id); if (!t) return;
    FX.form({
      title: 'Topic',
      data: Object.assign({}, t, { st: String(t.st || 0) }),
      fields: [
        { k: 'name', label: 'Topic', req: true }, { k: 'subj', label: 'Subject', list: subjects(t.examId) },
        { k: 'st', label: 'Status', type: 'select', options: STATUS.map((s, i) => [String(i), s]) },
        { k: 'rev', label: 'Times revised', type: 'number', min: 0, max: 50 },
        { k: 'last', label: 'Last studied / revised', type: 'date' },
        { k: 'weak', label: 'Mark as weak (needs extra work)', type: 'check' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, ph: 'Book and page, formulae, mistakes to avoid…' },
      ],
      del: async () => { ED.store.checkpoint('Delete topic'); d.topics = d.topics.filter(y => y.id !== t.id); ED.store.commit(); ED.ui.undoToast('Topic deleted'); },
      save(v, api) {
        ED.store.checkpoint('Topic');
        v.st = +v.st || 0; v.rev = Math.max(0, +v.rev || 0);
        Object.assign(t, v, { updatedAt: Date.now() });
        ED.store.commit(); api.close();
      },
    });
  };
  XP.editMock = id => {
    const d = EX(), x = sel(); if (!x) return;
    const m = id ? d.mocks.find(y => y.id === id) : null;
    FX.form({
      title: m ? 'Mock test' : 'Add a mock test',
      data: m || { date: today(), name: '', max: 100 },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'name', label: 'Test', ph: 'e.g. Full test 3, Paper II sectional' },
        { k: 'score', label: 'Marks scored', type: 'number', step: 0.25, req: true }, { k: 'max', label: 'Out of', type: 'number', min: 1, req: true },
        { k: 'mins', label: 'Time taken (min)', type: 'number', min: 0 },
        { k: 'notes', label: 'What to improve', type: 'textarea', rows: 3 },
      ],
      check: v => (+v.max > 0 && +v.score > +v.max ? 'The score is more than the maximum.' : ''),
      del: m ? async () => { ED.store.checkpoint('Delete mock'); d.mocks = d.mocks.filter(y => y.id !== m.id); ED.store.commit(); ED.ui.undoToast('Mock test deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint(m ? 'Mock test' : 'New mock test');
        if (m) Object.assign(m, v, { updatedAt: Date.now() }); else d.mocks.push(Object.assign({ id: U.uid('mk'), examId: x.id, createdAt: Date.now(), updatedAt: Date.now() }, v));
        ED.store.commit(); api.close();
      },
    });
  };

  /* ---------------- actions ---------------- */
  A['ex-new'] = () => XP.edit(null);
  A['ex-edit'] = el => XP.edit(el.dataset.id);
  A['ex-sel'] = el => { st().sel = el.dataset.id; ED.app.render(); };
  A['ex-tab'] = el => { st().tab = el.dataset.k; ED.app.renderPage('right'); CH.bind(document.getElementById('pg-right')); };
  CHG['ex-pick'] = el => { st().sel = el.value; ED.app.render(); };
  CHG['ex-stf'] = el => { st().stf = el.value; ED.app.renderPage('right'); CH.bind(document.getElementById('pg-right')); };
  A['ex-topic'] = el => XP.editTopic(el.dataset.id);
  A['ex-mock'] = el => XP.editMock(el.dataset.id || null);
  /* status steps on: not started → learning → done → revised → (back to not started) */
  A['ex-st'] = el => {
    const t = EX().topics.find(y => y.id === el.dataset.id); if (!t) return;
    const n = ((t.st || 0) + 1) % 4;
    t.st = n;
    if (n === 2) { t.last = today(); t.rev = 0; }
    if (n === 3) { t.rev = Math.max(1, (t.rev || 0) + 1); t.last = today(); }
    if (n === 0) { t.rev = 0; t.last = null; }
    t.updatedAt = Date.now();
    ED.store.commit();
  };
  A['ex-revised'] = el => {
    const t = EX().topics.find(y => y.id === el.dataset.id); if (!t) return;
    ED.store.checkpoint('Revised');
    t.rev = (t.rev || 0) + 1; t.last = today(); t.st = 3; t.updatedAt = Date.now();
    ED.store.commit(); ED.ui.undoToast('Revised: ' + t.name + ' — next in ' + U.plural(GAPS[Math.min(GAPS.length - 1, t.rev)], 'day'));
  };
  F['ex-topics'] = f => {
    const x = sel(); if (!x) return;
    const subj = f.elements.subj.value.trim() || 'General';
    const names = f.elements.topics.value.split(/\n+/).map(s => s.replace(/^[\s•\-–*\d.)]+/, '').trim()).filter(Boolean);
    if (!names.length) { f.elements.topics.focus(); return; }
    const have = new Set(topicsOf(x.id).filter(t => (t.subj || 'General') === subj).map(t => t.name.toLowerCase()));
    const add = names.filter((n, i) => names.indexOf(n) === i && !have.has(n.toLowerCase()));
    ED.store.checkpoint('Add topics');
    add.forEach(n => EX().topics.push({ id: U.uid('xt'), examId: x.id, subj, name: n, st: 0, rev: 0, last: null, weak: false, updatedAt: Date.now() }));
    st().lastSubj = subj;
    ED.store.commit();
    ED.ui.undoToast(add.length ? U.plural(add.length, 'topic') + ' added to ' + subj : 'Those topics are already there');
  };
  F['ex-log'] = f => {
    const v = f.querySelector('input').value;
    const n = Math.max(0, Math.min(900, parseInt(v, 10) || 0));
    const log = EX().log;
    if (n) log[today()] = n; else delete log[today()];
    ED.store.commit(); ED.ui.toast(n ? 'Saved: ' + n + ' minutes today' : 'Cleared');
  };
})();
