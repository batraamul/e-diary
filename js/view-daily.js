/* E-Diary — Daily Tasks (left: date, prioritised tasks by role, mini calendar, day timeline; right: quote, weather, diary page) */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings;
  const D = () => ED.store.data;
  const HOUR = ED.calpanel.HOUR;
  let notesCtl = null;

  const V = {
    id: 'daily', label: 'Daily Tasks',

    left() {
      const k = ED.state.date;
      const d = U.parse(k);
      const today = U.today();
      const occs = M.tasksOn(k);
      const total = occs.filter(o => M.counts(o.st)).length;
      const done = occs.filter(o => M.isClosed(o.st)).length;
      const diff = U.diffDays(today, k);
      const rel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : diff > 0 ? 'In ' + diff + ' days' : Math.abs(diff) + ' days ago';
      const groups = ED.tasksUI.groups(occs, { date: k });
      const studyG = ED.study && ED.study.plan() ? ED.study.dailyGroup(k) : '';
      const habitG = ED.habits ? ED.habits.dailyGroup(k) : '';
      const hiddenDone = !S().showCompleted && occs.some(o => !M.isPending(o.st) && o.st !== 'delegated');

      const main =
        '<div class="dl-main">' +
        '<header class="dl-date">' +
        '<button type="button" class="dl-num num" data-act="date-pick" title="Choose a date" aria-label="Choose a date">' + d.getDate() + '</button>' +
        '<div class="dl-words"><div class="dl-dw">' + U.DAYS[d.getDay()] + '</div><div class="dl-my">' + U.MONTHS[d.getMonth()] + ' ' + d.getFullYear() + '</div></div>' +
        '<div class="dl-rel"><span class="day-nav"><button type="button" class="icon-btn sm" data-act="day-prev" aria-label="Previous day" title="Previous day (←)">' + ED.icon('chevL') + '</button>' +
        '<button type="button" class="icon-btn sm" data-act="day-next" aria-label="Next day" title="Next day (→)">' + ED.icon('chevR') + '</button></span>' +
        '<span class="chip' + (diff === 0 ? ' chip-today' : '') + '">' + rel + '</span>' +
        '<span class="hint num">Week ' + U.weekNumber(k, S().weekStart) + '</span>' +
        (diff !== 0 ? '<button type="button" class="btn small" data-act="goto-today">' + ED.icon('today') + 'Today</button>' : '') + '</div>' +
        '</header>' +
        '<form class="addtask" data-form="quick-add">' +
        '<input class="addtask-in" id="quick-add" type="text" placeholder="Add Task" autocomplete="off" aria-label="Add a task. Start with A1, B2 or C3 to set its priority; end with @9:30 to set a time.">' +
        '<button type="button" class="add-btn" data-act="task-new" aria-label="New task with details" title="New task with details">' + ED.icon('plus') + '</button>' +
        '</form>' +
        '<div class="dl-tasks scroll" data-keep-scroll="daily-tasks">' +
        (groups || studyG || habitG ? groups + studyG + habitG : '<div class="empty">' + ED.icon('checkSq') + '<div><b>Nothing planned for ' + (diff === 0 ? 'today' : 'this day') + '.</b><br>Type a task above. Start with A1 for the day’s most important task — your frog.</div></div>') +
        (hiddenDone ? '<p class="hint dl-hidden">Completed tasks are hidden. <button type="button" class="link-btn" data-act="toggle-completed">Show them</button></p>' : '') +
        '</div>' +
        '<div class="dl-foot">' +
        '<div class="dl-progress" title="' + done + ' of ' + total + ' done"><div class="bar' + (total && done === total ? ' done' : '') + '"><i style="width:' + (total ? Math.round(done / total * 100) : 0) + '%"></i></div><span class="hint num">' + done + '/' + total + ' done</span></div>' +
        '<button type="button" class="icon-btn" data-act="daily-menu" aria-label="Day actions" title="Day actions">' + ED.icon('menu') + '</button>' +
        '</div>' +
        '</div>';

      const side =
        '<div class="dl-side">' +
        ED.minical.render('daily', ED.state.mc.daily || k, k) +
        V.allDay(k) +
        '<div class="dl-timeline scroll" data-keep-scroll="daily-tl-' + k + '" data-autoscroll="' + (S().dayStart * HOUR) + '">' + V.timeline(k) + '</div>' +
        '</div>';

      return '<div class="daily">' + main + side + '</div>' +
        '<button type="button" class="corner corner-prev" data-act="day-prev" aria-label="Previous day" title="Previous day"></button>';
    },

    allDay(k) {
      const chips = ED.calpanel.allDayChips(k);
      return '<div class="dl-allday" data-drop="allday" data-date="' + k + '"><div class="dl-ad-h">All day events</div>' +
        (chips ? '<div class="dl-ad-list">' + chips + '</div>' : '<div class="dl-ad-empty hint">Drag a task here to make it all-day</div>') +
        '</div>';
    },

    timeline(k) {
      const items = ED.calpanel.timedItems(k);
      const hours = Array.from({ length: 24 }, (_, h) => '<div class="tl-hr' + (h >= S().activeFrom && h < S().activeTo ? ' active' : '') + '"><span class="num">' + U.pad(h) + '</span></div>').join('');
      const now = k === U.today() ? '<div class="now-line" style="top:' + (U.nowMin() / 60 * HOUR) + 'px"><i></i></div>' : '';
      return '<div class="tl" style="height:' + (24 * HOUR) + 'px"><div class="tl-hours">' + hours + '</div>' +
        '<div class="tl-col" data-date="' + k + '" data-drop="time" data-act="slot">' + ED.calpanel.layout(items) + now + '</div></div>';
    },

    quoteHtml(k) {
      const q = ED.quotes.forDate(k, ED.state.quoteShift || 0);
      return '<span class="qmark" aria-hidden="true">“</span>' + e(q.text) + ' <b>' + e(q.author) + '</b>' +
        '<button type="button" class="qnext" data-act="quote-next" aria-label="Another quote" title="Another quote">' + ED.icon('sync') + '</button>';
    },

    right() {
      const k = ED.state.date;
      return '<div class="dr">' +
        '<div class="banner">' +
        '<p class="quote">' + V.quoteHtml(k) + '</p>' +
        (ED.env.claude ? '' : '<div class="wx" id="wx">' + V.weatherHtml(k) + '</div>') +
        '</div>' +
        '<div class="dnotes">' +
        '<div class="dn-head"><span class="dn-title">Daily Notes</span><span class="dn-status hint" id="dn-status"></span></div>' +
        '<div class="dn-editor" id="daily-notes"></div>' +
        '</div>' +
        V.footHtml(k) +
        '</div>' +
        '<button type="button" class="corner corner-next" data-act="day-next" aria-label="Next day" title="Next day"></button>';
    },

    /* "Day 272 · 93 days left", printed at the foot of the page like a paper diary */
    footHtml(k) {
      const y = +k.slice(0, 4);
      const n = U.diffDays(y + '-01-01', k) + 1, total = U.diffDays(y + '-01-01', (y + 1) + '-01-01');
      return '<div class="dfoot num">Day ' + n + ' · ' + (total - n) + ' days left in ' + y + ' · Week ' + U.weekNumber(k, S().weekStart) + '</div>';
    },

    weatherHtml(k) {
      const c = S().weather;
      if (ED.env.claude) return '';
      if (!c.on) return '<div class="wx-off"><button type="button" class="link-btn wx-link" data-act="open-settings" data-tab="weather">Turn on weather</button></div>';
      const w = ED.weather.forDate(k);
      const place = '<button type="button" class="wx-place" data-act="open-settings" data-tab="weather" title="Change location">' + e(c.name || 'Set location') + '</button>';
      if (!w) {
        const msg = ED.weather.loading ? 'Loading weather…' : ED.weather.error ? 'Weather is unavailable right now' : 'No forecast for this date';
        const retry = !ED.weather.loading && ED.weather.error ? ' <button type="button" class="link-btn wx-link wx-retry" data-act="wx-retry">Try again</button>' : '';
        return '<div class="wx-ic">' + ED.icon('wCloud') + '</div><div class="wx-main">' + place + '<div class="wx-cond">' + msg + retry + '</div></div>';
      }
      const t = x => x == null ? '—' : x + ' ' + w.unit;
      return '<div class="wx-ic">' + ED.icon(w.icon) + '</div>' +
        '<div class="wx-main">' + place + '<div class="wx-cond">' + e(w.text) + (w.today ? '' : ' <span class="wx-note">forecast</span>') + '</div></div>' +
        '<div class="wx-temps num">' + (w.today ? '<div>Current ' + t(w.temp) + '</div>' : '') + '<div>High ' + t(w.max) + '</div><div>Low ' + t(w.min) + '</div></div>' +
        '<div class="wx-th">' + ED.icon('thermo') + '</div>' +
        '<a class="wx-credit" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather: Open-Meteo</a>';
    },

    mount(left, right) {
      const k = ED.state.date;
      const host = right.querySelector('#daily-notes');
      const status = right.querySelector('#dn-status');
      const html = D().dayNotes[k] || '';
      notesCtl = ED.rich.mount(host, {
        html, toolbar: 'mini', lined: true, cls: 'diary', label: 'Daily notes for ' + U.fmtLong(k),
        placeholder: 'Write about your day…',
        onChange(h) {
          const txt = U.stripHtml(h).trim();
          if (!txt && !/<img/i.test(h)) delete D().dayNotes[k]; else D().dayNotes[k] = h;
          const i = (D().meta.sampleDayNotes || []).indexOf(k);
          if (i >= 0) D().meta.sampleDayNotes.splice(i, 1);
          ED.store.commit({ silent: true });
          if (status) status.textContent = 'Saved ' + U.fmtTime(U.pad(new Date().getHours()) + ':' + U.pad(new Date().getMinutes()), S().h12);
        },
      });
      const words = U.stripHtml(html).trim();
      if (status) status.textContent = words ? words.split(/\s+/).length + ' words' : '';
      ED.calpanel.afterRender(left);
      const tl = left.querySelector('.dl-timeline');
      if (tl && !(ED.state.scroll && ED.state.scroll[tl.dataset.keepScroll] != null)) {
        const nowH = U.nowMin() / 60;
        tl.scrollTop = (k === U.today() && nowH > S().dayStart + 3 ? Math.max(0, nowH - 2) : S().dayStart) * HOUR;
      }
      // weather refresh (updates only the banner)
      if (S().weather.on && !ED.env.claude && !ED.weather.fresh()) {
        ED.weather.refresh().then(() => { const wx = document.getElementById('wx'); if (wx && ED.state.tab === 'daily') wx.innerHTML = V.weatherHtml(ED.state.date); });
        const wx = right.querySelector('#wx'); if (wx) wx.innerHTML = V.weatherHtml(k);
      }
    },

    unmount() { if (notesCtl) { notesCtl.flush(); notesCtl = null; } },

    menu(anchor) {
      const k = ED.state.date;
      const items = [
        { label: 'Show completed tasks', checked: S().showCompleted, icon: 'eye', onClick: () => ED.actions['toggle-completed']() },
        { label: 'Renumber priorities (A1, A2…)', icon: 'renumber', onClick: () => { M.renumberDay(k); ED.store.commit(); ED.ui.toast('Priorities renumbered'); } },
        { label: 'Forward unfinished to tomorrow', icon: 'forward', onClick: () => { ED.store.checkpoint('Forward'); const n = M.forwardUnfinished(k, U.addDays(k, 1)); ED.store.commit(); ED.ui.undoToast(n ? U.plural(n, 'task') + ' moved to ' + U.fmtDM(U.addDays(k, 1)) : 'Nothing to forward'); } },
        { sep: true },
        { label: 'New event…', icon: 'calendar', onClick: () => ED.editors.event({ create: { date: k } }) },
        { label: 'Add a habit to track…', icon: 'repeat', onClick: () => ED.habits.edit(null) },
        { label: 'Habit tracker', icon: 'chart', onClick: () => ED.actions['hb-tracker']({ dataset: { m: U.firstOfMonth(k) } }) },
        { label: 'Copy day as text', icon: 'copy', onClick: async () => { const ok = await U.copy(V.dayText(k)); ED.ui.toast(ok ? 'Copied' : 'Could not copy'); } },
      ];
      if (!ED.env.claude) items.push({ label: 'Print this day', icon: 'printer', onClick: () => window.print() });
      ED.ui.menu(anchor, items, { placement: 'right-align' });
    },

    dayText(k) {
      const lines = [U.fmtLong(k), ''];
      M.groupByRole(M.tasksOn(k)).forEach(g => {
        lines.push((g.role ? g.role.name : 'Other tasks').toUpperCase());
        g.items.forEach(o => lines.push((M.isClosed(o.st) ? '☑ ' : '☐ ') + M.code(o.t) + ' ' + o.t.title + (o.t.time ? ' (' + U.fmtTime(o.t.time, S().h12) + ')' : '')));
        lines.push('');
      });
      const evs = M.eventsOn(k);
      if (evs.length) { lines.push('EVENTS'); evs.forEach(ev => lines.push((ev.allDay ? 'All day' : U.fmtTime(ev.start, S().h12)) + ' — ' + ev.title)); lines.push(''); }
      const n = U.stripHtml(D().dayNotes[k] || '');
      if (n) { lines.push('NOTES'); lines.push(n); }
      return lines.join('\n').trim();
    },

    key(ev) {
      if (ev.key === 'ArrowLeft') { ED.go.date(U.addDays(ED.state.date, -1), 'back'); return true; }
      if (ev.key === 'ArrowRight') { ED.go.date(U.addDays(ED.state.date, 1), 'fwd'); return true; }
      return false;
    },
  };

  ED.views = ED.views || {};
  ED.views.daily = V;

  const A = (ED.actions = ED.actions || {});
  A['wx-retry'] = () => {
    const wx = document.getElementById('wx');
    const p = ED.weather.refresh(true);
    if (wx) wx.innerHTML = V.weatherHtml(ED.state.date);
    p.then(() => { const w = document.getElementById('wx'); if (w && ED.state.tab === 'daily') w.innerHTML = V.weatherHtml(ED.state.date); });
  };
})();
