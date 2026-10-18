/* E-Diary — Events, meetings and planning.
   A separate event calendar: your Google Calendar events (read from Google — through the Claude connector inside Claude,
   or with your Google sign-in in the downloaded copy) together with the diary's own events.
   Left page:  the agenda for the next two weeks, what is on today and this week, and the action items from your meetings.
   Right page: a month calendar of the events; click one for its details and to plan it — agenda, notes, decisions and
               action items (any action item can become a diary task).
   Google events are only read here (never changed); copies the diary itself sent to Google are shown once, as diary items.
   Data: ED.store.data.meetings = {
     cals:    ['primary', …]                          which Google calendars to show
     calInfo: { <calendarId>: { name, color } }
     notes:   { 'g:<googleEventId>' | 'e:<diaryEventId>@YYYY-MM-DD':
                { title, date, agenda, attendees, notes, decisions, actions: [{ id, text, who, due, done, taskId }], updatedAt } } }
   The events fetched from Google are kept in this browser only (a cache), so the calendar shows at once next time. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc, M = ED.model;
  const CH = ED.charts, FX = ED.fx;
  const D = () => ED.store.data;
  const MD = () => D().meetings || (D().meetings = ED.sample.meetings());
  const A = (ED.actions = ED.actions || {});
  const GC = () => ED.gcal;
  const MT = (ED.meetings = {});
  const st = () => { const s = ED.state.mt || (ED.state.mt = {}); if (!s.init) Object.assign(s, { init: true, m: s.m || U.firstOfMonth(U.today()), sel: s.sel || null, busy: false, err: '', cache: U.lsGet(CACHE, null) }); return s; };
  MT.st = st;
  const CACHE = 'e-diary-google-events-v1';
  const PALETTE = ['#1f6fe0', '#7b4bd6', '#00897b', '#ef6c00', '#c2185b', '#2e7d32', '#8a6d00', '#3949ab'];

  /* ---------------- which Google events, and where from ---------------- */
  const calColor = id => { const i = MD().cals.indexOf(id); const inf = MD().calInfo[id]; return (inf && inf.color) || PALETTE[(i < 0 ? 0 : i) % PALETTE.length]; };
  const calName = id => { const inf = MD().calInfo[id]; return (inf && inf.name) || (id === 'primary' ? 'My calendar' : id); };
  /* Google ids of the diary's own copies: events are shown from the diary instead; tasks stay (labelled) */
  const mineIds = () => { const map = (D().gcal && D().gcal.map) || {}, ev = new Set(), other = new Map(); Object.keys(map).forEach(k => { const m = map[k]; if (!m || !m.id) return; if (k[0] === 'e') ev.add(m.id); else other.set(m.id, k[0] === 't' ? 'task' : 'study'); }); return { ev, other }; };
  MT.google = () => {
    const c = st().cache; if (!c || !c.events) return [];
    const show = new Set(MD().cals), mine = mineIds();
    const base = x => x.rid || String(x.gid || '').replace(/_\d{8}(T\d{6}Z?)?$/, '');   // one repeat of an event → the event
    return c.events.filter(x => show.has(x.cal) && !mine.ev.has(x.gid) && !mine.ev.has(base(x))).map(x => Object.assign({}, x, { from: mine.other.get(x.gid) || mine.other.get(base(x)) || '' }));
  };
  /* everything on one day, in time order */
  MT.day = k => {
    const out = [];
    M.eventsOn(k).forEach(ev => out.push({ src: 'diary', key: 'e:' + ev.id + (ev.repeat ? '@' + k : ''), id: ev.id, title: ev.title || '(no title)', time: ev.allDay ? null : ev.start, endTime: ev.allDay ? null : ev.end, allDay: !!ev.allDay, color: ev.color || PALETTE[0], location: ev.location || '', desc: U.stripHtml(ev.notes || ''), cal: 'Diary' }));
    MT.google().forEach(g => {
      if (k < g.date || k > g.endDate) return;
      const first = k === g.date, lastDay = k === g.endDate;
      out.push({ src: 'google', key: 'g:' + g.gid, g, title: g.title, time: g.allDay || !first ? null : g.time, endTime: g.allDay || !lastDay ? null : g.endTime, allDay: g.allDay || (!first && !lastDay), cont: !first, color: calColor(g.cal), location: g.location, desc: g.desc, cal: calName(g.cal), from: g.from });
    });
    return out.sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || String(a.time || '').localeCompare(String(b.time || '')) || a.title.localeCompare(b.title));
  };
  const mins = x => x.allDay || !x.time || !x.endTime ? 0 : Math.max(0, U.toMin(x.endTime) - U.toMin(x.time));
  const noteOf = key => MD().notes[key.replace(/@.*$/, '')] || MD().notes[key] || null;
  const noteKey = x => x.src === 'google' ? x.key : x.key;           // diary events: one note per day of a repeating event

  /* ---------------- fetching from Google ---------------- */
  const range = () => {
    const s = st(), ws = D().settings.weekStart || 0;
    const [y, m] = U.ymd(s.m);
    const grid = U.monthGrid(y, m - 1, ws);
    const from = [grid[0], U.addDays(U.today(), -7)].sort()[0], to = [U.addDays(grid[grid.length - 1], 1), U.addDays(U.today(), 22)].sort().pop();
    return { from, to };
  };
  const covered = (c, r) => c && c.from <= r.from && c.to >= r.to && String(c.cals) === String(MD().cals);
  MT.fetch = async (force) => {
    const s = st(), gc = GC();
    if (!gc || s.busy) return;
    const why = gc.readable();
    if (why === 'signin') { if (!force) return; const ok = await gc.connect(false, { only: true }); if (!ok) return; }
    else if (why) return;                                             // the page already says why
    const r = range();
    if (!force && covered(s.cache, r) && Date.now() - s.cache.at < 5 * 60000) return;
    if (!force && s.failAt && Date.now() - s.failAt < 5 * 60000) return;   // after a refusal, wait for Refresh
    s.busy = true; s.err = ''; redraw();
    try {
      const cals = MD().cals.length ? MD().cals : ['primary'];
      const events = [];
      for (const c of cals) (await gc.readEvents(c, r.from, r.to)).forEach(x => events.push(x));
      s.cache = { from: r.from, to: r.to, at: Date.now(), cals: MD().cals.slice(), events };
      s.failAt = 0;
      if (!(ED.lock && ED.lock.on)) U.lsSet(CACHE, s.cache);   // a locked diary keeps no readable copy of your events
    } catch (err) {
      s.failAt = Date.now();
      const x = gc.explain(err);
      s.err = x.code === 'scope' ? 'Google has not given your connector permission to read your calendar. In claude.ai open Settings → Connectors → Google Calendar, choose Disconnect, then Connect again — and on Google’s screen tick the boxes that let it see and edit your calendar events (Google leaves them unticked). Then click Refresh.'
        : x.code === 'expired' ? 'signin' : x.text;
    } finally { s.busy = false; redraw(); }
  };
  function redraw() { if (ED.state.tab === 'events' && ED.app && ED.app.render) ED.app.render(); }

  /* ---------------- left page ---------------- */
  const view = {
    id: 'events', label: 'Events',
    left() {
      const s = st(), today = U.today(), gc = GC();
      const from = s.sel && s.sel >= today ? s.sel : today;
      const days = U.range(from, 14);
      const wk = U.range(U.startOfWeek(today, D().settings.weekStart || 0), 7);
      const todayL = MT.day(today), weekL = wk.map(k => MT.day(k)).flat();
      const nowMin = U.nowMin();
      const next = U.range(today, 14).map(k => MT.day(k).filter(x => !x.allDay && x.time && (k > today || U.toMin(x.time) >= nowMin)).map(x => Object.assign({ k }, x))).flat()[0];
      const acts = MT.actions().filter(a => !a.done);
      const tiles = '<div class="tiles xp-tiles">' +
        FX.tile('Today', String(todayL.length), todayL.length ? U.plural(todayL.filter(x => !x.allDay).length, 'timed event') : 'a free day') +
        FX.tile('This week', String(weekL.filter(x => !x.cont).length), Math.round(weekL.reduce((a, x) => a + mins(x), 0) / 6) / 10 + ' hours in meetings') +
        FX.tile('Next', next ? e(next.k === today ? FX.time(next.time) : FX.when(next.k)) : '—', next ? e(next.title) : 'nothing timed ahead') +
        FX.tile('Open actions', String(acts.length), acts.length ? 'from your meetings' : 'none waiting', acts.some(a => a.due && a.due < today) ? 'warn' : '') + '</div>';
      // Google status
      const why = gc ? gc.readable() : 'Google Calendar is not available.';
      const c = s.cache;
      let status;
      if (s.busy) status = '<div class="notice info">' + ED.icon('sync') + '<span class="grow">Reading your Google Calendar…</span></div>';
      else if (s.err === 'signin' || why === 'signin') status = '<div class="notice info">' + ED.icon('calendar') + '<span class="grow">Sign in to Google to show your Google Calendar events here (read only).</span><button type="button" class="btn small primary" data-act="mt-refresh">Show my Google events</button></div>';
      else if (s.err) status = '<div class="notice err">' + ED.icon('calendar') + '<span class="grow"><b>Google Calendar:</b> ' + e(s.err) + (c && c.events ? ' <span class="hint">Showing what was read ' + e(ago(c.at)) + '.</span>' : '') + '</span><button type="button" class="btn small primary" data-act="mt-refresh">Try again</button></div>';
      else if (why) status = '<div class="notice info">' + ED.icon('calendar') + '<span class="grow">' + e(why) + '</span><button type="button" class="btn small" data-act="open-settings" data-tab="gcal">Settings</button></div>';
      else status = '<p class="hint mt-stat">' + ED.icon('calendar') + ' ' + (c && c.events ? 'Google Calendar: ' + U.plural(MT.google().length, 'event') + ' from ' + e(MD().cals.map(calName).join(', ')) + ', read ' + e(ago(c.at)) + '.' : 'Google Calendar: not read yet.') + '</p>';
      const agenda = days.map(k => {
        const l = MT.day(k); if (!l.length) return '';
        return '<section class="mt-day"><h3 class="mt-dh' + (k === today ? ' today' : '') + '">' + e(U.DAYS[U.dow(k)].slice(0, 3) + ' ' + U.fmtDM(k)) + '<span class="hint">' + e(k === today ? 'Today' : FX.when(k)) + '</span></h3>' +
          '<ul class="mt-list">' + l.map(x => row(x, k)).join('') + '</ul></section>';
      }).join('');
      const actList = acts.length ? '<ul class="xp-check mt-acts">' + acts.slice(0, 40).map(a => '<li><label><input type="checkbox" data-act="mt-act-done" data-key="' + e(a.key) + '" data-id="' + e(a.id) + '"><span>' + e(a.text) + (a.who ? ' <span class="hint">· ' + e(a.who) + '</span>' : '') + (a.due ? ' <span class="hint' + (a.due < today ? ' fin-bad' : '') + '">· ' + e(FX.dm(a.due)) + '</span>' : '') + '<span class="hint mt-from">' + e(a.title) + '</span></span></label>' +
        (a.taskId && M.task(a.taskId) ? '<span class="hint">' + ED.icon('checkSq') + ' task</span>' : '<button type="button" class="btn small ghost" data-act="mt-act-task" data-key="' + e(a.key) + '" data-id="' + e(a.id) + '">Make it a task</button>') + '</li>').join('') + '</ul>' : '<p class="hint">Action items you write in a meeting’s plan appear here until they are done.</p>';
      const tools = '<button type="button" class="icon-btn" data-act="mt-refresh" aria-label="Read Google Calendar again" title="Read Google Calendar again">' + ED.icon('sync') + '</button>' +
        '<button type="button" class="icon-btn" data-act="mt-cals" aria-label="Which Google calendars" title="Which Google calendars to show">' + ED.icon('gear') + '</button>' +
        '<button type="button" class="btn small primary" data-act="mt-new">' + ED.icon('plus') + 'New meeting</button>';
      const body = tiles + status +
        '<h3 class="gh">' + (from === today ? 'Next two weeks' : 'From ' + e(U.fmtDM(from))) + (from !== today ? ' <button type="button" class="btn small ghost" data-act="mt-sel" data-date="">Back to today</button>' : '') + '</h3>' +
        (agenda || '<p class="hint">Nothing in these two weeks.</p>') +
        '<h3 class="gh fin-gap">Action items</h3>' + actList;
      return FX.page('mt', 'Events &amp; meetings', tools, body, 'mt-left');
    },

    right() {
      const s = st(), today = U.today(), ws = D().settings.weekStart || 0;
      const [y, m] = U.ymd(s.m);
      const grid = U.monthGrid(y, m - 1, ws);
      const wd = U.range(U.startOfWeek(today, ws), 7).map(k => '<span>' + U.DAY3[U.dow(k)] + '</span>').join('');
      const cells = grid.map(k => {
        const l = MT.day(k), other = +k.slice(5, 7) !== m;
        const shown = l.slice(0, 4);
        return '<div class="mt-cell' + (other ? ' other' : '') + (k === today ? ' today' : '') + (k === s.sel ? ' sel' : '') + '">' +
          '<button type="button" class="mt-num num" data-act="mt-sel" data-date="' + k + '" aria-label="Show ' + e(U.fmtLong(k)) + ' in the agenda">' + (+k.slice(8)) + '</button>' +
          shown.map(x => '<button type="button" class="mt-ev' + (x.allDay ? ' allday' : '') + (x.src === 'google' ? ' g' : '') + '" style="--c:' + e(x.color) + '" data-act="mt-open" data-key="' + e(x.key) + '" data-k="' + k + '" title="' + e((x.time ? FX.time(x.time) + ' ' : '') + x.title + ' · ' + x.cal) + '">' + (x.time ? '<span class="num">' + e(FX.time(x.time).replace(':00', '')) + '</span> ' : '') + e(x.title) + '</button>').join('') +
          (l.length > 4 ? '<button type="button" class="mt-more" data-act="mt-sel" data-date="' + k + '">+' + (l.length - 4) + ' more</button>' : '') + '</div>';
      }).join('');
      const legend = '<div class="mt-legend">' + MD().cals.map(c => '<span><i style="background:' + e(calColor(c)) + '"></i>' + e(calName(c)) + '</span>').join('') + '<span><i class="diary"></i>Diary events</span></div>';
      return '<div class="xp mt-r"><div class="pg-head mt-head"><button type="button" class="cp-arrow" data-act="mt-month" data-dir="-1" aria-label="Previous month">' + ED.icon('chevL') + '</button>' +
        '<h2 class="pg-title">' + U.MONTHS[m - 1] + ' ' + y + '</h2><button type="button" class="cp-arrow" data-act="mt-month" data-dir="1" aria-label="Next month">' + ED.icon('chevR') + '</button>' +
        '<span class="grow"></span><button type="button" class="btn small" data-act="mt-month" data-dir="0">Today</button></div>' + legend +
        '<div class="mt-month"><div class="mt-wd">' + wd + '</div><div class="mt-grid">' + cells + '</div></div></div>';
    },
    mount() { MT.fetch(false); },
  };

  const ago = t => { const n = Math.round((Date.now() - t) / 60000); return n < 1 ? 'just now' : n < 60 ? n + ' min ago' : n < 1440 ? Math.round(n / 60) + ' h ago' : Math.round(n / 1440) + ' days ago'; };
  function row(x, k) {
    const n = noteOf(noteKey(x));
    const open = n ? (n.actions || []).filter(a => !a.done).length : 0;
    return '<li class="mt-arow"><button type="button" class="plain-btn mt-rb" data-act="mt-open" data-key="' + e(x.key) + '" data-k="' + k + '" style="--c:' + e(x.color) + '">' +
      '<span class="mt-t num">' + (x.allDay ? 'All day' : e(FX.time(x.time)) + (x.endTime ? '<span class="hint">' + e(FX.time(x.endTime)) + '</span>' : '')) + '</span>' +
      '<span class="mt-m"><b>' + e(x.title) + '</b><span class="hint">' + e([x.location, x.cal, x.src === 'google' && x.g.attendees.length ? U.plural(x.g.attendees.length, 'guest') : '', x.from ? 'diary ' + x.from : ''].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="mt-b">' + (n && (n.agenda || n.notes) ? '<span class="chip mt-planned">' + ED.icon('doc') + 'planned</span>' : '') + (open ? '<span class="chip">' + open + ' to do</span>' : '') + '</span></button></li>';
  }

  /* ---------------- action items across meetings ---------------- */
  MT.actions = () => {
    const out = [];
    Object.keys(MD().notes).forEach(key => { const n = MD().notes[key]; (n.actions || []).forEach(a => out.push(Object.assign({ key, title: n.title || 'Meeting', mdate: n.date }, a))); });
    return out.sort((a, b) => String(a.due || a.mdate || '9999').localeCompare(String(b.due || b.mdate || '9999')));
  };
  const findItem = (key, k) => MT.day(k).find(x => x.key === key) || null;
  const toTask = (n, a) => {
    const t = M.addTask({ title: a.text, prio: 'B', date: a.due || n.date || U.today(), notes: '<p>From the meeting “' + e(n.title || '') + '”' + (n.date ? ' on ' + e(U.fmtLong(n.date)) : '') + (a.who ? ' · ' + e(a.who) : '') + '</p>' });
    a.taskId = t.id; return t;
  };

  /* ---------------- one event: details and its plan ---------------- */
  MT.open = (key, k) => {
    const x = findItem(key, k);
    if (!x) { ED.ui.toast('That event is not shown any more'); return; }
    const nk = noteKey(x);
    const n0 = noteOf(nk) || {};
    const acts = (n0.actions || []).map(a => Object.assign({}, a));
    const when = (x.src === 'google' && x.g.endDate !== x.g.date ? U.fmtLong(x.g.date) + ' – ' + U.fmtLong(x.g.endDate) : U.fmtLong(k)) + (x.allDay ? ' · all day' : x.time ? ' · ' + FX.time(x.src === 'google' ? x.g.time : x.time) + (x.endTime || (x.src === 'google' && x.g.endTime) ? ' – ' + FX.time(x.src === 'google' ? x.g.endTime : x.endTime) : '') : '');
    const g = x.src === 'google' ? x.g : null;
    const info = '<div class="mt-info" style="--c:' + e(x.color) + '"><p class="mt-when">' + ED.icon('clock') + e(when) + '</p>' +
      '<p class="hint">' + e(x.cal) + (x.src === 'google' ? ' · from Google Calendar' + (x.from ? ' (a copy of a diary ' + x.from + ')' : '') : ' · diary event') + (g && g.recurring ? ' · repeats' : '') + '</p>' +
      (x.location ? '<p>' + ED.icon('pin') + e(x.location) + '</p>' : '') +
      (g && g.meet ? '<p>' + ED.icon('link') + FX.link(g.meet) + '</p>' : '') +
      (g && g.organizer ? '<p class="hint">Organiser: ' + e(g.organizer) + '</p>' : '') +
      (g && g.attendees.length ? '<p class="hint">Guests: ' + e(g.attendees.join(', ')) + '</p>' : '') +
      (x.desc ? '<div class="mt-desc">' + e(x.desc.slice(0, 1500)).replace(/\n/g, '<br>') + '</div>' : '') + '</div>';
    const actRow = a => '<li class="mt-a" data-id="' + e(a.id) + '"><input type="checkbox" class="mt-a-done"' + (a.done ? ' checked' : '') + ' aria-label="Done"><input class="field mt-a-text" value="' + e(a.text) + '" placeholder="Action"><input class="field mt-a-who" value="' + e(a.who || '') + '" placeholder="Who"><input class="field mt-a-due" type="date" value="' + e(a.due || '') + '" aria-label="Due"><button type="button" class="icon-btn sm" data-mt="rm" aria-label="Remove">' + ED.icon('x') + '</button></li>';
    const body = info + '<form class="st-form mt-plan"><h4 class="fx-head">Plan and notes</h4><div class="st-grid">' +
      '<label class="lbl" for="mt-agenda">Agenda</label><textarea id="mt-agenda" class="field" rows="4" placeholder="Points to cover, one per line">' + e(n0.agenda || '') + '</textarea>' +
      '<label class="lbl" for="mt-att">Attendees</label><input id="mt-att" class="field" value="' + e(n0.attendees || (g ? g.attendees.join(', ') : '')) + '" placeholder="Who is coming">' +
      '<label class="lbl" for="mt-notes">Notes</label><textarea id="mt-notes" class="field" rows="5" placeholder="What was discussed">' + e(n0.notes || '') + '</textarea>' +
      '<label class="lbl" for="mt-dec">Decisions</label><textarea id="mt-dec" class="field" rows="3" placeholder="What was decided">' + e(n0.decisions || '') + '</textarea>' +
      '</div><h4 class="fx-head">Action items</h4><ul class="mt-alist">' + acts.map(actRow).join('') + '</ul><button type="button" class="btn small ghost" data-mt="add">' + ED.icon('plus') + 'Add an action item</button>' +
      '<label class="switch mt-tasks-sw"><input type="checkbox" id="mt-mk"><span class="track"></span><span>Also make new action items into diary tasks</span></label></form>';
    ED.ui.modal({
      title: x.title, cls: 'st-modal wide', body,
      footer: (x.src === 'diary' ? '<button type="button" class="btn" data-x="edit">' + ED.icon('pencil') + 'Edit the event</button>' : g && g.link ? '<a class="btn" href="' + e(g.link) + '" target="_blank" rel="noopener noreferrer">' + ED.icon('external') + 'Open in Google Calendar</a>' : '') +
        '<span class="grow"></span><button type="button" class="btn" data-mclose>Close</button><button type="button" class="btn primary" data-x="save">Save the plan</button>',
      onMount(el, api) {
        const list = el.querySelector('.mt-alist');
        el.addEventListener('click', ev => {
          const b = ev.target.closest('[data-mt]'); if (!b) return;
          if (b.dataset.mt === 'rm') b.closest('.mt-a').remove();
          if (b.dataset.mt === 'add') { list.insertAdjacentHTML('beforeend', actRow({ id: U.uid('ma'), text: '', who: '', due: '', done: false })); list.lastElementChild.querySelector('.mt-a-text').focus(); }
        });
        const ed = el.querySelector('[data-x="edit"]');
        if (ed) ed.addEventListener('click', () => { api.close(); ED.editors.event({ id: x.id, k }); });
        el.querySelector('[data-x="save"]').addEventListener('click', () => {
          const val = id => el.querySelector('#' + id).value.trim();
          const rows = U.$$('.mt-a', list).map(li => {
            const old = acts.find(a => a.id === li.dataset.id) || {};
            return Object.assign({}, old, { id: li.dataset.id, text: li.querySelector('.mt-a-text').value.trim(), who: li.querySelector('.mt-a-who').value.trim(), due: U.isKey(li.querySelector('.mt-a-due').value) ? li.querySelector('.mt-a-due').value : '', done: li.querySelector('.mt-a-done').checked });
          }).filter(a => a.text);
          const n = { title: x.title, date: x.src === 'google' ? x.g.date : k, agenda: val('mt-agenda'), attendees: val('mt-att'), notes: val('mt-notes'), decisions: val('mt-dec'), actions: rows, updatedAt: Date.now() };
          const empty = !n.agenda && !n.notes && !n.decisions && !rows.length;
          ED.store.checkpoint('Meeting plan');
          if (empty) delete MD().notes[nk]; else MD().notes[nk] = n;
          let made = 0;
          if (el.querySelector('#mt-mk').checked) rows.forEach(a => { if (!a.taskId && !a.done) { toTask(n, a); made++; } });
          rows.forEach(a => { const t = a.taskId && M.task(a.taskId); if (t && !t.repeat) { const want = a.done ? 'done' : 'open'; if ((a.done && M.isPending(t.status)) || (!a.done && t.status === 'done')) M.setStatus(t, t.date, want); } });
          ED.store.commit(); api.close(); ED.ui.toast(empty ? 'Nothing to keep' : 'Plan saved' + (made ? ' — ' + U.plural(made, 'task') + ' added to the diary' : ''));
        });
      },
    });
  };

  /* choose the Google calendars to show */
  MT.chooseCals = async () => {
    const gc = GC(); const why = gc ? gc.readable() : 'no';
    if (why === 'signin') { const ok = await gc.connect(false, { only: true }); if (!ok) return; }
    else if (why) { ED.ui.toast(why, { timeout: 9000 }); return; }
    const busy = ED.ui.busy('Reading your calendars…');
    let cals;
    try { cals = await gc.readCalendars(); }
    catch (err) { busy.close(); const x = gc.explain(err); ED.ui.toast('Google Calendar: ' + (x.code === 'scope' ? x.text.replace('add events', 'read your calendars') : x.text), { kind: 'err', timeout: 14000 }); return; }
    busy.close();
    if (!cals || !cals.length) { ED.ui.toast('Google did not list any calendars'); return; }
    const on = new Set(MD().cals.map(c => c === 'primary' ? (cals.find(x => x.primary) || {}).id || 'primary' : c));
    const body = '<p class="hint">Events from the ticked calendars are shown on this page (read only).</p><ul class="xp-check mt-cals">' + cals.map((c, i) => '<li><label><input type="checkbox" value="' + e(c.id) + '"' + (on.has(c.id) ? ' checked' : '') + '><i class="mt-sw" style="background:' + e(c.color || PALETTE[i % PALETTE.length]) + '"></i><span>' + e(c.name || c.id) + (c.primary ? ' <span class="hint">(main)</span>' : '') + '</span></label></li>').join('') + '</ul>';
    ED.ui.modal({
      title: 'Google calendars to show', cls: 'st-modal', body,
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Show these</button>',
      onMount(el, api) {
        el.querySelector('[data-x="save"]').addEventListener('click', () => {
          const ids = U.$$('input[type=checkbox]', el).filter(i => i.checked).map(i => i.value);
          if (!ids.length) { ED.ui.toast('Tick at least one calendar'); return; }
          ED.store.checkpoint('Calendars');
          const md = MD();
          md.cals = ids.map(id => { const c = cals.find(x => x.id === id); return c && c.primary ? 'primary' : id; });
          ids.forEach((id, i) => { const c = cals.find(x => x.id === id); md.calInfo[c && c.primary ? 'primary' : id] = { name: (c && c.name) || id, color: (c && c.color) || PALETTE[i % PALETTE.length] }; });
          ED.store.commit(); api.close(); MT.fetch(true);
        });
      },
    });
  };

  ED.views = ED.views || {};
  ED.views.events = view;

  /* ---------------- actions ---------------- */
  A['mt-refresh'] = () => MT.fetch(true);
  A['mt-cals'] = () => MT.chooseCals();
  A['mt-new'] = () => ED.editors.event({ create: { date: st().sel && st().sel >= U.today() ? st().sel : U.today(), start: '10:00', end: '11:00' } });
  A['mt-open'] = el => MT.open(el.dataset.key, el.dataset.k);
  A['mt-sel'] = el => { const s = st(); s.sel = el.dataset.date || null; if (s.sel && U.firstOfMonth(s.sel) !== s.m) s.m = U.firstOfMonth(s.sel); ED.app.render(); };
  A['mt-month'] = el => { const s = st(); const d = +el.dataset.dir; s.m = d === 0 ? U.firstOfMonth(U.today()) : U.addMonths(s.m, d); if (d === 0) s.sel = null; ED.app.render(); MT.fetch(false); };
  A['mt-act-done'] = el => {
    const n = MD().notes[el.dataset.key]; if (!n) return;
    const a = (n.actions || []).find(y => y.id === el.dataset.id); if (!a) return;
    ED.store.checkpoint('Action item');
    a.done = el.checked; n.updatedAt = Date.now();
    const t = a.taskId && M.task(a.taskId); if (t && !t.repeat) M.setStatus(t, t.date, a.done ? 'done' : 'open');
    ED.store.commit(); if (a.done) ED.ui.undoToast('Done: ' + a.text);
  };
  A['mt-act-task'] = el => {
    const n = MD().notes[el.dataset.key]; if (!n) return;
    const a = (n.actions || []).find(y => y.id === el.dataset.id); if (!a) return;
    ED.store.checkpoint('Task from a meeting'); const t = toTask(n, a); ED.store.commit(); ED.ui.toast('Task added for ' + U.fmtDM(t.date));
  };
})();
