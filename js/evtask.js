/* E-Diary — 1.21: an event can also be a Daily task.
   An event (Events & Meetings, the calendars) with "Also in Daily tasks" on gets a task of its own (id tk-ev-<eventId>,
   link { k: 'event' }) on the same day and time, repeating the same way. The task follows the event (title, day, time,
   repeat); moving the task to another day or time moves the event too. Turning the switch off, or deleting the event,
   takes an open task away (a done one stays, as history). Deleting the task turns the switch off.
   A Google Calendar event (read only here) can be copied into the Daily tasks once ("Add to Daily tasks").
   Event fields: inTasks (true/false). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model;
  const D = () => ED.store.data;
  const EVT = (ED.evTask = {});
  const TID = id => 'tk-ev-' + id;
  EVT.TID = TID;
  const dur = ev => ev.allDay || !ev.start || !ev.end ? 30 : Math.max(5, U.toMin(ev.end) - U.toMin(ev.start));
  const sig = r => r ? JSON.stringify([r.freq, r.interval || 1, r.until || '', (r.days || []).slice().sort()]) : '';

  let busy = false;
  EVT.reconcile = () => {
    const d = D();
    if (busy || !d || !Array.isArray(d.events) || !Array.isArray(d.tasks)) return false;
    busy = true; let ch = false;
    try {
      const keep = new Set();
      d.events.forEach(ev => {
        if (!ev.inTasks) return;
        const id = TID(ev.id); keep.add(id);
        const time = ev.allDay ? null : (ev.start || null);
        let t = d.tasks.find(x => x.id === id);
        if (!t) {
          t = M.newTask({ id, title: ev.title || 'Event', date: ev.date, time, allDay: !time, dur: dur(ev), eventId: ev.id, prio: 'B',
            repeat: ev.repeat ? U.clone(ev.repeat) : null, exdates: (ev.exdates || []).slice(), notes: ev.location ? '<p>📍 ' + U.esc(ev.location) + '</p>' : '',
            link: { k: 'event', id: ev.id }, linkTitle: ev.title || 'Event', linkDate: ev.date, linkTime: time || '' });
          t.num = M.nextNum(t.prio, t.date);
          d.tasks.push(t); ch = true; return;
        }
        // the task was moved in the planner (a one-off task): the event follows
        if (!ev.repeat && !t.repeat && U.isKey(t.date) && (t.date !== t.linkDate || (t.time || '') !== (t.linkTime || ''))) {
          const mins = dur(ev);
          ev.date = t.date;
          if (t.time) { ev.allDay = false; ev.start = t.time; ev.end = U.fromMin(Math.min(24 * 60 - 1, U.toMin(t.time) + mins)); }
          else if (t.linkTime) { ev.allDay = true; ev.start = null; ev.end = null; }
          ev.updatedAt = Date.now();
          t.linkDate = t.date; t.linkTime = t.time || ''; ch = true;
        }
        const tm = ev.allDay ? null : (ev.start || null);
        if (t.date !== ev.date) { t.date = ev.date; ch = true; }
        if ((t.time || null) !== tm) { t.time = tm; t.allDay = !tm; ch = true; }
        if (t.linkDate !== ev.date || (t.linkTime || '') !== (tm || '')) { t.linkDate = ev.date; t.linkTime = tm || ''; ch = true; }
        if (tm && t.dur !== dur(ev)) { t.dur = dur(ev); ch = true; }
        const title = ev.title || 'Event';
        if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
        if (sig(t.repeat) !== sig(ev.repeat)) { t.repeat = ev.repeat ? U.clone(ev.repeat) : null; ch = true; }
        const ex = (ev.exdates || []).slice().sort().join();
        if ((t.exdates || []).slice().sort().join() !== ex) { t.exdates = (ev.exdates || []).slice(); ch = true; }
        if (t.eventId !== ev.id) { t.eventId = ev.id; ch = true; }
      });
      // switched off, or the event is gone: an open task goes; a done one stays as an ordinary task
      const drop = [];
      d.tasks.forEach(t => {
        if (!t.link || t.link.k !== 'event' || keep.has(t.id)) return;
        const closed = t.repeat ? Object.values(t.occ || {}).some(o => o && o.st === 'done') : M.isClosed(t.status);
        if (closed) { delete t.link; delete t.linkTitle; delete t.linkDate; delete t.linkTime; if (!d.events.some(x => x.id === t.eventId)) t.eventId = null; }
        else drop.push(t.id);
        ch = true;
      });
      if (drop.length) d.tasks = d.tasks.filter(t => drop.indexOf(t.id) < 0);
    } finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => { if (type !== 'change' || (detail && detail.reason === 'evtask')) return; if (EVT.reconcile()) ED.store.commit({ reason: 'evtask' }); });
  setTimeout(() => { if (EVT.reconcile()) ED.store.commit({ reason: 'evtask' }); }, 0);

  /* deleting the task in the planner turns "Also in Daily tasks" off */
  const del0 = M.deleteTask;
  M.deleteTask = id => { const t = M.task(id); if (t && t.link && t.link.k === 'event') { const ev = M.event(t.link.id); if (ev) { ev.inTasks = false; ev.updatedAt = Date.now(); } } return del0(id); };

  EVT.isIn = ev => !!(ev && ev.inTasks && M.task(TID(ev.id)));
  EVT.set = (ev, on) => { if (!ev) return; ev.inTasks = !!on; ev.updatedAt = Date.now(); };

  /* a Google event: copy it into the Daily tasks once (the task remembers which event it came from) */
  EVT.gTask = g => D().tasks.find(t => t.gEvent === g.gid) || null;
  EVT.addGoogle = g => {
    const old = EVT.gTask(g); if (old) return old;
    const time = g.allDay ? null : (g.time || null);
    const t = M.addTask({ title: g.title || 'Event', date: g.date, time, allDay: !time, dur: !time || !g.endTime ? 30 : Math.max(5, U.toMin(g.endTime) - U.toMin(g.time)), prio: 'B',
      notes: '<p>From Google Calendar' + (g.location ? ' · 📍 ' + U.esc(g.location) : '') + '</p>' });
    t.gEvent = g.gid; t.link = { k: 'gevent', id: g.gid };
    return t;
  };
})();
