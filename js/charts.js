/* E-Diary — small SVG/HTML charts shared by the progress pages (study, finance, tasks).
   Rules followed: thin bars (≤ 24px) with 4px rounded ends on a single baseline, 2px lines, recessive grid,
   a legend whenever there are two series, a hover/focus tooltip on every mark, and a "Show the numbers" table.
   Colours come from CSS variables (--s1…--s8 categorical, --accent, --chart-track), so light and dark both work. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;

  const niceMax = v => {
    if (!(v > 0)) return 4;
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  };
  /* finer tops for small quantities such as hours in a day */
  const fineMax = v => v <= 0.5 ? 0.5 : v <= 1 ? 1 : v <= 2 ? 2 : v <= 3 ? 3 : v <= 4 ? 4 : v <= 6 ? 6 : v <= 8 ? 8 : niceMax(v);
  const r1 = v => Math.round(v * 10) / 10;
  const compact = v => {
    const a = Math.abs(v);
    if (a >= 1e7) return r1(v / 1e7) + ' Cr';
    if (a >= 1e5) return r1(v / 1e5) + ' L';
    if (a >= 1e3) return r1(v / 1e3) + 'K';
    return String(r1(v));
  };
  /* rounded top, square at the baseline */
  const barPath = (x, y0, y1, w) => {
    const h = y1 - y0; if (h <= 0.5) return '';
    const r = Math.min(4, h, w / 2);
    return 'M' + x + ' ' + y1 + 'V' + (y0 + r) + 'Q' + x + ' ' + y0 + ' ' + (x + r) + ' ' + y0 + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y0 + ' ' + (x + w) + ' ' + (y0 + r) + 'V' + y1 + 'Z';
  };

  function figure(o, svg) {
    return '<figure class="chart' + (o.cls ? ' ' + o.cls : '') + '"><figcaption><span class="gh">' + e(o.title) + '</span>' + (o.legend || '') + '</figcaption>' +
      (o.tools ? '<div class="chart-tools">' + o.tools + '</div>' : '') +
      (o.sub ? '<p class="chart-sub hint">' + o.sub + '</p>' : '') +
      '<div class="chart-box">' + svg + '<div class="chart-tip" hidden></div></div>' + (o.table || '') + '</figure>';
  }
  function table(head, rows) {
    return '<details class="chart-table"><summary>Show the numbers</summary><div class="ct-scroll"><table><thead><tr>' + head.map(h => '<th>' + e(h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i ? ' class="num"' : '') + '>' + e(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></details>';
  }
  const legend = items => '<span class="legend">' + items.map(it => '<i class="lg-' + it.kind + '" style="--c:' + it.color + '"></i>' + e(it.label)).join(' ') + '</span>';

  const CH = (ED.charts = { niceMax, fineMax, compact, table, legend, figure });

  /* ---------- columns: value per period, optional "planned" drawn as a pale track behind ---------- */
  CH.columns = o => {
    const data = o.data;
    const W = o.w || 640, H = o.h || 220, L = o.left || 40, R = 10, T = 16, B = 28;
    const top = Math.max(o.fine ? 0.5 : 1, ...data.map(d => Math.max(d.value || 0, d.total || 0)));
    const max = o.fine ? fineMax(top) : niceMax(top);
    const band = (W - L - R) / Math.max(1, data.length);
    const bw = Math.max(3, Math.min(24, band * 0.6));
    const y = v => T + (H - T - B) * (1 - v / max);
    const fmt = o.fmt || compact;
    let g = '';
    [0, max / 2, max].forEach(t => { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="tick" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + e(fmt(t)) + '</text>'; });
    const every = Math.max(1, Math.ceil(data.length / (o.maxLabels || 8)));
    data.forEach((d, i) => {
      const x = L + band * i + (band - bw) / 2;
      const cur = i === o.cur;
      g += '<g class="col' + (cur ? ' cur' : '') + (d.future ? ' future' : '') + '" tabindex="0" role="img" aria-label="' + e(d.aria || (d.label + ': ' + d.tip)) + '" data-tip="' + e(d.tip || fmt(d.value)) + '" data-tipl="' + e(d.long || d.label) + '">' +
        '<rect class="hit" x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '"/>' +
        (d.total != null ? '<path class="b-total" d="' + barPath(x, y(d.total), y(0), bw) + '"/>' : '') +
        '<path class="b-done" d="' + barPath(x, y(Math.max(0, d.value || 0)), y(0), bw) + '"' + (o.color ? ' style="fill:' + o.color + '"' : '') + '/>' +
        (cur && o.capCur ? '<text class="cap" x="' + (x + bw / 2) + '" y="' + (y(Math.max(d.value || 0, d.total || 0)) - 6) + '" text-anchor="middle">' + e(o.capCur(d)) + '</text>' : '') +
        ((data.length - 1 - i) % every === 0 ? '<text class="xl" x="' + (x + bw / 2) + '" y="' + (H - 9) + '" text-anchor="middle">' + e(d.label) + '</text>' : '') +
        '</g>';
    });
    g += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wk-chart" role="group" aria-label="' + e(o.title) + '">' + g + '</svg>';
    return figure(o, svg);
  };

  /* ---------- paired columns: two series side by side per period (e.g. income vs expenses) ---------- */
  CH.pairs = o => {
    const data = o.data;
    const W = o.w || 640, H = o.h || 220, L = o.left || 44, R = 10, T = 16, B = 28;
    const max = niceMax(Math.max(1, ...data.map(d => Math.max(d.a || 0, d.b || 0))));
    const band = (W - L - R) / Math.max(1, data.length);
    const bw = Math.max(3, Math.min(16, band * 0.32));
    const y = v => T + (H - T - B) * (1 - v / max);
    const fmt = o.fmt || compact;
    let g = '';
    [0, max / 2, max].forEach(t => { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="tick" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + e(fmt(t)) + '</text>'; });
    const every = Math.max(1, Math.ceil(data.length / (o.maxLabels || 12)));
    data.forEach((d, i) => {
      const cx = L + band * i + band / 2;
      g += '<g class="col' + (i === o.cur ? ' cur' : '') + '" tabindex="0" role="img" aria-label="' + e(d.long + ': ' + d.tip) + '" data-tip="' + e(d.tip) + '" data-tipl="' + e(d.long) + '">' +
        '<rect class="hit" x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '"/>' +
        '<path class="b-a" d="' + barPath(cx - bw - 1, y(Math.max(0, d.a || 0)), y(0), bw) + '"/>' +
        '<path class="b-b" d="' + barPath(cx + 1, y(Math.max(0, d.b || 0)), y(0), bw) + '"/>' +
        ((data.length - 1 - i) % every === 0 ? '<text class="xl" x="' + cx + '" y="' + (H - 9) + '" text-anchor="middle">' + e(d.label) + '</text>' : '') + '</g>';
    });
    g += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    return figure(o, '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wk-chart pairs" role="group" aria-label="' + e(o.title) + '">' + g + '</svg>');
  };

  /* ---------- grouped columns: up to four series side by side per period (fixed colour order) ---------- */
  CH.groups = o => {
    const data = o.data, ser = o.series;   // data: [{label, long, values:[…], tip}], series: [{name, color}]
    const k = ser.length;
    const W = o.w || 640, H = o.h || 230, L = o.left || 46, R = 10, T = 16, B = 28;
    const max = niceMax(Math.max(1, ...data.map(d => Math.max(...d.values.map(v => v || 0)))));
    const band = (W - L - R) / Math.max(1, data.length);
    const bw = Math.max(2, Math.min(14, (band * 0.8 - (k - 1) * 2) / k));
    const y = v => T + (H - T - B) * (1 - v / max);
    const fmt = o.fmt || compact;
    let g = '';
    [0, max / 2, max].forEach(t => { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="tick" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + e(fmt(t)) + '</text>'; });
    const every = Math.max(1, Math.ceil(data.length / (o.maxLabels || 12)));
    data.forEach((d, i) => {
      const cx = L + band * i + band / 2, x0 = cx - (k * bw + (k - 1) * 2) / 2;
      g += '<g class="col' + (i === o.cur ? ' cur' : '') + '" tabindex="0" role="img" aria-label="' + e((d.long || d.label) + ': ' + d.tip) + '" data-tip="' + e(d.tip) + '" data-tipl="' + e(d.long || d.label) + '">' +
        '<rect class="hit" x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '"/>' +
        d.values.map((v, j) => '<path class="b-g" style="fill:' + ser[j].color + '" d="' + barPath(x0 + j * (bw + 2), y(Math.max(0, v || 0)), y(0), bw) + '"/>').join('') +
        ((data.length - 1 - i) % every === 0 ? '<text class="xl" x="' + cx + '" y="' + (H - 9) + '" text-anchor="middle">' + e(d.label) + '</text>' : '') + '</g>';
    });
    g += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    return figure(o, '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wk-chart pairs" role="group" aria-label="' + e(o.title) + '">' + g + '</svg>');
  };

  /* ---------- lines: one or more cumulative series with a crosshair tooltip ---------- */
  CH.lines = o => {
    const labels = o.labels, series = o.series;
    const n = labels.length;
    const W = o.w || 640, H = o.h || 230, L = o.left || 40, R = 16, T = 16, B = 28;
    const all = [];
    series.forEach(s => s.points.forEach(v => { if (v != null) all.push(v); }));
    const rg = o.range;                  // a shaded spread between two series, e.g. bad case to good case: {lo, hi, color, name}
    if (rg) [rg.lo, rg.hi].forEach(a => a.forEach(v => { if (v != null) all.push(v); }));
    const lo = Math.min(0, ...all);
    const max = o.yMax || niceMax(Math.max(1, ...all));
    const min = lo < 0 ? -niceMax(-lo) : 0;
    const x = i => L + (n <= 1 ? 0 : (W - L - R) * i / (n - 1));
    const y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
    const fmt = o.fmt || compact;
    let g = '';
    const ticks = [];
    [0, max, min, max / 2].forEach(t => { if (t < min || t > max || ticks.some(u => Math.abs(y(u) - y(t)) < 14)) return; ticks.push(t); });   // no labels on top of each other
    ticks.forEach(t => { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="tick" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + e(fmt(t)) + '</text>'; });
    if (o.bands) o.bands.forEach(b => { g += '<rect class="band" x="' + x(b.a) + '" y="' + T + '" width="' + Math.max(2, x(b.b) - x(b.a)) + '" height="' + (H - T - B) + '"/>'; });
    if (rg) {
      let up = '', down = '';
      rg.hi.forEach((v, i) => { up += (up ? 'L' : 'M') + x(i) + ' ' + y(v); });
      for (let i = rg.lo.length - 1; i >= 0; i--) down += 'L' + x(i) + ' ' + y(rg.lo[i]);
      g += '<path class="ln-range" style="fill:' + (rg.color || 'var(--s1)') + '" d="' + up + down + 'Z"/>';
    }
    if (o.marker != null && o.marker >= 0 && o.marker < n) g += '<line class="today-rule" x1="' + x(o.marker) + '" x2="' + x(o.marker) + '" y1="' + T + '" y2="' + y(min) + '"/><text class="today-l" x="' + (x(o.marker) > W - 70 ? x(o.marker) - 4 : x(o.marker) + 4) + '" y="' + (T + 10) + '"' + (x(o.marker) > W - 70 ? ' text-anchor="end"' : '') + '>' + e(o.markerLabel || 'Today') + '</text>';
    series.forEach(s => {
      if (s.area) {
        let d = ''; let started = false, lastI = 0, firstI = 0;
        s.points.forEach((v, i) => { if (v == null) return; if (!started) { firstI = i; d += 'M' + x(i) + ' ' + y(0) + 'L' + x(i) + ' ' + y(v); started = true; } else d += 'L' + x(i) + ' ' + y(v); lastI = i; });
        if (started) g += '<path class="ln-area" style="fill:' + s.color + '" d="' + d + 'L' + x(lastI) + ' ' + y(0) + 'Z"/>';
      }
      let d = ''; let pen = false;
      s.points.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i) + ' ' + y(v); pen = true; });
      g += '<path class="ln' + (s.muted ? ' muted' : '') + (s.dash ? ' dash' : '') + '" style="stroke:' + s.color + '" d="' + d + '"/>';
      // end dot + direct label on the last real value
      let li = -1; s.points.forEach((v, i) => { if (v != null) li = i; });
      if (li >= 0 && s.endLabel !== false) {
        g += '<circle class="ln-dot" cx="' + x(li) + '" cy="' + y(s.points[li]) + '" r="4" style="fill:' + s.color + '"/>';
      }
    });
    if (o.marks) o.marks.forEach(m => { if (m.i == null || m.i < 0 || m.i >= n) return; const cx = x(m.i), cy = y(0); g += '<path class="ln-mark" d="M' + cx + ' ' + (cy - 7) + 'L' + (cx + 5) + ' ' + cy + 'L' + cx + ' ' + (cy + 7) + 'L' + (cx - 5) + ' ' + cy + 'Z"' + (m.color ? ' style="fill:' + m.color + '"' : '') + '/>'; });
    const every = Math.max(1, Math.ceil(n / (o.maxLabels || 9)));
    const band = n <= 1 ? (W - L - R) : (W - L - R) / (n - 1);
    labels.forEach((lb, i) => {
      const tip = series.map(s => s.name + ': ' + (s.points[i] == null ? '—' : (o.tipFmt || fmt)(s.points[i]))).join(' · ') +
        (rg ? ' · ' + (rg.name || 'Range') + ': ' + (o.tipFmt || fmt)(rg.lo[i]) + ' to ' + (o.tipFmt || fmt)(rg.hi[i]) : '');
      g += '<g class="col" tabindex="0" role="img" aria-label="' + e(lb + ': ' + tip) + '" data-tip="' + e(tip) + '" data-tipl="' + e((o.long && o.long[i]) || lb) + '">' +
        '<rect class="hit" x="' + (x(i) - band / 2) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '"/>' +
        '<line class="xh" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + y(min) + '"/>' +
        ((n - 1 - i) % every === 0 ? '<text class="xl" x="' + x(i) + '" y="' + (H - 9) + '" text-anchor="middle">' + e(lb) + '</text>' : '') + '</g>';
    });
    g += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    return figure(o, '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wk-chart lines" role="group" aria-label="' + e(o.title) + '">' + g + '</svg>');
  };

  /* ---------- horizontal meters: done vs planned per row (HTML, so labels never clip) ---------- */
  CH.meters = o => {
    const rows = o.rows;
    const max = o.max || Math.max(1, ...rows.map(r => Math.max(r.total || 0, r.value || 0)));
    const body = rows.map(r => {
      const pct = Math.max(0, Math.min(100, (r.value || 0) / max * 100));
      const tot = r.total != null ? Math.max(0, Math.min(100, r.total / max * 100)) : null;
      const over = r.total != null && r.value > r.total && r.over;
      return '<div class="mt-row" tabindex="0" data-tip="' + e(r.tip || '') + '" data-tipl="' + e(r.label) + '">' +
        '<span class="mt-l">' + (r.swatch ? '<i class="sw" style="--c:' + r.swatch + '"></i>' : '') + '<span class="mt-name">' + e(r.label) + '</span></span>' +
        '<span class="mt-bar">' + (tot != null ? '<i class="mt-total" style="width:' + tot + '%"></i>' : '') + '<i class="mt-val' + (over ? ' over' : '') + '" style="width:' + pct + '%' + (r.color ? ';background:' + r.color : '') + '"></i></span>' +
        '<span class="mt-v num">' + e(r.valueLabel) + '</span></div>';
    }).join('');
    return figure(Object.assign({}, o, { cls: 'meters' + (o.cls ? ' ' + o.cls : '') }), '<div class="mt">' + body + '</div>');
  };

  /* ---------- calendar heatmap: one square per day, weeks as columns ---------- */
  CH.heat = o => {
    const days = o.days; // [{k, v: 0..1 | null (no plan), tip}]
    if (!days.length) return '';
    const ws = o.weekStart || 0;
    const first = U.startOfWeek(days[0].k, ws);
    const byK = new Map(days.map(d => [d.k, d]));
    const last = days[days.length - 1].k;
    const cols = Math.floor(U.diffDays(first, last) / 7) + 1;
    const C = 13, G = 3, L = 30, T = 16;
    const W = L + cols * (C + G), H = T + 7 * (C + G);
    let g = '';
    for (let c = 0; c < cols; c++) {
      const wk = U.addDays(first, c * 7);
      let lab = c === 0 ? days[0].k : null;
      for (let r = 0; r < 7; r++) { const k = U.addDays(wk, r); if (k.slice(8) === '01' && k >= days[0].k && k <= last) lab = k; }
      if (lab && !(c === 1 && days[0].k.slice(8) > '24')) g += '<text class="xl" x="' + (L + c * (C + G)) + '" y="' + (T - 5) + '">' + U.MON[+lab.slice(5, 7) - 1] + '</text>';
      for (let r = 0; r < 7; r++) {
        const k = U.addDays(wk, r);
        const d = byK.get(k);
        if (!d) continue;
        const lvl = d.v == null ? 'none' : d.future ? 'future' : d.v <= 0 ? 0 : d.v < 0.34 ? 1 : d.v < 0.67 ? 2 : d.v < 1 ? 3 : 4;
        g += '<rect class="hm hm-' + lvl + (d.k === U.today() ? ' today' : '') + '" x="' + (L + c * (C + G)) + '" y="' + (T + r * (C + G)) + '" width="' + C + '" height="' + C + '" rx="3" tabindex="-1" data-tip="' + e(d.tip || '') + '" data-tipl="' + e(U.fmtLong(k)) + '"' + (o.act ? ' data-act="' + o.act + '" data-date="' + k + '"' + (o.go ? ' data-go="' + o.go + '"' : '') : '') + '/>';
      }
    }
    for (let r = 0; r < 7; r += 2) g += '<text class="tick" x="' + (L - 6) + '" y="' + (T + r * (C + G) + 10) + '" text-anchor="end">' + U.DAY3[(ws + r) % 7].slice(0, 2) + '</text>';
    const key = '<span class="legend hm-key">Less <i class="hm-sw hm-0"></i><i class="hm-sw hm-1"></i><i class="hm-sw hm-2"></i><i class="hm-sw hm-3"></i><i class="hm-sw hm-4"></i> More</span>';
    return figure(Object.assign({}, o, { legend: key, cls: 'heat' }), '<div class="hm-scroll"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" class="wk-chart hm-chart" role="img" aria-label="' + e(o.title) + '">' + g + '</svg></div>');
  };

  /* ---------- tooltips for every chart inside root ---------- */
  CH.bind = root => {
    U.$$('.chart-box', root).forEach(box => {
      if (box.dataset.bound) return;
      box.dataset.bound = '1';
      const tip = box.querySelector('.chart-tip');
      if (!tip) return;
      const show = el => {
        tip.innerHTML = '';
        const v = document.createElement('b'); v.textContent = el.dataset.tip;
        const l = document.createElement('span'); l.textContent = el.dataset.tipl || '';
        tip.appendChild(v); tip.appendChild(l); tip.hidden = false;
        const r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
        const tw = tip.offsetWidth || 160;
        tip.style.left = Math.min(br.width - tw, Math.max(0, r.left - br.left + r.width / 2 - tw / 2)) + 'px';
        tip.style.top = Math.max(tip.offsetHeight, r.top - br.top - 6) + 'px';
        box.querySelectorAll('.hover').forEach(c => c.classList.remove('hover'));
        el.classList.add('hover');
      };
      const hide = () => { tip.hidden = true; box.querySelectorAll('.hover').forEach(c => c.classList.remove('hover')); };
      box.addEventListener('pointerover', ev => { const el = ev.target.closest('[data-tip]'); if (el && box.contains(el) && el.dataset.tip) show(el); });
      box.addEventListener('focusin', ev => { const el = ev.target.closest('[data-tip]'); if (el && el.dataset.tip) show(el); });
      box.addEventListener('focusout', hide);
      box.addEventListener('pointerleave', hide);
    });
  };
})();
