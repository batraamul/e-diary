/* E-Diary — editors: task, event, role, goal, value, category */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings;
  const D = () => ED.store.data;
  const Ed = (ED.editors = {});
  let seq = 0;

  const opt = (v, label, sel) => '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';
  const DURS = [15, 30, 45, 60, 90, 120, 180, 240];
  const durLabel = m => m < 60 ? m + ' min' : (m % 60 ? (m / 60).toFixed(1) : m / 60) + ' h';
  const ALARMS = [[0, 'At due time'], [5, '5 min before'], [10, '10 min before'], [15, '15 min before'], [30, '30 min before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before']];

  /* ============================== TASK ============================== */
  Ed.task = (o) => {
    o = o || {};
    const isNewAtOpen = !o.id;
    let task = o.id ? M.task(o.id) : null;
    if (o.id && !task) { ED.ui.toast('That task no longer exists.'); return; }
    const k = o.k || (task && task.date) || (o.create && o.create.date) || null;
    const draft = task ? U.clone(task) : M.newTask(Object.assign({ date: ED.state ? ED.state.date : U.today() }, o.create || {}));
    if (!task && !draft.num) draft.num = M.nextNum(draft.prio, draft.date);
    let isNew = !task;
    let skipSave = false;
    const P = 'te' + (++seq);
    const st0 = task ? M.statusOf(task, k) : 'open';
    const rep = draft.repeat || null;
    let notesCtl = null;

    const catOpts = opt('', '(None)', !draft.categoryId) + D().categories.map(c => opt(c.id, (c.icon ? c.icon + '  ' : '') + c.name, c.id === draft.categoryId)).join('');
    const roleOpts = opt('', '(None)', !draft.roleId) + M.rolesSorted().map(r => opt(r.id, (r.icon ? r.icon + '  ' : '') + r.name, r.id === draft.roleId)).join('');
    const goals = D().goals.filter(g => !g.done || g.id === draft.goalId);
    const goalOpts = opt('', 'Select', !draft.goalId) + goals.map(g => opt(g.id, g.title + (g.done ? ' (achieved)' : ''), g.id === draft.goalId)).join('');

    const eventOptions = date => {
      const evs = date ? M.eventsOn(date) : [];
      const cur = draft.eventId && M.event(draft.eventId);
      const list = evs.slice();
      if (cur && list.indexOf(cur) < 0) list.unshift(cur);
      return opt('', 'Select', !draft.eventId) + list.map(ev => opt(ev.id, ev.title + (ev.allDay ? ' (all day)' : ' · ' + U.fmtTime(ev.start, S().h12)), ev.id === draft.eventId)).join('') +
        opt('__new', '+ New meeting from this task…', false);
    };
    const parentOptions = () => {
      const bad = new Set([draft.id]);
      const addKids = id => M.children(id).forEach(c => { if (!bad.has(c.id)) { bad.add(c.id); addKids(c.id); } });
      addKids(draft.id);
      const pool = new Map();
      if (draft.date) M.tasksOn(draft.date, { carry: false }).forEach(x => pool.set(x.t.id, x.t));
      M.masterTasks().forEach(t => pool.set(t.id, t));
      if (draft.goalId) M.goalTasks(draft.goalId).forEach(t => pool.set(t.id, t));
      const cur = draft.parentId && M.task(draft.parentId);
      if (cur) pool.set(cur.id, cur);
      const list = Array.from(pool.values()).filter(t => !bad.has(t.id)).sort(M.cmpTask).slice(0, 150);
      return opt('', 'Select', !draft.parentId) + list.map(t => opt(t.id, M.code(t) + ' ' + t.title, t.id === draft.parentId)).join('');
    };

    const repOpts = M.REPEATS.map(r => opt(r.id, r.label, (rep ? rep.freq : '') === r.id)).join('');
    const weekdays = [0, 1, 2, 3, 4, 5, 6];
    const repDays = rep && rep.days && rep.days.length ? rep.days : [draft.date ? U.dow(draft.date) : U.dow(U.today())];

    const body =
      '<div class="te">' +
      '<input id="' + P + '-title" class="te-title" type="text" placeholder="New Task" value="' + e(draft.title) + '" autocomplete="off" aria-label="Task title">' +
      '<div class="te-strip" id="' + P + '-strip"></div>' +
      (task && task.repeat ? '<div class="te-series">' + ED.icon('repeat') + '<span>' + e(M.repeatText(task.repeat)) + '. Status applies to <b>' + e(U.fmtLong(k)) + '</b>; other changes apply to every day.</span>' +
        '<button type="button" class="link-btn" data-te="detach">Edit only this day</button></div>' : '') +
      '<div class="te-grid">' +
      '<div class="te-col">' +
      row('Status', '<select id="' + P + '-status" class="field">' + M.STATUSES.map(s => opt(s.id, s.label, s.id === st0)).join('') + '</select>') +
      '<div class="te-row" id="' + P + '-delegrow"' + (st0 === 'delegated' ? '' : ' hidden') + '><label for="' + P + '-deleg">Delegated to</label><input id="' + P + '-deleg" class="field" value="' + e(draft.delegatedTo || '') + '" placeholder="Name"></div>' +
      row('Priority', '<div class="te-prio"><div class="seg" role="group" aria-label="Priority letter">' + M.PRIOS.map(p => '<button type="button" data-prio="' + p + '" aria-pressed="' + (p === draft.prio) + '" title="' + e(M.PRIO_HELP[p]) + '">' + p + '</button>').join('') + '</div>' +
        '<input id="' + P + '-num" class="field num te-num" type="number" min="1" max="99" value="' + (draft.num || 1) + '" aria-label="Priority number"></div>') +
      row(draft.repeat ? 'First Date' : 'Due Date', '<div class="te-dt"><input id="' + P + '-date" class="field" type="date" value="' + e(draft.date || '') + '" aria-label="Due date">' +
        '<input id="' + P + '-time" class="field" type="time" value="' + e(draft.time || '') + '" aria-label="Time"' + (draft.allDay ? ' hidden' : '') + '></div>', P + '-daterow') +
      '<div class="te-row" id="' + P + '-adrow"' + (draft.date ? '' : ' hidden') + '><label for="' + P + '-allday">All Day</label><label class="switch"><input id="' + P + '-allday" type="checkbox"' + (draft.allDay ? ' checked' : '') + '><span class="track"></span><span class="hint">Show in the day’s all-day strip and calendar</span></label></div>' +
      '<p class="te-hint hint" id="' + P + '-nodate"' + (draft.date ? ' hidden' : '') + '>No date — this task lives in <b>Master Tasks</b>.</p>' +
      '<div class="te-row" id="' + P + '-durrow"' + (draft.time ? '' : ' hidden') + '><label for="' + P + '-dur">Duration</label><select id="' + P + '-dur" class="field">' + DURS.map(m => opt(m, durLabel(m), m === (draft.dur || 30))).join('') + '</select></div>' +
      row('Start Date', '<input id="' + P + '-start" class="field" type="date" value="' + e(draft.startDate || '') + '">') +
      row('Alarm', '<div class="te-alarm"><label class="switch"><input id="' + P + '-alarm" type="checkbox"' + (draft.alarm ? ' checked' : '') + '><span class="track"></span><span class="sr-only">Alarm</span></label>' +
        '<select id="' + P + '-alarmb" class="field"' + (draft.alarm ? '' : ' disabled') + '>' + ALARMS.map(a => opt(a[0], a[1], a[0] === (draft.alarmBefore || 0))).join('') + '</select></div>') +
      '</div>' +
      '<div class="te-col">' +
      row('Category', '<select id="' + P + '-cat" class="field">' + catOpts + '</select>') +
      row('Repeating Rule', '<select id="' + P + '-rep" class="field">' + repOpts + '</select>') +
      '<div class="te-repopts" id="' + P + '-repopts"' + (rep ? '' : ' hidden') + '>' +
      '<div class="te-every"><span>Every</span><input id="' + P + '-iv" class="field num" type="number" min="1" max="99" value="' + ((rep && rep.interval) || 1) + '"><span id="' + P + '-unit">' + unitName(rep ? rep.freq : 'daily', (rep && rep.interval) || 1) + '</span></div>' +
      '<div class="te-days" id="' + P + '-days"' + (rep && rep.freq === 'weekly' ? '' : ' hidden') + '>' + weekdays.map(d => '<label class="daychip"><input type="checkbox" value="' + d + '"' + (repDays.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + U.DAY3[d].slice(0, 2) + '</span></label>').join('') + '</div>' +
      '<div class="te-until"><label for="' + P + '-until">Until</label><input id="' + P + '-until" class="field" type="date" value="' + e((rep && rep.until) || '') + '"></div>' +
      '</div>' +
      row('Role', '<select id="' + P + '-role" class="field">' + roleOpts + '</select>') +
      row('Goal', '<select id="' + P + '-goal" class="field">' + goalOpts + '</select>') +
      row('Meeting Planner', '<select id="' + P + '-event" class="field">' + eventOptions(draft.date) + '</select>') +
      row('Parent Task', '<select id="' + P + '-parent" class="field">' + parentOptions() + '</select>') +
      row('Show Sublist', '<select id="' + P + '-showsub" class="field">' + opt('none', 'None', draft.showSub !== 'indent') + opt('indent', 'Indented under this task', draft.showSub === 'indent') + '</select>') +
      '</div></div>' +
      '<div class="te-tabs" role="tablist">' +
      tab('notes', 'Notes', true) + tab('subs', 'Subtasks') + tab('check', 'Checklist') + tab('share', 'Sharing') +
      '</div>' +
      '<div class="te-pane" data-pane="notes" role="tabpanel"><div id="' + P + '-notes"></div></div>' +
      '<div class="te-pane" data-pane="subs" role="tabpanel" hidden></div>' +
      '<div class="te-pane" data-pane="check" role="tabpanel" hidden></div>' +
      '<div class="te-pane" data-pane="share" role="tabpanel" hidden></div>' +
      '</div>';

    function row(label, control, id) {
      const m = control.match(/id="([^"]+)"/);
      return '<div class="te-row"' + (id ? ' id="' + id + '"' : '') + '><label' + (m ? ' for="' + m[1] + '"' : '') + '>' + e(label) + '</label>' + control + '</div>';
    }
    function tab(id, label, on) {
      return '<button type="button" role="tab" class="te-tab" data-tab="' + id + '" aria-selected="' + (!!on) + '">' + e(label) + '<span class="te-count" data-count="' + id + '"></span></button>';
    }
    function unitName(freq, n) {
      const u = { daily: 'day', weekdays: 'weekday', weekly: 'week', monthly: 'month', yearly: 'year' }[freq] || 'day';
      return n === 1 ? u : u + 's';
    }

    const foot =
      (task ? '<button type="button" class="btn danger" data-te="delete">' + ED.icon('trash') + 'Delete</button>' : '') +
      (task && ED.gcal && ED.gcal.pickBtn ? ED.gcal.pickBtn('t:' + task.id) : '') +
      '<span class="grow"></span>' +
      (task ? '<button type="button" class="btn" data-te="dup">' + ED.icon('copy') + 'Duplicate</button>' : '') +
      '<button type="button" class="btn primary" data-te="done">Done</button>';

    let api;
    const $ = sel => api.el.querySelector(sel);
    const val = id => { const x = $('#' + P + '-' + id); return x ? x.value : ''; };

    const collect = () => {
      const f = {};
      f.title = val('title').trim();
      f.status = val('status');
      f.delegatedTo = val('deleg').trim();
      const pb = api.el.querySelector('.te-prio [aria-pressed="true"]');
      f.prio = pb ? pb.dataset.prio : draft.prio;
      f.num = Math.max(1, Math.min(99, parseInt(val('num'), 10) || 1));
      f.date = val('date') || null;
      f.allDay = !!(f.date && $('#' + P + '-allday') && $('#' + P + '-allday').checked);
      f.time = f.allDay ? null : (val('time') || null);
      f.dur = +val('dur') || 30;
      f.startDate = val('start') || null;
      f.alarm = $('#' + P + '-alarm').checked;
      f.alarmBefore = +val('alarmb') || 0;
      f.categoryId = val('cat') || null;
      const freq = val('rep');
      if (freq) {
        const r = { freq, interval: Math.max(1, parseInt(val('iv'), 10) || 1) };
        if (freq === 'weekly') {
          r.days = U.$$('#' + P + '-days input:checked', api.el).map(x => +x.value);
          if (!r.days.length) delete r.days;
        }
        const until = val('until'); if (until) r.until = until;
        f.repeat = r;
      } else f.repeat = null;
      f.roleId = val('role') || null;
      f.goalId = val('goal') || null;
      const ev = val('event'); f.eventId = ev && ev !== '__new' ? ev : null;
      f.parentId = val('parent') || null;
      f.showSub = val('showsub') || 'none';
      f.notes = notesCtl ? notesCtl.getHTML() : draft.notes;
      f.checklist = draft.checklist;
      return f;
    };

    /* write the form into the real task; returns the task (or null when nothing to save) */
    const save = () => {
      if (skipSave) return task;
      const f = collect();
      if (!f.title) {
        if (isNew) return null;
        f.title = task.title;
      }
      if (f.repeat && !f.date) f.date = k || U.today();
      const target = task || draft;
      const prevPrio = target.prio, prevDate = target.date, prevNum = target.num;
      const status = f.status; delete f.status;
      const wasRepeat = !!target.repeat;
      Object.assign(target, f);
      if (!isNew && (prevPrio !== f.prio || prevDate !== f.date) && f.num === prevNum) target.num = M.nextNum(target.prio, target.date, target.id);
      if (!wasRepeat && target.repeat) { target.occ = target.occ || {}; target.exdates = target.exdates || []; }
      if (target.repeat) {
        const cur = target.occ && target.occ[k];
        if (status !== ((cur && cur.st) || 'open')) M.setStatus(target, k && M.occurs(target.date, target.repeat, k, target.exdates) ? k : target.date, status);
        if (!wasRepeat && !isNew) { target.status = 'open'; }
      } else if (status !== (target.status || 'open')) {
        M.setStatus(target, target.date, status);
      }
      target.updatedAt = Date.now();
      if (isNew) {
        D().tasks.push(target);
        task = target; isNew = false;
      }
      ED.store.commit();
      return task;
    };

    const refreshCounts = () => {
      const subs = task ? M.children(task.id).length : 0;
      const cl = draft.checklist.length;
      const set = (id, n) => { const x = api.el.querySelector('[data-count="' + id + '"]'); if (x) x.textContent = n ? ' (' + n + ')' : ''; };
      set('subs', subs); set('check', cl);
    };

    const paintStrip = () => {
      const c = M.category(val('cat'));
      const s = $('#' + P + '-strip');
      s.style.setProperty('--c', c ? c.color : 'var(--rule-strong)');
      s.title = c ? c.name : 'No category';
    };

    const renderSubs = () => {
      const pane = api.el.querySelector('[data-pane="subs"]');
      const kids = task ? M.children(task.id).sort(M.cmpTask) : [];
      pane.innerHTML =
        '<ul class="te-subs">' + kids.map(c => {
          const kk = c.date || k || U.today();
          const st = M.statusOf(c, kk);
          return '<li class="st-' + st + '" data-sub="' + e(c.id) + '"><button type="button" class="tstat" data-te="subtoggle" aria-label="Toggle done">' + ED.tasksUI.statusIcon(st) + '</button>' +
            '<span class="tcode num">' + e(M.code(c)) + '</span><button type="button" class="link-btn te-subt" data-te="subopen">' + e(c.title) + '</button>' +
            '<span class="hint">' + (c.date ? e(U.relDay(c.date)) : 'No date') + '</span></li>';
        }).join('') + '</ul>' +
        '<form class="te-add" data-te-form="sub"><input class="field" placeholder="Add a subtask and press Enter" aria-label="New subtask"><button type="submit" class="btn small">' + ED.icon('plus') + 'Add</button></form>' +
        '<p class="hint">Subtasks are full tasks linked to this one. Set “Show Sublist” to list them under it.</p>';
      refreshCounts();
    };

    const renderCheck = () => {
      const pane = api.el.querySelector('[data-pane="check"]');
      pane.innerHTML =
        '<ul class="te-check">' + draft.checklist.map(c =>
          '<li data-cid="' + e(c.id) + '"><label class="cb"><input type="checkbox"' + (c.done ? ' checked' : '') + ' data-te-cb><span></span></label>' +
          '<input class="field te-cl-text" value="' + e(c.text) + '" aria-label="Checklist item">' +
          '<button type="button" class="icon-btn sm" data-te="cldel" aria-label="Remove item">' + ED.icon('x') + '</button></li>').join('') + '</ul>' +
        '<form class="te-add" data-te-form="check"><input class="field" placeholder="Add an item and press Enter" aria-label="New checklist item"><button type="submit" class="btn small">' + ED.icon('plus') + 'Add</button></form>';
      refreshCounts();
    };

    const renderShare = () => {
      const pane = api.el.querySelector('[data-pane="share"]');
      const tmp = Object.assign({}, draft, collect());
      if (!tmp.title) tmp.title = 'Untitled task';
      const text = M.taskText(tmp, tmp.repeat ? k : tmp.date);
      const mail = 'mailto:?subject=' + encodeURIComponent(tmp.title) + '&body=' + encodeURIComponent(text);
      const wa = 'https://wa.me/?text=' + encodeURIComponent(text);
      pane.innerHTML =
        '<pre class="share-text" tabindex="0">' + e(text) + '</pre>' +
        '<div class="share-actions">' +
        '<button type="button" class="btn" data-te="copy">' + ED.icon('copy') + 'Copy text</button>' +
        '<a class="btn" href="' + e(mail) + '" target="_blank" rel="noopener">' + ED.icon('mail') + 'Email</a>' +
        '<a class="btn" href="' + e(wa) + '" target="_blank" rel="noopener">' + ED.icon('chat') + 'WhatsApp</a>' +
        (ED.env.claude ? '' : '<button type="button" class="btn" data-te="ics"' + (tmp.date ? '' : ' disabled') + '>' + ED.icon('calendar') + 'Add to calendar (.ics)</button>') +
        (tmp.date && ED.gcal ? '<a class="btn" href="' + e(ED.gcal.templateUrl('[' + M.code(tmp) + '] ' + tmp.title, tmp.date, tmp.allDay ? null : tmp.time, tmp.dur, U.stripHtml(tmp.notes || ''))) + '" target="_blank" rel="noopener">' + ED.icon('external') + 'Google Calendar</a>' : '') +
        '</div><p class="hint">The calendar file opens in Outlook, Google Calendar and Apple Calendar. To copy every dated task automatically, link Google in Settings → Google Calendar.</p>';
      pane._text = text; pane._tmp = tmp;
    };

    const switchTab = id => {
      U.$$('.te-tab', api.el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
      U.$$('.te-pane', api.el).forEach(p => { p.hidden = p.dataset.pane !== id; });
      if (id === 'subs') renderSubs();
      if (id === 'check') renderCheck();
      if (id === 'share') renderShare();
    };

    api = ED.ui.modal({
      cls: 'task-editor', label: 'Task', body, footer: foot,
      beforeClose() { save(); return true; },
      onClose() { if (o.onClose) o.onClose(); },
      onMount(el, m) {
        api = m;
        paintStrip();
        notesCtl = ED.rich.mount(el.querySelector('#' + P + '-notes'), { html: draft.notes, toolbar: 'mini', placeholder: 'Note', label: 'Task notes', onChange: h => { draft.notes = h; } });
        refreshCounts();
        const title = el.querySelector('#' + P + '-title');
        if (isNewAtOpen) setTimeout(() => title.focus(), 40);
        title.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); api.requestClose(); } });
        el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); api.requestClose(); } });

        el.querySelector('.te-prio .seg').addEventListener('click', ev => {
          const b = ev.target.closest('[data-prio]'); if (!b) return;
          U.$$('.te-prio [data-prio]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          const date = val('date') || null;
          el.querySelector('#' + P + '-num').value = b.dataset.prio === draft.prio && task ? draft.num : M.nextNum(b.dataset.prio, date, draft.id);
        });
        el.querySelector('#' + P + '-status').addEventListener('change', () => { el.querySelector('#' + P + '-delegrow').hidden = val('status') !== 'delegated'; });
        el.querySelector('#' + P + '-cat').addEventListener('change', paintStrip);
        el.querySelector('#' + P + '-date').addEventListener('change', () => {
          el.querySelector('#' + P + '-nodate').hidden = !!val('date');
          el.querySelector('#' + P + '-adrow').hidden = !val('date');
          draft.date = val('date') || null;
          el.querySelector('#' + P + '-event').innerHTML = eventOptions(draft.date);
        });
        el.querySelector('#' + P + '-time').addEventListener('input', () => { el.querySelector('#' + P + '-durrow').hidden = !val('time'); });
        el.querySelector('#' + P + '-allday').addEventListener('change', ev => {
          const t = el.querySelector('#' + P + '-time');
          t.hidden = ev.target.checked;
          if (ev.target.checked) { t.value = ''; el.querySelector('#' + P + '-durrow').hidden = true; }
        });
        el.querySelector('#' + P + '-alarm').addEventListener('change', ev => {
          el.querySelector('#' + P + '-alarmb').disabled = !ev.target.checked;
          if (ev.target.checked && !val('time')) ED.ui.toast('Set a time so the alarm knows when to ring.');
        });
        el.querySelector('#' + P + '-rep').addEventListener('change', () => {
          const f = val('rep');
          el.querySelector('#' + P + '-repopts').hidden = !f;
          el.querySelector('#' + P + '-days').hidden = f !== 'weekly';
          el.querySelector('#' + P + '-unit').textContent = unitName(f, +val('iv') || 1);
          el.querySelector('#' + P + '-iv').closest('.te-every').hidden = f === 'weekdays';
          if (f && !val('date')) { el.querySelector('#' + P + '-date').value = k || U.today(); el.querySelector('#' + P + '-nodate').hidden = true; }
        });
        el.querySelector('#' + P + '-iv').addEventListener('input', () => { el.querySelector('#' + P + '-unit').textContent = unitName(val('rep'), +val('iv') || 1); });
        if (rep && rep.freq === 'weekdays') el.querySelector('#' + P + '-iv').closest('.te-every').hidden = true;
        el.querySelector('#' + P + '-event').addEventListener('change', ev => {
          if (ev.target.value !== '__new') return;
          ev.target.value = '';
          const f = collect();
          const evn = M.newEvent({ title: f.title || 'Meeting', date: f.date || U.today(), start: f.time || '10:00', end: U.fromMin(U.toMin(f.time || '10:00') + (f.dur || 60)) });
          ED.editors.event({ create: evn, onSaved: saved => { draft.eventId = saved.id; el.querySelector('#' + P + '-event').innerHTML = eventOptions(val('date') || null); } });
        });

        el.querySelector('.te-tabs').addEventListener('click', ev => { const b = ev.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });

        el.addEventListener('submit', ev => {
          const form = ev.target.closest('[data-te-form]'); if (!form) return;
          ev.preventDefault();
          const inp = form.querySelector('input');
          const text = inp.value.trim(); if (!text) return;
          if (form.dataset.teForm === 'check') {
            draft.checklist.push({ id: U.uid('c'), text, done: false });
            renderCheck();
            const ni = api.el.querySelector('[data-te-form="check"] input'); if (ni) ni.focus();
          } else {
            if (isNew) { const f = collect(); if (!f.title) { el.querySelector('#' + P + '-title').value = 'Untitled task'; } }
            const parent = save();
            if (!parent) return;
            const q = M.parseQuick(text);
            M.addTask({ title: q.title, prio: q.prio || 'B', num: q.num || 0, date: parent.repeat ? (k || parent.date) : parent.date, time: q.time, parentId: parent.id, roleId: parent.roleId, categoryId: parent.categoryId, goalId: parent.goalId });
            ED.store.commit();
            renderSubs();
            const ni = api.el.querySelector('[data-te-form="sub"] input'); if (ni) ni.focus();
          }
        });
        el.addEventListener('change', ev => {
          if (ev.target.matches('[data-te-cb]')) {
            const li = ev.target.closest('[data-cid]'); const c = draft.checklist.find(x => x.id === li.dataset.cid);
            if (c) c.done = ev.target.checked;
            refreshCounts();
          } else if (ev.target.matches('.te-cl-text')) {
            const li = ev.target.closest('[data-cid]'); const c = draft.checklist.find(x => x.id === li.dataset.cid);
            if (c) c.text = ev.target.value.trim() || c.text;
          }
        });

        el.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-te]'); if (!b) return;
          const act = b.dataset.te;
          if (act === 'done') api.requestClose();
          else if (act === 'delete') {
            const occ = M.occ(task, k || task.date || U.today());
            skipSave = true;
            const ok = await ED.tasksUI.remove(occ);
            if (ok) api.close(); else skipSave = false;
          } else if (act === 'dup') {
            const t = save();
            const c = M.cloneTask(t, { repeat: null, occ: {}, exdates: [], status: 'open', date: t.repeat ? k : t.date });
            c.num = M.nextNum(c.prio, c.date);
            D().tasks.push(c); ED.store.commit();
            skipSave = true; api.close();
            ED.ui.toast('Duplicated');
            Ed.task({ id: c.id, k: c.date });
          } else if (act === 'detach') {
            const t = save();
            const c = M.detach(t, k, k);
            ED.store.commit();
            skipSave = true; api.close();
            Ed.task({ id: c.id, k: c.date });
          } else if (act === 'cldel') {
            const li = b.closest('[data-cid]');
            draft.checklist = draft.checklist.filter(x => x.id !== li.dataset.cid);
            renderCheck();
          } else if (act === 'subtoggle') {
            const c = M.task(b.closest('[data-sub]').dataset.sub);
            if (c) { const kk = c.date || k || U.today(); M.setStatus(c, kk, M.isClosed(M.statusOf(c, kk)) ? 'open' : 'done'); ED.store.commit(); renderSubs(); }
          } else if (act === 'subopen') {
            const c = M.task(b.closest('[data-sub]').dataset.sub);
            if (c) Ed.task({ id: c.id, k: c.date || k, onClose: () => { if (api.el.isConnected) renderSubs(); } });
          } else if (act === 'copy') {
            const ok = await U.copy(api.el.querySelector('[data-pane="share"]')._text || '');
            ED.ui.toast(ok ? 'Copied to clipboard' : 'Select the text and copy it');
          } else if (act === 'ics') {
            const tmp = api.el.querySelector('[data-pane="share"]')._tmp;
            U.download((tmp.title || 'task').replace(/[^\w\- ]+/g, '').slice(0, 40).trim() + '.ics', M.taskIcs(tmp), 'text/calendar');
          }
        });
      },
    });
    return api;
  };

  /* ============================== EVENT ============================== */
  Ed.event = (o) => {
    o = o || {};
    let ev = o.id ? M.event(o.id) : null;
    const draft = ev ? U.clone(ev) : M.newEvent(o.create || {});
    const isNew = !ev;
    const P = 'ev' + (++seq);
    const r = draft.repeat;
    const REM = [[null, 'None'], [0, 'At start time'], [5, '5 min before'], [10, '10 min before'], [15, '15 min before'], [30, '30 min before'], [60, '1 hour before'], [1440, '1 day before']];
    const body =
      '<div class="ee">' +
      '<input id="' + P + '-title" class="te-title" type="text" placeholder="New Event" value="' + e(draft.title) + '" aria-label="Event title" autocomplete="off">' +
      '<div class="te-strip" style="--c:' + e(draft.color) + '" id="' + P + '-strip"></div>' +
      '<div class="ee-grid">' +
      '<div class="te-row"><label for="' + P + '-allday">All day</label><label class="switch"><input id="' + P + '-allday" type="checkbox"' + (draft.allDay ? ' checked' : '') + '><span class="track"></span></label></div>' +
      '<div class="te-row"><label for="' + P + '-date">Date</label><input id="' + P + '-date" class="field" type="date" value="' + e(draft.date) + '"></div>' +
      '<div class="te-row" id="' + P + '-times"' + (draft.allDay ? ' hidden' : '') + '><label for="' + P + '-start">Time</label><div class="te-dt"><input id="' + P + '-start" class="field" type="time" value="' + e(draft.start || '09:00') + '"><span class="hint">to</span><input id="' + P + '-end" class="field" type="time" value="' + e(draft.end || '10:00') + '" aria-label="End time"></div></div>' +
      '<div class="te-row"><label for="' + P + '-rep">Repeat</label><select id="' + P + '-rep" class="field">' + [['', 'None'], ['daily', 'Daily'], ['weekdays', 'Weekdays (Mon–Fri)'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(x => opt(x[0], x[1], (r ? r.freq : '') === x[0])).join('') + '</select></div>' +
      '<div class="te-row" id="' + P + '-untilrow"' + (r ? '' : ' hidden') + '><label for="' + P + '-until">Until</label><input id="' + P + '-until" class="field" type="date" value="' + e((r && r.until) || '') + '"></div>' +
      '<div class="te-row"><label for="' + P + '-rem">Reminder</label><select id="' + P + '-rem" class="field">' + REM.map(x => opt(x[0] == null ? '' : x[0], x[1], (draft.reminder == null ? null : draft.reminder) === x[0])).join('') + '</select></div>' +
      '<div class="te-row"><label for="' + P + '-loc">Location</label><input id="' + P + '-loc" class="field" value="' + e(draft.location || '') + '" placeholder="Optional"></div>' +
      '<div class="te-row te-row-top"><span class="lbl-inline">Colour</span>' + ED.ui.swatches(P + '-color', draft.color, M.EVENT_COLORS) + '</div>' +
      '<div class="te-row te-row-top"><label for="' + P + '-notes">Notes</label><textarea id="' + P + '-notes" class="field" rows="3">' + e(draft.notes || '') + '</textarea></div>' +
      '</div></div>';
    const foot = (ev ? '<button type="button" class="btn danger" data-ee="delete">' + ED.icon('trash') + 'Delete</button>' : '') + (ev && ED.gcal && ED.gcal.pickBtn ? ED.gcal.pickBtn('e:' + ev.id) : '') + '<span class="grow"></span>' +
      (ev && !ED.env.claude ? '<button type="button" class="btn" data-ee="ics">' + ED.icon('calendar') + '.ics</button>' : '') +
      '<button type="button" class="btn primary" data-ee="done">Done</button>';
    let skip = false, api;
    const val = id => api.el.querySelector('#' + P + '-' + id).value;
    const save = () => {
      if (skip) return ev;
      const title = val('title').trim();
      if (!title && isNew) return null;
      const target = ev || draft;
      target.title = title || target.title;
      target.allDay = api.el.querySelector('#' + P + '-allday').checked;
      target.date = val('date') || target.date || U.today();
      target.start = target.allDay ? null : (val('start') || '09:00');
      target.end = target.allDay ? null : (val('end') || null);
      if (target.end && target.start && target.end <= target.start) target.end = U.fromMin(U.toMin(target.start) + 60);
      const f = val('rep');
      target.repeat = f ? Object.assign({ freq: f, interval: 1 }, val('until') ? { until: val('until') } : {}) : null;
      const rem = val('rem'); target.reminder = rem === '' ? null : +rem;
      target.location = val('loc').trim();
      target.notes = val('notes');
      target.color = ED.ui.readSwatch(api.el, P + '-color') || target.color;
      target.exdates = target.exdates || [];
      if (isNew && !ev) { D().events.push(target); ev = target; }
      ED.store.commit();
      if (o.onSaved) o.onSaved(ev);
      return ev;
    };
    api = ED.ui.modal({
      cls: 'event-editor', label: 'Event', body, footer: foot,
      beforeClose() { save(); return true; },
      onMount(el, m) {
        api = m;
        ED.ui.bindSwatches(el);
        if (isNew) setTimeout(() => el.querySelector('#' + P + '-title').focus(), 40);
        el.querySelector('#' + P + '-title').addEventListener('keydown', x => { if (x.key === 'Enter') { x.preventDefault(); api.requestClose(); } });
        el.querySelector('#' + P + '-allday').addEventListener('change', x => { el.querySelector('#' + P + '-times').hidden = x.target.checked; });
        el.querySelector('#' + P + '-rep').addEventListener('change', x => { el.querySelector('#' + P + '-untilrow').hidden = !x.target.value; });
        el.addEventListener('change', x => { if (x.target.name === P + '-color' || x.target.classList.contains('sw-color')) el.querySelector('#' + P + '-strip').style.setProperty('--c', ED.ui.readSwatch(el, P + '-color')); });
        el.addEventListener('click', async x => {
          const b = x.target.closest('[data-ee]'); if (!b) return;
          if (b.dataset.ee === 'done') api.requestClose();
          if (b.dataset.ee === 'ics') { const s = save(); U.download((s.title || 'event').replace(/[^\w\- ]+/g, '').slice(0, 40).trim() + '.ics', M.eventIcs(s), 'text/calendar'); }
          if (b.dataset.ee === 'delete') {
            let choice = 'all';
            if (ev.repeat && o.k) {
              choice = await ED.ui.confirm({ title: 'Delete repeating event', message: 'Delete only ' + U.fmtShort(o.k) + ', or every occurrence?', choices: [{ id: 'one', label: 'Only this day', primary: false }, { id: 'all', label: 'All occurrences', danger: true }] });
              if (!choice) return;
            }
            ED.store.checkpoint('Delete event');
            if (choice === 'one') { ev.exdates = (ev.exdates || []).concat(o.k); }
            else { D().events = D().events.filter(x2 => x2.id !== ev.id); D().tasks.forEach(t => { if (t.eventId === ev.id) t.eventId = null; }); }
            ED.store.commit();
            skip = true; api.close();
            ED.ui.undoToast('Event deleted');
          }
        });
      },
    });
    return api;
  };

  /* ============================== small editors ============================== */
  const simple = (title, fields, onSave, extra) => {
    const P = 'se' + (++seq);
    const body = '<form class="se" id="' + P + '">' + fields(P) + '</form>';
    const foot = (extra && extra.onDelete ? '<button type="button" class="btn danger" data-se="delete">' + ED.icon('trash') + 'Delete</button>' : '') +
      '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-se="save">Save</button>';
    let api;
    api = ED.ui.modal({
      title, cls: 'simple-editor', body, footer: foot,
      onMount(el, m) {
        api = m;
        ED.ui.bindSwatches(el);
        const go = () => { if (onSave(el, P) !== false) api.close(); };
        el.querySelector('form').addEventListener('submit', x => { x.preventDefault(); go(); });
        el.addEventListener('click', async x => {
          const b = x.target.closest('[data-se]'); if (!b) return;
          if (b.dataset.se === 'save') go();
          if (b.dataset.se === 'delete' && extra.onDelete) { const ok = await extra.onDelete(); if (ok) api.close(); }
          if (b.dataset.se === 'emoji') ED.ui.emojiPicker(b, v => { b.textContent = v || '—'; b.dataset.value = v; });
        });
        if (extra && extra.onMount) extra.onMount(el, P, api);
      },
    });
    return api;
  };
  const emojiField = (P, v, label) => '<div class="se-row"><span class="lbl">' + e(label || 'Icon') + '</span><button type="button" class="emoji-field" data-se="emoji" id="' + P + '-icon" data-value="' + e(v || '') + '" aria-label="Choose icon">' + e(v || '—') + '</button></div>';

  Ed.role = id => {
    const r = id ? M.role(id) : null;
    return simple(r ? 'Edit Role' : 'Add Role', P =>
      '<div class="se-row"><label class="lbl" for="' + P + '-name">Role name</label><input id="' + P + '-name" class="field" value="' + e(r ? r.name : '') + '" placeholder="e.g. Scientist, Parent, Learner" required></div>' +
      emojiField(P, r ? r.icon : '🧭') +
      '<div class="se-row"><span class="lbl">Colour</span>' + ED.ui.swatches(P + '-c', r ? r.color : '#1f6fe0') + '</div>' +
      '<div class="se-row"><label class="lbl" for="' + P + '-desc">What this role means to you</label><textarea id="' + P + '-desc" class="field" rows="3">' + e(r ? r.desc || '' : '') + '</textarea></div>',
      (el, P) => {
        const name = el.querySelector('#' + P + '-name').value.trim();
        if (!name) { el.querySelector('#' + P + '-name').focus(); return false; }
        const x = r || { id: U.uid('role'), order: D().roles.length ? Math.max.apply(null, D().roles.map(q => q.order || 0)) + 1 : 0 };
        x.name = name; x.icon = el.querySelector('#' + P + '-icon').dataset.value || '';
        x.color = ED.ui.readSwatch(el, P + '-c') || '#1f6fe0';
        x.desc = el.querySelector('#' + P + '-desc').value.trim();
        if (!r) D().roles.push(x);
        ED.store.commit();
      },
      r ? {
        onDelete: async () => {
          const n = D().tasks.filter(t => t.roleId === r.id).length;
          const ok = await ED.ui.confirm({ title: 'Delete role', message: 'Delete “' + r.name + '”?' + (n ? ' ' + U.plural(n, 'task') + ' will keep their details but lose this role.' : ''), ok: 'Delete', danger: true });
          if (!ok) return false;
          ED.store.checkpoint('Delete role');
          D().roles = D().roles.filter(x => x.id !== r.id);
          D().tasks.forEach(t => { if (t.roleId === r.id) t.roleId = null; });
          D().goals.forEach(g => { if (g.roleId === r.id) g.roleId = null; });
          ED.store.commit(); ED.ui.undoToast('Role deleted');
          return true;
        },
      } : null);
  };

  Ed.value = id => {
    const v = id ? M.value(id) : null;
    return simple(v ? 'Edit Value' : 'Add Value', P =>
      '<div class="se-row"><label class="lbl" for="' + P + '-t">Value</label><input id="' + P + '-t" class="field" value="' + e(v ? v.title : '') + '" placeholder="e.g. Integrity" required></div>' +
      '<div class="se-row"><span class="lbl">Colour</span>' + ED.ui.swatches(P + '-c', v ? v.color : '#9b1d16') + '</div>' +
      '<div class="se-row"><label class="lbl" for="' + P + '-d">What it means</label><textarea id="' + P + '-d" class="field" rows="4">' + e(v ? v.desc || '' : '') + '</textarea></div>' +
      (v ? '<p class="hint">Link goals to this value from the goal editor.</p>' : ''),
      (el, P) => {
        const t = el.querySelector('#' + P + '-t').value.trim();
        if (!t) { el.querySelector('#' + P + '-t').focus(); return false; }
        const x = v || { id: U.uid('val'), order: D().values.length };
        x.title = t; x.color = ED.ui.readSwatch(el, P + '-c') || '#9b1d16'; x.desc = el.querySelector('#' + P + '-d').value.trim();
        if (!v) D().values.push(x);
        ED.store.commit();
      },
      v ? {
        onDelete: async () => {
          const ok = await ED.ui.confirm({ title: 'Delete value', message: 'Delete “' + v.title + '”? Goals linked to it stay.', ok: 'Delete', danger: true });
          if (!ok) return false;
          ED.store.checkpoint('Delete value');
          D().values = D().values.filter(x => x.id !== v.id);
          D().goals.forEach(g => { if (g.valueId === v.id) g.valueId = null; });
          ED.store.commit(); ED.ui.undoToast('Value deleted');
          return true;
        },
      } : null);
  };

  Ed.category = id => {
    const c = id ? M.category(id) : null;
    return simple(c ? 'Edit Category' : 'Add Category', P =>
      '<div class="se-row"><label class="lbl" for="' + P + '-n">Category name</label><input id="' + P + '-n" class="field" value="' + e(c ? c.name : '') + '" placeholder="e.g. Office" required></div>' +
      emojiField(P, c ? c.icon : '🏷️') +
      '<div class="se-row"><span class="lbl">Colour (used for task titles)</span>' + ED.ui.swatches(P + '-c', c ? c.color : '#1f6fe0') + '</div>',
      (el, P) => {
        const n = el.querySelector('#' + P + '-n').value.trim();
        if (!n) { el.querySelector('#' + P + '-n').focus(); return false; }
        const x = c || { id: U.uid('cat') };
        x.name = n; x.icon = el.querySelector('#' + P + '-icon').dataset.value || ''; x.color = ED.ui.readSwatch(el, P + '-c') || '#1f6fe0';
        if (!c) D().categories.push(x);
        ED.store.commit();
      },
      c ? {
        onDelete: async () => {
          const ok = await ED.ui.confirm({ title: 'Delete category', message: 'Delete “' + c.name + '”? Its tasks stay, without a category.', ok: 'Delete', danger: true });
          if (!ok) return false;
          ED.store.checkpoint('Delete category');
          D().categories = D().categories.filter(x => x.id !== c.id);
          D().tasks.forEach(t => { if (t.categoryId === c.id) t.categoryId = null; });
          ED.store.commit(); ED.ui.undoToast('Category deleted');
          return true;
        },
      } : null);
  };

  Ed.goal = (id, preset) => {
    const g = id ? M.goal(id) : null;
    const draft = g ? g : Object.assign({ id: U.uid('g'), title: '', desc: '', valueId: null, roleId: null, color: '#1f6fe0', startDate: U.today(), due: U.addMonths(U.today(), 3), done: false, doneAt: null, createdAt: Date.now() }, preset || {});
    let saved = !!g;
    const vOpts = opt('', '(None)', !draft.valueId) + M.valuesSorted().map(v => opt(v.id, v.title, v.id === draft.valueId)).join('');
    const rOpts = opt('', '(None)', !draft.roleId) + M.rolesSorted().map(r => opt(r.id, (r.icon ? r.icon + '  ' : '') + r.name, r.id === draft.roleId)).join('');
    const tasksHtml = () => {
      const ts = M.goalTasks(draft.id).sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || M.cmpTask(a, b));
      const st = M.goalStats(draft.id);
      return '<div class="ge-tasks-h"><span class="lbl">Tasks for this goal · ' + st.done + '/' + st.total + ' done</span><button type="button" class="btn small" data-se="addtask">' + ED.icon('plus') + 'Add task</button></div>' +
        (ts.length ? '<ul class="ge-tasks">' + ts.map(t => {
          const kk = t.repeat ? U.today() : t.date;
          const s = M.statusOf(t, kk);
          return '<li class="st-' + s + '"><span class="st-mini">' + ED.tasksUI.statusIcon(s) + '</span><span class="tcode num">' + e(M.code(t)) + '</span>' +
            '<button type="button" class="link-btn" data-se="opentask" data-id="' + e(t.id) + '">' + e(t.title) + '</button>' +
            '<span class="hint">' + (t.repeat ? e(M.repeatText(t.repeat)) : t.date ? e(U.fmtShort(t.date)) : 'Master list') + '</span></li>';
        }).join('') + '</ul>' : '<p class="hint">No tasks yet. Break the goal into small tasks and give each a day.</p>');
    };
    const commitFields = (el, P) => {
      const title = el.querySelector('#' + P + '-t').value.trim();
      if (!title) { el.querySelector('#' + P + '-t').focus(); return false; }
      draft.title = title;
      draft.desc = el.querySelector('#' + P + '-d').value.trim();
      draft.startDate = el.querySelector('#' + P + '-s').value || null;
      draft.due = el.querySelector('#' + P + '-due').value || null;
      draft.valueId = el.querySelector('#' + P + '-v').value || null;
      draft.roleId = el.querySelector('#' + P + '-r').value || null;
      draft.color = ED.ui.readSwatch(el, P + '-c') || draft.color;
      const achieved = el.querySelector('#' + P + '-done').checked;
      if (achieved && !draft.done) { draft.done = true; draft.doneAt = U.today(); }
      if (!achieved && draft.done) { draft.done = false; draft.doneAt = null; }
      if (!saved) { D().goals.push(draft); saved = true; }
      ED.store.commit();
      return true;
    };
    return simple(g ? 'Edit Goal' : 'Add Goal', P =>
      '<div class="se-row"><label class="lbl" for="' + P + '-t">Goal</label><input id="' + P + '-t" class="field" value="' + e(draft.title) + '" placeholder="e.g. Complete my PhD" required></div>' +
      '<div class="se-row"><label class="lbl" for="' + P + '-d">Why it matters / how you will know it is done</label><textarea id="' + P + '-d" class="field" rows="2">' + e(draft.desc || '') + '</textarea></div>' +
      '<div class="se-cols"><div class="se-row"><label class="lbl" for="' + P + '-s">Start</label><input id="' + P + '-s" type="date" class="field" value="' + e(draft.startDate || '') + '"></div>' +
      '<div class="se-row"><label class="lbl" for="' + P + '-due">Due</label><input id="' + P + '-due" type="date" class="field" value="' + e(draft.due || '') + '"></div></div>' +
      '<div class="se-cols"><div class="se-row"><label class="lbl" for="' + P + '-v">Value</label><select id="' + P + '-v" class="field">' + vOpts + '</select></div>' +
      '<div class="se-row"><label class="lbl" for="' + P + '-r">Role</label><select id="' + P + '-r" class="field">' + rOpts + '</select></div></div>' +
      '<div class="se-row"><span class="lbl">Colour</span>' + ED.ui.swatches(P + '-c', draft.color) + '</div>' +
      '<div class="se-row"><label class="switch"><input id="' + P + '-done" type="checkbox"' + (draft.done ? ' checked' : '') + '><span class="track"></span><span>Achieved' + (draft.doneAt ? ' on ' + e(U.fmtShort(draft.doneAt)) : '') + '</span></label></div>' +
      '<div class="se-row ge-tasks-wrap" id="' + P + '-tasks">' + tasksHtml() + '</div>',
      (el, P) => commitFields(el, P),
      {
        onDelete: g ? async () => {
          const n = M.goalTasks(g.id).length;
          const ok = await ED.ui.confirm({ title: 'Delete goal', message: 'Delete “' + g.title + '”?' + (n ? ' Its ' + U.plural(n, 'task') + ' stay in your diary.' : ''), ok: 'Delete', danger: true });
          if (!ok) return false;
          ED.store.checkpoint('Delete goal');
          D().goals = D().goals.filter(x => x.id !== g.id);
          D().tasks.forEach(t => { if (t.goalId === g.id) t.goalId = null; });
          ED.store.commit(); ED.ui.undoToast('Goal deleted');
          return true;
        } : null,
        onMount(el, P) {
          el.addEventListener('click', x => {
            const b = x.target.closest('[data-se]'); if (!b) return;
            const refresh = () => { const w = el.querySelector('#' + P + '-tasks'); if (w && w.isConnected) w.innerHTML = tasksHtml(); };
            if (b.dataset.se === 'addtask') {
              if (commitFields(el, P) === false) { ED.ui.toast('Give the goal a name first.'); return; }
              Ed.task({ create: { goalId: draft.id, roleId: draft.roleId, date: ED.state.date }, onClose: refresh });
            }
            if (b.dataset.se === 'opentask') Ed.task({ id: b.dataset.id, onClose: refresh });
          });
        },
      });
  };

  Ed.notebook = id => {
    const nb = id ? M.notebook(id) : null;
    return simple(nb ? 'Rename Notebook' : 'New Notebook', P =>
      '<div class="se-row"><label class="lbl" for="' + P + '-n">Notebook name</label><input id="' + P + '-n" class="field" value="' + e(nb ? nb.name : '') + '" placeholder="e.g. Career" required></div>' + emojiField(P, nb ? nb.icon : '📒'),
      (el, P) => {
        const n = el.querySelector('#' + P + '-n').value.trim();
        if (!n) return false;
        const x = nb || { id: U.uid('nb') };
        x.name = n; x.icon = el.querySelector('#' + P + '-icon').dataset.value || '';
        if (!nb) { D().notebooks.push(x); ED.state.career.nb = x.id; }
        ED.store.commit();
      },
      nb ? {
        onDelete: async () => {
          const n = D().notes.filter(x => x.notebookId === nb.id).length;
          const ok = await ED.ui.confirm({ title: 'Delete notebook', message: 'Delete “' + nb.name + '”' + (n ? ' and its ' + U.plural(n, 'note') + '?' : '?'), ok: 'Delete', danger: true });
          if (!ok) return false;
          ED.store.checkpoint('Delete notebook');
          D().notebooks = D().notebooks.filter(x => x.id !== nb.id);
          D().notes = D().notes.filter(x => x.notebookId !== nb.id);
          ED.state.career.nb = 'all'; ED.state.career.noteId = null;
          ED.store.commit(); ED.ui.undoToast('Notebook deleted');
          return true;
        },
      } : null);
  };
})();
