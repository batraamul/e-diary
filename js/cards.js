/* E-Diary — 1.26.4: Passwords → Cards & Certificates. (1.26.5: a link to the original — Drive / DigiLocker — on every
   entry with Open + Download; pictures are small previews, ≤1000 px.)
   Left page:  identity and other cards (Aadhaar, PAN, passport, driving licence, voter ID, health cards, family cards…),
               grouped by the person they belong to; each group folds. The number is hidden until you show or copy it.
   Right page: certificates and achievements (degrees, courses, awards, publications…), grouped name-wise.
   Each entry can carry details and up to two pictures (a photo or scan, made smaller before it is saved).
   Everything is kept inside the encrypted password log (same master password): kind 'card' and kind 'cert' items in
   ED.vault — nothing is readable in the diary's data, backups or sync without the master password. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const V = () => ED.vault;
  const CD = (ED.cards = { q: '', cq: '', reveal: new Set() });

  const TYPES = [['aadhaar', 'Aadhaar', '🪪'], ['pan', 'PAN card', '🧾'], ['passport', 'Passport', '🛂'], ['dl', 'Driving licence', '🚗'], ['voter', 'Voter ID', '🗳️'],
    ['ration', 'Ration / family card', '👨‍👩‍👧'], ['health', 'Health card (ABHA, CGHS, Ayushman, insurance)', '🩺'], ['office', 'Office / service ID', '🏢'], ['student', 'School / student ID', '🎒'],
    ['bank', 'Bank / debit / credit card', '💳'], ['vehicle', 'Vehicle RC / FASTag', '🚙'], ['member', 'Membership / library / club card', '🎫'], ['other', 'Other card', '📇']];
  const CKINDS = [['degree', 'Degree / diploma / marksheet', '🎓'], ['course', 'Course / training / workshop', '📘'], ['award', 'Award / achievement / prize', '🏆'], ['paper', 'Publication / patent', '📄'],
    ['sports', 'Sports / cultural', '🏅'], ['service', 'Service / appreciation / experience', '🤝'], ['birth', 'Birth / marriage / other civil certificate', '📜'], ['other', 'Other certificate', '🗂️']];
  const typ = (L, k) => L.find(x => x[0] === k) || L[L.length - 1];
  const all = kind => (V() && V().unlocked() ? Array.from(V().items.values()).filter(x => x.kind === kind) : []);
  const people = () => { const s = new Set(); ['card', 'cert'].forEach(k => all(k).forEach(x => { if (x.person) s.add(x.person); })); return Array.from(s).sort((a, b) => a.localeCompare(b)); };
  const mask = n => { const t = String(n || ''); const keep = t.replace(/\s/g, '').length > 4 ? 4 : 0; let seen = 0, total = t.replace(/\s/g, '').length; return t.replace(/\S/g, ch => (++seen > total - keep ? ch : '•')); };
  const left = k => (U.isKey(k) ? U.diffDays(U.today(), k) : null);
  const expChip = x => { const n = left(x.valid); if (n == null) return ''; return n < 0 ? '<span class="pw-flag weak">Expired ' + e(U.fmtShort(x.valid)) + '</span>' : n <= 90 ? '<span class="pw-flag old">Valid ' + n + ' more days</span>' : '<span class="hint">valid till ' + e(U.fmtShort(x.valid)) + '</span>'; };
  /* 1.26.5: a link to the original (Google Drive, DigiLocker, a university site…). A Google Drive / Docs file link also
     gets a Download button (Drive's own download address); a folder link only opens. Links cost nothing to keep. */
  const urlOf = u => !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u;
  CD.dlUrl = u => {
    u = urlOf(String(u || '').trim()); let m;
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)([\w-]{20,})/))) return 'https://drive.google.com/uc?export=download&id=' + m[1];
    if ((m = u.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]{20,})/))) return 'https://docs.google.com/' + m[1] + '/d/' + m[2] + '/export?format=' + (m[1] === 'spreadsheets' ? 'xlsx' : 'pdf');
    return '';
  };
  const linkBtns = x => !x.link ? '' : '<a class="icon-btn sm" href="' + e(urlOf(x.link)) + '" target="_blank" rel="noopener noreferrer" aria-label="Open the original" title="Open the original' + (/drive\.google|docs\.google/.test(x.link) ? ' in Google Drive' : '') + '">' + ED.icon('external') + '</a>' +
    (CD.dlUrl(x.link) ? '<a class="icon-btn sm" href="' + e(CD.dlUrl(x.link)) + '" target="_blank" rel="noopener noreferrer" aria-label="Download the original" title="Download the original from Google Drive">' + ED.icon('download') + '</a>' : '');
  const match = (x, q, f) => !q || f.some(k => x[k] && String(x[k]).toLowerCase().indexOf(q) >= 0);

  /* ---------------- pages ---------------- */
  const cardRow = x => {
    const t = typ(TYPES, x.type), shown = CD.reveal.has(x.id);
    return '<li class="cd-row"><span class="cd-ic" aria-hidden="true">' + t[2] + '</span>' +
      '<button type="button" class="plain-btn pw-main" data-act="cd-edit" data-id="' + e(x.id) + '"><b>' + e(x.title || t[1]) + '</b>' +
      '<span class="hint">' + e([x.title ? t[1] : '', x.name && x.name !== x.person ? 'as ' + x.name : '', x.issuer].filter(Boolean).join(' · ') || '—') + '</span>' +
      '<span class="pw-flags">' + expChip(x) + ((x.imgs || []).length ? '<span class="hint">' + ED.icon('image') + ' ' + x.imgs.length + '</span>' : '') + '</span></button>' +
      '<span class="pw-pass num cd-no' + (shown ? ' shown' : '') + '">' + e(x.number ? (shown ? x.number : mask(x.number)) : '') + '</span>' +
      '<span class="pw-acts">' + (x.number ? '<button type="button" class="icon-btn sm" data-act="cd-reveal" data-id="' + e(x.id) + '" aria-label="' + (shown ? 'Hide' : 'Show') + ' number" title="' + (shown ? 'Hide' : 'Show') + ' number">' + ED.icon(shown ? 'eyeOff' : 'eye') + '</button>' +
        '<button type="button" class="icon-btn sm" data-act="cd-copy" data-id="' + e(x.id) + '" aria-label="Copy number" title="Copy number">' + ED.icon('copy') + '</button>' : '') +
      linkBtns(x) + ((x.imgs || []).length ? '<button type="button" class="icon-btn sm" data-act="cd-view" data-id="' + e(x.id) + '" aria-label="See the picture" title="See the picture">' + ED.icon('image') + '</button>' : '') + '</span></li>';
  };
  const certRow = x => {
    const t = typ(CKINDS, x.type);
    return '<li class="cd-row cert"><span class="cd-ic" aria-hidden="true">' + t[2] + '</span>' +
      '<button type="button" class="plain-btn pw-main" data-act="ct-edit" data-id="' + e(x.id) + '"><b>' + e(x.title || t[1]) + '</b>' +
      '<span class="hint">' + e([x.issuer, x.date ? U.fmtShort(x.date) : (x.year || ''), x.grade].filter(Boolean).join(' · ') || t[1]) + '</span>' +
      (x.valid ? '<span class="pw-flags">' + expChip(x) + '</span>' : '') + '</button>' +
      '<span class="pw-acts">' + linkBtns(x) +((x.imgs || []).length ? '<button type="button" class="icon-btn sm" data-act="cd-view" data-id="' + e(x.id) + '" aria-label="See the certificate" title="See the certificate">' + ED.icon('image') + '</button>' : '') + '</span></li>';
  };
  const grouped = (list, pre, row, q, order) => {
    const g = new Map(); list.forEach(x => { const k = x.person || 'Me'; if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
    const keys = Array.from(g.keys()).sort((a, b) => (a === 'Me' ? -1 : b === 'Me' ? 1 : a.localeCompare(b)));
    return (keys.length > 1 && !q ? '<p class="fold-tools"><button type="button" class="link-btn" data-act="fold-all" data-p="' + pre + '" data-shut="1">Fold all</button> · <button type="button" class="link-btn" data-act="fold-all" data-p="' + pre + '">Open all</button></p>' : '') +
      keys.map(k => V().fold(pre + k, '<span class="gh">' + e(k) + '</span> <span class="hint num">· ' + g.get(k).length + '</span>', '<ul class="pw-list">' + g.get(k).sort(order).map(row).join('') + '</ul>', !!q)).join('');
  };
  /* how much the pictures add to the diary (they travel with every sync); links add nothing */
  const picBytes = () => ['card', 'cert'].reduce((a, k) => a + all(k).reduce((b, x) => b + (x.imgs || []).reduce((c, s) => c + s.length, 0), 0), 0);
  const sizeNote = () => { const mb = picBytes() / 1048576; return mb < 2 ? '' : '<p class="notice">' + ED.icon('info') + '<span>Pictures here add about <b>' + mb.toFixed(1) + ' MB</b> to the diary, which goes to Google Drive and your other devices with every change. To keep the diary quick, keep originals in Google Drive (the link) and remove pictures you do not need for a quick look.</span></p>'; };
  const cardsHtml = () => {
    const q = CD.q.trim().toLowerCase(), list = all('card').filter(x => match(x, q, ['title', 'person', 'name', 'number', 'issuer', 'notes']) || (q && typ(TYPES, x.type)[1].toLowerCase().indexOf(q) >= 0));
    const ord = (a, b) => TYPES.findIndex(t => t[0] === a.type) - TYPES.findIndex(t => t[0] === b.type) || String(a.title || '').localeCompare(String(b.title || ''));
    return list.length ? grouped(list, 'cd:', cardRow, q, ord) : '<div class="empty">' + ED.icon('shield') + '<div><b>' + (q ? 'No cards match.' : 'No cards yet.') + '</b>' + (q ? '' : '<br>Keep Aadhaar, PAN, passport, driving licence, health and family cards here — for yourself and each family member.') + '</div></div>';
  };
  const certsHtml = () => {
    const q = CD.cq.trim().toLowerCase(), list = all('cert').filter(x => match(x, q, ['title', 'person', 'issuer', 'number', 'grade', 'notes', 'year']) || (q && typ(CKINDS, x.type)[1].toLowerCase().indexOf(q) >= 0));
    const ord = (a, b) => String(b.date || b.year || '').localeCompare(String(a.date || a.year || '')) || String(a.title || '').localeCompare(String(b.title || ''));
    return list.length ? grouped(list, 'ct:', certRow, q, ord) : '<div class="empty">' + ED.icon('trophy') + '<div><b>' + (q ? 'No certificates match.' : 'No certificates yet.') + '</b>' + (q ? '' : '<br>Degrees and marksheets, courses, awards, publications, your child’s Olympiad certificates — kept name-wise.') + '</div></div>';
  };
  const view = {
    id: 'cards', label: 'Cards & Certificates',
    left() {
      const v = V(), un = v && v.unlocked();
      const head = '<div class="pg-head"><h2 class="pg-title">' + ED.icon(un ? 'unlock' : 'lock', 'pw-ttl-ic') + 'Cards</h2>' + (un ? '<div class="fin-tools"><button type="button" class="btn small" data-act="vault-lock">' + ED.icon('lock') + 'Lock</button></div>' : '') + '</div>';
      if (!un) return '<div class="pw cd">' + head + '<p class="hint lt-why">' + ED.icon('lock') + ' Cards and certificates are kept inside your password log, encrypted with the same master password. Unlock it to see or add them.</p>' + v.lockedHtml() + '</div>';
      return '<div class="pw cd">' + head +
        '<div class="pw-tools"><label class="pw-search">' + ED.icon('search') + '<span class="sr-only">Search cards</span><input id="cd-q" type="search" placeholder="Search cards" value="' + e(CD.q) + '" autocomplete="off"></label>' +
        '<button type="button" class="btn small primary" data-act="cd-edit">' + ED.icon('plus') + 'New card</button></div>' +
        '<div class="st-scroll scroll" data-keep-scroll="cd-list" id="cd-results">' + sizeNote() + cardsHtml() + '</div></div>';
    },
    right() {
      const v = V(), un = v && v.unlocked();
      const head = '<div class="pg-head"><h2 class="pg-title">' + ED.icon('trophy', 'pw-ttl-ic') + 'Certificates &amp; achievements</h2></div>';
      if (!un) return '<div class="pw cd">' + head + '<div class="empty">' + ED.icon('lock') + '<div><b>Locked.</b><br>Unlock the password log on the left page to see certificates and achievements.</div></div></div>';
      return '<div class="pw cd">' + head +
        '<div class="pw-tools"><label class="pw-search">' + ED.icon('search') + '<span class="sr-only">Search certificates</span><input id="ct-q" type="search" placeholder="Search certificates" value="' + e(CD.cq) + '" autocomplete="off"></label>' +
        '<button type="button" class="btn small primary" data-act="ct-edit">' + ED.icon('plus') + 'New certificate</button></div>' +
        '<div class="st-scroll scroll" data-keep-scroll="ct-list" id="ct-results">' + certsHtml() + '</div></div>';
    },
    mount(L, R) {
      const a = L.querySelector('#cd-q'); if (a) a.addEventListener('input', U.debounce(() => { CD.q = a.value; V().touch(); const b = document.getElementById('cd-results'); if (b) b.innerHTML = cardsHtml(); }, 180));
      const c = R.querySelector('#ct-q'); if (c) c.addEventListener('input', U.debounce(() => { CD.cq = c.value; V().touch(); const b = document.getElementById('ct-results'); if (b) b.innerHTML = certsHtml(); }, 180));
      const po = L.querySelector('#pw-open'); if (po) setTimeout(() => po.focus(), 50);
    },
  };
  ED.views = ED.views || {};
  ED.views.cards = view;

  /* ---------------- pictures: made smaller before they are saved (they travel with every sync) ---------------- */
  const shrink = file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('That file could not be read'));
    r.onload = () => { const img = new Image(); img.onerror = () => rej(new Error('That is not a picture this browser can open (use a JPG or PNG photo or screenshot)'));
      img.onload = () => { const k = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.6)); };
      img.src = r.result; };
    r.readAsDataURL(file);
  });
  const showPics = (x, title) => ED.ui.modal({ title, cls: 'st-modal', body: '<div class="cd-pics">' + (x.imgs || []).map((s, i) => '<figure><img src="' + e(s) + '" alt="' + e(title + ' — picture ' + (i + 1)) + '"><figcaption><a class="btn small" href="' + e(s) + '" download="' + e((title || 'picture').replace(/[^\w\- ]+/g, '').trim() + '-' + (i + 1) + '.jpg') + '">' + ED.icon('download') + 'Save a copy</a></figcaption></figure>').join('') + '</div>',
    footer: '<span class="grow"></span><button type="button" class="btn primary" data-mclose>Close</button>' });

  /* ---------------- 1.26.5: put the original in your own Google Drive and keep only its link ----------------
     Folder “E-Diary cards & certificates / <name>” in My Drive (scope drive.file: the diary sees only files it made).
     The file stays private to your Google account, like any file you put in Drive yourself; it is not encrypted by the
     diary. Uploading runs in the background — the diary stays usable meanwhile. */
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  const G = () => ED.gdrive;
  async function token() {
    const g = G(); if (!g) throw new Error('Google Drive is not available here');
    if (g.connected()) return g.token;
    const why = g.blocked && g.blocked(); if (why) throw new Error(why === 'noclient' ? 'Set up Google sign-in first: Settings → Backup & Sync → Google Drive (it uses the Client ID from Settings → Google Calendar).' : why);
    if (!(await g.signIn(true))) throw new Error('Google sign-in did not finish');
    return g.token;
  }
  async function call(method, url, body, headers) {
    const r = await fetch(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + await token() }, headers || {}), body });
    if (!r.ok) { const tx = await r.text().catch(() => ''); throw new Error('Google Drive ' + r.status + (/accessNotConfigured|has not been used/.test(tx) ? ' — turn on the Google Drive API in your Google Cloud project' : /insufficient|scope/i.test(tx) ? ' — sign in again and tick the Google Drive box' : '')); }
    return r.json();
  }
  async function folder(name, parent) {
    const q = "name = '" + name.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" + (parent ? " and '" + parent + "' in parents" : '');
    const j = await call('GET', API + '/files?q=' + encodeURIComponent(q) + '&fields=files(id)&spaces=drive');
    if (j.files && j.files.length) return j.files[0].id;
    return (await call('POST', API + '/files?fields=id', JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined }), { 'Content-Type': 'application/json' })).id;
  }
  CD.toDrive = async (file, person, title) => {
    const root = await folder('E-Diary cards & certificates'), sub = await folder((person || 'Me').slice(0, 80), root);
    const b = 'edc' + Math.random().toString(36).slice(2), ext = (file.name.match(/\.[\w]{1,5}$/) || [''])[0];
    const meta = { name: ((title || file.name).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) || 'file') + (title && ext ? ext : ''), parents: [sub] };
    const body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n', file, '\r\n--' + b + '--']);
    const j = await call('POST', UP + '/files?uploadType=multipart&fields=id,webViewLink', body, { 'Content-Type': 'multipart/related; boundary=' + b });
    return { id: j.id, link: j.webViewLink || 'https://drive.google.com/file/d/' + j.id + '/view' };
  };
  const driveOk = () => { const g = G(); return !!(g && !ED.env.claude && !(g.blocked && g.blocked() === 'noclient')); };

  /* ---------------- add / edit (one form for both kinds) ---------------- */
  function edit(kind, id) {
    const v = V(); if (!v.unlocked()) { ED.ui.toast('Unlock the password log first'); return; }
    const isCard = kind === 'card', x = id ? v.items.get(id) : null, L = isCard ? TYPES : CKINDS;
    const d = x ? Object.assign({}, x) : { kind, type: L[0][0], person: '', title: '', name: '', number: '', issuer: '', date: '', valid: '', grade: '', link: '', notes: '', imgs: [] };
    let imgs = (d.imgs || []).slice(), driveId = d.driveId || '';
    const inp = (k, lab, attr) => '<label class="lbl" for="cf-' + k + '">' + lab + '</label><input id="cf-' + k + '" class="field" value="' + e(d[k] || '') + '" ' + (attr || '') + '>';
    const body = '<form class="pw-form" autocomplete="off"><div class="st-grid">' +
      '<label class="lbl" for="cf-type">Kind</label><select id="cf-type" class="field">' + L.map(t => '<option value="' + t[0] + '"' + (t[0] === d.type ? ' selected' : '') + '>' + t[2] + ' ' + e(t[1]) + '</option>').join('') + '</select>' +
      inp('person', isCard ? 'Belongs to' : 'Name (whose it is)', 'list="cf-people" placeholder="Me, or a family member’s name"') + '<datalist id="cf-people">' + people().map(p => '<option value="' + e(p) + '">').join('') + '</datalist>' +
      (isCard ? inp('title', 'Label', 'placeholder="Optional — e.g. SBI debit card, CGHS card"') + inp('number', 'Card number', 'class="field num" spellcheck="false" autocomplete="off"') + inp('name', 'Name on the card', '') + inp('issuer', 'Issued by', 'placeholder="UIDAI, Income Tax Dept., RTO Delhi…"')
        : inp('title', 'Certificate / achievement', 'placeholder="B.Tech (ECE), NPTEL course, Best Paper award…"') + inp('issuer', 'Given by', 'placeholder="University, institute, organisation"') + inp('number', 'Certificate no. / ID', 'spellcheck="false"') + inp('grade', 'Grade / score / rank', '')) +
      '<label class="lbl" for="cf-date">' + (isCard ? 'Issued on' : 'Date') + '</label><input id="cf-date" class="field" type="date" value="' + e(d.date || '') + '">' +
      '<label class="lbl" for="cf-valid">Valid till</label><div><input id="cf-valid" class="field" type="date" value="' + e(d.valid || '') + '"><span class="hint">Leave empty if it does not expire.</span></div>' +
      '<label class="lbl" for="cf-link">Link to the original</label><div><input id="cf-link" class="field" value="' + e(d.link || '') + '" inputmode="url" placeholder="Google Drive, DigiLocker or the issuer’s site (optional)">' + (driveOk() ? '<button type="button" class="btn small cd-up" data-x="drive">' + ED.icon('upload') + 'Upload the original to Google Drive…</button>' : '') + '<span class="hint">' + (driveOk() ? 'Uploads a PDF or picture into “E-Diary cards &amp; certificates” in your Google Drive and fills in the link. Or paste a link: ' : 'Google Drive: ') + 'right-click the file → Share → <b>Copy link</b>. The card then has <b>Open</b> and <b>Download</b> buttons. Better than pictures for full-quality scans and PDFs — a link adds nothing to the diary’s size.</span></div>' +
      '<label class="lbl" for="cf-notes">Details</label><textarea id="cf-notes" class="field" rows="3" placeholder="' + (isCard ? 'Linked mobile number, address on the card, enrolment no., where the original is kept…' : 'What it was for, duration, where the original is kept…') + '">' + e(d.notes || '') + '</textarea>' +
      '<span class="lbl">Pictures</span><div><div class="cd-thumbs" id="cf-imgs"></div><button type="button" class="btn small" data-x="pic">' + ED.icon('image') + 'Add a picture</button><span class="hint"> Up to 2, for a quick look (front and back). Kept as small previews (about 30–100 KB each) so syncing stays quick — keep the full-quality original in Google Drive and put its link above.</span></div>' +
      '</div></form>';
    ED.ui.modal({
      title: x ? (x.title || typ(L, x.type)[1]) : (isCard ? 'New card' : 'New certificate / achievement'), cls: 'st-modal', body,
      footer: (x ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        const $ = s => el.querySelector(s), val = k => ($('#cf-' + k) ? $('#cf-' + k).value.trim() : '');
        const draw = () => { $('#cf-imgs').innerHTML = imgs.map((s, i) => '<span class="cd-thumb"><img src="' + e(s) + '" alt="Picture ' + (i + 1) + '"><button type="button" class="icon-btn sm" data-rm="' + i + '" aria-label="Remove picture ' + (i + 1) + '" title="Remove">' + ED.icon('x') + '</button></span>').join(''); $('[data-x="pic"]').disabled = imgs.length >= 2; };
        draw();
        el.addEventListener('click', async ev => {
          const rm = ev.target.closest('[data-rm]'); if (rm) { imgs.splice(+rm.dataset.rm, 1); draw(); return; }
          const b = ev.target.closest('[data-x]'); if (!b) return;
          if (b.dataset.x === 'drive') {
            const f = await U.pickFile('application/pdf,image/*'); if (!f) return;
            if (f.size > 25e6) { ED.ui.toast('That file is over 25 MB — upload it in Google Drive yourself and paste its link'); return; }
            b.disabled = true; const was = b.innerHTML; b.innerHTML = ED.icon('upload') + 'Uploading… (you can keep typing)';
            try {
              const r = await CD.toDrive(f, val('person'), val('title') || typ(L, $('#cf-type').value)[1]);
              if (document.body.contains(el)) { $('#cf-link').value = r.link; driveId = r.id; }
              ED.ui.toast('Saved in Google Drive — the link is filled in. Press Save to keep it.');
            } catch (err) { ED.ui.toast(err.message === 'signin' ? 'Sign in to Google first (Settings → Backup & Sync)' : (err.message || 'Could not upload'), { kind: 'err' }); }
            finally { b.disabled = false; b.innerHTML = was; }
            return;
          }
          if (b.dataset.x === 'pic') { const f = await U.pickFile('image/*'); if (!f) return; try { imgs.push(await shrink(f)); draw(); } catch (err) { ED.ui.toast(err.message || 'Could not add that picture'); } }
          else if (b.dataset.x === 'save') save();
          else if (b.dataset.x === 'del') {
            if (!(await ED.ui.confirm({ title: 'Delete', message: 'Delete “' + (x.title || typ(L, x.type)[1]) + '”' + (x.person ? ' (' + x.person + ')' : '') + '? You can undo right after.', ok: 'Delete', danger: true }))) return;
            ED.store.checkpoint('Delete ' + kind); v.remove(id); ED.store.commit(); api.close(); ED.ui.undoToast('Deleted');
          }
        });
        const save = async () => {
          if (!v.unlocked()) { ED.ui.toast('The log locked itself. Unlock it and try again.'); api.close(); return; }
          const o = { kind, type: $('#cf-type').value, person: val('person'), title: val('title'), name: val('name'), number: val('number'), issuer: val('issuer'), date: val('date'), valid: val('valid'), grade: val('grade'), link: val('link'), driveId: driveId && CD.dlUrl(val('link')).indexOf(driveId) >= 0 ? driveId : '', notes: val('notes'), imgs, createdAt: d.createdAt || Date.now(), changedAt: Date.now() };
          if (o.link && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+([\/?#].*)?$/i.test(o.link)) { ED.ui.toast('That link does not look like a web address'); $('#cf-link').focus(); return; }
          if (o.link) o.link = urlOf(o.link);
          if (!isCard && !o.title) { ED.ui.toast('Fill in: Certificate / achievement'); $('#cf-title').focus(); return; }
          if (isCard && !o.number && !o.title && !imgs.length) { ED.ui.toast('Fill in the card number (or a label, or add a picture)'); $('#cf-number').focus(); return; }
          ED.store.checkpoint(isCard ? 'Card' : 'Certificate');
          await v.save(id || U.uid(isCard ? 'cd' : 'ct'), o);
          ED.store.commit(); api.close(); ED.ui.toast(x ? 'Saved' : (isCard ? 'Card added' : 'Certificate added'));
        };
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
      },
    });
  }
  A['cd-edit'] = el => edit('card', el.dataset.id || null);
  A['ct-edit'] = el => edit('cert', el.dataset.id || null);
  A['cd-reveal'] = el => { const id = el.dataset.id; if (CD.reveal.has(id)) CD.reveal.delete(id); else CD.reveal.add(id); V().touch(); const b = document.getElementById('cd-results'); if (b) b.innerHTML = cardsHtml(); };
  A['cd-copy'] = el => { const x = V().items.get(el.dataset.id); if (x && x.number) V().copy(x.number, 'Number'); };
  A['cd-view'] = el => { const x = V().items.get(el.dataset.id); if (x) { V().touch(); showPics(x, (x.title || typ(x.kind === 'card' ? TYPES : CKINDS, x.type)[1]) + (x.person ? ' — ' + x.person : '')); } };
  // locking hides shown numbers
  const lock0 = ED.vault.lock; ED.vault.lock = q => { CD.reveal = new Set(); return lock0(q); };
})();
