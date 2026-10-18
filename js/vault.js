/* E-Diary — Password log and important websites.
   The password log is encrypted on this device with a master password (PBKDF2-SHA-256, 310,000 rounds → AES-256-GCM).
   Only encrypted entries are saved, backed up or synced; the master password itself is never stored anywhere,
   so it cannot be recovered if forgotten. The log locks itself after a few idle minutes.
   Important websites are not secret and are kept as ordinary diary data. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const D = () => ED.store.data;
  const S = () => ED.store.data.settings;
  const A = (ED.actions = ED.actions || {});
  const enc = new TextEncoder(), dec = new TextDecoder();
  const ITER = 310000;
  const CHECK = 'e-diary-vault-v1';

  const b64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rand = n => crypto.getRandomValues(new Uint8Array(n));

  const V = (ED.vault = { key: null, items: new Map(), lastUse: 0, sel: null, q: '', reveal: new Set() });
  V.supported = () => !!(window.crypto && crypto.subtle && typeof crypto.subtle.deriveKey === 'function');
  V.data = () => D().vault;
  V.isSet = () => !!(V.data() && V.data().salt);
  V.unlocked = () => !!V.key;

  async function derive(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, obj) {
    const iv = rand(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(typeof obj === 'string' ? obj : JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function open(key, box, raw) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    const s = dec.decode(pt);
    return raw ? s : JSON.parse(s);
  }

  /* ---------------- set up, unlock, lock ---------------- */
  V.setup = async (pass, hint) => {
    const salt = rand(16);
    const key = await derive(pass, salt, ITER);
    D().vault = { v: 1, salt: b64(salt), iter: ITER, check: await seal(key, CHECK), hint: hint || '', createdAt: Date.now(), items: [] };
    V.key = key; V.salt = D().vault.salt; V.items = new Map(); V.touch();
    ED.store.commit();
  };
  V.unlock = async pass => {
    const vd = V.data();
    const key = await derive(pass, unb64(vd.salt), vd.iter || ITER);
    try { if (await open(key, vd.check, true) !== CHECK) throw new Error('bad'); }
    catch (err) { return false; }
    V.key = key; V.salt = vd.salt;
    await V.decryptAll();
    V.touch();
    return true;
  };
  V.decryptAll = async () => {
    const m = new Map(); V.bad = 0;
    for (const it of V.data().items) {
      try { m.set(it.id, Object.assign(await open(V.key, it), { id: it.id })); }
      catch (err) { V.bad++; }
    }
    V.items = m;
  };
  V.lock = (quiet) => {
    if (!V.key) return;
    V.key = null; V.items = new Map(); V.reveal = new Set(); V.sel = null;
    if (ED.state.tab === 'vault') ED.app.render();
    if (!quiet) ED.ui.toast('Password log locked', { icon: 'lock' });
  };
  V.touch = () => { V.lastUse = Date.now(); };
  V.changeMaster = async (oldPass, newPass, hint) => {
    if (!(await V.unlock(oldPass))) return false;
    const salt = rand(16);
    const key = await derive(newPass, salt, ITER);
    const items = [];
    for (const [id, obj] of V.items) { const box = await seal(key, strip(obj)); items.push({ id, iv: box.iv, ct: box.ct, updatedAt: Date.now() }); }
    D().vault = { v: 1, salt: b64(salt), iter: ITER, check: await seal(key, CHECK), hint: hint == null ? V.data().hint : hint, createdAt: V.data().createdAt, items };
    V.key = key; V.salt = D().vault.salt;
    ED.store.commit();
    return true;
  };
  const strip = o => { const c = Object.assign({}, o); delete c.id; return c; };

  /* three wrong master passwords in a row erase the password log (vault.wipeAfter = 0 turns it off) */
  const MAXTRY = 3;
  V.wipeOn = () => !!(V.data() && V.data().wipeAfter !== 0);
  V.triesLeft = () => { const vd = V.data(); return vd ? Math.max(0, MAXTRY - (vd.fails || 0)) : MAXTRY; };
  V.wipe = async () => {
    D().vault = null; V.key = null; V.items = new Map(); V.reveal = new Set(); V.sel = null;
    ED.store.undoStack = ED.store.undoStack.filter(cp => { try { return !JSON.parse(cp.json).vault; } catch (err) { return false; } });   // no undo back to the erased log
    ED.store.commit();
    // the daily snapshots kept in this browser lose their copy too
    try {
      for (const k of (await ED.idb.keys()).filter(k => String(k).startsWith('snap:'))) {
        const d = await ED.lock.idbGet(k); if (d && d.vault) { d.vault = null; await ED.lock.idbPut(k, d); }
      }
    } catch (err) { console.warn('[e-diary] snapshot clean-up', err); }
  };

  /* ---------------- entries ---------------- */
  V.save = async (id, obj) => {
    if (!V.key) throw new Error('locked');
    id = id || U.uid('pw');
    const box = await seal(V.key, strip(obj));
    const list = V.data().items;
    const i = list.findIndex(x => x.id === id);
    const rec = { id, iv: box.iv, ct: box.ct, updatedAt: Date.now() };
    if (i >= 0) list[i] = rec; else list.push(rec);
    V.items.set(id, Object.assign({}, obj, { id }));
    V.touch();
    return id;
  };
  V.remove = id => { V.data().items = V.data().items.filter(x => x.id !== id); V.items.delete(id); };

  /* ---------------- helpers ---------------- */
  const LOWER = 'abcdefghijkmnopqrstuvwxyz', UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ', DIGITS = '23456789', SYM = '!@#$%^&*-_=+?';
  V.generate = (len, symbols) => {
    len = Math.max(8, Math.min(64, len || 16));
    const sets = [LOWER, UPPER, DIGITS].concat(symbols === false ? [] : [SYM]);
    const all = sets.join('');
    const pick = set => { const r = new Uint32Array(1); let x; const lim = Math.floor(0xffffffff / set.length) * set.length; do { crypto.getRandomValues(r); x = r[0]; } while (x >= lim); return set[x % set.length]; };
    const out = sets.map(pick);
    while (out.length < len) out.push(pick(all));
    for (let i = out.length - 1; i > 0; i--) { const r = new Uint32Array(1); crypto.getRandomValues(r); const j = r[0] % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    return out.join('');
  };
  V.strength = p => {
    if (!p) return { score: 0, label: 'Empty' };
    let pool = 0;
    if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^a-zA-Z0-9]/.test(p)) pool += 20;
    let bits = p.length * Math.log2(Math.max(pool, 2));
    if (/^(.)\1+$/.test(p) || /^(?:0123|1234|2345|abcd|qwer|pass|admin|welcome)/i.test(p) || /password|123456|qwerty|iloveyou/i.test(p)) bits = Math.min(bits, 20);
    if (/(\d{4})$/.test(p) && p.length < 12) bits -= 8;
    const score = bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
    return { score, bits: Math.round(bits), label: ['Empty', 'Weak', 'Fair', 'Strong', 'Very strong'][score] };
  };
  const host = u => { try { return new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch (err) { return ''; } };
  const urlOf = u => !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u;
  const ago = ms => { const d = Math.floor((Date.now() - ms) / 864e5); return d < 1 ? 'today' : d < 45 ? d + ' days ago' : d < 540 ? Math.round(d / 30.4) + ' months ago' : (Math.round(d / 36.5) / 10) + ' years ago'; };
  const avatar = name => { const ch = (String(name || '?').trim()[0] || '?').toUpperCase(); let h = 0; for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 8; return '<span class="pw-av" style="--c:var(--s' + (h + 1) + ')" aria-hidden="true">' + e(ch) + '</span>'; };
  const CATS = ['Banking & finance', 'Government', 'Work', 'Email & social', 'Shopping', 'Travel', 'Health', 'Learning', 'Utilities & bills', 'Wi-Fi & devices', 'Other'];
  const SITE_CATS = ['Government', 'Banking & finance', 'Work', 'Research', 'Learning', 'Health', 'Travel', 'Shopping', 'Utilities & bills', 'Tools', 'News', 'Other'];
  /* your own categories and subcategories for websites: data.siteCats = [{ id, name, subs: [names], updatedAt }] (made from the list above the first time) */
  const WCATS = () => {
    const d = D();
    if (!Array.isArray(d.siteCats)) {
      const names = SITE_CATS.filter(c => c !== 'Other');
      (d.sites || []).forEach(x => { if (x.category && names.indexOf(x.category) < 0 && x.category !== 'Other') names.push(x.category); });
      d.siteCats = names.map(n => ({ id: U.uid('wc'), name: n, subs: [], updatedAt: Date.now() }));
    }
    return d.siteCats;
  };
  const catOf = name => WCATS().find(c => c.name.toLowerCase() === String(name || '').toLowerCase()) || null;
  // a category or subcategory typed in the website form joins the list
  const learnCat = (cat, sub) => {
    if (!cat || cat === 'Other') return;
    let c = catOf(cat); if (!c) { c = { id: U.uid('wc'), name: cat, subs: [], updatedAt: Date.now() }; WCATS().push(c); }
    if (sub && !c.subs.some(x => x.toLowerCase() === sub.toLowerCase())) { c.subs.push(sub); c.updatedAt = Date.now(); }
  };

  V.copy = async (text, what) => {
    const ok = await U.copy(text);
    V.touch();
    if (!ok) { ED.ui.toast('Could not copy'); return; }
    ED.ui.toast(what + ' copied' + (what === 'Password' ? ' — the clipboard is cleared in 30 seconds' : ''));
    if (what === 'Password') setTimeout(() => { try { if (document.hasFocus()) navigator.clipboard.writeText(''); } catch (err) { /* ignore */ } }, 30000);
  };

  /* undo, restore, import or a sync may replace the stored log: read it again (or lock if the master password changed) */
  ED.store.on((type, d) => {
    if (type !== 'change' || !V.key || !d || ['undo', 'replace', 'restore', 'remote', 'other-tab'].indexOf(d.reason) < 0) return;
    const vd = V.data();
    if (!vd || !vd.salt || vd.salt !== V.salt) { V.lock(true); if (vd && vd.salt) ED.ui.toast('The password log was changed on another device. Unlock it again.'); return; }
    V.decryptAll().then(() => { if (ED.state.tab === 'vault') ED.app.requestRender(); });
  });

  /* ---------------- auto-lock ---------------- */
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => { if (V.key) V.touch(); }, true));
  setInterval(() => {
    if (!V.key) return;
    const mins = S().vaultLock == null ? 5 : S().vaultLock;
    if (mins > 0 && Date.now() - V.lastUse > mins * 60000) V.lock();
  }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') V.hiddenAt = Date.now();
    else if (V.key && V.hiddenAt && (S().vaultLock || 5) > 0 && Date.now() - V.hiddenAt > (S().vaultLock || 5) * 60000) V.lock();
  });

  /* ======================= page ======================= */
  function entries() {
    const q = V.q.trim().toLowerCase();
    const reuse = new Map();
    V.items.forEach(x => { if (x.pass) reuse.set(x.pass, (reuse.get(x.pass) || 0) + 1); });
    return Array.from(V.items.values())
      .filter(x => !q || [x.site, x.url, x.user, x.category, x.notes].some(v => v && String(v).toLowerCase().indexOf(q) >= 0))
      .map(x => Object.assign({ _reuse: reuse.get(x.pass) || 0 }, x))
      .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || String(a.site || '').localeCompare(String(b.site || '')));
  }

  function lockedHtml() {
    if (!V.supported()) return '<div class="pw-lock"><div class="pw-card">' + ED.icon('lock', 'pw-big') + '<h3>Encryption is not available here</h3><p>This browser does not offer the encryption the password log needs. Open the diary in a current Chrome, Edge, Firefox or Safari.</p></div></div>';
    if (!V.isSet()) return '<div class="pw-lock"><form class="pw-card" data-form="vault-setup" autocomplete="off">' + ED.icon('shield', 'pw-big') +
      '<h3>Set a master password</h3>' +
      '<p>Your password log is encrypted with this master password before it is saved. Only the encrypted form is stored, backed up or synced.</p>' +
      '<label class="lbl" for="pw-m1">Master password</label><input id="pw-m1" class="field" type="password" autocomplete="new-password" minlength="8" required>' +
      '<div class="pw-meter" id="pw-m1-meter" aria-live="polite"></div>' +
      '<label class="lbl" for="pw-m2">Type it again</label><input id="pw-m2" class="field" type="password" autocomplete="new-password" required>' +
      '<label class="lbl" for="pw-hint">Hint (optional, not secret)</label><input id="pw-hint" class="field" maxlength="80" placeholder="Something only you would understand">' +
      '<p class="pw-warn">' + ED.icon('info') + '<span><b>There is no way to recover it.</b> If you forget the master password, the entries cannot be opened by anyone — including you. Write it down somewhere safe.</span></p>' +
      '<button type="submit" class="btn primary">' + ED.icon('lock') + 'Create password log</button></form></div>';
    const vd = V.data();
    return '<div class="pw-lock"><form class="pw-card" data-form="vault-unlock" autocomplete="off">' + ED.icon('lock', 'pw-big') +
      '<h3>Password log is locked</h3><p class="hint">' + U.plural(vd.items.length, 'entry', 'entries') + ' · encrypted on this device</p>' +
      '<label class="lbl" for="pw-open">Master password</label><input id="pw-open" class="field" type="password" autocomplete="current-password" required>' +
      '<p class="pw-err" id="pw-err" role="alert"' + (vd.fails && V.wipeOn() ? '>' + e('Wrong master password entered ' + U.plural(vd.fails, 'time') + '. ' + U.plural(V.triesLeft(), 'try', 'tries') + ' left before the password log is erased.') : ' hidden>') + '</p>' +
      (V.wipeOn() ? '<p class="hint">' + ED.icon('info') + ' After ' + MAXTRY + ' wrong master passwords in a row, the password log is erased.</p>' : '') +
      (vd.hint ? '<p class="hint">Hint: ' + e(vd.hint) + '</p>' : '') +
      '<button type="submit" class="btn primary">' + ED.icon('unlock') + 'Unlock</button>' +
      '<button type="button" class="link-btn pw-forgot" data-act="vault-reset">Forgot the master password?</button></form></div>';
  }

  function listHtml() {
    const list = entries();
    const h12 = S().h12;
    const flags = x => {
      const f = [];
      const s = V.strength(x.pass);
      if (x.pass && s.score <= 1) f.push('<span class="pw-flag weak" title="Easy to guess">Weak</span>');
      if (x._reuse > 1) f.push('<span class="pw-flag reuse" title="The same password is used for ' + x._reuse + ' logins">Reused ×' + x._reuse + '</span>');
      if (x.changedAt && Date.now() - x.changedAt > 365 * 864e5) f.push('<span class="pw-flag old" title="Not changed for over a year">' + ED.icon('history') + 'Old</span>');
      return f.join('');
    };
    const rows = list.map(x => {
      const shown = V.reveal.has(x.id);
      return '<li class="pw-row" data-id="' + e(x.id) + '">' + avatar(x.site || host(x.url)) +
        '<button type="button" class="plain-btn pw-main" data-act="vault-edit" data-id="' + e(x.id) + '"><b>' + (x.fav ? '★ ' : '') + e(x.site || host(x.url) || 'Untitled') + '</b>' +
        '<span class="hint">' + e(x.user || '—') + (x.category ? ' · ' + e(x.category) : '') + '</span>' + (flags(x) ? '<span class="pw-flags">' + flags(x) + '</span>' : '') + '</button>' +
        '<span class="pw-pass num' + (shown ? ' shown' : '') + '">' + (shown ? e(x.pass || '') : (x.pass ? '••••••••' : '')) + '</span>' +
        '<span class="pw-acts">' +
        (x.pass ? '<button type="button" class="icon-btn sm" data-act="vault-reveal" data-id="' + e(x.id) + '" aria-label="' + (shown ? 'Hide' : 'Show') + ' password" title="' + (shown ? 'Hide' : 'Show') + '">' + ED.icon(shown ? 'eyeOff' : 'eye') + '</button>' : '') +
        (x.user ? '<button type="button" class="icon-btn sm" data-act="vault-copy" data-what="user" data-id="' + e(x.id) + '" aria-label="Copy username" title="Copy username">' + ED.icon('user') + '</button>' : '') +
        (x.pass ? '<button type="button" class="icon-btn sm" data-act="vault-copy" data-what="pass" data-id="' + e(x.id) + '" aria-label="Copy password" title="Copy password">' + ED.icon('key') + '</button>' : '') +
        (x.url ? '<a class="icon-btn sm" href="' + e(urlOf(x.url)) + '" target="_blank" rel="noopener noreferrer" aria-label="Open website" title="Open ' + e(host(x.url)) + '">' + ED.icon('external') + '</a>' : '') +
        '</span></li>';
    }).join('');
    const all = Array.from(V.items.values());
    const weak = all.filter(x => x.pass && V.strength(x.pass).score <= 1).length;
    const reuseN = (() => { const m = new Map(); all.forEach(x => { if (x.pass) m.set(x.pass, (m.get(x.pass) || 0) + 1); }); let n = 0; m.forEach(c => { if (c > 1) n += c; }); return n; })();
    const old = all.filter(x => x.changedAt && Date.now() - x.changedAt > 365 * 864e5).length;
    const health = all.length ? '<div class="pw-health"><span>' + ED.icon('shield') + U.plural(all.length, 'login') + '</span>' +
      (weak ? '<span class="pw-flag weak">' + weak + ' weak</span>' : '') + (reuseN ? '<span class="pw-flag reuse">' + reuseN + ' reuse a password</span>' : '') + (old ? '<span class="pw-flag old">' + old + ' older than a year</span>' : '') +
      (!weak && !reuseN && !old ? '<span class="pw-ok">' + ED.icon('check') + 'No weak or reused passwords</span>' : '') + '</div>' : '';
    return health +
      (V.bad ? '<p class="notice">' + V.bad + ' entries could not be opened with this master password (they may come from another device that used a different one).</p>' : '') +
      (rows ? '<ul class="pw-list">' + rows + '</ul>' : '<div class="empty">' + ED.icon('key') + '<div><b>' + (V.q ? 'No logins match “' + e(V.q) + '”.' : 'No logins yet.') + '</b>' + (V.q ? '' : '<br>Add the websites and apps you sign in to. Use “Generate” for a strong, unique password.') + '</div></div>');
  }

  const view = {
    id: 'vault', label: 'Passwords & Websites',
    left() {
      const unlocked = V.unlocked();
      return '<div class="pw">' +
        '<div class="pg-head"><h2 class="pg-title">' + ED.icon(unlocked ? 'unlock' : 'lock', 'pw-ttl-ic') + 'Password log</h2>' +
        (unlocked ? '<div class="fin-tools"><button type="button" class="btn small" data-act="vault-lock">' + ED.icon('lock') + 'Lock</button><button type="button" class="icon-btn" data-act="vault-menu" aria-label="Password log menu" title="More">' + ED.icon('more') + '</button></div>' : '') + '</div>' +
        (unlocked ? '<div class="pw-tools"><label class="pw-search">' + ED.icon('search') + '<span class="sr-only">Search logins</span><input id="pw-q" type="search" placeholder="Search logins" value="' + e(V.q) + '" autocomplete="off"></label>' +
          '<button type="button" class="btn small primary" data-act="vault-new">' + ED.icon('plus') + 'New login</button></div>' : '') +
        '<div class="st-scroll scroll" data-keep-scroll="pw-list" id="pw-results">' + (unlocked ? listHtml() : lockedHtml()) + '</div></div>';
    },
    right() {
      const sites = (D().sites || []).slice();
      const q = (ED.state.siteQ || '').toLowerCase();
      const shown = sites.filter(s => !q || [s.name, s.url, s.category, s.sub, s.notes].some(v => v && v.toLowerCase().indexOf(q) >= 0));
      const groups = new Map();
      shown.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(a.name).localeCompare(String(b.name))).forEach(s => {
        const g = s.pinned ? '★ Pinned' : (s.category || 'Other');
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(s);
      });
      const cats = WCATS().map(c => c.name), rank = g => g === '★ Pinned' ? -2 : cats.indexOf(g) >= 0 ? cats.indexOf(g) : g === 'Other' ? 9999 : 9000;
      const order = Array.from(groups.keys()).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      const row = s =>
        '<li class="ws-row">' + avatar(s.name) + '<a class="ws-main" href="' + e(urlOf(s.url)) + '" target="_blank" rel="noopener noreferrer"><b>' + e(s.name) + '</b><span class="hint">' + e(host(s.url)) + (s.notes ? ' · ' + e(s.notes) : '') + '</span></a>' +
        '<button type="button" class="icon-btn sm" data-act="site-pin" data-id="' + e(s.id) + '" aria-pressed="' + !!s.pinned + '" aria-label="' + (s.pinned ? 'Unpin' : 'Pin to top') + '" title="' + (s.pinned ? 'Unpin' : 'Pin to top') + '">' + ED.icon(s.pinned ? 'star' : 'starO') + '</button>' +
        '<button type="button" class="icon-btn sm" data-act="site-edit" data-id="' + e(s.id) + '" aria-label="Edit ' + e(s.name) + '">' + ED.icon('pencil') + '</button></li>';
      const body = order.map(g => {
        const list = groups.get(g), c = catOf(g), subs = c ? c.subs : [];
        const bySub = new Map(); list.forEach(s => { const k = g !== '★ Pinned' && s.sub ? s.sub : ''; if (!bySub.has(k)) bySub.set(k, []); bySub.get(k).push(s); });
        const keys = Array.from(bySub.keys()).sort((a, b) => (a === '' ? -1 : b === '' ? 1 : (subs.indexOf(a) < 0 ? 999 : subs.indexOf(a)) - (subs.indexOf(b) < 0 ? 999 : subs.indexOf(b)) || a.localeCompare(b)));
        return '<section class="ws-g"><h3 class="gh">' + e(g) + ' <span class="hint num">· ' + list.length + '</span></h3>' +
          keys.map(k => (k ? '<h4 class="ws-sub">' + e(k) + '</h4>' : '') + '<ul class="ws-list">' + bySub.get(k).map(row).join('') + '</ul>').join('') + '</section>';
      }).join('');
      return '<div class="pw ws">' +
        '<div class="pg-head"><h2 class="pg-title">' + ED.icon('globe', 'pw-ttl-ic') + 'Important websites</h2><span class="row-btns"><button type="button" class="btn small ghost" data-act="site-cats">' + ED.icon('list') + 'Categories</button><button type="button" class="btn small" data-act="site-new">' + ED.icon('plus') + 'Add website</button></span></div>' +
        '<label class="pw-search ws-search">' + ED.icon('search') + '<span class="sr-only">Search websites</span><input id="ws-q" type="search" placeholder="Search websites" value="' + e(ED.state.siteQ || '') + '" autocomplete="off"></label>' +
        '<div class="st-scroll scroll" data-keep-scroll="ws-list" id="ws-results">' + (body || '<div class="empty">' + ED.icon('globe') + '<div><b>' + (q ? 'No websites match.' : 'No websites yet.') + '</b>' + (q ? '' : '<br>Keep the addresses you use often — e-filing, banking, research portals, course pages.') + '</div></div>') +
        '<p class="hint ws-note">Website addresses are not secret, so they are not encrypted. Keep sign-in details in the password log on the left.</p></div></div>';
    },
    mount(L, R) {
      const q = L.querySelector('#pw-q');
      if (q) q.addEventListener('input', U.debounce(() => { V.q = q.value; V.touch(); const box = document.getElementById('pw-results'); if (box) box.innerHTML = listHtml(); }, 180));
      const wq = R.querySelector('#ws-q');
      if (wq) wq.addEventListener('input', U.debounce(() => {
        ED.state.siteQ = wq.value;
        const tmp = document.createElement('div'); tmp.innerHTML = view.right();
        const box = document.getElementById('ws-results'), nb = tmp.querySelector('#ws-results');
        if (box && nb) box.innerHTML = nb.innerHTML;
      }, 180));
      const m1 = L.querySelector('#pw-m1');
      if (m1) m1.addEventListener('input', () => { const s = V.strength(m1.value); const mt = L.querySelector('#pw-m1-meter'); mt.innerHTML = m1.value ? meter(s) : ''; });
      const po = L.querySelector('#pw-open'); if (po) setTimeout(() => po.focus(), 50);
    },
  };
  const meter = s => '<span class="pw-mbar s' + s.score + '"><i></i><i></i><i></i><i></i></span><span class="pw-mlab">' + e(s.label) + '</span>';

  ED.views = ED.views || {};
  ED.views.vault = view;

  /* ---------------- forms & actions ---------------- */
  const F = (ED.forms = ED.forms || {});
  F['vault-setup'] = async form => {
    const a = form.querySelector('#pw-m1').value, b = form.querySelector('#pw-m2').value;
    if (a.length < 8) { ED.ui.toast('Use at least 8 characters'); return; }
    if (a !== b) { ED.ui.toast('The two passwords are different'); form.querySelector('#pw-m2').focus(); return; }
    if (V.strength(a).score < 2) { const ok = await ED.ui.confirm({ title: 'Weak master password', message: 'This master password is easy to guess. A longer one — for example four unrelated words — protects everything in the log. Use it anyway?', ok: 'Use it anyway' }); if (!ok) return; }
    const btn = form.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = 'Creating…';
    try { await V.setup(a, form.querySelector('#pw-hint').value.trim()); ED.ui.toast('Password log created and unlocked'); }
    catch (err) { ED.ui.toast('Could not create: ' + err.message, { kind: 'err' }); btn.disabled = false; }
  };
  F['vault-unlock'] = async form => {
    const inp = form.querySelector('#pw-open');
    const btn = form.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = 'Unlocking…';
    const ok = await V.unlock(inp.value).catch(() => false);
    const vd = V.data();
    if (!ok) {
      btn.disabled = false; btn.innerHTML = ED.icon('unlock') + 'Unlock';
      const er = form.querySelector('#pw-err'); er.hidden = false;
      if (V.wipeOn()) {
        vd.fails = (vd.fails || 0) + 1; vd.failAt = Date.now();
        if (vd.fails >= MAXTRY) {
          await V.wipe();
          await ED.ui.confirm({ title: 'Password log erased', message: 'The master password was wrong ' + MAXTRY + ' times in a row, so the password log has been erased from this diary (and from the snapshots kept in this browser). Backups you exported earlier still hold their encrypted copy. You can start a new password log now.', choices: [{ id: true, label: 'OK', primary: true }], cancel: 'Close' });
          ED.app.render(); return;
        }
        ED.store.commit({ silent: true });
        er.textContent = 'That is not the master password. ' + U.plural(V.triesLeft(), 'try', 'tries') + ' left — after ' + MAXTRY + ' wrong tries in a row the password log is erased.';
      } else er.textContent = 'That is not the master password.';
      inp.select(); return;
    }
    if (vd.fails) { delete vd.fails; delete vd.failAt; ED.store.commit({ silent: true }); }
    ED.app.render();
  };
  A['vault-lock'] = () => V.lock();
  A['vault-reset'] = async () => {
    const n = V.isSet() ? V.data().items.length : 0;
    const ok = await ED.ui.confirm({ title: 'Start a new password log', message: 'Without the master password nobody can open the ' + U.plural(n, 'saved entry', 'saved entries') + ' — not even this diary. Delete them and set a new master password? (Undo is possible right after.)', ok: 'Delete the log', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Delete password log');
    D().vault = null; V.key = null; V.items = new Map();
    ED.store.commit(); ED.ui.undoToast('Password log deleted');
  };
  A['vault-reveal'] = el => { const id = el.dataset.id; if (V.reveal.has(id)) V.reveal.delete(id); else V.reveal.add(id); V.touch(); const box = document.getElementById('pw-results'); if (box) box.innerHTML = listHtml(); };
  A['vault-copy'] = el => { const x = V.items.get(el.dataset.id); if (!x) return; if (el.dataset.what === 'user') V.copy(x.user, 'Username'); else V.copy(x.pass, 'Password'); };
  A['vault-new'] = () => { if (!V.unlocked()) { ED.go.tab('vault'); ED.ui.toast('Unlock the password log first'); return; } editEntry(null); };
  A['vault-edit'] = el => editEntry(el.dataset.id);
  A['vault-menu'] = el => ED.ui.menu(el, [
    { label: 'Change master password…', icon: 'key', onClick: changeMaster },
    { label: 'Lock after ' + (S().vaultLock || 'never') + (S().vaultLock ? ' min idle' : '') + '…', icon: 'clock', onClick: lockTime },
    { label: (V.wipeOn() ? 'Erase after 3 wrong master passwords: on' : 'Erase after 3 wrong master passwords: off'), icon: 'shield', onClick: async () => {
      if (V.wipeOn()) { const ok = await ED.ui.confirm({ title: 'Turn off erasing', message: 'Wrong master passwords will no longer erase the password log.', ok: 'Turn off' }); if (!ok) return; V.data().wipeAfter = 0; }
      else delete V.data().wipeAfter;
      ED.store.commit(); ED.ui.toast(V.wipeOn() ? 'On: 3 wrong master passwords erase the log' : 'Off');
    } },
    { sep: true },
    { label: 'Import logins (.csv from a browser or password manager)…', icon: 'upload', onClick: importCSV },
    { label: 'Export logins (.csv, not encrypted)…', icon: 'download', onClick: exportCSV },
  ], { placement: 'right-align' });

  function editEntry(id) {
    const x = id ? V.items.get(id) : null;
    const d = x ? Object.assign({}, x) : { site: '', url: '', user: '', pass: '', notes: '', category: '', fav: false, history: [] };
    const body = '<form class="pw-form" autocomplete="off">' +
      '<div class="st-grid">' +
      '<label class="lbl" for="pe-site">Name</label><input id="pe-site" class="field" value="' + e(d.site) + '" placeholder="SBI net banking, Gmail, GeM portal…">' +
      '<label class="lbl" for="pe-url">Website</label><input id="pe-url" class="field" value="' + e(d.url) + '" placeholder="https://…" inputmode="url">' +
      '<label class="lbl" for="pe-user">Username</label><input id="pe-user" class="field" value="' + e(d.user) + '" autocomplete="off" spellcheck="false">' +
      '<label class="lbl" for="pe-pass">Password</label><div class="pw-passrow"><input id="pe-pass" class="field num" type="password" value="' + e(d.pass) + '" autocomplete="new-password" spellcheck="false">' +
      '<button type="button" class="icon-btn sm" data-pe="show" aria-label="Show password" title="Show">' + ED.icon('eye') + '</button>' +
      '<button type="button" class="btn small" data-pe="gen" title="Make a strong random password">' + ED.icon('dice') + 'Generate</button></div>' +
      '<span></span><div class="pw-meter" id="pe-meter">' + (d.pass ? meter(V.strength(d.pass)) : '') + '</div>' +
      '<label class="lbl" for="pe-cat">Group</label><input id="pe-cat" class="field" list="pe-cats" value="' + e(d.category || '') + '"><datalist id="pe-cats">' + CATS.map(c => '<option value="' + e(c) + '">').join('') + '</datalist>' +
      '<label class="lbl" for="pe-notes">Notes</label><textarea id="pe-notes" class="field" rows="3" placeholder="Security questions, recovery e-mail, customer ID…">' + e(d.notes || '') + '</textarea>' +
      '</div>' +
      '<label class="switch" style="margin-top:10px"><input id="pe-fav" type="checkbox"' + (d.fav ? ' checked' : '') + '><span class="track"></span><span>Keep at the top</span></label>' +
      ((d.history || []).length ? '<details class="pw-hist"><summary>' + ED.icon('history') + 'Earlier passwords (' + d.history.length + ')</summary><ul>' + d.history.map(h => '<li><span class="num">' + e(h.pass) + '</span><span class="hint">used until ' + e(U.fmtStamp(h.until)) + '</span></li>').join('') + '</ul></details>' : '') +
      (x ? '<p class="hint pw-meta">Added ' + e(ago(x.createdAt || Date.now())) + (x.changedAt ? ' · password changed ' + e(ago(x.changedAt)) : '') + '</p>' : '') +
      '</form>';
    ED.ui.modal({
      title: x ? (x.site || 'Login') : 'New login', cls: 'st-modal', body,
      footer: (x ? '<button type="button" class="btn danger" data-pe="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-pe="save">Save</button>',
      onMount(el, api) {
        const $ = s => el.querySelector(s);
        const pass = $('#pe-pass');
        const upd = () => { $('#pe-meter').innerHTML = pass.value ? meter(V.strength(pass.value)) : ''; V.touch(); };
        pass.addEventListener('input', upd);
        $('[data-pe="show"]').addEventListener('click', () => { pass.type = pass.type === 'password' ? 'text' : 'password'; });
        $('[data-pe="gen"]').addEventListener('click', () => { pass.value = V.generate(16, true); pass.type = 'text'; upd(); });
        $('#pe-url').addEventListener('input', () => { $('#pe-site').placeholder = host($('#pe-url').value) || 'SBI net banking, Gmail, GeM portal…'; });
        const save = async () => {
          if (!V.unlocked()) { ED.ui.toast('The log locked itself. Unlock it and try again.'); api.close(); return; }
          const o = { site: $('#pe-site').value.trim() || host($('#pe-url').value.trim()), url: $('#pe-url').value.trim(), user: $('#pe-user').value.trim(), pass: pass.value, notes: $('#pe-notes').value.trim(), category: $('#pe-cat').value.trim(), fav: $('#pe-fav').checked,
            history: (d.history || []).slice(), createdAt: d.createdAt || Date.now(), changedAt: d.changedAt || Date.now() };
          if (!o.site && !o.url) { ED.ui.toast('Give it a name or a website'); $('#pe-site').focus(); return; }
          if (x && x.pass && x.pass !== o.pass) { o.history.unshift({ pass: x.pass, until: Date.now() }); o.history = o.history.slice(0, 5); o.changedAt = Date.now(); }
          ED.store.checkpoint('Password log');
          await V.save(id, o);
          ED.store.commit(); api.close();
          ED.ui.toast(x ? 'Saved' : 'Login added');
        };
        $('[data-pe="save"]').addEventListener('click', save);
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
        const del = $('[data-pe="del"]');
        if (del) del.addEventListener('click', async () => {
          const ok = await ED.ui.confirm({ title: 'Delete login', message: 'Delete the login for “' + (x.site || host(x.url)) + '”? You can undo right after.', ok: 'Delete', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Delete login'); V.remove(id); ED.store.commit(); api.close(); ED.ui.undoToast('Login deleted');
        });
      },
    });
  }

  async function changeMaster() {
    ED.ui.modal({
      title: 'Change master password', cls: 'st-modal',
      body: '<form class="pw-form" autocomplete="off"><div class="st-grid">' +
        '<label class="lbl" for="cm-old">Current</label><input id="cm-old" class="field" type="password" autocomplete="current-password">' +
        '<label class="lbl" for="cm-new">New</label><input id="cm-new" class="field" type="password" autocomplete="new-password">' +
        '<label class="lbl" for="cm-new2">New again</label><input id="cm-new2" class="field" type="password" autocomplete="new-password">' +
        '<label class="lbl" for="cm-hint">Hint</label><input id="cm-hint" class="field" value="' + e(V.data().hint || '') + '">' +
        '</div><p class="hint" style="margin-top:10px">Every entry is encrypted again with the new password. Other devices that sync this diary will ask for the new one.</p></form>',
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="ok">Change</button>',
      onMount(el, api) {
        el.querySelector('[data-x="ok"]').addEventListener('click', async () => {
          const o = el.querySelector('#cm-old').value, n = el.querySelector('#cm-new').value, n2 = el.querySelector('#cm-new2').value;
          if (n.length < 8) { ED.ui.toast('Use at least 8 characters'); return; }
          if (n !== n2) { ED.ui.toast('The new passwords are different'); return; }
          const ok = await V.changeMaster(o, n, el.querySelector('#cm-hint').value.trim()).catch(() => false);
          if (!ok) { ED.ui.toast('The current master password is not right'); return; }
          api.close(); ED.ui.toast('Master password changed'); ED.app.render();
        });
      },
    });
  }
  async function lockTime() {
    const cur = S().vaultLock == null ? 5 : S().vaultLock;
    ED.ui.menu({ x: innerWidth / 2, y: innerHeight / 3 }, [1, 2, 5, 10, 15, 30].map(m => ({ label: m + ' minutes idle', checked: cur === m, onClick: () => { S().vaultLock = m; ED.store.commit(); } })).concat([{ label: 'Only when I lock it', checked: cur === 0, onClick: () => { S().vaultLock = 0; ED.store.commit(); } }]));
  }
  async function exportCSV() {
    const ok = await ED.ui.confirm({ title: 'Export logins', message: 'The file will contain every password in plain text, readable by anyone who opens it. Use it only to move your logins into a password manager, then delete the file.', ok: 'Export', danger: true });
    if (!ok) return;
    const rows = [['name', 'url', 'username', 'password', 'note']];
    V.items.forEach(x => rows.push([x.site, x.url, x.user, x.pass, x.notes]));
    await U.download('logins-' + U.today() + '.csv', ED.xlsx.toCSV(rows), 'text/csv');
  }
  async function importCSV() {
    const file = await U.pickFile('.csv,text/csv');
    if (!file) return;
    try {
      const rows = ED.xlsx.parseCSV(await file.text());
      const head = (rows[0] || []).map(h => String(h).trim().toLowerCase());
      const col = n => head.findIndex(h => n.indexOf(h) >= 0);
      const c = { name: col(['name', 'title', 'site']), url: col(['url', 'login_uri', 'website', 'origin']), user: col(['username', 'login_username', 'user', 'email', 'login']), pass: col(['password', 'login_password']), note: col(['note', 'notes', 'extra', 'comments']) };
      if (c.pass < 0) throw new Error('No “password” column found.');
      const list = rows.slice(1).filter(r => r && r[c.pass] !== undefined && String(r[c.pass]) !== '');
      const ok = await ED.ui.confirm({ title: 'Import logins', message: 'Add ' + U.plural(list.length, 'login') + ' from “' + file.name + '”? After importing, delete that file — it is not encrypted.', ok: 'Import' });
      if (!ok) return;
      ED.store.checkpoint('Import logins');
      for (const r of list) {
        const url = c.url >= 0 ? String(r[c.url] || '') : '';
        await V.save(null, { site: c.name >= 0 ? String(r[c.name] || '') || host(url) : host(url), url, user: c.user >= 0 ? String(r[c.user] || '') : '', pass: String(r[c.pass]), notes: c.note >= 0 ? String(r[c.note] || '') : '', category: '', fav: false, history: [], createdAt: Date.now(), changedAt: Date.now() });
      }
      ED.store.commit(); ED.ui.toast(U.plural(list.length, 'login') + ' imported. Now delete the .csv file.', { timeout: 8000 });
    } catch (err) { ED.ui.toast('Could not import: ' + (err.message || err), { kind: 'err' }); }
  }

  /* ---------------- important websites ---------------- */
  function editSite(id) {
    const s = id ? D().sites.find(x => x.id === id) : { id: U.uid('ws'), name: '', url: '', category: '', notes: '', pinned: false, createdAt: Date.now() };
    ED.ui.modal({
      title: id ? 'Website' : 'New website', cls: 'st-modal',
      body: '<form class="pw-form"><div class="st-grid">' +
        '<label class="lbl" for="ws-name">Name</label><input id="ws-name" class="field" value="' + e(s.name) + '" placeholder="Income Tax e-Filing">' +
        '<label class="lbl" for="ws-url">Address</label><input id="ws-url" class="field" value="' + e(s.url) + '" placeholder="https://…" inputmode="url">' +
        '<label class="lbl" for="ws-cat">Category</label><input id="ws-cat" class="field" list="ws-cats" value="' + e(s.category || '') + '" placeholder="Choose or type a new one"><datalist id="ws-cats">' + WCATS().map(c => '<option value="' + e(c.name) + '">').join('') + '</datalist>' +
        '<label class="lbl" for="ws-sub">Subcategory</label><input id="ws-sub" class="field" list="ws-subs" value="' + e(s.sub || '') + '" placeholder="Optional"><datalist id="ws-subs"></datalist>' +
        '<label class="lbl" for="ws-notes">Note</label><input id="ws-notes" class="field" value="' + e(s.notes || '') + '" placeholder="What it is for">' +
        '</div></form>',
      footer: (id ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        const $ = q => el.querySelector(q);
        $('#ws-url').addEventListener('input', () => { $('#ws-name').placeholder = host($('#ws-url').value) || 'Income Tax e-Filing'; });
        const subs = () => { const c = catOf($('#ws-cat').value.trim()); $('#ws-subs').innerHTML = (c ? c.subs : []).map(x => '<option value="' + e(x) + '">').join(''); };
        $('#ws-cat').addEventListener('input', subs); subs();
        const save = () => {
          const url = $('#ws-url').value.trim(); if (!url) { ED.ui.toast('Enter the address'); $('#ws-url').focus(); return; }
          ED.store.checkpoint('Website');
          const cat = $('#ws-cat').value.trim(), sub = cat ? $('#ws-sub').value.trim() : '';
          learnCat(cat, sub);
          Object.assign(s, { name: $('#ws-name').value.trim() || host(url), url: urlOf(url), category: cat, sub, notes: $('#ws-notes').value.trim(), updatedAt: Date.now() });
          delete s.sample;
          if (!id) D().sites.push(s);
          ED.store.commit(); api.close();
        };
        $('[data-x="save"]').addEventListener('click', save);
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
        const del = $('[data-x="del"]');
        if (del) del.addEventListener('click', () => { ED.store.checkpoint('Delete website'); D().sites = D().sites.filter(x => x.id !== id); ED.store.commit(); api.close(); ED.ui.undoToast('Website deleted'); });
      },
    });
  }
  function editCats() {
    const list = U.clone(WCATS());
    const used = (name, sub) => (D().sites || []).filter(x => x.category === name && (sub == null || x.sub === sub)).length;
    const draw = el => {
      el.querySelector('#wc-list').innerHTML = list.map((c, i) => '<div class="wc-row"><div class="wc-h"><input class="field" data-ci="' + i + '" value="' + e(c.name) + '" aria-label="Category name">' +
        '<span class="hint num">' + U.plural(used(c.oldName || c.name), 'site') + '</span>' +
        '<button type="button" class="icon-btn sm" data-x="up" data-i="' + i + '" aria-label="Move up" title="Move up"' + (i ? '' : ' disabled') + '>' + ED.icon('chevU') + '</button>' +
        '<button type="button" class="icon-btn sm" data-x="del" data-i="' + i + '" aria-label="Remove ' + e(c.name) + '" title="Remove category">' + ED.icon('trash') + '</button></div>' +
        '<div class="wc-subs">' + c.subs.map((x, j) => '<span class="chip wc-chip">' + e(x) + '<button type="button" class="link-btn" data-x="sdel" data-i="' + i + '" data-j="' + j + '" aria-label="Remove ' + e(x) + '">×</button></span>').join('') +
        '<button type="button" class="btn small ghost" data-x="sadd" data-i="' + i + '">' + ED.icon('plus') + 'Subcategory</button></div></div>').join('') ||
        '<p class="hint">No categories. Websites without one are listed under “Other”.</p>';
    };
    ED.ui.modal({
      title: 'Website categories', cls: 'st-modal',
      body: '<p class="hint">Rename, reorder or remove categories and their subcategories. Websites in a removed category move to “Other”; in a removed subcategory they stay in the category.</p><div id="wc-list" class="wc-list"></div>' +
        '<div class="row-btns"><button type="button" class="btn small" data-x="add">' + ED.icon('plus') + 'Add category</button></div>',
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        list.forEach(c => { c.oldName = c.name; c.oldSubs = c.subs.slice(); });
        draw(el);
        el.addEventListener('input', ev => { const i = ev.target.dataset.ci; if (i != null) list[+i].name = ev.target.value; });
        el.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-x]'); if (!b) return;
          const i = +b.dataset.i, x = b.dataset.x;
          if (x === 'add') { const n = await ED.ui.prompt({ title: 'New category', label: 'Category name', ok: 'Add' }); if (n && n.trim() && !list.some(c => c.name.toLowerCase() === n.trim().toLowerCase())) list.push({ id: U.uid('wc'), name: n.trim(), subs: [] }); draw(el); }
          else if (x === 'sadd') { const n = await ED.ui.prompt({ title: 'New subcategory in ' + list[i].name, label: 'Subcategory name', ok: 'Add' }); if (n && n.trim() && list[i].subs.indexOf(n.trim()) < 0) list[i].subs.push(n.trim()); draw(el); }
          else if (x === 'sdel') { list[i].subs.splice(+b.dataset.j, 1); draw(el); }
          else if (x === 'up' && i > 0) { const t = list[i - 1]; list[i - 1] = list[i]; list[i] = t; draw(el); }
          else if (x === 'del') {
            const n = used(list[i].oldName || list[i].name);
            if (n && !(await ED.ui.confirm({ title: 'Remove category', message: U.plural(n, 'website') + ' in “' + list[i].name + '” will move to “Other”.', ok: 'Remove', danger: true }))) return;
            list.splice(i, 1); draw(el);
          }
          else if (x === 'save') {
            ED.store.checkpoint('Website categories');
            const keep = new Map(list.filter(c => c.oldName).map(c => [c.oldName, c]));
            (D().sites || []).forEach(s => {
              if (!s.category || s.category === 'Other') return;
              const c = keep.get(s.category);
              if (!c) { if (WCATS().some(o => o.name === s.category)) { s.category = ''; s.sub = ''; s.updatedAt = Date.now(); } return; }   // category removed
              const nn = c.name.trim() || c.oldName;
              if (nn !== s.category) { s.category = nn; s.updatedAt = Date.now(); }
              if (s.sub && c.oldSubs.indexOf(s.sub) >= 0 && c.subs.indexOf(s.sub) < 0) { s.sub = ''; s.updatedAt = Date.now(); }   // subcategory removed
            });
            D().siteCats = list.filter(c => c.name.trim()).map(c => ({ id: c.id, name: c.name.trim(), subs: c.subs, updatedAt: Date.now() }));
            ED.store.commit(); api.close(); ED.ui.toast('Categories saved');
          }
        });
      },
    });
  }
  A['site-cats'] = () => editCats();
  A['site-new'] = () => editSite(null);
  A['site-edit'] = el => editSite(el.dataset.id);
  A['site-pin'] = el => { const s = D().sites.find(x => x.id === el.dataset.id); if (!s) return; s.pinned = !s.pinned; ED.store.commit(); };
})();
