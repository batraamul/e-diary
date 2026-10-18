/* E-Diary — persistence
   Order of preference:
     1. Claude artifact db (only when this page runs inside the Claude viewer)
     2. IndexedDB (this browser)
     3. localStorage (this browser)
     4. memory (nothing saved; a banner says so)
   Plus: daily automatic snapshots (last 7), one-step undo, cross-tab refresh. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util;

  const SCHEMA = 1;
  const LS_KEY = 'e-diary-db-v1';
  const IDB_NAME = 'e-diary';
  const IDB_STORE = 'kv';
  const CHUNK = 60000; // characters per remote document (UTF-8 worst case stays well under 256 KiB)

  /* ---------------- tiny IndexedDB wrapper ---------------- */
  const idb = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((resolve, reject) => {
        if (!('indexedDB' in window) || !window.indexedDB) return reject(new Error('IndexedDB missing'));
        let req;
        const timer = setTimeout(() => reject(new Error('IndexedDB timeout')), 4000);
        try { req = indexedDB.open(IDB_NAME, 1); } catch (e) { clearTimeout(timer); return reject(e); }
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE); };
        req.onsuccess = () => { clearTimeout(timer); this.db = req.result; resolve(this.db); };
        req.onerror = () => { clearTimeout(timer); reject(req.error || new Error('IndexedDB error')); };
        req.onblocked = () => { clearTimeout(timer); reject(new Error('IndexedDB blocked')); };
      });
    },
    tx(mode, fn) {
      return this.open().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, mode);
        const st = tx.objectStore(IDB_STORE);
        let out;
        const r = fn(st);
        if (r) r.onsuccess = () => { out = r.result; };
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('aborted'));
      }));
    },
    get(k) { return this.tx('readonly', st => st.get(k)); },
    set(k, v) { return this.tx('readwrite', st => st.put(v, k)); },
    del(k) { return this.tx('readwrite', st => st.delete(k)); },
    keys() { return this.tx('readonly', st => st.getAllKeys()); },
  };
  ED.idb = idb;

  /* ---------------- adapters ---------------- */
  const adapters = {
    claude: {
      name: 'claude',
      label: 'Saved privately to your Claude account',
      short: 'Claude account',
      col: null, lastStr: {}, lastChunks: {}, savedAt: 0,
      async open() {
        if (!ED.env.claude) return false;
        let db = null, user = null;
        try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { return false; }
        if (!db || !user) return false;
        const uid = await user.id();
        if (!uid) return false;
        this.col = db.collection('data/users/' + uid);
        return true;
      },
      async load() {
        const idx = await this.col.doc('index').get();
        if (!idx.exists) return null;
        const meta = idx.data() || {};
        const parts = meta.parts || {};
        const out = {};
        await Promise.all(Object.keys(parts).map(async k => {
          const n = parts[k] | 0;
          const snaps = await Promise.all(Array.from({ length: n }, (_, i) => this.col.doc(k + '.' + i).get()));
          const strs = snaps.map(s => (s.exists && s.data() && s.data().s) || '');
          const str = strs.join('');
          this.lastStr[k] = str; this.lastChunks[k] = strs;
          out[k] = str ? JSON.parse(str) : null;
        }));
        this.savedAt = meta.savedAt || 0;
        return out;
      },
      async save(data) {
        const parts = {};
        let changed = false;
        for (const k of Object.keys(data)) {
          const str = JSON.stringify(data[k] === undefined ? null : data[k]);
          const chunks = [];
          for (let i = 0; i < str.length; i += CHUNK) chunks.push(str.slice(i, i + CHUNK));
          if (!chunks.length) chunks.push('');
          parts[k] = chunks.length;
          if (str === this.lastStr[k]) continue;
          changed = true;
          const old = this.lastChunks[k] || [];
          for (let i = 0; i < chunks.length; i++) {
            if (old[i] !== chunks[i]) await this.col.doc(k + '.' + i).set({ s: chunks[i] });
          }
          for (let i = chunks.length; i < old.length; i++) await this.col.doc(k + '.' + i).delete();
          this.lastStr[k] = str; this.lastChunks[k] = chunks;
        }
        // sections no longer saved (e.g. the plain copy after the diary was locked) are removed
        for (const k of Object.keys(this.lastChunks)) {
          if (k in data) continue;
          for (let i = 0; i < this.lastChunks[k].length; i++) await this.col.doc(k + '.' + i).delete();
          delete this.lastChunks[k]; delete this.lastStr[k]; changed = true;
        }
        if (changed || !this.indexWritten) {
          this.savedAt = Date.now();
          await this.col.doc('index').set({ parts, savedAt: this.savedAt, session: ED.session, schema: SCHEMA });
          this.indexWritten = true;
        }
      },
      watch(cb) {
        try {
          this.unsub = this.col.doc('index').onSnapshot(s => {
            if (!s.exists) return;
            const d = s.data() || {};
            if (d.session && d.session !== ED.session && (d.savedAt || 0) > (this.savedAt || 0)) cb(d);
          }, () => {});
        } catch (e) { /* live updates are optional */ }
      },
    },
    idb: {
      name: 'idb',
      label: 'Saved in this browser (IndexedDB)',
      short: 'This browser',
      async open() { await idb.open(); await idb.get('__probe'); return true; },
      async load() { const v = await idb.get('db'); return v || null; },
      async save(data) { await idb.set('db', data); },
    },
    local: {
      name: 'local',
      label: 'Saved in this browser (localStorage)',
      short: 'This browser',
      async open() { const t = '__ed_probe'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return true; },
      async load() { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; },
      async save(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)); },
    },
    memory: {
      name: 'memory',
      label: 'Not saved — this browser blocks storage. Export a backup before closing.',
      short: 'Not saved',
      async open() { return true; },
      async load() { return null; },
      async save() { /* nothing */ },
    },
  };

  /* every id of an item kept in a list anywhere in the diary (for deletion markers) */
  const allIds = (o, out) => {
    out = out || new Set();
    if (Array.isArray(o)) o.forEach(x => { if (x && typeof x === 'object') { if (typeof x.id === 'string') out.add(x.id); allIds(x, out); } });
    else if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (k !== 'meta' && o[k] && typeof o[k] === 'object') allIds(o[k], out); });
    return out;
  };
  ED.allIds = allIds;

  /* ---------------- the store ---------------- */
  const store = (ED.store = {
    data: null,
    adapter: null,
    version: 0,
    dirty: false,
    saving: false,
    pending: false,
    lastSavedAt: 0,
    saveError: null,
    loadError: null,
    firstRun: false,
    undoStack: [],
    listeners: new Set(),

    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit(type, detail) { this.listeners.forEach(fn => { try { fn(type, detail); } catch (e) { console.error(e); } }); },

    async init() {
      const order = ED.env.claude ? ['claude', 'idb', 'local', 'memory'] : ['idb', 'local', 'memory'];
      for (const name of order) {
        try {
          if (await adapters[name].open()) { this.adapter = adapters[name]; break; }
        } catch (e) { console.warn('[e-diary] storage "' + name + '" unavailable:', e && e.message); }
      }
      let raw = null;
      try {
        try { raw = await this.adapter.load(); }
        catch (first) {
          if (this.adapter.name !== 'claude') throw first;
          await new Promise(r => setTimeout(r, 1200)); // a save may have been half-way through; read again
          raw = await this.adapter.load();
        }
      }
      catch (e) {
        console.error('[e-diary] could not read saved diary', e);
        this.loadError = e;
        // never overwrite data we failed to read
        this.adapter = adapters.memory;
      }
      // one-time move from localStorage (older copy) into IndexedDB
      if (!raw && !this.loadError && this.adapter.name === 'idb') {
        try { const s = localStorage.getItem(LS_KEY); if (s) { raw = JSON.parse(s); this.migratedFromLocal = true; } } catch (e) { /* ignore */ }
      }
      // a locked diary: ask for the password before anything is shown
      if (raw && ED.lock && ED.lock.isEnvelope(raw)) {
        const opened = await ED.lock.startUnlock(raw);
        raw = opened || null;                           // null: "forgot the password" → start a new diary
      }
      this.firstRun = !raw;
      this.data = this.migrate(raw || ED.sample.starter());
      if (this.adapter.name === 'idb') { try { this.rev = (await idb.get('rev')) || 0; } catch (e) { this.rev = 0; } this.baseJson = JSON.stringify(this.data); }
      this.loadedStamp = (this.data.meta && this.data.meta.updatedAt) || 0;
      this.prevIds = allIds(this.data);   // how the diary stood when this browser last closed it (see sync.js: one PC at a time)
      if (this.firstRun && !this.loadError) {
        ED.sample.addDemo(this.data);
        this.version++;
        this.save();
      } else if (this.migratedFromLocal) {
        this.save();
      }
      if (this.adapter.watch) this.adapter.watch(() => this.reloadFromAdapter('remote'));
      this.setupChannel();
      if (navigator.storage && navigator.storage.persist && this.adapter.name !== 'claude' && this.adapter.name !== 'memory') {
        navigator.storage.persist().catch(() => {});
      }
      window.addEventListener('pagehide', () => this.flushNow());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flushNow(); });
      return this.data;
    },

    /* fill in any missing fields so older diaries keep working */
    migrate(d) {
      const base = ED.sample.empty();
      d = d && typeof d === 'object' ? d : {};
      const out = Object.assign({}, base, d);
      out.meta = Object.assign({}, base.meta, d.meta || {});
      out.settings = Object.assign({}, base.settings, d.settings || {});
      out.settings.weather = Object.assign({}, base.settings.weather, (d.settings && d.settings.weather) || {});
      out.settings.cal = Object.assign({}, base.settings.cal, (d.settings && d.settings.cal) || {});
      out.settings.gcal = Object.assign({}, base.settings.gcal, (d.settings && d.settings.gcal) || {});
      // study planner, finance, websites, password log, Google Calendar links (added in version 1.1)
      if (!out.study || typeof out.study !== 'object') out.study = { plan: null, sessions: [] };
      if (!Array.isArray(out.study.sessions)) out.study.sessions = [];
      if (out.study.plan === undefined) out.study.plan = null;
      if (!Array.isArray(out.study.shelf)) out.study.shelf = [];
      if (out.study.plan && ED.study && ED.study.normalize) { try { ED.study.normalize(out.study); } catch (err) { console.warn('[e-diary] study plan', err); } }
      if (!out.finance || typeof out.finance !== 'object') out.finance = ED.sample.finance();
      ['cats', 'accounts', 'goals', 'holdings', 'bills', 'records'].forEach(k => { if (!Array.isArray(out.finance[k])) out.finance[k] = []; });
      // 1.2: "Savings & investments" counts as saving, not spending; the goal-based financial plan
      out.finance.cats.forEach(c => { if (c.id === 'fc-invest' && c.saving === undefined) c.saving = true; });
      out.finance.plan = Object.assign(ED.sample.finPlan(), out.finance.plan && typeof out.finance.plan === 'object' ? out.finance.plan : {});
      if (!Array.isArray(out.finance.plan.goals)) out.finance.plan.goals = [];
      if (!Array.isArray(out.finance.plan.events)) out.finance.plan.events = [];
      // 1.3: the wealth plan (portfolio approaches, risk, simulation)
      out.finance.plan.wealth = Object.assign(ED.sample.wealth(), out.finance.plan.wealth && typeof out.finance.plan.wealth === 'object' ? out.finance.plan.wealth : {});
      if (!Array.isArray(out.sites)) out.sites = [];
      if (!out.bucket || !Array.isArray(out.bucket.list)) out.bucket = { list: (out.bucket && Array.isArray(out.bucket.list)) ? out.bucket.list : [] };
      // 1.3: habit tracker
      if (!out.habits || typeof out.habits !== 'object') out.habits = { list: [], log: {} };
      if (!Array.isArray(out.habits.list)) out.habits.list = [];
      if (!out.habits.log || typeof out.habits.log !== 'object' || Array.isArray(out.habits.log)) out.habits.log = {};
      // 1.4: interview preparation, health, events & meetings
      const obj = v => v && typeof v === 'object' && !Array.isArray(v);
      [['interview', ['list', 'qs', 'cats', 'docs', 'mocks'], ['log']], ['health', ['meds', 'treats', 'visits', 'vitals', 'reports'], ['taken', 'card']], ['meetings', ['cals'], ['calInfo', 'notes']], ['exam', ['list', 'topics', 'mocks'], ['log']], ['jobs', ['items', 'sites'], []]].forEach(([k, arrs, objs]) => {
        out[k] = Object.assign(ED.sample[k](), obj(out[k]) ? out[k] : {});
        arrs.forEach(a => { if (!Array.isArray(out[k][a])) out[k][a] = ED.sample[k]()[a]; });
        objs.forEach(o => { if (!obj(out[k][o])) out[k][o] = ED.sample[k]()[o]; });
      });
      out.health.card = Object.assign(ED.sample.health().card, out.health.card);
      if (!out.meetings.cals.length) out.meetings.cals = ['primary'];
      if (!obj(out.maps) || !Array.isArray(out.maps.list)) out.maps = { list: [] };
      if (out.vault && (typeof out.vault !== 'object' || !Array.isArray(out.vault.items))) out.vault = null;
      if (!out.gcal || typeof out.gcal !== 'object' || !out.gcal.map) out.gcal = { map: {} };
      ['tasks', 'events', 'categories', 'roles', 'goals', 'values', 'notebooks', 'notes', 'quotes'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
      if (!out.dayNotes || typeof out.dayNotes !== 'object') out.dayNotes = {};
      if (!out.mission || typeof out.mission !== 'object') out.mission = { html: '' };
      out.tasks.forEach(t => {
        if (!t.id) t.id = U.uid('t');
        if (!t.prio) t.prio = 'B';
        if (t.title == null) t.title = '';
        if (!t.status) t.status = 'open';
        if (t.allDay && t.time) t.allDay = false;
      });
      out.meta.schema = SCHEMA;
      return out;
    },

    /* call after every change */
    commit(opts) {
      opts = opts || {};
      this.version++;
      if (!opts.keepStamp) this.data.meta.updatedAt = Date.now();
      if (this.prevIds) this.markGone();   // a deletion is marked at once, before any sync can merge
      this.dirty = true;
      this.scheduleSave();
      if (!opts.silent) this.emit('change', opts);
    },

    scheduleSave: null, // set below (debounced)

    async save() {
      if (!this.adapter) return;
      if (this.saving) { this.pending = true; return; }
      this.saving = true;
      try {
        const write = async () => {
          if (this.adapter.name === 'idb') await this.mergeOtherWindow();
          this.markGone();
          await this.adapter.save(ED.lock && ED.lock.on ? await ED.lock.seal(this.data) : this.data);
          if (this.adapter.name === 'idb') { this.rev = (this.rev || 0) + 1; try { await idb.set('rev', this.rev); } catch (e) { /* the next save tries again */ } this.baseJson = JSON.stringify(this.data); }
        };
        // one window saves at a time (Web Locks); a window that finds a newer save from another window merges it in first
        if (this.adapter.name === 'idb' && navigator.locks && navigator.locks.request) await navigator.locks.request('e-diary-save', write); else await write();
        this.dirty = false;
        this.saveError = null;
        this.lastSavedAt = Date.now();
        this.emit('saved');
        this.announce();
        this.snapshotDaily();
      } catch (e) {
        console.error('[e-diary] save failed', e);
        const first = !this.saveError;
        this.saveError = e;
        this.emit('save-error', e);
        if (first && ED.ui) {
          const quota = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
          ED.ui.toast(quota ? 'Storage is full. Export a backup and remove large images.' : 'Could not save: ' + (e.message || e), { kind: 'err', timeout: 8000 });
        }
      } finally {
        this.saving = false;
        if (this.pending) { this.pending = false; this.save(); }
      }
    },
    flushNow() { if (this.dirty) { this.scheduleSave.cancel(); this.save(); } },

    /* Deletion markers: an item that was here at the last save and is gone now gets meta.gone[id] = when. Merging
       (js/sync.js ED.merge3) drops an item that has a marker newer than its last change, so a deletion is never undone
       by a device that heard of the item from somewhere else. Markers older than 120 days are dropped. */
    markGone() {
      const now = allIds(this.data), prev = this.prevIds || now, t = Date.now();
      const meta = this.data.meta;
      let gone = meta.gone && typeof meta.gone === 'object' ? meta.gone : null;
      prev.forEach(id => { if (!now.has(id)) { gone = gone || {}; gone[id] = t; } });
      // items that (re)appeared here — new, or brought back by Undo or a restored snapshot — are newer than any deletion
      // marker another device may still have, so they are not swept away when the devices merge
      const back = new Set(); now.forEach(id => { if (!prev.has(id)) back.add(id); });
      if (back.size && this.prevIds) {
        const touch = o => { if (Array.isArray(o)) o.forEach(x => { if (x && typeof x === 'object') { if (back.has(x.id) && !(+x.updatedAt >= t)) x.updatedAt = t; touch(x); } }); else if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (k !== 'meta') touch(o[k]); }); };
        touch(this.data);
        if (gone) back.forEach(id => delete gone[id]);
      }
      if (gone) { const old = t - 120 * 864e5; Object.keys(gone).forEach(id => { if (gone[id] < old) delete gone[id]; }); meta.gone = gone; }
      this.prevIds = now;
    },

    /* Two windows of the diary in this browser (the shortcut clicked twice, or an app window and a tab): before saving,
       look whether the other window saved since this one last did; if so, merge its changes in item by item (the same
       three-way merge as the sync, js/sync.js) instead of writing over them. */
    async mergeOtherWindow() {
      let rev = 0;
      try { rev = (await idb.get('rev')) || 0; } catch (e) { return; }
      if (this.rev == null || rev === this.rev || !this.baseJson || !ED.merge3) { this.rev = rev; return; }
      this.markGone();
      let other = null;
      try { other = await this.adapter.load(); } catch (e) { other = null; }
      if (other && ED.lock && ED.lock.isEnvelope(other)) { try { other = await ED.lock.unseal(other, { noAsk: true }); } catch (e) { other = null; } }
      if (other && typeof other === 'object' && other.tasks) {
        const merged = ED.merge3(JSON.parse(this.baseJson), this.data, other);
        merged.meta = Object.assign({}, merged.meta, { updatedAt: Date.now() });
        this.data = this.migrate(merged);
        this.prevIds = new Set([...(this.prevIds || []), ...allIds(this.data)]);
        this.version++;
        this.emit('change', { reason: 'other-tab' });
      }
      this.rev = rev;
    },

    /* ---------- undo (one level per destructive action, up to 5) ---------- */
    checkpoint(label) {
      try {
        this.undoStack.push({ label, json: JSON.stringify(this.data) });
        if (this.undoStack.length > 5) this.undoStack.shift();
      } catch (e) { /* ignore */ }
    },
    undo() {
      const cp = this.undoStack.pop();
      if (!cp) return false;
      const live = this.data && this.data.gcal;
      this.data = this.migrate(JSON.parse(cp.json));
      if (live) this.data.gcal = live;     // the copies already in Google Calendar are what they are; undo must not forget them
      this.commit({ reason: 'undo' });
      return cp.label;
    },

    /* ---------- replace everything (import / restore) ---------- */
    replaceAll(raw, reason, opts) {
      opts = opts || {};
      if (reason !== 'remote') this.checkpoint('Replace diary');   // changes merged in from another device are not an "undo" step (Undo stays on your own last change)
      const live = this.data && this.data.gcal;
      this.data = this.migrate(U.clone(raw));
      this.prevIds = new Set([...(this.prevIds || []), ...allIds(this.data)]);   // items that came in count as known (a later deletion is marked)
      if (live && reason !== 'remote' && live.map && Object.keys(live.map).length) this.data.gcal = live;
      if (!opts.keepStamp) this.data.meta.updatedAt = Date.now();
      this.commit({ reason: reason || 'replace', keepStamp: !!opts.keepStamp });
      this.flushNow();
    },

    async reloadFromAdapter(why) {
      if (this.dirty) {
        ED.ui && ED.ui.toast('This diary was also changed in another window. Both sets of changes are kept: they are merged when this window saves.', { timeout: 6000 });
        return;
      }
      try {
        let raw = await this.adapter.load();
        if (raw && ED.lock && ED.lock.isEnvelope(raw)) {
          try { raw = await ED.lock.unseal(raw, { noAsk: true }); }
          catch (err) { ED.ui && ED.ui.toast('The diary was locked or its password changed in another window. Reload this page to unlock it.', { timeout: 0 }); return; }
        } else if (raw && ED.lock && ED.lock.on) Object.assign(ED.lock, { on: false, key: null, salt: null, cache: {} });   // unlocked in another window
        if (raw) {
          this.data = this.migrate(raw); this.version++;
          if (this.adapter.name === 'idb') { try { this.rev = (await idb.get('rev')) || 0; } catch (e) { /* keep */ } this.baseJson = JSON.stringify(this.data); }
          this.emit('change', { reason: why || 'reload' });
        }
      } catch (e) { console.warn(e); }
    },

    /* ---------- other tabs of the same browser ---------- */
    setupChannel() {
      if (!('BroadcastChannel' in window) || this.adapter.name === 'claude' || this.adapter.name === 'memory') return;
      try {
        this.bc = new BroadcastChannel('e-diary');
        this.bc.onmessage = ev => {
          const m = ev.data || {};
          if (m.type === 'saved' && m.session !== ED.session) this.reloadFromAdapter('other-tab');
        };
      } catch (e) { this.bc = null; }
    },
    announce() { if (this.bc) { try { this.bc.postMessage({ type: 'saved', session: ED.session, at: Date.now() }); } catch (e) { /* ignore */ } } },

    /* ---------- automatic daily snapshots (IndexedDB only) ---------- */
    async snapshotDaily() {
      if (this.snapDone === U.today()) return;
      try {
        await idb.open();
        const key = 'snap:' + U.today();
        this.snapDone = U.today();
        await idb.set(key, ED.lock && ED.lock.on ? await ED.lock.seal(U.clone(this.data)) : this.data);
        const keys = (await idb.keys()).filter(k => String(k).startsWith('snap:')).sort();
        while (keys.length > 7) await idb.del(keys.shift());
      } catch (e) { this.snapDone = U.today(); }
    },
    async listSnapshots() {
      try { await idb.open(); return (await idb.keys()).filter(k => String(k).startsWith('snap:')).sort().reverse(); }
      catch (e) { return []; }
    },
    async restoreSnapshot(key) {
      let d = await idb.get(key);
      if (!d) throw new Error('Snapshot not found');
      if (ED.lock && ED.lock.isEnvelope(d)) d = await ED.lock.unseal(d, { why: 'This snapshot was saved with an earlier password. Enter that password.' });
      this.replaceAll(d, 'restore');
    },

    /* ---------- export ---------- */
    exportObject() {
      return { app: 'E-Diary', format: 1, exportedAt: new Date().toISOString(), data: this.data };
    },
    /* what goes into a backup or the diary file: sealed when the diary is locked */
    async exportPayload() {
      const o = this.exportObject();
      if (ED.lock && ED.lock.on) { o.locked = true; o.data = await ED.lock.seal(this.data); }
      return o;
    },
    /* a backup or diary file → the diary (asks for the password of a locked copy when needed) */
    async openImport(obj, why) {
      if (obj && obj.app === 'E-Diary' && ED.lock && ED.lock.isEnvelope(obj.data)) obj = Object.assign({}, obj, { data: await ED.lock.unseal(obj.data, { why }) });
      else if (ED.lock && ED.lock.isEnvelope(obj)) obj = await ED.lock.unseal(obj, { why });
      return this.parseImport(obj);
    },
    parseImport(obj) {
      if (obj && obj.app === 'E-Diary' && obj.data) return obj.data;
      if (obj && obj.tasks && obj.settings) return obj; // raw diary
      throw new Error('This file is not an E-Diary backup.');
    },
    sizeBytes() { try { return new Blob([JSON.stringify(this.data)]).size; } catch (e) { return 0; } },
  });

  store.scheduleSave = U.debounce(() => store.save(), ED.env.claude ? 1400 : 450);
  ED.storageAdapters = adapters;
})();
