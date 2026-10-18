/* E-Diary — Study planner pages: Yearly, Monthly, Weekly & Daily (modelled on the "Scientist-F Study Plan" workbook:
   Read Me → Yearly, Daily Plan → Weekly & Daily, Weekly Overview / Track Matrix → Monthly and Yearly).
   Every graph counts what you actually studied — the day you studied it (not only the day it was planned for) and the
   time you really spent — against what the plan asks, so ticking a session moves the lines at once. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const ST = ED.study, CH = ED.charts;
  const S = () => ED.store.data.settings;
  const A = (ED.actions = ED.actions || {});
  const st = () => ED.state.study || (ED.state.study = {});
  const h1 = m => Math.round(m / 6) / 10; // minutes → hours, one decimal
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  /* ---------- shared bits ---------- */
  const menuBtn = '<button type="button" class="btn small" data-act="study-menu" aria-haspopup="menu">' + ED.icon('book') + 'Plan ' + ED.icon('chevD') + '</button>';
  const trackChip = (tr, extra) => '<span class="trk" style="--c:' + ST.color(tr) + '"><i class="sw"></i>' + e(ST.short(tr)) + (extra ? '<span class="hint"> · ' + e(extra) + '</span>' : '') + '</span>';
  const tick = s => '<button type="button" class="stick' + (s.done ? ' on' : '') + '" data-act="study-toggle" data-sid="' + e(s.id) + '" aria-pressed="' + !!s.done + '" aria-label="' + (s.done ? 'Done — click to undo' : 'Mark done') + '" title="' + (s.done ? 'Done' : 'Mark done') + '">' + ED.tasksUI.statusIcon(s.done ? 'done' : 'open') + '</button>';
  const bar = (done, total) => '<span class="st-bar' + (total && done >= total ? ' full' : '') + '"><i style="width:' + (total ? Math.min(100, Math.round(done / total * 100)) : 0) + '%"></i></span>';
  const tile = (label, value, sub, icon, cls) => '<div class="tile' + (cls ? ' ' + cls : '') + '">' + '<span class="tile-l">' + (icon ? ED.icon(icon) : '') + e(label) + '</span><span class="tile-v' + (typeof value === 'string' && /[a-z]/i.test(value) ? ' txt' : '') + '">' + e(String(value)) + '</span><span class="tile-s hint">' + sub + '</span></div>';
  const legendSP = () => CH.legend([{ kind: 'done', color: 'var(--accent)', label: 'Studied' }, { kind: 'total', color: 'var(--chart-track)', label: 'Planned' }]);
  const dayLabel = k => +k.slice(8) + ' ' + U.MON[+k.slice(5, 7) - 1];

  /* hours studied (by the day you studied) and planned (by the day in the plan), day by day */
  function dayColumns(o) {
    const today = U.today();
    const days = U.range(o.from, U.diffDays(o.from, o.to) + 1);
    const data = days.map(k => {
      const sm = ST.studied(k), pm = ST.planned(k);
      const n = ST.on(k).length, dn = ST.studiedList(k).length;
      return { label: o.short ? String(+k.slice(8)) : dayLabel(k), long: U.fmtLong(k), value: h1(sm), total: h1(pm), future: k > today && !sm,
        tip: (k > today && !sm ? h1(pm) + ' h planned' : h1(sm) + ' h studied of ' + h1(pm) + ' h planned') + (n || dn ? ' · ' + dn + ' session' + (dn === 1 ? '' : 's') + ' done' : '') };
    });
    const cur = days.indexOf(today);
    return CH.columns({
      title: o.title, data, cur: cur >= 0 ? cur : null, capCur: d => d.value + ' h', fmt: v => (Math.round(v * 10) / 10) + ' h', maxLabels: o.maxLabels || 10, h: o.h || 200, fine: true, left: 46,
      legend: legendSP(), sub: o.sub || '',
      table: CH.table(['Day', 'Studied (h)', 'Planned (h)'], days.map((k, i) => [U.fmtShort(k), k > today && !data[i].value ? '—' : data[i].value, data[i].total])),
    });
  }

  function empty(which) {
    const left = '<div class="study st-empty">' +
      '<div class="pg-head"><h2 class="pg-title">Study planner · ' + e(which) + '</h2></div>' +
      '<div class="st-empty-body">' + ED.icon('book', 'st-big') +
      '<h3>Plan your studies week by week</h3>' +
      '<p>Import your plan from Excel and tick each session as you finish it. The yearly, monthly and weekly pages, the progress graphs and your daily page all update from the same plan.</p>' +
      '<div class="row-btns"><button type="button" class="btn primary" data-act="study-import">' + ED.icon('upload') + 'Import from Excel or CSV</button>' +
      '<button type="button" class="btn" data-act="study-new">' + ED.icon('plus') + 'Make a plan here</button></div></div></div>';
    const right = '<div class="study st-help scroll">' +
      '<h3 class="gh">What the Excel file needs</h3>' +
      '<p>One sheet with a row per study session and these columns in the first row (any order):</p>' +
      '<table class="st-table"><thead><tr><th>Column</th><th>Example</th></tr></thead><tbody>' +
      [['Date', '05-10-2026'], ['Track (or Subject)', 'AI & Machine Learning'], ['Min (or Hours)', '60'], ['Slot', '1 - AI (Reading)'], ['Topic', 'Loss landscapes'], ['Source / task', 'UDL ch. 2–5'], ['Done', 'Y'], ['Week', '1']].map(r => '<tr><td>' + e(r[0]) + '</td><td>' + e(r[1]) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<p class="hint">Only Date and Track are required. A workbook laid out like the <b>Scientist-F Study Plan</b> (Read Me, Daily Plan, Weekly Overview, Track Matrix, Books, Lectures) is read completely: phases, week notes, topics per week, subject days, books and lectures. Any number of slots a day works (1, 2, 3…).</p>' +
      '<p class="hint">Old <b>.xls</b> files: open them in Excel and save as <b>.xlsx</b> first. Google Sheets: File → Download → Microsoft Excel.</p></div>';
    return { left, right };
  }

  /* ======================= YEARLY ======================= */
  const yearly = {
    left() {
      const p = ST.plan();
      const all = ST.stats();
      const today = U.today();
      const sp = ST.span() || { a: p.start, b: p.end };
      // this week: the same seven days the Week & Day page shows for today (its plan week, else Monday to Sunday)
      const tw = ST.weekAt(today), wk0 = tw.a, wk1 = tw.b;
      const wStudied = ST.studiedBetween(wk0, wk1), wPlanned = ST.plannedBetween(wk0, wk1);
      const pc = ST.pace();
      const notStarted = today < sp.a;
      const pace = notStarted && !pc.cov ? 'Starts in ' + U.plural(U.diffDays(today, sp.a), 'day') : Math.abs(pc.diff) < 30 ? 'On track' : pc.diff < 0 ? h1(-pc.diff) + ' h behind' : h1(pc.diff) + ' h ahead';
      const paceIcon = notStarted ? 'clock' : Math.abs(pc.diff) < 30 ? 'check' : pc.diff < 0 ? 'clock' : 'trendUp';
      const streak = ST.streak();
      const tiles = '<div class="tiles st-tiles five">' +
        tile('Plan covered', pct(all.covMin, all.min) + '%', all.done + ' of ' + all.n + ' sessions') +
        tile('Hours studied', h1(all.doneMin), 'of ' + h1(all.min) + ' h planned') +
        tile('This week', h1(wStudied) + ' h', wPlanned ? 'of ' + h1(wPlanned) + ' h planned' : 'nothing planned') +
        tile('Pace', pace, notStarted ? 'plan starts ' + e(U.fmtShort(sp.a)) : 'due so far: ' + h1(pc.due) + ' h', paceIcon, pc.diff < -30 && !notStarted ? 'warn' : '') +
        tile('Study streak', streak, streak === 1 ? 'day' : 'days') + '</div>';

      // 1) progress through the plan: cumulative share of planned hours, planned vs covered, day by day
      const range = st().yrange || 'sofar';
      const first = ST.firstStudy();
      // a session ticked ahead of its day counts on that day, so the covered line can run past today
      const lastCov = ST.lastStudy(), until = lastCov && lastCov > today ? lastCov : today;
      let a = sp.a, b = sp.b;
      if (first && first < a) a = first;
      if (range === 'sofar') {
        b = today > a ? today : U.addDays(a, 20);
        if (today < sp.a) { a = first && first < today ? first : U.addDays(today, -6); b = U.addDays(sp.a, 20); }
        if (until > b) b = until;
        if (U.diffDays(a, b) < 20) a = U.addDays(b, -20);
      } else if (today > b) b = today;
      const total = all.min || 1;
      const plannedBy = new Map(), coveredBy = new Map();
      ST.sessions().forEach(s => { plannedBy.set(s.date, (plannedBy.get(s.date) || 0) + s.min); if (s.done) { const k = ST.doneOn(s); coveredBy.set(k, (coveredBy.get(k) || 0) + s.min); } });
      let cp = 0, cd = 0;
      plannedBy.forEach((m, k) => { if (k < a) cp += m; });
      coveredBy.forEach((m, k) => { if (k < a) cd += m; });
      const days = U.range(a, U.diffDays(a, b) + 1);
      const planned = [], done = [];
      days.forEach(k => { cp += plannedBy.get(k) || 0; cd += coveredBy.get(k) || 0; planned.push(Math.round(cp / total * 1000) / 10); done.push(k <= until ? Math.round(cd / total * 1000) / 10 : null); });
      const ti = days.indexOf(today);
      const seg = '<div class="seg st-mini-seg" role="group" aria-label="Range">' + [['sofar', 'So far'], ['all', 'Whole plan']].map(x => '<button type="button" data-act="study-yrange" data-r="' + x[0] + '" aria-pressed="' + (range === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
      const lastDone = done.filter(v => v != null).slice(-1)[0] || 0, lastPlan = ti >= 0 ? planned[ti] : planned[planned.length - 1];
      const burn = CH.lines({
        title: 'Progress through the plan', labels: days.map(dayLabel), long: days.map(k => U.fmtLong(k)),
        series: [{ name: 'Plan says', color: 'var(--ink-3)', points: planned, muted: true }, { name: 'Covered', color: 'var(--s1)', points: done, area: true }],
        marker: ti, markerLabel: 'Today', tipFmt: v => v + '%', fmt: v => Math.round(v) + '%', maxLabels: 8,
        legend: CH.legend([{ kind: 'line', color: 'var(--s1)', label: 'Covered' }, { kind: 'line', color: 'var(--ink-3)', label: 'Plan says' }]),
        tools: seg,
        sub: (notStarted && !lastDone ? 'Your plan starts on ' + e(U.fmtLong(sp.a)) + '. The blue line rises as you tick sessions; a session ticked ahead counts on its own day.' : 'Share of the plan’s hours you have covered: <b>' + lastDone + '%</b>' + (ti >= 0 ? ' — the plan says <b>' + lastPlan + '%</b> by today.' : '.')),
        table: CH.table(['Day', 'Plan says (%)', 'Covered (%)'], days.map((k, i) => [U.fmtShort(k), planned[i], done[i] == null ? '—' : done[i]]).filter((r, i) => i % 7 === 0 || i === days.length - 1 || i === ti)),
      });

      // 2) hours studied each day: the last four weeks and the week ahead
      const from = U.addDays(today, -27), to = U.addDays(today, 7);
      const last7 = ST.studiedBetween(U.addDays(today, -6), today);
      const daily = dayColumns({ title: 'Hours studied each day', from, to, maxLabels: 9,
        sub: 'Last 7 days: <b>' + h1(last7) + ' h</b> (' + h1(last7 / 7) + ' h a day) of ' + h1(ST.plannedBetween(U.addDays(today, -6), today)) + ' h planned. Pale bars ahead are what the plan asks next.' });

      // 3) hours per plan week — studied during those seven days vs planned for them
      const ws = ST.weekStats();
      const curW = ST.weekOf(today);
      const curI = curW ? ws.findIndex(x => x.w.n === curW.n) : -1;
      const weekly = CH.columns({
        title: 'Hours per plan week', data: ws.map((x, i) => ({ label: 'W' + x.w.n, long: 'Week ' + x.w.n + ' · ' + x.w.label + (x.w.note ? ' · ' + x.w.note : ''), value: h1(x.studied), total: h1(x.min), future: x.w.start > today, tip: h1(x.studied) + ' h studied of ' + h1(x.min) + ' h planned · ' + x.done + '/' + x.n + ' sessions ticked' })),
        cur: curI >= 0 ? curI : null, capCur: d => d.value + '/' + d.total + ' h', fmt: v => Math.round(v) + ' h', maxLabels: 13, fine: true, left: 46,
        legend: legendSP(),
        table: CH.table(['Week', 'Planned (h)', 'Studied (h)', 'Sessions ticked'], ws.map(x => ['W' + x.w.n + ' · ' + x.w.label, h1(x.min), h1(x.studied), x.done + '/' + x.n])),
      });
      // 4) every day of the plan (and any day you studied outside it)
      const hd = [];
      let ha = sp.a, hb = sp.b;
      if (first && first < ha) ha = first;
      if (lastCov && lastCov > hb) hb = lastCov;     // study after the plan ended (catching up) shows too
      for (let k = ha; k <= hb; k = U.addDays(k, 1)) {
        const sm = ST.studied(k), pm = ST.planned(k);
        hd.push({ k, v: pm ? sm / pm : sm ? 1 : null, future: k > today && !sm, tip: pm ? h1(sm) + ' h studied of ' + h1(pm) + ' h planned' : sm ? h1(sm) + ' h studied (nothing planned)' : 'No study planned' });
      }
      const heat = CH.heat({ title: 'Every day of the plan', days: hd, weekStart: 1, act: 'study-day', go: 'studyWeek', sub: 'Darker = more of that day’s planned hours studied. Click a day to open it.' });
      return '<div class="study st-year">' +
        '<div class="pg-head st-head"><div class="st-titles"><h2 class="pg-title">' + e(p.title) + '</h2><p class="hint st-sub">' + e(p.subtitle || '') + '</p></div>' + menuBtn + '</div>' +
        '<div class="st-scroll scroll" data-keep-scroll="st-year">' + tiles + burn + daily + weekly + heat + '</div></div>';
    },
    right() {
      const p = ST.plan();
      const tab = st().ytab || 'subjects';
      const seg = '<div class="seg st-seg" role="group" aria-label="Show">' + [['subjects', 'Subjects'], ['matrix', 'Track matrix'], ['sources', 'Books & lectures'], ['topics', 'Topics'], ['notes', 'Notes']].map(x =>
        '<button type="button" data-act="study-ytab" data-tab="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>';
      const body = (yearly[tab] || yearly.subjects)(p);
      return '<div class="study st-year-r"><div class="pg-head"><h2 class="pg-title">Year at a glance</h2>' + seg + '</div><div class="st-scroll scroll" data-keep-scroll="st-yr-' + tab + '">' + body + '</div></div>';
    },
    subjects(p) {
      const ts = ST.trackStats();
      const meters = CH.meters({
        title: 'Progress by subject', legend: legendSP(),
        rows: ts.map(x => ({ label: x.tr.name, swatch: ST.color(x.tr), value: x.doneMin, total: x.min, valueLabel: h1(x.doneMin) + ' / ' + h1(x.min) + ' h · ' + pct(x.covMin, x.min) + '%', tip: x.done + ' of ' + x.n + ' sessions ticked · ' + pct(x.covMin, x.min) + '% of the plan covered' })),
        table: CH.table(['Subject', 'Planned (h)', 'Studied (h)', 'Sessions', 'Covered'], ts.map(x => [x.tr.name, h1(x.min), h1(x.doneMin), x.done + '/' + x.n, pct(x.covMin, x.min) + '%'])),
      });
      // where the time went in the last 30 days
      const today = U.today(), a30 = U.addDays(today, -29);
      const recent = new Map();
      ST.sessions().forEach(s => { if (!s.done) return; const k = ST.doneOn(s); if (k >= a30 && k <= today) recent.set(s.trackId, (recent.get(s.trackId) || 0) + ST.spent(s)); });
      const rrows = p.tracks.map(tr => ({ tr, m: recent.get(tr.id) || 0 })).filter(x => x.m).sort((a, b) => b.m - a.m);
      const rsum = rrows.reduce((a, x) => a + x.m, 0);
      const last30 = rrows.length ? CH.meters({
        title: 'Where your study time went · last 30 days', sub: h1(rsum) + ' h in all.',
        rows: rrows.map(x => ({ label: x.tr.name, swatch: ST.color(x.tr), value: x.m, color: ST.color(x.tr), valueLabel: h1(x.m) + ' h · ' + pct(x.m, rsum) + '%', tip: ST.fmtMin(x.m) })),
        table: CH.table(['Subject', 'Hours', 'Share'], rrows.map(x => [x.tr.name, h1(x.m), pct(x.m, rsum) + '%'])),
      }) : '';
      const dayName = d => d === -1 ? 'Every day' : d == null ? '—' : U.DAYS[d];
      const order = t => t.day === -1 ? 8 : t.day == null ? 9 : (t.day + 6) % 7;
      const pattern = '<h3 class="gh">Weekly pattern</h3><table class="st-table"><thead><tr><th>Day</th><th>Subject</th><th>Slot length</th><th class="num">Hours in plan</th><th class="num">Studied (h)</th></tr></thead><tbody>' +
        p.tracks.slice().sort((a, b) => order(a) - order(b)).map(t => { const x = ts.find(y => y.tr.id === t.id) || { min: 0, doneMin: 0 }; return '<tr><td>' + e(dayName(t.day)) + '</td><td>' + trackChip(t) + '<span class="st-full">' + e(t.name) + '</span></td><td>' + e(t.slot || '') + '</td><td class="num">' + h1(x.min) + '</td><td class="num">' + h1(x.doneMin) + '</td></tr>'; }).join('') + '</tbody></table>';
      const h12 = S().h12;
      const slots = '<h3 class="gh">Study slots</h3><table class="st-table"><thead><tr><th>Slot</th><th>Start</th><th class="num">Sessions</th><th class="num">Planned (h)</th><th class="num">Studied (h)</th></tr></thead><tbody>' +
        ST.slots().map(sl => { const l = ST.sessions().filter(s => (s.slotNo || 1) === sl.no); const x = ST.stats(l); return '<tr><td><b>' + sl.no + '</b> · ' + e(sl.name) + '</td><td>' + (sl.time ? e(U.fmtTime(sl.time, h12)) : '<span class="hint">no time</span>') + '</td><td class="num">' + x.done + '/' + x.n + '</td><td class="num">' + h1(x.min) + '</td><td class="num">' + h1(x.doneMin) + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<div class="row-btns"><button type="button" class="btn small" data-act="study-plan">' + ED.icon('gear') + 'Slots and times</button><button type="button" class="btn small" data-act="study-bulk">' + ED.icon('plus') + 'Add to the schedule</button></div>';
      // phases: hours studied during their weeks against hours planned for them (as in "Hours per plan week")
      const ph = new Map();
      ST.weekStats().forEach(x => { const k = x.w.phase || 'Plan'; if (!ph.has(k)) ph.set(k, { a: x.w.n, b: x.w.n, min: 0, doneMin: 0 }); const o = ph.get(k); o.b = x.w.n; o.min += x.min; o.doneMin += x.studied; });
      const phases = ph.size > 1 ? '<h3 class="gh">Phases</h3><table class="st-table"><thead><tr><th>Phase</th><th>Weeks</th><th class="num">Planned (h)</th><th class="num">Studied (h)</th><th>Progress</th></tr></thead><tbody>' +
        Array.from(ph.entries()).map(([k, o]) => '<tr><td>' + e(k) + '</td><td class="num">' + o.a + '–' + o.b + '</td><td class="num">' + h1(o.min) + '</td><td class="num">' + h1(o.doneMin) + '</td><td>' + bar(o.doneMin, o.min) + '</td></tr>').join('') + '</tbody></table>' : '';
      return meters + last30 + pattern + slots + phases;
    },
    matrix(p) {
      const today = U.today();
      const cur = ST.weekOf(today);
      const head = '<tr><th class="st-wk">Week</th>' + p.tracks.map(t => '<th style="--c:' + ST.color(t) + '"><span class="trk"><i class="sw"></i>' + e(ST.short(t)) + '</span><span class="st-dayl">' + (t.day === -1 ? 'every day' : t.day == null ? '' : U.DAY3[t.day]) + '</span></th>').join('') + '</tr>';
      const rows = ST.weeks().map(w => {
        const list = ST.inWeek(w.n);
        return '<tr class="' + (cur && cur.n === w.n ? 'cur' : '') + '"><th class="st-wk"><button type="button" class="plain-btn" data-act="study-day" data-date="' + (cur && cur.n === w.n ? today : w.start) + '" data-go="studyWeek" title="Open week ' + w.n + '"><b>W' + w.n + '</b><span class="hint">' + e(w.label) + '</span>' + (w.phase ? '<span class="hint">' + e(w.phase) + '</span>' : '') + (w.note ? '<span class="st-note">' + e(w.note) + '</span>' : '') + '</button></th>' +
          p.tracks.map(t => {
            const l = list.filter(s => s.trackId === t.id);
            const d = l.filter(s => s.done).length;
            const lvl = !l.length ? 'na' : d === 0 ? (w.start > today ? 'f' : 0) : d < l.length ? (d / l.length < 0.5 ? 1 : 2) : 3;
            return '<td class="mx mx-' + lvl + '" title="' + e((w.themes[t.id] || '') + ' — ' + d + ' of ' + l.length + ' done') + '"><button type="button" class="plain-btn" data-act="study-theme" data-week="' + w.n + '" data-track="' + e(t.id) + '">' + e(w.themes[t.id] || (l.length ? '—' : '')) + '</button>' + (l.length ? '<span class="mx-n num">' + d + '/' + l.length + '</span>' : '') + '</td>';
          }).join('') + '</tr>';
      }).join('');
      return '<p class="hint">All subjects as columns, weeks down the rows. A cell darkens as that week’s sessions are done; click a topic to change it.</p>' +
        '<div class="mx-key hint"><span><i class="mx-sw mx-0"></i>not started</span><span><i class="mx-sw mx-1"></i>started</span><span><i class="mx-sw mx-2"></i>mostly done</span><span><i class="mx-sw mx-3"></i>done</span></div>' +
        '<div class="mx-wrap"><table class="st-matrix"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
    },
    sources(p) {
      const link = w => { if (!w) return ''; const url = /^https?:\/\//i.test(w) ? w : /^[\w-]+(\.[\w-]+)+/.test(w) ? 'https://' + w : null; return url ? '<a href="' + e(url) + '" target="_blank" rel="noopener noreferrer">' + e(w.replace(/^https?:\/\//, '').replace(/\/$/, '')) + ED.icon('external') + '</a>' : e(w); };
      const used = id => ST.sessions().filter(s => s.sourceId === id).length;
      const list = (items, head) => items.length ? '<table class="st-table st-src"><thead><tr>' + head.map(h => '<th>' + e(h) + '</th>').join('') + '<th></th></tr></thead><tbody>' +
        items.map(x => { const tr = x.trackId ? ST.track(x.trackId) : null; const n = used(x.id); return '<tr><td>' + (tr ? trackChip(tr) : e(x.track || 'All')) + '</td><td><b>' + e(x.title) + '</b>' + (x.use ? '<div class="hint">' + e(x.use) + '</div>' : '') + (n ? '<div class="hint">' + U.plural(n, 'session') + '</div>' : '') + '</td><td>' + e(x.access || '') + '</td><td>' + link(x.where) + '</td>' +
          '<td><button type="button" class="icon-btn sm" data-act="study-src" data-id="' + e(x.id) + '" aria-label="Edit ' + e(x.title) + '" title="Edit">' + ED.icon('pencil') + '</button></td></tr>'; }).join('') + '</tbody></table>' : '';
      const b = list(p.books || [], ['Subject', 'Book', 'Access', 'Where']), l = list(p.lectures || [], ['Subject', 'Course', 'Access', 'Link']);
      // papers, patents, news, Employment News and your own categories
      const today = U.today();
      const cats = ST.srcCats().map(c => {
        const items = (p.items || []).filter(x => x.kind === c.id).sort((a, z) => (ST.srcFinished(a) ? 1 : 0) - (ST.srcFinished(z) ? 1 : 0) || String(a.due || '9999').localeCompare(String(z.due || '9999')));
        const open = items.filter(x => !ST.srcFinished(x)).length;
        const rows = items.map(x => {
          const tr = x.trackId ? ST.track(x.trackId) : null, n = used(x.id), fin = ST.srcFinished(x);
          const late = x.due && !fin && x.due < today && c.id !== 'news';
          return '<tr class="' + (fin ? 'ri-fin' : '') + '"><td>' + (tr ? trackChip(tr) : '<span class="hint">All</span>') + '</td>' +
            '<td><b>' + e(x.title) + '</b>' + (x.by || x.venue ? '<div class="hint">' + e([x.by, x.venue].filter(Boolean).join(' · ')) + '</div>' : '') + (x.use ? '<div class="hint ri-note">' + e(x.use) + '</div>' : '') + (n ? '<div class="hint">' + U.plural(n, 'session') + '</div>' : '') + '</td>' +
            '<td><span class="ri-st' + (fin ? ' fin' : '') + '">' + e(x.status || c.status[0]) + '</span></td>' +
            '<td class="num' + (late ? ' ri-late' : '') + '" title="' + e(c.f.due) + '">' + (x.due ? e(U.fmtDM(x.due)) + (late ? '<div class="hint">overdue</div>' : '') : '') + '</td><td>' + link(x.where) + '</td>' +
            '<td><button type="button" class="icon-btn sm" data-act="study-item" data-id="' + e(x.id) + '" aria-label="Edit ' + e(x.title) + '" title="Edit">' + ED.icon('pencil') + '</button></td></tr>';
        }).join('');
        return '<section class="ri-cat"><h3 class="gh ri-h"><span aria-hidden="true">' + e(c.icon) + '</span> ' + e(c.name) + ' <span class="hint num">· ' + items.length + (items.length && open !== items.length ? ' (' + open + ' open)' : '') + '</span>' +
          '<span class="grow"></span><button type="button" class="btn small ghost" data-act="study-item" data-kind="' + e(c.id) + '">' + ED.icon('plus') + 'Add</button>' +
          (c.own ? '<button type="button" class="icon-btn sm" data-act="study-cat" data-id="' + e(c.id) + '" aria-label="Change the category ' + e(c.name) + '" title="Change or delete this category">' + ED.icon('gear') + '</button>' : '') + '</h3>' +
          (rows ? '<table class="st-table st-src ri-table"><thead><tr><th>Subject</th><th>' + e(c.f.title) + '</th><th>Status</th><th class="num">' + e(c.f.due) + '</th><th>Link</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="hint">Nothing here yet.</p>') + '</section>';
      }).join('');
      return '<p class="hint">Your reading list and courses. They appear in a list when you add or edit a session, so you can pick the book and write the chapter.</p>' +
        '<div class="row-btns"><button type="button" class="btn small primary" data-act="study-src" data-kind="book">' + ED.icon('plus') + 'Add a book</button><button type="button" class="btn small" data-act="study-src" data-kind="lecture">' + ED.icon('plus') + 'Add a lecture or course</button><button type="button" class="btn small" data-act="study-cat">' + ED.icon('plus') + 'Add a category</button></div>' +
        '<h3 class="gh">Books <span class="hint num">· ' + (p.books || []).length + '</span></h3>' + (b || '<p class="hint">No books yet.</p>') +
        '<h3 class="gh">Lectures and courses <span class="hint num">· ' + (p.lectures || []).length + '</span></h3>' + (l || '<p class="hint">No lectures yet.</p>') +
        '<p class="hint ri-intro">Papers and patents you are writing or reading, news, Employment News and any category you add. They are offered in the session editor too.</p>' + cats;
    },
    topics(p) {
      return '<p class="hint">Topics for each subject — each week’s topic from the plan, plus any you add. They are offered in a list when you add or edit a session; you can always type a new one there too.</p>' +
        p.tracks.map(tr => {
          const own = (p.topics || []).filter(t => t.trackId === tr.id);
          const ownSet = new Set(own.map(t => t.name.toLowerCase()));
          const list = ST.topicsFor(tr.id);
          const rows = list.map(t => {
            const l = ST.sessions().filter(s => s.trackId === tr.id && s.topic && s.topic.toLowerCase() === t.toLowerCase());
            const x = ST.stats(l);
            const mine = own.find(o => o.name.toLowerCase() === t.toLowerCase());
            return '<li><span class="grow">' + e(t) + (ownSet.has(t.toLowerCase()) ? ' <span class="chip">added</span>' : '') + '</span><span class="hint num">' + (x.n ? x.done + '/' + x.n + ' · ' + h1(x.doneMin) + ' h' : 'no sessions') + '</span>' +
              (mine && !x.n ? '<button type="button" class="icon-btn sm" data-act="study-topic-del" data-id="' + e(mine.id) + '" aria-label="Remove topic">' + ED.icon('x') + '</button>' : '<span class="st-tp-sp"></span>') + '</li>';
          }).join('');
          return '<section class="st-tp"><h3 class="gh">' + trackChip(tr) + ' <span class="st-full">' + e(tr.name) + '</span></h3>' + (rows ? '<ul class="st-tplist">' + rows + '</ul>' : '<p class="hint">No topics yet.</p>') +
            '<button type="button" class="btn small" data-act="study-topic-add" data-track="' + e(tr.id) + '">' + ED.icon('plus') + 'Add a topic</button></section>';
        }).join('');
    },
    notes(p) {
      return (p.intro ? '<p class="st-intro">' + e(p.intro) + '</p>' : '') +
        ((p.notes || []).length ? '<h3 class="gh">Before you start</h3><ol class="st-notes">' + p.notes.map(n => '<li><b>' + e(n.h) + '</b><p>' + e(n.text) + '</p></li>').join('') + '</ol>' : '') +
        ((p.howto || []).length ? '<h3 class="gh">How to use this plan</h3><ul class="st-howto">' + p.howto.map(x => '<li>' + e(x) + '</li>').join('') + '</ul>' : '') +
        '<p class="hint">Imported from ' + e(p.source || 'this diary') + (p.importedAt ? ' on ' + e(U.fmtStamp(p.importedAt)) : '') + '. Tick sessions on the Weekly & Daily page and log the time you really spent; <b>Plan → Export progress</b> gives the Daily Plan sheet back with Done, Studied on and Time spent filled in.</p>';
    },
  };

  /* ======================= MONTHLY ======================= */
  const monthKey = () => { const s = st(); if (!s.month) s.month = U.firstOfMonth(ST.focusDay()); return s.month; };
  /* the day the Week & Day page opens on for month m: today in it, else the plan's first day in it, else the 1st */
  const dayInMonth = m => {
    const end = U.addDays(U.addMonths(m, 1), -1), t = U.today(), sp = ST.span();
    return t >= m && t <= end ? t : sp && sp.a > m && sp.a <= end ? sp.a : m;
  };
  const monthly = {
    left() {
      const p = ST.plan();
      const m = monthKey();
      const [y, mo] = U.ymd(m);
      const end = U.addDays(U.addMonths(m, 1), -1);
      const list = ST.sessions().filter(s => s.date >= m && s.date <= end);
      const x = ST.stats(list);
      const studied = ST.studiedBetween(m, end);
      const studyDays = new Set(list.map(s => s.date));
      let full = 0; studyDays.forEach(k => { const d = ST.dayStats(k); if (d.n && d.done === d.n) full++; });
      let active = 0; for (let k = m; k <= end; k = U.addDays(k, 1)) if (ST.studied(k)) active++;
      const tiles = '<div class="tiles">' + tile('Hours studied', h1(studied), 'of ' + h1(x.min) + ' h planned this month') + tile('Sessions ticked', x.done, 'of ' + x.n + ' planned') + tile('Days you studied', active, full + ' of ' + studyDays.size + ' planned days fully done') + '</div>';
      const chart = dayColumns({ title: 'Hours studied each day', from: m, to: end, short: true, maxLabels: 16, h: 190, sub: 'Blue = studied that day (including catching up); pale = planned.' });
      const ts = ST.trackStats(list, ST.studiedIn(m, end));   // studied this month by subject: adds up to "Hours studied"
      const meters = ts.length ? CH.meters({
        title: 'This month by subject', legend: legendSP(),
        rows: ts.map(t => ({ label: t.tr.name, swatch: ST.color(t.tr), value: t.doneMin, total: t.min, valueLabel: h1(t.doneMin) + ' / ' + h1(t.min) + ' h', tip: t.done + ' of ' + t.n + ' sessions' })),
        table: CH.table(['Subject', 'Planned (h)', 'Studied (h)'], ts.map(t => [t.tr.name, h1(t.min), h1(t.doneMin)])),
      }) : '';
      const weeks = ST.weeks().filter(w => w.start <= end && U.addDays(w.start, 6) >= m);
      const wl = weeks.length ? '<h3 class="gh">Weeks this month</h3><ul class="st-weeks">' + weeks.map(w => {
        const ws = ST.stats(ST.inWeek(w.n));
        const wst = ST.studiedBetween(w.start, U.addDays(w.start, 6));
        return '<li><button type="button" class="plain-btn" data-act="study-day" data-date="' + (U.today() >= w.start && U.today() <= U.addDays(w.start, 6) ? U.today() : w.start) + '" data-go="studyWeek"><b>Week ' + w.n + '</b><span class="hint">' + e(w.label) + (w.phase ? ' · ' + e(w.phase) : '') + '</span>' +
          (w.note ? '<span class="st-note">' + e(w.note) + '</span>' : '') + '</button><span class="st-wkp">' + bar(wst, ws.min) + '<span class="hint num">' + h1(wst) + '/' + h1(ws.min) + ' h</span></span></li>';
      }).join('') + '</ul>' : '<p class="hint">No plan weeks fall in this month.</p>';
      return '<div class="study st-month">' +
        '<div class="pg-head st-head"><div class="st-nav"><button type="button" class="cp-arrow" data-act="study-month" data-dir="-1" aria-label="Previous month">' + ED.icon('chevL') + '</button>' +
        '<h2 class="pg-title">' + e(U.MONTHS[mo - 1] + ' ' + y) + '</h2>' +
        '<button type="button" class="cp-arrow" data-act="study-month" data-dir="1" aria-label="Next month">' + ED.icon('chevR') + '</button></div>' + menuBtn + '</div>' +
        '<p class="hint st-sub">' + e(p.title) + '</p>' +
        '<div class="st-scroll scroll" data-keep-scroll="st-month">' + tiles + chart + meters + wl + '</div></div>';
    },
    right() {
      const m = monthKey();
      const [y, mo] = U.ymd(m);
      const ws = 1;
      const days = U.monthGrid(y, mo - 1, ws);
      const today = U.today();
      const sel = ST.focusDay();
      const wd = U.range(U.startOfWeek(today, ws), 7).map(k => '<span>' + U.DAY3[U.dow(k)] + '</span>').join('');
      const cells = days.map(k => {
        const other = +k.slice(5, 7) !== mo;
        const list = ST.on(k);
        const d = ST.stats(list);
        const sm = ST.studied(k);
        const w = ST.weekOf(k);
        const chips = list.map(s => {
          const tr = ST.track(s.trackId);
          return '<span class="sc' + (s.done ? ' on' : '') + '" style="--c:' + ST.color(tr) + '" data-sid="' + e(s.id) + '">' +
            '<button type="button" class="sc-tick" data-act="study-toggle" aria-label="' + e((s.done ? 'Done: ' : 'Mark done: ') + ST.short(tr)) + '">' + (s.done ? '✓' : '') + '</button>' +
            '<button type="button" class="sc-t" data-act="study-open" title="' + e(ST.short(tr) + (s.kind ? ' (' + s.kind + ')' : '') + ' — ' + s.topic + ' · ' + s.min + ' min') + '">' + e(ST.short(tr)) + (s.kind ? '<span class="hint"> ' + e(s.kind) + '</span>' : '') + '</button></span>';
        }).join('');
        return '<div class="sm-cell' + (other ? ' other' : '') + (k === today ? ' today' : '') + (k === sel ? ' sel' : '') + (d.n && d.done === d.n ? ' full' : '') + '">' +
          '<button type="button" class="sm-num num" data-act="study-day" data-date="' + k + '" data-go="studyWeek" aria-label="Open ' + e(U.fmtLong(k)) + '">' + (+k.slice(8)) + (U.dow(k) === 1 && w ? '<span class="sm-wk">W' + w.n + '</span>' : '') + '</button>' +
          (d.n || sm ? '<span class="sm-h hint num" title="' + e(h1(sm) + ' h studied that day · ' + d.done + ' of ' + d.n + ' planned sessions ticked') + '">' + (d.n ? d.done + '/' + d.n : h1(sm) + ' h') + '</span>' : '') +
          '<div class="sm-items">' + chips + '</div></div>';
      }).join('');
      return '<div class="study st-month-r"><div class="pg-head"><h2 class="pg-title">Month calendar</h2><span class="hint">Tick a session when it is done · click a day to open it</span></div>' +
        '<div class="smc"><div class="sm-wd">' + wd + '</div><div class="sm-grid">' + cells + '</div></div></div>';
    },
    key(ev) {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { A['study-month']({ dataset: { dir: ev.key === 'ArrowLeft' ? -1 : 1 } }); return true; }
      return false;
    },
  };

  /* ======================= WEEKLY & DAILY ======================= */
  const weekly = {
    left() {
      const p = ST.plan();
      const day = ST.focusDay();
      const wa = ST.weekAt(day), w = wa.w;
      const n = ST.weeks().length;
      const start = wa.a;
      const list = ST.inRange(start, wa.b);     // the seven days below, so the totals always add up to them
      const x = ST.stats(list);
      const wst = ST.studiedBetween(start, U.addDays(start, 6));
      const head = '<div class="pg-head st-head"><div class="st-nav"><button type="button" class="cp-arrow" data-act="study-week" data-dir="-1" aria-label="Previous week">' + ED.icon('chevL') + '</button>' +
        '<h2 class="pg-title">' + (w ? 'Week ' + w.n + (n ? ' <span class="st-of">of ' + n + '</span>' : '') : 'Week of ' + e(U.fmtDM(start))) + '</h2>' +
        '<button type="button" class="cp-arrow" data-act="study-week" data-dir="1" aria-label="Next week">' + ED.icon('chevR') + '</button></div>' + menuBtn + '</div>';
      const meta = '<div class="st-wmeta"><span>' + e(w ? w.label : U.fmtRange(start, U.addDays(start, 6))) + '</span>' + (w && w.phase ? '<span class="chip">' + e(w.phase) + '</span>' : '') +
        (w ? '<button type="button" class="link-btn st-wnote" data-act="study-weeknote" data-week="' + w.n + '">' + (w.note ? e(w.note) : 'Add a note for this week') + '</button>' : '') + '</div>' +
        '<div class="st-wprog">' + bar(wst, x.min) + '<span class="num">' + h1(wst) + ' of ' + h1(x.min) + ' h studied · ' + x.done + '/' + x.n + ' sessions ticked</span></div>';
      const chart = dayColumns({ title: 'This week, day by day', from: start, to: U.addDays(start, 6), maxLabels: 7, h: 150 });
      // topics (the Weekly Overview row)
      const topics = w ? '<table class="st-table st-topics"><tbody>' + p.tracks.filter(t => list.some(s => s.trackId === t.id) || w.themes[t.id]).map(t => {
        const l = list.filter(s => s.trackId === t.id); const d = l.filter(s => s.done).length;
        return '<tr><td class="st-td-d">' + (t.day === -1 ? 'Every day' : t.day == null ? '' : U.DAY3[t.day]) + '</td><td>' + trackChip(t) + '</td><td><button type="button" class="plain-btn st-topic" data-act="study-theme" data-week="' + w.n + '" data-track="' + e(t.id) + '" title="Change this week’s topic">' + e(w.themes[t.id] || 'Add a topic') + '</button></td><td class="num hint">' + d + '/' + l.length + '</td></tr>';
      }).join('') + '</tbody></table>' : '';
      // the seven days
      const days = U.range(start, 7).map(k => {
        const l = ST.on(k); const d = ST.stats(l); const sm = ST.studied(k);
        return '<section class="st-day' + (k === day ? ' sel' : '') + (k === U.today() ? ' today' : '') + '">' +
          '<button type="button" class="st-dayh" data-act="study-day" data-date="' + k + '"><b>' + U.DAY3[U.dow(k)] + ' ' + (+k.slice(8)) + ' ' + U.MON[+k.slice(5, 7) - 1] + '</b>' + (k === U.today() ? '<span class="chip chip-today">Today</span>' : '') +
          '<span class="grow"></span>' + (d.n || sm ? '<span class="hint num">' + d.done + '/' + d.n + ' · ' + h1(sm) + ' of ' + h1(d.min) + ' h</span>' : '<span class="hint">Rest</span>') + '</button>' +
          l.map(s => { const tr = ST.track(s.trackId); return '<div class="st-row' + (s.done ? ' done' : '') + '" data-sid="' + e(s.id) + '">' + tick(s) + trackChip(tr, s.kind) + '<button type="button" class="plain-btn st-row-t" data-act="study-open">' + e(s.topic || '—') + '</button><span class="hint num">' + (s.done && ST.spent(s) !== s.min ? ST.spent(s) + '/' : '') + s.min + '′</span></div>'; }).join('') +
          '</section>';
      }).join('');
      return '<div class="study st-week">' + head + meta + '<div class="st-scroll scroll" data-keep-scroll="st-week">' + chart + topics + '<div class="st-days">' + days + '</div></div></div>';
    },
    right() {
      const k = ST.focusDay();
      const w = ST.weekOf(k);
      const l = ST.on(k);
      const d = ST.stats(l);
      const sm = ST.studied(k);
      const h12 = S().h12;
      const card = s => {
        const tr = ST.track(s.trackId);
        const t = ST.timeOf(s);
        const src = ST.source(s.sourceId);
        const other = s.date !== k;
        return '<article class="st-card' + (s.done ? ' done' : '') + '" style="--c:' + ST.color(tr) + '" data-sid="' + e(s.id) + '">' +
          '<div class="st-card-h">' + tick(s) + '<div class="st-card-m"><span class="st-slot">' + e(other ? 'Planned for ' + U.fmtDM(s.date) : (s.slot || ST.slotText(s.slotNo, s.kind))) + '</span>' + trackChip(tr) + '</div>' +
          '<span class="st-min num">' + (t && !other ? e(U.fmtTime(t, h12)) + ' · ' : '') + ST.fmtMin(s.min) + '</span>' +
          '<button type="button" class="icon-btn sm" data-act="study-open" aria-label="Edit session" title="Edit session">' + ED.icon('pencil') + '</button></div>' +
          '<h3 class="st-card-t">' + e(s.topic || 'No topic') + '</h3>' +
          (src ? '<p class="st-card-s">' + ST.srcIcon(src) + ' <b>' + e(src.title) + '</b>' + (s.source ? ' — ' + e(s.source) : '') + '</p>' : s.source ? '<p class="st-card-s">' + e(s.source) + '</p>' : '') +
          '<div class="st-spent"><label for="sp-' + e(s.id) + '">Time spent</label><input id="sp-' + e(s.id) + '" class="field num st-spent-in" type="number" min="0" max="900" step="5" data-sid="' + e(s.id) + '" value="' + (s.done ? ST.spent(s) : '') + '" placeholder="' + s.min + '"><span class="hint">min' + (s.done ? ' · studied ' + (ST.doneOn(s) === k ? 'this day' : 'on ' + e(U.fmtDM(ST.doneOn(s)))) : ' · typing a time marks it done') + '</span></div>' +
          '<label class="sr-only" for="sn-' + e(s.id) + '">Notes</label><textarea id="sn-' + e(s.id) + '" class="st-note-in" rows="2" data-sid="' + e(s.id) + '" placeholder="Notes — what you covered, page reached, questions…">' + e(s.note || '') + '</textarea>' +
          '</article>';
      };
      const cards = l.map(card).join('');
      const extra = ST.studiedList(k).filter(s => s.date !== k);
      return '<div class="study st-dayp">' +
        '<header class="st-dayp-h"><button type="button" class="dl-num num" data-act="study-daypick" aria-label="Choose a date" title="Choose a date">' + (+k.slice(8)) + '</button>' +
        '<div class="dl-words"><div class="dl-dw">' + U.DAYS[U.dow(k)] + '</div><div class="dl-my">' + U.MONTHS[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4) + '</div></div>' +
        '<div class="st-dayp-nav"><button type="button" class="icon-btn sm" data-act="study-dayshift" data-dir="-1" aria-label="Previous day">' + ED.icon('chevL') + '</button><button type="button" class="icon-btn sm" data-act="study-dayshift" data-dir="1" aria-label="Next day">' + ED.icon('chevR') + '</button>' +
        (k !== U.today() ? '<button type="button" class="btn small" data-act="study-day" data-date="' + U.today() + '">Today</button>' : '') + '</div></header>' +
        '<div class="st-dayp-sum">' + (w ? '<span>Week ' + w.n + (w.phase ? ' · ' + e(w.phase) : '') + '</span>' : '') + (d.n || sm ? bar(sm, d.min) + '<span class="num">Studied ' + ST.fmtMin(sm) + ' of ' + ST.fmtMin(d.min) + ' · ' + d.done + '/' + d.n + ' ticked</span>' : '') + '</div>' +
        '<div class="st-scroll scroll" data-keep-scroll="st-dayp-' + k + '">' +
        (cards || '<div class="empty">' + ED.icon('book') + '<div><b>No study planned for this day.</b><br>Rest, catch up on an earlier session, or log what you studied.</div></div>') +
        (extra.length ? '<h3 class="gh st-extra-h">Also studied this day</h3>' + extra.map(card).join('') : '') +
        '<div class="row-btns"><button type="button" class="btn small" data-act="study-add" data-date="' + k + '">' + ED.icon('plus') + 'Add a session</button>' +
        '<button type="button" class="btn small" data-act="study-log" data-date="' + k + '">' + ED.icon('clock') + 'Log study time</button>' +
        (l.some(s => !s.done) ? '<button type="button" class="btn small" data-act="study-alldone" data-date="' + k + '">' + ED.icon('check') + 'Mark the day done</button>' : '') +
        '<button type="button" class="btn small ghost" data-act="goto-day" data-date="' + k + '">' + ED.icon('today') + 'Open in Daily Tasks</button></div>' +
        '</div></div>';
    },
    mount(left, right) {
      // the note goes into the session at once (a re-render, e.g. from a tick, then shows it); saving waits a little
      const saveNotes = U.debounce(() => ED.store.commit({ silent: true }), 400);
      U.$$('.st-note-in', right).forEach(ta => {
        ta.addEventListener('input', () => {
          const s = ST.session(ta.dataset.sid); if (!s) return;
          s.note = ta.value; s.updatedAt = Date.now();
          saveNotes();
        });
      });
      U.$$('.st-spent-in', right).forEach(inp => {
        inp.addEventListener('change', () => { if (inp.value === '') return; ST.setSpent(inp.dataset.sid, inp.value); });
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
      });
      const sel = left.querySelector('.st-day.sel');
      if (sel && !left.querySelector('.st-scroll').dataset.scrolled) sel.scrollIntoView({ block: 'nearest' });
    },
    key(ev) {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { A['study-dayshift']({ dataset: { dir: ev.key === 'ArrowLeft' ? -1 : 1 } }); return true; }
      return false;
    },
  };

  /* ---------- register the three pages ---------- */
  const reg = (id, label, which, v) => {
    ED.views[id] = {
      id, label,
      left: () => ST.plan() ? v.left() : empty(which).left,
      right: () => ST.plan() ? v.right() : empty(which).right,
      mount(L, R) { CH.bind(L); CH.bind(R); if (ST.plan() && v.mount) v.mount(L, R); },
      key: ev => ST.plan() && v.key ? v.key(ev) : false,
    };
  };
  ED.views = ED.views || {};
  reg('studyYear', 'Study · Yearly', 'Yearly', yearly);
  reg('studyMonth', 'Study · Monthly', 'Monthly', monthly);
  reg('studyWeek', 'Study · Weekly & Daily', 'Weekly & Daily', weekly);

  /* ---------- actions ---------- */
  A['study-ytab'] = el => { st().ytab = el.dataset.tab; ED.app.renderPage('right'); CH.bind(document.getElementById('pg-right')); };
  A['study-yrange'] = el => { st().yrange = el.dataset.r; ED.app.renderPage('left'); CH.bind(document.getElementById('pg-left')); };
  // the chosen day moves with the month, so Week & Day opens in the month you were looking at
  A['study-month'] = el => { const s = st(); s.month = U.addMonths(monthKey(), +el.dataset.dir); if (U.firstOfMonth(ST.focusDay()) !== s.month) s.day = dayInMonth(s.month); ED.app.render(); };
  A['study-week'] = el => { const s = st(); s.day = U.addDays(ST.focusDay(), 7 * +el.dataset.dir); s.month = U.firstOfMonth(s.day); ED.app.render(); };
  A['study-dayshift'] = el => { const s = st(); s.day = U.addDays(ST.focusDay(), +el.dataset.dir); s.month = U.firstOfMonth(s.day); ED.app.render(); };
  A['study-alldone'] = el => {
    const k = el.dataset.date;
    ED.store.checkpoint('Mark day done');
    ST.on(k).forEach(s => { if (!s.done) ST.markDone(s, true); });
    ED.store.commit(); ED.ui.undoToast('All sessions on ' + U.fmtDM(k) + ' marked done');
  };
  A['study-daypick'] = el => {
    ED.ui.popover(el, '<form class="pick-date"><label class="lbl" for="st-jump">Go to date</label><input id="st-jump" class="field" type="date" value="' + ST.focusDay() + '"><div class="row-end"><button type="submit" class="btn small primary">Go</button></div></form>', {
      onMount(pe, p) {
        const inp = pe.querySelector('input'); inp.focus();
        pe.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); if (U.isKey(inp.value)) { p.close(); st().day = inp.value; st().month = U.firstOfMonth(inp.value); ED.app.render(); } });
      },
    });
  };
  // keep the month page in step with the chosen day
  const origDay = A['study-day'];
  A['study-day'] = el => { st().month = U.firstOfMonth(el.dataset.date); origDay(el); };

  /* ---------- the day's study on the Daily Tasks page ---------- */
  // the "Due from earlier days" list stays open or closed as you left it, also after ticking one
  document.addEventListener('toggle', ev => { const d = ev.target; if (d && d.classList && d.classList.contains('st-due')) ED.state.studyDueOpen = d.open; }, true);
  /* sessions of the last 30 days that were planned and not ticked (newest first) */
  ST.overdue = k => { const out = []; for (let i = 1; i <= 30; i++) { const d = U.addDays(k, -i); ST.on(d).forEach(s => { if (!s.done) out.push(s); }); } return out; };
  ST.dailyGroup = k => {
    const l = ST.on(k);
    const late = k === U.today() ? ST.overdue(k) : [];
    if (!l.length && !late.length) return '';
    const d = ST.stats(l); const sm = ST.studied(k);
    const row = (s, old) => { const tr = ST.track(s.trackId); const t = ST.timeOf(s); return '<li class="st-row' + (s.done ? ' done' : '') + (old ? ' st-late' : '') + '" data-sid="' + e(s.id) + '">' + tick(s) + trackChip(tr, s.kind) + '<button type="button" class="plain-btn st-row-t" data-act="study-open">' + e(s.topic || '—') + '</button><span class="hint num">' + (old ? e(U.fmtDM(s.date)) + ' · ' : t ? e(U.fmtTime(t, S().h12)) + ' · ' : '') + s.min + '′</span></li>'; };
    return '<section class="tgroup st-dgroup"><h3 class="tgroup-h st-dg-h"><button type="button" class="plain-btn" data-act="study-day" data-date="' + k + '" data-go="studyWeek">' + ED.icon('book') + 'Study plan</button><span class="hint num">' + (l.length ? d.done + '/' + d.n + ' · ' + h1(sm) + ' of ' + h1(d.min) + ' h' : 'nothing planned today') + '</span></h3>' +
      (l.length ? '<ul class="tlist st-dlist">' + l.map(s => row(s, false)).join('') + '</ul>' : '') +
      (late.length ? '<details class="st-due"' + ((ED.state.studyDueOpen != null ? ED.state.studyDueOpen : late.length <= 5) ? ' open' : '') + '><summary><b>Due from earlier days</b> <span class="hint num">· ' + late.length + ' not ticked</span></summary>' +
        '<ul class="tlist st-dlist">' + late.slice(0, 12).map(s => row(s, true)).join('') + '</ul>' +
        '<p class="hint st-due-h">Tick the ones you have now studied (yesterday’s count for yesterday, older ones for today), or open a session to move it to another day.' + (late.length > 12 ? ' <button type="button" class="link-btn" data-act="study-day" data-date="' + e(late[12].date) + '" data-go="studyWeek">' + U.plural(late.length - 12, 'more') + ' in Study</button>' : '') + '</p></details>' : '') +
      '</section>';
  };
})();
