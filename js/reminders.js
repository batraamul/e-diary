/* E-Diary — task alarms and event reminders (while the diary is open) */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model;
  const S = () => ED.store.data.settings;
  const KEY = 'e-diary-fired-v1';
  let fired = U.lsGet(KEY, { day: '', keys: [] });
  let audio = null;

  const beep = () => {
    if (S().sound === false) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime;
      [0, 0.28, 0.56].forEach((d, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = i === 2 ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.25);
      });
    } catch (e) { /* audio is optional */ }
  };
  // browsers only allow sound after the first click
  document.addEventListener('pointerdown', function unlock() {
    document.removeEventListener('pointerdown', unlock);
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* ignore */ }
  });

  ED.reminders = {
    start() {
      this.check();
      setInterval(() => this.check(), 20000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.check(); });
    },

    fire(title, body, tag, onOpen) {
      beep();
      ED.ui.toast(title + (body ? ' — ' + body : ''), { icon: 'bell', timeout: 0, kind: 'alarm', action: onOpen ? 'Open' : null, onAction: onOpen });
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, { body: body || '', tag, icon: 'icons/icon-192.png', requireInteraction: true });
          n.onclick = () => { window.focus(); if (onOpen) onOpen(); n.close(); };
        } catch (e) {
          if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body: body || '', tag, icon: 'icons/icon-192.png' })).catch(() => {});
          }
        }
      }
    },

    check() {
      if (!ED.store.data || S().reminders === false) return;
      const today = U.today();
      // a new day: forget yesterday's reminders, except those rung late last night for something today (no second ring after midnight)
      if (fired.day !== today) fired = { day: today, keys: fired.day === U.addDays(today, -1) ? (fired.keys || []).filter(k => k.indexOf('@' + today) >= 0) : [] };
      const now = U.nowMin();
      const h12 = S().h12;
      const due = (at, key) => now >= at && now <= at + 20 && fired.keys.indexOf(key) < 0;
      const mark = key => { fired.keys.push(key); U.lsSet(KEY, fired); };
      const tomorrow = U.addDays(today, 1);

      const scan = (k, offsetDays) => {
        M.tasksOn(k, { carry: false }).forEach(o => {
          const t = o.t;
          if (!t.alarm || !t.time || !M.isPending(o.st)) return;
          const before = t.alarmBefore || 0;
          const at = U.toMin(t.time) + offsetDays * 1440 - before;
          const key = 't:' + t.id + '@' + k + ':' + before;
          if (at < -1440 || !due(Math.max(0, at), key)) return;
          mark(key);
          ED.reminders.fire(M.code(t) + ' ' + t.title, (k === today ? 'Today' : 'Tomorrow') + ' at ' + U.fmtTime(t.time, h12), key, () => ED.editors.task({ id: t.id, k }));
        });
        M.eventsOn(k).forEach(ev => {
          if (ev.reminder == null || ev.allDay || !ev.start) return;
          const at = U.toMin(ev.start) + offsetDays * 1440 - ev.reminder;
          const key = 'e:' + ev.id + '@' + k + ':' + ev.reminder;
          if (at < -1440 || !due(Math.max(0, at), key)) return;
          mark(key);
          ED.reminders.fire(ev.title, (k === today ? 'Today' : 'Tomorrow') + ' at ' + U.fmtTime(ev.start, h12) + (ev.location ? ' · ' + ev.location : ''), key, () => ED.editors.event({ id: ev.id, k }));
        });
      };
      scan(today, 0);
      scan(tomorrow, 1);
      // medicines (Health page) with "Remind me"
      if (ED.health && ED.health.remind) { try { ED.health.remind({ due, mark, fire: (a, b, c, d) => ED.reminders.fire(a, b, c, d) }); } catch (err) { console.warn('[e-diary] medicine reminder', err); } }
    },
  };
})();
