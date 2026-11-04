/* E-Diary — 1.23: Study → Adjust the plan — the common changes in one place, in plain words, each with a preview of
   what will change before you apply it (and Undo right after). Ticked sessions are never moved or deleted.
     • Catch up      — sessions left from earlier days: fit them into the coming days, push the rest of the plan later,
                       or let them go.
     • Days off      — travel, exams, illness: push everything from that day later, or drop those days' sessions.
     • Add a subject — a new (or existing) subject on chosen weekdays, slot or time, minutes, from a date to a date.
     • Drop or pause a subject — from a date: drop its open sessions, or pause it until a date (they move later).
     • Change a subject — its minutes and/or its start time from a date.
     • Lighter or heavier — every open session from a date: minutes up or down by a percentage.
   The older tools (Change many sessions, weeks, start date, plan settings) stay in the Plan menu and are linked here. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const ST = ED.study;
  const A = (ED.actions = ED.actions || {});
  const SA = (ED.studyAdjust = {});
  const D = () => ED.store.data;
  const o = (v, l, s) => '<option value="' + e(v) + '"' + (s ? ' selected' : '') + '>' + e(l) + '</option>';
  const fm = m => ST.fmtMin(m);
  const DAYS = [1, 2, 3, 4, 5, 6, 0];
  const CHOICES = [
    ['catch', '⏳', 'Catch up', 'Sessions left from earlier days'],
    ['gap', '⏪', 'Close a gap', 'Empty days? Pull later sessions back'],
    ['off', '🏖️', 'Days off', 'Travel, exams, illness, festivals'],
    ['add', '➕', 'Add a subject', 'New subject, or more of one'],
    ['drop', '⏸️', 'Drop or pause a subject', 'Stop it, or stop it for a while'],
    ['change', '✏️', 'Change a subject', 'Its minutes or its time'],
    ['load', '⚖️', 'Lighter or heavier', 'All sessions shorter or longer'],
  ];
  SA.missed = () => { const t = U.today(), sp = ST.span() || {}; return ST.sessions().filter(s => !s.done && s.date < t && (!sp.a || s.date >= sp.a)).sort((a, b) => a.date.localeCompare(b.date) || (a.slotNo || 0) - (b.slotNo || 0)); };
  const open = from => ST.sessions().filter(s => !s.done && s.date >= from);
  const days = (a, b) => U.range(a, Math.max(0, U.diffDays(a, b)) + 1);
  const wk = n => Math.ceil(n / 7) * 7;
  /* 1.24: the first stretch of 2+ days with nothing planned, from a day on, that has open sessions after it */
  SA.gap = from => {
    const l = ST.sessions(); if (!l.length) return null;
    const has = new Set(l.map(s => s.date)), last = l.reduce((m, s) => s.date > m ? s.date : m, l[0].date);
    let k = from, guard = 0;
    while (k <= last && guard++ < 1500) {
      if (!has.has(k)) { let b = k; while (!has.has(U.addDays(b, 1)) && b < last) b = U.addDays(b, 1);
        const n = U.diffDays(k, b) + 1, next = U.addDays(b, 1);
        if (n >= 2 && l.some(s => !s.done && s.date >= next)) return { a: k, b, n, next };
        k = U.addDays(b, 1); }
      else k = U.addDays(k, 1);
    }
    return null;
  };

  /* work out the change (nothing is written here): { moves: [[s, date]], dels: [s], mins: [[s, min]], times: [[s, time]], adds: [session], msg } */
  SA.plan = (kind, v) => {
    const out = { moves: [], dels: [], mins: [], times: [], adds: [], msg: '' }, t = U.today(), p = ST.plan();
    if (kind === 'catch') {
      const l = SA.missed(); if (!l.length) { out.msg = 'Nothing left from earlier days — you are up to date. 🎉'; return out; }
      if (v.how === 'drop') { out.dels = l; out.msg = U.plural(l.length, 'session') + ' (' + fm(l.reduce((a, s) => a + s.min, 0)) + ') from earlier days will be removed.'; }
      else if (v.how === 'push') {
        let n = U.diffDays(l[0].date, v.start || t); if (v.keep) n = wk(n);
        open(l[0].date).forEach(s => out.moves.push([s, U.addDays(s.date, n)]));
        out.msg = U.plural(out.moves.length, 'open session') + ' from ' + U.fmtShort(l[0].date) + ' on move ' + U.plural(n, 'day') + ' later — the plan ends ' + U.plural(n, 'day') + ' later.';
      } else {
        const per = Math.max(1, +v.per || 1); let k = v.start || t, used = 0;
        l.forEach(s => { if (used >= per) { k = U.addDays(k, 1); used = 0; } out.moves.push([s, k]); used++; });
        out.msg = U.plural(l.length, 'session') + ' go into the coming days, ' + per + ' extra a day — the last on ' + U.fmtShort(k) + '. The rest of the plan stays where it is.';
      }
    }
    if (kind === 'gap') {
      const g = U.isKey(v.a) && U.isKey(v.next) && v.next > v.a ? { a: v.a, next: v.next, n: U.diffDays(v.a, v.next) } : SA.gap(v.from || t);
      if (!g) { out.msg = 'No empty stretch found — every day ahead has sessions.'; return out; }
      let n = g.n; if (v.keep) n = Math.floor(n / 7) * 7;
      if (n <= 0) { out.msg = 'The gap is shorter than a week — switch off “keep weekdays” to close it.'; return out; }
      open(g.next).forEach(s => out.moves.push([s, U.addDays(s.date, -n)]));
      out.msg = 'Nothing is planned from ' + U.fmtShort(g.a) + ' to ' + U.fmtShort(U.addDays(g.next, -1)) + ' (' + U.plural(g.n, 'day') + '). ' + U.plural(out.moves.length, 'open session') + ' from ' + U.fmtShort(g.next) + ' on move ' + U.plural(n, 'day') + ' earlier, so they start on ' + U.fmtShort(U.addDays(g.next, -n)) + '.';
      return out;
    }
    if (kind === 'off') {
      const a = v.from, b = v.to; if (!U.isKey(a) || !U.isKey(b) || b < a) { out.msg = 'Choose the first and the last day off.'; return out; }
      const inside = open(a).filter(s => s.date <= b);
      if (v.how === 'drop') { out.dels = inside; out.msg = U.plural(inside.length, 'session') + ' on those days will be removed; the rest stays.'; }
      else { let n = U.diffDays(a, b) + 1; if (v.keep) n = wk(n); open(a).forEach(s => out.moves.push([s, U.addDays(s.date, n)])); out.msg = U.plural(out.moves.length, 'open session') + ' from ' + U.fmtShort(a) + ' on move ' + U.plural(n, 'day') + ' later (' + U.plural(inside.length, 'session') + ' fell on the days off).'; }
    }
    if (kind === 'add') {
      const a = v.from, b = v.to; if (!U.isKey(a) || !U.isKey(b) || b < a) { out.msg = 'Choose from and to dates.'; return out; }
      if (!v.track && !String(v.name || '').trim()) { out.msg = 'Pick a subject or type the new one’s name.'; return out; }
      if (!v.days.length) { out.msg = 'Tick at least one weekday.'; return out; }
      const tr = v.track || '__new', slot = ST.slot(+v.slot) || null;
      days(a, b).filter(k => v.days.indexOf(U.dow(k)) >= 0).forEach(k => {
        if (tr !== '__new' && ST.on(k).some(s => s.trackId === tr && (s.slotNo || 1) === (+v.slot || 1))) return;   // already there
        out.adds.push({ id: U.uid('ss'), week: 0, date: k, slotNo: +v.slot || 1, kind: '', slot: ST.slotText(+v.slot || 1, ''), trackId: tr, min: Math.max(5, +v.min || (slot && slot.min) || 60), topic: String(v.topic || '').trim(), sourceId: '', source: '', done: false, doneAt: null, doneOn: null, spent: null, time: v.time || null, note: '', own: true, updatedAt: Date.now() });
      });
      out.msg = out.adds.length ? U.plural(out.adds.length, 'session') + ' of ' + fm(out.adds[0].min) + ' will be added (' + fm(out.adds.length * out.adds[0].min) + ' in all), ' + U.fmtShort(out.adds[0].date) + ' – ' + U.fmtShort(out.adds[out.adds.length - 1].date) + '.' : 'No new sessions — the subject is already on those days in that slot.';
    }
    if (kind === 'drop') {
      if (!v.track) { out.msg = 'Pick the subject.'; return out; }
      const l = open(v.from || t).filter(s => s.trackId === v.track);
      if (v.how === 'pause') {
        if (!U.isKey(v.until) || v.until <= (v.from || t)) { out.msg = 'Choose the day to start again (after the pause begins).'; return out; }
        let n = U.diffDays(v.from || t, v.until); if (v.keep) n = wk(n);
        l.forEach(s => out.moves.push([s, U.addDays(s.date, n)]));
        out.msg = U.plural(l.length, 'open session') + ' of this subject move ' + U.plural(n, 'day') + ' later; it starts again on ' + U.fmtShort(U.addDays(v.from || t, n)) + '. Other subjects stay.';
      } else { out.dels = l; out.msg = U.plural(l.length, 'open session') + ' (' + fm(l.reduce((a, s) => a + s.min, 0)) + ') of this subject from ' + U.fmtShort(v.from || t) + ' will be removed. Ticked ones stay in your progress.'; }
    }
    if (kind === 'change') {
      const l = open(v.from || t).filter(s => !v.track || s.trackId === v.track);
      if (!(+v.min > 0) && !v.time && !v.clearTime) { out.msg = 'Type the new minutes and/or the new time.'; return out; }
      if (+v.min > 0) l.forEach(s => { if (s.min !== Math.round(+v.min)) out.mins.push([s, Math.round(+v.min)]); });
      if (v.time || v.clearTime) l.forEach(s => out.times.push([s, v.clearTime ? null : v.time]));
      out.msg = U.plural(l.length, 'open session') + ' from ' + U.fmtShort(v.from || t) + (+v.min > 0 ? ' become ' + fm(+v.min) : '') + (v.time ? (+v.min > 0 ? ' and' : '') + ' start at ' + ED.fx.time(v.time) : v.clearTime ? ' go back to their slot’s time' : '') + '.';
    }
    if (kind === 'load') {
      const pc = +v.pct || 0; if (!pc) { out.msg = 'Choose how much lighter or heavier.'; return out; }
      const l = open(v.from || t).filter(s => !v.track || s.trackId === v.track);
      let before = 0, after = 0;
      l.forEach(s => { const m = Math.max(5, Math.round(s.min * (1 + pc / 100) / 5) * 5); before += s.min; after += m; if (m !== s.min) out.mins.push([s, m]); });
      out.msg = U.plural(l.length, 'open session') + ': ' + fm(before) + ' → ' + fm(after) + ' in all (' + (pc > 0 ? '+' : '') + pc + '%).';
    }
    if (p && (out.moves.length || out.adds.length)) {
      const last = [].concat(out.moves.map(x => x[1]), out.adds.map(s => s.date), ST.sessions().map(s => s.date)).sort().pop();
      if (last > (p.end || '')) out.msg += ' The plan will now end on ' + U.fmtLong(last) + '.';
    }
    return out;
  };
  SA.apply = (kind, v) => {
    const p = ST.plan(), x = SA.plan(kind, v), now = Date.now();
    const n = x.moves.length + x.dels.length + x.mins.length + x.times.length + x.adds.length; if (!n) return 0;
    ED.store.checkpoint('Adjust the plan');
    if (kind === 'add' && !v.track) { const tr = ST.addTrack(String(v.name).trim()); x.adds.forEach(s => { s.trackId = tr.id; }); }
    x.moves.forEach(([s, k]) => { s.date = k; s.updatedAt = now; });
    x.mins.forEach(([s, m]) => { s.min = m; s.updatedAt = now; });
    x.times.forEach(([s, t]) => { s.time = t; s.updatedAt = now; });
    if (x.dels.length) { const ids = new Set(x.dels.map(s => s.id)); D().study.sessions = ST.sessions().filter(s => !ids.has(s.id)); }
    x.adds.forEach(s => D().study.sessions.push(s));
    if (ST.extendWeeks) ST.extendWeeks();
    ST.sessions().forEach(s => { const w = ST.weekOf(s.date); if (w) s.week = w.n; });
    D().study.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.slotNo || 9) - (b.slotNo || 9));
    p.updatedAt = now;
    ED.store.commit();
    return n;
  };

  /* ---------------- the dialog ---------------- */
  SA.open = start => {
    const p = ST.plan(); if (!p) { ED.ui.toast('Make or import a study plan first'); return; }
    const t = U.today(), slots = ST.slots(), miss = SA.missed();
    const trOpts = (all, sel) => (all ? o('', all, !sel) : '') + p.tracks.map(x => o(x.id, x.name, x.id === sel)).join('');
    const radio = (name, items, sel) => '<div class="sa-radio">' + items.map(x => '<label class="sa-r"><input type="radio" name="' + name + '" value="' + x[0] + '"' + (x[0] === sel ? ' checked' : '') + '><span><b>' + x[1] + '</b>' + (x[2] ? '<small>' + x[2] + '</small>' : '') + '</span></label>').join('') + '</div>';
    const keep = id => '<label class="switch sa-keep"><input type="checkbox" id="' + id + '"><span class="track"></span><span>Keep each session on its weekday (move by whole weeks)</span></label>';
    const f = (lab, inp) => '<label class="sa-f"><span>' + lab + '</span>' + inp + '</label>';
    const forms = {
      catch: (miss.length ? '<p class="sa-lead"><b>' + U.plural(miss.length, 'session') + '</b> (' + fm(miss.reduce((a, s) => a + s.min, 0)) + ') not ticked from earlier days — the oldest from ' + e(U.fmtShort(miss[0].date)) + '.</p>' : '<p class="sa-lead">Nothing left from earlier days — you are up to date. 🎉</p>') +
        radio('ca-how', [['spread', 'Fit them into the coming days', 'A few extra a day; the rest of the plan stays'], ['push', 'Push the rest of the plan later', 'Everything open from the oldest one moves on; the plan ends later'], ['drop', 'Let them go', 'Remove them; the plan stays as it is']], 'spread') +
        '<div class="sa-row">' + f('Extra a day', '<select id="ca-per" class="field">' + [1, 2, 3, 4].map(n => o(n, n + (n === 1 ? ' session' : ' sessions'), n === 1)).join('') + '</select>') + f('Starting', '<input id="ca-start" type="date" class="field" value="' + t + '">') + '</div>' + keep('ca-keep'),
      gap: (() => { const g = SA.gap(t); return (g ? '<p class="sa-lead">Nothing is planned from <b>' + e(U.fmtShort(g.a)) + '</b> to <b>' + e(U.fmtShort(g.b)) + '</b> (' + U.plural(g.n, 'day') + '), and sessions start again on ' + e(U.fmtShort(g.next)) + '.</p>' : '<p class="sa-lead">No empty stretch ahead.</p>') +
        '<div class="sa-row"><label class="sa-f"><span>Empty from</span><input id="gp-a" type="date" class="field" value="' + (g ? g.a : t) + '"></label><label class="sa-f"><span>Sessions start again on</span><input id="gp-next" type="date" class="field" value="' + (g ? g.next : t) + '"></label></div>' + keep('gp-keep'); })(),
      off: '<div class="sa-row">' + f('First day off', '<input id="of-from" type="date" class="field" value="' + U.addDays(t, 1) + '">') + f('Last day off', '<input id="of-to" type="date" class="field" value="' + U.addDays(t, 3) + '">') + '</div>' +
        radio('of-how', [['push', 'Move everything from that day later', 'Nothing is lost; the plan ends later'], ['drop', 'Skip those days', 'Their sessions are removed; the plan ends on time']], 'push') + keep('of-keep'),
      add: '<div class="sa-row">' + f('Subject', '<select id="ad-tr" class="field">' + o('', '➕ A new subject…', true) + trOpts('', null) + '</select>') + f('New subject’s name', '<input id="ad-name" class="field" placeholder="e.g. Cyber security, Patent drafting">') + '</div>' +
        '<div class="sa-days" role="group" aria-label="Weekdays">' + DAYS.map(d => '<label class="chip-check"><input type="checkbox" data-d="' + d + '"' + (d >= 1 && d <= 5 ? ' checked' : '') + '><span>' + U.DAY3[d] + '</span></label>').join('') + '</div>' +
        '<div class="sa-row">' + f('Slot', '<select id="ad-slot" class="field">' + slots.map(x => o(x.no, x.no + ' - ' + x.name + (x.time ? ' (' + ED.fx.time(x.time) + ')' : ''), false)).join('') + '</select>') + f('Or at a time', '<input id="ad-time" type="time" class="field">') + f('Minutes', '<input id="ad-min" type="number" class="field num" min="5" max="600" step="5" value="' + ((slots[0] || {}).min || 30) + '">') + '</div>' +
        '<div class="sa-row">' + f('From', '<input id="ad-from" type="date" class="field" value="' + (p.start > t ? p.start : t) + '">') + f('To', '<input id="ad-to" type="date" class="field" value="' + (p.end || U.addDays(t, 28)) + '">') + f('Topic (optional)', '<input id="ad-topic" class="field" placeholder="the same for each">') + '</div>',
      drop: '<div class="sa-row">' + f('Subject', '<select id="dr-tr" class="field">' + trOpts('Choose…', null) + '</select>') + f('From', '<input id="dr-from" type="date" class="field" value="' + t + '">') + '</div>' +
        radio('dr-how', [['drop', 'Drop it', 'Its open sessions from that day are removed'], ['pause', 'Pause it until…', 'Its open sessions move later; other subjects stay']], 'drop') +
        '<div class="sa-row sa-pause">' + f('Start again on', '<input id="dr-until" type="date" class="field" value="' + U.addDays(t, 14) + '">') + '</div>' + keep('dr-keep'),
      change: '<div class="sa-row">' + f('Subject', '<select id="ch-tr" class="field">' + trOpts('All subjects', null) + '</select>') + f('From', '<input id="ch-from" type="date" class="field" value="' + t + '">') + '</div>' +
        '<div class="sa-row">' + f('New minutes', '<input id="ch-min" type="number" class="field num" min="5" max="600" step="5" placeholder="keep">') + f('New start time', '<input id="ch-time" type="time" class="field">') + '</div>' +
        '<label class="switch"><input type="checkbox" id="ch-clear"><span class="track"></span><span>Use the slot’s own time again</span></label>',
      load: '<div class="sa-row">' + f('Subject', '<select id="ld-tr" class="field">' + trOpts('All subjects', null) + '</select>') + f('From', '<input id="ld-from" type="date" class="field" value="' + t + '">') + '</div>' +
        '<div class="sa-pct">' + [-50, -25, -10, 10, 25, 50].map(n => '<label class="chip-check"><input type="radio" name="ld-pct" value="' + n + '"' + (n === -25 ? ' checked' : '') + '><span>' + (n > 0 ? '+' : '−') + Math.abs(n) + '%</span></label>').join('') + '</div>',
    };
    const body = '<div class="sa"><nav class="sa-nav" role="tablist" aria-label="What to change">' + CHOICES.map(c => '<button type="button" role="tab" class="sa-c" data-k="' + c[0] + '" aria-selected="false"><span aria-hidden="true">' + c[1] + '</span><b>' + e(c[2]) + '</b><small>' + e(c[3]) + (c[0] === 'catch' && miss.length ? ' · ' + miss.length : '') + '</small></button>').join('') + '</nav>' +
      '<div class="sa-body">' + Object.keys(forms).map(k => '<section class="sa-sec" data-k="' + k + '" hidden>' + forms[k] + '</section>').join('') +
      '<div class="sa-prev" role="status" aria-live="polite"></div>' +
      '<p class="hint sa-more">More: <button type="button" class="link-btn" data-x="edit"><b>Edit the plan</b> (subjects, sessions, plans)</button> · <button type="button" class="link-btn" data-x="bulk">Change many sessions</button> · <button type="button" class="link-btn" data-x="weeks">Number of weeks</button> · <button type="button" class="link-btn" data-x="start">Start date</button> · <button type="button" class="link-btn" data-x="plan">Subjects, slots &amp; times</button></p></div></div>';
    let kind = start && forms[start] ? start : miss.length ? 'catch' : SA.gap(t) ? 'gap' : 'off';
    ED.ui.modal({
      title: 'Adjust the plan', cls: 'st-modal wide sa-modal', body,
      footer: '<span class="hint">Ticked sessions are never changed. You can undo right after.</span><span class="grow"></span><button type="button" class="btn" data-mclose>Close</button><button type="button" class="btn primary" data-x="apply">' + ED.icon('check') + 'Apply</button>',
      onMount(el, api) {
        const $ = id => el.querySelector('#' + id);
        const val = id => { const x = $(id); return x ? x.value : ''; };
        const rv = name => (el.querySelector('input[name="' + name + '"]:checked') || {}).value;
        const read = () => ({
          gap: { a: val('gp-a'), next: val('gp-next'), keep: $('gp-keep').checked },
          catch: { how: rv('ca-how'), per: +val('ca-per'), start: val('ca-start'), keep: $('ca-keep').checked },
          off: { from: val('of-from'), to: val('of-to'), how: rv('of-how'), keep: $('of-keep').checked },
          add: { track: val('ad-tr'), name: val('ad-name'), days: U.$$('.sa-days input', el).filter(i => i.checked).map(i => +i.dataset.d), slot: val('ad-slot'), time: val('ad-time'), min: +val('ad-min'), from: val('ad-from'), to: val('ad-to'), topic: val('ad-topic') },
          drop: { track: val('dr-tr'), from: val('dr-from'), how: rv('dr-how'), until: val('dr-until'), keep: $('dr-keep').checked },
          change: { track: val('ch-tr'), from: val('ch-from'), min: +val('ch-min'), time: val('ch-time'), clearTime: $('ch-clear').checked },
          load: { track: val('ld-tr'), from: val('ld-from'), pct: +rv('ld-pct') },
        })[kind];
        const prev = () => {
          U.$$('.sa-c', el).forEach(b => { const on = b.dataset.k === kind; b.setAttribute('aria-selected', String(on)); b.classList.toggle('on', on); });
          U.$$('.sa-sec', el).forEach(s => { s.hidden = s.dataset.k !== kind; });
          const v = read();
          if (kind === 'catch') { $('ca-per').closest('.sa-row').hidden = v.how === 'drop'; $('ca-per').closest('.sa-f').hidden = v.how !== 'spread'; $('ca-keep').closest('.switch').hidden = v.how !== 'push'; }
          if (kind === 'off') $('of-keep').closest('.switch').hidden = v.how !== 'push';
          if (kind === 'add') $('ad-name').closest('.sa-f').hidden = !!v.track;
          if (kind === 'drop') { el.querySelector('.sa-pause').hidden = v.how !== 'pause'; $('dr-keep').closest('.switch').hidden = v.how !== 'pause'; }
          const x = SA.plan(kind, v), n = x.moves.length + x.dels.length + x.mins.length + x.times.length + x.adds.length;
          el.querySelector('.sa-prev').innerHTML = '<span class="sa-pi" aria-hidden="true">' + (n ? '👉' : 'ℹ️') + '</span><span>' + e(x.msg) + '</span>';
          el.querySelector('[data-x="apply"]').disabled = !n;
        };
        el.querySelector('.sa-nav').addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (b) { kind = b.dataset.k; prev(); } });
        el.addEventListener('input', prev); el.addEventListener('change', prev);
        el.addEventListener('click', ev => {
          const b = ev.target.closest('[data-x]'); if (!b) return;
          const go = { edit: () => ED.studyEdit && ED.studyEdit.open(), bulk: ST.bulkChange, weeks: ST.editWeeks, start: ST.editStart, plan: ST.editPlan }[b.dataset.x];
          if (go) { api.close(); go(); return; }
          if (b.dataset.x === 'apply') {
            const n = SA.apply(kind, read()); if (!n) return;
            api.close(); ED.ui.undoToast('Plan adjusted — ' + U.plural(n, 'session') + ' changed');
          }
        });
        prev();
      },
    });
  };
  A['sa-open'] = el => SA.open(el && el.dataset && el.dataset.k);
})();
