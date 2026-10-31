/* E-Diary — Health in the Daily planner (added in 1.17).
   • One "💊 Medicines due" task a day (today and the next six days) instead of one line per dose. Clicking it opens the
     Health page on that day's list; it ticks itself when every dose is marked Taken or Skipped, and ticking the task
     marks the doses still open as Taken. Switch: Health page → "One Medicines due task…" (health.dueTask === false = off).
   • Each doctor's appointment is a task on its date and time ("🩺 Doctor: …"); its "Next visit" date is a task too
     ("🩺 Next visit due: …") until an appointment is saved for that day. Clicking the first opens the appointment
     (with its calendar switch); clicking the second opens a new appointment filled in from the last one.
   Ids are fixed (tk-md-<date>, tk-ap-<visit>, tk-apn-<visit>) so two devices make the same tasks. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model;
  const A = (ED.actions = ED.actions || {});
  const D = () => ED.store.data;
  const H = () => D().health;
  const HP = (ED.healthPlan = {});
  const MDID = k => 'tk-md-' + k, APID = v => 'tk-ap-' + v.id, APNID = v => 'tk-apn-' + v.id;
  const fmtT = t => t ? U.fmtTime(t, D().settings.h12) : '';
  const role = () => ED.lifeRole ? ED.lifeRole(/health|fitness|medic/i, 'Health & Fitness', '💪', '#16a34a', null) : null;
  const cat = () => (D().categories.find(c => /health|medic|doctor/i.test(c.name || '')) || {}).id || null;

  /* the doses of a day, and how many are marked */
  HP.dayDoses = k => {
    const l = ED.health ? ED.health.doses(k) : [];
    return { l, n: l.length, marked: l.filter(x => x.st).length, sig: l.map(x => x.key + '=' + (x.st || '')).join('|') };
  };
  HP.title = (k, x) => {
    const times = x.l.map(y => y.t).filter((t, i, a) => a.indexOf(t) === i);
    return '💊 Medicines due — ' + U.plural(x.n, 'dose') + (times.length ? ' (' + times.map(fmtT).join(', ') + ')' : '');
  };

  let busy = false;
  HP.reconcile = () => {
    const d = D();
    if (busy || !d || !d.health || !Array.isArray(d.tasks) || !ED.health) return false;
    busy = true; let ch = false;
    try {
      const h = H(), today = U.today();
      if (!h.dueOff || typeof h.dueOff !== 'object') h.dueOff = {};
      /* ---------- medicines due ---------- */
      const on = h.dueTask !== false;
      const days = new Set();
      if (on) for (let i = 0; i < 7; i++) days.add(U.addDays(today, i));
      d.tasks.forEach(t => { if (t.link && t.link.k === 'meddue' && t.date) days.add(t.date); });
      let rid = null;
      days.forEach(k => {
        const id = MDID(k), x = HP.dayDoses(k);
        let t = d.tasks.find(y => y.id === id);
        if (!t) {
          if (!on || !x.n || h.dueOff[k] || k < today) return;
          const title = HP.title(k, x);
          t = M.newTask({ id, title, date: k, prio: 'A', roleId: rid || (rid = role()), categoryId: cat(), link: { k: 'meddue', id: k }, linkTitle: title, linkSt: 'open',
            notes: 'Click to open the Health page and tick each dose. Ticking this task marks the doses still open as Taken.' });
          t.noCarry = true; t.num = M.nextNum(t.prio, t.date);
          if (x.n && x.marked === x.n) { M.setStatus(t, k, 'done'); t.linkSt = 'done'; }
          d.tasks.push(t); ch = true; return;
        }
        // nothing to take that day any more (medicine stopped / deleted): an open task goes, a done one stays as history
        if (!x.n || !on && k >= today) {
          if (!M.isClosed(t.status) || !x.n) { d.tasks = d.tasks.filter(y => y.id !== id); ch = true; }
          return;
        }
        if (!t.noCarry) { t.noCarry = true; ch = true; }
        const title = HP.title(k, x);
        if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
        const done = M.isClosed(t.status), all = x.marked === x.n;
        if (done !== (t.linkSt === 'done')) {               // the task was ticked / unticked in the planner
          if (done) {
            x.l.forEach(y => { if (!y.st) ED.health.setDose(k, y.key, 'taken'); });
            t.mdHold = null;
          } else t.mdHold = HP.dayDoses(k).sig;                // reopened by hand: stay open until a dose changes
          t.linkSt = done ? 'done' : 'open'; ch = true;
          return;
        }
        if (all && !done && t.mdHold !== x.sig) { M.setStatus(t, k, 'done'); t.linkSt = 'done'; t.mdHold = null; ch = true; }
        else if (!all && done) { M.setStatus(t, k, 'open'); t.linkSt = 'open'; ch = true; }
      });

      /* ---------- doctor's appointments ---------- */
      const visits = Array.isArray(h.visits) ? h.visits : [];
      const live = new Set();
      visits.forEach(v => {
        if (!v || !U.isKey(v.date) || v.noTask) return;
        // the appointment itself
        const id = APID(v); live.add(id);
        const title = '🩺 Doctor: ' + (v.doctor || 'appointment') + (v.place ? ' — ' + v.place : '') + (v.purpose ? ' · ' + v.purpose : '');
        const notes = [v.time ? 'At ' + fmtT(v.time) : '', v.place ? 'Where: ' + v.place : '', v.purpose ? 'For: ' + v.purpose : '', 'Click to open the appointment (and its calendar switch).'].filter(Boolean).join('\n');
        let t = d.tasks.find(y => y.id === id);
        if (!t) {
          t = M.newTask({ id, title, date: v.date, time: v.time || null, prio: 'A', roleId: rid || (rid = role()), categoryId: cat(), link: { k: 'visit', id: v.id }, linkTitle: title, linkDate: v.date, notes });
          t.noCarry = true; t.num = M.nextNum(t.prio, t.date);
          if (v.date < today) M.setStatus(t, v.date, 'done');      // a visit already over when the task is made
          d.tasks.push(t); ch = true;
        } else {
          // moved in the planner → the appointment (and its calendar entry) moves too; changed on the Health page → the task follows
          if (t.date !== t.linkDate && U.isKey(t.date)) {
            if (v.date !== t.date) { v.date = t.date; v.updatedAt = Date.now(); if (v.eventId && ED.fx) ED.fx.linkEvent(v, { on: true, title: 'Doctor: ' + v.doctor, date: v.date, time: v.time, mins: 45, location: v.place, notes: v.purpose, reminder: 60, color: '#2e7d32' }); }
            t.linkDate = t.date; ch = true;
          } else if (t.date !== v.date) { t.date = v.date; t.linkDate = v.date; ch = true; }
          if ((t.time || null) !== (v.time || null) && !M.isClosed(t.status)) { t.time = v.time || null; ch = true; }
          if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
          if (t.notes !== notes && t.linkNotes !== notes && (!t.notes || t.notes === t.linkNotes)) { t.notes = notes; ch = true; }
          if (t.linkNotes !== notes) { t.linkNotes = notes; ch = true; }
        }
        // the next visit, until an appointment is saved for that day
        if (!U.isKey(v.next) || v.next < v.date || v.noNextTask) return;
        const booked = visits.some(w => w !== v && w.date === v.next);
        if (booked) return;
        const nid = APNID(v); live.add(nid);
        const ntitle = '🩺 Next visit due: ' + (v.doctor || 'doctor') + (v.place ? ' — ' + v.place : '');
        let n = d.tasks.find(y => y.id === nid);
        if (!n) {
          n = M.newTask({ id: nid, title: ntitle, date: v.next, prio: 'A', roleId: rid || (rid = role()), categoryId: cat(), link: { k: 'visitnext', id: v.id }, linkTitle: ntitle, linkDate: v.next,
            notes: 'The next visit noted on your appointment of ' + U.fmtDM(v.date) + (v.outcome ? '.\n' + v.outcome : '.') + '\nClick to book it: the appointment form opens filled in.' });
          n.noCarry = true; n.num = M.nextNum(n.prio, n.date); d.tasks.push(n); ch = true;
        } else {
          if (n.date !== n.linkDate && U.isKey(n.date)) { if (v.next !== n.date) { v.next = n.date; v.updatedAt = Date.now(); } n.linkDate = n.date; ch = true; }
          else if (n.date !== v.next) { n.date = v.next; n.linkDate = v.next; ch = true; }
          if (n.linkTitle !== ntitle) { if (n.title === n.linkTitle) n.title = ntitle; n.linkTitle = ntitle; ch = true; }
        }
      });
      // an appointment deleted takes its tasks with it; "not in daily tasks" or a next visit now booked takes the open ones out
      const ids = new Set(visits.map(v => v.id)), before = d.tasks.length;
      d.tasks = d.tasks.filter(t => {
        if (!t.link || (t.link.k !== 'visit' && t.link.k !== 'visitnext') || live.has(t.id)) return true;
        if (!ids.has(t.link.id)) return false;
        return M.isClosed(t.status);
      });
      if (d.tasks.length !== before) ch = true;
    } catch (err) { console.warn('[e-diary] health plan', err); }
    finally { busy = false; }
    return ch;
  };

  ED.store.on((type, detail) => {
    if (type !== 'change' || (detail && detail.reason === 'healthplan')) return;
    if (HP.reconcile()) ED.store.commit({ reason: 'healthplan' });
  });
  setTimeout(() => { if (HP.reconcile()) ED.store.commit({ reason: 'healthplan' }); }, 0);
  // a new day: make the day's task without waiting for a change
  let lastDay = U.today();
  setInterval(() => { const k = U.today(); if (k !== lastDay) { lastDay = k; if (HP.reconcile()) ED.store.commit({ reason: 'healthplan' }); } }, 60e3);

  // deleting one of these tasks keeps it out of the planner (the medicines and appointment stay)
  const del0 = M.deleteTask;
  M.deleteTask = id => {
    const t = M.task(id), h = H();
    if (t && t.link && h) {
      if (t.link.k === 'meddue') { if (!h.dueOff || typeof h.dueOff !== 'object') h.dueOff = {}; h.dueOff[t.date] = true; }
      const v = (t.link.k === 'visit' || t.link.k === 'visitnext') && (h.visits || []).find(x => x.id === t.link.id);
      if (v && t.link.k === 'visit') { v.noTask = true; v.updatedAt = Date.now(); }
      if (v && t.link.k === 'visitnext') { v.noNextTask = true; v.updatedAt = Date.now(); }
    }
    return del0(id);
  };

  // clicking the task: the day's medicines, the appointment, or a new appointment for the next visit
  HP.openDue = k => { (ED.state.hl = ED.state.hl || {}).day = k; ED.go.tab('health'); };
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI.occFrom(el), l = o && o.t.link, h = H();
    if (l && l.k === 'meddue') { HP.openDue(o.t.date); return; }
    const v = l && h && (l.k === 'visit' || l.k === 'visitnext') && (h.visits || []).find(x => x.id === l.id);
    if (v && l.k === 'visit') { ED.health.editVisit(v.id); return; }
    if (v && l.k === 'visitnext') { ED.health.editVisit(null, { date: v.next, time: v.time || '10:00', doctor: v.doctor || '', place: v.place || '', purpose: 'Follow-up' + (v.purpose ? ': ' + v.purpose : ''), from: v.date }); return; }
    return open0 && open0(el, ev);
  };
})();
