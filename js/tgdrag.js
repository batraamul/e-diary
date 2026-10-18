/* E-Diary — drag to move and drag to resize items on the hourly timelines (Daily page and calendar panel).
   Works with mouse, pen and touch (on touch, press and hold for a moment, then drag).
   Drop on:  another time        -> new start time (15-minute steps)
             the all-day strip   -> becomes an all-day task / event
             a day (mini calendar, month cell, a task list) -> moves to that day, keeps its time
             Master Tasks        -> task loses its date
   The small bar at the bottom edge of an item changes its length. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model;
  const S = () => ED.store.data.settings;
  const HOUR = ED.calpanel.HOUR;
  const SNAP = 15;
  const snap = m => Math.round(m / SNAP) * SNAP;

  let st = null;

  const minAt = (col, y) => (y - col.getBoundingClientRect().top) / HOUR * 60;
  const zoneAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('[data-drop]') : null;
  };
  const clearHover = () => U.$$('.drop-hover').forEach(z => z.classList.remove('drop-hover'));

  function down(ev) {
    if (st || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const item = ev.target.closest && ev.target.closest('.tg-item[data-tg]');
    if (!item) return;
    const col = item.closest('[data-drop="time"]');
    if (!col) return;
    const a = +item.dataset.a, b = +item.dataset.b;
    st = {
      item, col, home: col, kind: item.dataset.tg, resize: !!ev.target.closest('.tg-rs'),
      pid: ev.pointerId, touch: ev.pointerType === 'touch', x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY,
      a, len: Math.max(SNAP, b - a), grab: minAt(col, ev.clientY) - a, started: false, start: a, dur: b - a, zone: null,
      style: item.getAttribute('style'),
    };
    if (st.touch) st.hold = setTimeout(() => { if (st && !st.started) begin(); }, 380);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
  }

  function begin() {
    st.started = true;
    st.item.classList.add('tg-dragging');
    if (st.resize) st.item.classList.add('tg-resizing');
    st.item.style.left = '2px'; st.item.style.width = 'calc(100% - 4px)'; st.item.style.zIndex = '20';
    st.item.style.pointerEvents = 'none';
    document.body.classList.add('tg-drag-on');
    st.scroller = st.col.closest('.scroll');
    if (st.touch && navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* ignore */ } }
    tick();
  }

  function move(ev) {
    if (!st || ev.pointerId !== st.pid) return;
    st.x = ev.clientX; st.y = ev.clientY;
    if (!st.started) {
      const d = Math.hypot(st.x - st.x0, st.y - st.y0);
      if (st.touch) { if (d > 8) stop(); return; }   // a swipe scrolls the page instead
      if (d < 5) return;
      begin();
    }
    ev.preventDefault();
    update();
  }

  function update() {
    const h12 = S().h12;
    clearHover();
    if (st.resize) {
      const end = Math.min(24 * 60, Math.max(st.a + SNAP, snap(minAt(st.col, st.y))));
      st.dur = end - st.a;
      st.item.style.height = Math.max(18, st.dur / 60 * HOUR - 2) + 'px';
      label(U.fmtTime(U.fromMin(st.a), h12) + ' – ' + U.fmtTime(U.fromMin(end % (24 * 60)), h12) + ' · ' + durText(st.dur));
      st.zone = st.col;
      return;
    }
    const z = zoneAt(st.x, st.y);
    st.zone = z;
    if (z && z.dataset.drop === 'time') {
      if (z !== st.col) { z.appendChild(st.item); st.col = z; }
      st.start = U.clamp(snap(minAt(st.col, st.y) - st.grab), 0, 24 * 60 - SNAP);
      st.item.style.top = (st.start / 60 * HOUR) + 'px';
      st.item.classList.remove('tg-out');
      const d = st.col.dataset.date;
      label((d !== st.home.dataset.date ? U.fmtDM(d) + ', ' : '') + U.fmtTime(U.fromMin(st.start), h12) + ' – ' + U.fmtTime(U.fromMin(Math.min(24 * 60 - 1, st.start + st.len)), h12));
    } else {
      st.item.classList.add('tg-out');
      if (z && (z.dataset.drop !== 'master' || st.kind === 'task')) z.classList.add('drop-hover');
      label(z ? (z.dataset.drop === 'allday' ? 'All day' : z.dataset.drop === 'master' ? 'Master Tasks' : U.fmtDM(z.dataset.date || U.today())) : 'Drop to cancel');
    }
  }

  function label(text) {
    const w = st.item.querySelector('.tg-when');
    if (w) w.textContent = text;
  }
  const durText = m => m < 60 ? m + ' min' : (m % 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m / 60 + ' h');

  /* scroll the timeline while dragging near its top or bottom edge */
  function tick() {
    if (!st || !st.started) return;
    const sc = st.scroller;
    if (sc) {
      const r = sc.getBoundingClientRect();
      let dy = 0;
      if (st.y < r.top + 36 && st.y > r.top - 60) dy = -Math.ceil((r.top + 36 - st.y) / 4);
      else if (st.y > r.bottom - 36 && st.y < r.bottom + 60) dy = Math.ceil((st.y - (r.bottom - 36)) / 4);
      if (dy) { const before = sc.scrollTop; sc.scrollTop += dy; if (sc.scrollTop !== before) update(); }
    }
    requestAnimationFrame(tick);
  }

  function up(ev) {
    if (!st || ev.pointerId !== st.pid) return;
    const s = st;
    if (!s.started) { stop(); return; }
    // the click that follows a drag must not open the editor
    const swallow = e2 => { e2.stopPropagation(); e2.preventDefault(); };
    window.addEventListener('click', swallow, true);
    setTimeout(() => window.removeEventListener('click', swallow, true), 0);
    const z = s.resize ? s.col : zoneAt(ev.clientX, ev.clientY);
    stop();
    try { commit(s, z); } catch (err) { console.error(err); ED.app.render(); }
  }

  function cancel() { if (st && st.started) { stop(); ED.app.render(); } else stop(); }

  function stop() {
    if (!st) return;
    clearTimeout(st.hold);
    clearHover();
    document.body.classList.remove('tg-drag-on');
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', cancel, true);
    st = null;
  }

  /* touch: once a hold-drag has begun, stop the page from scrolling */
  document.addEventListener('touchmove', ev => { if (st && st.started) ev.preventDefault(); }, { passive: false });
  document.addEventListener('pointerdown', down);

  /* ---------------- apply the drop ---------------- */
  const cal = key => { if (ED.gcal && ED.gcal.afterDrop) ED.gcal.afterDrop(key); };
  function commit(s, z) {
    const h12 = S().h12;
    const k = s.home.dataset.date;
    if (!z) { ED.app.render(); return; }
    const kind = z.dataset.drop;
    const date = z.dataset.date || null;
    const time = U.fromMin(s.start);

    if (s.kind === 'task') {
      const t = M.task(s.item.dataset.tid); if (!t) return ED.app.render();
      const o = M.occ(t, s.item.dataset.k || k);
      if (s.resize) {
        if (s.dur === (t.dur || 30)) return ED.app.render();
        ED.store.checkpoint('Change length');
        if (t.repeat) {
          const x = M.detach(t, o.k, o.k); x.dur = s.dur;
          ED.store.commit();
          ED.ui.toast('This day now lasts ' + durText(s.dur), { action: 'Every day', onAction: () => { ED.store.undo(); const y = M.task(t.id); if (y) { y.dur = s.dur; y.updatedAt = Date.now(); ED.store.commit(); ED.ui.toast('Every day now lasts ' + durText(s.dur)); } } });
        } else { t.dur = s.dur; t.updatedAt = Date.now(); ED.store.commit(); ED.ui.undoToast('Now ' + durText(s.dur)); cal('t:' + t.id); }
        return;
      }
      if (kind === 'time') {
        if (date === o.k && time === t.time) return ED.app.render();
        ED.store.checkpoint('Move');
        const nt = M.moveOcc(o, date, time);
        ED.store.commit();
        if (t.repeat && date === o.k) {
          ED.ui.toast('This day moved to ' + U.fmtTime(time, h12), { action: 'Every day', onAction: () => { ED.store.undo(); const y = M.task(t.id); if (y) { y.time = time; y.allDay = false; y.updatedAt = Date.now(); ED.store.commit(); ED.ui.toast('Every day now at ' + U.fmtTime(time, h12)); } } });
        } else ED.ui.undoToast('Moved to ' + (nt.date === o.k ? '' : U.relDay(nt.date) + ' ') + U.fmtTime(time, h12));
        cal('t:' + nt.id);
        return;
      }
      if (kind === 'allday' && date) {
        ED.store.checkpoint('Move');
        const nt = M.moveOcc(o, date, null, true);
        ED.store.commit(); ED.ui.undoToast('“' + nt.title + '” is now an all-day task on ' + U.relDay(nt.date));
        cal('t:' + nt.id);
        return;
      }
      if (kind === 'master') {
        if (t.repeat) { ED.ui.toast('Repeating tasks need a date. Turn off repeat first.'); return ED.app.render(); }
        ED.store.checkpoint('Move'); M.moveOcc(o, null); ED.store.commit(); ED.ui.undoToast('Moved to Master Tasks'); return;
      }
      if (kind === 'day' && date) {
        if (date === o.k) return ED.app.render();
        ED.store.checkpoint('Move'); const nt = M.moveOcc(o, date); ED.store.commit();
        ED.ui.undoToast('Moved to ' + U.relDay(nt.date)); cal('t:' + nt.id); return;
      }
      return ED.app.render();
    }

    if (s.kind === 'event') {
      const x = M.event(s.item.dataset.id); if (!x) return ED.app.render();
      let patch = null;
      if (s.resize) { if (s.dur === s.len) return ED.app.render(); patch = { end: U.fromMin(Math.min(24 * 60 - 1, s.a + s.dur)) }; }
      else if (kind === 'time') { if (date === k && s.start === s.a) return ED.app.render(); patch = { date, start: time, len: s.len }; }
      else if (kind === 'allday' && date) patch = { date, allDay: true };
      else if (kind === 'day' && date && date !== k) patch = { date };
      if (!patch) return ED.app.render();
      ED.store.checkpoint('Move event');
      const nx = M.moveEvent(x, k, patch);
      ED.store.commit();
      ED.ui.undoToast((x.repeat ? 'This day of “' + x.title + '”: ' : '') + (nx.allDay ? 'all day, ' + U.relDay(nx.date) : U.relDay(nx.date) + ', ' + U.fmtTime(nx.start, h12) + (nx.end ? ' – ' + U.fmtTime(nx.end, h12) : '')));
      cal('e:' + nx.id);
      return;
    }

    if (s.kind === 'study' && ED.study) {
      const id = s.item.dataset.sid;
      if (s.resize) { ED.study.patchSession(id, { min: s.dur }, 'Session now ' + durText(s.dur)); cal('s:' + id); return; }
      if (kind === 'time') { ED.study.patchSession(id, { date, time }, 'Study session moved to ' + (date !== k ? U.relDay(date) + ' ' : '') + U.fmtTime(time, h12)); cal('s:' + id); return; }
      if (kind === 'day' && date && date !== k) { ED.study.patchSession(id, { date }, 'Study session moved to ' + U.relDay(date)); cal('s:' + id); return; }
      return ED.app.render();
    }
    ED.app.render();
  }

  ED.tgdrag = { active: () => !!(st && st.started) };
})();
