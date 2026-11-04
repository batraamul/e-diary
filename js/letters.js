/* E-Diary — 1.24: Letters (Passwords section → Letters).
   • A letter to God or to the forefathers, written as a postcard or an inland letter.
   • Letters to family members, with an option to send them by email by themselves if the diary is not opened
     on any device for N days (15 unless you choose otherwise).
   Every letter is kept inside the encrypted password log (same master password), so nothing is readable
   in the diary's data, backups or sync without it.
   Auto-send: a web page cannot send email while it is closed, so the sending is done by a small Google Apps Script
   in the user's own Google account ("letter keeper"). The diary tells it "I was opened" (a ping) from every device,
   at most every few hours, and hands it the family letters marked for auto-send. A timer in the script checks
   every 6 hours: it first emails the owner a warning, then, after N days without any ping, sends the letters
   with the owner's Gmail and marks them sent. Copies of the auto-send letters are therefore readable in the
   owner's own Apps Script project — the page says so plainly before it is turned on. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const V = () => ED.vault;
  const LT = (ED.letters = { sel: null, filt: 'all' });

  const TYPES = { god: ['🙏', 'To God'], pitr: ['🪔', 'To the forefathers'], family: ['✉️', 'To family'] };
  const STYLES = { postcard: 'Postcard', inland: 'Inland letter', email: 'Email' };
  const PICS = [['shiv', 'Shiva at Kailash'], ['temple', 'A Shiva temple'], ['ganesh', 'Ganesh'], ['parvati', 'Gauri — lotus and kalash'], ['hanuman', 'Hanuman’s gada'], ['surya', 'Surya'], ['diya', 'Diyas'], ['krishna', 'Flute and feather'], ['ram', 'Bow and arrow']];
  const DEF = {
    god: { to: 'Bhagwan Shiv', place: 'Kailash Parvat', style: 'postcard', pic: 'shiv', open: 'प्रिय भोलेनाथ,' },
    pitr: { to: 'Pujya Pitrgan', place: 'Pitr Lok', style: 'inland', pic: 'diya', open: 'पूज्य पितृगण, सादर प्रणाम।' },
    family: { to: '', place: '', style: 'email', pic: '', open: '' },
  };
  LT.list = () => (V() && V().unlocked() ? Array.from(V().items.values()).filter(x => x.kind === 'letter') : [])
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.updatedAt || 0) - (a.updatedAt || 0));

  /* ---------------- letter keeper (auto-send) ---------------- */
  LT.svc = () => D().letterSvc || {};
  const svcSet = o => { D().letterSvc = Object.assign({}, LT.svc(), o); };
  const okUrl = v => /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(String(v || '').trim());
  LT.token = () => { const a = crypto.getRandomValues(new Uint8Array(18)); return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join(''); };
  LT.script = tok => [
    '// E-Diary letter keeper — paste into a NEW Google Apps Script project (script.google.com → New project).',
    '// 1) Save. 2) Choose the function "setup" at the top and press Run — allow it (it sends email as you and runs a timer).',
    '// 3) Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone → copy the /exec address into the diary.',
    '// It keeps only the letters you mark "send if I am away", and sends them with your Gmail if your diary is not',
    '// opened on any device for the number of days you chose. It warns YOU by email first. Nothing else is read or sent.',
    'var TOKEN = "' + tok + '";',
    'function setup() {',
    '  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "check") ScriptApp.deleteTrigger(t); });',
    '  ScriptApp.newTrigger("check").timeBased().everyHours(6).create();',
    '  var P = PropertiesService.getScriptProperties(); if (!P.getProperty("seen")) P.setProperty("seen", String(Date.now()));',
    '  Logger.log("Ready. Mail quota left today: " + MailApp.getRemainingDailyQuota());',
    '}',
    'function doGet(e) { return handle((e && e.parameter) || {}); }',
    'function doPost(e) { var p = {}; try { p = JSON.parse(e.postData.contents); } catch (x) {} return handle(p); }',
    'function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }',
    'function readLetters(P) { var n = +(P.getProperty("n") || 0), s = ""; for (var i = 0; i < n; i++) s += P.getProperty("L" + i) || ""; try { return s ? JSON.parse(s) : []; } catch (x) { return []; } }',
    'function writeLetters(P, list) {',
    '  var n = +(P.getProperty("n") || 0); for (var i = 0; i < n; i++) P.deleteProperty("L" + i);',
    '  var s = JSON.stringify(list || []), k = 0; for (var j = 0; j < s.length; j += 8000) P.setProperty("L" + (k++), s.slice(j, j + 8000));',
    '  P.setProperty("n", String(k));',
    '}',
    'function handle(p) {',
    '  if (String(p.t || "") !== TOKEN) return out({ ok: false, error: "token" });',
    '  var P = PropertiesService.getScriptProperties(), now = Date.now();',
    '  if (p.a !== "status") { P.setProperty("seen", String(now)); P.deleteProperty("warned"); }',
    '  if (p.a === "save") {',
    '    var list = (p.letters || []).slice(0, 40).map(function (l) { return { id: String(l.id), to: String(l.to || "").slice(0, 300), name: String(l.name || "").slice(0, 80), subject: String(l.subject || "").slice(0, 200), body: String(l.body || "").slice(0, 20000), sign: String(l.sign || "").slice(0, 80) }; });',
    '    writeLetters(P, list); P.setProperty("days", String(Math.max(1, +p.days || 15))); P.setProperty("warn", String(Math.max(0, +p.warn || 0))); P.deleteProperty("sent");',
    '  }',
    '  if (p.a === "clear") { writeLetters(P, []); P.deleteProperty("sent"); }',
    '  if (p.a === "test") {',
    '    var me = Session.getEffectiveUser().getEmail();',
    '    MailApp.sendEmail(me, "E-Diary letter keeper works", "This is a test from your E-Diary letter keeper.\\n\\nYour letters (" + readLetters(P).length + ") will be sent only if your diary is not opened on any device for " + (P.getProperty("days") || 15) + " days. You will get a warning first.");',
    '  }',
    '  var trig = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "check"; });',
    '  return out({ ok: true, seen: +(P.getProperty("seen") || 0), days: +(P.getProperty("days") || 15), warn: +(P.getProperty("warn") || 0), sent: +(P.getProperty("sent") || 0), warned: +(P.getProperty("warned") || 0),',
    '    letters: readLetters(P).map(function (l) { return { id: l.id, name: l.name }; }), timer: trig, quota: MailApp.getRemainingDailyQuota() });',
    '}',
    'function check() {',
    '  var P = PropertiesService.getScriptProperties(), list = readLetters(P);',
    '  if (!list.length || P.getProperty("sent")) return;',
    '  var days = +(P.getProperty("days") || 15), warn = +(P.getProperty("warn") || 0), seen = +(P.getProperty("seen") || Date.now());',
    '  var idle = (Date.now() - seen) / 864e5, me = Session.getEffectiveUser().getEmail();',
    '  if (idle >= days) {',
    '    list.forEach(function (l) { try { MailApp.sendEmail({ to: l.to, subject: l.subject || "A letter for you", body: l.body + (l.sign ? "\\n\\n" + l.sign : ""), name: l.sign || undefined }); } catch (x) {} });',
    '    P.setProperty("sent", String(Date.now()));',
    '    MailApp.sendEmail(me, "E-Diary: your letters were sent", "Your diary was not opened for " + Math.floor(idle) + " days, so " + list.length + " letter(s) were sent to: " + list.map(function (l) { return l.name || l.to; }).join(", ") + ".");',
    '  } else if (warn && idle >= days - warn && !P.getProperty("warned")) {',
    '    P.setProperty("warned", String(Date.now()));',
    '    MailApp.sendEmail(me, "E-Diary: letters will be sent in " + Math.ceil(days - idle) + " day(s)", "Your E-Diary has not been opened on any device for " + Math.floor(idle) + " days.\\nIf it stays closed, your letters to " + list.map(function (l) { return l.name || l.to; }).join(", ") + " will be sent in about " + Math.ceil(days - idle) + " day(s).\\n\\nOpen the diary on any device to stop this.");',
    '  }',
    '}',
  ].join('\n');

  const timed = (url, opt, ms) => new Promise((ok, bad) => {
    const c = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => { if (c) c.abort(); bad(new Error('timed out')); }, ms || 20000);
    fetch(url, Object.assign({}, opt, c ? { signal: c.signal } : {})).then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); bad(err); });
  });
  LT.call = async (a, extra, svc) => {
    const s = svc || LT.svc();
    if (!okUrl(s.url) || !s.token) throw new Error('not set up');
    const r = await timed(String(s.url).trim(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ a, t: s.token }, extra || {})) }, 30000);
    if (!r.ok) throw new Error('letter keeper ' + r.status);
    const j = JSON.parse(await r.text());
    if (!j || !j.ok) throw new Error(j && j.error === 'token' ? 'the script has a different code — copy the script again' : 'no answer');
    LT.last = j; LT.lastAt = Date.now();
    return j;
  };
  /* "I was opened" — from any device, at most every 3 hours (the script checks every 6) */
  const PING = 'ed-letter-ping';
  LT.ping = async force => {
    const s = LT.svc(); if (!s.on || !okUrl(s.url) || !s.token) return null;
    let last = 0; try { last = +localStorage.getItem(PING) || 0; } catch (err) { last = 0; }
    if (!force && Date.now() - last < 3 * 3600e3) return null;
    try { localStorage.setItem(PING, String(Date.now())); } catch (err) { /* private window */ }
    try {
      const j = await LT.call('ping');
      if (j.sent && j.sent !== s.sentAt) { svcSet({ sentAt: j.sent }); ED.store.commit({ silent: true }); }
      if (LT.svc().pending && V() && V().unlocked()) LT.push();
      return j;
    } catch (err) { return null; }
  };
  /* hand the auto-send letters to the keeper (needs the password log unlocked to read them) */
  LT.autoList = () => LT.list().filter(x => x.type === 'family' && x.auto && x.email);
  LT.push = async () => {
    const s = LT.svc(); if (!s.on) return null;
    if (!V() || !V().unlocked()) { svcSet({ pending: true }); return null; }
    const letters = LT.autoList().map(x => ({ id: x.id, to: x.email, name: x.to, subject: x.subject, body: x.body, sign: x.sign }));
    try {
      const j = await LT.call('save', { letters, days: s.days || 15, warn: s.warn == null ? 3 : s.warn });
      svcSet({ pending: false, syncedAt: Date.now(), sentAt: 0 }); ED.store.commit({ silent: true });
      return j;
    } catch (err) { svcSet({ pending: true }); ED.store.commit({ silent: true }); return null; }
  };

  /* ---------------- drawing a letter ---------------- */
  const para = t => String(t || '').split(/\n/).map(l => '<span class="lt-ln">' + (e(l) || '&nbsp;') + '</span>').join('');
  const fmt = k => { try { return U.fmtLong(k); } catch (err) { return k || ''; } };
  LT.card = x => {
    const art = x.pic && ED.watermark ? ED.watermark.svg(x.pic, '') : '';
    if (x.style === 'postcard') return '<article class="lt-post" aria-label="Postcard to ' + e(x.to) + '">' +
      '<div class="lt-pfront">' + (art ? '<div class="lt-art">' + art + '</div>' : '') + '<span class="lt-pcap">' + e(x.to || '') + (x.place ? ' · ' + e(x.place) : '') + '</span></div>' +
      '<div class="lt-pback"><div class="lt-pmsg"><span class="lt-date">' + e(fmt(x.date)) + '</span>' + para(x.body) + (x.sign ? '<span class="lt-sign">' + e(x.sign) + '</span>' : '') + '</div>' +
      '<div class="lt-paddr"><span class="lt-stamp" aria-hidden="true">ॐ</span><span class="lt-pk">POST CARD · पोस्ट कार्ड</span><span class="lt-al"><b>' + e(x.to || '') + '</b></span><span class="lt-al">' + e(x.place || '') + '</span><span class="lt-al">&nbsp;</span></div></div></article>';
    if (x.style === 'inland') return '<article class="lt-inl" aria-label="Inland letter to ' + e(x.to) + '">' +
      '<header class="lt-ih"><span>अन्तर्देशीय पत्र · INLAND LETTER</span><span class="lt-stamp" aria-hidden="true">🪔</span></header>' +
      '<div class="lt-ibody"><span class="lt-date">' + e(fmt(x.date)) + '</span>' + para(x.body) + (x.sign ? '<span class="lt-sign">' + e(x.sign) + '</span>' : '') + '</div>' +
      '<footer class="lt-if"><span>To: <b>' + e(x.to || '') + '</b></span><span>' + e(x.place || '') + '</span></footer></article>';
    return '<article class="lt-mail" aria-label="Email to ' + e(x.to) + '"><header><span>To: <b>' + e(x.to || '') + '</b> &lt;' + e(x.email || 'no email yet') + '&gt;</span><span>Subject: <b>' + e(x.subject || '—') + '</b></span></header>' +
      '<div class="lt-mbody"><span class="lt-date">' + e(fmt(x.date)) + '</span>' + para(x.body) + (x.sign ? '<span class="lt-sign">' + e(x.sign) + '</span>' : '') + '</div></article>';
  };
  const mailto = x => 'mailto:' + encodeURIComponent(x.email || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent(x.subject || '') + '&body=' + encodeURIComponent((x.body || '') + (x.sign ? '\n\n' + x.sign : ''));

  /* ---------------- page ---------------- */
  const svcLine = () => {
    const s = LT.svc();
    if (!s.on) return '<div class="lt-svc off">' + ED.icon('mail') + '<div><b>Auto-send to family is off.</b><span class="hint">Letters can be sent by email by themselves if the diary is not opened for some days.</span></div><button type="button" class="btn small" data-act="lt-svc">Set it up</button></div>';
    const n = LT.autoList().length;
    return '<div class="lt-svc on' + (s.sentAt ? ' sent' : '') + '">' + ED.icon('shield') + '<div><b>' + (s.sentAt ? 'Your letters were sent on ' + e(new Date(s.sentAt).toLocaleDateString()) + '.' : 'Auto-send is on — ' + U.plural(n, 'letter') + ' after ' + (s.days || 15) + ' days without the diary.') + '</b>' +
      '<span class="hint">' + (s.pending ? 'Changes are waiting to reach your letter keeper (it needs a connection).' : s.syncedAt ? 'Letter keeper updated ' + e(new Date(s.syncedAt).toLocaleString()) + '.' : '') + ' Opening the diary on any device resets the count.</span></div><button type="button" class="btn small ghost" data-act="lt-svc">Settings</button></div>';
  };
  const view = {
    id: 'letters', label: 'Letters',
    left() {
      const v = V();
      const head = '<div class="pg-head"><h2 class="pg-title">' + ED.icon('mail', 'pw-ttl-ic') + 'Letters</h2>' + (v && v.unlocked() ? '<div class="fin-tools"><button type="button" class="btn small" data-act="vault-lock">' + ED.icon('lock') + 'Lock</button></div>' : '') + '</div>';
      if (!v || !v.unlocked()) return '<div class="pw lt">' + head + '<p class="hint lt-why">' + ED.icon('lock') + ' Letters are kept inside your password log, encrypted with the same master password. Unlock it to read or write.</p>' + v.lockedHtml() + '</div>';
      // a change that could not reach the letter keeper earlier (offline, or made while locked): try again, at most every 10 minutes
      if (LT.svc().on && LT.svc().pending && Date.now() - (LT._tried || 0) > 600e3) { LT._tried = Date.now(); setTimeout(() => LT.push(), 500); }
      const all = LT.list(), f = LT.filt;
      const shown = all.filter(x => f === 'all' || x.type === f);
      const rows = shown.map(x => '<li><button type="button" class="lt-row' + (LT.sel === x.id ? ' sel' : '') + '" data-act="lt-sel" data-id="' + e(x.id) + '" aria-pressed="' + (LT.sel === x.id) + '"><span class="lt-ic" aria-hidden="true">' + (TYPES[x.type] || TYPES.god)[0] + '</span>' +
        '<span class="lt-rm"><b>' + e(x.to || 'Untitled') + '</b><span class="hint">' + e(STYLES[x.style] || '') + ' · ' + e(x.date || '') + (x.auto ? ' · auto-send' : '') + '</span><span class="lt-snip">' + e(String(x.body || '').replace(/\s+/g, ' ').slice(0, 90)) + '</span></span></button></li>').join('');
      return '<div class="pw lt">' + head +
        '<div class="lt-new"><button type="button" class="btn small" data-act="lt-new" data-k="god">🙏 Postcard to God</button><button type="button" class="btn small" data-act="lt-new" data-k="pitr">🪔 Inland letter to the forefathers</button><button type="button" class="btn small" data-act="lt-new" data-k="family">✉️ Letter to family</button></div>' +
        svcLine() +
        '<div class="seg lt-seg" role="group" aria-label="Show">' + [['all', 'All'], ['god', 'God'], ['pitr', 'Forefathers'], ['family', 'Family']].map(x => '<button type="button" data-act="lt-filt" data-k="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
        '<div class="st-scroll scroll" data-keep-scroll="lt-list">' + (rows ? '<ul class="lt-list">' + rows + '</ul>' : '<div class="empty">' + ED.icon('mail') + '<div><b>' + (all.length ? 'No letters here.' : 'No letters yet.') + '</b>' + (all.length ? '' : '<br>Write a postcard to Bholenath, an inland letter to your forefathers, or a letter to your family.') + '</div></div>') + '</div></div>';
    },
    right() {
      const v = V();
      if (!v || !v.unlocked()) return '<div class="pw lt lt-r"><div class="lt-hero">' + (ED.watermark ? '<div class="lt-art">' + ED.watermark.svg('temple', '') + '</div>' : '') + '<h3>A letter to God, to your forefathers, to your family</h3><p class="hint">Write what is in your heart. Each letter is encrypted with your master password — no one can read it without it, not even someone holding your backups.</p></div></div>';
      const x = LT.sel && v.items.get(LT.sel);
      if (!x || x.kind !== 'letter') return '<div class="pw lt lt-r"><div class="lt-hero">' + (ED.watermark ? '<div class="lt-art">' + ED.watermark.svg('shiv', '') + '</div>' : '') + '<h3>Choose a letter to read it</h3><p class="hint">or write a new one on the left.</p></div></div>';
      const fam = x.type === 'family';
      return '<div class="pw lt lt-r"><div class="pg-head"><h2 class="pg-title">' + e((TYPES[x.type] || TYPES.god)[1]) + '</h2><span class="row-btns">' +
        (fam && x.email ? '<a class="btn small" href="' + e(mailto(x)) + '">' + ED.icon('mail') + 'Open in my email</a>' : '') +
        '<button type="button" class="btn small" data-act="lt-edit" data-id="' + e(x.id) + '">' + ED.icon('pencil') + 'Edit</button>' +
        '<button type="button" class="icon-btn" data-act="lt-del" data-id="' + e(x.id) + '" aria-label="Delete this letter" title="Delete">' + ED.icon('trash') + '</button></span></div>' +
        (fam ? '<label class="switch lt-auto"><input type="checkbox" data-change="lt-auto" data-id="' + e(x.id) + '"' + (x.auto ? ' checked' : '') + (x.email ? '' : ' disabled') + '><span class="track"></span><span>Send by itself if I do not open the diary for ' + (LT.svc().days || 15) + ' days' + (x.email ? '' : ' (add an email address first)') + '</span></label>' + (x.auto && !LT.svc().on ? '<p class="notice">Auto-send is not set up yet — <button type="button" class="link-btn" data-act="lt-svc">set up the letter keeper</button>.</p>' : '') : '') +
        '<div class="st-scroll scroll lt-read">' + LT.card(x) + '</div></div>';
    },
    mount() { const po = document.querySelector('#pw-open'); if (po) setTimeout(() => po.focus(), 50); },
  };
  ED.views = ED.views || {};
  ED.views.letters = view;

  /* ---------------- edit ---------------- */
  LT.edit = (id, type) => {
    const v = V(); if (!v || !v.unlocked()) { ED.ui.toast('Unlock the password log first'); return; }
    const old = id ? v.items.get(id) : null;
    type = old ? old.type : type || 'god';
    const d = DEF[type] || DEF.god;
    const x = old ? Object.assign({}, old) : { kind: 'letter', type, style: d.style, to: d.to, place: d.place, pic: d.pic, date: U.today(), body: d.open ? d.open + '\n\n' : '', sign: '', email: '', subject: '', auto: false };
    const fam = type === 'family';
    const opt = (list, cur) => list.map(o => '<option value="' + e(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + e(o[1]) + '</option>').join('');
    ED.ui.modal({
      title: (old ? 'Edit — ' : 'New — ') + (TYPES[type] || TYPES.god)[1].toLowerCase(), cls: 'st-modal wide lt-modal',
      body: '<div class="lt-form">' +
        '<div class="lt-f"><label class="lbl" for="lt-to">' + (fam ? 'Family member' : 'To') + '</label><input class="field" id="lt-to" maxlength="80" value="' + e(x.to || '') + '" placeholder="' + (fam ? 'e.g. Maa, Yaju, Bhaiya' : '') + '"></div>' +
        (fam ? '<div class="lt-f"><label class="lbl" for="lt-email">Their email</label><input class="field" id="lt-email" type="email" maxlength="120" value="' + e(x.email || '') + '" placeholder="name@example.com"></div>' +
          '<div class="lt-f wide"><label class="lbl" for="lt-subj">Subject</label><input class="field" id="lt-subj" maxlength="200" value="' + e(x.subject || '') + '" placeholder="A letter for you"></div>'
          : '<div class="lt-f"><label class="lbl" for="lt-place">Address</label><input class="field" id="lt-place" maxlength="80" value="' + e(x.place || '') + '"></div>' +
          '<div class="lt-f"><label class="lbl" for="lt-style">Write it as</label><select class="field" id="lt-style">' + opt([['postcard', 'Postcard'], ['inland', 'Inland letter']], x.style) + '</select></div>' +
          '<div class="lt-f"><label class="lbl" for="lt-pic">Picture</label><select class="field" id="lt-pic">' + opt([['', 'No picture']].concat(PICS), x.pic || '') + '</select></div>') +
        '<div class="lt-f"><label class="lbl" for="lt-date">Date</label><input class="field" id="lt-date" type="date" value="' + e(x.date || U.today()) + '"></div>' +
        '<div class="lt-f wide"><label class="lbl" for="lt-body">Letter</label><textarea class="field lt-ta" id="lt-body" rows="12" lang="hi-Latn">' + e(x.body || '') + '</textarea><span class="hint">Hindi and English both work. The letter is encrypted when you save.</span></div>' +
        '<div class="lt-f"><label class="lbl" for="lt-sign">Signed</label><input class="field" id="lt-sign" maxlength="80" value="' + e(x.sign || '') + '" placeholder="' + (fam ? 'With love, …' : 'आपका …') + '"></div>' +
        (fam ? '<div class="lt-f wide"><label class="switch"><input type="checkbox" id="lt-autoc"' + (x.auto ? ' checked' : '') + '><span class="track"></span><span>Send by itself if I do not open the diary for ' + (LT.svc().days || 15) + ' days</span></label></div>' : '') +
        '</div>',
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">' + ED.icon('lock') + 'Save (encrypted)</button>',
      sticky: true,
      onMount(el, api) {
        const val = s => { const n = el.querySelector(s); return n ? n.value.trim() : ''; };
        el.querySelector('[data-x="save"]').addEventListener('click', async () => {
          const to = val('#lt-to');
          if (!to) { ED.ui.toast(fam ? 'Whom is it for?' : 'To whom?'); el.querySelector('#lt-to').focus(); return; }
          const email = val('#lt-email');
          if (fam && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { ED.ui.toast('That email address does not look right'); el.querySelector('#lt-email').focus(); return; }
          const body = el.querySelector('#lt-body').value.replace(/\s+$/, '');
          if (!body.trim()) { ED.ui.toast('The letter is empty'); el.querySelector('#lt-body').focus(); return; }
          const ac = el.querySelector('#lt-autoc');
          const rec = Object.assign({}, x, {
            kind: 'letter', type, to, body, sign: val('#lt-sign'), date: val('#lt-date') || U.today(), updatedAt: Date.now(), createdAt: x.createdAt || Date.now(),
            style: fam ? 'email' : val('#lt-style') || 'postcard', place: fam ? '' : val('#lt-place'), pic: fam ? '' : val('#lt-pic'),
            email: fam ? email : '', subject: fam ? val('#lt-subj') : '', auto: fam ? !!(ac && ac.checked && email) : false,
          });
          delete rec.id;
          try {
            ED.store.checkpoint(old ? 'Edit letter' : 'New letter');
            const nid = await V().save(old ? old.id : U.uid('lt'), rec);
            LT.sel = nid; ED.store.commit({ reason: 'letter' });
            api.close(); ED.ui.toast('Letter saved — encrypted');
            if (fam && (rec.auto || (old && old.auto)) && LT.svc().on) LT.push();
          } catch (err) { ED.ui.toast('Could not save: ' + (err.message || err), { kind: 'err' }); }
        });
      },
    });
  };

  /* ---------------- letter keeper settings ---------------- */
  LT.setup = () => {
    const s = LT.svc();
    const tok = s.token || LT.token();
    const code = LT.script(tok);
    ED.ui.modal({
      title: 'Auto-send letters to family', cls: 'st-modal wide lt-modal',
      body: '<div class="sb-set">' +
        '<p>A web page cannot send email while it is closed, so a small script in <b>your own Google account</b> keeps the letters you mark and sends them with your Gmail if your diary is not opened on <b>any</b> device for the days you choose. It emails <b>you</b> a warning first.</p>' +
        '<p class="pw-warn">' + ED.icon('info') + '<span><b>Please read:</b> letters marked for auto-send are copied — readable — into that script in your Google account (only you can open it). Letters to God and the forefathers, and family letters not marked, never leave the encrypted log. If you are travelling without the diary for longer than the days you chose, the letters <b>will be sent</b> — choose the days with that in mind, or turn this off before a long trip.</span></p>' +
        '<div class="lt-days"><label class="lbl" for="lt-days">Send if the diary is not opened for</label><span><input class="field" id="lt-days" type="number" min="2" max="365" value="' + (s.days || 15) + '"> days</span>' +
        '<label class="lbl" for="lt-warn">Warn me by email</label><span><input class="field" id="lt-warn" type="number" min="0" max="30" value="' + (s.warn == null ? 3 : s.warn) + '"> days before</span></div>' +
        '<h3 class="set-h">Set up the letter keeper (about 5 minutes, once)</h3>' +
        '<ol class="sb-steps"><li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">script.google.com → New project</a>, signed in to the Google account whose Gmail should send the letters.</li>' +
        '<li>Delete what is in the editor, paste the script below (<b>Copy the script</b>) and press 💾 Save. It carries a secret code made for your diary.</li>' +
        '<li>At the top choose the function <b>setup</b> and press <b>▶ Run</b>. Allow it (Google shows “unverified app” for your own script: Advanced → Go to … (unsafe)). It asks to send email as you and to run a timer.</li>' +
        '<li><b>Deploy → New deployment</b> → ⚙ <b>Web app</b>. Execute as: <b>Me</b>. Who has access: <b>Anyone</b>. Deploy, then copy the <b>Web app URL</b> (ends in <code>/exec</code>) below.</li>' +
        '<li>Press <b>Test and turn on</b>. You get a test email; nothing is sent to your family.</li></ol>' +
        '<pre class="sb-code">' + e(code) + '</pre><div class="row-btns"><button type="button" class="btn small" data-x="copy">' + ED.icon('copy') + 'Copy the script</button>' + (s.token ? '<button type="button" class="btn small ghost" data-x="newtok" title="Makes a new secret code; paste the script again afterwards">New secret code</button>' : '') + '</div>' +
        '<label class="lbl" for="lt-url">Web app URL</label><input class="field" id="lt-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + e(s.url || '') + '">' +
        '<p class="hint" id="lt-out" aria-live="polite">' + (s.on ? 'Auto-send is on.' : 'Not on yet.') + '</p></div>',
      footer: (s.on ? '<button type="button" class="btn danger" data-x="off">Turn off and clear the keeper</button>' : '') + (s.on ? '<button type="button" class="btn" data-x="status">Check status</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Close</button><button type="button" class="btn primary" data-x="on">' + (s.on ? 'Save' : 'Test and turn on') + '</button>',
      onMount(el, api) {
        let token = tok;
        const out = el.querySelector('#lt-out');
        el.querySelector('[data-x="copy"]').addEventListener('click', async () => ED.ui.toast(await U.copy(LT.script(token)) ? 'Script copied — paste it into the Apps Script editor' : 'Could not copy — select the text and copy it'));
        const nt = el.querySelector('[data-x="newtok"]'); if (nt) nt.addEventListener('click', () => { token = LT.token(); el.querySelector('.sb-code').textContent = LT.script(token); out.textContent = 'New code made. Copy the script again, paste it over the old one, save and deploy a new version (Deploy → Manage deployments → ✎ → New version), then press Save.'; });
        const st = el.querySelector('[data-x="status"]');
        if (st) st.addEventListener('click', async () => {
          out.textContent = 'Asking your letter keeper…';
          try { const j = await LT.call('status'); out.textContent = 'Working. It holds ' + U.plural((j.letters || []).length, 'letter') + (j.letters && j.letters.length ? ' (' + j.letters.map(l => l.name).join(', ') + ')' : '') + '; last opened ' + (j.seen ? new Date(j.seen).toLocaleString() : '—') + '; sends after ' + j.days + ' days' + (j.timer ? '' : ' — but its timer is missing: run “setup” again in the script') + (j.sent ? '. Letters were sent on ' + new Date(j.sent).toLocaleString() : '') + '. Emails left today: ' + j.quota + '.'; }
          catch (err) { out.textContent = 'No answer (' + (err.message || err) + ').'; }
        });
        const off = el.querySelector('[data-x="off"]');
        if (off) off.addEventListener('click', async () => {
          const ok = await ED.ui.confirm({ title: 'Turn off auto-send', message: 'The letter keeper will forget the letters it holds and send nothing. Your letters stay in the diary.', ok: 'Turn off', danger: true });
          if (!ok) return;
          try { await LT.call('clear'); } catch (err) { /* offline: it still holds them; tell the user */ ED.ui.toast('Could not reach the letter keeper — it still holds the letters. Try again when online, or delete the script.', { kind: 'err' }); }
          ED.store.checkpoint('Auto-send off'); svcSet({ on: false, pending: false }); ED.store.commit(); api.close(); ED.app.render();
        });
        el.querySelector('[data-x="on"]').addEventListener('click', async () => {
          const url = el.querySelector('#lt-url').value.trim();
          const days = Math.max(2, Math.min(365, Math.round(+el.querySelector('#lt-days').value || 15)));
          const warn = Math.max(0, Math.min(days - 1, Math.round(+el.querySelector('#lt-warn').value || 0)));
          if (!okUrl(url)) { out.textContent = 'That is not an Apps Script web app address — it starts with https://script.google.com/macros/s/ and ends in /exec.'; return; }
          const next = Object.assign({}, LT.svc(), { url, token, days, warn });
          out.textContent = s.on ? 'Saving…' : 'Testing — a test email is on its way to you…';
          try {
            await LT.call(s.on ? 'ping' : 'test', null, next);
            if (!s.on) {
              const n = LT.autoList().length;
              const ok = await ED.ui.confirm({ title: 'Turn on auto-send?', message: 'If your diary is not opened on any device for ' + days + ' days, ' + (n ? U.plural(n, 'letter') + ' marked for auto-send will be' : 'the letters you mark for auto-send will be') + ' emailed from your Gmail' + (warn ? ', after a warning to you ' + warn + ' days before' : '') + '. Copies are kept in your Apps Script project.', ok: 'Turn on' });
              if (!ok) { out.textContent = 'It works, but auto-send stays off.'; return; }
            }
            ED.store.checkpoint('Auto-send letters'); D().letterSvc = Object.assign(next, { on: true }); ED.store.commit();
            try { localStorage.setItem(PING, String(Date.now())); } catch (err) { /* ignore */ }
            await LT.push();
            out.textContent = 'Done — auto-send is on.'; setTimeout(() => { api.close(); ED.app.render(); }, 900);
          } catch (err) { out.textContent = 'Did not work yet (' + (err.message || err) + '). Check that you ran “setup”, chose “Who has access: Anyone”, and copied the /exec address.'; }
        });
      },
    });
  };

  /* ---------------- actions ---------------- */
  A['lt-new'] = el => LT.edit(null, el.dataset.k);
  A['lt-edit'] = el => LT.edit(el.dataset.id);
  A['lt-sel'] = el => { LT.sel = el.dataset.id; if (V()) V().touch(); ED.app.render(); };
  A['lt-filt'] = el => { LT.filt = el.dataset.k; ED.app.render(); };
  A['lt-svc'] = () => LT.setup();
  A['lt-del'] = async el => {
    const x = V().items.get(el.dataset.id); if (!x) return;
    const ok = await ED.ui.confirm({ title: 'Delete this letter?', message: 'The letter to ' + (x.to || '…') + ' will be deleted. (Undo is possible right after.)', ok: 'Delete', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Delete letter');
    V().remove(x.id); if (LT.sel === x.id) LT.sel = null;
    ED.store.commit({ reason: 'letter' });
    if (x.auto) LT.push();
  };
  const C = (ED.changes = ED.changes || {});
  C['lt-auto'] = async el => {
    const x = V().items.get(el.dataset.id); if (!x) return;
    const rec = Object.assign({}, x, { auto: el.checked, updatedAt: Date.now() }); delete rec.id;
    ED.store.checkpoint('Letter auto-send');
    await V().save(x.id, rec); ED.store.commit({ reason: 'letter' });
    if (LT.svc().on) LT.push(); else if (el.checked) ED.ui.toast('Marked. Set up the letter keeper to make auto-send work.');
    ED.app.render();
  };

  /* ---------------- "I was opened" from every device ---------------- */
  setTimeout(() => LT.ping(), 4000);
  setInterval(() => { if (document.visibilityState === 'visible') LT.ping(); }, 30 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') LT.ping(); });
})();
