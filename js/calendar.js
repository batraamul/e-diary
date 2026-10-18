/* E-Diary — mini month calendar and the right-page calendar panel (1/3/5/7 days, month) */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings;
  const HOUR = 44; // px per hour in time grids

  /* ======================= mini calendar ======================= */
  ED.minical = {
    /* id: which instance; month: any key inside the month shown */
    render(id, month, selected, opts) {
      opts = opts || {};
      const ws = S().weekStart;
      const [y, m] = U.ymd(month);
      const days = U.monthGrid(y, m - 1, ws);
      const today = U.today();
      const marks = opts.marks !== false ? ED.minical.marks(days[0], days[41]) : null;
      const wd = U.range(U.startOfWeek(today, ws), 7).map(k => U.DAY3[U.dow(k)]);
      return '<div class="mc' + (opts.cls ? ' ' + opts.cls : '') + '" data-mc="' + e(id) + '">' +
        '<div class="mc-head">' +
        '<button type="button" class="mc-arrow" data-act="mc-nav" data-mc="' + e(id) + '" data-dir="-1" aria-label="Previous month">' + ED.icon('chevL') + '</button>' +
        '<button type="button" class="mc-title" data-act="mc-title" data-mc="' + e(id) + '" title="Go to today">' + e(U.MONTHS[m - 1] + ' ' + y) + '</button>' +
        '<button type="button" class="mc-arrow" data-act="mc-nav" data-mc="' + e(id) + '" data-dir="1" aria-label="Next month">' + ED.icon('chevR') + '</button>' +
        '</div>' +
        '<div class="mc-grid" role="grid">' +
        wd.map(d => '<span class="mc-wd" role="columnheader">' + d + '</span>').join('') +
        days.map(k => {
          const other = +k.slice(5, 7) !== m;
          const c = ['mc-day'];
          if (other) c.push('other');
          if (k === today) c.push('today');
          if (k === selected) c.push('sel');
          if (marks && marks.has(k)) c.push('has');
          return '<button type="button" class="' + c.join(' ') + '" data-act="mc-pick" data-mc="' + e(id) + '" data-date="' + k + '" data-drop="day" aria-label="' + e(U.fmtLong(k)) + '"' +
            (k === selected ? ' aria-current="date"' : '') + '><span>' + (+k.slice(8)) + '</span></button>';
        }).join('') +
        '</div></div>';
    },
    /* days with one-off unfinished tasks or with events get a dot (daily routines would mark every day) */
    marks(a, b) {
      const set = new Set();
      const I = M.idx();
      I.byDate.forEach((list, k) => { if (k >= a && k <= b && list.some(t => M.isPending(t.status))) set.add(k); });
      let k = a;
      while (k <= b) {
        if (!set.has(k) && M.eventsOn(k).some(ev => !ev.repeat || ev.repeat.freq === 'yearly')) set.add(k);
        k = U.addDays(k, 1);
      }
      return set;
    },
  };

  /* ======================= calendar panel ======================= */
  const MODES = [
    { id: 'day1', label: '1 Day', n: 1 },
    { id: 'day3', label: '3 Days', n: 3 },
    { id: 'week5', label: '5 Days', n: 5 },
    { id: 'week7', label: '7 Days', n: 7 },
    { id: 'month', label: 'Monthly', n: 0 },
  ];

  const CP = (ED.calpanel = {
    MODES, HOUR,

    st(host) {
      const s = ED.state.cal[host] || (ED.state.cal[host] = {});
      if (!s.mode) s.mode = (S().cal && S().cal[host]) || 'week7';
      if (!s.anchor) s.anchor = ED.state.date;
      return s;
    },

    days(s) {
      const ws = S().weekStart;
      switch (s.mode) {
        case 'day1': return [s.anchor];
        case 'day3': return U.range(s.anchor, 3);
        case 'week5': { const a = U.startOfWeek(s.anchor, ws); return U.range(ws === 1 ? a : U.addDays(a, 1), 5); }
        case 'week7': return U.range(U.startOfWeek(s.anchor, ws), 7);
        default: return [];
      }
    },

    title(s) {
      if (s.mode === 'month') return U.MONTHS[+s.anchor.slice(5, 7) - 1] + ', ' + s.anchor.slice(0, 4);
      if (s.mode === 'day1') return U.fmtLong(s.anchor);
      const ws = S().weekStart;
      if (s.mode === 'week5' || s.mode === 'week7') {
        const a = U.startOfWeek(s.anchor, ws);
        return U.fmtRange(a, U.addDays(a, 6));
      }
      const d = CP.days(s);
      return U.fmtRange(d[0], d[d.length - 1]);
    },

    step(s, dir) {
      if (s.mode === 'month') s.anchor = U.addMonths(U.firstOfMonth(s.anchor), dir);
      else if (s.mode === 'day1') s.anchor = U.addDays(s.anchor, dir);
      else if (s.mode === 'day3') s.anchor = U.addDays(s.anchor, 3 * dir);
      else s.anchor = U.addDays(s.anchor, 7 * dir);
    },

    matches(s, t) {
      const f = s.filter;
      if (!f) return true;
      if (f.type === 'role') return t.roleId === f.id;
      if (f.type === 'goal') return t.goalId === f.id;
      if (f.type === 'cat') return t.categoryId === f.id;
      return true;
    },
    filterLabel(f) {
      if (!f) return '';
      const x = f.type === 'role' ? M.role(f.id) : f.type === 'goal' ? M.goal(f.id) : M.category(f.id);
      const name = x ? (x.name || x.title) : '';
      return ({ role: 'Role', goal: 'Goal', cat: 'Category' })[f.type] + ': ' + name;
    },

    render(host) {
      const s = CP.st(host);
      const head =
        '<div class="cp-head">' +
        '<div class="cp-nav">' +
        '<button type="button" class="cp-arrow" data-act="cp-nav" data-host="' + host + '" data-dir="-1" aria-label="Previous">' + ED.icon('chevL') + '</button>' +
        '<button type="button" class="cp-title" data-act="cp-today" data-host="' + host + '" title="Jump to today">' + e(CP.title(s)) + '</button>' +
        '<button type="button" class="cp-arrow" data-act="cp-nav" data-host="' + host + '" data-dir="1" aria-label="Next">' + ED.icon('chevR') + '</button>' +
        '</div>' +
        '<div class="cp-tools">' +
        (s.filter ? '<span class="chip cp-filter">' + ED.icon('hand') + e(CP.filterLabel(s.filter)) + '<button type="button" data-act="cp-unfilter" data-host="' + host + '" aria-label="Clear filter">' + ED.icon('x') + '</button></span>' : '') +
        '<label class="cp-mode"><span class="sr-only">Calendar view</span><select data-change="cp-mode" data-host="' + host + '">' +
        MODES.map(m => '<option value="' + m.id + '"' + (m.id === s.mode ? ' selected' : '') + '>' + m.label + '</option>').join('') +
        '</select>' + ED.icon('updown') + '</label>' +
        '<button type="button" class="icon-btn" data-act="cp-expand" data-host="' + host + '" aria-label="' + (ED.state.calFull ? 'Show both pages' : 'Expand calendar') + '" title="' + (ED.state.calFull ? 'Show both pages' : 'Expand calendar') + '">' + ED.icon(ED.state.calFull ? 'collapse' : 'expand') + '</button>' +
        '</div></div>';
      const body = s.mode === 'month' ? CP.month(host, s) : CP.multi(host, s);
      return '<div class="cp cp-' + s.mode + '" data-host="' + host + '">' + head + body + '</div>';
    },

    /* ---------- multi-day (time grid + per-day lists) ---------- */
    multi(host, s) {
      const days = CP.days(s);
      const today = U.today();
      const h12 = S().h12;
      const n = days.length;
      const compact = n >= 5;
      const heads = days.map(k => '<button type="button" class="cp-dh' + (k === today ? ' today' : '') + (k === ED.state.date ? ' sel' : '') + '" data-act="goto-day" data-date="' + k + '" data-drop="day" title="' + e(U.fmtLong(k)) + '">' +
        '<span class="cp-dh-w">' + U.DAY3[U.dow(k)] + ',</span> ' + (compact ? '<span class="cp-dh-m">' + U.MON[+k.slice(5, 7) - 1] + ' </span>' : U.MON[+k.slice(5, 7) - 1] + ' ') + (+k.slice(8)) + '</button>').join('');
      const allday = days.map(k => '<div class="cp-ad" data-drop="allday" data-date="' + k + '" title="Drop a task or event here to make it all-day">' + CP.allDayChips(k, s) + '</div>').join('');

      const hours = Array.from({ length: 24 }, (_, h) => '<div class="cp-hr' + (h >= S().activeFrom && h < S().activeTo ? ' active' : '') + '"><span>' + U.pad(h) + '</span></div>').join('');
      const cols = days.map(k => '<div class="cp-col' + (k === today ? ' today' : '') + '" data-date="' + k + '" data-drop="time" data-act="slot">' + CP.layout(CP.timedItems(k, s)) +
        (k === today ? '<div class="now-line" style="top:' + (U.nowMin() / 60 * HOUR) + 'px"><i></i></div>' : '') + '</div>').join('');

      const lists = days.map(k => {
        const occs = M.tasksOn(k, { carry: false }).filter(o => CP.matches(s, o.t));
        return '<div class="cp-list scroll" data-drop="day" data-date="' + k + '">' + CP.catLists(occs, k) + (s.filter ? '' : CP.studyList(k)) + '</div>';
      }).join('');

      return '<div class="cp-multi" style="--n:' + n + '">' +
        '<div class="cp-row cp-heads"><div class="cp-gut"></div>' + heads + '</div>' +
        '<div class="cp-row cp-allday"><div class="cp-gut"><span>All day</span></div>' + allday + '</div>' +
        '<div class="cp-grid scroll" data-keep-scroll="cp-grid-' + host + '" data-autoscroll="' + (S().dayStart * HOUR) + '"><div class="cp-row cp-canvas" style="height:' + (24 * HOUR) + 'px"><div class="cp-gut cp-hours">' + hours + '</div>' + cols + '</div></div>' +
        '<div class="cp-row cp-lists" data-keep-scroll="cp-lists-' + host + '"><div class="cp-gut"></div>' + lists + '</div>' +
        '</div>';
    },

    /* chips in the all-day strip: all-day events and all-day tasks (drag them to a time, or drop others here) */
    allDayChips(k, s) {
      const hideDone = !S().showCompleted;
      const evs = M.eventsOn(k).filter(ev => ev.allDay);
      const tasks = M.sortOccs(M.tasksOn(k, { carry: false }).filter(o => o.t.allDay && (!s || CP.matches(s, o.t)) && !(hideDone && !M.isPending(o.st) && o.st !== 'delegated')));
      return evs.map(ev => '<button type="button" class="ev-chip" style="--c:' + e(ev.color) + '" data-act="event-open" data-id="' + e(ev.id) + '" data-k="' + k + '" draggable="true" data-drag="event" title="' + e(ev.title) + ' — drag to a time to schedule it">' + e(ev.title) + '</button>').join('') +
        tasks.map(o => {
          const c = M.category(o.t.categoryId);
          return '<div class="ad-task st-' + o.st + '" style="--c:' + e(c ? c.color : '#5f6670') + '" data-tid="' + e(o.t.id) + '" data-k="' + k + '" draggable="true" data-drag="task" title="' + e(M.code(o.t) + ' ' + o.t.title) + ' — drag to a time to schedule it">' +
            '<button type="button" class="ad-tick" data-act="task-toggle" aria-label="' + e(M.statusLabel(o.st)) + ' — click to ' + (M.isClosed(o.st) ? 'reopen' : 'complete') + '">' + ED.tasksUI.statusIcon(o.st) + '</button>' +
            '<button type="button" class="ad-t" data-act="task-open">' + e(M.code(o.t)) + ' ' + e(o.t.title || 'Untitled task') + '</button></div>';
        }).join('');
    },

    /* the day's study sessions that have no time (timed ones are in the grid above) */
    studyList(k) {
      if (!ED.study || !ED.study.plan()) return '';
      const hideDone = !S().showCompleted;
      const l = ED.study.on(k).filter(x => !ED.study.timeOf(x) && !(hideDone && x.done));
      if (!l.length) return '';
      return '<div class="cp-lg cp-study"><span class="cp-lg-h"><span class="emo">📘</span>Study</span>' + l.map(x => {
        const tr = ED.study.track(x.trackId);
        return '<div class="cp-li' + (x.done ? ' st-done' : '') + '" data-act="study-open" data-sid="' + e(x.id) + '" title="' + e((tr ? tr.name : 'Study') + (x.topic ? ' — ' + x.topic : '') + ' · ' + x.min + ' min') + '">' +
          '<span class="code num">' + (x.done ? '✓' : x.min + '′') + '</span><span class="ttl tinted" style="--c:' + e(ED.study.color(tr)) + '">' + e(ED.study.short(tr) + (x.topic ? ' — ' + x.topic : '')) + '</span></div>';
      }).join('') + '</div>';
    },

    /* everything with a time on one day, ready for layout(); items can be dragged and resized (tgdrag.js) */
    timedItems(k, s) {
      const h12 = S().h12;
      const items = [];
      const rs = '<i class="tg-rs" aria-hidden="true" title="Drag to change the length"></i>';
      M.eventsOn(k).filter(ev => !ev.allDay && ev.start).forEach(ev => {
        const a = U.toMin(ev.start), b = Math.max(a + 15, ev.end ? U.toMin(ev.end) : a + 60);
        items.push({ a, b, html: pos => '<button type="button" class="tg-item tg-ev" style="' + pos + ';--c:' + e(ev.color) + '" data-act="event-open" data-tg="event" data-id="' + e(ev.id) + '" data-k="' + k + '" data-a="' + a + '" data-b="' + b + '" title="' + e(ev.title) + '">' +
          '<b>' + e(ev.title) + '</b><span class="num tg-when">' + e(U.fmtTime(ev.start, h12)) + (ev.end ? ' – ' + e(U.fmtTime(ev.end, h12)) : '') + '</span>' + (ev.location ? '<span>' + e(ev.location) + '</span>' : '') + rs + '</button>' });
      });
      M.tasksOn(k, { carry: false }).filter(o => o.t.time && (!s || CP.matches(s, o.t))).forEach(o => {
        const a = U.toMin(o.t.time), b = a + Math.max(15, o.t.dur || 30);
        const cat = M.category(o.t.categoryId);
        items.push({ a, b, html: pos => '<div class="tg-item tg-task st-' + o.st + '" style="' + pos + ';--c:' + e(cat ? cat.color : '#5f6670') + '" data-act="task-open" data-tg="task" data-tid="' + e(o.t.id) + '" data-k="' + k + '" data-a="' + a + '" data-b="' + b + '" title="' + e(M.code(o.t) + ' ' + o.t.title) + '">' +
          '<b>' + e(M.code(o.t)) + ' ' + e(o.t.title) + '</b><span class="num tg-when">' + e(U.fmtTime(o.t.time, h12)) + '</span>' + rs + '</div>' });
      });
      if (ED.study && !(s && s.filter)) ED.study.timedOn(k).forEach(x => {
        const a = U.toMin(x.time), b = a + Math.max(15, x.s.min || 60);
        items.push({ a, b, html: pos => '<div class="tg-item tg-study' + (x.s.done ? ' done' : '') + '" style="' + pos + ';--c:' + e(x.color) + '" data-act="study-open" data-tg="study" data-sid="' + e(x.s.id) + '" data-k="' + k + '" data-a="' + a + '" data-b="' + b + '" title="Study: ' + e(x.track + ' — ' + (x.s.topic || '')) + '">' +
          '<b>' + (x.s.done ? '✓ ' : '') + e(x.short) + '</b><span class="num tg-when">' + e(U.fmtTime(x.time, h12)) + '</span><span>' + e(x.s.topic || '') + '</span>' + rs + '</div>' });
      });
      return items;
    },

    /* side-by-side lanes for overlapping items */
    layout(items) {
      items.sort((x, y) => x.a - y.a || y.b - x.b);
      const out = [];
      let cluster = [], end = -1;
      const flush = () => {
        const lanes = [];
        cluster.forEach(it => {
          let li = lanes.findIndex(l => l <= it.a);
          if (li < 0) { li = lanes.length; lanes.push(0); }
          lanes[li] = it.b; it.lane = li;
        });
        cluster.forEach(it => {
          const w = 100 / lanes.length;
          const pos = 'top:' + (it.a / 60 * HOUR) + 'px;height:' + Math.max(18, (it.b - it.a) / 60 * HOUR - 2) + 'px;left:calc(' + (it.lane * w) + '% + 2px);width:calc(' + w + '% - 4px)';
          out.push(it.html(pos));
        });
        cluster = []; end = -1;
      };
      items.forEach(it => { if (cluster.length && it.a >= end) flush(); cluster.push(it); end = Math.max(end, it.b); });
      if (cluster.length) flush();
      return out.join('');
    },

    catLists(occs, k) {
      if (!occs.length) return '';
      const hideDone = !S().showCompleted;
      return M.groupByCategory(occs).map(g => {
        const c = g.cat;
        const rows = g.items.filter(o => !(hideDone && !M.isPending(o.st) && o.st !== 'delegated')).map(o =>
          '<div class="cp-li st-' + o.st + '" data-act="task-open" data-tid="' + e(o.t.id) + '" data-k="' + k + '" draggable="true" data-drag="task" title="' + e(o.t.title) + '">' +
          '<span class="code num">' + e(M.code(o.t)) + '</span><span class="ttl' + (c ? ' tinted' : '') + '"' + (c ? ' style="--c:' + e(c.color) + '"' : '') + '>' + e(o.t.title) + '</span>' +
          (o.t.repeat ? '<span class="mini-b">' + ED.letterIcon(M.repeatBadge(o.t.repeat)) + '</span>' : '') + '</div>').join('');
        if (!rows) return '';
        return '<div class="cp-lg"><span class="cp-lg-h">' + (c ? '<span class="emo">' + e(c.icon || '•') + '</span>' + e(c.name) : 'Other') + '</span>' + rows + '</div>';
      }).join('');
    },

    /* ---------- month grid ---------- */
    month(host, s) {
      const ws = S().weekStart;
      const [y, m] = U.ymd(s.anchor);
      const days = U.monthGrid(y, m - 1, ws);
      const today = U.today();
      const h12 = S().h12;
      const hideDone = !S().showCompleted;
      const wd = U.range(U.startOfWeek(today, ws), 7).map(k => '<span>' + U.DAY3[U.dow(k)] + '</span>').join('');
      const cells = days.map(k => {
        const other = +k.slice(5, 7) !== m;
        const evs = M.eventsOn(k);
        const occs = M.sortOccs(M.tasksOn(k, { carry: false }).filter(o => CP.matches(s, o.t)))
          .filter(o => !(hideDone && !M.isPending(o.st)));
        const items =
          evs.map(ev => '<button type="button" class="m-ev' + (ev.allDay ? ' allday' : '') + '" style="--c:' + e(ev.color) + '" data-act="event-open" data-id="' + e(ev.id) + '" data-k="' + k + '" draggable="true" data-drag="event" title="' + e(ev.title) + '">' +
            e(ev.title) + (ev.allDay ? '' : ' <span class="num">' + e(U.fmtTime(ev.start, h12).replace(':00', '')) + '</span>') + '</button>').join('') +
          occs.map(o => {
            const c = M.category(o.t.categoryId);
            return '<div class="m-t st-' + o.st + (c ? ' tinted' : '') + (o.t.allDay ? ' allday' : '') + '"' + (c ? ' style="--c:' + e(c.color) + '"' : '') + ' data-act="task-open" data-tid="' + e(o.t.id) + '" data-k="' + k + '" draggable="true" data-drag="task" title="' + e(M.code(o.t) + ' ' + o.t.title) + (o.t.allDay ? ' (all day)' : o.t.time ? ' (' + U.fmtTime(o.t.time, h12) + ')' : '') + '">' + e(o.t.title) + '</div>';
          }).join('');
        // the day's study sessions as one line: how many are ticked of how many planned
        let study = '';
        if (ED.study && ED.study.plan() && !s.filter) {
          const sl = ED.study.on(k);
          if (sl.length) {
            const dn = sl.filter(x => x.done).length, late = k < today && dn < sl.length;
            study = '<button type="button" class="m-st' + (dn === sl.length ? ' done' : late ? ' late' : '') + '" data-act="study-day" data-date="' + k + '" data-go="studyWeek" title="Study: ' + e(sl.map(x => ED.study.short(ED.study.track(x.trackId)) + (x.topic ? ' — ' + x.topic : '')).join(', ')) + '">📘 ' + dn + '/' + sl.length + ' study</button>';
          }
        }
        return '<div class="m-cell' + (other ? ' other' : '') + (k === today ? ' today' : '') + (k === ED.state.date ? ' sel' : '') + '" data-drop="day" data-date="' + k + '">' +
          '<button type="button" class="m-num num" data-act="goto-day" data-date="' + k + '" aria-label="Open ' + e(U.fmtLong(k)) + '">' + (+k.slice(8)) + '</button>' +
          '<div class="m-items">' + items + study + '</div>' + (ED.habits && !other ? ED.habits.cellBadge(k) : '') + '</div>';
      }).join('');
      return '<div class="cp-month"><div class="m-wd">' + wd + '</div><div class="m-grid">' + cells + '</div></div>';
    },

    /* scroll time grids to the configured hour the first time they appear */
    afterRender(root) {
      U.$$('.cp-grid[data-autoscroll]', root).forEach(g => {
        if (g.dataset.scrolled) return;
        const key = g.dataset.keepScroll;
        if (!(ED.state.scroll && ED.state.scroll[key] != null)) g.scrollTop = +g.dataset.autoscroll;
        g.dataset.scrolled = '1';
      });
    },

    timeFromY(col, clientY, step) {
      step = step || 30;
      const r = col.getBoundingClientRect();
      const min = Math.max(0, Math.min(24 * 60 - step, Math.floor(((clientY - r.top) / HOUR * 60) / step) * step));
      return U.fromMin(min);
    },
  });
})();
