/* E-Diary — lock the whole diary with a password.
   When the lock is on, everything the diary keeps — in this browser, in the daily snapshots, in the linked diary file
   (for example in your Google Drive folder), in backups, in Claude's storage and in GitHub sync — is encrypted:
     • key: PBKDF2-SHA256 with 600,000 rounds and a random 16-byte salt turns your password into a 256-bit AES key
       (kept in memory only, never stored, and marked non-extractable)
     • data: AES-256-GCM, each section of the diary (tasks, notes, finance…) sealed on its own with a fresh 12-byte IV;
       a section that has not changed keeps its last ciphertext, so saves stay small. GCM also detects tampering.
   Nothing about the password is stored — not even a hash — so a wrong password simply fails to decrypt.
   Without the password the diary cannot be opened by anyone, including us: there is no reset.
   The envelope:  { __lock: { v: 1, kdf: 'PBKDF2-SHA256', iter, salt, hint, at }, <section>: { iv, ct }, … } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const ITER = 600000;
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => { const s = atob(str); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  const has = () => !!(window.crypto && crypto.subtle);

  const L = (ED.lock = { key: null, salt: null, iter: ITER, hint: '', on: false, cache: {} });

  L.supported = has;
  L.isEnvelope = x => !!(x && typeof x === 'object' && x.__lock && typeof x.__lock === 'object' && x.__lock.salt);

  async function derive(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function sealPart(str, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(str)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function openPart(p, key) { return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, key, unb64(p.ct))); }

  /* the diary → an envelope (when the lock is on); otherwise the diary unchanged */
  L.seal = async (data, opts) => {
    opts = opts || {};
    const key = opts.key || L.key, salt = opts.salt || L.salt;
    if (!key || !(L.on || opts.key)) return data;
    const out = { __lock: { v: 1, kdf: 'PBKDF2-SHA256', iter: opts.iter || L.iter, salt: b64(salt), hint: opts.hint != null ? opts.hint : L.hint || '', at: Date.now() } };
    const cache = opts.key ? {} : L.cache;
    for (const k of Object.keys(data)) {
      const str = JSON.stringify(data[k] === undefined ? null : data[k]);
      const c = cache[k];
      if (c && c.str === str) { out[k] = c.part; continue; }          // unchanged: the same ciphertext, so nothing new to upload
      const part = await sealPart(str, key);
      cache[k] = { str, part };
      out[k] = part;
    }
    return out;
  };
  async function openWith(env, key) {
    const out = {};
    for (const k of Object.keys(env)) {
      if (k === '__lock') continue;
      out[k] = JSON.parse(await openPart(env[k], key));
    }
    return out;
  }
  /* remember the ciphertext of sections just opened with the key in memory, so unchanged ones are not sealed again */
  const prime = (env, data) => { Object.keys(data).forEach(k => { if (env[k]) L.cache[k] = { str: JSON.stringify(data[k] === undefined ? null : data[k]), part: env[k] }; }); };
  const sameSalt = env => L.key && L.salt && env.__lock.salt === b64(L.salt) && (env.__lock.iter || ITER) === L.iter;

  /* an envelope → the diary. Uses the key in memory when it fits; otherwise asks for the password (unless opts.noAsk). */
  L.unseal = async (x, opts) => {
    opts = opts || {};
    if (!L.isEnvelope(x)) return x;
    if (sameSalt(x)) { try { const d = await openWith(x, L.key); prime(x, d); return d; } catch (err) { /* fall through */ } }
    if (opts.noAsk) throw new Error('This copy is locked with a different password.');
    for (;;) {
      const pass = await ED.ui.prompt({ title: 'Locked diary', label: opts.why || 'This copy of the diary is locked. Enter its password.', type: 'password', ok: 'Unlock', hint: x.__lock.hint ? 'Hint: ' + e(x.__lock.hint) : '' });
      if (pass == null) throw Object.assign(new Error('Cancelled'), { cancelled: true });
      const busy = ED.ui.busy('Unlocking…');
      try { const key = await derive(pass, unb64(x.__lock.salt), x.__lock.iter || ITER); const d = await openWith(x, key); busy.close(); return d; }
      catch (err) { busy.close(); ED.ui.toast('Wrong password', { kind: 'err' }); }
    }
  };

  /* store a copy in IndexedDB (sealed when the lock is on) and read it back */
  L.idbPut = async (k, data) => ED.idb.set(k, await L.seal(U.clone(data)));
  L.idbGet = async k => { const v = await ED.idb.get(k); return v && L.isEnvelope(v) ? L.unseal(v, { noAsk: true }).catch(() => null) : v; };

  /* ---------------- the unlock screen at start ---------------- */
  L.startUnlock = env => new Promise(resolve => {
    const info = U.lsGet('e-diary-cover', null) || {};
    const w = document.createElement('div');
    w.className = 'lockscreen';
    w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'lk-t');
    w.innerHTML = '<form class="lk-card" autocomplete="off">' +
      '<div class="lk-ic" aria-hidden="true">' + ED.icon('lock') + '</div>' +
      '<h2 id="lk-t">' + e(info.title || 'My E-Diary') + '</h2>' +
      '<p class="lk-sub">This diary is locked. Enter your password to open it.</p>' +
      '<label class="lk-row"><span class="sr-only">Password</span><input id="lk-pass" class="field" type="password" autocomplete="current-password" placeholder="Password" autofocus>' +
      '<button type="button" class="icon-btn" id="lk-eye" aria-label="Show the password" title="Show the password">' + ED.icon('eye') + '</button></label>' +
      '<p class="lk-msg" id="lk-msg" role="status"></p>' +
      '<button type="submit" class="btn primary lk-go">' + ED.icon('unlock') + 'Unlock</button>' +
      '<div class="lk-links">' + (env.__lock.hint ? '<button type="button" class="link-btn" id="lk-hint">Show my hint</button>' : '') + '<button type="button" class="link-btn" id="lk-forgot">Forgot the password?</button></div>' +
      '</form>';
    document.body.appendChild(w);
    document.documentElement.classList.add('locked');
    const gone = () => { document.documentElement.classList.remove('locked'); };
    const $ = s => w.querySelector(s);
    const inp = $('#lk-pass'), msg = $('#lk-msg');
    setTimeout(() => inp.focus(), 50);
    let fails = 0, busy = false;
    $('#lk-eye').addEventListener('click', () => { inp.type = inp.type === 'password' ? 'text' : 'password'; inp.focus(); });
    const hint = $('#lk-hint'); if (hint) hint.addEventListener('click', () => { msg.className = 'lk-msg'; msg.textContent = 'Hint: ' + env.__lock.hint; });
    $('#lk-forgot').addEventListener('click', async () => {
      const ok = await ED.ui.confirm({ title: 'Forgot the password?', danger: true, ok: 'Start a new, empty diary',
        message: 'The diary is encrypted with your password and there is no way to open it without it — not by you, not by us. If you have an unlocked backup (.json), start a new diary and import it from Settings → Backup & Sync. Starting a new diary deletes the locked one in this browser for good.' });
      if (!ok) return;
      const sure = await ED.ui.prompt({ title: 'Delete the locked diary', label: 'Type DELETE to confirm', ok: 'Delete and start again' });
      if (!sure || sure.trim().toUpperCase() !== 'DELETE') return;
      w.remove(); gone(); resolve(null);
    });
    w.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      if (busy) return;
      const pass = inp.value;
      if (!pass) { inp.focus(); return; }
      busy = true; msg.className = 'lk-msg'; msg.textContent = 'Unlocking…'; $('.lk-go').disabled = true;
      try {
        const salt = unb64(env.__lock.salt), iter = env.__lock.iter || ITER;
        const key = await derive(pass, salt, iter);
        const data = await openWith(env, key);
        Object.assign(L, { key, salt, iter, hint: env.__lock.hint || '', on: true, cache: {} });
        prime(env, data);
        w.classList.add('done'); setTimeout(() => { w.remove(); gone(); }, 250);
        resolve(data);
      } catch (err) {
        fails++;
        msg.className = 'lk-msg bad'; msg.textContent = 'That password does not open this diary.' + (fails >= 3 && env.__lock.hint ? ' Try your hint.' : '');
        inp.select();
        await new Promise(r => setTimeout(r, Math.min(4000, 400 * fails)));   // each wrong try waits a little longer
      } finally { busy = false; $('.lk-go').disabled = false; }
    });
  });

  /* ---------------- turning it on, changing it, turning it off ---------------- */
  /* everything stored besides the main copy: daily snapshots and the merge bases of the file and GitHub sync */
  async function resealStored(oldKeyOpen) {
    let keys = [];
    try { keys = (await ED.idb.keys()).filter(k => /^snap:|^file-base$|^gist-base$/.test(String(k))); } catch (err) { return; }
    for (const k of keys) {
      try {
        let v = await ED.idb.get(k);
        if (L.isEnvelope(v)) { if (!oldKeyOpen) continue; v = await oldKeyOpen(v); }
        await ED.idb.set(k, await L.seal(v));
      } catch (err) { /* a copy that cannot be opened is left as it is */ }
    }
  }
  async function writeEverywhere() {
    ED.store.dirty = true;
    await ED.store.save();
    try { localStorage.removeItem('e-diary-db-v1'); } catch (err) { /* an old plain copy from before IndexedDB */ }
    if (ED.sync && ED.sync.file && ED.sync.file.handle && ED.sync.file.perm === 'granted') await ED.sync.file.write(true);
    if (ED.sync && ED.sync.gist && ED.sync.gist.connected()) ED.sync.gist.syncNow('auto');
  }
  L.enable = async (pass, hint) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await derive(pass, salt, ITER);
    Object.assign(L, { key, salt, iter: ITER, hint: hint || '', on: true, cache: {} });
    try { localStorage.removeItem('e-diary-google-events-v1'); } catch (err) { /* the Events page's copy of Google events */ }
    await writeEverywhere();
    await resealStored(null);
  };
  L.check = async pass => {
    if (!L.on || !L.salt) return false;
    try {
      const key = await derive(pass, L.salt, L.iter);
      const probe = await L.seal({ x: 1 }, { key: L.key, salt: L.salt });   // sealed with the key in memory…
      await openPart(probe.x, key);                                 // …opens only with the same password
      return true;
    } catch (err) { return false; }
  };
  L.change = async (pass, hint) => {
    const old = { key: L.key };
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await derive(pass, salt, ITER);
    const oldOpen = v => openWith(v, old.key);
    Object.assign(L, { key, salt, iter: ITER, hint: hint != null ? hint : L.hint, cache: {} });
    await writeEverywhere();
    await resealStored(oldOpen);
  };
  L.disable = async () => {
    const old = { key: L.key };
    const oldOpen = v => openWith(v, old.key);
    Object.assign(L, { on: false, cache: {} });
    // put the stored copies back in the clear while the old key is still at hand
    let keys = [];
    try { keys = (await ED.idb.keys()).filter(k => /^snap:|^file-base$|^gist-base$/.test(String(k))); } catch (err) { keys = []; }
    for (const k of keys) { try { const v = await ED.idb.get(k); if (L.isEnvelope(v)) await ED.idb.set(k, await oldOpen(v)); } catch (err) { /* leave it */ } }
    Object.assign(L, { key: null, salt: null, hint: '' });
    await writeEverywhere();
  };

  /* lock now: save, forget the key, show the unlock screen (by reloading the page) */
  L.lockNow = async () => {
    if (!L.on) return;
    const busy = ED.ui.busy('Locking…');
    try {
      ED.store.flushNow();
      for (let i = 0; i < 50 && (ED.store.saving || ED.store.dirty); i++) await new Promise(r => setTimeout(r, 100));
      if (ED.sync && ED.sync.file && ED.sync.file.handle && ED.sync.file.perm === 'granted') await ED.sync.file.write(true).catch(() => {});
    } finally { busy.close(); }
    L.key = null; L.cache = {};
    location.reload();
  };

  /* lock by itself after some minutes without a click or a key */
  let last = Date.now(), timer = null;
  L.startIdle = () => {
    if (timer) return;
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => document.addEventListener(t, () => { last = Date.now(); }, { passive: true, capture: true }));
    timer = setInterval(() => {
      const mins = ED.store.data && ED.store.data.settings.lockAfter;
      if (!L.on || !mins) return;
      if (Date.now() - last > mins * 60000) L.lockNow();
    }, 20000);
  };

  /* a rough strength estimate for the meter (bits of guessing work) */
  L.strength = pass => {
    const p = String(pass || '');
    if (!p) return { bits: 0, label: '', cls: '' };
    let pool = 0;
    if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^a-zA-Z0-9]/.test(p)) pool += 33;
    let bits = p.length * Math.log2(Math.max(pool, 2));
    if (/(.)\1\1/.test(p)) bits -= 10;
    if (/^(password|admin|qwerty|123456|letmein|welcome|india|iloveyou)/i.test(p)) bits = Math.min(bits, 10);
    const words = p.trim().split(/[\s\-_.]+/).filter(w => w.length >= 3).length;
    if (words >= 4) bits = Math.max(bits, words * 11);
    bits = Math.max(0, Math.round(bits));
    const label = bits < 40 ? 'Weak — easy to guess' : bits < 60 ? 'Fair — make it longer' : bits < 80 ? 'Strong' : 'Very strong';
    const cls = bits < 40 ? 'bad' : bits < 60 ? 'mid' : 'good';
    return { bits, label, cls };
  };
})();
