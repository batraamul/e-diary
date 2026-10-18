/* E-Diary — Habit tracker.
   Habits you want to keep (walk 30 minutes, read 20 pages, no sugar…), every day or on chosen weekdays.
   Each day a habit is fully achieved ✓, partly achieved ◐ or not yet done ○ (the default).
     • Daily Tasks: a "Habits" group under the day's tasks, with the three choices for each habit due that day.
     • Monthly Tasks: a summary line on the left page and small dots on the month calendar; the "Habit tracker"
       side shows the month's grid (click a square to change it), how each habit did, streaks and a day-by-day chart.
   Data: ED.store.data.habits = {
     list: [{ id, name, icon, days: [0–6] | null (every day), start: 'YYYY-MM-DD', stop: 'YYYY-MM-DD' | null, notes, order }],
     log:  { 'YYYY-MM-DD': { habitId: 'full' | 'part' } } }         (no entry = not yet done)
   The score of a day or month counts fully = 1 and partly = ½ over the habits due, up to today. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const CH = ED.charts;
  const D = () => ED.store.data;
  const HB = () => D().habits || (D().habits = { list: [], log: {} });
  const A = (ED.actions = ED.actions || {});
  const H = (ED.habits = {});
  const ICONS = ['🚶', '🏃', '💪', '🧘', '📖', '✍️', '💧', '🥗', '😴', '🦷', '📵', '🙏', '🎸', '🧠', '💊', '🌅'];
  const WORD = { full: 'Fully achieved', part: 'Partly achieved', '': 'Not yet done' };

  /* ---------------- data ---------------- */
  H.list = () => HB().list.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  H.habit = id => HB().list.find(h => h.id === id) || null;
  H.due = (h, k) => (!h.start || k >= h.start) && (!h.stop || k < h.stop) && (!h.days || !h.days.length || h.days.indexOf(U.dow(k)) >= 0);
  H.dueOn = k => H.list().filter(h => H.due(h, k));
  H.get = (id, k) => { const d = HB().log[k]; return d && (d[id] === 'full' || d[id] === 'part') ? d[id] : ''; };
  H.set = (id, k, v) => {
    const log = HB().log;
    if (v === 'full' || v === 'part') { (log[k] = log[k] || {})[id] = v; } else if (log[k]) { delete log[k][id]; if (!Object.keys(log[k]).length) delete log[k]; }
    const h = H.habit(id); if (h && h.sample) delete h.sample;          // marking an example habit makes it yours…
    const sl = HB().sampleLog; if (sl && sl[id]) { const i = sl[id].indexOf(k); if (i >= 0) sl[id].splice(i, 1); }   // …and a day you mark is no longer an example
  };
  H.next = v => v === '' ? 'full' : v === 'full' ? 'part' : '';
  const score = (f, p, n) => n ? (f + p / 2) / n : 0;

  /* the day: how many due habits were kept */
  H.day = k => {
    const hs = H.dueOn(k); let f = 0, p = 0;
    hs.forEach(h => { const v = H.get(h.id, k); if (v === 'full') f++; else if (v === 'part') p++; });
    return { n: hs.length, full: f, part: p, none: hs.length - f - p, score: score(f, p, hs.length) };
  };
  /* days in a row (due days only) kept fully or partly, ending today — or yesterday while today is still open */
  H.streak = (h, upto) => {
    let k = upto || U.today(), n = 0, guard = 0;
    if (!H.get(h.id, k)) k = U.addDays(k, -1);
    while (guard++ < 800) {
      if (h.start && k < h.start) break;
      if (H.due(h, k)) { if (!H.get(h.id, k)) break; n++; }
      k = U.addDays(k, -1);
    }
    return n;
  };
  /* the longest run inside a list of day keys */
  const bestRun = (h, days) => { let best = 0, cur = 0; days.forEach(k => { if (!H.due(h, k)) return; if (H.get(h.id, k)) { cur++; best = Math.max(best, cur); } else cur = 0; }); return best; };

  /* the month: per habit and per day, counting days up to today */
  H.month = m => {
    const [y, mo] = U.ymd(m);
    const first = U.firstOfMonth(m), n = U.daysInMonth(y, mo - 1), today = U.today();
    const days = U.range(first, n);
    const past = days.filter(k => k <= today);
    const habits = H.list().filter(h => days.some(k => H.due(h, k)) || days.some(k => H.get(h.id, k))).map(h => {
      let due = 0, f = 0, p = 0;
      past.forEach(k => { if (!H.due(h, k)) return; due++; const v = H.get(h.id, k); if (v === 'full') f++; else if (v === 'part') p++; });
      return { h, due, full: f, part: p, none: due - f - p, score: score(f, p, due), best: bestRun(h, past), streak: H.streak(h) };
    });
    const tot = habits.reduce((a, x) => ({ due: a.due + x.due, full: a.full + x.full, part: a.part + x.part }), { due: 0, full: 0, part: 0 });
    const perDay = days.map(k => Object.assign({ k, future: k > today }, H.day(k)));
    return { m: first, days, habits, due: tot.due, full: tot.full, part: tot.part, none: tot.due - tot.full - tot.part, score: score(tot.full, tot.part, tot.due), best: habits.reduce((a, x) => Math.max(a, x.best), 0), perDay };
  };

  /* ---------------- pieces of pages ---------------- */
  const pct = v => Math.round(v * 100) + '%';
  const monthName = m => U.MONTHS[U.ymd(m)[1] - 1];
  const glyph = v => v === 'full' ? '✓' : v === 'part' ? '◐' : '○';
  const ico = v => '<i class="hb-gl ' + (v || 'none') + '" aria-hidden="true"></i>';
  const seg3 = (h, k) => {
    const v = H.get(h.id, k);
    return '<span class="seg hb-seg" role="group" aria-label="' + e(h.name) + '">' + [['full', 'Done'], ['part', 'Partly'], ['', 'Not yet']].map(x =>
      '<button type="button" class="hb-b hb-' + (x[0] || 'none') + '" data-act="hb-set" data-id="' + e(h.id) + '" data-k="' + k + '" data-v="' + x[0] + '" aria-pressed="' + (v === x[0]) + '" aria-label="' + WORD[x[0]] + '" title="' + WORD[x[0]] + '">' + ico(x[0]) + '<span class="hb-bl" aria-hidden="true">' + x[1] + '</span></button>').join('') + '</span>';
  };

  /* Daily Tasks: the habits due that day (none for days still to come) */
  H.dailyGroup = k => {
    if (!HB().list.length || k > U.today()) return '';
    const hs = H.dueOn(k); if (!hs.length) return '';
    const d = H.day(k);
    return '<section class="tgroup hb-dgroup"><h3 class="tgroup-h hb-dg-h"><button type="button" class="plain-btn" data-act="hb-tracker" data-m="' + U.firstOfMonth(k) + '">' + ED.icon('repeat') + 'Habits</button><span class="hint num">' + (d.full + d.part) + '/' + d.n + (d.part ? ' · ' + d.part + ' partly' : '') + '</span>' +
      '<button type="button" class="icon-btn sm" data-act="hb-new" aria-label="Add a habit" title="Add a habit">' + ED.icon('plus') + '</button></h3>' +
      '<ul class="tlist hb-dlist">' + hs.map(h => {
        const v = H.get(h.id, k), s = H.streak(h, k);
        return '<li class="hb-row' + (v ? ' ' + v : '') + '"><span class="hb-ic" aria-hidden="true">' + e(h.icon || '•') + '</span><button type="button" class="plain-btn hb-name" data-act="hb-edit" data-id="' + e(h.id) + '" title="Change this habit">' + e(h.name) + '</button>' +
          (s > 1 ? '<span class="hint hb-streak num" title="' + s + ' days in a row">🔥' + s + '</span>' : '') + seg3(h, k) + '</li>';
      }).join('') + '</ul><p class="hint hb-legend">' + ico('full') + 'fully achieved ' + ico('part') + 'partly ' + ico('') + 'not yet done</p></section>';
  };

  /* Monthly Tasks (master list side): a one-line summary that opens the tracker */
  H.strip = m => {
    if (!HB().list.length) return '<button type="button" class="hb-strip empty" data-act="hb-new">' + ED.icon('repeat') + '<span>Track a habit — walking, reading, water… mark it ✓ fully, ◐ partly or ○ not yet each day</span></button>';
    const x = H.month(m);
    return '<button type="button" class="hb-strip" data-act="hb-tracker" data-m="' + x.m + '" title="Open the habit tracker">' + ED.icon('repeat') +
      '<b class="hb-st">Habits in ' + monthName(x.m) + '</b><span class="bar"><i style="width:' + Math.round(x.score * 100) + '%"></i></span><b class="num">' + (x.due ? pct(x.score) : '—') + '</b>' +
      '<span class="hint num hb-cnt">' + ico('full') + x.full + ' ' + ico('part') + x.part + ' ' + ico('') + x.none + (x.best > 1 ? ' · 🔥 ' + x.best + ' days' : '') + '</span><span class="hb-open">Tracker ›</span></button>';
  };

  /* month calendar cells: one dot per habit due that day (up to today) */
  H.cellBadge = k => {
    if (!HB().list.length || k > U.today()) return '';
    const hs = H.dueOn(k); if (!hs.length) return '';
    const d = H.day(k);
    const tip = 'Habits: ' + d.full + ' fully, ' + d.part + ' partly, ' + d.none + ' not yet';
    const dots = hs.length <= 6 ? hs.map(h => '<i class="' + (H.get(h.id, k) || 'none') + '"></i>').join('') : '<span class="num">' + (d.full + d.part) + '/' + d.n + '</span>';
    return '<span class="m-hb" title="' + tip + '" aria-label="' + tip + '">' + dots + '</span>';
  };

  /* Monthly Tasks (habit tracker side) */
  H.tracker = m => {
    const x = H.month(m);
    const today = U.today();
    const nav = '<div class="hb-nav"><button type="button" class="icon-btn sm" data-act="hb-month" data-dir="-1" aria-label="Previous month">' + ED.icon('chevL') + '</button><b>' + monthName(x.m) + ' ' + x.m.slice(0, 4) + '</b>' +
      '<button type="button" class="icon-btn sm" data-act="hb-month" data-dir="1" aria-label="Next month">' + ED.icon('chevR') + '</button>' +
      '<span class="grow"></span><button type="button" class="btn small primary" data-act="hb-new">' + ED.icon('plus') + 'Add a habit</button></div>';
    if (!HB().list.length) return nav + '<div class="empty">' + ED.icon('repeat') + '<div><b>No habits yet.</b><br>Add the habits you want to build. Each day mark them ✓ fully achieved, ◐ partly achieved or leave them ○ not yet done — on the Daily Tasks page or in this grid.</div></div>';
    const tiles = '<div class="tiles hb-tiles">' +
      '<div class="tile"><span class="tile-l">Kept this month</span><span class="tile-v">' + (x.due ? pct(x.score) : '—') + '</span><span class="tile-s hint">partly counts half</span></div>' +
      '<div class="tile"><span class="tile-l">' + ico('full') + 'Fully achieved</span><span class="tile-v">' + x.full + '</span><span class="tile-s hint">' + (x.due ? pct(x.full / x.due) + ' of ' + x.due : 'nothing due yet') + '</span></div>' +
      '<div class="tile"><span class="tile-l">' + ico('part') + 'Partly</span><span class="tile-v">' + x.part + '</span><span class="tile-s hint">' + (x.due ? pct(x.part / x.due) : '') + '</span></div>' +
      '<div class="tile"><span class="tile-l">' + ico('') + 'Not yet done</span><span class="tile-v">' + x.none + '</span><span class="tile-s hint">' + (x.best > 1 ? 'best run 🔥 ' + x.best + ' days' : 'days due so far') + '</span></div></div>';
    const n = x.days.length;
    const head = '<div class="hb-gh"></div>' + x.days.map(k => '<div class="hb-dh' + (k === today ? ' today' : '') + (U.dow(k) === 0 ? ' sun' : '') + '" title="' + e(U.fmtLong(k)) + '"><span>' + U.DAYS[U.dow(k)][0] + '</span><b class="num">' + (+k.slice(8)) + '</b></div>').join('') + '<div class="hb-gh num">%</div>';
    const rows = x.habits.map(r => {
      const h = r.h;
      return '<button type="button" class="plain-btn hb-gname" data-act="hb-edit" data-id="' + e(h.id) + '" title="' + e(h.name) + (h.days && h.days.length && h.days.length < 7 ? ' · ' + h.days.map(d => U.DAY3[d]).join(', ') : ' · every day') + '"><span aria-hidden="true">' + e(h.icon || '•') + '</span><span class="hb-gn">' + e(h.name) + '</span></button>' +
        x.days.map(k => {
          const due = H.due(h, k), v = H.get(h.id, k), fut = k > today;
          if (!due && !v) return '<span class="hb-c off" aria-hidden="true"></span>';
          return '<button type="button" class="hb-c ' + (v || 'none') + (fut ? ' fut' : '') + (k === today ? ' today' : '') + '" data-act="hb-cycle" data-id="' + e(h.id) + '" data-k="' + k + '"' + (fut ? ' disabled' : '') + ' aria-label="' + e(h.name + ', ' + U.fmtLong(k) + ': ' + WORD[v]) + '" title="' + e(U.fmtDM(k) + ': ' + WORD[v]) + '"><span aria-hidden="true">' + (v ? glyph(v) : '') + '</span></button>';
        }).join('') +
        '<span class="hb-gp num' + (r.due && r.score >= 0.8 ? ' good' : '') + '" title="' + r.full + ' fully, ' + r.part + ' partly, ' + r.none + ' not yet">' + (r.due ? pct(r.score) : '—') + '</span>';
    }).join('');
    const grid = '<div class="hb-grid" style="--n:' + n + '">' + head + rows + '</div>' +
      '<p class="hint hb-key"><span class="hb-c full">✓</span> fully achieved <span class="hb-c part">◐</span> partly <span class="hb-c none"></span> not yet done — click a square to change it (fully → partly → not yet).</p>';
    const chart = CH.columns({
      title: 'Each day', h: 150, left: 38, fine: false, maxLabels: 10, fmt: v => Math.round(v) + '%', color: 'var(--s1)',
      data: x.perDay.map(d => ({ label: String(+d.k.slice(8)), long: U.fmtLong(d.k), value: d.future || !d.n ? 0 : Math.round(d.score * 100), future: d.future, tip: d.future ? 'still to come' : d.n ? d.full + ' fully, ' + d.part + ' partly, ' + d.none + ' not yet (' + pct(d.score) + ')' : 'no habits due' })),
      cur: x.days.indexOf(today),
      sub: 'Share of the day’s habits kept (partly counts half).',
      table: CH.table(['Day', 'Fully', 'Partly', 'Not yet', 'Kept'], x.perDay.filter(d => !d.future && d.n).map(d => [U.fmtDM(d.k), String(d.full), String(d.part), String(d.none), pct(d.score)])),
    });
    const meters = x.habits.length ? CH.meters({
      title: 'Each habit this month', max: 100,
      sub: 'Dark bar = fully achieved; pale bar = fully or partly. 🔥 = days in a row now.',
      rows: x.habits.map(r => ({ label: (r.h.icon ? r.h.icon + ' ' : '') + r.h.name, value: r.due ? r.full / r.due * 100 : 0, total: r.due ? (r.full + r.part) / r.due * 100 : 0, valueLabel: (r.due ? pct(r.score) : '—') + (r.streak > 1 ? ' · 🔥' + r.streak : ''), tip: r.full + ' fully, ' + r.part + ' partly, ' + r.none + ' not yet, of ' + r.due + ' days due · best run ' + r.best })),
      table: CH.table(['Habit', 'Due', 'Fully', 'Partly', 'Not yet', 'Kept', 'Best run', 'Now'], x.habits.map(r => [r.h.name, String(r.due), String(r.full), String(r.part), String(r.none), r.due ? pct(r.score) : '—', String(r.best), String(r.streak)])),
    }) : '';
    return nav + tiles + '<div class="hb-gridw">' + grid + '</div>' + meters + chart;
  };

  /* ---------------- editor ---------------- */
  H.edit = id => {
    const x = id ? H.habit(id) : null;
    const d = x ? U.clone(x) : { id: U.uid('hb'), name: '', icon: '🚶', days: null, start: U.today(), stop: null, notes: '', order: HB().list.length };
    const every = !d.days || !d.days.length || d.days.length === 7;
    const ws = D().settings.weekStart || 0;
    const order = U.range(U.startOfWeek(U.today(), ws), 7).map(k => U.dow(k));
    const body = '<form class="st-form hb-form"><div class="st-grid">' +
      '<label class="lbl" for="hb-name">Habit</label><input id="hb-name" class="field" value="' + e(d.name) + '" placeholder="e.g. Walk 30 minutes, Read 20 pages, 8 glasses of water" maxlength="80">' +
      '<label class="lbl" for="hb-icon">Symbol</label><div class="hb-icons"><input id="hb-icon" class="field hb-iconin" value="' + e(d.icon || '') + '" maxlength="4" aria-label="Symbol">' + ICONS.map(c => '<button type="button" class="hb-pick" data-ic="' + c + '" aria-label="Use ' + c + '">' + c + '</button>').join('') + '</div>' +
      '<span class="lbl">Days</span><div class="hb-days" role="group" aria-label="Days">' + order.map(i => '<label class="chip-check"><input type="checkbox" value="' + i + '"' + (every || d.days.indexOf(i) >= 0 ? ' checked' : '') + '><span>' + U.DAY3[i] + '</span></label>').join('') + '</div>' +
      '<label class="lbl" for="hb-start">Track from</label><input id="hb-start" class="field" type="date" value="' + e(d.start || U.today()) + '">' +
      '<label class="lbl" for="hb-notes">Notes</label><textarea id="hb-notes" class="field" rows="2" placeholder="What counts as partly? Why it matters…">' + e(d.notes || '') + '</textarea>' +
      '</div>' + (x && x.stop ? '<p class="hint">Stopped from ' + e(U.fmtLong(x.stop)) + '. Save to keep it stopped, or click “Track again”.</p>' : '') + '</form>';
    ED.ui.modal({
      title: x ? 'Habit' : 'New habit', cls: 'st-modal', body,
      footer: (x ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' + (x.stop ? '<button type="button" class="btn" data-x="resume">Track again</button>' : '<button type="button" class="btn" data-x="stop" title="Keep its history but stop asking from tomorrow">Stop tracking</button>') : '') +
        '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">' + (x ? 'Save' : 'Add habit') + '</button>',
      onMount(el, api) {
        const $ = s => el.querySelector(s);
        el.querySelector('.hb-icons').addEventListener('click', ev => { const b = ev.target.closest('[data-ic]'); if (b) $('#hb-icon').value = b.dataset.ic; });
        setTimeout(() => { if (!x) $('#hb-name').focus(); }, 30);
        const save = extra => {
          const name = $('#hb-name').value.trim();
          if (!name) { ED.ui.toast('Name the habit'); $('#hb-name').focus(); return; }
          const days = U.$$('.hb-days input', el).filter(c => c.checked).map(c => +c.value).sort();
          if (!days.length) { ED.ui.toast('Pick at least one day'); return; }
          const v = Object.assign({ name, icon: $('#hb-icon').value.trim(), days: days.length === 7 ? null : days, start: U.isKey($('#hb-start').value) ? $('#hb-start').value : U.today(), notes: $('#hb-notes').value.trim() }, extra || {});
          ED.store.checkpoint(x ? 'Habit' : 'New habit');
          if (x) { Object.assign(x, v); delete x.sample; } else HB().list.push(Object.assign(d, v));
          ED.store.commit(); api.close(); ED.ui.toast(x ? 'Habit saved' : 'Habit added — mark it on the Daily Tasks page');
        };
        $('[data-x="save"]').addEventListener('click', () => save());
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
        const stop = $('[data-x="stop"]'); if (stop) stop.addEventListener('click', () => save({ stop: U.addDays(U.today(), 1) }));
        const resume = $('[data-x="resume"]'); if (resume) resume.addEventListener('click', () => save({ stop: null }));
        const del = $('[data-x="del"]');
        if (del) del.addEventListener('click', async () => {
          const ok = await ED.ui.confirm({ title: 'Delete habit', message: 'Delete “' + x.name + '” and everything marked for it? To keep its history, use Stop tracking instead.', ok: 'Delete', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Delete habit');
          HB().list = HB().list.filter(h => h.id !== x.id);
          Object.keys(HB().log).forEach(k => { delete HB().log[k][x.id]; if (!Object.keys(HB().log[k]).length) delete HB().log[k]; });
          ED.store.commit(); api.close(); ED.ui.undoToast('Habit deleted');
        });
      },
    });
  };

  /* ---------------- actions ---------------- */
  const monthOf = () => { const cp = ED.calpanel.st('monthly'); return U.firstOfMonth(cp.anchor || U.today()); };
  H.monthShown = monthOf;
  A['hb-set'] = el => {
    const id = el.dataset.id, k = el.dataset.k, v = el.dataset.v || '';
    H.set(id, k, H.get(id, k) === v ? '' : v);
    ED.store.commit();
  };
  A['hb-cycle'] = el => { const id = el.dataset.id, k = el.dataset.k; if (k > U.today()) return; H.set(id, k, H.next(H.get(id, k))); ED.store.commit(); };
  A['hb-new'] = () => H.edit(null);
  A['hb-edit'] = el => H.edit(el.dataset.id);
  A['hb-tracker'] = el => {
    ED.state.monthlyLeft = 'habits';
    const m = el && el.dataset && el.dataset.m;
    if (m) { const cp = ED.calpanel.st('monthly'); cp.anchor = m.slice(0, 7) === U.today().slice(0, 7) ? U.today() : m; ED.state.mc.m1 = U.firstOfMonth(m); }
    if (ED.state.tab !== 'monthly') ED.go.tab('monthly'); else ED.app.render();
  };
  A['hb-month'] = el => {
    const cp = ED.calpanel.st('monthly');
    const m = U.addMonths(monthOf(), +el.dataset.dir);
    cp.anchor = m.slice(0, 7) === U.today().slice(0, 7) ? U.today() : m;
    ED.state.mc.m1 = m;
    ED.app.render();
  };
  A['monthly-left'] = el => { ED.state.monthlyLeft = el.dataset.k === 'habits' ? 'habits' : 'master'; ED.app.render(); };
})();
