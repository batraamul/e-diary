/* E-Diary — utilities: dates, formatting, HTML safety, files */
(function () {
  'use strict';
  const ED = (window.ED = window.ED || {});
  const U = (ED.util = {});
  ED.VERSION = '1.15.0';

  /* ---------------- environment ---------------- */
  ED.env = {
    claude: !!(window.claude && typeof window.claude.use === 'function'),
    file: location.protocol === 'file:',
    http: /^https?:$/.test(location.protocol),
    framed: (function () { try { return window.self !== window.top; } catch (e) { return true; } })(),
    mac: /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || ''),
    touch: !!(window.matchMedia && matchMedia('(hover: none)').matches),
  };
  ED.session = Math.random().toString(36).slice(2, 10);

  /* ---------------- dates (keys are local 'YYYY-MM-DD') ---------------- */
  U.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  U.MON = U.MONTHS.map(m => m.slice(0, 3));
  U.DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  U.DAY3 = U.DAYS.map(d => d.slice(0, 3));

  U.pad = n => (n < 10 ? '0' : '') + n;
  U.key = d => d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  U.parse = k => { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  U.isKey = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
  U.today = () => U.key(new Date());
  U.addDays = (k, n) => { const d = U.parse(k); d.setDate(d.getDate() + n); return U.key(d); };
  U.daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate();
  U.addMonths = (k, n) => {
    const d = U.parse(k); const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, U.daysInMonth(d.getFullYear(), d.getMonth())));
    return U.key(d);
  };
  U.diffDays = (a, b) => Math.round((U.parse(b) - U.parse(a)) / 864e5);
  U.dow = k => U.parse(k).getDay();
  U.ymd = k => String(k).split('-').map(Number);
  U.firstOfMonth = k => String(k).slice(0, 8) + '01';
  U.startOfWeek = (k, ws) => U.addDays(k, -((U.dow(k) - (ws || 0) + 7) % 7));
  U.range = (a, n) => Array.from({ length: n }, (_, i) => U.addDays(a, i));
  U.weekNumber = (k, ws) => {
    if (ws === 1) { // ISO-8601
      const d = U.parse(k); const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day + 3);
      const t = new Date(d.getFullYear(), 0, 4); const td = (t.getDay() + 6) % 7;
      t.setDate(t.getDate() - td + 3);
      return 1 + Math.round((d - t) / (7 * 864e5));
    }
    // Sunday weeks: the week holding 1 January is week 1
    const sw = U.startOfWeek(k, 0);
    const nextJan = (U.parse(sw).getFullYear() + 1) + '-01-01';
    const toNext = U.diffDays(sw, nextJan);
    if (toNext >= 0 && toNext < 7) return 1;
    const y = U.parse(U.addDays(sw, 6)).getFullYear();
    const w1 = U.startOfWeek(y + '-01-01', 0);
    return Math.floor(U.diffDays(w1, sw) / 7) + 1;
  };
  U.monthGrid = (y, m0, ws) => {
    const first = U.key(new Date(y, m0, 1));
    return U.range(U.startOfWeek(first, ws), 42);
  };

  U.fmtLong = k => { const d = U.parse(k); return U.DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + U.MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  U.fmtShort = k => { if (!k) return ''; const d = U.parse(k); return d.getDate() + ' ' + U.MON[d.getMonth()] + ' ' + d.getFullYear(); };
  U.fmtDM = k => { const d = U.parse(k); return d.getDate() + ' ' + U.MON[d.getMonth()]; };
  U.fmtMD = k => { const d = U.parse(k); return U.MON[d.getMonth()] + ' ' + d.getDate(); };
  U.fmtNum = k => { if (!k) return ''; const [y, m, d] = U.ymd(k); return d + '/' + m + '/' + y; };
  U.fmtMonthYear = k => { const d = U.parse(k); return U.MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  U.fmtRange = (a, b) => {
    const A = U.parse(a), B = U.parse(b);
    if (A.getFullYear() === B.getFullYear() && A.getMonth() === B.getMonth())
      return U.MONTHS[A.getMonth()] + ' ' + A.getDate() + ' - ' + B.getDate();
    if (A.getFullYear() === B.getFullYear())
      return U.MON[A.getMonth()] + ' ' + A.getDate() + ' - ' + U.MON[B.getMonth()] + ' ' + B.getDate();
    return U.MON[A.getMonth()] + ' ' + A.getDate() + ', ' + A.getFullYear() + ' - ' + U.MON[B.getMonth()] + ' ' + B.getDate() + ', ' + B.getFullYear();
  };
  U.relDay = k => {
    const t = U.today(); if (k === t) return 'Today';
    if (k === U.addDays(t, 1)) return 'Tomorrow';
    if (k === U.addDays(t, -1)) return 'Yesterday';
    return U.fmtDM(k) + (k.slice(0, 4) !== t.slice(0, 4) ? ' ' + k.slice(0, 4) : '');
  };
  U.toMin = t => { if (!t) return 0; const p = t.split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
  U.fromMin = n => { n = Math.max(0, Math.min(24 * 60 - 1, Math.round(n))); return U.pad(Math.floor(n / 60)) + ':' + U.pad(n % 60); };
  U.nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  U.fmtTime = (t, h12) => {
    if (!t) return '';
    let h = +t.split(':')[0]; const m = +t.split(':')[1] || 0;
    if (h12 === false) return U.pad(h) + ':' + U.pad(m);
    const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12;
    return h + ':' + U.pad(m) + ' ' + ap;
  };
  U.fmtStamp = ms => { if (!ms) return ''; const d = new Date(ms); return U.fmtShort(U.key(d)) + ', ' + U.fmtTime(U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()), true); };

  /* ---------------- misc ---------------- */
  U.uid = (p) => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.plural = (n, w, pl) => n + ' ' + (n === 1 ? w : (pl || w + 's'));
  U.debounce = (fn, ms) => {
    let t = null;
    const d = function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => { t = null; fn.apply(self, a); }, ms); };
    d.flush = () => { if (t) { clearTimeout(t); t = null; fn(); } };
    d.cancel = () => { clearTimeout(t); t = null; };
    return d;
  };
  U.clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  U.lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } };
  U.lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  U.lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  /* ---------------- HTML safety ---------------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);

  const parseDoc = html => new DOMParser().parseFromString('<!doctype html><body>' + (html || '') + '</body>', 'text/html');
  U.stripHtml = html => {
    if (!html) return '';
    if (html.indexOf('<') < 0 && html.indexOf('&') < 0) return html;
    const doc = parseDoc(String(html).replace(/<(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '$&\n'));
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  };

  const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'BR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI',
    'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'IMG', 'A', 'HR', 'PRE', 'CODE', 'SUB', 'SUP', 'FONT', 'MARK', 'SMALL', 'INPUT', 'LABEL', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH']);
  const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'FORM', 'BUTTON', 'SELECT', 'TEXTAREA', 'VIDEO', 'AUDIO', 'CANVAS', 'HEAD']);
  const OK_STYLE = /^(color|background-color|font-size|font-weight|font-style|text-decoration|text-decoration-line|text-align|text-transform|width|max-width|float|margin-left|margin-right|letter-spacing)$/;
  U.sanitize = html => {
    if (!html) return '';
    const doc = parseDoc(html);
    const walk = node => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) { ch.remove(); return; }
        const tag = ch.tagName;
        if (DROP_TAGS.has(tag)) { ch.remove(); return; }
        if (!OK_TAGS.has(tag)) { walk(ch); ch.replaceWith.apply(ch, Array.from(ch.childNodes)); return; }
        if (tag === 'INPUT' && (ch.getAttribute('type') || '').toLowerCase() !== 'checkbox') { ch.remove(); return; }
        Array.from(ch.attributes).forEach(a => {
          const n = a.name.toLowerCase(), v = (a.value || '').trim();
          if (n === 'style') {
            const out = [];
            v.split(';').forEach(decl => {
              const i = decl.indexOf(':'); if (i < 0) return;
              const p = decl.slice(0, i).trim().toLowerCase(), val = decl.slice(i + 1).trim();
              if (OK_STYLE.test(p) && !/url\s*\(|expression|javascript:|@import/i.test(val)) out.push(p + ': ' + val);
            });
            if (out.length) ch.setAttribute('style', out.join('; ')); else ch.removeAttribute('style');
            return;
          }
          let keep = false;
          if (tag === 'A' && n === 'href') keep = /^(https?:|mailto:|tel:|#)/i.test(v);
          else if (tag === 'IMG' && n === 'src') keep = /^(data:image\/(png|jpe?g|gif|webp);base64,|https:\/\/|blob:)/i.test(v);
          else if (tag === 'IMG' && (n === 'alt' || n === 'width' || n === 'height')) keep = true;
          else if (tag === 'FONT' && (n === 'color' || n === 'size')) keep = true;
          else if (tag === 'INPUT' && (n === 'type' || n === 'checked')) keep = true;
          else if ((tag === 'TD' || tag === 'TH') && (n === 'colspan' || n === 'rowspan')) keep = true;
          else if (n === 'align' || n === 'dir') keep = true;
          else if (n === 'class' && /^(ed-[a-z0-9-]+\s*)+$/.test(v)) keep = true;
          if (!keep) ch.removeAttribute(a.name);
        });
        if (tag === 'A') { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
        if (tag === 'INPUT') ch.setAttribute('disabled', '');
        walk(ch);
      });
    };
    walk(doc.body);
    return doc.body.innerHTML;
  };

  /* highlight a query inside already-escaped text */
  U.mark = (text, q) => {
    const safe = U.esc(text);
    if (!q) return safe;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + ')', 'ig');
    return safe.replace(re, '<mark>$1</mark>');
  };

  /* ---------------- clipboard ---------------- */
  U.copy = async text => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  };

  /* ---------------- files ---------------- */
  U.download = async (filename, data, mime) => {
    if (ED.env.claude) {
      let dl = null;
      try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
      if (dl) {
        try { await dl.save({ filename, data }); return true; }
        catch (e) {
          if (e && e.code === 'declined') return false;
          if (e && e.code === 'rejected_extension') { ED.ui && ED.ui.toast('This file type can’t be saved from this page.'); return false; }
        }
      }
    }
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) {
      ED.ui && ED.ui.toast('Download failed: ' + e.message);
      return false;
    }
  };

  U.pickFile = (accept, multiple) => new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; if (accept) inp.accept = accept; if (multiple) inp.multiple = true;
    inp.style.position = 'fixed'; inp.style.left = '-9999px';
    document.body.appendChild(inp);
    let done = false;
    inp.addEventListener('change', () => { done = true; resolve(multiple ? Array.from(inp.files) : inp.files[0] || null); inp.remove(); });
    window.addEventListener('focus', function f() {
      window.removeEventListener('focus', f);
      setTimeout(() => { if (!done) { resolve(null); inp.remove(); } }, 1200);
    });
    inp.click();
  });
  U.readText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
  U.readDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });

  /* shrink photos so the diary stays small enough to save and sync */
  U.imageToDataURL = async (file, maxDim, quality) => {
    maxDim = maxDim || 1100; quality = quality || 0.82;
    const src = await U.readDataURL(file);
    if (/image\/(gif|svg)/.test(file.type) && file.size < 400000) return src;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 250000) return src;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    const png = file.type === 'image/png' && file.size < 300000;
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality);
  };

  U.bytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';

  /* ---------------- DOM helpers ---------------- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.isTyping = el => {
    el = el || document.activeElement;
    if (!el) return false;
    const t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  };
})();
