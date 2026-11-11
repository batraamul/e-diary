/* E-Diary — 1.22: the Study pages made clearer — nothing in the plan or its data changes.
   • A "today" card at the top of the Year, Month and Week & Day pages: how the pages connect (Year → Month → Week & Day
     → Daily page), today's sessions with the next one to do (tick it there), and the sessions from earlier days still open.
   • An Insights tab on the Year page: study days and consistency, the length of a session, on-time ticks, the finish
     date at your recent pace (and the hours a day needed to finish on time), your weekdays, the time of day you tick
     sessions, the subjects falling behind, and planned against actual time.
   • Settings → Appearance → "Larger text on the Study pages" (settings.studyLarge) for easier reading. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const ST = ED.study, CH = ED.charts;
  const A = (ED.actions = ED.actions || {});
  const SP = (ED.studyPlus = {});
  const h1 = m => Math.round(m / 6) / 10;
  // 1.25.1: the finish timeline — marks that sit close together share one label block, so labels never overlap
  const line = (pins, x) => {
    const GAP = 24, yr = String(U.today()).slice(0, 4);   // % of the line one label block needs
    const P = pins.map(p => ({ cls: p[0], lab: p[2], d: p[3], at: parseFloat(x(p[1])) })).sort((p, q) => p.at - q.at || (p.cls === 'a' ? -1 : 1));
    const G = []; P.forEach(p => { const g = G[G.length - 1]; if (g && p.at - g[0].at < GAP) g.push(p); else G.push([p]); });
    const dt = d => d ? ' <span>' + e(U.fmtDM(d)) + (String(d).slice(0, 4) !== yr ? ' ' + String(d).slice(0, 4) : '') + '</span>' : '';
    const ticks = P.map(p => '<i class="tick ' + p.cls + '" style="left:' + p.at.toFixed(1) + '%"></i>').join('');
    const labels = G.map(g => { const a = g[0].at; return '<span class="pin' + (a < 12 ? ' lft' : a > 88 ? ' rgt' : '') + '" style="left:' + a.toFixed(1) + '%">' + g.map(p => '<em class="' + p.cls + '"><b>' + e(p.lab) + '</b>' + dt(p.d) + '</em>').join('') + '</span>'; }).join('');
    return '<div class="sp-line" role="img" aria-label="Plan start, today, plan end and the forecast finish" style="--rows:' + Math.max(...G.map(g => g.length)) + '"><i class="bar"></i><i class="done" style="width:' + x(pins[1][1]) + '"></i>' + ticks + labels + '</div>';
  };
  const fm = m => ST.fmtMin ? ST.fmtMin(m) : Math.round(m) + ' min';
  const sum = (l, f) => l.reduce((a, x) => a + (f(x) || 0), 0);

  /* ---------------- the today card ---------------- */
  SP.compass = which => {
    if (!ST.plan()) return '';
    const today = U.today(), list = ST.on(today).sort((a, b) => String(ST.timeOf(a) || '99').localeCompare(String(ST.timeOf(b) || '99')) || (a.slotNo || 0) - (b.slotNo || 0));
    const pm = sum(list, s => s.min), done = list.filter(s => s.done), dm = sum(done, s => s.min);
    const next = list.find(s => !s.done);
    const sp = ST.span() || {};
    const late = ST.sessions().filter(s => !s.done && s.date < today && (!sp.a || s.date >= sp.a)).sort((a, b) => a.date.localeCompare(b.date));
    const steps = [['studyYear', '🗓️', 'Year', 'the whole plan'], ['studyMonth', '📆', 'Month', 'its calendar'], ['studyWeek', '📖', 'Week & Day', 'tick sessions'], ['daily', '📓', 'Daily page', 'today’s list']];
    const flow = '<nav class="sp-flow" aria-label="How the study pages connect">' + steps.map((x, i) => (i ? '<span class="sp-arr" aria-hidden="true">→</span>' : '') +
      '<button type="button" class="sp-step' + (('study' + which[0].toUpperCase() + which.slice(1)) === x[0] ? ' on' : '') + '" data-act="tab" data-tab="' + x[0] + '"' + (('study' + which[0].toUpperCase() + which.slice(1)) === x[0] ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + x[1] + '</span><b>' + x[2] + '</b><small>' + x[3] + '</small></button>').join('') + '</nav>';
    const R = 20, C = 2 * Math.PI * R, f = pm ? Math.min(1, dm / pm) : 0;
    const ring = '<svg viewBox="0 0 50 50" class="sp-ring" aria-hidden="true"><circle cx="25" cy="25" r="' + R + '" class="t"/><circle cx="25" cy="25" r="' + R + '" class="v" style="stroke-dasharray:' + (C * f) + ' ' + C + '" transform="rotate(-90 25 25)"/><text x="25" y="29" text-anchor="middle">' + (pm ? Math.round(f * 100) + '%' : '—') + '</text></svg>';
    const tr = s => ST.track(s.trackId);
    // 1.22.1: every session of today, the next one marked; click a row to open it, tick to mark it done
    const rows = list.map(s => { const t = tr(s), isNext = next && s.id === next.id, what = ST.topicText(s) || ST.sourceText(s);
      return '<li class="sp-s' + (s.done ? ' done' : '') + (isNext ? ' next' : '') + '" style="--c:' + ST.color(t) + '" data-sid="' + e(s.id) + '">' +
        '<button type="button" class="stick' + (s.done ? ' on' : '') + '" data-act="study-toggle" data-sid="' + e(s.id) + '" aria-pressed="' + !!s.done + '" aria-label="' + (s.done ? 'Done — click to undo: ' : 'Mark done: ') + e(ST.short(t)) + '" title="' + (s.done ? 'Done — click to undo' : 'Mark done') + '">' + ED.tasksUI.statusIcon(s.done ? 'done' : 'open') + '</button>' +
        '<button type="button" class="plain-btn sp-sb" data-act="study-open" title="Open: change the topic, time or minutes, add notes"><b>' + e(ST.short(t)) + '</b><span>' + (what ? e(what) : '<i>no topic yet — click to add one</i>') + '</span></button>' +
        '<span class="sp-sm num">' + (isNext ? '<i class="sp-nexttag">next</i>' : '') + (ST.timeOf(s) ? e(ED.fx.time(ST.timeOf(s))) + ' · ' : '') + fm(s.min) + '</span></li>'; }).join('');
    const nextHtml = list.length ? '<ul class="sp-list" aria-label="Today’s sessions">' + rows + '</ul>' + (!next ? '<p class="sp-alldone">🎉 All of today’s sessions are done.</p>' : '')
      : '<div class="sp-next none"><span class="hint">Nothing planned today' + (sp.a && today < sp.a ? ' — the plan starts ' + e(U.fmtShort(sp.a)) : '') + '. Studied anyway? Use <b>Log study time</b>.</span></div>';
    const acts = '<div class="sp-acts" role="group" aria-label="Study actions">' +
      '<button type="button" class="btn small primary" data-act="study-add" data-date="' + today + '">' + ED.icon('plus') + 'Add a session</button>' +
      '<button type="button" class="btn small" data-act="spe-open">' + ED.icon('pencil') + 'Edit the plan</button>' +
      '<button type="button" class="btn small" data-act="sa-open">' + ED.icon('sync') + 'Adjust the plan</button>' +
      '<button type="button" class="btn small" data-act="study-log">' + ED.icon('clock') + 'Log study time</button>' +
      '<button type="button" class="btn small" data-act="sp-sched">' + ED.icon('calendar') + 'Add to the schedule</button>' +
      '<button type="button" class="btn small ghost" data-act="sp-plan">' + ED.icon('gear') + 'Subjects, slots &amp; times</button></div>';
    const fresh = !ST.sessions().some(x => x.done);
    const how = '<details class="sp-how"' + (fresh ? ' open' : '') + '><summary>How the Study planner works</summary><ol>' +
      '<li><b>The plan</b> — subjects, daily time slots and weeks. Import it from Excel, or make it with <b>Plan ▾ → Make a new plan</b>; change it with <b>Subjects, slots &amp; times</b>.</li>' +
      '<li><b>Each day’s sessions</b> appear here, on <b>Week &amp; Day</b> and on your <b>Daily page</b>. <b>Add a session</b> for something extra; <b>Add to the schedule</b> for many at once.</li>' +
      '<li><b>Tick</b> a session when it is done. Click it to type the minutes you really spent, the topic or a note. Studied without a plan? <b>Log study time</b>.</li>' +
      '<li><b>Year</b> and <b>Month</b> show the progress; the <b>Insights</b> tab says whether you will finish on time.</li></ol></details>';
    const lateHtml = late.length ? '<div class="sp-late" role="status"><span aria-hidden="true">⏳</span><span class="grow"><b>' + U.plural(late.length, 'earlier session') + ' still open</b> <span class="hint">(' + fm(sum(late, s => s.min)) + ') — the oldest is from ' + e(U.fmtShort(late[0].date)) + '.</span></span>' +
      '<button type="button" class="btn small primary" data-act="sa-open" data-k="catch">Catch up…</button><button type="button" class="btn small" data-act="study-day" data-date="' + late[0].date + '" data-go="studyWeek">Open that day</button></div>' : '';
    return '<section class="sp-card" aria-label="Today in your study plan">' + flow +
      '<div class="sp-today">' + ring + '<div class="sp-tt"><span class="sp-tl">Today</span><b>' + (list.length ? U.plural(list.length, 'session') + ' · ' + fm(pm) : 'A free day') + '</b><span class="hint">' + (list.length ? done.length + ' done · ' + fm(dm) + ' covered' : 'nothing planned') + '</span></div>' +
      (which !== 'week' || ED.state.study && ED.state.study.day && ED.state.study.day !== today ? '<button type="button" class="btn small ghost sp-open" data-act="study-day" data-date="' + today + '" data-go="studyWeek">' + ED.icon('today') + 'Open today</button>' : '') + '</div>' +
      nextHtml + lateHtml + acts + how + '</section>';
  };

  /* ---------------- the Insights tab ---------------- */
  SP.insights = () => {
    const p = ST.plan(); if (!p) return '';
    const today = U.today(), all = ST.stats(), sp = ST.span() || { a: today, b: today };
    // consistency over the last 28 days (or since the plan began)
    const from = [U.addDays(today, -27), sp.a].sort().pop(), days = from <= today ? U.range(from, U.diffDays(from, today) + 1) : [];
    const planDays = days.filter(k => ST.on(k).length), studyDays = days.filter(k => ST.studied(k) > 0), hit = planDays.filter(k => ST.studied(k) > 0);
    const done = ST.sessions().filter(s => s.done), onTime = done.filter(s => ST.doneOn(s) === s.date).length;
    const withSpent = done.filter(s => s.spent != null && s.spent !== ''), avgPlan = done.length ? sum(done, s => s.min) / done.length : 0, avgReal = done.length ? sum(done, ST.spent) / done.length : 0;
    const tile = (l, v, s, warn) => ED.fx.tile(l, v, s, warn ? 'warn' : '');
    const tiles = '<div class="tiles st-tiles">' +
      tile('Study days', studyDays.length ? String(studyDays.length) : '0', 'of the last ' + days.length + ' days · ' + (studyDays.length ? h1(sum(studyDays, ST.studied) / studyDays.length) + ' h on such a day' : 'none yet')) +
      tile('Consistency', planDays.length ? Math.round(hit.length / planDays.length * 100) + '%' : '—', planDays.length ? hit.length + ' of ' + planDays.length + ' planned days had some study' : 'no planned days yet', planDays.length && hit.length / planDays.length < 0.6) +
      tile('A session', fm(avgReal), 'on average · planned ' + fm(avgPlan) + (withSpent.length ? '' : ' (no times typed yet)')) +
      tile('On its day', done.length ? Math.round(onTime / done.length * 100) + '%' : '—', done.length ? onTime + ' of ' + done.length + ' ticks on the planned day' : 'tick a session to see') + '</div>';
    // finish date at the recent pace
    const pace14 = ST.studiedBetween(U.addDays(today, -13), today) / 14;   // minutes a day
    const left = Math.max(0, all.min - all.covMin), daysLeft = Math.max(0, U.diffDays(today, sp.b));
    let fc;
    if (!left) fc = '<p class="sp-fc-t">🎉 Every session in the plan is covered.</p>';
    else if (!pace14) fc = '<p class="sp-fc-t">No study in the last 14 days, so there is no pace to go by yet. To finish by <b>' + e(U.fmtLong(sp.b)) + '</b>: about <b>' + h1(left / Math.max(1, daysLeft)) + ' h a day</b>.</p>';
    else {
      const need = Math.ceil(left / pace14), fin = U.addDays(today, need), late = U.diffDays(sp.b, fin);
      const span = Math.max(U.diffDays(sp.a, sp.b), U.diffDays(sp.a, fin), 1), x = k => Math.max(0, Math.min(100, U.diffDays(sp.a, k) / span * 100)).toFixed(1) + '%';
      fc = '<p class="sp-fc-t">At your last-14-day pace (<b>' + (pace14 < 60 ? Math.max(1, Math.round(pace14)) + ' min' : h1(pace14) + ' h') + ' a day</b>) the <b>' + h1(left) + ' h</b> left take about <b>' + U.plural(need, 'day') + '</b>: you finish around <b>' + e(U.fmtLong(fin)) + '</b> — ' +
        (late > 0 ? '<span class="fin-bad">' + U.plural(late, 'day') + ' after the plan ends</span>. To finish on time: <b>' + h1(left / Math.max(1, daysLeft)) + ' h a day</b>.' : late < 0 ? '<span class="ok-text">' + U.plural(-late, 'day') + ' early</span>.' : 'right on time.') + '</p>' +
        line([['a', sp.a, 'Start', sp.a], ['t', today, 'Today', null], ['b', sp.b, 'Plan ends', sp.b], ['f' + (late > 0 ? ' bad' : ' good'), fin, 'At this pace', fin]], x);
    }
    const fcHtml = '<figure class="chart sp-fc"><figcaption><span class="gh">When you will finish</span></figcaption>' + fc + '</figure>';
    // weekdays over the last eight weeks
    const w8 = U.range(U.addDays(today, -55), 56), wd = [0, 0, 0, 0, 0, 0, 0], wn = [0, 0, 0, 0, 0, 0, 0];
    w8.forEach(k => { const d = U.dow(k); wd[d] += ST.studied(k); wn[d]++; });
    const ord = [1, 2, 3, 4, 5, 6, 0], av = ord.map(d => wn[d] ? wd[d] / wn[d] : 0), top = Math.max(...av);
    const weekdays = top ? CH.columns({ title: 'Your weekdays · last 8 weeks', h: 140, left: 40, fine: true, maxLabels: 7, color: 'var(--s1)', cur: av.indexOf(top), fmt: v => (Math.round(v * 10) / 10) + ' h',
      data: ord.map((d, i) => ({ label: U.DAY3[d], long: U.DAYS[d], value: h1(av[i]), tip: h1(av[i]) + ' h studied on an average ' + U.DAYS[d] })), sub: 'You study most on <b>' + e(U.DAYS[ord[av.indexOf(top)]]) + 's</b>.',
      table: CH.table(['Day', 'Hours on average'], ord.map((d, i) => [U.DAYS[d], h1(av[i])])) }) : '';
    // time of day the sessions were ticked
    const recent = done.filter(s => s.doneAt && U.diffDays(U.key(new Date(s.doneAt)), today) <= 60);
    const slot = { m: 0, a: 0, e: 0, n: 0 }; recent.forEach(s => { const h = new Date(s.doneAt).getHours(); slot[h >= 5 && h < 12 ? 'm' : h >= 12 && h < 17 ? 'a' : h >= 17 && h < 21 ? 'e' : 'n']++; });
    const sn = recent.length;
    const tod = sn ? CH.meters({ title: 'When you tick sessions done · last 60 days', max: sn, rows: [['🌅 Morning', slot.m, 'var(--s4)', '5 am – 12 noon'], ['☀️ Afternoon', slot.a, 'var(--s2)', '12 – 5 pm'], ['🌇 Evening', slot.e, 'var(--s7)', '5 – 9 pm'], ['🌙 Night', slot.n, 'var(--s1)', '9 pm – 5 am']]
      .map(z => ({ label: z[0], value: z[1], total: sn, color: z[2], valueLabel: z[1] + ' · ' + Math.round(z[1] / sn * 100) + '%', tip: z[3] })) }) : '';
    // subjects behind
    const due = ST.sessions().filter(s => s.date < today);
    const beh = (p.tracks || []).map(t => { const l = due.filter(s => s.trackId === t.id); const pl = sum(l, s => s.min), cv = sum(l.filter(s => s.done), s => s.min); return { t, pl, cv, gap: pl - cv }; }).filter(x => x.pl);
    const behind = beh.filter(x => x.gap > 0).sort((a, b) => b.gap - a.gap);
    const behHtml = behind.length ? CH.meters({ title: 'Subjects falling behind', rows: behind.map(x => ({ label: ST.short(x.t), swatch: ST.color(x.t), value: h1(x.cv), total: h1(x.pl), color: ST.color(x.t), valueLabel: h1(x.gap) + ' h to catch up', tip: h1(x.cv) + ' of ' + h1(x.pl) + ' h due so far' })), legend: CH.legend([{ kind: 'done', color: 'var(--accent)', label: 'Covered' }, { kind: 'total', color: 'var(--chart-track)', label: 'Due so far' }]) })
      : beh.length ? '<p class="sp-ok">✅ No subject is behind — every session due so far is covered.</p>' : '';
    // planned against actual
    const pa = (p.tracks || []).map(t => { const l = withSpent.filter(s => s.trackId === t.id); return { t, n: l.length, pl: sum(l, s => s.min), re: sum(l, s => +s.spent) }; }).filter(x => x.n);
    const paHtml = pa.length ? '<h4 class="ls-gh">Planned against actual time <span class="hint">(sessions where you typed the time spent)</span></h4><table class="st-table sp-pa"><thead><tr><th>Subject</th><th>Sessions</th><th>Planned</th><th>Spent</th><th></th></tr></thead><tbody>' +
      pa.map(x => { const r = x.re / x.pl; return '<tr><td><span class="trk" style="--c:' + ST.color(x.t) + '"><i class="sw"></i>' + e(ST.short(x.t)) + '</span></td><td class="num">' + x.n + '</td><td class="num">' + fm(x.pl) + '</td><td class="num">' + fm(x.re) + '</td><td class="num ' + (r < 0.9 ? 'fin-bad' : r > 1.1 ? 'ok-text' : '') + '">' + Math.round(r * 100) + '%</td></tr>'; }).join('') + '</tbody></table>' : '';
    return '<p class="hint sp-intro">Figures from the same sessions as every other Study page. Each chart has <b>Show the numbers</b> for a table.</p>' + tiles + fcHtml + weekdays + tod + behHtml + paHtml;
  };

  A['sp-sched'] = () => ST.bulkAdd();
  A['sp-plan'] = () => ST.editPlan();

  /* larger text on the Study pages */
  const apply = () => { const s = ED.store.data && ED.store.data.settings; document.documentElement.classList.toggle('study-large', !!(s && s.studyLarge)); };
  ED.store.on(type => { if (type === 'change' || type === 'load') apply(); });
  setTimeout(apply, 0);
  SP.settingsHtml = () => '<div class="set-row"><label class="switch" for="sg-studylarge"><input id="sg-studylarge" type="checkbox"' + (ED.store.data.settings.studyLarge ? ' checked' : '') + '><span class="track"></span><span>Larger text on the Study pages</span></label><p class="hint">Bigger, darker text and larger tick boxes on the Year, Month and Week &amp; Day pages — easier to read and to tap.</p></div>';
  SP.bindSettings = b => { const x = b.querySelector('#sg-studylarge'); if (x) x.addEventListener('change', () => { ED.store.data.settings.studyLarge = x.checked; ED.store.commit(); apply(); }); };
  if (ED.settings && ED.settings.tab_look) {            // Settings → Appearance
    const t0 = ED.settings.tab_look, b0 = ED.settings.bind_look;
    ED.settings.tab_look = () => t0() + '<h3 class="set-h">Reading</h3>' + SP.settingsHtml();
    ED.settings.bind_look = b => { b0(b); SP.bindSettings(b); };
  }
})();
