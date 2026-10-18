/* E-Diary — settings, backups, help */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings;
  const D = () => ED.store.data;
  const opt = (v, label, sel) => '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';
  const sw = (id, on, label, hint) => '<div class="set-row"><label class="switch" for="' + id + '"><input id="' + id + '" type="checkbox"' + (on ? ' checked' : '') + '><span class="track"></span><span>' + e(label) + '</span></label>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';

  const TABS = [
    ['general', 'General', 'gear'], ['look', 'Appearance', 'palette'], ['categories', 'Categories', 'list'], ['weather', 'Weather & Quotes', 'wPartly'],
    ['reminders', 'Reminders', 'bell'], ['gcal', 'Google Calendar', 'calendar'], ['data', 'Backup & Sync', 'cloud'], ['lock', 'Password lock', 'lock'], ['help', 'Install & Help', 'help'],
  ];

  const SET = (ED.settings = {
    api: null,

    open(tab) {
      tab = TABS.some(t => t[0] === tab) ? tab : 'general';
      if (SET.api) SET.api.close();
      SET.api = ED.ui.modal({
        cls: 'settings', label: 'Settings', title: 'Settings',
        body: '<div class="set-wrap"><nav class="set-nav" role="tablist" aria-label="Settings sections">' +
          TABS.map(t => '<button type="button" role="tab" class="set-tab" data-stab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + ED.icon(t[2]) + '<span>' + e(t[1]) + '</span></button>').join('') +
          '</nav><div class="set-body" id="set-body"></div></div>',
        onClose() { SET.api = null; },
        onMount(el, m) {
          SET.api = m;
          el.querySelector('.set-nav').addEventListener('click', ev => {
            const b = ev.target.closest('[data-stab]'); if (!b) return;
            U.$$('.set-tab', el).forEach(x => x.setAttribute('aria-selected', String(x === b)));
            SET.show(b.dataset.stab);
          });
          SET.show(tab);
        },
        noAutoFocus: true,
      });
    },
    help() { SET.open('help'); },

    show(tab) {
      const body = SET.api && SET.api.el.querySelector('#set-body');
      if (!body) return;
      SET.tab = tab;
      body.innerHTML = SET['tab_' + tab]();
      body.scrollTop = 0;
      const b = SET['bind_' + tab]; if (b) b(body);
    },
    refresh() { if (SET.api) SET.show(SET.tab); },

    init() {
      ED.store.on(type => { if (type === 'change' && SET.api && SET.tab === 'categories') SET.refresh(); });
    },

    /* ---------------- General ---------------- */
    tab_general() {
      const s = S();
      const hours = Array.from({ length: 24 }, (_, h) => h);
      return '<h3 class="set-h">Your diary</h3>' +
        '<div class="set-grid"><div class="set-row"><label class="lbl" for="sg-title">Diary name</label><input id="sg-title" class="field" value="' + e(s.diaryTitle) + '" maxlength="40"></div>' +
        '<div class="set-row"><label class="lbl" for="sg-owner">Your name</label><input id="sg-owner" class="field" value="' + e(s.ownerName) + '" placeholder="Shown on the cover" maxlength="60"></div></div>' +
        '<h3 class="set-h">Look and calendar</h3>' +
        '<div class="set-grid">' +
        '<div class="set-row"><label class="lbl" for="sg-theme">Theme</label><select id="sg-theme" class="field">' + opt('auto', 'Auto — follow my computer', s.theme === 'auto') + opt('light', 'Light', s.theme === 'light') + opt('dark', 'Dark', s.theme === 'dark') + '</select></div>' +
        '<div class="set-row"><label class="lbl" for="sg-week">Week starts on</label><select id="sg-week" class="field">' + opt(0, 'Sunday', s.weekStart === 0) + opt(1, 'Monday (ISO weeks)', s.weekStart === 1) + '</select></div>' +
        '<div class="set-row"><label class="lbl" for="sg-h12">Time format</label><select id="sg-h12" class="field">' + opt(1, '12-hour (9:30 AM)', s.h12) + opt(0, '24-hour (09:30)', !s.h12) + '</select></div>' +
        '<div class="set-row"><label class="lbl" for="sg-prio">Priority for new tasks</label><select id="sg-prio" class="field">' + M.PRIOS.map(p => opt(p, p + ' — ' + M.PRIO_HELP[p], s.defaultPrio === p)).join('') + '</select></div>' +
        '<div class="set-row"><label class="lbl" for="sg-daystart">Timeline opens at</label><select id="sg-daystart" class="field">' + hours.slice(0, 13).map(h => opt(h, U.pad(h) + ':00', s.dayStart === h)).join('') + '</select></div>' +
        '<div class="set-row"><label class="lbl" for="sg-af">Active hours (shaded)</label><div class="te-dt"><select id="sg-af" class="field">' + hours.map(h => opt(h, U.pad(h) + ':00', s.activeFrom === h)).join('') + '</select><span class="hint">to</span><select id="sg-at" class="field" aria-label="Active hours end">' + hours.slice(1).concat([24]).map(h => opt(h, U.pad(h % 24) + ':00', s.activeTo === h)).join('') + '</select></div></div>' +
        '</div>' +
        '<h3 class="set-h">Tasks</h3>' +
        sw('sg-carry', s.carryForward, 'Carry unfinished tasks forward to today', 'Tasks left open on earlier days appear on today’s page, marked with the day they came from, until you complete, move or cancel them.') +
        '<div class="set-row"><label class="lbl" for="sg-carrydays">Carry tasks that are at most</label><select id="sg-carrydays" class="field narrow">' +
        [[7, '1 week old'], [14, '2 weeks old'], [30, '30 days old'], [60, '60 days old'], [90, '90 days old'], [365, '1 year old'], [0, 'any age']].map(x => opt(x[0], x[1], (s.carryDays == null ? 30 : s.carryDays) === x[0])).join('') + '</select></div>' +
        sw('sg-done', s.showCompleted, 'Show completed tasks', 'When off, completed, forwarded and cancelled tasks are hidden from lists.') +
        '<h3 class="set-h">The diary</h3>' +
        sw('sg-cover', s.cover !== false, 'Open from the closed cover', 'The diary starts closed and opens with a page turn. The book button at the top closes it again (and locks the password log).');
    },
    bind_general(b) {
      const s = S();
      const on = (id, ev, fn) => b.querySelector('#' + id).addEventListener(ev, fn);
      on('sg-title', 'input', U.debounce(ev => { s.diaryTitle = ev.target.value.trim() || 'My E-Diary'; ED.store.commit(); }, 350));
      on('sg-owner', 'input', U.debounce(ev => { s.ownerName = ev.target.value.trim(); ED.store.commit(); }, 350));
      on('sg-theme', 'change', ev => { s.theme = ev.target.value; ED.app.applyTheme(); ED.store.commit(); });
      on('sg-week', 'change', ev => { s.weekStart = +ev.target.value; ED.store.commit(); });
      on('sg-h12', 'change', ev => { s.h12 = ev.target.value === '1'; ED.store.commit(); });
      on('sg-prio', 'change', ev => { s.defaultPrio = ev.target.value; ED.store.commit(); });
      on('sg-daystart', 'change', ev => { s.dayStart = +ev.target.value; ED.state.scroll = {}; ED.store.commit(); });
      on('sg-af', 'change', ev => { s.activeFrom = +ev.target.value; ED.store.commit(); });
      on('sg-at', 'change', ev => { s.activeTo = +ev.target.value; ED.store.commit(); });
      on('sg-carry', 'change', ev => { s.carryForward = ev.target.checked; ED.store.commit(); });
      on('sg-carrydays', 'change', ev => { s.carryDays = +ev.target.value; ED.store.commit(); });
      on('sg-done', 'change', ev => { s.showCompleted = ev.target.checked; ED.store.commit(); });
      on('sg-cover', 'change', ev => { s.cover = ev.target.checked; ED.store.commit(); });
    },

    /* ---------------- Google Calendar (js/gcal.js) ---------------- */
    tab_gcal() { return ED.gcal ? ED.gcal.settingsHtml() : ''; },
    bind_gcal(b) { if (ED.gcal) ED.gcal.bindSettings(b); },

    /* ---------------- Categories ---------------- */
    tab_categories() {
      const cats = D().categories;
      return '<h3 class="set-h">Categories</h3><p class="hint">A category colours a task’s title (like the red and blue titles on a paper planner) and groups tasks in the week view.</p>' +
        '<ul class="set-list">' + cats.map(c => {
          const n = D().tasks.filter(t => t.categoryId === c.id).length;
          return '<li><span class="emo">' + e(c.icon || '•') + '</span><span class="set-swatch" style="--sw:' + e(c.color) + '"></span><span class="grow tinted" style="--c:' + e(c.color) + '">' + e(c.name) + '</span><span class="hint num">' + U.plural(n, 'task') + '</span>' +
            '<button type="button" class="btn small" data-sc="edit" data-id="' + e(c.id) + '">' + ED.icon('pencil') + 'Edit</button></li>';
        }).join('') + '</ul>' +
        '<button type="button" class="btn" data-sc="add">' + ED.icon('plus') + 'Add category</button>' +
        '<h3 class="set-h">Roles</h3><p class="hint">Roles group your daily list (the “FROG” headings). Manage them on the Roles tab.</p>' +
        '<button type="button" class="btn" data-sc="roles">' + ED.icon('compass') + 'Open Roles</button>';
    },
    bind_categories(b) {
      b.addEventListener('click', ev => {
        const x = ev.target.closest('[data-sc]'); if (!x) return;
        if (x.dataset.sc === 'add') ED.editors.category(null);
        if (x.dataset.sc === 'edit') ED.editors.category(x.dataset.id);
        if (x.dataset.sc === 'roles') { SET.api.close(); ED.go.tab('roles'); }
      });
    },

    /* ---------------- Weather & Quotes ---------------- */
    tab_weather() {
      const w = S().weather;
      const own = D().quotes;
      return '<h3 class="set-h">Weather</h3>' +
        sw('sw-on', w.on, 'Show weather on the daily page', 'Forecasts come from Open-Meteo (free, no account). Past week and next 16 days are available.') +
        '<div class="set-row"><span class="lbl">Location</span><div class="wx-loc"><b id="sw-cur">' + e(w.name) + (w.admin ? ', ' + e(w.admin) : '') + (w.country ? ', ' + e(w.country) : '') + '</b><span class="hint num">' + (w.lat != null ? w.lat.toFixed(2) + '°, ' + w.lon.toFixed(2) + '°' : '') + '</span></div></div>' +
        '<form class="set-row wx-search" id="sw-form"><label class="lbl" for="sw-q">Change city</label><div class="inline"><input id="sw-q" class="field" placeholder="e.g. Pune, Jaipur, London" autocomplete="off"><button type="submit" class="btn">' + ED.icon('search') + 'Find</button></div><ul class="wx-results" id="sw-res"></ul></form>' +
        '<div class="set-row"><label class="lbl" for="sw-unit">Temperature</label><select id="sw-unit" class="field narrow">' + opt('C', 'Celsius (°C)', w.unit !== 'F') + opt('F', 'Fahrenheit (°F)', w.unit === 'F') + '</select></div>' +
        (ED.env.claude ? '<p class="hint">Weather needs the self-hosted copy of the diary; this preview page cannot reach the forecast service.</p>' : '') +
        '<h3 class="set-h">Quote of the day</h3>' +
        sw('sq-builtin', S().builtinQuotes !== false, 'Include the built-in quotes', 'Kalam, Vivekananda, Covey, Tagore and others. A different one appears each day.') +
        '<ul class="set-list quotes">' + own.map((q, i) => '<li><span class="grow">“' + e(q.text) + '” <span class="hint">— ' + e(q.author || 'Unknown') + '</span></span><button type="button" class="icon-btn sm" data-sq="del" data-i="' + i + '" aria-label="Remove quote">' + ED.icon('x') + '</button></li>').join('') + '</ul>' +
        '<form class="set-row" id="sq-form"><label class="lbl" for="sq-text">Add your own quote</label><textarea id="sq-text" class="field" rows="2" placeholder="The quote"></textarea>' +
        '<div class="inline"><input id="sq-author" class="field" placeholder="Author"><button type="submit" class="btn">' + ED.icon('plus') + 'Add</button></div></form>';
    },
    bind_weather(b) {
      const w = S().weather;
      b.querySelector('#sw-on').addEventListener('change', ev => { w.on = ev.target.checked; ED.store.commit(); });
      b.querySelector('#sw-unit').addEventListener('change', ev => { w.unit = ev.target.value; ED.store.commit(); ED.weather.refresh(true).then(() => ED.app.requestRender()); });
      b.querySelector('#sq-builtin').addEventListener('change', ev => { S().builtinQuotes = ev.target.checked; ED.store.commit(); });
      b.querySelector('#sw-form').addEventListener('submit', async ev => {
        ev.preventDefault();
        const q = b.querySelector('#sw-q').value.trim(); if (!q) return;
        const res = b.querySelector('#sw-res');
        res.innerHTML = '<li class="hint">Searching…</li>';
        try {
          const list = await ED.weather.searchCity(q);
          res.innerHTML = list.length ? list.map((c, i) => '<li><button type="button" class="link-btn" data-i="' + i + '">' + e(c.name) + (c.admin ? ', ' + e(c.admin) : '') + (c.country ? ', ' + e(c.country) : '') + '</button> <span class="hint num">' + c.lat + ', ' + c.lon + '</span></li>').join('') : '<li class="hint">No place found. Try a nearby city.</li>';
          res.onclick = x => {
            const btn = x.target.closest('[data-i]'); if (!btn) return;
            const c = list[+btn.dataset.i];
            Object.assign(w, { name: c.name, admin: c.admin, country: c.country, lat: c.lat, lon: c.lon, on: true });
            ED.store.commit();
            ED.weather.refresh(true).then(() => ED.app.requestRender());
            SET.refresh();
            ED.ui.toast('Weather location: ' + c.name);
          };
        } catch (err) {
          res.innerHTML = '<li class="hint">Could not reach the weather service' + (ED.env.claude ? ' from this preview page.' : '. Check your internet connection.') + '</li>';
        }
      });
      b.querySelector('#sq-form').addEventListener('submit', ev => {
        ev.preventDefault();
        const t = b.querySelector('#sq-text').value.trim(); if (!t) return;
        D().quotes.push({ text: t, author: b.querySelector('#sq-author').value.trim() });
        ED.store.commit(); SET.refresh();
      });
      b.addEventListener('click', ev => {
        const x = ev.target.closest('[data-sq="del"]'); if (!x) return;
        D().quotes.splice(+x.dataset.i, 1); ED.store.commit(); SET.refresh();
      });
    },

    /* ---------------- Reminders ---------------- */
    tab_reminders() {
      const perm = 'Notification' in window ? Notification.permission : 'unsupported';
      const permText = { granted: 'Allowed — reminders also pop up outside the browser window.', denied: 'Blocked in this browser’s site settings. Reminders still show inside the diary.', default: 'Not asked yet.', unsupported: 'This browser cannot show system notifications. Reminders show inside the diary.' }[perm];
      return '<h3 class="set-h">Reminders</h3>' +
        sw('sr-on', S().reminders !== false, 'Ring task alarms and event reminders', 'A task with an alarm (and a time) rings at the time you chose. Reminders work while the diary is open in a tab or installed window.') +
        sw('sr-sound', S().sound !== false, 'Play a sound') +
        '<div class="set-row"><span class="lbl">System notifications</span><p class="hint">' + permText + '</p>' +
        (perm === 'default' ? '<button type="button" class="btn" data-sr="ask">' + ED.icon('bell') + 'Allow notifications</button>' : '') + '</div>' +
        '<button type="button" class="btn" data-sr="test">' + ED.icon('bell') + 'Test a reminder</button>';
    },
    bind_reminders(b) {
      b.querySelector('#sr-on').addEventListener('change', ev => { S().reminders = ev.target.checked; ED.store.commit(); });
      b.querySelector('#sr-sound').addEventListener('change', ev => { S().sound = ev.target.checked; ED.store.commit(); });
      b.addEventListener('click', async ev => {
        const x = ev.target.closest('[data-sr]'); if (!x) return;
        if (x.dataset.sr === 'ask') { try { await Notification.requestPermission(); } catch (err) { /* ignore */ } SET.refresh(); }
        if (x.dataset.sr === 'test') ED.reminders.fire('Test reminder', 'This is how a task alarm looks and sounds.', 'test-' + Date.now());
      });
    },

    /* ---------------- Password lock (js/lock.js) ---------------- */
    tab_lock() {
      const L = ED.lock;
      if (!L || !L.supported()) return '<h3 class="set-h">Password lock</h3><p class="hint">This browser cannot encrypt (it needs a secure page). Open the diary in Chrome, Edge, Safari or Firefox.</p>';
      const how = '<details class="set-more"><summary>How safe is it?</summary><ul class="set-ul">' +
        '<li>Your diary is encrypted with <b>AES-256-GCM</b>. The key is made from your password with <b>PBKDF2-SHA256, 600,000 rounds</b>, so every guess costs real computing time. The key lives only in memory while the diary is open; the password itself is never stored anywhere — not even scrambled.</li>' +
        '<li>Everything the diary keeps is encrypted: this browser’s copy, the daily snapshots, the diary file (e.g. in Google Drive), backups you export, GitHub sync and the copy in your Claude account. Anyone who copies these files sees only scrambled data.</li>' +
        '<li>No lock is “unhackable” — how safe it is depends on your password. A sentence of <b>5 or more unusual words</b> (for example <i>tamarind kite ledger monsoon brass</i>) would take longer than a lifetime to guess with today’s computers. A short word, a name or a date can be guessed quickly once someone has the file.</li>' +
        '<li>It cannot protect the diary while it is open and unlocked on your screen, or from a virus or keylogger on your computer. Lock it (the book button at the top) when you step away; it also locks itself after the minutes you choose below.</li>' +
        '<li><b>There is no reset.</b> If you forget the password, nobody can open the diary — not you, not us. Write it down and keep it somewhere safe, or keep an unlocked backup in a safe place.</li></ul></details>';
      if (!L.on) {
        return '<h3 class="set-h">Lock the whole diary with a password</h3>' +
          '<p class="hint">Every time the diary opens it will ask for the password first. Separate from the password log’s master password (you may use the same one).</p>' +
          '<form id="lk-on" class="set-grid" autocomplete="off">' +
          '<div class="set-row"><label class="lbl" for="lk-p1">Password</label><input id="lk-p1" type="password" class="field" autocomplete="new-password" placeholder="A sentence of 5 unusual words is best"><div class="lk-meter"><i id="lk-bar"></i></div><p class="hint" id="lk-str"></p></div>' +
          '<div class="set-row"><label class="lbl" for="lk-p2">Type it again</label><input id="lk-p2" type="password" class="field" autocomplete="new-password"></div>' +
          '<div class="set-row"><label class="lbl" for="lk-hint">Hint (optional, shown on the lock screen)</label><input id="lk-hint" class="field" maxlength="80" placeholder="Something only you would understand — never the password"></div>' +
          '<div class="set-row"><label class="switch"><input id="lk-ok" type="checkbox"><span class="track"></span><span>I understand there is no way to open the diary without this password</span></label></div>' +
          '<div class="set-row"><button type="submit" class="btn primary">' + ED.icon('lock') + 'Lock my diary</button></div></form>' + how;
      }
      const la = D().settings.lockAfter;
      return '<h3 class="set-h">Your diary is locked with a password</h3>' +
        '<p class="set-status">' + ED.icon('lock') + '<span>Encrypted (AES-256). It asks for the password each time it opens.' + (L.hint ? ' Hint: <i>' + e(L.hint) + '</i>' : '') + '</span></p>' +
        '<div class="btn-row"><button type="button" class="btn primary" data-lk="now">' + ED.icon('lock') + 'Lock now</button></div>' +
        '<div class="set-row"><label class="lbl" for="lk-after">Lock by itself after</label><select id="lk-after" class="field">' + [[5, '5 minutes without use'], [15, '15 minutes without use'], [30, '30 minutes without use'], [60, '1 hour without use'], [0, 'Never (only when I lock it)']].map(o => opt(o[0], o[1], +la === o[0])).join('') + '</select></div>' +
        '<h3 class="set-h">Change the password</h3>' +
        '<form id="lk-change" class="set-grid" autocomplete="off">' +
        '<div class="set-row"><label class="lbl" for="lk-c0">Current password</label><input id="lk-c0" type="password" class="field" autocomplete="current-password"></div>' +
        '<div class="set-row"><label class="lbl" for="lk-p1">New password</label><input id="lk-p1" type="password" class="field" autocomplete="new-password"><div class="lk-meter"><i id="lk-bar"></i></div><p class="hint" id="lk-str"></p></div>' +
        '<div class="set-row"><label class="lbl" for="lk-p2">Type it again</label><input id="lk-p2" type="password" class="field" autocomplete="new-password"></div>' +
        '<div class="set-row"><label class="lbl" for="lk-hint">Hint</label><input id="lk-hint" class="field" maxlength="80" value="' + e(L.hint || '') + '"></div>' +
        '<div class="set-row"><button type="submit" class="btn">Change password</button></div></form>' +
        '<h3 class="set-h danger-h">Remove the password</h3>' +
        '<form id="lk-off" class="set-row inline" autocomplete="off"><input id="lk-d0" type="password" class="field" placeholder="Current password" autocomplete="current-password"><button type="submit" class="btn danger">Remove the lock</button></form>' +
        '<p class="hint">The diary is then saved unencrypted again, everywhere.</p>' + how;
    },
    bind_lock(b) {
      const L = ED.lock;
      const p1 = b.querySelector('#lk-p1');
      if (p1) p1.addEventListener('input', () => {
        const s = L.strength(p1.value);
        const bar = b.querySelector('#lk-bar'); bar.style.width = Math.min(100, s.bits) + '%'; bar.className = s.cls;
        b.querySelector('#lk-str').textContent = s.label;
      });
      const newPass = () => {
        const a = b.querySelector('#lk-p1').value, c = b.querySelector('#lk-p2').value;
        if (a.length < 10) { ED.ui.toast('Use at least 10 characters — a sentence of 5 unusual words is best.'); return null; }
        if (L.strength(a).bits < 40) { ED.ui.toast('That password is easy to guess. Make it longer.'); return null; }
        if (a !== c) { ED.ui.toast('The two passwords are not the same.'); return null; }
        const hint = b.querySelector('#lk-hint').value.trim();
        if (hint && a.toLowerCase().indexOf(hint.toLowerCase()) >= 0) { ED.ui.toast('The hint must not contain the password.'); return null; }
        return { pass: a, hint };
      };
      b.addEventListener('submit', async ev => {
        const f = ev.target; ev.preventDefault();
        if (f.id === 'lk-on') {
          const v = newPass(); if (!v) return;
          if (!b.querySelector('#lk-ok').checked) { ED.ui.toast('Tick the box to confirm you will not lose the password.'); return; }
          const busy = ED.ui.busy('Encrypting your diary…');
          try { await L.enable(v.pass, v.hint); ED.ui.toast('Your diary is locked with your password. It will ask for it next time it opens.', { timeout: 8000 }); }
          catch (err) { ED.ui.toast('Could not lock the diary: ' + err.message, { kind: 'err' }); }
          finally { busy.close(); SET.refresh(); }
        }
        if (f.id === 'lk-change') {
          const busy0 = ED.ui.busy('Checking…'); const ok0 = await L.check(b.querySelector('#lk-c0').value); busy0.close();
          if (!ok0) { ED.ui.toast('The current password is not right.', { kind: 'err' }); return; }
          const v = newPass(); if (!v) return;
          const busy = ED.ui.busy('Encrypting with the new password…');
          try { await L.change(v.pass, v.hint); ED.ui.toast('Password changed'); }
          catch (err) { ED.ui.toast('Could not change it: ' + err.message, { kind: 'err' }); }
          finally { busy.close(); SET.refresh(); }
        }
        if (f.id === 'lk-off') {
          const busy0 = ED.ui.busy('Checking…'); const ok0 = await L.check(b.querySelector('#lk-d0').value); busy0.close();
          if (!ok0) { ED.ui.toast('The password is not right.', { kind: 'err' }); return; }
          const sure = await ED.ui.confirm({ title: 'Remove the password', message: 'Save the diary unencrypted again — in this browser, the diary file, backups and sync?', ok: 'Remove the lock', danger: true });
          if (!sure) return;
          const busy = ED.ui.busy('Saving…');
          try { await L.disable(); ED.ui.toast('The password lock is off'); } finally { busy.close(); SET.refresh(); }
        }
      });
      b.addEventListener('click', ev => { const x = ev.target.closest('[data-lk]'); if (x && x.dataset.lk === 'now') { if (SET.api) SET.api.close(); L.lockNow(); } });
      const after = b.querySelector('#lk-after');
      if (after) after.addEventListener('change', () => { S().lockAfter = +after.value; ED.store.commit(); });
    },

    /* ---------------- See my data ---------------- */
    viewData() {
      const d = D();
      const NAMES = { meta: 'About this diary', settings: 'Settings', tasks: 'Tasks', events: 'Events', categories: 'Categories', roles: 'Roles', goals: 'Goals', values: 'Values', dayNotes: 'Daily notes (by date)', mission: 'Mission statement', notebooks: 'Notebooks', notes: 'Notes', quotes: 'Your quotes', study: 'Study planner', finance: 'Finance and financial plan', sites: 'Important websites', vault: 'Password log (encrypted)', gcal: 'Google Calendar links', habits: 'Habits', interview: 'Interview preparation', health: 'Health', meetings: 'Meeting plans' };
      const count = v => Array.isArray(v) ? U.plural(v.length, 'item') : v && typeof v === 'object' ? U.plural(Object.keys(v).length, 'entry', 'entries') : '';
      const size = v => { try { return new Blob([JSON.stringify(v)]).size; } catch (err) { return 0; } };
      const keys = Object.keys(d).sort((a, b) => size(d[b]) - size(d[a]));
      const where = ED.store.adapter.name === 'claude' ? 'in your Claude account (this page’s private storage)' : ED.store.adapter.name === 'idb' ? 'in this browser’s IndexedDB database “e-diary”, key “db” (Chrome/Edge: F12 → Application → IndexedDB → e-diary → kv)' : ED.store.adapter.name === 'local' ? 'in this browser’s localStorage' : 'nowhere (storage is blocked)';
      const shorten = (k, v) => typeof v === 'string' && v.length > 300 ? v.slice(0, 120) + '… [' + U.bytes(v.length) + (/^data:image/.test(v) ? ' picture' : ' text') + ']' : v;
      const body = '<p class="hint">Your diary is one document, saved ' + e(where) + (ED.lock && ED.lock.on ? ', <b>encrypted with your password</b> — so the browser’s own tools show only scrambled text; this window shows it unlocked' : '') + (ED.sync.file.handle ? ', and also in the file <b>' + e(ED.sync.file.name) + '</b>' : '') + '. Total ' + U.bytes(ED.store.sizeBytes()) + '. Click a section to read it.</p>' +
        '<div class="vd-list">' + keys.map(k => '<details class="vd-sec" data-k="' + e(k) + '"><summary><b>' + e(NAMES[k] || k) + '</b> <span class="hint">' + e(k) + ' · ' + e(count(d[k])) + ' · ' + U.bytes(size(d[k])) + '</span></summary><pre class="vd-pre"></pre></details>').join('') + '</div>';
      ED.ui.modal({
        title: 'Your data', cls: 'wide', body,
        footer: '<span class="grow"></span><button type="button" class="btn" data-vd="export">' + ED.icon('download') + 'Export it all (.json)</button><button type="button" class="btn primary" data-mclose>Close</button>',
        onMount(el) {
          el.addEventListener('toggle', ev => {
            const det = ev.target; if (!det.classList || !det.classList.contains('vd-sec') || !det.open) return;
            const pre = det.querySelector('.vd-pre'); if (pre.dataset.done) return;
            const k = det.dataset.k;
            const txt = k === 'vault' ? '(The password log is encrypted with its own master password; open it on the Passwords tab.)' : JSON.stringify(d[k], shorten, 2);
            pre.textContent = txt.length > 400000 ? txt.slice(0, 400000) + '\n… (export the backup to see the rest)' : txt;
            pre.dataset.done = '1';
          }, true);
          el.querySelector('[data-vd="export"]').addEventListener('click', () => SET.exportBackup());
        },
      });
    },

    /* ---------------- Backup & Sync ---------------- */
    tab_data() {
      const st = ED.store;
      const size = st.sizeBytes();
      const fs = ED.sync.file;
      const g = ED.sync.gist.cfg();
      return '<h3 class="set-h">Where your diary is saved</h3>' +
        '<p class="set-status">' + ED.icon(st.adapter.name === 'memory' ? 'wifiOff' : 'checkSq') + '<span>' + e(st.adapter.label) + ' · <span class="num">' + U.bytes(size) + '</span>' +
        (st.lastSavedAt ? ' · last saved ' + e(U.fmtStamp(st.lastSavedAt)) : '') + '</span></p>' +
        '<div class="btn-row"><button type="button" class="btn" data-sd="view">' + ED.icon('eye') + 'See my data</button>' + (ED.lock && ED.lock.on ? '<span class="chip">' + ED.icon('lock') + 'Encrypted with your password</span>' : '<button type="button" class="btn ghost" data-sd="lock">' + ED.icon('lock') + 'Lock it with a password…</button>') + '</div>' +
        (st.adapter.name === 'claude' ? '<p class="hint">Each person who opens this page gets their own private diary.</p>' :
          '<p class="hint">Your diary stays on this computer, inside this browser. Nothing is uploaded unless you turn on a sync option below. Export a backup now and then — clearing browser data erases the diary.</p>') +

        (ED.gdrive ? ED.gdrive.settingsHtml() : '') +
        '<h3 class="set-h">Backup file</h3>' +
        '<div class="btn-row"><button type="button" class="btn primary" data-sd="export">' + ED.icon('download') + 'Export backup (.json)</button>' +
        '<button type="button" class="btn" data-sd="import">' + ED.icon('upload') + 'Import backup…</button>' +
        '<button type="button" class="btn" data-sd="csv">' + ED.icon('file') + 'Export tasks (.csv)</button></div>' +
        '<p class="hint">A backup holds everything: tasks, notes, goals, settings and pictures. Import replaces the diary in this browser.</p>' +

        '<div class="set-row" id="snaps"><span class="lbl">Automatic daily snapshots</span><p class="hint">Loading…</p></div>' +

        '<h3 class="set-h">' + (ED.gdrive ? 'Or: a diary file in a synced folder (the older way — Google Drive for desktop, OneDrive, Dropbox) ' : 'Keep the diary in Google Drive (or OneDrive, Dropbox) ') + (fs.supported ? '' : '<span class="chip">Chrome or Edge on a computer</span>') + '</h3>' +
        (fs.supported
          ? (fs.handle
            ? '<p class="set-status">' + ED.icon('file') + '<span>Linked to <b>' + e(fs.name) + '</b> — ' + (fs.perm === 'lost' ? 'the link stopped working (Google Drive brought in a newer copy) — choose the file again' : fs.perm === 'granted' ? 'every change is written to it' + (fs.lastWrite ? ' (last ' + e(U.fmtStamp(fs.lastWrite)) + ')' : '') : 'needs permission again') + '</span></p>' +
            '<div class="btn-row">' + (fs.perm !== 'granted' ? '<button type="button" class="btn primary" data-sd="file-reconnect">' + (fs.perm === 'lost' ? 'Choose the file again' : 'Open it again') + '</button>' : '<button type="button" class="btn" data-sd="file-load">' + ED.icon('download') + 'Load the latest now</button><button type="button" class="btn" data-sd="file-write">' + ED.icon('upload') + 'Save to it now</button>') +
            '<button type="button" class="btn" data-sd="file-unlink">Unlink</button></div>' +
            (fs.ro ? '<p class="set-status err-text">' + ED.icon('lock') + '<span><b>Read-only here</b> — ' + (fs.roOwner && fs.roOwner.id !== 'released' ? 'the file is open on “' + e(fs.roOwner.name) + '”.' : 'you released the file.') + '</span></p><div class="btn-row"><button type="button" class="btn" data-sd="file-retry">Check again</button><button type="button" class="btn ghost" data-sd="file-take">Take over</button></div>'
              : fs.held ? '<div class="btn-row"><button type="button" class="btn" data-sd="file-release">' + ED.icon('unlock') + 'Release for other PCs</button></div>' : '') +
            '<div class="set-row"><label class="lbl" for="sf-dev">This PC’s name</label><input id="sf-dev" class="field" value="' + e(fs.device().name) + '" maxlength="40"><p class="hint">One PC at a time: while the diary is open here, other PCs that open the same file can only look (read-only) and see this name. It frees itself when you close the diary here, or 6 minutes after this PC goes quiet.</p></div>' +
            (fs.perm === 'granted' && fs.unsaved() ? '<p class="hint err-text">' + ED.icon('info') + ' Changes not yet saved to the file.</p>' : '') +
            sw('sf-auto', S().fileAuto !== false, 'Save automatically', 'On: every change is written to the file within seconds. Off: only when you click <b>Save to it now</b> (or press Ctrl+S).') +
            sw('sf-ask', S().fileAsk !== false, 'Ask before closing if changes are not saved', 'When you close the tab or window with unsaved changes, the browser asks whether to leave (its own wording: “Changes you made may not be saved”). Choose <b>Cancel</b> to stay; the diary then saves at once.')
            : '<div class="btn-row"><button type="button" class="btn" data-sd="file-new">' + ED.icon('download') + 'Save diary to a file…</button><button type="button" class="btn" data-sd="file-open">' + ED.icon('upload') + 'Open a diary file…</button></div>') +
          '<ol class="set-ol"><li>Install <b>Google Drive for desktop</b> (drive.google.com/download) and sign in — a “Google Drive” folder appears on your computer.</li>' +
          '<li>Click <b>Save diary to a file…</b> and save <i>e-diary.json</i> inside <b>Google Drive → My Drive</b>.</li>' +
          '<li>From then on every change is written to that file within seconds (and once more when you close the diary), and Google Drive uploads it. When the diary opens it reads the file first, so changes made on another computer come in — the browser asks once per visit (click <b>Open it again</b>), or never if you choose “Allow on every visit”.</li>' +
          '<li>On another computer: install Google Drive for desktop, open the diary there and click <b>Open a diary file…</b> → the same file. Changes from both are merged item by item.</li></ol>' +
          (ED.lock && ED.lock.on ? '<p class="hint">' + ED.icon('lock') + ' The file is encrypted with your diary password, so Google sees only scrambled data.</p>' : '<p class="hint">Tip: lock the diary with a password (Password lock) so the copy in Google Drive is encrypted too.</p>')
          : '<p class="hint">Your browser cannot write to files directly. Use Export/Import, or open the diary in Chrome or Edge on a computer.</p>') +

        (ED.env.claude ? '' :
          '<h3 class="set-h">Cloud sync with GitHub (optional, free)</h3>' +
          (g.token
            ? '<p class="set-status">' + ED.icon('cloudCheck') + '<span>Connected' + (g.id ? ' to gist <span class="num">' + e(g.id.slice(0, 8)) + '…</span>' : '') + (g.encrypt ? ' · encrypted with your passphrase' : ' · not encrypted') +
              (g.lastSync ? ' · last sync ' + e(U.fmtStamp(g.lastSync)) : '') + (ED.sync.gist.error ? ' · <span class="err-text">' + e(ED.sync.gist.error) + '</span>' : '') + '</span></p>' +
              (g.encrypt && !ED.sync.gist.pass ? '<form class="set-row inline" id="sg-unlock"><input id="sg-pass2" type="password" class="field" placeholder="Passphrase" autocomplete="current-password"><button type="submit" class="btn primary">Unlock sync</button></form>' : '') +
              '<div class="btn-row"><button type="button" class="btn primary" data-sd="gist-sync">' + ED.icon('sync') + 'Sync now</button><button type="button" class="btn" data-sd="gist-off">Disconnect</button></div>'
            : '<p class="hint">Sync the diary between computers and phones through a <b>secret gist</b> in your GitHub account. Create a token at github.com → Settings → Developer settings → Personal access tokens → <b>Fine-grained</b>, with only the <b>Gists: read and write</b> permission.</p>' +
              '<form class="set-grid" id="sg-form">' +
              '<div class="set-row"><label class="lbl" for="sg-token">GitHub token</label><input id="sg-token" type="password" class="field" autocomplete="off" placeholder="github_pat_…"></div>' +
              '<div class="set-row"><label class="lbl" for="sg-gid">Gist ID (leave empty the first time)</label><input id="sg-gid" class="field" autocomplete="off" placeholder="Paste it on your second device"></div>' +
              '<div class="set-row"><label class="lbl" for="sg-pass">Passphrase (encrypts the diary before upload)</label><input id="sg-pass" type="password" class="field" autocomplete="new-password" placeholder="Use the same one on every device"></div>' +
              '<div class="set-row"><label class="switch"><input id="sg-remember" type="checkbox" checked><span class="track"></span><span>Remember the passphrase on this device</span></label></div>' +
              '<div class="set-row"><button type="submit" class="btn primary">' + ED.icon('cloud') + 'Connect and sync</button></div></form>' +
              '<p class="hint">The token and passphrase stay in this browser only; they are never put in backups. Without a passphrase, anyone who learns the gist link can read it.</p>')) +

        '<h3 class="set-h">Example entries</h3>' +
        '<div class="btn-row">' + (ED.sample.hasDemo(D()) ? '<button type="button" class="btn" data-sd="demo-clear">Clear example entries</button>' : '<button type="button" class="btn" data-sd="demo-add">Add example entries</button>') + '</div>' +

        '<h3 class="set-h">Holidays</h3>' +
        '<div class="btn-row"><button type="button" class="btn" data-sd="holidays">' + ED.icon('calendar') + 'Add India holidays…</button></div>' +
        '<p class="hint">Adds the gazetted holidays for central government offices as all-day events. You can delete any of them later.</p>' +

        '<h3 class="set-h danger-h">Start over</h3>' +
        '<div class="btn-row"><button type="button" class="btn danger" data-sd="erase">' + ED.icon('trash') + 'Erase this diary…</button></div>';
    },
    bind_data(b) {
      if (ED.gdrive) ED.gdrive.bindSettings(b);
      ED.store.listSnapshots().then(keys => {
        const box = b.querySelector('#snaps'); if (!box) return;
        box.innerHTML = '<span class="lbl">Automatic daily snapshots</span>' + (keys.length
          ? '<p class="hint">The diary keeps a copy of itself each day you use it (last 7 days, in this browser).</p><ul class="set-list">' + keys.map(k => '<li><span class="grow num">' + e(U.fmtLong(k.slice(5))) + '</span><button type="button" class="btn small" data-sd="restore" data-key="' + e(k) + '">Restore</button></li>').join('') + '</ul>'
          : '<p class="hint">None yet. A snapshot is saved once a day when you use the diary.</p>');
      });
      b.addEventListener('submit', async ev => {
        const f = ev.target;
        if (f.id === 'sg-form') {
          ev.preventDefault();
          const token = b.querySelector('#sg-token').value.trim();
          const id = b.querySelector('#sg-gid').value.trim();
          const pass = b.querySelector('#sg-pass').value;
          const remember = b.querySelector('#sg-remember').checked;
          if (!token) { ED.ui.toast('Paste your GitHub token first.'); return; }
          const busy = ED.ui.busy('Connecting to GitHub…');
          try { await ED.sync.gist.connect({ token, id, pass, remember }); ED.ui.toast('Cloud sync is on'); }
          catch (err) { ED.ui.toast('Could not connect: ' + err.message, { kind: 'err', timeout: 7000 }); }
          finally { busy.close(); SET.refresh(); }
        }
        if (f.id === 'sg-unlock') {
          ev.preventDefault();
          ED.sync.gist.pass = b.querySelector('#sg-pass2').value;
          const busy = ED.ui.busy('Syncing…');
          try { await ED.sync.gist.syncNow(true); } catch (err) { ED.ui.toast(err.message, { kind: 'err' }); } finally { busy.close(); SET.refresh(); }
        }
      });
      const sfA = b.querySelector('#sf-auto'), sfB = b.querySelector('#sf-ask');
      if (sfA) sfA.addEventListener('change', ev => { S().fileAuto = ev.target.checked; ED.store.commit(); if (ev.target.checked) ED.sync.file.schedule(); });
      if (sfB) sfB.addEventListener('change', ev => { S().fileAsk = ev.target.checked; ED.store.commit(); });
      const sfD = b.querySelector('#sf-dev'); if (sfD) sfD.addEventListener('change', ev => { ED.sync.file.setDeviceName(ev.target.value); ED.ui.toast('This PC is called “' + ED.sync.file.device().name + '”'); });
      b.addEventListener('click', async ev => {
        const x = ev.target.closest('[data-sd]'); if (!x) return;
        const a = x.dataset.sd;
        if (a === 'export') SET.exportBackup();
        if (a === 'view') SET.viewData();
        if (a === 'lock') { U.$$('.set-tab', SET.api.el).forEach(t => t.setAttribute('aria-selected', String(t.dataset.stab === 'lock'))); SET.show('lock'); }
        if (a === 'file-load') { const busy = ED.ui.busy('Reading the diary file…'); try { await ED.sync.file.sync(true); } finally { busy.close(); SET.refresh(); } }
        if (a === 'import') SET.importBackup();
        if (a === 'csv') SET.exportCsv();
        if (a === 'restore') {
          const ok = await ED.ui.confirm({ title: 'Restore snapshot', message: 'Replace the diary with the copy from ' + U.fmtLong(x.dataset.key.slice(5)) + '? You can undo right after.', ok: 'Restore' });
          if (!ok) return;
          try { await ED.store.restoreSnapshot(x.dataset.key); ED.store.loadError = null; ED.ui.undoToast('Snapshot restored'); SET.refresh(); } catch (err) { ED.ui.toast(err.message, { kind: 'err' }); }
        }
        if (a === 'file-new') {
          const c = await ED.ui.confirm({ title: 'Save diary to a file', message: 'Is there already a diary file in Google Drive (or another synced folder) from another PC? Then open that file — creating a new one in its place would replace the entries saved there.',
            choices: [{ id: 'open', label: 'Open the existing file', primary: true }, { id: 'new', label: 'Create a new file', primary: false }] });
          if (c === 'open') await ED.sync.file.openExisting(); else if (c === 'new') await ED.sync.file.linkNew();
          SET.refresh();
        }
        if (a === 'file-open') { await ED.sync.file.openExisting(); SET.refresh(); }
        if (a === 'file-reconnect') { await ED.sync.file.reconnect(); SET.refresh(); }
        if (a === 'file-write') { await ED.sync.file.write(true); SET.refresh(); }
        if (a === 'file-release') { await ED.sync.file.release(true); SET.refresh(); }
        if (a === 'file-retry') { await ED.sync.file.checkFree(); SET.refresh(); }
        if (a === 'file-take') { await ED.sync.file.takeOver(); SET.refresh(); }
        if (a === 'file-unlink') { await ED.sync.file.unlink(); SET.refresh(); }
        if (a === 'gist-sync') { const busy = ED.ui.busy('Syncing…'); try { await ED.sync.gist.syncNow(true); ED.ui.toast('Synced'); } catch (err) { ED.ui.toast(err.message, { kind: 'err', timeout: 7000 }); } finally { busy.close(); SET.refresh(); } }
        if (a === 'gist-off') { ED.sync.gist.disconnect(); SET.refresh(); ED.ui.toast('Cloud sync is off. The gist stays in your GitHub account.'); }
        if (a === 'demo-clear') { await ED.actions['demo-clear'](); SET.refresh(); }
        if (a === 'demo-add') { ED.store.checkpoint('Add examples'); ED.sample.addDemo(D()); S().sampleBanner = true; ED.store.commit(); ED.ui.undoToast('Example entries added'); SET.refresh(); }
        if (a === 'holidays') { ED.holidays.offer(); }
        if (a === 'erase') {
          const ok = await ED.ui.confirm({ title: 'Erase this diary', message: 'Delete every task, note, goal and setting in this browser and start with a blank diary? Export a backup first if you might want it back.', ok: 'Erase everything', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Erase');
          const fresh = ED.sample.starter();
          fresh.settings.sampleBanner = false;
          ED.store.replaceAll(fresh, 'replace');
          ED.state.career.noteId = null;
          ED.ui.undoToast('Diary erased');
          SET.refresh();
        }
      });
    },

    exportBackup() {
      const name = 'e-diary-backup-' + U.today() + '.json';
      ED.store.exportPayload().then(o => U.download(name, JSON.stringify(o, null, 1), 'application/json')).then(ok => { if (ok) ED.ui.toast('Backup saved as ' + name + (ED.lock && ED.lock.on ? ' (locked with your password)' : '')); });
    },
    async importBackup() {
      const f = await U.pickFile('.json,application/json');
      if (!f) return;
      let raw;
      try { raw = await ED.store.openImport(JSON.parse(await U.readText(f)), 'This backup is locked with a password. Enter the password it was saved with.'); }
      catch (err) { if (err && err.cancelled) return; ED.ui.toast(err.message === 'This file is not an E-Diary backup.' ? err.message : 'That file could not be read as a backup.', { kind: 'err' }); return; }
      const when = raw.meta && raw.meta.updatedAt ? U.fmtStamp(raw.meta.updatedAt) : 'an unknown date';
      const ok = await ED.ui.confirm({ title: 'Import backup', message: 'Replace the diary in this browser with the backup last changed on ' + when + ' (' + U.plural((raw.tasks || []).length, 'task') + ')? You can undo right after.', ok: 'Replace diary' });
      if (!ok) return;
      ED.store.replaceAll(raw, 'replace');
      ED.store.loadError = null;
      ED.state.career.noteId = null;
      ED.ui.undoToast('Backup imported');
      SET.refresh();
    },
    exportCsv() {
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const rows = [['Priority', 'Title', 'Status', 'Date', 'Time', 'Repeats', 'Role', 'Category', 'Goal', 'Delegated to', 'Notes'].map(q).join(',')];
      D().tasks.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || M.cmpTask(a, b)).forEach(t => {
        rows.push([M.code(t), t.title, t.repeat ? 'Repeating' : M.statusLabel(t.status), t.date || '', t.time || '', t.repeat ? M.repeatText(t.repeat) : '',
          (M.role(t.roleId) || {}).name, (M.category(t.categoryId) || {}).name, (M.goal(t.goalId) || {}).title, t.delegatedTo, U.stripHtml(t.notes)].map(q).join(','));
      });
      U.download('e-diary-tasks-' + U.today() + '.csv', '﻿' + rows.join('\r\n'), 'text/csv');
    },

    /* ---------------- Install & Help ---------------- */
    tab_help() {
      const hosted = ED.env.http && !ED.env.claude;
      return (ED.env.claude ? '<p class="set-status">' + ED.icon('info') + '<span>This copy runs inside Claude and saves privately to your Claude account. The downloadable E-Diary folder adds offline use, desktop launchers, weather and file/cloud sync.</span></p>' : '') +
        (ED.mobile ? '<h3 class="set-h">Layout on this device</h3><div class="seg" role="group" aria-label="Layout">' + [['auto', 'Automatic'], ['phone', 'Phone'], ['computer', 'Computer']].map(x => '<button type="button" data-sh="layout" data-v="' + x[0] + '" aria-pressed="' + (ED.mobile.pref() === x[0]) + '">' + x[1] + '</button>').join('') + '</div><p class="hint">Phone: a bar at the bottom (Today · Planner · Notes &amp; Life · Money · More), a + button and swipe left/right for the next/previous day. Automatic uses it on narrow screens.</p>' +
          '<h3 class="set-h">On an Android phone</h3><ol class="steps"><li>Open the diary in <b>Chrome</b> from its web address (where the mobile version is hosted — see the README: Raspberry Pi, GitHub Pages or this computer through Tailscale). A file opened from the Files app cannot be installed.</li><li>Tap <b>⋮ → Install app</b> (or the Install button in More). It gets its own icon; long-press the icon for Today, New task, Groceries and Bills.</li><li>Turn on <b>Backup &amp; Sync → Google Drive sync</b> on the phone too (add the address to your Client ID’s authorized JavaScript origins first).</li></ol>' : '') +
        '<h3 class="set-h">Use it like an app on your computer</h3>' +
        (ED.installPrompt ? '<div class="btn-row"><button type="button" class="btn primary" data-sh="install">' + ED.icon('install') + 'Install E-Diary on this computer</button></div>' : '') +
        '<ol class="steps">' +
        '<li><b>Windows:</b> double-click <code>Start E-Diary (Windows).bat</code> in the diary folder. It opens the diary in its own Microsoft Edge window. To make a desktop icon, run <code>Create Desktop Shortcut (Windows).bat</code> once.</li>' +
        '<li><b>Mac:</b> double-click <code>Start E-Diary (Mac).command</code> (the first time: right-click → Open). It opens in its own Chrome or Edge window, or in Safari.</li>' +
        '<li><b>From a web address</b> (GitHub Pages, Netlify, your office server): open it in Chrome or Edge and choose <b>Install E-Diary</b> in the address bar. It then works offline, like any app' + (hosted ? ' — you are using a hosted copy now' : '') + '.</li>' +
        '</ol>' +
        '<p class="hint">Each browser keeps its own copy of the diary. To move it between browsers or computers, use Backup &amp; Sync.</p>' +
        '<h3 class="set-h">Planning the Franklin way</h3>' +
        '<ul class="steps"><li><b>A</b> = vital, <b>B</b> = important, <b>C</b> = nice to do, <b>D</b> = delegate or someday. Number them in the order you will do them: A1, A2, B1…</li>' +
        '<li>Your <b>frog</b> is the hardest, most important task. Put it under “FROG: To be tamed first” and do it before anything else.</li>' +
        '<li>Type <code>A1 Call the bank @5pm</code> in Add Task to set priority and time in one go.</li>' +
        '<li>Unfinished tasks roll forward to today. Right-click a task (or use ⋯) to forward, delegate, move or cancel it.</li>' +
        '<li>Drag a task onto another to put it before or after — the numbers update. Drag onto a calendar day to reschedule.</li>' +
        '<li>On the hourly timeline, drag a task or event up or down to change its time, and drag its bottom edge to change how long it lasts. Drop it on <b>All day events</b> to make it an all-day item. On a touch screen, press and hold first.</li></ul>' +
        '<h3 class="set-h">Study, money and passwords</h3>' +
        '<ul class="steps"><li><b>Study Year / Month / Week &amp; Day:</b> import your study plan from Excel (Plan → Import), then tick each session and type the time you really spent. The graphs count what you studied on the day you studied it. Plan → Plan settings adds study slots (as many as you like); Plan → Add to the schedule puts a slot or subject into many days at once; books, lectures and topics appear as lists in the session editor.</li>' +
        '<li><b>Finance:</b> add what you receive and spend, set a monthly budget per category, tick monthly bills as paid, and keep policies and investments with their due dates. Money put into savings and investments counts as saved, not spent; a transfer between your own accounts changes no total.</li>' +
        '<li><b>Financial Plan:</b> today’s income, costs and savings plus goals in today’s money (a house, education, travel, a computer…). The plan adds pay rises, inflation, income tax and loans, and shows a year-by-year schedule and how much to invest each month.</li>' +
        '<li><b>Passwords:</b> the log is encrypted with your master password and locks itself when you are away. There is no way to recover a forgotten master password.</li>' +
        '<li><b>Google Calendar:</b> Settings → Google Calendar links your Google account (inside Claude, through your Google Calendar connector) so dated tasks, events and timed study sessions appear there too. Dragging a task to a time or to All day sends it within a few seconds; if Google is not linked, the diary offers a one-click “Add to Google Calendar”.</li></ul>' +
        '<h3 class="set-h">Keyboard shortcuts</h3>' +
        '<table class="keys"><tbody>' +
        [['N', 'New task (or new goal/role/note on those tabs)'], ['E', 'New event'], ['T', 'Go to today'], ['← →', 'Previous / next day (or period)'], ['1 – 9, 0', 'Open a section tab (1 Daily … 9 Study Week & Day, 0 Finance)'],
          ['/  or  Ctrl K', 'Search'], ['Enter', 'Open the focused task'], ['Space', 'Tick the focused task'], ['Ctrl Enter', 'Save and close an editor'], ['Esc', 'Close'], ['?', 'This help']]
          .map(r => '<tr><td><kbd>' + e(r[0]) + '</kbd></td><td>' + e(r[1]) + '</td></tr>').join('') + '</tbody></table>' +
        '<h3 class="set-h">About</h3><p class="hint">E-Diary Planner · version ' + e(ED.VERSION || '1.0') + ' · works offline · your data stays with you. Weather by Open-Meteo.com.</p>';
    },
    bind_help(b) {
      b.addEventListener('click', async ev => {
        const x = ev.target.closest('[data-sh]'); if (!x) return;
        if (x.dataset.sh === 'layout' && ED.mobile) { ED.mobile.setPref(x.dataset.v); SET.refresh(); return; }
        if (x.dataset.sh === 'install' && ED.installPrompt) { ED.installPrompt.prompt(); try { await ED.installPrompt.userChoice; } catch (err) { /* ignore */ } ED.installPrompt = null; SET.refresh(); }
      });
    },
  });
  SET.init();
})();
