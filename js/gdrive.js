/* E-Diary — sync through your Google account, straight to Google Drive (added in 1.14).
   Why: the diary file in a synced folder (js/sync.js) depends on Google Drive for desktop, on the browser's permission
   for that file (asked once per visit), and on one PC holding it at a time; on a phone the link to the file breaks
   whenever Drive brings in a newer copy. This talks to Google Drive itself instead:
     • a folder "E-Diary sync" in your Drive, made by the diary — it can see only the files it made (scope drive.file);
     • one file per device, e.g. "E-Diary — Office PC.json", a full copy of the diary. Each device writes ONLY its own
       file, so two devices can never write over each other, not even in the same second;
     • every device reads the other devices' files and merges them in item by item (ED.merge3), remembering what it
       last took from each one (IndexedDB "gd-base:<device>"), so additions, edits and deletions all come through.
   Sign-in uses the same OAuth Client ID as Google Calendar (Settings → Google Calendar); the Google Drive API must be
   turned on in that Google Cloud project. Google gives browser-only apps a one-hour pass: the diary renews it by itself
   when pop-ups are allowed for its address, otherwise on your next click (a Google window opens and closes at once).
   This device: localStorage "e-diary-gdrive" = { on, folder, seen: { fileId: version }, upStamp, joined, email, lastSync }. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const D = () => ED.store.data;
  const CFG = 'e-diary-gdrive', TK = 'e-diary-gdrive-token';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  const FOLDER = 'E-Diary sync';
  const GD = (ED.gdrive = { token: null, exp: 0, state: 'off', error: '', busy: false, peers: [], needClick: false, lastSync: 0, enableUrl: '' });
  const cfg = () => U.lsGet(CFG, {}) || {};
  const setCfg = patch => { const c = Object.assign(cfg(), patch); U.lsSet(CFG, c); return c; };
  const SU = () => ED.syncUtil;
  const dev = () => ED.sync.file.device();          // { id, name } — the name is "This device's name"
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  GD.on = () => !!cfg().on && !ED.env.claude;
  const clientId = () => ((D() && D().settings.gcal && D().settings.gcal.clientId) || '').trim();
  GD.blocked = () => {
    if (ED.env.claude) return 'Inside Claude your diary is already saved to your Claude account.';
    if (ED.env.file) return 'Google sign-in needs the diary opened from its web address (the desktop shortcut opens http://localhost:47812; a phone opens the address where the mobile version is hosted), not as a file.';
    if (!/\.apps\.googleusercontent\.com$/.test(clientId())) return 'noclient';
    return '';
  };

  /* ---------------- Google sign-in (Google Identity Services) ---------------- */
  function loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (loadGIS.p) return loadGIS.p;
    loadGIS.p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => resolve(); s.onerror = () => { loadGIS.p = null; reject(new Error('Could not reach Google. Check the internet connection.')); };
      document.head.appendChild(s);
    });
    return loadGIS.p;
  }
  const gisReady = () => !!(window.google && google.accounts && google.accounts.oauth2);
  const scopes = () => SCOPE + (D().settings.gcal && D().settings.gcal.on ? ' https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly' : '') + ' openid email';
  let tc = null, tcKey = '', waiters = [];
  const finish = (ok, why) => { const w = waiters; waiters = []; w.forEach(f => f(ok, why)); };
  function client() {
    const key = clientId() + '|' + scopes();
    if (tc && tcKey === key) return tc;
    tcKey = key;
    tc = google.accounts.oauth2.initTokenClient({
      client_id: clientId(), scope: scopes(), include_granted_scopes: true,
      hint: cfg().email || (D().settings.gcal && D().settings.gcal.email) || undefined,
      callback: resp => {
        if (!resp || resp.error) { finish(false, (resp && (resp.error_description || resp.error)) || 'Sign-in failed'); return; }
        if (resp.scope && resp.scope.indexOf(SCOPE) < 0) { finish(false, 'scope'); return; }
        GD.takeToken(resp);
        if (ED.gcal && ED.gcal.takeToken && /calendar\.events/.test(resp.scope || '')) ED.gcal.takeToken(resp);   // one pass for both
        finish(true);
      },
      error_callback: err => finish(false, err && err.type === 'popup_failed_to_open' ? 'popup' : err && err.type === 'popup_closed' ? 'closed' : (err && err.message) || 'Sign-in failed'),
    });
    return tc;
  }
  GD.takeToken = resp => {
    GD.token = resp.access_token; GD.exp = Date.now() + (+resp.expires_in || 3600) * 1000;
    GD.needClick = false;
    try { sessionStorage.setItem(TK, JSON.stringify({ t: GD.token, x: GD.exp, c: clientId() })); } catch (err) { /* private window */ }
    planRenewal();
  };
  GD.connected = () => !!(GD.token && Date.now() < GD.exp - 60000);
  /* ask Google for a pass — from a click, or by itself when pop-ups are allowed for this address */
  GD.signIn = prompt => new Promise(resolve => {
    const go = () => {
      waiters.push((ok, why) => { if (!ok) GD.lastWhy = why; resolve(ok); });
      try { client().requestAccessToken({ prompt: prompt || '' }); } catch (err) { finish(false, err.message); }
    };
    if (gisReady()) go(); else loadGIS().then(go, err => { GD.error = err.message; resolve(false); });
  });
  let renewTimer = null;
  function planRenewal() {
    clearTimeout(renewTimer);
    if (!GD.on() || !GD.exp) return;
    renewTimer = setTimeout(async () => {
      if (!GD.on() || GD.connected() && GD.exp - Date.now() > 3 * 60000) return;
      if (document.visibilityState !== 'visible') { GD.needClick = true; paint(); return; }
      const ok = await GD.signIn('');   // works without a click only when pop-ups are allowed for this address
      if (!ok) { GD.needClick = true; paint(); } else GD.sync('renewed');
    }, Math.max(5000, GD.exp - Date.now() - 2.5 * 60000));
  }
  // the pass ran out and something waits to go to Drive: the next click anywhere renews it (Google needs a click)
  document.addEventListener('click', ev => {
    if (!GD.on() || GD.connected() || GD.busy || !gisReady() || GD.blocked()) return;
    if (!(GD.needClick || GD.unsaved())) return;
    if (ev.target && ev.target.closest && ev.target.closest('[data-gd]')) return;   // the Settings buttons do it themselves
    if (Date.now() - (GD.lastAsk || 0) < 45000) return;
    GD.lastAsk = Date.now();
    GD.signIn('').then(ok => { if (ok) GD.sync('renewed'); else paint(); });
  }, true);

  /* ---------------- Google Drive REST ---------------- */
  function explain(status, txt) {
    let j = null; try { j = JSON.parse(txt); } catch (err) { /* not JSON */ }
    const msg = (j && j.error && (j.error.message || (j.error.errors && j.error.errors[0] && j.error.errors[0].message))) || txt || '';
    if (/has not been used in project|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(msg)) {
      GD.enableUrl = (msg.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"'<>]+/) || [])[0] || 'https://console.cloud.google.com/apis/library/drive.googleapis.com';
      return 'apidisabled';
    }
    if (status === 403 && /insufficient|scope|permission/i.test(msg)) return 'scope';
    return 'Google Drive answered: ' + (msg || ('error ' + status)).slice(0, 200);
  }
  async function api(method, url, opts, tries) {
    opts = opts || {}; tries = tries || 0;
    if (!GD.connected()) { const er = new Error('signin'); er.code = 401; throw er; }
    let res;
    try { res = await fetch(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + GD.token }, opts.headers || {}), body: opts.body }); }
    catch (err) { const er = new Error('offline'); er.code = 0; throw er; }
    if (res.status === 401) { GD.token = null; GD.exp = 0; const er = new Error('signin'); er.code = 401; throw er; }
    if ((res.status === 429 || res.status >= 500) && tries < 3) { await sleep(700 * Math.pow(2, tries) + Math.random() * 300); return api(method, url, opts, tries + 1); }
    if (!res.ok) { const txt = await res.text().catch(() => ''); const er = new Error(explain(res.status, txt)); er.code = res.status; throw er; }
    if (opts.raw) return res;
    return res.status === 204 ? null : res.json();
  }
  const qs = s => encodeURIComponent(s);
  async function folder() {
    const c = cfg();
    if (c.folder) return c.folder;
    const r = await api('GET', API + '/files?q=' + qs("appProperties has { key='ediary' and value='folder' } and trashed = false") + '&fields=' + qs('files(id,name,createdTime)') + '&orderBy=createdTime&pageSize=10&spaces=drive');
    let id = r && r.files && r.files[0] && r.files[0].id;
    if (!id) {
      const f = await api('POST', API + '/files?fields=id', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder', appProperties: { ediary: 'folder' } }) });
      id = f.id;
    }
    setCfg({ folder: id });
    return id;
  }
  async function listFiles() {
    const r = await api('GET', API + '/files?q=' + qs("appProperties has { key='ediary' and value='dev' } and trashed = false") + '&fields=' + qs('files(id,name,modifiedTime,version,size,appProperties)') + '&pageSize=100&spaces=drive');
    return ((r && r.files) || []).map(f => ({ id: f.id, name: f.name, mod: f.modifiedTime, ver: String(f.version || f.modifiedTime || ''), size: +f.size || 0, dev: (f.appProperties || {}).dev || '', devName: (f.appProperties || {}).name || '' }));
  }
  async function download(id) { return (await api('GET', API + '/files/' + id + '?alt=media', { raw: true })).text(); }
  function multipart(meta, text) {
    const b = 'ediary-' + Math.random().toString(36).slice(2);
    return { headers: { 'Content-Type': 'multipart/related; boundary=' + b },
      body: '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + text + '\r\n--' + b + '--\r\n' };
  }
  async function upload(text, meta, fileId) {
    const q = '&fields=' + qs('id,version,modifiedTime');
    if (text.length < 4 * 1024 * 1024) return api(fileId ? 'PATCH' : 'POST', UP + '/files' + (fileId ? '/' + fileId : '') + '?uploadType=multipart' + q, multipart(meta, text));
    // a large diary (pictures): resumable upload
    const start = await api(fileId ? 'PATCH' : 'POST', UP + '/files' + (fileId ? '/' + fileId : '') + '?uploadType=resumable' + q,
      { headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json' }, body: JSON.stringify(meta), raw: true });
    const loc = start.headers.get('Location');
    if (!loc) throw new Error('Google Drive did not accept the upload. Try again.');
    let res;
    try { res = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: text }); } catch (err) { throw new Error('offline'); }
    if (!res.ok) throw new Error('Google Drive upload failed (' + res.status + ')');
    return res.json();
  }

  /* ---------------- the copies ---------------- */
  async function payload() {
    const d = D();
    // merged: which copy of each other device this copy already contains — the others use it to find what both had
    const o = { app: 'E-Diary', format: 1, kind: 'device-copy', device: dev(), savedAt: new Date().toISOString(), stamp: SU().stamp(d), merged: cfg().mergedFrom || {}, data: d };
    if (ED.lock && ED.lock.on) { o.locked = true; o.data = await ED.lock.seal(d); }
    return JSON.stringify(o);
  }
  async function readCopy(id) {
    const obj = JSON.parse(await download(id));
    const data = await ED.store.openImport(obj, 'A copy of your diary in Google Drive is locked with a password. Enter it to sync.');
    return { data, device: obj.device || {}, stamp: obj.stamp || SU().stamp(data), merged: obj.merged && typeof obj.merged === 'object' ? obj.merged : {} };
  }
  // an editor or the daily notes being typed in: bring others' changes in a moment later
  const canApply = () => !document.querySelector('#modal-root .mframe:not(.settings):not(.st-modal-safe)') && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#spread') && (document.activeElement.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)));
  const apply = data => {
    const next = Object.assign({}, data, { meta: Object.assign({}, data.meta, { updatedAt: Date.now() }) });
    ED.store.replaceAll(next, 'remote', { keepStamp: true });
  };
  async function ask(peerName) {
    const c = await ED.ui.confirm({ title: 'Your diary in Google Drive',
      message: 'This device already has diary entries, and so does the copy from “' + peerName + '” in Google Drive. Merge both (nothing is lost — items that exist on only one side are kept), or replace the diary on this device with the copy from Google Drive?',
      choices: [{ id: 'merge', label: 'Merge both', primary: true }, { id: 'theirs', label: 'Use the Google Drive copy', primary: false }], cancel: 'Not now' });
    return c;
  }

  /* one round: bring in what other devices changed, then write this device's copy if it has changes */
  async function round(why) {
    await folder();
    const me = dev(), c0 = cfg();
    const files = await listFiles();
    const mine = files.find(f => f.dev === me.id) || null;
    const peers = files.filter(f => f.dev && f.dev !== me.id);
    const seen = Object.assign({}, c0.seen || {});
    const changed = peers.filter(f => seen[f.id] !== f.ver);
    // an editor is open (it holds the items it edits): bring the others' changes in a little later; still save ours
    const wait = changed.length > 0 && !canApply();
    GD.deferred = wait;
    if (wait) setTimeout(() => GD.sync('deferred'), 4000);
    else if (!c0.joined && peers.length) {
      // first time on this device: start from the newest copy in Drive (it already holds what the others merged)
      const copies = [];
      for (const f of peers) copies.push({ f, c: await readCopy(f.id) });
      copies.sort((a, b) => String(b.f.mod).localeCompare(String(a.f.mod)));
      const newest = copies[0], local = D();
      let next = newest.c.data;
      if (!SU().fresh(local) && !SU().sameData(local, newest.c.data)) {
        const ch = await ask(newest.f.devName || newest.c.device.name || 'another device');
        if (!ch) { setCfg({ on: false }); GD.state = 'off'; paint(); ED.ui.toast('Google Drive sync not turned on — nothing was changed.'); return 'cancelled'; }
        if (ch === 'merge') next = ED.merge3(null, local, newest.c.data);
      }
      if (!SU().sameData(next, D())) apply(next);
      // this device now holds the newest copy, and with it everything that copy had merged
      const from = Object.assign({}, newest.c.merged, { [newest.f.dev]: newest.c.stamp });
      delete from[me.id];
      for (const x of copies) { await ED.lock.idbPut('gd-base:' + x.f.dev, x.c.data).catch(() => {}); seen[x.f.id] = x.f.ver; }
      setCfg({ seen, joined: true, mergedFrom: from });
    } else {
      for (const f of changed) {
        const peer = await readCopy(f.id);
        // what both sides already had: this device's copy that the other one merged last (S) together with the other
        // device's copy that was merged here last (Q) — both were seen on both sides. With that as the base, additions,
        // edits and deletions made on either side since are told apart, whatever order the devices synced in.
        const saw = peer.merged[me.id];
        const S = saw ? await ED.lock.idbGet('gd-mine:' + saw).catch(() => null) : null;
        const Q = await ED.lock.idbGet('gd-base:' + f.dev).catch(() => null);
        const base = S && Q ? (SU().stamp(S) >= SU().stamp(Q) ? ED.merge3(null, S, Q) : ED.merge3(null, Q, S)) : (S || Q || null);
        const local = D();
        const next = ED.merge3(base || null, local, peer.data);
        if (!SU().sameData(next, local)) apply(next);
        await ED.lock.idbPut('gd-base:' + f.dev, peer.data).catch(() => {});
        seen[f.id] = f.ver;
        const c1 = cfg();
        setCfg({ seen, mergedFrom: Object.assign({}, c1.mergedFrom || {}, { [f.dev]: peer.stamp }), peerSaw: Object.assign({}, c1.peerSaw || {}, saw ? { [f.dev]: saw } : {}) });
      }
      if (!c0.joined) setCfg({ joined: true });
    }
    // this device's copy (never before it has joined: a new device's starter pages must not spread to the others)
    if (!cfg().joined && peers.length) return 'deferred';
    const st = SU().stamp(D());
    if (!mine || cfg().upStamp !== st || mine.devName !== me.name.slice(0, 60)) {
      const meta = { name: 'E-Diary — ' + me.name + '.json', mimeType: 'application/json', appProperties: { ediary: 'dev', dev: me.id, name: me.name.slice(0, 60) } };
      if (!mine) meta.parents = [cfg().folder];
      const snap = U.clone(D());
      const r = await upload(await payload(), meta, mine && mine.id);
      // keep what was sent, so a later merge can tell what both sides had (the last 12, and any another device still refers to)
      await ED.lock.idbPut('gd-mine:' + st, snap).catch(() => {});
      const c2 = cfg(), list = (c2.mine || []).filter(x => x !== st).concat([st]);
      const keep = new Set(list.slice(-12).concat(Object.values(c2.peerSaw || {})).map(String));
      for (const x of list) if (!keep.has(String(x))) await ED.idb.del('gd-mine:' + x).catch(() => {});
      setCfg({ upStamp: st, myFile: r.id, mine: list.filter(x => keep.has(String(x))) });
      GD.lastUp = Date.now();
    }
    GD.peers = peers.map(f => ({ id: f.id, dev: f.dev, name: f.devName || String(f.name).replace(/^E-Diary — |\.json$/g, ''), mod: f.mod, size: f.size }));
    return wait ? 'deferred' : 'ok';
  }

  GD.unsaved = () => !!(GD.on() && D() && cfg().upStamp !== SU().stamp(D()));
  GD.sync = async why => {
    if (!GD.on() || !D()) return;
    if (GD.busy) { GD.again = true; return; }
    const bl = GD.blocked();
    if (bl) { GD.state = 'blocked'; GD.error = bl === 'noclient' ? 'Paste your OAuth Client ID first (below).' : bl; paint(); return; }
    if (!GD.connected()) {
      if (why === 'manual' || why === 'connect') { if (!(await GD.signIn(why === 'connect' ? 'consent' : ''))) { failSignIn(); return; } }
      else { GD.needClick = true; GD.state = 'signin'; paint(); if (gisReady() === false) loadGIS().catch(() => {}); return; }
    }
    const run = async () => {
      GD.busy = true; GD.state = 'syncing'; paint();
      try {
        const r = await round(why);
        if (r === 'ok') { GD.error = ''; GD.lastSync = Date.now(); setCfg({ lastSync: GD.lastSync }); GD.state = 'ok'; GD.fails = 0; }
        else if (r === 'deferred') GD.state = 'ok';
      } catch (err) { fail(err); }
      finally { GD.busy = false; paint(); }
    };
    if (navigator.locks && navigator.locks.request) await navigator.locks.request('e-diary-gdrive', run); else await run();
    if (GD.again) { GD.again = false; setTimeout(() => GD.sync('again'), 300); }
  };
  function failSignIn() {
    const w = GD.lastWhy;
    GD.state = 'signin'; GD.needClick = true;
    GD.error = w === 'popup' ? 'The browser blocked Google’s sign-in window. Allow pop-ups for this address and click Sign in again.' : w === 'closed' ? 'The Google window was closed before finishing.' : w === 'scope' ? 'Google did not give the diary access to Google Drive. Click Sign in again and tick the Google Drive box on Google’s screen.' : (w || 'Sign-in did not finish.');
    paint();
  }
  function fail(err) {
    const m = err && err.message;
    GD.fails = (GD.fails || 0) + 1;
    if (m === 'signin') { GD.state = 'signin'; GD.needClick = true; GD.error = ''; }
    else if (m === 'offline') { GD.state = 'offline'; GD.error = 'No internet connection — changes are kept here and go to Google Drive when you are back online.'; setTimeout(() => GD.sync('retry'), Math.min(300000, 15000 * GD.fails)); }
    else if (m === 'apidisabled') { GD.state = 'error'; GD.error = 'apidisabled'; }
    else if (m === 'scope') { GD.state = 'signin'; GD.needClick = true; GD.error = 'Google did not give the diary access to Google Drive. Click Sign in again and tick the Google Drive box.'; GD.token = null; GD.exp = 0; }
    else if (m === 'Sync cancelled' || (err && err.cancelled)) { GD.state = 'ok'; }
    else { GD.state = 'error'; GD.error = m || 'Google Drive did not answer'; setTimeout(() => GD.sync('retry'), Math.min(300000, 20000 * GD.fails)); }
  }

  /* ---------------- turning it on and off ---------------- */
  GD.connect = async () => {
    const bl = GD.blocked();
    if (bl === 'noclient') { ED.ui.toast('Paste your OAuth Client ID first.', { timeout: 6000 }); return false; }
    if (bl) { ED.ui.toast(bl, { timeout: 9000 }); return false; }
    setCfg({ on: true });
    if (!(await GD.signIn('consent'))) { failSignIn(); return false; }
    await GD.sync('connect');
    if (GD.state === 'ok') {
      ED.ui.toast('Google Drive sync is on. This device saves its copy to “' + FOLDER + '” in your Google Drive.', { timeout: 8000 });
      if (ED.sync.file.handle) offerUnlink();
    }
    return GD.state === 'ok';
  };
  async function offerUnlink() {
    const ok = await ED.ui.confirm({ title: 'Stop using the diary file?', message: 'This device also keeps the diary in the file “' + ED.sync.file.name + '” (the older way). Google Drive sync replaces it — and the file’s “one PC at a time” read-only mode can stop this device from saving. Unlink the file? (The file itself is not deleted.)', ok: 'Unlink the file', cancel: 'Keep both' });
    if (ok) ED.sync.file.unlink();
  }
  GD.turnOff = () => { setCfg({ on: false }); GD.state = 'off'; clearTimeout(renewTimer); paint(); ED.ui.toast('Google Drive sync is off on this device. The copies in Google Drive stay.'); };
  GD.removeDevice = async id => {
    const p = GD.peers.find(x => x.id === id); if (!p) return;
    const ok = await ED.ui.confirm({ title: 'Remove an old device', message: 'Remove the copy from “' + p.name + '” from Google Drive? Do this only for a device you no longer use — its changes are already in this diary. (Google Drive keeps it in Trash for 30 days.)', ok: 'Remove', danger: true });
    if (!ok) return;
    try {
      if (!GD.connected() && !(await GD.signIn(''))) { failSignIn(); return; }
      await api('PATCH', API + '/files/' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
      GD.peers = GD.peers.filter(x => x.id !== id);
      ED.lock.idbPut('gd-base:' + p.dev, null).catch(() => {});
      ED.ui.toast('Removed: ' + p.name);
    } catch (err) { fail(err); }
    paint();
  };

  /* ---------------- what you see ---------------- */
  const ago = t => { if (!t) return ''; const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : U.fmtShort(U.key(new Date(t))); };
  GD.status = () => {
    if (!GD.on()) return null;
    if (GD.state === 'error') return { cls: 'err', label: 'Google Drive sync problem — see Backup & Sync' };
    if (GD.state === 'blocked') return { cls: 'warn', label: 'Google Drive sync needs setting up — see Backup & Sync' };
    if (GD.state === 'signin' || (!GD.connected() && GD.unsaved())) return { cls: 'warn', label: 'Google Drive: sign in again to keep saving (click anywhere in the diary)' };
    if (GD.state === 'offline') return { cls: 'warn', label: 'Offline — changes go to Google Drive when you are back online' };
    if (GD.unsaved() || GD.busy) return { cls: '', label: 'Saving to Google Drive…' };
    return { cls: '', label: 'Saved to Google Drive' + (GD.lastSync ? ' (' + U.fmtStamp(GD.lastSync) + ')' : '') };
  };
  GD.notice = () => {
    if (!GD.on() || GD.blocked()) return '';
    if (GD.state === 'error' && GD.error === 'apidisabled') return '<div class="notice err">' + ED.icon('cloudOff') + '<span class="grow"><b>Google Drive sync:</b> the Google Drive API is not turned on for your Client ID’s Google Cloud project. Turn it on once, then click Try again.</span><a class="btn small" href="' + e(GD.enableUrl) + '" target="_blank" rel="noopener">Turn it on</a><button type="button" class="btn small primary" data-gd="sync">Try again</button></div>';
    if ((GD.state === 'signin' || !GD.connected()) && (GD.unsaved() || GD.needClick)) return '<div class="notice">' + ED.icon('cloud') + '<span class="grow"><b>Google Drive sync is waiting</b> for Google’s one-hour pass to be renewed' + (GD.unsaved() ? ' — your latest changes are saved here and go up as soon as it is' : '') + '.</span><button type="button" class="btn small primary" data-gd="sync">Sign in</button></div>';
    return '';
  };
  function paint() {
    const t = document.getElementById('sync-tool');
    if (t && ED.sync) { const s = ED.sync.status(); t.title = s.label; const dot = t.querySelector('.dot'); if (dot) dot.className = 'dot ' + s.cls; }
    const n = document.getElementById('gd-notice-slot');
    if (ED.app && ED.app.requestRender && GD.lastNotice !== GD.notice()) { GD.lastNotice = GD.notice(); ED.app.requestRender(); }
    if (ED.settings && ED.settings.api && ED.settings.tab === 'data') { const box = document.getElementById('gd-box'); if (box) { box.outerHTML = GD.settingsHtml(); } }
    return n;
  }
  GD.paint = paint;

  GD.settingsHtml = () => {
    const c = cfg(), on = GD.on(), bl = GD.blocked();
    const head = '<div id="gd-box"><h3 class="set-h">Sync through your Google account (Google Drive) <span class="chip ok-chip">recommended</span></h3>';
    if (ED.env.claude) return head + '<p class="hint">Inside Claude your diary is already saved to your Claude account. Use Google Drive sync in the copy on your computer.</p></div>';
    const how = '<ul class="set-ul"><li>Each device keeps its own copy in a folder <b>“' + FOLDER + '”</b> in your Google Drive and writes only that copy — devices can never write over each other.</li>' +
      '<li>Each device reads the others’ copies and merges them in, item by item: what you add, change or delete anywhere comes through. Every device can be used at the same time.</li>' +
      '<li>Works on every computer and on the phone (the mobile version), without Google Drive for desktop and without choosing a file.</li></ul>';
    if (!on) {
      return head + how +
        (bl === 'noclient' ? '<div class="set-row"><label class="lbl" for="gd-cid">OAuth Client ID (the same one Google Calendar uses)</label><input id="gd-cid" class="field" placeholder="123456-abc.apps.googleusercontent.com" spellcheck="false" autocomplete="off"></div><p class="hint">No Client ID yet? Settings → Google Calendar → “How to get a Client ID” has the steps (about 5 minutes, once).</p>' : bl ? '<p class="hint err-text">' + e(bl) + '</p>' : '') +
        '<ol class="set-ol"><li>In <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Cloud Console → Google Drive API</a> (same project as your Client ID) click <b>Enable</b>, once.</li>' +
        '<li>Click <b>Turn on Google Drive sync</b> and allow “See, edit, create and delete only the specific Google Drive files you use with this app”.</li>' +
        '<li>Do the same on your other devices — they find the folder and join in.</li></ol>' +
        '<div class="btn-row"><button type="button" class="btn primary" data-gd="connect"' + (bl && bl !== 'noclient' ? ' disabled' : '') + '>' + ED.icon('cloud') + 'Turn on Google Drive sync</button></div></div>';
    }
    const s = GD.status() || { label: '' };
    const err = GD.error === 'apidisabled' ? '<p class="set-status err-text">' + ED.icon('info') + '<span>The Google Drive API is off in your Google Cloud project. <a href="' + e(GD.enableUrl) + '" target="_blank" rel="noopener">Turn it on</a>, then click Sync now.</span></p>'
      : GD.error ? '<p class="set-status err-text">' + ED.icon('info') + '<span>' + e(GD.error) + '</span></p>' : '';
    const peers = GD.peers.length ? '<table class="st-table gd-peers"><thead><tr><th>Other devices</th><th>Last saved</th><th></th></tr></thead><tbody>' + GD.peers.map(p => '<tr><td>' + e(p.name) + '</td><td class="num">' + e(ago(p.mod)) + '</td><td><button type="button" class="link-btn" data-gd="remove" data-id="' + e(p.id) + '">Remove</button></td></tr>').join('') + '</tbody></table>' : '<p class="hint">No other device has joined yet. Turn on Google Drive sync on your other computers and phone.</p>';
    return head +
      '<p class="set-status">' + ED.icon(GD.state === 'ok' && !GD.unsaved() ? 'cloudCheck' : 'cloud') + '<span><b>On</b> · ' + e(s.label) + (c.lastSync ? ' · last synced ' + e(U.fmtStamp(c.lastSync)) : '') + '</span></p>' + err +
      '<div class="btn-row"><button type="button" class="btn primary" data-gd="sync">' + ED.icon('sync') + (GD.connected() ? 'Sync now' : 'Sign in and sync') + '</button><button type="button" class="btn" data-gd="off">Turn off on this device</button>' +
      (c.folder ? '<a class="btn ghost" href="https://drive.google.com/drive/folders/' + e(c.folder) + '" target="_blank" rel="noopener">' + ED.icon('external') + 'Open the folder</a>' : '') + '</div>' +
      '<div class="set-row"><label class="lbl" for="gd-dev">This device’s name</label><input id="gd-dev" class="field" value="' + e(dev().name) + '" maxlength="40"><p class="hint">Its copy in Google Drive is “E-Diary — ' + e(dev().name) + '.json”.</p></div>' +
      peers +
      '<p class="hint">Google gives browser apps a one-hour pass. To renew it without a click, allow pop-ups for this address (the browser’s address bar → site settings → Pop-ups: Allow). Otherwise your next click in the diary renews it — a Google window opens and closes by itself.</p>' +
      (ED.sync.file.handle ? '<p class="hint">' + ED.icon('info') + ' The diary file “' + e(ED.sync.file.name) + '” is still linked below (the older way). You can unlink it: Google Drive sync replaces it.</p>' : '') + '</div>';
  };
  GD.bindSettings = root => {
    root.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-gd]'); if (!b) return;
      const k = b.dataset.gd;
      if (k === 'connect') {
        const cid = root.querySelector('#gd-cid');
        if (cid && cid.value.trim()) { if (!/\.apps\.googleusercontent\.com$/.test(cid.value.trim())) { ED.ui.toast('That is not a Client ID — it ends in .apps.googleusercontent.com'); return; } D().settings.gcal.clientId = cid.value.trim(); ED.store.commit(); }
        await GD.connect();
      }
      if (k === 'sync') GD.sync('manual');
      if (k === 'off') GD.turnOff();
      if (k === 'remove') GD.removeDevice(b.dataset.id);
      paint();
    });
    root.addEventListener('change', ev => {
      if (ev.target.id === 'gd-dev') { ED.sync.file.setDeviceName(ev.target.value); GD.sync('rename'); }
    });
  };
  // the notice bar's "Sign in" / "Try again" (outside Settings)
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('.notice [data-gd]'); if (!b || (ED.settings && ED.settings.api && ED.settings.api.el && ED.settings.api.el.contains(b))) return;
    GD.sync('manual');
  });

  /* ---------------- when it runs ---------------- */
  let last = 0, timer = null;
  const soon = (ms) => { clearTimeout(timer); timer = setTimeout(() => GD.sync('save'), ms); };
  GD.init = () => {
    if (!GD.on()) return;
    try { const t = JSON.parse(sessionStorage.getItem(TK) || 'null'); if (t && t.t && t.x > Date.now() + 60000 && t.c === clientId()) { GD.token = t.t; GD.exp = t.x; planRenewal(); } } catch (err) { /* ignore */ }
    GD.lastSync = cfg().lastSync || 0;
    if (!GD.blocked()) loadGIS().catch(() => {});
    ED.store.on(type => {
      if (type !== 'saved' || !GD.on()) return;
      // after a change: within 4 s, but at most every 20 s while you keep typing
      const wait = Math.max(4000, 20000 - (Date.now() - last));
      if (!timer || wait < 5000) soon(wait);
      last = Date.now();
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') GD.sync('focus'); else if (GD.unsaved() && GD.connected()) GD.sync('hide'); });
    window.addEventListener('online', () => GD.sync('online'));
    setInterval(() => { if (document.visibilityState === 'visible') GD.sync('poll'); }, 60000);
    GD.sync('start');
  };
})();
