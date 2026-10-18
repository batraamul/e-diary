/* E-Diary — app shell: state, rendering, navigation, global events, drag & drop, shortcuts */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const CH = (ED.changes = ED.changes || {});
  const F = (ED.forms = ED.forms || {});

  const SECTIONS = [
    { id: 'daily', label: 'Daily Tasks' },
    { id: 'weekly', label: 'Weekly Tasks', title: 'Weekly Tasks: plan the week, then schedule each task to a day' },
    { id: 'monthly', label: 'Month\u00adly Tasks' },
    { id: 'yearly', label: 'Yearly Tasks', title: 'Yearly Tasks: plan the year, then schedule each task to a month' },
    { id: 'matrix', label: 'Eisenhower Matrix', title: 'Your tasks sorted by urgent and important' },
    { id: 'bucket', label: 'Bucket List', title: 'Bucket list: things to do, see, learn and achieve' },
    { id: 'roles', label: 'Roles' },
    { id: 'goals', label: 'Goals' },
    { id: 'mission', label: 'Mis\u00adsion' },
    { id: 'career', label: 'Notes & Life', title: 'Notes & Life Planner: notes, progress, travel, grocery, meals, wardrobe' },
    { id: 'studyYear', label: 'Study Year', title: 'Study planner · Yearly' },
    { id: 'studyMonth', label: 'Study Month', title: 'Study planner · Monthly' },
    { id: 'studyWeek', label: 'Study Week & Day', title: 'Study planner · Weekly & Daily' },
    { id: 'mindmap', label: 'Mind Maps', title: 'Mind maps to plan projects and topics' },
    { id: 'jobs', label: 'Govt Jobs', title: 'Government of India openings at Level 13A / 14' },
    { id: 'finance', label: 'Fi\u00adnance', title: 'Money records, budget and bills' },
    { id: 'finplan', label: 'Fi\u00adnance Plan', title: 'Goal-based financial plan: inflation, tax, year by year' },
    { id: 'interview', label: 'Inter\u00adview Prep', title: 'Interview preparation: interviews, question bank, practice' },
    { id: 'exam', label: 'Exam Preparation', title: 'Exam preparation: syllabus, revision, mock tests' },
    { id: 'health', label: 'Health', title: 'Health, medicine and treatment' },
    { id: 'events', label: 'Events & Meet\u00adings', title: 'Events, meetings and planning — with your Google Calendar' },
    { id: 'vault', label: 'Pass\u00adwords', title: 'Passwords and important websites' },
  ];
  ED.SECTIONS = SECTIONS;
  /* the side tabs: related pages share one tab; its pages are chosen in the bar at the top */
  const GROUPS = [
    { id: 'planner', label: 'Planner', title: 'Daily & monthly tasks, events and meetings', views: ['daily', 'weekly', 'monthly', 'yearly', 'events', 'matrix', 'bucket'], names: ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Events', 'Eisenhower', 'Bucket List'] },
    { id: 'purpose', label: 'Purpose', title: 'Roles, goals and mission', views: ['roles', 'goals', 'mission'], names: ['Roles', 'Goals', 'Mission'] },
    { id: 'life', label: 'Notes & Life', title: 'Notes & Life Planner: notes, progress, travel, grocery, meals, wardrobe', views: ['career'] },
    { id: 'study', label: 'Study', title: 'Study planner', views: ['studyYear', 'studyMonth', 'studyWeek', 'mindmap', 'jobs'], names: ['Year', 'Month', 'Week & Day', 'Mind Maps', 'Govt Jobs'] },
    { id: 'money', label: 'Fi\u00adnance', title: 'Money records and the financial plan', views: ['finance', 'finplan'], names: ['Money', 'Financial Plan'] },
    { id: 'interview', label: 'Inter\u00adview & Exams', title: 'Interview and exam preparation', views: ['interview', 'exam'], names: ['Interviews', 'Exam Preparation'] },
    { id: 'health', label: 'Health', title: 'Health, medicine and treatment', views: ['health'] },
    { id: 'vault', label: 'Pass\u00adwords', title: 'Passwords and important websites', views: ['vault'] },
  ];
  ED.GROUPS = GROUPS;
  const groupOf = id => GROUPS.find(g => g.views.indexOf(id) >= 0) || GROUPS[0];
  const lastIn = g => (ED.state.groupLast && ED.state.groupLast[g.id]) || g.views[0];

  ED.state = {
    tab: 'daily', date: U.today(), sel: null, mc: {}, cal: {}, scroll: {},
    career: { mode: 'notes', nb: 'all', filter: 'all', sort: 'oldest', view: 'grid', noteId: null },
    missionEdit: false, calFull: false, goalValue: null, rolesWeek: null, quoteShift: 0,
  };

  /* ---------------- navigation ---------------- */
  let anim = '';
  ED.go = {
    tab(id) {
      if (!ED.views[id]) return;
      const from = SECTIONS.findIndex(s => s.id === ED.state.tab), to = SECTIONS.findIndex(s => s.id === id);
      if (from !== to) anim = to > from ? 'fwd' : 'back';
      ED.state.tab = id;
      (ED.state.groupLast = ED.state.groupLast || {})[groupOf(id).id] = id;
      ED.state.missionEdit = false;
      if (id !== 'monthly' && id !== 'roles' && id !== 'goals') ED.state.calFull = false;
      try { if (!ED.env.claude) history.replaceState(null, '', '#' + id); } catch (err) { /* ignore */ }
      ED.app.render();
    },
    date(k, dir) {
      if (!U.isKey(k)) return;
      anim = dir || (k > ED.state.date ? 'fwd' : k < ED.state.date ? 'back' : '');
      ED.state.date = k;
      ED.state.mc.daily = k;
      ED.state.sel = null;
      ED.state.rolesWeek = null;
      ['monthly', 'roles', 'goals'].forEach(h => { if (ED.state.cal[h]) ED.state.cal[h].anchor = k; });
      ED.app.render();
    },
    day(k) { ED.state.tab = 'daily'; ED.go.date(k); },
  };

  /* ---------------- rendering ---------------- */
  let mounted = null;
  const app = (ED.app = {
    els: {},

    shell() {
      const root = document.getElementById('app');
      root.innerHTML =
        '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs id="ed-defs">' +
        '<linearGradient id="edRing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--ring-metal-1)"/><stop offset=".45" style="stop-color:var(--ring-metal-2)"/><stop offset="1" style="stop-color:var(--ring-metal-3)"/></linearGradient>' +
        '</defs></svg>' +
        '<header class="topbar" id="topbar"></header>' +
        '<main class="binder" id="binder">' +
        '<div class="notices" id="notices"></div>' +
        '<nav class="tab-strip" id="tab-strip" aria-label="Sections"></nav>' +
        '<nav class="tabs tabs-left" id="tabs-left" aria-label="Earlier sections"></nav>' +
        '<div class="spread" id="spread">' +
        '<section class="page page-left" aria-label="Left page"><div class="page-inner" id="pg-left"></div></section>' +
        '<div class="spine" aria-hidden="true"><div class="rod"></div>' + ED.ringSVG() + ED.ringSVG() + ED.ringSVG() + ED.ringSVG() + '</div>' +
        '<section class="page page-right" aria-label="Right page"><div class="page-inner" id="pg-right"></div></section>' +
        '</div>' +
        '<nav class="tabs tabs-right" id="tabs-right" aria-label="Sections"></nav>' +
        '<i class="cguard tl" aria-hidden="true"></i><i class="cguard tr" aria-hidden="true"></i><i class="cguard bl" aria-hidden="true"></i><i class="cguard br" aria-hidden="true"></i>' +
        '</main>';
      this.els = {
        top: document.getElementById('topbar'), notices: document.getElementById('notices'),
        strip: document.getElementById('tab-strip'), tl: document.getElementById('tabs-left'), tr: document.getElementById('tabs-right'),
        spread: document.getElementById('spread'), left: document.getElementById('pg-left'), right: document.getElementById('pg-right'),
      };
    },

    topbar() {
      const s = S();
      const theme = s.theme || 'auto';
      const tIcon = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'auto';
      const tLabel = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Auto';
      const sync = ED.sync ? ED.sync.status() : { cls: '', label: 'Saved' };
      return '<button type="button" class="brand" data-act="open-settings" data-tab="general" title="Diary settings">' + ED.brandSVG() +
        '<span class="brand-text"><span class="brand-title">' + e(s.diaryTitle || 'My E-Diary') + '</span>' +
        '<span class="brand-sub">' + (s.ownerName ? e(s.ownerName) + ' · ' : '') + e(U.fmtLong(U.today())) + '</span></span></button>' +
        this.subnav() +
        '<div class="tools">' +
        '<button type="button" class="tool" data-act="goto-today" title="Go to today (T)">' + ED.icon('today') + '<span class="tool-label">Today</span></button>' +
        '<button type="button" class="tool" data-act="search" title="Search (/ or Ctrl+K)" aria-label="Search">' + ED.icon('search') + '</button>' +
        '<button type="button" class="tool opt' + (s.showCompleted ? '' : ' on') + '" data-act="toggle-completed" aria-pressed="' + !s.showCompleted + '" title="' + (s.showCompleted ? 'Hide completed tasks' : 'Show completed tasks') + '" aria-label="' + (s.showCompleted ? 'Hide completed tasks' : 'Show completed tasks') + '">' + ED.icon(s.showCompleted ? 'eye' : 'eyeOff') + '</button>' +
        '<button type="button" class="tool opt" data-act="goto-achievements" title="Achievements" aria-label="Achievements">' + ED.icon('trophy') + '</button>' +
        '<button type="button" class="tool" data-act="sync" id="sync-tool" title="' + e(sync.label) + '" aria-label="Backup and sync: ' + e(sync.label) + '">' + ED.icon(sync.icon || 'cloud') + '<span class="dot ' + e(sync.cls) + '"></span></button>' +
        (ED.look ? '<button type="button" class="tool opt" data-act="look" title="Diary look: colour, texture, pages" aria-label="Diary look">' + ED.icon('palette') + '</button>' : '') +
        '<button type="button" class="tool" data-act="theme" title="Theme: ' + tLabel + ' (click to change)">' + ED.icon(tIcon) + '<span class="tool-label">' + tLabel + '</span></button>' +
        '<button type="button" class="tool" data-act="open-settings" title="Settings" aria-label="Settings">' + ED.icon('gear') + '</button>' +
        '<button type="button" class="tool" data-act="close-diary" title="Close the diary (locks the password log, and the whole diary when it has a password)" aria-label="Close the diary">' + ED.icon('closeBook') + '</button>' +
        '<button type="button" class="tool opt" data-act="help" title="Help and keyboard shortcuts" aria-label="Help">' + ED.icon('help') + '</button>' +
        '</div>';
    },

    notices() {
      const out = [];
      const st = ED.store;
      if (st.loadError) out.push('<div class="notice err">' + ED.icon('xCircle') + '<span class="grow">Your saved diary could not be read, so nothing will be saved over it. Restore an automatic backup or import a backup file.</span><button type="button" class="btn small" data-act="open-settings" data-tab="data">Open backups</button></div>');
      else if (st.adapter && st.adapter.name === 'memory') out.push('<div class="notice err">' + ED.icon('wifiOff') + '<span class="grow">This browser is blocking storage, so changes are not saved. Use Chrome, Edge or Safari normally (not a private window), or export a backup before you close.</span><button type="button" class="btn small" data-act="export">Export backup</button></div>');
      if (ED.sync && ED.sync.notice) { const n = ED.sync.notice(); if (n) out.push(n); }
      if (ED.gdrive) { const n = ED.gdrive.notice(); if (n) out.push(n); }
      if (ED.gcal) { const n = ED.gcal.notice(); if (n) out.push(n); }
      if (S().sampleBanner && ED.sample.hasDemo(D())) out.push('<div class="notice info">' + ED.icon('sparkle') + '<span class="grow"><b>These are example entries</b> so you can see how the diary works. Clear them when you are ready to start your own.</span>' +
        '<button type="button" class="btn small" data-act="demo-clear">Clear examples</button><button type="button" class="btn small ghost" data-act="demo-keep">Keep for now</button></div>');
      return out.join('');
    },

    /* the pages of the current tab, as a bar in the top bar */
    subnav() {
      const g = groupOf(ED.state.tab);
      if (g.views.length < 2) return '<span class="spacer"></span>';
      return '<nav class="subnav" aria-label="Pages in ' + e(g.label.replace(/\u00ad/g, '')) + '">' + g.views.map((id, i) => '<button type="button" class="sub' + (id === ED.state.tab ? ' on' : '') + '" data-act="tab" data-tab="' + id + '"' + (id === ED.state.tab ? ' aria-current="page"' : '') + '>' + e(g.names[i]) + '</button>').join('') + '</nav>';
    },

    tabs() {
      const cur = GROUPS.indexOf(groupOf(ED.state.tab));
      const n = GROUPS.length;
      const tip = (s, i) => e((s.title || s.label).replace(/\u00ad/g, '')) + (i < 9 ? ' (' + (i + 1) + ')' : '');
      const tab = (s, i, side) => '<button type="button" class="tab' + (i === cur ? ' current' : '') + '" data-sec="' + s.views[0] + '" data-act="tab" data-tab="' + lastIn(s) + '"' +
        ' style="top:calc(' + i + ' * (100% / ' + n + ') + 2px);height:calc(100% / ' + n + ' - 4px)"' + (i === cur ? ' aria-current="page"' : '') + ' title="' + tip(s, i) + '"><span>' + e(s.label) + '</span></button>';
      this.els.tl.innerHTML = GROUPS.map((s, i) => i < cur ? tab(s, i, 'l') : '').join('');
      this.els.tr.innerHTML = GROUPS.map((s, i) => i >= cur ? tab(s, i, 'r') : '').join('');
      this.els.tl.classList.toggle('many', n > 7); this.els.tr.classList.toggle('many', n > 7);
      this.els.tl.classList.toggle('lots', n > 12); this.els.tr.classList.toggle('lots', n > 12);
      const bd = document.getElementById('binder'); if (bd) bd.classList.toggle('many-tabs', n > 7);
      this.els.strip.innerHTML = GROUPS.map((s, i) => '<button type="button" class="tab' + (i === cur ? ' current' : '') + '" data-sec="' + s.views[0] + '" data-act="tab" data-tab="' + lastIn(s) + '"' + (i === cur ? ' aria-current="page"' : '') + ' title="' + tip(s, i) + '"><span>' + e(s.label.replace(/\u00ad/g, '')) + '</span></button>').join('');
      const curTab = this.els.strip.querySelector('.current');
      if (curTab && curTab.scrollIntoView && this.els.strip.scrollWidth > this.els.strip.clientWidth) { try { curTab.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (err) { /* ignore */ } }
    },

    saveScroll() {
      U.$$('[data-keep-scroll]', this.els.spread).forEach(el => { ED.state.scroll[el.dataset.keepScroll] = el.scrollTop; });
    },
    restoreScroll(root) {
      U.$$('[data-keep-scroll]', root || this.els.spread).forEach(el => {
        const v = ED.state.scroll[el.dataset.keepScroll];
        if (v != null) { el.scrollTop = v; el.dataset.scrolled = '1'; }
      });
    },

    render() {
      if (!ED.store.data) return;
      this.raf = 0;
      const v = ED.views[ED.state.tab] || ED.views.daily;
      const active = document.activeElement;
      const focusId = active && active.id && this.els.spread && this.els.spread.contains(active) && !active.isContentEditable ? active.id : null;
      this.saveScroll();
      if (mounted && mounted.unmount) mounted.unmount();
      document.title = (v.label || 'Diary').replace(/\u00ad/g, '') + ' · ' + (S().diaryTitle || 'E-Diary');
      this.els.top.innerHTML = this.topbar();
      this.els.notices.innerHTML = this.notices();
      this.tabs();
      this.els.spread.classList.toggle('cal-full', !!ED.state.calFull);
      this.els.spread.dataset.view = v.id;
      const L = this.els.left, R = this.els.right;
      const turn = anim && ED.cover ? ED.cover.beginTurn(anim) : null;
      L.innerHTML = v.left();
      R.innerHTML = v.right();
      this.restoreScroll();
      mounted = v;
      if (v.mount) v.mount(L, R);
      if (turn) { anim = ''; try { turn(); } catch (err) { console.warn(err); } }
      if (anim) {
        const pages = U.$$('.page', this.els.spread);
        pages.forEach(p => { p.classList.remove('page-anim-fwd', 'page-anim-back'); void p.offsetWidth; p.classList.add('page-anim-' + anim); });
        anim = '';
      }
      if (focusId) { const f = document.getElementById(focusId); if (f) { try { f.focus({ preventScroll: true }); } catch (err) { /* ignore */ } } }
    },

    /* re-render one page only (keeps an editor on the other page untouched) */
    renderPage(side) {
      const v = ED.views[ED.state.tab];
      const el = side === 'left' ? this.els.left : this.els.right;
      U.$$('[data-keep-scroll]', el).forEach(x => { ED.state.scroll[x.dataset.keepScroll] = x.scrollTop; });
      el.innerHTML = side === 'left' ? v.left() : v.right();
      this.restoreScroll(el);
      if (side === 'left' && v.id === 'career' && ED.views.career.mountGraph) ED.views.career.mountGraph(el);
      if (side === 'left' && v.id === 'daily') ED.calpanel.afterRender(el);
    },

    requestRender() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => this.render());
    },

    applyTheme() {
      if (ED.look) ED.look.apply();   // cover colour, texture, paper, accent (js/look.js)
      const t = S().theme || 'auto';
      if (t === 'auto') document.documentElement.removeAttribute('data-ed-theme');
      else document.documentElement.setAttribute('data-ed-theme', t);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--leather').trim() || '#5c2618');
    },

    tickNow() {
      const top = U.nowMin() / 60 * ED.calpanel.HOUR;
      U.$$('.now-line').forEach(l => { l.style.top = top + 'px'; });
      if (ED.state.lastToday !== U.today()) {
        const old = ED.state.lastToday;
        ED.state.lastToday = U.today();
        if (old && ED.state.date === old) ED.go.date(U.today());
        else if (old) app.render();
      }
    },
  });

  /* ---------------- generic actions ---------------- */
  A.tab = el => ED.go.tab(el.dataset.tab);
  A['goto-today'] = () => { if (ED.state.tab !== 'daily' && ED.state.tab !== 'monthly' && ED.state.tab !== 'roles' && ED.state.tab !== 'goals') ED.state.tab = 'daily'; ED.go.date(U.today()); };
  A['goto-day'] = el => { ED.state.tab = 'daily'; ED.go.date(el.dataset.date); };
  A['goto-achievements'] = () => { ED.state.goalValue = null; ED.go.tab('goals'); setTimeout(() => { const h = document.querySelector('.goals .pg-sub'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); };
  A['day-prev'] = () => ED.go.date(U.addDays(ED.state.date, -1), 'back');
  A['day-next'] = () => ED.go.date(U.addDays(ED.state.date, 1), 'fwd');
  A['date-pick'] = el => {
    ED.ui.popover(el, '<form class="pick-date"><label class="lbl" for="jump-date">Go to date</label><input id="jump-date" class="field" type="date" value="' + ED.state.date + '"><div class="row-end"><button type="button" class="btn small" data-today>Today</button><button type="submit" class="btn small primary">Go</button></div></form>', {
      onMount(pe, p) {
        const inp = pe.querySelector('input'); inp.focus();
        pe.querySelector('[data-today]').addEventListener('click', () => { p.close(); ED.go.date(U.today()); });
        pe.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); if (U.isKey(inp.value)) { p.close(); ED.go.date(inp.value); } });
      },
    });
  };
  A['quote-next'] = () => {
    ED.state.quoteShift = (ED.state.quoteShift || 0) + 1;
    const q = document.querySelector('.banner .quote');
    if (q) q.innerHTML = ED.views.daily.quoteHtml(ED.state.date);
  };
  A['toggle-completed'] = () => { S().showCompleted = !S().showCompleted; ED.store.commit(); ED.ui.toast(S().showCompleted ? 'Showing completed tasks' : 'Completed tasks hidden'); };
  A.theme = () => {
    const order = ['auto', 'light', 'dark'];
    const s = S(); s.theme = order[(order.indexOf(s.theme || 'auto') + 1) % 3];
    app.applyTheme(); ED.store.commit();
    ED.ui.toast('Theme: ' + (s.theme === 'auto' ? 'Auto (follows your system)' : s.theme === 'light' ? 'Light' : 'Dark'));
  };
  A['demo-clear'] = async () => {
    const ok = await ED.ui.confirm({ title: 'Clear example entries', message: 'Remove all example tasks, events, goals, values, notes and the example mission? Your own entries, roles and categories stay.', ok: 'Clear examples', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Clear examples');
    ED.sample.clearDemo(D());
    ED.state.career.noteId = null;
    ED.store.commit();
    ED.ui.undoToast('Examples cleared — your diary is ready');
  };
  A['demo-keep'] = () => { S().sampleBanner = false; ED.store.commit(); ED.ui.toast('You can clear the examples later in Settings → Data.'); };

  /* tasks */
  A['task-open'] = (el, ev) => {
    if (ev && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI.occFrom(el);
    if (!o) return;
    ED.state.sel = o.oid;
    U.$$('.trow.sel').forEach(r => r.classList.remove('sel'));
    const row = el.closest('.trow'); if (row) row.classList.add('sel');
    ED.editors.task({ id: o.t.id, k: o.k || o.t.date });
  };
  A['task-toggle'] = el => { const o = ED.tasksUI.occFrom(el); if (o) ED.tasksUI.toggle(o); };
  A['task-menu'] = el => { const o = ED.tasksUI.occFrom(el); if (o) ED.tasksUI.menu(el, o); };
  A['task-new'] = () => {
    const q = document.getElementById('quick-add');
    const text = q && q.value.trim();
    const p = text ? M.parseQuick(text) : {};
    if (q) q.value = '';
    ED.editors.task({ create: { date: ED.state.date, title: p.title || '', prio: p.prio || S().defaultPrio, num: p.num || 0, time: p.time || null } });
  };
  A['daily-menu'] = el => ED.views.daily.menu(el);

  F['quick-add'] = form => {
    const inp = form.querySelector('input');
    const text = inp.value.trim();
    if (!text) { A['task-new'](); return; }
    const p = M.parseQuick(text);
    if (!p.title) return;
    const t = M.addTask({ title: p.title, prio: p.prio || S().defaultPrio, num: p.num || 0, date: ED.state.date, time: p.time });
    inp.value = '';
    ED.state.sel = t.id;
    ED.store.commit();
    ED.ui.toast('Added ' + M.code(t) + ' “' + t.title + '”' + (p.time ? ' at ' + U.fmtTime(p.time, S().h12) : ''), { action: 'Details', onAction: () => ED.editors.task({ id: t.id, k: t.date }) });
  };
  F['master-add'] = form => {
    const inp = form.querySelector('input');
    const text = inp.value.trim();
    if (!text) { A['master-new'](); return; }
    const p = M.parseQuick(text);
    if (!p.title) return;
    M.addTask({ title: p.title, prio: p.prio || S().defaultPrio, num: p.num || 0, date: null });
    inp.value = '';
    ED.store.commit();
    setTimeout(() => { const i = document.querySelector('[data-form="master-add"] input'); if (i) i.focus(); }, 0);
  };

  /* events & time slots */
  A['event-open'] = el => ED.editors.event({ id: el.dataset.id, k: el.dataset.k });
  A.slot = (el, ev) => {
    if (ev.target !== el) return;
    const k = el.dataset.date;
    const time = ED.calpanel.timeFromY(el, ev.clientY);
    const label = U.fmtTime(time, S().h12);
    ED.ui.menu({ x: ev.clientX, y: ev.clientY }, [
      { header: U.fmtDM(k) + ', ' + label },
      { label: 'New task at ' + label, icon: 'checkSq', onClick: () => ED.editors.task({ create: { date: k, time } }) },
      { label: 'New event at ' + label, icon: 'calendar', onClick: () => ED.editors.event({ create: { date: k, start: time, end: U.fromMin(U.toMin(time) + 60) } }) },
    ]);
  };

  /* mini calendars */
  A['mc-nav'] = el => {
    const id = el.dataset.mc, dir = +el.dataset.dir;
    const cur = ED.state.mc[id] || (id === 'daily' ? ED.state.date : U.firstOfMonth((ED.state.cal.monthly && ED.state.cal.monthly.anchor) || ED.state.date));
    if (id === 'm2') ED.state.mc.m1 = U.addMonths(U.firstOfMonth(ED.state.mc.m1 || cur), dir);
    else ED.state.mc[id] = U.addMonths(U.firstOfMonth(cur), dir);
    app.renderPage('left');
  };
  A['mc-title'] = el => {
    const id = el.dataset.mc;
    if (id === 'daily') { ED.state.mc.daily = U.today(); ED.go.date(U.today()); }
    else { ED.state.mc.m1 = U.firstOfMonth(U.today()); const s = ED.calpanel.st('monthly'); s.anchor = U.today(); app.render(); }
  };
  A['mc-pick'] = el => {
    const id = el.dataset.mc, k = el.dataset.date;
    if (id === 'daily') { ED.go.date(k); return; }
    const s = ED.calpanel.st(ED.state.tab === 'monthly' ? 'monthly' : ED.state.tab);
    s.anchor = k;
    app.render();
  };

  /* calendar panel */
  A['cp-nav'] = el => { const s = ED.calpanel.st(el.dataset.host); ED.calpanel.step(s, +el.dataset.dir); if (el.dataset.host === 'roles') ED.state.rolesWeek = s.anchor; app.render(); };
  A['cp-today'] = el => { const s = ED.calpanel.st(el.dataset.host); s.anchor = U.today(); if (el.dataset.host === 'roles') ED.state.rolesWeek = null; app.render(); };
  A['cp-expand'] = () => { ED.state.calFull = !ED.state.calFull; app.render(); };
  A['cp-unfilter'] = el => { ED.calpanel.st(el.dataset.host).filter = null; app.render(); };
  CH['cp-mode'] = el => {
    const s = ED.calpanel.st(el.dataset.host); s.mode = el.value;
    S().cal[el.dataset.host] = el.value;
    ED.store.commit();
  };

  A.help = () => ED.settings.help();
  A.search = () => ED.search.open();
  A.sync = () => ED.settings.open('data');
  A['open-settings'] = el => ED.settings.open(el && el.dataset.tab);
  A.export = () => ED.settings.exportBackup();

  /* ---------------- global listeners ---------------- */
  function bind() {
    document.addEventListener('click', ev => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = A[el.dataset.act];
      if (!fn) return;
      if (el.tagName === 'A') ev.preventDefault();
      fn(el, ev);
    });
    document.addEventListener('dblclick', ev => {
      const d = ev.target.closest('.mc-day');
      if (d && d.dataset.mc !== 'daily') { ED.state.tab = 'daily'; ED.go.date(d.dataset.date); }
    });
    document.addEventListener('change', ev => {
      const el = ev.target.closest('[data-change]');
      if (el && CH[el.dataset.change]) CH[el.dataset.change](el, ev);
    });
    document.addEventListener('submit', ev => {
      const f = ev.target.closest('form[data-form]');
      if (!f) return;
      ev.preventDefault();
      if (F[f.dataset.form]) F[f.dataset.form](f, ev);
    });
    document.addEventListener('contextmenu', ev => {
      const row = ev.target.closest('.trow, .cp-li, .m-t, .tg-task');
      if (!row || ev.target.closest('.mlayer')) return;
      const o = ED.tasksUI.occFrom(row);
      if (!o) return;
      ev.preventDefault();
      ED.tasksUI.menu({ x: ev.clientX, y: ev.clientY }, o);
    });
    document.addEventListener('keydown', ev => {
      const row = ev.target.closest && ev.target.closest('.trow');
      if (row && ev.target === row && !ED.ui.anyOpen()) {
        const o = ED.tasksUI.occFrom(row);
        if (ev.key === 'Enter') { ev.preventDefault(); A['task-open'](row); return; }
        if (ev.key === ' ') { ev.preventDefault(); if (o) ED.tasksUI.toggle(o); return; }
        if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); if (o) ED.tasksUI.remove(o); return; }
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          const rows = U.$$('.trow', app.els.spread); const i = rows.indexOf(row);
          const nx = rows[i + (ev.key === 'ArrowDown' ? 1 : -1)]; if (nx) nx.focus();
          return;
        }
      }
      if (ED.ui.anyOpen() || U.isTyping(ev.target)) return;
      if (ev.altKey) return;
      if ((ev.key === 'k' || ev.key === 'K') && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ED.search.open(); return; }
      if (ev.metaKey || ev.ctrlKey) return;
      if (ev.key === '/') { ev.preventDefault(); ED.search.open(); return; }
      if (ev.key === 't' || ev.key === 'T') { A['goto-today'](); return; }
      if (ev.key === 'n' || ev.key === 'N') {
        ev.preventDefault();
        if (ED.state.tab === 'monthly') A['master-new']();
        else if (ED.state.tab === 'goals') A['goal-new']();
        else if (ED.state.tab === 'roles') A['role-new']();
        else if (ED.state.tab === 'career') A['note-new']();
        else if (ED.state.tab === 'finance') A['fin-add']();
        else if (ED.state.tab === 'vault') A['vault-new']();
        else if (ED.state.tab.indexOf('study') === 0) { if (ED.study.plan()) A['study-add']({ dataset: {} }); else ED.study.importFile(); }
        else ED.editors.task({ create: { date: ED.state.date } });
        return;
      }
      if (ev.key === 'e' || ev.key === 'E') { ev.preventDefault(); ED.editors.event({ create: { date: ED.state.date } }); return; }
      if (ev.key === '?') { ED.settings.help(); return; }
      if (/^[0-9]$/.test(ev.key)) { const i = ev.key === '0' ? 9 : +ev.key - 1; if (GROUPS[i]) { ED.go.tab(lastIn(GROUPS[i])); return; } }
      const v = ED.views[ED.state.tab];
      if (v && v.key && v.key(ev)) { ev.preventDefault(); return; }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        const host = ED.state.tab;
        if (host === 'monthly' || host === 'roles' || host === 'goals') {
          const s = ED.calpanel.st(host); ED.calpanel.step(s, ev.key === 'ArrowLeft' ? -1 : 1); app.render();
        }
      }
    });
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '');
      if (ED.views[h] && h !== ED.state.tab) ED.go.tab(h);
    });
    setInterval(() => app.tickNow(), 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') app.tickNow(); });
    bindDnD();
  }

  /* ---------------- drag & drop ---------------- */
  function bindDnD() {
    let drag = null;
    const clear = () => U.$$('.drop-hover, .drop-before, .drop-after').forEach(x => x.classList.remove('drop-hover', 'drop-before', 'drop-after'));
    document.addEventListener('dragstart', ev => {
      const el = ev.target.closest && ev.target.closest('[data-drag]');
      if (!el) return;
      const type = el.dataset.drag;
      drag = type === 'task'
        ? { type, tid: el.dataset.tid, k: el.dataset.k || '', carried: el.dataset.carried === '1' }
        : { type, id: el.dataset.id, k: el.dataset.k || '' };
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', (drag.tid || drag.id)); } catch (err) { /* ignore */ }
      requestAnimationFrame(() => el.classList.add('dragging'));
    });
    document.addEventListener('dragend', () => { U.$$('.dragging').forEach(x => x.classList.remove('dragging')); clear(); drag = null; });
    document.addEventListener('dragover', ev => {
      if (!drag) return;
      clear();
      if (drag.type === 'event') {
        const z = ev.target.closest('[data-drop="day"], [data-drop="allday"], [data-drop="time"]');
        if (!z) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        z.classList.add('drop-hover');
      } else if (drag.type === 'task') {
        const row = ev.target.closest('.trow');
        if (row && row.dataset.tid !== drag.tid && (row.dataset.k || '') === drag.k) {
          ev.preventDefault();
          const r = row.getBoundingClientRect();
          row.classList.add(ev.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
          return;
        }
        const z = ev.target.closest('[data-drop]');
        if (!z) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        z.classList.add('drop-hover');
      } else {
        const card = ev.target.closest('[data-drag="' + drag.type + '"]');
        if (!card || card.dataset.id === drag.id) return;
        ev.preventDefault();
        const r = card.getBoundingClientRect();
        card.classList.add(ev.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
      }
    });
    document.addEventListener('drop', ev => {
      if (!drag) return;
      const d = drag; drag = null;
      clear();
      if (d.type === 'event') {
        const x = M.event(d.id); if (!x) return;
        const z = ev.target.closest('[data-drop="day"], [data-drop="allday"], [data-drop="time"]'); if (!z) return;
        ev.preventDefault();
        const k = z.dataset.date; if (!U.isKey(k)) return;
        const kind = z.dataset.drop;
        const from = d.k || x.date;
        let patch;
        if (kind === 'time') patch = { date: k, start: ED.calpanel.timeFromY(z, ev.clientY) };
        else if (kind === 'allday') { if (x.allDay && k === from) return; patch = { date: k, allDay: true }; }
        else { if (k === from) return; patch = { date: k }; }
        ED.store.checkpoint('Move event');
        const nx = M.moveEvent(x, from, patch);
        ED.store.commit();
        ED.ui.undoToast((x.repeat ? 'This day of “' + x.title + '” moved to ' : 'Moved to ') + U.relDay(nx.date) + (nx.allDay ? ' (all day)' : ' at ' + U.fmtTime(nx.start, S().h12)));
        if (ED.gcal) ED.gcal.afterDrop('e:' + nx.id);
        return;
      }
      if (d.type === 'task') {
        const t = M.task(d.tid); if (!t) return;
        const occ = M.occ(t, d.k || t.date || null, d.carried);
        const row = ev.target.closest('.trow');
        if (row && row.dataset.tid !== d.tid && (row.dataset.k || '') === d.k) {
          ev.preventDefault();
          reorder(t, M.task(row.dataset.tid), d.k || null, ev.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
          return;
        }
        const z = ev.target.closest('[data-drop]'); if (!z) return;
        ev.preventDefault();
        const kind = z.dataset.drop;
        if (kind === 'master') {
          if (t.repeat) { ED.ui.toast('Repeating tasks need a date. Turn off repeat first.'); return; }
          if (!t.date) return;
          ED.store.checkpoint('Move'); M.moveOcc(occ, null); ED.store.commit(); ED.ui.undoToast('Moved to Master Tasks'); return;
        }
        const k = z.dataset.date; if (!U.isKey(k)) return;
        if (kind === 'allday') {
          if (t.allDay && k === (d.k || t.date) && !d.carried) return;
          ED.store.checkpoint('Move');
          const nt = M.moveOcc(occ, k, null, true);
          ED.store.commit();
          ED.ui.undoToast('“' + nt.title + '” is now an all-day task on ' + U.relDay(nt.date));
          if (ED.gcal) ED.gcal.afterDrop('t:' + nt.id);
          return;
        }
        let time;
        if (kind === 'time') time = ED.calpanel.timeFromY(z, ev.clientY);
        if (!time && k === (d.k || t.date) && !d.carried) return;
        ED.store.checkpoint('Move');
        const nt = M.moveOcc(occ, k, time);
        ED.store.commit();
        ED.ui.undoToast((t.repeat ? 'This day of the repeating task moved to ' : 'Moved to ') + U.relDay(nt.date) + (time ? ' at ' + U.fmtTime(time, S().h12) : ''));
        if (ED.gcal) ED.gcal.afterDrop('t:' + nt.id);
      } else {
        const card = ev.target.closest('[data-drag="' + d.type + '"]');
        if (!card || card.dataset.id === d.id) return;
        ev.preventDefault();
        const list = d.type === 'role' ? M.rolesSorted() : M.valuesSorted();
        const moving = list.find(x => x.id === d.id), target = list.find(x => x.id === card.dataset.id);
        if (!moving || !target) return;
        const r = card.getBoundingClientRect();
        const before = ev.clientY < r.top + r.height / 2;
        const rest = list.filter(x => x !== moving);
        rest.splice(rest.indexOf(target) + (before ? 0 : 1), 0, moving);
        rest.forEach((x, i) => { x.order = i; });
        ED.store.commit();
      }
    });
  }

  function reorder(t, target, k, before) {
    if (!target) return;
    const list = k ? M.tasksOn(k).map(o => o.t) : M.masterTasks();
    const same = list.filter(x => x.prio === target.prio && x.id !== t.id).sort(M.cmpTask);
    const i = same.indexOf(target);
    same.splice(before ? i : i + 1, 0, t);
    t.prio = target.prio;
    same.forEach((x, n) => { x.num = n + 1; });
    ED.store.commit();
    ED.ui.toast('Now ' + M.code(t) + ' — priorities renumbered');
  }

  /* ---------------- start ---------------- */
  async function start() {
    app.shell();
    app.els.left.innerHTML = '<p class="loading-note">Opening your diary…</p>';
    try {
      await ED.store.init();
    } catch (err) {
      console.error(err);
      app.els.left.innerHTML = '<p class="loading-note">The diary could not start: ' + e(err.message || err) + '</p>';
      return;
    }
    const h = (location.hash || '').replace('#', '');
    if (ED.views[h]) ED.state.tab = h;
    ED.state.lastToday = U.today();
    app.applyTheme();
    if (window.matchMedia) {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      const fn = () => app.applyTheme();
      if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
    }
    ED.store.on((type, detail) => {
      if (type === 'change') {
        if (detail && (detail.reason === 'replace' || detail.reason === 'undo' || detail.reason === 'restore' || detail.reason === 'remote' || detail.reason === 'other-tab')) app.applyTheme();
        app.requestRender();
      }
      if (type === 'saved' || type === 'save-error') { const t = document.getElementById('sync-tool'); if (t && ED.sync) { const s = ED.sync.status(); t.title = s.label; const dot = t.querySelector('.dot'); if (dot) dot.className = 'dot ' + s.cls; } }
    });
    bind();
    app.render();
    document.getElementById('app').removeAttribute('aria-busy');
    if (ED.cover) {
      ED.cover.remember();
      ED.store.on(type => { if (type === 'change') { ED.cover.remember(); ED.cover.refresh(); } });
      if (ED.cover.el) setTimeout(() => ED.cover.open(), ED.cover.enabled() ? 650 : 0);
    }
    if (ED.reminders) ED.reminders.start();
    if (ED.lock) ED.lock.startIdle();
    if (ED.sync) ED.sync.init();
    if (ED.gdrive) ED.gdrive.init();   // Google Drive sync (js/gdrive.js)
    if (ED.gcal) ED.gcal.init();
    if (ED.jobs && ED.jobs.dirInit) ED.jobs.dirInit();
    if (ED.purchases && ED.purchases.reconcile()) ED.store.commit({ reason: 'purchases' });   // grocery task & bills (js/purchases.js)
    registerSW();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || !ED.env.http || ED.env.claude || ED.env.framed) return;
    if (!document.querySelector('link[rel="manifest"]')) return;
    const go = () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.update().catch(() => {});
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing; if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              ED.ui.toast('A new version of the diary is ready.', { action: 'Reload', timeout: 0, onAction: () => location.reload() });
            }
          });
        });
      }).catch(err => console.warn('[e-diary] offline support unavailable:', err && err.message));
    };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }

  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); ED.installPrompt = ev; });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
