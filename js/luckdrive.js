/* E-Diary — 1.24.3: keep the pictures of the days in your own Google Drive.
   "Pictures of the days → Keep in Google Drive" copies a year's photographs (365 days) from Wikimedia Commons into a
   folder "E-Diary pictures / <year>" in your Drive (the diary sees only the files it made — scope drive.file, the same
   sign-in as Google Drive sync). With "Use my Drive copies" on, the page takes the picture from your Drive, so the diary
   does not depend on Wikimedia, and this device keeps only a few recent pictures (space). Each file keeps its credit
   (place, author, licence) in its Drive description.
   Data: luck.drive = { 'y:_root' | 'y:<year>': folderId, 'f:<Commons file>': driveFileId }, luck.useDrive */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const D = () => ED.store.data;
  const LD = (ED.luckDrive = { busy: false, stop: false, msg: '' });
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  const L = () => { const d = D(); if (!d.luck || typeof d.luck !== 'object') d.luck = {}; if (!Array.isArray(d.luck.pics)) d.luck.pics = []; return d.luck; };
  const DR = () => { const l = L(); if (!l.drive || typeof l.drive !== 'object') l.drive = {}; return l.drive; };     // flat: 'y:<year>' / 'y:_root' → folder id, 'f:<Commons file>' → file id (merges key by key in sync)
  const GD = () => ED.gdrive;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  LD.yearFiles = y => { const S0 = ED.watermark.year(y), it = ED.watermark.items(); return Array.from(new Set(Object.values(S0.out))).map(i => it[i]).filter(x => x.kind === 'photo').map(x => x.img); };
  LD.saved = y => { const d = DR(); return LD.yearFiles(y).filter(x => d['f:' + x.f]).length; };

  async function token(ask) {
    const g = GD(); if (!g) throw new Error('Google Drive is not available in this diary');
    if (g.connected()) return g.token;
    const why = g.blocked(); if (why) throw new Error(why === 'noclient' ? 'Set up Google sign-in first: Settings → Backup & Sync → Google Drive (it uses the Client ID from Settings → Google Calendar).' : why);
    if (!ask) throw new Error('signin');
    const ok = await g.signIn(true); if (!ok) throw new Error('Google sign-in did not finish');
    return g.token;
  }
  async function call(method, url, body, headers) {
    const t = await token(true);
    const r = await fetch(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + t }, headers || {}), body });
    if (!r.ok) { const tx = await r.text().catch(() => ''); throw new Error('Google Drive ' + r.status + (/accessNotConfigured|has not been used/.test(tx) ? ' — turn on the Google Drive API in your Google Cloud project' : '')); }
    return r;
  }
  async function folder(name, parent) {
    const q = "name = '" + name.replace(/'/g, "\\'") + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" + (parent ? " and '" + parent + "' in parents" : '');
    const j = await (await call('GET', API + '/files?q=' + encodeURIComponent(q) + '&fields=files(id)&spaces=drive')).json();
    if (j.files && j.files.length) return j.files[0].id;
    const c = await (await call('POST', API + '/files?fields=id', JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined }), { 'Content-Type': 'application/json' })).json();
    return c.id;
  }
  async function upload(blob, meta) {
    const b = 'edp' + Math.random().toString(36).slice(2);
    const body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: ' + (blob.type || 'image/jpeg') + '\r\n\r\n', blob, '\r\n--' + b + '--']);
    const j = await (await call('POST', UP + '/files?uploadType=multipart&fields=id', body, { 'Content-Type': 'multipart/related; boundary=' + b })).json();
    return j.id;
  }
  async function getPic(u) {
    for (let t = 0; t < 4; t++) {
      try { const r = await fetch(u, { mode: 'cors', referrerPolicy: 'no-referrer' }); if (r.ok) return await r.blob(); if (r.status !== 429 && r.status < 500) throw new Error('picture ' + r.status); }
      catch (err) { if (t === 3) throw err; }
      await sleep(4000 * (t + 1));
    }
    throw new Error('picture not available');
  }
  /* copy a year's pictures into Drive (skips those already there) */
  LD.saveYear = async (y, onStep) => {
    if (LD.busy) return; LD.busy = true; LD.stop = false;
    let done = 0, failed = 0;
    try {
      const dr = DR();
      if (!dr['y:_root']) dr['y:_root'] = await folder('E-Diary pictures');
      if (!dr['y:' + y]) dr['y:' + y] = await folder(String(y), dr['y:_root']);
      ED.store.commit({ silent: true });
      const todo = LD.yearFiles(y).filter(x => !dr['f:' + x.f]);
      for (const x of todo) {
        if (LD.stop) break;
        try {
          const blob = await getPic(x.u);
          const id = await upload(blob, { name: x.t.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 90) + ' — ' + x.f.slice(0, 60), parents: [dr['y:' + y]], description: x.t + ' · ' + (x.a ? x.a + ' · ' : '') + x.l + ' · https://commons.wikimedia.org/wiki/File:' + x.f });
          dr['f:' + x.f] = id; done++;
          if (done % 10 === 0) ED.store.commit({ silent: true });
        } catch (err) { if (/Google Drive|sign/.test(err.message)) throw err; failed++; }
        if (onStep) onStep(done, todo.length, failed);
        await sleep(LD._sleep == null ? 350 : LD._sleep);
      }
      ED.store.commit({ silent: true });
      return { done, failed };
    } finally { LD.busy = false; }
  };
  /* show the Drive copy on the page (only when chosen and already signed in — never opens a sign-in by itself) */
  const blobs = new Map();
  LD.swap = async root => {
    const l = D().luck; if (!l || !l.useDrive || !l.drive) return;
    const img = root.querySelector('img[data-f]'); if (!img) return;
    const id = l.drive['f:' + img.dataset.f]; if (!id || !GD() || !GD().connected()) return;
    try {
      let url = blobs.get(id);
      if (!url) { const r = await call('GET', API + '/files/' + id + '?alt=media'); url = URL.createObjectURL(await r.blob()); blobs.set(id, url); }
      img.onload = () => img.parentNode && img.parentNode.classList.remove('fail');
      img.src = url;
    } catch (err) { /* keep the Commons picture */ }
  };
  LD.freeDevice = async () => { try { await caches.delete('edpics-1'); return true; } catch (err) { return false; } };
  LD.space = async () => { try { const s = await navigator.storage.estimate(); return s; } catch (err) { return null; } };

  LD.panel = y => {
    const n = LD.yearFiles(y).length, s = LD.saved(y), g = GD(), why = g ? g.blocked() : 'none', on = !!(D().luck && D().luck.useDrive);
    return '<div class="wm-drv">' +
      '<p>Keep the photographs of the days in <b>your own Google Drive</b> — in a folder “E-Diary pictures / ' + y + '”. About ' + Math.round(n * 0.16) + ' MB for the year. Then the diary can take each day’s picture from your Drive, and this device needs to keep only a few recent ones.</p>' +
      '<div class="wm-drv-y"><button type="button" class="btn small ghost" data-d="py">' + ED.icon('chevL') + (y - 1) + '</button><b>' + y + ': ' + s + ' of ' + n + ' photographs in your Drive</b><button type="button" class="btn small ghost" data-d="ny">' + (y + 1) + ED.icon('chevR') + '</button></div>' +
      '<div class="wm-bar"><i style="width:' + (n ? Math.round(s / n * 100) : 0) + '%"></i></div>' +
      (why === 'noclient' ? '<p class="notice">Set up Google sign-in first: ⚙ Settings → Backup & Sync → Google Drive (it uses the Client ID from Settings → Google Calendar).</p>' : why ? '<p class="notice">' + e(why === 'none' ? 'Google Drive is not available here.' : why) + '</p>' : '') +
      '<div class="row-btns"><button type="button" class="btn small primary" data-d="save"' + (why || s >= n ? ' disabled' : '') + '>' + ED.icon('upload') + (s >= n ? 'All of ' + y + ' is in your Drive ✓' : s ? 'Save the rest of ' + y : 'Save ' + y + '’s pictures to my Drive') + '</button>' + (LD.busy ? '<button type="button" class="btn small" data-d="stop">Stop</button>' : '') + '</div>' +
      '<p class="hint" id="wm-drv-msg" aria-live="polite">' + e(LD.msg || '') + '</p>' +
      '<label class="switch"><input type="checkbox" data-d="use"' + (on ? ' checked' : '') + '><span class="track"></span><span>Use my Drive copies on the pages (when signed in to Google)</span></label>' +
      '<h3 class="set-h">Space on this device</h3><p class="hint" id="wm-drv-sp">Pictures seen are kept on this device so they show offline; only the latest 150 or so are kept.</p>' +
      '<div class="row-btns"><button type="button" class="btn small ghost" data-d="free">Free the picture space on this device</button></div></div>';
  };
  LD.bind = (box, y, redraw) => {
    LD.space().then(s => { const p = box.querySelector('#wm-drv-sp'); if (p && s && s.usage != null) p.textContent = 'This diary uses about ' + Math.round(s.usage / 1048576) + ' MB on this device' + (s.quota ? ' (of ' + Math.round(s.quota / 1073741824) + ' GB the browser allows)' : '') + '. Pictures seen are kept so they show offline; only the latest 150 or so are kept.'; });
    box.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-d]'); if (!b) return;
      const a = b.dataset.d;
      if (a === 'py' || a === 'ny') { ev.stopPropagation(); y += a === 'py' ? -1 : 1; box.innerHTML = LD.panel(y); LD.bind(box, y, redraw); return; }
      if (a === 'stop') { LD.stop = true; return; }
      if (a === 'free') { const ok = await LD.freeDevice(); ED.ui.toast(ok ? 'Picture space freed — pictures load again when shown' : 'Nothing to free'); return; }
      if (a === 'save') {
        const msg = () => box.querySelector('#wm-drv-msg');
        LD.msg = 'Starting…'; b.disabled = true;
        try {
          const r = await LD.saveYear(y, (d, n, f) => { LD.msg = 'Saving… ' + d + ' of ' + n + (f ? ' (' + f + ' could not be read — try again later)' : ''); const m = msg(); if (m) m.textContent = LD.msg; });
          LD.msg = r ? (LD.stop ? 'Stopped — ' : 'Done — ') + r.done + ' saved' + (r.failed ? ', ' + r.failed + ' could not be read now (try again later)' : '') + '.' : '';
        } catch (err) { LD.msg = 'Could not save: ' + (err.message || err); }
        box.innerHTML = LD.panel(y); LD.bind(box, y, redraw);
      }
    });
    box.addEventListener('change', ev => {
      const c = ev.target.closest('[data-d="use"]'); if (!c) return;
      L().useDrive = c.checked; ED.store.commit();
      if (c.checked && GD() && !GD().connected() && !GD().blocked()) GD().signIn(true);
    });
  };
})();
