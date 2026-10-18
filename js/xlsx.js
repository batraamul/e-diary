/* E-Diary — read Excel workbooks (.xlsx) and CSV files in the browser, with no library.
   An .xlsx file is a zip of XML documents; we unzip it with the browser's DecompressionStream
   and read the sheets' cell values (formulas give their last calculated value). */
(function () {
  'use strict';
  const ED = window.ED;

  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const dec = new TextDecoder('utf-8');

  async function inflate(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open Excel files. Use a current Chrome, Edge, Firefox or Safari, or save the sheet as CSV.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* list the files inside a zip → Map(name → async () => Uint8Array) */
  function unzip(buf) {
    const b = new Uint8Array(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) { if (u32(b, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('This is not an Excel (.xlsx) file.');
    const count = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);
    const files = new Map();
    for (let n = 0; n < count; n++) {
      if (u32(b, p) !== 0x02014b50) break;
      const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), off = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      files.set(name, async () => {
        const start = off + 30 + u16(b, off + 26) + u16(b, off + 28);
        const data = b.subarray(start, start + csize);
        if (method === 0) return data;
        if (method === 8) return inflate(data);
        throw new Error('Unsupported compression in ' + name);
      });
      p += 46 + nlen + xlen + clen;
    }
    return files;
  }

  const xml = async (files, name) => {
    const f = files.get(name) || files.get(name.replace(/^\//, ''));
    if (!f) return null;
    return new DOMParser().parseFromString(dec.decode(await f()), 'application/xml');
  };
  const tags = (node, name) => Array.from(node.getElementsByTagName(name));
  const colIndex = ref => { let n = 0; const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

  /* read every sheet: [{ name, rows: [[value, …], …] }] — values are strings, numbers or booleans */
  async function readXlsx(buf) {
    const files = unzip(buf);
    const wb = await xml(files, 'xl/workbook.xml');
    if (!wb) throw new Error('This file has no workbook inside. Is it an .xlsx file?');
    const rels = await xml(files, 'xl/_rels/workbook.xml.rels');
    const target = {};
    if (rels) tags(rels, 'Relationship').forEach(r => { target[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const ssDoc = await xml(files, 'xl/sharedStrings.xml');
    const shared = ssDoc ? tags(ssDoc, 'si').map(si => tags(si, 't').filter(t => !t.closest || !t.closest('rPh')).map(t => t.textContent).join('')) : [];
    const out = [];
    for (const sh of tags(wb, 'sheet')) {
      const name = sh.getAttribute('name');
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let path = target[rid] || '';
      if (!path) continue;
      path = path.startsWith('/') ? path.slice(1) : 'xl/' + path.replace(/^\.\//, '');
      const doc = await xml(files, path);
      if (!doc) continue;
      const rows = [];
      tags(doc, 'row').forEach(row => {
        const ri = (+row.getAttribute('r') || rows.length + 1) - 1;
        const arr = [];
        tags(row, 'c').forEach((c, ci) => {
          const idx = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : ci;
          const t = c.getAttribute('t');
          const v = c.getElementsByTagName('v')[0];
          let val = null;
          if (t === 's') val = v ? shared[+v.textContent] : null;
          else if (t === 'inlineStr') val = tags(c, 't').map(x => x.textContent).join('');
          else if (t === 'str' || t === 'e') val = v ? v.textContent : null;
          else if (t === 'b') val = v ? v.textContent === '1' : null;
          else if (v) { const n = Number(v.textContent); val = isNaN(n) ? v.textContent : n; }
          if (val !== null && val !== '') arr[idx] = val;
        });
        rows[ri] = arr;
      });
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
      out.push({ name, rows });
    }
    return out;
  }

  /* CSV / TSV with quotes; the delimiter is guessed from the first line */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const counts = [',', ';', '\t'].map(d => [d, first.split(d).length]);
    counts.sort((a, b) => b[1] - a[1]);
    const D = counts[0][0];
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === D) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => { const t = c.trim(); return t !== '' && /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t; }));
  }

  const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCSV = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');

  /* Excel stores dates as days since 30 Dec 1899 */
  const excelDate = n => {
    if (typeof n !== 'number' || n < 20000 || n > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  };
  /* accepts 2026-10-05, 05/10/2026 (day first), 5 Oct 2026, Excel serial numbers */
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const anyDate = v => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return excelDate(v);
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    // day first (India): 05/10/2026, 5-10-26, 05.10.2026 10:22
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T]+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?)?$/.exec(s);
    if (m && +m[2] <= 12 && +m[1] <= 31) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
    // 05 Oct 2026, 5-Oct-26, 05 October, 2026
    m = /^(\d{1,2})[\s-]+([A-Za-z]{3})[a-z]*\.?,?[\s-]+(\d{2}|\d{4})(?:[ T]+\d{1,2}:\d{2}.*)?$/.exec(s);
    if (m && MON[m[2].toLowerCase()]) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + String(MON[m[2].toLowerCase()]).padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
    // Oct 5, 2026
    m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
    if (m && MON[m[1].toLowerCase()]) return m[3] + '-' + String(MON[m[1].toLowerCase()]).padStart(2, '0') + '-' + m[2].padStart(2, '0');
    return null;
  };

  /* open a File chosen by the person: .xlsx → sheets; .csv/.tsv/.txt → one sheet */
  async function readFile(file) {
    const name = file.name || 'file';
    if (/\.(xlsx|xlsm)$/i.test(name)) return readXlsx(await file.arrayBuffer());
    if (/\.xls$/i.test(name)) throw new Error('Old .xls files cannot be read. In Excel choose File → Save As → Excel Workbook (.xlsx), then import that.');
    const text = await file.text();
    return [{ name: name.replace(/\.[^.]+$/, ''), rows: parseCSV(text) }];
  }

  ED.xlsx = { readXlsx, readFile, parseCSV, toCSV, excelDate, anyDate, unzip };
})();
