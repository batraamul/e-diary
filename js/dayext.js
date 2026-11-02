/* E-Diary — the day's mood, and cancelling with a reason (added in 1.20).
   • Mood: a row of moods on the Daily page (😊 Happy, 🤩 Happiest day, 🤔 Thinking, 🤒 Sick, 😑 Dull, 🥳 Excited, 🏃 Busy day
     — your own list in Settings → General). One click sets the day's mood (click again to clear); the month's moods show
     beside it. Data: ED.store.data.moods = { 'YYYY-MM-DD': { m: label, e: emoji, at } }.
   • Cancel with a reason: choosing "Cancelled" for a task (⋯ menu) asks why — Off day, Sick, Travelling… (your own list in
     Settings → General) or your own words. For a repeating task only that day is cancelled. The reason shows on the task.
     "Day off…" on the Daily page cancels all of the day's open tasks with one reason.
     Data: a task's cancelReason, or occ[date].reason for a repeating task. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const A = (ED.actions = ED.actions || {});
  const D = () => ED.store.data;
  const S = () => D().settings;
  const DX = (ED.dayExt = {});
  const DEF_MOODS = [['😊', 'Happy'], ['🤩', 'Happiest day'], ['🤔', 'Thinking'], ['🤒', 'Sick'], ['😑', 'Dull'], ['🥳', 'Excited'], ['🏃', 'Busy day']];
  const DEF_REASONS = ['Off day', 'Sick', 'Travelling', 'Holiday', 'Family function', 'Office work', 'Bad weather', 'Not needed any more'];

  DX.moods = () => { const l = S().moods; return Array.isArray(l) && l.length ? l.map(x => Array.isArray(x) ? x : [x.e, x.l]) : DEF_MOODS; };
  DX.reasons = () => { const l = S().cancelReasons; return Array.isArray(l) && l.length ? l : DEF_REASONS; };
  const MD = () => { const d = D(); if (!d.moods || typeof d.moods !== 'object' || Array.isArray(d.moods)) d.moods = {}; return d.moods; };
  DX.moodOn = k => MD()[k] || null;

  /* ---------------- the Daily page strip ---------------- */
  DX.strip = k => {
    const cur = DX.moodOn(k);
    const [y, mo] = U.ymd(k), days = U.daysInMonth(y, mo - 1), month = [];
    for (let i = 1; i <= days; i++) { const dk = y + '-' + U.pad(mo) + '-' + U.pad(i); const m = MD()[dk]; if (m) month.push(m); }
    const count = {}; month.forEach(m => { count[m.e + ' ' + m.m] = (count[m.e + ' ' + m.m] || 0) + 1; });
    const summary = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 4).map(x => x.split(' ')[0] + '×' + count[x]).join(' ');
    return '<div class="dx-strip"><span class="dx-l">Mood</span><span class="dx-moods" role="group" aria-label="Mood of the day">' +
      DX.moods().map(([em, lb]) => '<button type="button" class="dx-mood' + (cur && cur.m === lb ? ' on' : '') + '" data-act="dx-mood" data-k="' + k + '" data-e="' + e(em) + '" data-l="' + e(lb) + '" title="' + e(lb) + '" aria-pressed="' + !!(cur && cur.m === lb) + '"><span aria-hidden="true">' + e(em) + '</span><span class="dx-ml">' + e(lb) + '</span></button>').join('') + '</span>' +
      (summary ? '<span class="hint dx-sum" title="Moods this month">' + e(U.MON[mo - 1]) + ': ' + e(summary) + '</span>' : '') +
      '<button type="button" class="btn small ghost dx-off" data-act="dx-dayoff" data-k="' + k + '" title="Cancel all of this day’s open tasks, with a reason">' + ED.icon('xCircle') + 'Day off…</button></div>';
  };

  /* 1.20.1: the mood card at the top of Habits — round emoji buttons with their names, the chosen one lit up */
  DX.card = k => {
    const cur = DX.moodOn(k), today = U.today();
    const [y, mo] = U.ymd(k), days = U.daysInMonth(y, mo - 1), count = {};
    for (let i = 1; i <= days; i++) { const m = MD()[y + '-' + U.pad(mo) + '-' + U.pad(i)]; if (m) count[m.e] = (count[m.e] || 0) + 1; }
    const sum = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 5);
    return '<div class="mood-card' + (cur ? ' set' : '') + '"><div class="mood-h"><span class="mood-q">' + (cur ? '<span class="mood-now" aria-hidden="true">' + e(cur.e) + '</span>' + e(cur.m) : (k === today ? 'How is your day?' : 'How was the day?')) + '</span>' +
      (sum.length ? '<span class="mood-sum" title="Moods this month">' + sum.map(x => '<span>' + e(x) + '<sub>' + count[x] + '</sub></span>').join('') + '</span>' : '') +
      '<button type="button" class="mood-off" data-act="dx-dayoff" data-k="' + k + '" title="Cancel all of this day’s open tasks, with a reason">' + ED.icon('xCircle') + 'Day off</button></div>' +
      '<div class="mood-row" role="group" aria-label="Mood of the day">' + DX.moods().map(([em, lb]) => { const on = cur && cur.m === lb; return '<button type="button" class="mood-b' + (on ? ' on' : '') + '" data-act="dx-mood" data-k="' + k + '" data-e="' + e(em) + '" data-l="' + e(lb) + '" aria-pressed="' + !!on + '" title="' + e(lb) + '"><span class="mood-e" aria-hidden="true">' + e(em) + '</span><span class="mood-l">' + e(lb) + '</span></button>'; }).join('') + '</div></div>';
  };

  /* ---------------- cancelling with a reason ---------------- */
  DX.askReason = (title, cur) => new Promise(resolve => {
    let out = null;
    ED.ui.modal({
      title, cls: 'small',
      body: '<div class="dx-rs">' + DX.reasons().map(r => '<button type="button" class="rs-chip' + (cur === r ? ' on' : '') + '" data-r="' + e(r) + '">' + e(r) + '</button>').join('') + '</div>' +
        '<label class="lbl" for="dx-other">Or in your own words</label><input id="dx-other" class="field" placeholder="Reason (optional)" value="' + e(cur && DX.reasons().indexOf(cur) < 0 ? cur : '') + '">' +
        '<p class="hint">Change the list in Settings → General.</p>',
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Keep it</button><button type="button" class="btn danger solid" data-x="ok">Cancel the task</button>',
      onMount(el, api) {
        el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { out = b.dataset.r; api.close(); }));
        el.querySelector('[data-x="ok"]').addEventListener('click', () => { out = el.querySelector('#dx-other').value.trim() || ''; api.close(); });
        el.querySelector('#dx-other').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); out = ev.target.value.trim(); api.close(); } });
      },
      onClose() { resolve(out); },
    });
  });
  DX.setReason = (o, reason) => {
    const t = o.t;
    if (t.repeat) { t.occ = t.occ || {}; if (t.occ[o.k]) { if (reason) t.occ[o.k].reason = reason; else delete t.occ[o.k].reason; } }
    else if (reason) t.cancelReason = reason; else delete t.cancelReason;
  };
  DX.reasonOf = o => o.t.repeat ? ((o.t.occ || {})[o.k] || {}).reason || '' : o.t.cancelReason || '';
  DX.cancel = async o => {
    const r = await DX.askReason('Cancel “' + (o.t.title || 'task') + '”' + (o.t.repeat ? ' for ' + U.fmtShort(o.k) : ''), DX.reasonOf(o));
    if (r == null) return;
    ED.store.checkpoint('Cancel');
    M.setOccStatus(o, 'cancelled'); DX.setReason(o, r);
    ED.store.commit(); ED.ui.undoToast('Cancelled' + (r ? ' — ' + r : ''));
  };
  /* reopened or done again: the reason goes */
  const set0 = M.setStatus;
  M.setStatus = (t, k, st) => { set0(t, k, st); if (st !== 'cancelled' && !t.repeat && t.cancelReason) delete t.cancelReason; };

  /* ---------------- settings (General) ---------------- */
  DX.settingsHtml = () => '<h3 class="set-h">Daily page: mood and cancel reasons</h3>' +
    '<div class="set-grid"><div class="set-row"><label class="lbl" for="sg-moods">Moods <span class="hint">one per line: emoji and name</span></label><textarea id="sg-moods" class="field" rows="7">' + e(DX.moods().map(x => x[0] + ' ' + x[1]).join('\n')) + '</textarea></div>' +
    '<div class="set-row"><label class="lbl" for="sg-reasons">Reasons for cancelling <span class="hint">one per line</span></label><textarea id="sg-reasons" class="field" rows="7">' + e(DX.reasons().join('\n')) + '</textarea></div></div>' +
    '<div class="set-row"><label class="switch"><input id="sg-moodon" type="checkbox"' + (S().moodStrip !== false ? ' checked' : '') + '><span class="track"></span><span>Show “How is your day?” (mood) under Habits on the Daily page</span></label></div>';
  DX.bindSettings = b => {
    const m = b.querySelector('#sg-moods'), r = b.querySelector('#sg-reasons'), on = b.querySelector('#sg-moodon');
    if (m) m.addEventListener('change', () => {
      const l = m.value.split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => { const mm = x.match(/^(\S+)\s+(.+)$/); return mm && !/^[A-Za-z0-9]/.test(mm[1]) ? [mm[1], mm[2].trim()] : ['•', x]; });
      S().moods = l.length ? l : null; ED.store.commit(); ED.ui.toast('Moods saved');
    });
    if (r) r.addEventListener('change', () => { const l = r.value.split(/\n+/).map(x => x.trim()).filter(Boolean); S().cancelReasons = l.length ? l : null; ED.store.commit(); ED.ui.toast('Reasons saved'); });
    if (on) on.addEventListener('change', () => { S().moodStrip = on.checked; ED.store.commit(); });
  };

  /* ---------------- actions ---------------- */
  A['dx-mood'] = el => {
    const k = el.dataset.k, md = MD(), cur = md[k];
    ED.store.checkpoint('Mood');
    if (cur && cur.m === el.dataset.l) delete md[k]; else md[k] = { m: el.dataset.l, e: el.dataset.e, at: Date.now() };
    ED.store.commit();
  };
  A['dx-dayoff'] = async el => {
    const k = el.dataset.k, open = M.tasksOn(k).filter(o => M.isPending(o.st) && !o.carried);
    if (!open.length) { ED.ui.toast('No open tasks on this day'); return; }
    const r = await DX.askReason('Day off — cancel ' + U.plural(open.length, 'open task') + ' on ' + U.fmtShort(k), '');
    if (r == null) return;
    ED.store.checkpoint('Day off');
    open.forEach(o => { M.setOccStatus(o, 'cancelled'); DX.setReason(o, r); });
    if (!MD()[k] && /sick|ill/i.test(r)) { const s = DX.moods().find(x => /sick/i.test(x[1])); if (s) MD()[k] = { m: s[1], e: s[0], at: Date.now() }; }
    ED.store.commit(); ED.ui.undoToast(U.plural(open.length, 'task') + ' cancelled' + (r ? ' — ' + r : ''));
  };
})();
