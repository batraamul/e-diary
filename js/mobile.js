/* E-Diary — the phone layout (added in 1.14). On a phone (or a narrow window, or with ?mobile=1 in the address) the
   diary gets: a bar at the bottom for Today · Planner · Notes & Life · Money · More, a round + button to add a task,
   swipe left/right on the daily page to change the day, bigger touch targets, and "More" with every other section and
   tool (search, look, backup & sync, install as an app). Settings → Install & Help can switch it on or off by hand.
   Start-up addresses used by the installed app's shortcuts and by Android's Share menu:
     ?new=task            open a new task          ?go=groceries | bills | today   open that page
     ?title=…&text=…&url=…  (shared from another app) a new task with that text */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const A = (ED.actions = ED.actions || {});
  const KEY = 'e-diary-layout';           // 'auto' | 'phone' | 'computer' (this device only)
  const MB = (ED.mobile = {});
  const params = new URLSearchParams(location.search);
  const mq = window.matchMedia ? matchMedia('(max-width: 760px)') : { matches: false };
  MB.pref = () => U.lsGet(KEY, 'auto') || 'auto';
  MB.on = () => { const p = MB.pref(); return p === 'phone' || params.get('mobile') === '1' || (p === 'auto' && mq.matches); };
  const html = document.documentElement;
  const sync = () => { html.classList.toggle('ed-mobile', MB.on()); };
  sync();
  if (mq.addEventListener) mq.addEventListener('change', () => { sync(); if (ED.app && ED.store.data) ED.app.render(); });

  const NAV = [['daily', 'Today', 'today'], ['weekly', 'Planner', 'calendar'], ['career', 'Notes & Life', 'doc'], ['finance', 'Money', 'wallet'], ['more', 'More', 'menu']];
  const groupOf = id => (ED.GROUPS || []).find(g => g.views.indexOf(id) >= 0) || {};
  MB.paint = () => {
    let nav = document.getElementById('m-nav'), fab = document.getElementById('m-fab');
    if (!MB.on()) { if (nav) nav.remove(); if (fab) fab.remove(); return; }
    if (!nav) { nav = document.createElement('nav'); nav.id = 'm-nav'; nav.setAttribute('aria-label', 'Main'); document.body.appendChild(nav); }
    const tab = ED.state.tab, g = groupOf(tab).id;
    const cur = id => id === 'daily' ? tab === 'daily' : id === 'weekly' ? g === 'planner' && tab !== 'daily' : id === 'career' ? tab === 'career' : id === 'finance' ? g === 'money' : id === 'more' ? !['planner', 'life', 'money'].includes(g) : false;
    nav.innerHTML = NAV.map(x => '<button type="button" class="m-nb' + (cur(x[0]) ? ' on' : '') + '" data-mnav="' + x[0] + '"' + (cur(x[0]) ? ' aria-current="page"' : '') + '>' + ED.icon(x[2]) + '<span>' + e(x[1]) + '</span></button>').join('');
    const showFab = g === 'planner' || tab === 'daily';
    if (showFab && !fab) { fab = document.createElement('button'); fab.id = 'm-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Add a task'); fab.innerHTML = ED.icon('plus'); document.body.appendChild(fab); fab.addEventListener('click', () => A['task-new']()); }
    if (!showFab && fab) fab.remove();
  };
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-mnav]'); if (!b) return;
    const k = b.dataset.mnav;
    if (k === 'more') { MB.more(); return; }
    if (k === 'daily') { ED.state.tab = 'daily'; ED.go.date(U.today()); return; }
    if (k === 'weekly') { ED.go.tab((ED.state.groupLast && ED.state.groupLast.planner && ED.state.groupLast.planner !== 'daily') ? ED.state.groupLast.planner : 'weekly'); return; }
    ED.go.tab(k === 'finance' ? ((ED.state.groupLast && ED.state.groupLast.money) || 'finance') : k);
  });

  /* "More": every section and tool */
  MB.more = () => {
    const S = ED.store.data.settings;
    const secs = (ED.GROUPS || []).map(g => '<button type="button" class="m-sec" data-msec="' + e(g.views[0]) + '" style="--t1:var(--tab-' + e(g.views[0] === 'roles' ? 'roles' : g.views[0] === 'studyYear' ? 'study' : g.views[0] === 'finance' ? 'finance' : g.views[0] === 'interview' ? 'interview' : g.views[0] === 'health' ? 'health' : g.views[0] === 'vault' ? 'vault' : g.views[0] === 'career' ? 'career' : 'daily') + ')"><b>' + e(g.label.replace(/­/g, '')) + '</b><span>' + e((g.names || [g.label]).join(' · ').replace(/­/g, '')) + '</span></button>').join('');
    const tool = (k, icon, label) => '<button type="button" class="m-tool" data-mtool="' + k + '">' + ED.icon(icon) + '<span>' + e(label) + '</span></button>';
    ED.ui.modal({
      title: 'More', cls: 'm-more',
      body: '<div class="m-secs">' + secs + '</div><div class="m-tools">' +
        tool('search', 'search', 'Search') + tool('look', 'palette', 'Diary look') + tool('theme', S.theme === 'dark' ? 'moon' : S.theme === 'light' ? 'sun' : 'auto', 'Light / dark: ' + (S.theme === 'dark' ? 'Dark' : S.theme === 'light' ? 'Light' : 'Auto')) +
        tool('data', 'cloud', 'Backup & Sync') + tool('settings', 'gear', 'Settings') + tool('done', S.showCompleted ? 'eyeOff' : 'eye', S.showCompleted ? 'Hide completed' : 'Show completed') +
        tool('ach', 'trophy', 'Achievements') + (ED.installPrompt ? tool('install', 'install', 'Install as an app') : '') + tool('help', 'help', 'Help') +
        tool('computer', 'grid', 'Computer layout') + tool('close', 'closeBook', 'Close the diary') + '</div>',
      onMount(el, m) {
        el.addEventListener('click', async ev => {
          const s = ev.target.closest('[data-msec]');
          if (s) { m.close(); const g = groupOf(s.dataset.msec); ED.go.tab((ED.state.groupLast && ED.state.groupLast[g.id]) || s.dataset.msec); return; }
          const t = ev.target.closest('[data-mtool]'); if (!t) return;
          const k = t.dataset.mtool; m.close();
          if (k === 'search') A.search();
          else if (k === 'look') ED.settings.open('look');
          else if (k === 'theme') A.theme();
          else if (k === 'data') ED.settings.open('data');
          else if (k === 'settings') ED.settings.open('general');
          else if (k === 'done') A['toggle-completed']();
          else if (k === 'ach' && A['goto-achievements']) A['goto-achievements']();
          else if (k === 'help') ED.settings.open('help');
          else if (k === 'close' && A['close-diary']) A['close-diary']();
          else if (k === 'install') MB.install();
          else if (k === 'computer') { MB.setPref('computer'); ED.ui.toast('Computer layout on this device — Settings → Install & Help switches back.'); }
        });
      },
    });
  };
  MB.setPref = p => { U.lsSet(KEY, p); sync(); ED.app.render(); };
  MB.install = async () => {
    if (!ED.installPrompt) { ED.ui.toast('Use the browser menu ⋮ → “Install app” (or “Add to Home screen”).', { timeout: 7000 }); return; }
    ED.installPrompt.prompt();
    try { await ED.installPrompt.userChoice; } catch (err) { /* ignore */ }
    ED.installPrompt = null;
  };
  // the browser says the diary can be installed: offer it once on a phone
  window.addEventListener('beforeinstallprompt', () => {
    if (!MB.on() || U.lsGet('e-diary-install-asked', false)) return;
    U.lsSet('e-diary-install-asked', true);
    setTimeout(() => ED.ui.toast('Install E-Diary as an app on this phone?', { action: 'Install', timeout: 12000, onAction: () => MB.install() }), 1500);
  });

  /* swipe left / right on the daily page = next / previous day */
  let t0 = null;
  document.addEventListener('touchstart', ev => {
    if (!MB.on() || ED.state.tab !== 'daily' || ev.touches.length !== 1) { t0 = null; return; }
    if (ev.target.closest('input, textarea, select, [contenteditable="true"], .tg-grid, .mframe, #m-nav, .tlist [draggable]')) { t0 = null; return; }
    t0 = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', ev => {
    if (!t0) return;
    const p = ev.changedTouches[0], dx = p.clientX - t0.x, dy = p.clientY - t0.y, dt = Date.now() - t0.t; t0 = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 700) ED.go.date(U.addDays(ED.state.date, dx < 0 ? 1 : -1), dx < 0 ? 'fwd' : 'back');
  }, { passive: true });

  /* the layout after every render */
  const r0 = ED.app.render;
  ED.app.render = function () { const out = r0.apply(this, arguments); try { MB.paint(); } catch (err) { console.warn(err); } return out; };

  /* start-up addresses (app shortcuts, Android's Share menu) */
  const startUp = () => {
    if (!ED.store.data) { setTimeout(startUp, 150); return; }
    const go = params.get('go'), shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' — ').trim();
    if (go === 'groceries') { ED.state.career.mode = 'grocery'; ED.go.tab('career'); }
    else if (go === 'bills') { (ED.state.fin = ED.state.fin || {}).rtab = 'bills'; ED.go.tab('finance'); }
    else if (go === 'today') ED.go.day(U.today());
    if (params.get('new') === 'task' || shared) setTimeout(() => ED.editors.task({ create: { date: U.today(), title: shared.slice(0, 200) } }), 400);
    if (go || shared || params.get('new')) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (err) { /* ignore */ } }
  };
  if (params.toString()) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(startUp, 300)); else setTimeout(startUp, 300); }
})();
