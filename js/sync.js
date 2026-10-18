/* E-Diary — keeping copies elsewhere, without losing edits:
   1) a linked diary file (Chrome/Edge File System Access) — free sync through a OneDrive/Google Drive/Dropbox folder
   2) optional cloud sync through a secret GitHub gist, encrypted with a passphrase (AES-GCM)
   Both remember the last copy they agreed on ("base") and merge changes from both sides item by item. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const GIST_KEY = 'e-diary-gist-v1';
  const FILE_NAME = 'e-diary.json';

  /* ======================= three-way merge ======================= */
  const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x))
    ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x);
  const same = (a, b) => stable(a) === stable(b);
  const newer = (l, r) => ((r && r.updatedAt) || 0) > ((l && l.updatedAt) || 0) ? r : l;
  function pick(b, l, r) {
    const hasL = l !== undefined, hasR = r !== undefined, hasB = b !== undefined;
    if (hasL && hasR) {
      if (same(l, r)) return l;
      if (hasB && same(l, b)) return r;   // only the other side changed it
      if (hasB && same(r, b)) return l;   // only this side changed it
      return newer(l, r);                 // both changed: the later edit wins
    }
    if (hasL) return hasB && same(l, b) ? undefined : l;  // deleted on the other side (unless edited here)
    if (hasR) return hasB && same(r, b) ? undefined : r;  // deleted here (unless edited there)
    return undefined;
  }
  function mergeList(b, l, r) {
    b = b || []; l = l || []; r = r || [];
    const B = new Map(b.map(x => [x.id, x])), L = new Map(l.map(x => [x.id, x])), R = new Map(r.map(x => [x.id, x]));
    const order = l.map(x => x.id).concat(r.map(x => x.id).filter(id => !L.has(id)));
    const out = [];
    order.forEach(id => { const v = pick(B.get(id), L.get(id), R.get(id)); if (v !== undefined) out.push(v); });
    return out;
  }
  function mergeMap(b, l, r) {
    b = b || {}; l = l || {}; r = r || {};
    const out = {};
    new Set(Object.keys(l).concat(Object.keys(r))).forEach(k => { const v = pick(b[k], l[k], r[k]); if (v !== undefined) out[k] = v; });
    return out;
  }
  /* a map of maps (the habit log: day → habit → mark), merged one mark at a time */
  function mergeMap2(b, l, r) {
    b = b || {}; l = l || {}; r = r || {};
    const out = {};
    new Set(Object.keys(l).concat(Object.keys(r))).forEach(k => {
      const v = mergeMap(b[k], l[k], r[k]);
      if (Object.keys(v).length) out[k] = v;
    });
    return out;
  }
  ED.merge3 = (base, local, remote) => {
    base = base || {};
    const out = {};
    ['tasks', 'events', 'categories', 'roles', 'goals', 'values', 'notebooks', 'notes'].forEach(k => { out[k] = mergeList(base[k], local[k], remote[k]); });
    out.dayNotes = mergeMap(base.dayNotes, local.dayNotes, remote.dayNotes);
    out.settings = mergeMap(base.settings, local.settings, remote.settings);
    const q = pick(base.quotes, local.quotes, remote.quotes); out.quotes = q === undefined ? [] : q;
    const m = pick(base.mission, local.mission, remote.mission); out.mission = m === undefined ? { html: '' } : m;
    out.meta = Object.assign({}, remote.meta || {}, local.meta || {});
    // sections added in 1.1: lists inside are merged item by item, other fields by the later edit
    const nested = (k, lists, deep) => {      // deep: { field: 1 (map, merged by key) | 2 (map of maps, merged a level deeper) }
      const b = base[k] || {}, l = local[k], r = remote[k];
      if (l == null && r == null) return undefined;
      if (l == null || r == null) { const v = pick(base[k], l == null ? undefined : l, r == null ? undefined : r); return v === undefined ? null : v; }
      const o = {};
      new Set(Object.keys(l).concat(Object.keys(r))).forEach(f => {
        if (lists.indexOf(f) >= 0) o[f] = mergeList(b[f], l[f], r[f]);
        else if (f === 'map' || (deep && deep[f] === 1)) o[f] = mergeMap(b[f], l[f], r[f]);
        else if (deep && deep[f] === 2) o[f] = mergeMap2(b[f], l[f], r[f]);
        else { const v = pick(b[f], l[f], r[f]); if (v !== undefined) o[f] = v; }
      });
      return o;
    };
    out.study = nested('study', ['sessions', 'shelf']) || { plan: null, sessions: [] };
    // the same plan changed on both sides: its lists (books, lectures, papers and other reading, categories, topics) merge item by item
    const pb = base.study && base.study.plan, pl = local.study && local.study.plan, pr = remote.study && remote.study.plan;
    if (out.study.plan && pl && pr && pl.id === pr.id) {
      const lists = {};
      ['books', 'lectures', 'items', 'srcCats', 'topics'].forEach(k => { lists[k] = mergeList(pb && pb.id === pl.id ? pb[k] : null, pl[k], pr[k]); });
      out.study.plan = Object.assign({}, out.study.plan, lists);
    }
    out.finance = nested('finance', ['cats', 'accounts', 'goals', 'holdings', 'bills', 'records']) || undefined;
    out.sites = mergeList(base.sites, local.sites, remote.sites);
    out.bucket = nested('bucket', ['list']) || undefined;
    out.wardrobe = nested('wardrobe', ['items', 'wish'], { plan: 1 }) || undefined;
    if (local.siteCats || remote.siteCats) out.siteCats = mergeList(base.siteCats, local.siteCats, remote.siteCats);
    const vl = nested('vault', ['items']); out.vault = vl && vl.salt ? vl : vl === null ? null : (local.vault || remote.vault || null);   // null: erased or deleted on one side
    out.gcal = nested('gcal', []) || { map: {} };
    out.habits = nested('habits', ['list'], { log: 2 }) || { list: [], log: {} };
    out.interview = nested('interview', ['list', 'qs', 'docs', 'mocks'], { log: 1 }) || undefined;
    out.health = nested('health', ['meds', 'treats', 'visits', 'vitals', 'reports'], { taken: 2 }) || undefined;
    out.meetings = nested('meetings', [], { calInfo: 1, notes: 1 }) || undefined;
    out.lists = nested('lists', ['trips', 'groc', 'foods'], { meals: 1 }) || undefined;
    out.exam = nested('exam', ['list', 'topics', 'mocks'], { log: 1 }) || undefined;
    out.maps = nested('maps', ['list']) || undefined;
    out.jobs = nested('jobs', ['items', 'sites']) || undefined;
    // deletion markers from both sides (js/store.js markGone): an item deleted anywhere stays deleted, unless it was
    // changed again after it was deleted
    const gone = Object.assign({}, (remote.meta && remote.meta.gone) || {});
    Object.entries((local.meta && local.meta.gone) || {}).forEach(([id, t]) => { if (!(gone[id] >= t)) gone[id] = t; });
    if (Object.keys(gone).length) {
      const res = JSON.parse(JSON.stringify(out));   // a copy: the two sides' own lists are never changed here
      res.meta = Object.assign({}, res.meta, { gone });
      const when = x => +(x.updatedAt || x.createdAt || 0);
      const sweep = o => {
        if (Array.isArray(o)) { for (let i = o.length - 1; i >= 0; i--) { const x = o[i]; if (x && typeof x === 'object') { if (typeof x.id === 'string' && gone[x.id] && gone[x.id] >= when(x)) o.splice(i, 1); else sweep(x); } } }
        else if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (k !== 'meta' && o[k] && typeof o[k] === 'object') sweep(o[k]); });
      };
      Object.keys(res).forEach(k => { if (k !== 'meta') sweep(res[k]); });
      return res;
    }
    return out;
  };
  const stamp = d => (d && d.meta && d.meta.updatedAt) || 0;
  /* a diary that only holds the starter set and example entries */
  const fresh = d => !d.tasks.some(t => !t.sample) && !d.notes.some(n => !n.sample) && !d.goals.some(g => !g.sample) &&
    Object.keys(d.dayNotes).every(k => (d.meta.sampleDayNotes || []).indexOf(k) >= 0);
  const apply = (data, why) => ED.store.replaceAll(data, why || 'remote', { keepStamp: true });
  /* the same, apart from when it was last changed */
  const sameData = (a, b) => same(Object.assign({}, a, { meta: null }), Object.assign({}, b, { meta: null }));
  ED.syncUtil = { same, sameData, stamp, fresh: d => !!(d && d.tasks && d.notes && d.goals && d.dayNotes && d.meta) && fresh(d) };   // used by js/gdrive.js

  /* decide what to do with a copy found elsewhere; returns 'none' | 'pulled' | 'pushed' | 'merged' */
  async function reconcile(theirs, base, label) {
    const local = ED.store.data;
    if (!theirs) return 'pushed';
    if (!base) {
      if (stamp(theirs) === stamp(local)) return 'none';
      if (fresh(local)) { apply(theirs); return 'pulled'; }
      const choice = await ED.ui.confirm({
        title: 'Two diaries', message: 'This browser already has diary entries, and so does ' + label + '. Use the ' + label + ' copy here, or merge both into one diary?',
        choices: [{ id: 'theirs', label: 'Use ' + label, primary: false }, { id: 'merge', label: 'Merge both' }],
      });
      if (!choice) throw new Error('Sync cancelled');
      if (choice === 'theirs') { apply(theirs); return 'pulled'; }
      const both = ED.merge3(null, local, theirs);
      both.meta = Object.assign({}, both.meta, { updatedAt: Date.now() });
      apply(both);
      return 'merged';
    }
    const localChanged = stamp(local) !== stamp(base);
    const theirChanged = stamp(theirs) !== stamp(base);
    if (!localChanged && !theirChanged) return 'none';
    if (theirChanged && !localChanged) { apply(theirs); return 'pulled'; }
    if (localChanged && !theirChanged) return 'pushed';
    const merged = ED.merge3(base, local, theirs);
    merged.meta = Object.assign({}, merged.meta, { updatedAt: Date.now() });
    apply(merged);
    return 'merged';
  }

  /* ======================= one PC at a time =======================
     The diary file carries owner: { id, name, at } — the PC that has it open, refreshed every 2 minutes.
     Another PC that finds a fresh owner opens read-only (nothing it does reaches the file) until the first PC closes,
     or until the owner is older than 6 minutes (that PC crashed or lost its connection), or you choose "Take over". */
  const DEV_KEY = 'e-diary-device', SAVED_KEY = 'e-diary-file-stamp', RO_KEY = 'e-diary-file-ro';
  const BEAT = 2 * 60e3, STALE = 6 * 60e3;
  const device = () => {
    let d = null; try { d = JSON.parse(localStorage.getItem(DEV_KEY) || 'null'); } catch (err) { d = null; }
    if (!d || !d.id) {
      const ua = navigator.userAgent || '', os = /Windows/.test(ua) ? 'Windows PC' : /Mac/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux PC' : 'Computer';
      d = { id: U.uid('dev'), name: os + ' ' + Math.random().toString(36).slice(2, 5).toUpperCase() };
      try { localStorage.setItem(DEV_KEY, JSON.stringify(d)); } catch (err) { /* private window */ }
    }
    return d;
  };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (err) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (err) { /* ignore */ } };
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m === 1 ? '1 minute ago' : m < 60 ? m + ' minutes ago' : Math.round(m / 60) + ' h ago'; };

  /* ======================= linked file ======================= */
  const file = {
    ro: false, owner: null, held: false, beat: null, poll: null,
    device,
    setDeviceName(n) { const d = device(); d.name = String(n || '').trim().slice(0, 40) || d.name; lsSet(DEV_KEY, JSON.stringify(d)); },
    supported: typeof window.showSaveFilePicker === 'function' && !ED.env.framed && !ED.env.claude,
    handle: null, name: '', perm: 'none', lastWrite: 0, lastModified: 0, error: null, busy: false,

    async init() {
      if (!this.supported) return;
      try { await ED.idb.open(); this.handle = await ED.idb.get('file-handle') || null; } catch (err) { this.handle = null; }
      if (!this.handle) return;
      this.name = this.handle.name;
      try { this.perm = await this.handle.queryPermission({ mode: 'readwrite' }); } catch (err) { this.perm = 'prompt'; }
      if (this.perm === 'granted') await this.acquire();
      ED.app.requestRender();
    },
    /* open the file for this PC: read-only when another PC has it open */
    async acquire(force) {
      if (!this.handle || this.perm !== 'granted' || this.busy) return;
      this.busy = true;
      let theirs;
      try { theirs = await this.read(); }
      catch (err) { this.busy = false; if (this.lost(err)) return; this.error = err.message; if (!err.cancelled) ED.ui.toast('Could not read ' + this.name + ': ' + err.message, { kind: 'err' }); return; }
      const me = device(), o = this.owner;
      const other = o && o.id !== me.id && Date.now() - (o.at || 0) < STALE;
      if (other && !force) {
        if (theirs) { apply(theirs); lsSet(SAVED_KEY, stamp(ED.store.data)); }
        this.busy = false;
        this.goReadOnly(o, true);
        return;
      }
      try {
        // the file is the master copy: take it as it is, unless this PC closed last time with changes it never saved
        // (also changes made here before the file was reconnected, and a new PC that already has entries of its own)
        const unsaved = stamp(ED.store.data) !== (+lsGet(SAVED_KEY) || 0) && !lsGet(RO_KEY);
        if (theirs && !unsaved) { if (stamp(theirs) !== stamp(ED.store.data)) apply(theirs); }
        else if (theirs) {
          const base = await ED.lock.idbGet('file-base').catch(() => null);
          const r = await reconcile(theirs, base, 'the diary file');
          if (r === 'merged') ED.ui.toast('Changes this PC had not saved last time were merged into ' + this.name);
        }
        this.firstAcquired = true;
        this.ro = false; this.held = true; lsSet(RO_KEY, null); this.hideBar();
        await this.writeRaw();
        this.error = null;
      } catch (err) { this.error = err.message; }
      finally { this.busy = false; }
      clearInterval(this.poll); this.poll = null;
      clearInterval(this.beat); this.beat = setInterval(() => this.heartbeat(), BEAT);
      ED.app.requestRender();
    },
    async heartbeat() {
      if (!this.held || this.ro || this.busy || this.perm !== 'granted') return;
      if (!(await this.stillMine())) return;
      if (!(await this.safeToWrite())) return;
      this.busy = true; try { await this.writeRaw(); } catch (err) { if (!this.lost(err)) this.error = err.message; } finally { this.busy = false; }
    },
    /* before writing: has another PC taken the file over? */
    async stillMine() {
      try {
        const f = await this.handle.getFile(); if (!f.size) return true;
        const obj = JSON.parse(await f.text()), o = obj && obj.owner;
        if (o && o.id && o.id !== device().id && (o.at || 0) > (this.claimedAt || 0) && Date.now() - o.at < STALE) {
          this.held = false; clearInterval(this.beat);
          try { apply(await ED.store.openImport(obj, 'The diary file is locked with a password.')); lsSet(SAVED_KEY, stamp(ED.store.data)); } catch (err) { /* keep what is shown */ }
          this.goReadOnly(o, false, true);
          return false;
        }
      } catch (err) { /* unreadable for a moment (Drive is syncing): write anyway */ }
      return true;
    },
    goReadOnly(o, ask, lost) {
      this.ro = true; this.held = false; this.roOwner = o; lsSet(RO_KEY, '1');
      this.roSnap = U.clone(ED.store.data);
      this.showBar();
      clearInterval(this.poll); this.poll = setInterval(() => this.checkFree(), 60e3);
      if (ask || lost) ED.ui.confirm({
        title: lost ? 'Opened on another PC' : 'Diary open on another PC',
        message: (lost ? 'The diary was taken over by “' + o.name + '”. ' : 'The diary file is open on “' + o.name + '” (active ' + ago(o.at) + '). ') +
          'Only one PC can change it at a time, so here it is read-only: you can look, but nothing you change is saved. Close the diary on “' + o.name + '” and this PC can edit it (it checks every minute). ' +
          'If that PC is switched off or crashed, it frees itself after 6 minutes — or choose Take over.',
        choices: [{ id: 'take', label: 'Take over', danger: true }, { id: 'ro', label: 'Read-only', primary: true }], cancel: 'Read-only',
      }).then(c => { if (c === 'take') this.takeOver(); });
      ED.app.requestRender();
    },
    async takeOver() {
      const ok = await ED.ui.confirm({ title: 'Take over the diary', message: 'Only do this if the diary is really closed on “' + ((this.roOwner || {}).name || 'the other PC') + '”. If it is still open there, changes made there after now will not be saved.', ok: 'Take over', danger: true });
      if (ok) await this.acquire(true);
    },
    async checkFree() {
      if (!this.ro || this.busy || !this.handle) return;
      try {
        const f = await this.handle.getFile(); if (!f.size) return;
        const obj = JSON.parse(await f.text()), o = obj && obj.owner;
        const free = !o || !o.id || o.id === device().id || Date.now() - (o.at || 0) >= STALE;
        if (free) { await this.acquire(); if (!this.ro) ED.ui.toast('The other PC closed the diary — you can edit here now'); }
        else { this.roOwner = o; this.showBar(); }
      } catch (err) { /* try again next minute */ }
    },
    /* let another PC have it (also done when the diary closes) */
    async release(stay) {
      if (!this.held || this.ro || !this.handle) return;
      clearInterval(this.beat);
      try { await this.writeRaw(true); } catch (err) { /* the 6-minute rule frees it */ }
      this.held = false;
      if (stay) { this.goReadOnly({ id: 'released', name: 'no PC (released)', at: 0 }, false); ED.ui.toast('Released — another PC can open the diary now. Click “Edit here again” to take it back.'); }
    },
    showBar() {
      let bar = document.getElementById('ed-ro-bar');
      if (!bar) { bar = document.createElement('div'); bar.id = 'ed-ro-bar'; bar.className = 'ro-bar'; bar.setAttribute('role', 'status'); document.body.appendChild(bar); }
      const o = this.roOwner || {};
      bar.innerHTML = ED.icon('lock') + '<span class="grow">' + (o.id === 'released' ? '<b>Read-only</b> — you released the diary file for other PCs.'
        : '<b>Read-only</b> — the diary is open on “' + U.esc(o.name || 'another PC') + '” (active ' + ago(o.at || 0) + '). Changes here are not saved.') + '</span>' +
        '<button type="button" class="btn small" data-ro="retry">' + (o.id === 'released' ? 'Edit here again' : 'Check again') + '</button>' + (o.id === 'released' ? '' : '<button type="button" class="btn small ghost" data-ro="take">Take over</button>');
      bar.onclick = ev => { const b = ev.target.closest('[data-ro]'); if (!b) return; if (b.dataset.ro === 'take') this.takeOver(); else if (o.id === 'released') this.acquire(true); else this.checkFree().then(() => { if (this.ro) ED.ui.toast('Still open on “' + (this.roOwner || {}).name + '”'); }); };
      document.body.classList.add('ed-ro');
    },
    /* The link to the file stopped working. On Android this happens whenever Google Drive replaces the file with a newer
       version (the phone only gets a link to that one copy), and on a PC when the file was moved, renamed or deleted. */
    lost(err) {
      if (!err || err.name !== 'NotFoundError') return false;
      this.perm = 'lost'; this.held = false; this.error = null;
      clearInterval(this.beat); clearInterval(this.poll);
      ED.app.requestRender(); if (ED.settings && ED.settings.refresh) try { ED.settings.refresh(); } catch (e2) { /* settings closed */ }
      if (!this.lostAsked) {
        this.lostAsked = true;
        ED.ui.confirm({ title: 'Choose the diary file again', message: 'The link to ' + this.name + ' no longer works. ' +
          (/Android/.test(navigator.userAgent) ? 'On Android this happens each time Google Drive brings in a newer copy of the file (for example after you used the diary on your PC): the phone was only given that one copy. ' : 'The file may have been moved, renamed or replaced. ') +
          'Pick ' + this.name + ' again in Google Drive to load the latest diary. Nothing in this diary was lost.',
          choices: [{ id: 'pick', label: 'Choose the file again', primary: true }], cancel: 'Later' }).then(c => { this.lostAsked = false; if (c === 'pick') this.openExisting(true); });
      }
      return true;
    },
    hideBar() { const bar = document.getElementById('ed-ro-bar'); if (bar) bar.remove(); document.body.classList.remove('ed-ro'); },
    async read() {
      const f = await this.handle.getFile();
      this.lastModified = f.lastModified;
      if (!f.size) { this.owner = null; return null; }
      const obj = JSON.parse(await f.text());
      this.owner = obj && obj.owner && obj.owner.id ? obj.owner : null;
      return ED.store.openImport(obj, 'The diary file ' + this.name + ' is locked with a password. Enter it to load the file.');
    },
    /* read the file, merge if needed, then write the result back */
    async sync(manual) {
      if (this.ro) { await this.checkFree(); return; }
      if (!this.handle || this.perm !== 'granted' || this.busy) return;
      this.busy = true;
      try {
        const theirs = await this.read();
        const base = await ED.lock.idbGet('file-base').catch(() => null);
        const r = await reconcile(theirs, base, 'the diary file');
        if (r === 'merged') ED.ui.toast('Merged changes from ' + this.name);
        if (r === 'pulled') ED.ui.toast('Loaded the latest diary from ' + this.name);
        if (manual && (r === 'none' || r === 'pushed')) ED.ui.toast(r === 'none' ? 'Already up to date with ' + this.name : 'Your newer changes were saved to ' + this.name);
        if (r !== 'pulled' && r !== 'none') await this.writeRaw();
        else { await ED.lock.idbPut('file-base', ED.store.data).catch(() => {}); lsSet(SAVED_KEY, stamp(ED.store.data)); }
        this.error = null;
      } catch (err) {
        this.error = err.message;
        if (this.lost(err)) return;
        if (err.name === 'NotAllowedError') { this.perm = 'prompt'; ED.app.requestRender(); }
        else if (manual && !err.cancelled) ED.ui.toast('Could not read ' + this.name + ': ' + err.message, { kind: 'err' });
      } finally { this.busy = false; }
    },
    /* Never write over a version this PC has not seen. Before every automatic save, look at what the file holds now:
       if it is neither what this PC last saved nor what it shows, another PC (or Google Drive, delivering a newer copy late)
       changed it — merge that in first, item by item. A blank or starter diary never replaces a file that has entries. */
    async safeToWrite() {
      let obj;
      try { const f = await this.handle.getFile(); if (!f.size) return true; obj = JSON.parse(await f.text()); }
      catch (err) { return true; }   // unreadable for a moment (Drive is syncing): the next save looks again
      let st = obj && obj.stamp;
      if (st == null) { try { st = stamp(await ED.store.openImport(obj, 'The diary file ' + this.name + ' is locked with a password.')); } catch (err) { return false; } }
      const saved = +lsGet(SAVED_KEY) || 0, mine = stamp(ED.store.data);
      if (st === saved || st === mine) return true;
      this.guarded = (this.guarded || 0) + 1;
      await this.sync();
      return false;
    },
    async writeRaw(release) {
      const payload = await ED.store.exportPayload();
      payload.stamp = stamp(ED.store.data);   // readable without the password, so the check above stays quick
      if (this.held || release) { const d = device(); this.claimedAt = this.claimedAt && !release ? this.claimedAt : Date.now(); payload.owner = release ? null : { id: d.id, name: d.name, at: Date.now() }; }
      const w = await this.handle.createWritable();
      const text = JSON.stringify(payload);
      await w.write(text);
      await w.close();
      const f = await this.handle.getFile();
      this.lastModified = f.lastModified;
      this.lastWrite = Date.now();
      lsSet(SAVED_KEY, stamp(ED.store.data));
      await ED.lock.idbPut('file-base', ED.store.data).catch(() => {});
    },
    /* after each save: write, unless another computer changed the file meanwhile (then merge first) */
    async write() {
      if (!this.handle || this.perm !== 'granted' || this.busy || this.ro) return;
      if (!this.held) { await this.acquire(); return; }
      if (!(await this.stillMine())) return;
      try {
        if (!(await this.safeToWrite())) return;
        this.busy = true;
        await this.writeRaw();
        this.error = null;
      } catch (err) {
        if (this.lost(err)) return;
        this.error = err.message;
        if (err.name === 'NotAllowedError') { this.perm = 'prompt'; ED.app.requestRender(); }
      } finally { this.busy = false; }
    },
    async linkNew() {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: FILE_NAME, types: [{ description: 'E-Diary file', accept: { 'application/json': ['.json'] } }] });
        let old = null;
        try { const f = await h.getFile(); if (f.size) { const o = JSON.parse(await f.text()); if (o && (o.app === 'E-Diary' || o.tasks)) old = o; } } catch (err) { old = null; }
        if (old) {   // the file already holds a diary (e.g. saved from another PC): load it instead of writing over it
          this.handle = h; this.name = h.name; this.perm = 'granted';
          await ED.idb.set('file-handle', h);
          await ED.idb.del('file-base').catch(() => {});
          lsSet(SAVED_KEY, null); this.firstAcquired = false;
          await this.acquire();
          ED.ui.toast(h.name + ' already holds a diary, so it was opened — not written over.');
          return;
        }
        this.handle = h; this.name = h.name; this.perm = 'granted';
        await ED.idb.set('file-handle', h);
        this.held = true; this.ro = false; this.firstAcquired = true;
        this.busy = true;
        try { await this.writeRaw(); } finally { this.busy = false; }
        clearInterval(this.beat); this.beat = setInterval(() => this.heartbeat(), BEAT);
        ED.ui.toast('Your diary now also saves to ' + h.name);
      } catch (err) { if (err && err.name !== 'AbortError') ED.ui.toast('Could not link the file: ' + err.message, { kind: 'err' }); }
    },
    async openExisting(again) {   // again: the same diary file chosen again (keep what was agreed, so changes merge quietly)
      try {
        const [h] = await window.showOpenFilePicker({ types: [{ description: 'E-Diary file', accept: { 'application/json': ['.json'] } }] });
        const p = await h.requestPermission({ mode: 'readwrite' });
        this.handle = h; this.name = h.name; this.perm = p;
        await ED.idb.set('file-handle', h);
        if (!again) { await ED.idb.del('file-base').catch(() => {}); lsSet(SAVED_KEY, null); }
        this.firstAcquired = false;
        await this.acquire();
        if (again && this.perm === 'granted' && !this.error) ED.ui.toast('Loaded the latest diary from ' + h.name);
      } catch (err) { if (err && err.name !== 'AbortError') ED.ui.toast(err.message || 'Could not open that file', { kind: 'err' }); }
      ED.app.requestRender();
    },
    async reconnect() {
      if (!this.handle) return;
      if (this.perm === 'lost') return this.openExisting(true);
      try { this.perm = await this.handle.requestPermission({ mode: 'readwrite' }); } catch (err) { this.perm = 'denied'; }
      if (this.perm === 'granted') { await this.acquire(); if (!this.ro) ED.ui.toast('Diary file reconnected'); }
      ED.app.requestRender();
    },
    unsaved() { return !!(this.handle && !this.ro && ED.store.data && (this.lastWrite < (ED.store.data.meta.updatedAt || 0) || this.busy)); },
    async unlink() {
      await this.release();
      clearInterval(this.beat); clearInterval(this.poll); this.ro = false; this.held = false; lsSet(RO_KEY, null); this.hideBar();
      this.handle = null; this.name = ''; this.perm = 'none';
      try { await ED.idb.del('file-handle'); await ED.idb.del('file-base'); } catch (err) { /* ignore */ }
      ED.app.requestRender();
    },
  };
  file.schedule = U.debounce(() => file.write(), 1500);

  /* ======================= crypto helpers ======================= */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => { const s = atob(str); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  async function keyFrom(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(text, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(pass, salt), enc.encode(text)));
    const all = new Uint8Array(28 + ct.length); all.set(salt, 0); all.set(iv, 16); all.set(ct, 28);
    return b64(all);
  }
  async function decrypt(str, pass) {
    const all = unb64(str);
    const key = await keyFrom(pass, all.subarray(0, 16));
    try { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(16, 28) }, key, all.subarray(28))); }
    catch (err) { throw new Error('Wrong passphrase — the cloud copy could not be unlocked.'); }
  }

  /* ======================= GitHub gist ======================= */
  const API = 'https://api.github.com';
  const gist = {
    pass: null, error: null, busy: false,
    cfg() { return U.lsGet(GIST_KEY, {}) || {}; },
    save(c) { U.lsSet(GIST_KEY, c); },
    connected() { const c = this.cfg(); return !!(c.token && c.id); },
    base() { return ED.lock.idbGet('gist-base').catch(() => null); },
    setBase(d) { return ED.lock.idbPut('gist-base', d).catch(() => {}); },

    async req(method, path, body) {
      const c = this.cfg();
      let r;
      try {
        r = await fetch(API + path, {
          method,
          headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) { throw new Error('GitHub could not be reached. Check your internet connection.'); }
      if (r.status === 401) throw new Error('GitHub did not accept the token. Create a new one with the Gists read/write permission.');
      if (r.status === 404) throw new Error('Gist not found. Check the Gist ID, or leave it empty to create a new one.');
      if (r.status === 403) throw new Error('GitHub refused the request (rate limit or token permission).');
      if (!r.ok) throw new Error('GitHub error ' + r.status);
      return r.json();
    },

    async connect(o) {
      const prev = this.cfg();
      const c = { token: o.token, id: o.id || '', encrypt: !!o.pass, remember: !!o.remember, lastSync: 0 };
      if (o.pass && o.remember) c.pass = o.pass;
      this.save(c);
      this.pass = o.pass || null;
      await ED.idb.del('gist-base').catch(() => {});
      try {
        if (c.id) await this.syncNow(true);
        else {
          const res = await this.req('POST', '/gists', { description: 'E-Diary sync (private — created by the E-Diary app)', public: false, files: { [FILE_NAME]: { content: await this.payload() } } });
          const cc = this.cfg(); cc.id = res.id; cc.lastSync = Date.now(); this.save(cc);
          await this.setBase(ED.store.data);
          ED.ui.toast('Created a secret gist. Copy its ID from Backup & Sync to connect your other devices.', { timeout: 9000 });
        }
      } catch (err) {
        if (!c.id || err.message === 'Sync cancelled') { if (prev.token) this.save(prev); else U.lsDel(GIST_KEY); }
        throw err;
      }
      ED.app.requestRender();
    },
    disconnect() { U.lsDel(GIST_KEY); ED.idb.del('gist-base').catch(() => {}); this.pass = null; this.error = null; ED.app.requestRender(); },

    async payload() {
      const c = this.cfg();
      const data = JSON.stringify(ED.store.data);
      const pass = this.pass || c.pass;
      if (c.encrypt) {
        if (!pass) throw new Error('Enter your passphrase to sync.');
        return JSON.stringify({ app: 'E-Diary', format: 1, updatedAt: stamp(ED.store.data), enc: 'aes-gcm-pbkdf2', data: await encrypt(data, pass) });
      }
      if (ED.lock.on) return JSON.stringify({ app: 'E-Diary', format: 1, updatedAt: stamp(ED.store.data), enc: 'diary-lock', data: await ED.lock.seal(ED.store.data) });
      return JSON.stringify({ app: 'E-Diary', format: 1, updatedAt: stamp(ED.store.data), enc: null, data: JSON.parse(data) });
    },
    async fetchRemote() {
      const c = this.cfg();
      const g = await this.req('GET', '/gists/' + encodeURIComponent(c.id));
      const f = g.files && g.files[FILE_NAME];
      if (!f) return null;
      let text = f.content;
      if (f.truncated && f.raw_url) { const r = await fetch(f.raw_url); if (!r.ok) throw new Error('Could not download the cloud copy'); text = await r.text(); }
      const obj = JSON.parse(text);
      if (obj.enc === 'diary-lock') obj.data = await ED.lock.unseal(obj.data, { why: 'Your cloud copy is locked with a diary password. Enter it to sync.' });
      else if (obj.enc) {
        const pass = this.pass || c.pass;
        if (!pass) throw new Error('Enter your passphrase to sync.');
        obj.data = JSON.parse(await decrypt(obj.data, pass));
      }
      return ED.store.parseImport(obj.data && obj.data.tasks ? obj.data : obj);
    },
    async push() {
      const c = this.cfg();
      await this.req('PATCH', '/gists/' + encodeURIComponent(c.id), { files: { [FILE_NAME]: { content: await this.payload() } } });
      await this.setBase(ED.store.data);
    },
    /* pull, merge and push as needed. mode: true = user asked (errors are thrown), 'auto' = background */
    async syncNow(mode) {
      if (!this.connected() || this.busy) return;
      if (mode === 'auto' && (U.isTyping() || ED.ui.anyOpen())) { this.later(); return; }
      this.busy = true;
      try {
        const remote = await this.fetchRemote();
        const r = await reconcile(remote, await this.base(), 'the cloud');
        if (r === 'pulled' || r === 'none') await this.setBase(ED.store.data);
        else await this.push();
        if (r === 'merged') ED.ui.toast('Merged changes from your other device');
        else if (r === 'pulled') ED.ui.toast('Updated from your cloud copy');
        const cc = this.cfg(); cc.lastSync = Date.now(); this.save(cc);
        this.error = null;
      } catch (err) {
        this.error = err.message;
        if (mode === true) throw err;
      } finally {
        this.busy = false;
        ED.app.requestRender();
      }
    },
    later: U.debounce(() => gist.syncNow('auto'), 6000),
  };
  gist.schedulePush = U.debounce(() => { if (gist.connected()) gist.syncNow('auto'); }, 8000);

  /* ======================= public ======================= */
  ED.sync = {
    file, gist,
    async init() {
      const c = gist.cfg();
      if (c.pass) gist.pass = c.pass;
      await file.init();
      ED.store.on((type, detail) => {
        if (type !== 'saved') return;
        if (file.handle && file.perm === 'granted' && ED.store.data.settings.fileAuto !== false) file.schedule();
        if (gist.connected()) gist.schedulePush();
      });
      // closing or leaving the diary: write the file at once (the regular write waits a moment after each change)
      const leave = () => { if (file.handle && file.perm === 'granted' && ED.store.data && ED.store.data.settings.fileAuto !== false && file.lastWrite < (ED.store.data.meta.updatedAt || 0)) file.write(); };
      // closing with changes not yet in the file: the browser asks "Leave site?" (it does not allow its own wording); staying saves at once
      window.addEventListener('beforeunload', ev => {
        if (ED.gdrive && ED.gdrive.unsaved() && ED.store.data.settings.fileAsk !== false) { setTimeout(() => ED.gdrive.sync('manual'), 0); ev.preventDefault(); ev.returnValue = ''; return; }
        if (!file.handle || ED.store.data.settings.fileAsk === false || !file.unsaved()) return;
        if (file.perm === 'granted') setTimeout(() => file.write(), 0);
        ev.preventDefault(); ev.returnValue = '';
      });
      // Ctrl+S (Cmd+S): save to the linked file now
      document.addEventListener('keydown', ev => {
        if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey && (ev.key === 's' || ev.key === 'S')) {
          ev.preventDefault();
          if (!file.handle) { ED.ui.toast('No diary file linked yet — Settings → Backup & Sync → Save diary to a file…'); return; }
          if (file.perm !== 'granted') { file.reconnect(); return; }
          file.write(true).then(() => ED.ui.toast(file.error ? 'Could not save: ' + file.error : 'Saved to ' + file.name, file.error ? { kind: 'err' } : undefined));
        }
      });
      window.addEventListener('pagehide', () => { if (file.held && !file.ro) file.release(); else leave(); });
      // read-only (another PC has the file): undo any change made here
      let reverting = false;
      ED.store.on((type, detail) => {
        if (type !== 'change' || !file.ro || reverting || (detail && (detail.reason || detail.keepStamp))) return;
        const snap = file.roSnap; if (!snap) return;
        reverting = true;
        try { ED.store.replaceAll(U.clone(snap), 'readonly', { keepStamp: true }); } finally { reverting = false; }
        ED.ui.toast('Read-only: the diary is open on another PC, so this change was not kept.');
      });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
      if (gist.connected()) {
        gist.syncNow('auto');
        setInterval(() => { if (document.visibilityState === 'visible') gist.syncNow('auto'); }, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') gist.later(); });
      }
    },
    status() {
      const st = ED.store;
      if (st.loadError) return { cls: 'err', label: 'Saved diary could not be read', icon: 'cloudOff' };
      if (!st.adapter || st.adapter.name === 'memory') return { cls: 'err', label: 'Not saved — storage is blocked', icon: 'cloudOff' };
      if (st.saveError) return { cls: 'err', label: 'Not saved: ' + (st.saveError.message || st.saveError), icon: 'cloudOff' };
      if (gist.error) return { cls: 'warn', label: 'Saved here · cloud sync problem: ' + gist.error, icon: 'cloud' };
      const gd = ED.gdrive && ED.gdrive.status();   // Google Drive sync (js/gdrive.js)
      if (gd && gd.cls) return { cls: gd.cls, label: 'Saved here · ' + gd.label, icon: 'cloud' };
      if (file.handle && file.perm !== 'granted') return { cls: 'warn', label: 'Saved here · diary file needs reconnecting', icon: 'cloud' };
      const parts = [st.adapter.name === 'claude' ? 'Saved to your account' : 'Saved in this browser'];
      if (gd) parts.push('· ' + gd.label);
      if (file.handle) parts.push('and to ' + file.name);
      if (gist.connected()) parts.push('· cloud sync on');
      if (st.lastSavedAt) parts.push('(' + U.fmtTime(U.pad(new Date(st.lastSavedAt).getHours()) + ':' + U.pad(new Date(st.lastSavedAt).getMinutes()), ED.store.data.settings.h12) + ')');
      return { cls: '', label: parts.join(' '), icon: gist.connected() || file.handle || gd ? 'cloudCheck' : 'cloud' };
    },
    notice() {
      if (file.handle && file.perm !== 'granted' && file.perm !== 'none') {
        return '<div class="notice info">' + ED.icon('file') + '<span class="grow">' + (file.perm === 'lost' ? 'The link to <b>' + e(file.name) + '</b> stopped working (Google Drive brought in a newer copy). Choose the file again to load the latest diary.' : 'Load your diary file <b>' + e(file.name) + '</b> (e.g. from Google Drive) and keep saving to it — the browser needs your OK once per visit.') + '</span><button type="button" class="btn small primary" data-act="file-reconnect">' + (file.perm === 'lost' ? 'Choose it again' : 'Open it') + '</button><button type="button" class="btn small ghost" data-act="file-unlink">Unlink</button></div>';
      }
      if (gist.connected() && gist.cfg().encrypt && !gist.pass) {
        return '<div class="notice">' + ED.icon('lock') + '<span class="grow">Cloud sync is waiting for your passphrase.</span><button type="button" class="btn small" data-act="open-settings" data-tab="data">Unlock</button></div>';
      }
      return '';
    },
  };

  const A = (ED.actions = ED.actions || {});
  A['file-reconnect'] = () => file.reconnect();
  A['file-unlink'] = () => file.unlink();
})();
