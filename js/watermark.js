/* E-Diary — 1.24: a very light picture behind the Daily page's notes (the right-hand page of the Planner).
   Original line drawings (made for this diary — no photographs), chosen for the day:
     festivals first (Maha Shivaratri, Ganesh Chaturthi, Navratri and Durga Ashtami, Diwali and Dhanteras, Kartik
     Purnima / Dev Deepawali, Janmashtami, Ram Navami and Dussehra, Hanuman Jayanti, Holi, Guru Purnima),
     then the days of the Armed Forces (Army Day 15 Jan, Republic Day 26 Jan, Kargil Vijay Diwas 26 Jul, Independence
     Day 15 Aug, Air Force Day 8 Oct, Navy Day 4 Dec, Vijay Diwas 16 Dec), then the month (Shravan → Shiva), then the
     weekday — mostly the Shiv Pariwar: Monday Shiva at Kailash, Tuesday Hanuman (Rudra), Wednesday Ganesh, Thursday
     a Shiva temple, Friday Parvati (Gauri), Saturday the Armed Forces and Intelligence by turns, Sunday Surya and
     Kartikeya by turns. Each carries a short line in Sanskrit / Hindi.
   1.24.1: about 40 drawings, the weekday's family changing every week (so no two days in a row look alike), three layouts,
   the weekday's navagraha yantra (3 × 3 magic square) in the corner, your own pictures (luck.pics) in turn, and a line at the
   foot of the page with the mantra of the day (29 in turn), the graha mantra and the day's numbers (WM.today).
   Settings → Appearance → "Light picture on the Daily page" (settings.watermark) and "Mantra and numbers" (settings.luckLine). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const WM = (ED.watermark = {});
  const S = () => ED.store.data.settings;
  const g = (inner, w) => '<g fill="none" stroke="currentColor" stroke-width="' + (w || 3) + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g>';
  const leaf = (x, y, r) => '<path transform="rotate(' + r + ' ' + x + ' ' + y + ')" d="M' + x + ' ' + y + 'Q' + (x - 12) + ' ' + (y - 22) + ' ' + x + ' ' + (y - 40) + 'Q' + (x + 12) + ' ' + (y - 22) + ' ' + x + ' ' + y + 'Z"/>';
  const rays = (cx, cy, r1, r2, n) => { let s = ''; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; s += '<path d="M' + (cx + r1 * Math.cos(a)).toFixed(1) + ' ' + (cy + r1 * Math.sin(a)).toFixed(1) + 'L' + (cx + r2 * Math.cos(a)).toFixed(1) + ' ' + (cy + r2 * Math.sin(a)).toFixed(1) + '"/>'; } return s; };
  const spokes = (cx, cy, r, n) => rays(cx, cy, 0, r, n);
  const trishul = (x, top, bot) => '<path d="M' + x + ' ' + bot + 'L' + x + ' ' + (top + 40) + '"/><path d="M' + x + ' ' + (top + 48) + 'L' + x + ' ' + top + 'M' + (x - 6) + ' ' + (top + 12) + 'L' + x + ' ' + top + 'L' + (x + 6) + ' ' + (top + 12) + '"/>' +
    '<path d="M' + x + ' ' + (top + 52) + 'Q' + (x - 32) + ' ' + (top + 48) + ' ' + (x - 28) + ' ' + (top + 6) + 'M' + (x - 33) + ' ' + (top + 16) + 'L' + (x - 28) + ' ' + (top + 4) + 'L' + (x - 21) + ' ' + (top + 15) + '"/>' +
    '<path d="M' + x + ' ' + (top + 52) + 'Q' + (x + 32) + ' ' + (top + 48) + ' ' + (x + 28) + ' ' + (top + 6) + 'M' + (x + 33) + ' ' + (top + 16) + 'L' + (x + 28) + ' ' + (top + 4) + 'L' + (x + 21) + ' ' + (top + 15) + '"/>';
  const damru = (x, y) => '<path d="M' + (x - 14) + ' ' + y + 'L' + (x + 14) + ' ' + y + 'L' + x + ' ' + (y + 16) + 'Z M' + (x - 14) + ' ' + (y + 32) + 'L' + (x + 14) + ' ' + (y + 32) + 'L' + x + ' ' + (y + 16) + 'Z"/><path d="M' + (x + 14) + ' ' + (y + 16) + 'q14 6 10 22"/>';
  const lotus = (cx, cy, s) => { s = s || 1; const p = (dx, w, h) => '<path d="M' + cx + ' ' + cy + 'Q' + (cx + dx - w * s) + ' ' + (cy - h * s * .55) + ' ' + (cx + dx) + ' ' + (cy - h * s) + 'Q' + (cx + dx + w * s) + ' ' + (cy - h * s * .55) + ' ' + cx + ' ' + cy + 'Z"/>'; return p(0, 18, 70) + p(-34 * s, 16, 52) + p(34 * s, 16, 52) + p(-62 * s, 12, 30) + p(62 * s, 12, 30) + '<path d="M' + (cx - 80 * s) + ' ' + (cy + 4) + 'Q' + cx + ' ' + (cy + 26 * s) + ' ' + (cx + 80 * s) + ' ' + (cy + 4) + '"/>'; };
  const diya = (cx, cy, s) => { s = s || 1; return '<path d="M' + (cx - 34 * s) + ' ' + cy + 'Q' + cx + ' ' + (cy + 34 * s) + ' ' + (cx + 34 * s) + ' ' + cy + 'L' + (cx + 44 * s) + ' ' + (cy - 6 * s) + 'L' + (cx - 34 * s) + ' ' + cy + 'Z"/><path d="M' + cx + ' ' + (cy - 6 * s) + 'Q' + (cx - 12 * s) + ' ' + (cy - 26 * s) + ' ' + cx + ' ' + (cy - 48 * s) + 'Q' + (cx + 12 * s) + ' ' + (cy - 26 * s) + ' ' + cx + ' ' + (cy - 6 * s) + 'Z"/>'; };
  const kalash = (cx, cy) => '<path d="M' + (cx - 40) + ' ' + cy + 'Q' + (cx - 62) + ' ' + (cy - 50) + ' ' + (cx - 24) + ' ' + (cy - 78) + 'L' + (cx + 24) + ' ' + (cy - 78) + 'Q' + (cx + 62) + ' ' + (cy - 50) + ' ' + (cx + 40) + ' ' + cy + 'Z"/><path d="M' + (cx - 30) + ' ' + (cy - 78) + 'L' + (cx - 34) + ' ' + (cy - 88) + 'L' + (cx + 34) + ' ' + (cy - 88) + 'L' + (cx + 30) + ' ' + (cy - 78) + '"/>' +
    '<ellipse cx="' + cx + '" cy="' + (cy - 108) + '" rx="20" ry="22"/>' + leaf(cx - 22, cy - 92, -60) + leaf(cx + 22, cy - 92, 60) + leaf(cx - 10, cy - 92, -25) + leaf(cx + 10, cy - 92, 25) +
    '<path d="M' + (cx - 10) + ' ' + (cy - 46) + 'h20M' + cx + ' ' + (cy - 56) + 'v20M' + (cx - 10) + ' ' + (cy - 56) + 'v10M' + (cx + 10) + ' ' + (cy - 36) + 'v-10M' + (cx - 10) + ' ' + (cy - 36) + 'h10M' + (cx + 10) + ' ' + (cy - 56) + 'h-10"/>';
  const peaks = '<path d="M10 175 L80 92 L118 130 L178 46 L236 122 L276 86 L390 175"/><path d="M178 46 L166 76 L182 70 L192 86 M80 92 L74 112 L88 106" stroke-width="2"/>';
  const moon = (x, y, r) => '<path d="M' + x + ' ' + (y - r) + 'A' + r + ' ' + r + ' 0 1 0 ' + (x + r * .7) + ' ' + (y + r * .72) + 'A' + (r * .78) + ' ' + (r * .78) + ' 0 1 1 ' + x + ' ' + (y - r) + 'Z"/>';
  const ART = {
    shiv: () => g(peaks + moon(330, 50, 22) +
      '<ellipse cx="200" cy="330" rx="118" ry="22"/><path d="M318 332 L372 338 L368 350 L316 346"/><path d="M90 334 L96 362 L304 362 L310 334"/>' +
      '<path d="M152 330 L152 254 Q152 206 200 206 Q248 206 248 254 L248 330"/><path d="M166 250 Q200 243 234 250 M166 262 Q200 255 234 262 M166 274 Q200 267 234 274" stroke-width="2.5"/><circle cx="200" cy="262" r="5"/>' +
      leaf(200, 204, 0) + leaf(196, 206, -42) + leaf(204, 206, 42) + '<path d="M150 312 Q175 296 200 312 T250 312"/>' + trishul(56, 150, 362) + damru(56, 210)),
    ganesh: () => g('<path d="M160 102 Q200 74 240 102"/><path d="M166 98 L178 64 L192 84 L200 58 L208 84 L222 64 L234 98"/>' +
      '<path d="M150 108 Q200 94 250 108 Q262 148 246 182 Q226 198 200 198 Q174 198 154 182 Q138 148 150 108 Z"/>' +
      '<path d="M152 118 Q94 104 86 160 Q86 214 140 206 Q150 194 155 182"/><path d="M248 118 Q306 104 314 160 Q314 214 260 206 Q250 194 245 182"/>' +
      '<path d="M172 142 Q180 136 188 142 M212 142 Q220 136 228 142"/><path d="M200 112 L200 128" stroke-width="4"/>' +
      '<path d="M200 160 Q197 200 204 230 Q214 272 188 286 Q164 296 160 276 Q158 262 172 262"/><path d="M216 190 Q236 204 229 222"/>' +
      '<path d="M152 206 Q122 262 142 322 Q200 352 258 322 Q278 262 248 206"/><circle cx="118" cy="262" r="15"/><path d="M110 252 L118 240 L126 252"/>' +
      '<path d="M130 346 Q200 374 270 346"/>'),
    temple: () => g('<path d="M20 200 L110 130 L150 160 L210 100 L290 160 L330 130 L390 200" stroke-width="2" opacity=".6"/>' +
      '<path d="M120 316 L120 214 Q128 136 200 82 Q272 136 280 214 L280 316"/><path d="M134 170 Q200 150 266 170 M126 206 Q200 186 274 206 M124 244 Q200 226 276 244" stroke-width="2"/>' +
      '<ellipse cx="200" cy="80" rx="24" ry="8"/><path d="M192 72 Q200 48 208 72"/><path d="M200 50 L200 14"/><path d="M200 16 L238 24 L200 32 Z"/>' +
      '<path d="M76 316 L76 262 L126 244 M324 316 L324 262 L274 244"/><path d="M180 316 L180 272 Q200 250 220 272 L220 316"/>' +
      '<path d="M60 316 L340 316 M48 330 L352 330 M36 344 L364 344"/><path d="M200 250 L200 258"/><circle cx="200" cy="264" r="6"/>'),
    hanuman: () => g('<path d="M110 350 L226 172" stroke-width="7"/><path d="M104 360 L118 338"/><ellipse transform="rotate(-57 250 136)" cx="250" cy="136" rx="58" ry="42"/>' +
      '<path transform="rotate(-57 250 136)" d="M196 136 L304 136 M206 112 Q250 102 294 112 M206 160 Q250 170 294 160" stroke-width="2"/><path d="M276 82 L292 58"/><circle cx="294" cy="54" r="6"/>' +
      '<path d="M70 360 L70 100"/><path d="M70 104 L156 128 L70 156 Z"/>' + '<text x="95" y="138" font-size="22" text-anchor="middle" stroke="none" fill="currentColor" font-family="var(--font-deva)">राम</text>'),
    parvati: () => g(lotus(200, 300, 1.4) + kalash(200, 236) + trishul(70, 120, 340) + '<path d="M300 140 L330 110 M300 110 L330 140 M315 100 L315 150 M290 125 L340 125" stroke-width="2"/>'),
    surya: () => g('<circle cx="200" cy="170" r="70"/><circle cx="200" cy="170" r="54" stroke-width="2"/>' + rays(200, 170, 82, 128, 16) + rays(200, 170, 84, 108, 32).replace(/stroke-width/g, 'sw') +
      '<path d="M60 330 Q130 300 200 330 T340 330 M80 352 Q140 328 200 352 T320 352" stroke-width="2"/>'),
    kartikeya: () => g('<path d="M200 380 L200 120"/><path d="M200 128 Q164 92 200 30 Q236 92 200 128 Z"/><path d="M186 136 L214 136"/>' +
      '<path d="M280 360 Q262 240 300 140"/><ellipse transform="rotate(14 304 132)" cx="304" cy="132" rx="26" ry="38"/><ellipse transform="rotate(14 304 132)" cx="304" cy="132" rx="12" ry="18"/>' +
      '<path d="M284 170 l-26 -10 M286 196 l-28 -6 M290 222 l-28 -2 M292 248 l-28 2 M322 168 l24 -12 M320 196 l26 -8 M318 224 l26 -4"/>'),
    diya: () => g(diya(110, 290, 1) + diya(200, 270, 1.3) + diya(290, 290, 1) + '<circle cx="200" cy="140" r="78" stroke-width="2"/><circle cx="200" cy="140" r="50" stroke-width="2"/>' + rays(200, 140, 50, 78, 12) + '<circle cx="200" cy="140" r="14"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i / 8 * 2 * Math.PI; return '<circle cx="' + (200 + 92 * Math.cos(a)).toFixed(1) + '" cy="' + (140 + 92 * Math.sin(a)).toFixed(1) + '" r="5"/>'; }).join('')),
    krishna: () => g('<path d="M60 300 L330 170" stroke-width="10"/><path d="M60 300 L330 170" stroke="var(--paper,#fff)" stroke-width="5"/>' + [0, 1, 2, 3, 4, 5].map(i => '<circle cx="' + (130 + i * 30) + '" cy="' + (266 - i * 14.5) + '" r="3"/>').join('') +
      '<path d="M300 380 Q280 250 316 120"/><ellipse transform="rotate(10 320 112)" cx="320" cy="112" rx="28" ry="42"/><ellipse transform="rotate(10 320 112)" cx="320" cy="112" rx="13" ry="20"/><path d="M302 160 l-26 -8 M300 190 l-28 -4 M298 220 l-28 0 M334 160 l24 -10 M332 190 l26 -6"/>'),
    ram: () => g('<path d="M120 40 Q40 200 120 360"/><path d="M120 40 L120 360" stroke-width="2"/><path d="M60 200 L330 200"/><path d="M330 200 L304 186 M330 200 L304 214"/><path d="M60 200 L46 188 M60 200 L46 212 M74 200 L60 188 M74 200 L60 212"/>' +
      '<path d="M250 300 L250 340 L280 360 M250 340 L220 360"/><circle cx="250" cy="280" r="4"/>'),
    forces: () => g('<path d="M60 380 L60 40"/><path d="M60 46 Q120 30 180 46 Q240 62 300 46 L300 166 Q240 182 180 166 Q120 150 60 166" /><path d="M60 86 Q120 70 180 86 Q240 102 300 86 M60 126 Q120 110 180 126 Q240 142 300 126" stroke-width="2"/>' +
      '<circle cx="180" cy="106" r="14" stroke-width="2"/>' + spokes(180, 106, 14, 24).replace(/<path/g, '<path stroke-width="0.8"') +
      '<path d="M120 250 L280 360 M280 250 L120 360" stroke-width="5"/><path d="M116 246 L132 238 M284 246 L268 238"/>' +
      '<path d="M200 220 L200 262 M188 230 L212 230"/><path d="M180 254 Q200 278 220 254"/>' +
      '<path d="M300 224 L360 210 L374 216 L360 222 L300 236 L292 250 L284 236 L262 232 L268 226 L292 224 L300 210 Z" stroke-width="2"/>'),
    intel: () => g('<circle cx="200" cy="190" r="140" stroke-width="1.5"/><circle cx="200" cy="190" r="104" stroke-width="1.5"/><circle cx="200" cy="190" r="68" stroke-width="1.5"/>' +
      '<path d="M60 190 L340 190 M200 50 L200 330" stroke-width="1.2"/><path d="M200 190 L300 92" stroke-width="2.5"/><path d="M200 190 L300 92 A140 140 0 0 1 340 190 Z" stroke-width="0" fill="currentColor" opacity=".25"/>' +
      '<path d="M130 190 Q200 130 270 190 Q200 250 130 190 Z"/><circle cx="200" cy="190" r="22"/><circle cx="200" cy="190" r="8" fill="currentColor"/>' +
      '<circle cx="268" cy="120" r="4" fill="currentColor"/><circle cx="118" cy="252" r="3" fill="currentColor"/>'),
  };
  const LINES = {
    shiv: 'ॐ नमः शिवाय', ganesh: 'ॐ गं गणपतये नमः', temple: 'हर हर महादेव', hanuman: 'ॐ हं हनुमते नमः', parvati: 'ॐ उमायै नमः', surya: 'ॐ सूर्याय नमः', kartikeya: 'ॐ स्कन्दाय नमः',
    diya: 'शुभं करोति कल्याणम्', krishna: 'ॐ नमो भगवते वासुदेवाय', ram: 'श्री राम जय राम जय जय राम', forces: 'वयं राष्ट्रे जागृयाम', intel: 'धर्मो रक्षति रक्षितः',
  };
  /* ---------------- 1.24.1: many more drawings, so every day has its own ---------------- */
  const T = (x, y, s, t, extra) => '<text x="' + x + '" y="' + y + '" font-size="' + s + '" text-anchor="middle" stroke="none" fill="currentColor" font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, Nirmala UI, Kohinoor Devanagari, Mangal, serif"' + (extra || '') + '>' + t + '</text>';
  const bigLeaf = (x, y, r, s) => '<path transform="rotate(' + r + ' ' + x + ' ' + y + ') scale(1)" d="M' + x + ' ' + y + 'Q' + (x - 40 * s) + ' ' + (y - 60 * s) + ' ' + x + ' ' + (y - 130 * s) + 'Q' + (x + 40 * s) + ' ' + (y - 60 * s) + ' ' + x + ' ' + y + 'Z M' + x + ' ' + y + 'L' + x + ' ' + (y - 122 * s) + '"/>';
  const waves = (y0, n, amp) => { let s = ''; for (let i = 0; i < n; i++) { const y = y0 + i * 18; s += '<path d="M40 ' + y + ' q20 -' + amp + ' 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke-width="2"/>'; } return s; };
  const ring = (cx, cy, r, n, rr) => { let s = ''; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; s += '<circle cx="' + (cx + r * Math.cos(a)).toFixed(1) + '" cy="' + (cy + r * Math.sin(a)).toFixed(1) + '" r="' + rr + '"/>'; } return s; };
  const petals = (cx, cy, r1, r2, n) => { let s = ''; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, b = (i + .5) / n * 2 * Math.PI, c = (i + 1) / n * 2 * Math.PI, P = (rr, t) => (cx + rr * Math.cos(t)).toFixed(1) + ' ' + (cy + rr * Math.sin(t)).toFixed(1); s += '<path d="M' + P(r1, a) + ' Q' + P(r2 * 1.08, b) + ' ' + P(r1, c) + '"/>'; } return s; };
  const jet = (x, y, s) => '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 0 L60 -6 L74 0 L60 6 Z M30 -3 L18 -26 L28 -26 L44 -4 M30 3 L18 26 L28 26 L44 4 M4 -1 L-6 -10 L0 -10 L10 -2 M4 1 L-6 10 L0 10 L10 2" stroke-width="2"/>';
  Object.assign(ART, {
    kedar: () => g(peaks + '<path d="M130 340 L130 232 L270 232 L270 340"/><path d="M118 232 L200 150 L282 232 Z"/><path d="M146 206 L254 206 M168 184 L232 184" stroke-width="2"/>' +
      '<path d="M200 150 L200 112"/><circle cx="200" cy="106" r="6"/><path d="M180 340 L180 282 Q200 262 220 282 L220 340"/><path d="M146 252 h20 v24 h-20 Z M234 252 h20 v24 h-20 Z" stroke-width="2"/>' +
      '<path d="M96 340 L304 340 M84 356 L316 356 M72 372 L328 372"/><path d="M200 112 L232 120 L200 128" stroke-width="2"/>'),
    nandi: () => g('<path d="M112 322 Q104 256 168 244 Q198 220 232 242 L292 252 Q324 262 322 322 Z"/><path d="M198 224 Q214 206 236 226" stroke-width="2"/>' +
      '<path d="M112 306 Q78 296 82 258 Q88 232 112 238 Q128 262 124 296"/><path d="M92 240 Q80 214 96 200 M114 238 Q124 212 142 206"/><path d="M86 254 l-14 -6 M118 252 l14 -8" stroke-width="2"/>' +
      '<path d="M96 280 Q104 292 116 282" stroke-width="2"/><circle cx="120" cy="312" r="8"/><path d="M110 300 Q120 310 132 298" stroke-width="2"/>' +
      '<path d="M146 322 Q156 302 182 312 M252 322 Q264 302 288 314"/><path d="M322 290 Q346 300 340 330"/><path d="M70 336 L350 336 M88 352 L332 352"/>' + T(200, 160, 40, 'ॐ', ' opacity=".8"')),
    bilva: () => g(bigLeaf(200, 290, 0, 1.15) + bigLeaf(196, 294, -62, 1) + bigLeaf(204, 294, 62, 1) + '<path d="M200 292 Q204 340 186 380"/>' + ring(200, 200, 150, 36, 2.2)),
    rudraksha: () => g('<circle cx="200" cy="190" r="128" stroke-width="1"/>' + ring(200, 190, 128, 36, 8) + '<circle cx="200" cy="336" r="20"/><path d="M186 326 Q200 340 214 326 M184 340 Q200 354 216 340" stroke-width="2"/>' +
      '<path d="M200 356 L200 392 M192 358 L184 394 M208 358 L216 394" stroke-width="2"/>' + T(200, 210, 64, 'ॐ', ' opacity=".7"')),
    ganga: () => g(moon(320, 70, 26) + '<path d="M60 70 Q140 110 120 170 Q100 230 200 250" stroke-width="2"/>' + waves(260, 5, 8) +
      diya(150, 252, .6) + diya(250, 268, .6) + '<path d="M40 360 h320 M60 376 h280 M80 392 h240" stroke-width="2"/>'),
    trishul: () => g('<path d="M200 390 L200 120"/><path d="M200 128 Q140 120 148 40 M140 58 L148 38 L160 56 M200 128 Q260 120 252 40 M240 56 L252 38 L260 58 M200 120 L200 26 M188 46 L200 24 L212 46" stroke-width="4"/>' +
      damru(200, 160) + '<path d="M214 176 Q260 200 236 250 Q212 290 250 320" stroke-width="2"/>' + ring(200, 210, 170, 24, 2)),
    om: () => g('<circle cx="200" cy="190" r="150" stroke-width="1.5"/><circle cx="200" cy="190" r="134" stroke-width="1"/>' + petals(200, 190, 150, 182, 16) + T(200, 250, 170, 'ॐ')),
    sanjeevani: () => g('<path d="M100 250 L170 150 L210 200 L250 130 L320 250 Z"/>' + leaf(170, 150, -20) + leaf(250, 130, 20) + leaf(210, 200, 0) + leaf(140, 210, -30) + leaf(280, 210, 30) +
      '<path d="M60 270 Q200 300 340 270 M80 292 Q200 318 320 292" stroke-width="2"/><path d="M40 120 h50 M30 150 h40 M50 180 h50 M310 100 h60 M330 130 h40" stroke-width="2"/>' + T(200, 370, 30, 'जय बजरंगबली')),
    ramnaam: () => g('<circle cx="200" cy="200" r="150" stroke-width="1.5"/>' + Array.from({ length: 12 }, (_, i) => { const a = i / 12 * 2 * Math.PI; return T((200 + 118 * Math.cos(a)).toFixed(1), (210 + 118 * Math.sin(a)).toFixed(1), 22, 'राम'); }).join('') +
      '<path d="M150 260 Q120 200 150 140 M150 140 L250 200 M150 260 L150 140" stroke-width="3"/>' + '<path d="M150 200 L270 200 M270 200 l-14 -8 M270 200 l-14 8"/>'),
    modak: () => g([[150, 300], [250, 300], [200, 230]].map(p => '<path d="M' + p[0] + ' ' + (p[1] - 70) + ' Q' + (p[0] - 48) + ' ' + (p[1] - 6) + ' ' + p[0] + ' ' + p[1] + ' Q' + (p[0] + 48) + ' ' + (p[1] - 6) + ' ' + p[0] + ' ' + (p[1] - 70) + 'Z M' + p[0] + ' ' + (p[1] - 70) + ' L' + (p[0] - 16) + ' ' + (p[1] - 4) + ' M' + p[0] + ' ' + (p[1] - 70) + ' L' + (p[0] + 16) + ' ' + (p[1] - 4) + ' M' + p[0] + ' ' + (p[1] - 70) + ' L' + p[0] + ' ' + p[1] + '" stroke-width="2.5"/>').join('') +
      '<ellipse cx="200" cy="312" rx="130" ry="26"/><path d="M90 320 Q200 380 310 320"/>' + leaf(120, 120, -30) + leaf(140, 110, 0) + leaf(160, 120, 30) + T(270, 130, 40, 'श्री')),
    shubh: () => g('<path d="M200 110 L200 270 M120 190 L280 190 M200 110 L250 110 M280 190 L280 240 M200 270 L150 270 M120 190 L120 140" stroke-width="7"/>' + ring(200, 190, 48, 4, 7).replace(/<circle/g, '<circle transform="rotate(45 200 190)"') +
      T(90, 340, 44, 'शुभ') + T(310, 340, 44, 'लाभ') + '<rect x="40" y="40" width="320" height="330" rx="18" stroke-width="1.5"/>'),
    shankh: () => g('<path d="M110 260 Q90 170 170 120 Q250 80 300 140 Q330 190 280 230 Q240 262 190 250 Q150 244 130 280 Z"/><path d="M170 140 Q230 120 270 160 M160 170 Q220 150 260 190 M150 205 Q205 190 245 222" stroke-width="2"/>' +
      '<path d="M110 260 Q96 300 120 316 Q140 300 130 280" stroke-width="2"/><circle cx="300" cy="310" r="50"/><circle cx="300" cy="310" r="14"/>' + rays(300, 310, 14, 50, 12) + rays(300, 310, 52, 62, 24)),
    tulsi: () => g('<path d="M120 380 L130 270 L270 270 L280 380 Z M110 270 h180 M140 300 h120 M150 330 h100" stroke-width="2.5"/><path d="M200 270 L200 120"/>' +
      [[200, 120, 0], [190, 160, -50], [210, 150, 50], [186, 200, -60], [214, 190, 60], [190, 240, -70], [210, 236, 70]].map(l => leaf(l[0], l[1], l[2])).join('') + diya(200, 330, .55)),
    peepal: () => g('<path d="M200 380 L200 320"/><path d="M200 320 Q60 280 90 170 Q120 90 200 120 Q280 90 310 170 Q340 280 200 320 Z"/><path d="M200 120 Q200 60 214 30" stroke-width="2.5"/>' +
      '<path d="M200 320 L200 130 M200 280 L140 230 M200 280 L260 230 M200 240 L130 190 M200 240 L270 190 M200 200 L140 150 M200 200 L260 150" stroke-width="1.8"/>'),
    guru: () => g('<path d="M200 300 Q140 270 70 290 L70 180 Q140 160 200 190 Q260 160 330 180 L330 290 Q260 270 200 300 Z M200 190 L200 300"/><path d="M90 210 Q140 196 180 212 M90 236 Q140 222 180 238 M220 212 Q260 196 310 210 M220 238 Q260 222 310 236" stroke-width="1.8"/>' +
      diya(200, 120, .9) + rays(200, 90, 40, 62, 10) + T(200, 360, 30, 'गुरुर्ब्रह्मा गुरुर्विष्णुः')),
    lakshmi: () => g(lotus(200, 320, 1.3) + ring(200, 140, 70, 7, 14) + Array.from({ length: 7 }, (_, i) => { const a = i / 7 * 2 * Math.PI; return T((200 + 70 * Math.cos(a)).toFixed(1), (146 + 70 * Math.sin(a)).toFixed(1), 14, '₹'); }).join('') + T(200, 160, 46, 'श्री')),
    shriyantra: () => g('<rect x="40" y="30" width="320" height="320" stroke-width="2"/><rect x="54" y="44" width="292" height="292" stroke-width="1.5"/><path d="M170 30 v-14 h60 v14 M170 350 v14 h60 v-14 M40 160 h-14 v60 h14 M360 160 h14 v60 h-14" stroke-width="2"/>' +
      '<circle cx="200" cy="190" r="132" stroke-width="1.5"/>' + petals(200, 190, 112, 132, 16) + '<circle cx="200" cy="190" r="112" stroke-width="1.2"/>' + petals(200, 190, 92, 112, 8) + '<circle cx="200" cy="190" r="92" stroke-width="1.2"/>' +
      '<path d="M200 102 L278 236 L122 236 Z M200 278 L122 144 L278 144 Z M200 122 L262 222 L138 222 Z M200 258 L138 158 L262 158 Z M200 150 L240 210 L160 210 Z M200 230 L160 170 L240 170 Z" stroke-width="1.5"/><circle cx="200" cy="190" r="4" fill="currentColor"/>'),
    navy: () => g('<path d="M200 90 L200 300"/><circle cx="200" cy="76" r="14"/><path d="M160 120 h80"/><path d="M110 250 Q120 320 200 330 Q280 320 290 250 M110 250 l-16 10 M110 250 l6 18 M290 250 l16 10 M290 250 l-6 18"/>' + waves(352, 3, 8) +
      '<path d="M300 150 L370 150 L360 170 L310 170 Z M330 150 L330 120 L340 130" stroke-width="2"/>'),
    army: () => g('<path d="M20 330 L110 200 L160 250 L240 120 L330 260 L380 330 Z"/><path d="M240 120 L240 40"/><path d="M240 44 Q270 34 300 44 L300 92 Q270 82 240 92 M240 60 Q270 50 300 60 M240 76 Q270 66 300 76" stroke-width="2"/>' +
      '<circle cx="270" cy="68" r="6" stroke-width="1.2"/>' + T(200, 380, 34, 'विजय भव')),
    airforce: () => g(jet(140, 110, 1.4) + jet(60, 190, 1.1) + jet(220, 190, 1.1) + '<path d="M40 120 Q100 116 140 110 M-10 196 Q40 192 60 190 M150 196 Q190 192 220 190" stroke-width="1.5" stroke-dasharray="6 6"/>' +
      '<circle cx="200" cy="300" r="56"/><circle cx="200" cy="300" r="36"/><circle cx="200" cy="300" r="14" fill="currentColor" opacity=".5"/>' + T(200, 390, 26, 'नभः स्पृशं दीप्तम्')),
    satellite: () => g('<circle cx="200" cy="260" r="110"/><path d="M90 260 Q200 300 310 260 M90 260 Q200 220 310 260 M200 150 Q160 260 200 370 M200 150 Q240 260 200 370" stroke-width="1.5"/>' +
      '<ellipse cx="200" cy="260" rx="170" ry="60" transform="rotate(-20 200 260)" stroke-width="1.2" stroke-dasharray="5 7"/><rect x="280" y="70" width="40" height="30" transform="rotate(-20 300 85)"/><path d="M220 98 l60 -14 M320 76 l60 -14" stroke-width="2"/><rect x="216" y="80" width="62" height="34" transform="rotate(-20 247 97)" stroke-width="1.5"/><rect x="322" y="56" width="62" height="34" transform="rotate(-20 353 73)" stroke-width="1.5"/>'),
    radar: () => g('<path d="M120 300 Q120 200 220 160 L250 230 Z"/><path d="M185 210 L260 120"/><circle cx="262" cy="116" r="6"/><path d="M280 96 Q300 110 296 132 M296 76 Q328 100 318 142 M314 58 Q354 92 340 152" stroke-width="2"/>' +
      '<path d="M170 250 L150 340 M150 340 L230 340 L210 250" stroke-width="2.5"/><path d="M80 340 h240" />' + T(200, 390, 26, 'सर्वे भवन्तु सुखिनः')),
    konark: () => g('<circle cx="200" cy="200" r="150" stroke-width="5"/><circle cx="200" cy="200" r="132"/><circle cx="200" cy="200" r="26"/>' + rays(200, 200, 26, 132, 8).replace(/<path/g, '<path stroke-width="7"') + rays(200, 200, 30, 132, 16).replace(/<path/g, '<path stroke-width="1.5"') + ring(200, 200, 141, 32, 3)),
    sunrise: () => g('<path d="M70 260 A130 130 0 0 1 330 260"/>' + rays(200, 260, 150, 196, 24).split('/>').filter((r, i) => i >= 12 && i < 25).map(r => r + '/>').join('') + waves(272, 5, 7) + '<path d="M90 120 q10 -10 20 0 q10 -10 20 0 M240 90 q8 -8 16 0 q8 -8 16 0" stroke-width="2"/>'),
    navdurga: () => g(Array.from({ length: 9 }, (_, i) => diya(60 + i * 35, 330 - Math.round(Math.sin(i / 8 * Math.PI) * 80), .5)).join('') + trishul(200, 70, 220) + T(200, 395, 30, 'जय माता दी')),
    toran: () => g('<path d="M30 60 Q200 120 370 60" stroke-width="2.5"/>' + Array.from({ length: 11 }, (_, i) => { const x = 50 + i * 30, y = 60 + Math.round(Math.sin(i / 10 * Math.PI) * 26); return leaf(x, y + 44, 180); }).join('') + diya(200, 300, 1.4) + rays(200, 250, 70, 92, 16)),
  });
  Object.assign(LINES, {
    kedar: 'जय बाबा केदार', nandi: 'ॐ तत्पुरुषाय विद्महे', bilva: 'त्रिदलं त्रिगुणाकारं', rudraksha: 'ॐ नमः शिवाय', ganga: 'हर हर गंगे', trishul: 'हर हर महादेव', om: 'ॐ',
    sanjeevani: 'ॐ हं हनुमते नमः', ramnaam: 'श्री राम जय राम जय जय राम', modak: 'गणपति बप्पा मोरया', shubh: 'शुभ लाभ', shankh: 'ॐ नमो नारायणाय', tulsi: 'तुलसी माता की जय',
    peepal: 'मूलतो ब्रह्मरूपाय', guru: 'ॐ बृहस्पतये नमः', lakshmi: 'ॐ श्रीं महालक्ष्म्यै नमः', shriyantra: 'ॐ श्रीं ह्रीं श्रीं', navy: 'शं नो वरुणः', army: 'सेवा परमो धर्मः',
    airforce: 'नभः स्पृशं दीप्तम्', satellite: 'वयं राष्ट्रे जागृयाम', radar: 'धर्मो रक्षति रक्षितः', konark: 'ॐ आदित्याय नमः', sunrise: 'ॐ सूर्याय नमः', navdurga: 'ॐ दुं दुर्गायै नमः', toran: 'शुभ दीपावली',
  });
  WM.ART = ART;

  /* ---------------- which drawing on which day ---------------- */
  const POOL = {
    0: ['surya', 'kartikeya', 'konark', 'sunrise', 'surya', 'om'],                                  // Sunday — Surya, Kartikeya
    1: ['shiv', 'kedar', 'nandi', 'bilva', 'rudraksha', 'trishul', 'ganga', 'om'],                  // Monday — Shiva
    2: ['hanuman', 'sanjeevani', 'ramnaam', 'hanuman', 'trishul'],                                  // Tuesday — Hanuman
    3: ['ganesh', 'modak', 'shubh', 'ganesh', 'om'],                                                // Wednesday — Ganesh
    4: ['temple', 'guru', 'peepal', 'shankh', 'tulsi', 'kedar'],                                    // Thursday — Guru, temples
    5: ['parvati', 'lakshmi', 'shriyantra', 'navdurga', 'parvati', 'lakshmi'],                      // Friday — Devi, Lakshmi
    6: ['forces', 'intel', 'navy', 'army', 'airforce', 'satellite', 'radar'],                       // Saturday — Armed Forces & Intelligence
  };
  const FEST = [
    [/Shivaratri/, ['shiv', 'rudraksha', 'bilva', 'trishul'], 'ॐ नमः शिवाय · महाशिवरात्रि'], [/Ganesh/, ['ganesh', 'modak'], 'गणपति बप्पा मोरया'],
    [/Navratri|Durga Ashtami|Maha Navami/, ['navdurga', 'parvati', 'shriyantra'], 'जय माता दी'], [/Dussehra|Ram Navami/, ['ram', 'ramnaam'], 'श्री राम जय राम जय जय राम'],
    [/Dhanteras/, ['lakshmi'], 'शुभ धनतेरस'], [/Diwali/, ['toran', 'diya', 'lakshmi'], 'शुभ दीपावली'], [/Govardhan|Bhai Dooj/, ['diya', 'shubh'], 'शुभं करोति कल्याणम्'],
    [/Dev Deepawali|Kartik Purnima/, ['ganga', 'diya'], 'देव दीपावली'], [/Janmashtami/, ['krishna'], 'जय श्री कृष्ण'], [/Hanuman Jayanti/, ['hanuman', 'sanjeevani'], 'जय बजरंगबली'],
    [/Holi/, ['krishna'], 'होली की शुभकामनाएँ'], [/Guru Purnima/, ['guru'], 'गुरुर्ब्रह्मा गुरुर्विष्णुः'], [/Raksha Bandhan/, ['shubh'], 'रक्षाबंधन'], [/Hindu New Year|Gudi Padwa|Ugadi/, ['toran', 'om'], 'नव वर्ष मंगलमय हो'],
  ];
  const FORCES = { '01-15': ['army', 'Army Day'], '01-26': ['forces', 'Republic Day'], '07-26': ['army', 'Kargil Vijay Diwas'], '08-15': ['forces', 'Independence Day'], '10-08': ['airforce', 'Air Force Day'], '12-04': ['navy', 'Navy Day'], '12-16': ['army', 'Vijay Diwas'] };
  const dayNo = k => U.diffDays('2020-01-01', k);
  const wkNo = k => Math.floor((dayNo(k) + 3) / 7);
  /* the drawing for a day: festival → Armed Forces days → Shravan / Kartik → the weekday's family, a different one each week */
  const drawn0 = k => {
    let d = {}; try { d = ED.panchang ? ED.panchang.day(k) : {}; } catch (err) { d = {}; }
    const f = (d.festivals || []).join(' · '), w = U.dow(k), n = dayNo(k), wk = wkNo(k), at = (l, i) => l[((i % l.length) + l.length) % l.length];
    for (const x of FEST) if (x[0].test(f)) { const id = at(x[1], Math.floor(n / 365)); return { id, line: x[2], why: (d.festivals || []).find(y => x[0].test(y)) || '' }; }
    const fd = FORCES[k.slice(5)]; if (fd) return { id: fd[0], line: 'जय हिन्द · ' + fd[1], why: fd[1] };
    if (/Shravan/.test(d.month || '') && w !== 6) { const id = at(['shiv', 'kedar', 'bilva', 'nandi', 'rudraksha', 'ganga', 'trishul', 'om'], n); return { id, line: LINES[id] + ' · श्रावण', why: '', month: 'Shravan' }; }
    if (/Kartik/.test(d.month || '') && w !== 1 && w !== 6) { const id = at(['diya', 'ganga', 'tulsi', 'toran', 'diya', 'shankh'], n); return { id, line: (id === 'diya' ? 'कार्तिक मास · दीपदान' : LINES[id]), why: '', month: 'Kartik' }; }
    const id = at(POOL[w], wk); return { id, line: LINES[id], why: '', pool: POOL[w], i: wk };
  };
  WM.drawn = k => {                      // never the same drawing two days running
    const x = drawn0(k);
    if (x.pool && drawn0(U.addDays(k, -1)).id === x.id) { const id = x.pool[(x.i + 1) % x.pool.length]; return { id, line: LINES[id], why: '' }; }
    delete x.pool; delete x.i; return x;
  };

  /* ---------------- mantra of the day, graha of the weekday, magic squares, numbers ---------------- */
  WM.MANTRAS = [
    ['ॐ गं गणपतये नमः', 'Om Gam Ganapataye Namah', 'Ganesh — removes obstacles before a new start'],
    ['ॐ श्रीं महालक्ष्म्यै नमः', 'Om Shreem Mahalakshmyai Namah', 'Lakshmi — prosperity and plenty'],
    ['ॐ ऐं सरस्वत्यै नमः', 'Om Aim Saraswatyai Namah', 'Saraswati — learning, clear speech, interviews and exams'],
    ['ॐ हं हनुमते नमः', 'Om Ham Hanumate Namah', 'Hanuman — courage, strength, a steady mind'],
    ['ॐ नमः शिवाय', 'Om Namah Shivaya', 'Shiva — calm, steadiness, letting go of fear'],
    ['कर्मण्येवाधिकारस्ते मा फलेषु कदाचन', 'Karmanye vadhikaraste ma phaleshu kadachana', 'Gita 2.47 — your right is to the work, not to its fruit'],
    ['योगः कर्मसु कौशलम्', 'Yogah karmasu kaushalam', 'Gita 2.50 — skill in action is yoga'],
    ['उद्यमेन हि सिध्यन्ति कार्याणि न मनोरथैः', 'Udyamena hi sidhyanti karyani na manorathaih', 'Work is achieved by effort, not by wishing'],
    ['ॐ भूर्भुवः स्वः तत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्', 'Gayatri mantra', 'May the divine light inspire our minds'],
    ['सर्वे भवन्तु सुखिनः सर्वे सन्तु निरामयाः', 'Sarve bhavantu sukhinah, sarve santu niramayah', 'May all be happy, may all be free of illness'],
    ['वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ। निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा॥', 'Vakratunda Mahakaya', 'May all my work, always, be free of obstacles'],
    ['ॐ नमो भगवते वासुदेवाय', 'Om Namo Bhagavate Vasudevaya', 'Vishnu — devotion and protection'],
    ['ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्', 'Mahamrityunjaya', 'Health, strength and freedom from fear'],
    ['सत्यमेव जयते', 'Satyameva Jayate', 'Truth alone triumphs'],
    ['ॐ आदित्याय नमः', 'Om Adityaya Namah', 'Surya — energy, health and recognition'],
    ['विद्या ददाति विनयं विनयाद् याति पात्रताम्', 'Vidya dadati vinayam', 'Knowledge gives humility; humility makes one worthy'],
    ['ॐ दुं दुर्गायै नमः', 'Om Dum Durgayai Namah', 'Durga — protection and resolve'],
    ['तमसो मा ज्योतिर्गमय', 'Tamaso ma jyotirgamaya', 'Lead me from darkness to light'],
    ['श्री राम जय राम जय जय राम', 'Shri Ram Jai Ram Jai Jai Ram', 'Ram — steady faith and right conduct'],
    ['ॐ कुबेराय नमः', 'Om Kuberaya Namah', 'Kubera — wealth that is kept well'],
    ['चरैवेति चरैवेति', 'Charaiveti, charaiveti', 'Aitareya Brahmana — keep moving forward'],
    ['ॐ बृहस्पतये नमः', 'Om Brihaspataye Namah', 'Guru — wisdom, good counsel, growth at work'],
    ['यतो धर्मस्ततो जयः', 'Yato dharmas tato jayah', 'Where there is dharma, there is victory'],
    ['शुभं करोति कल्याणम् आरोग्यं धनसम्पदा', 'Shubham karoti kalyanam', 'The lamp brings good, health and wealth'],
    ['आ नो भद्राः क्रतवो यन्तु विश्वतः', 'Aa no bhadrah kratavo yantu vishvatah', 'Rig Veda — let noble thoughts come to us from every side'],
    ['ॐ सह नाववतु सह नौ भुनक्तु', 'Om Saha Navavatu', 'May we learn together, with strength and without discord'],
    ['ॐ श्री गणेशाय नमः', 'Om Shri Ganeshaya Namah', 'Ganesh — a good beginning'],
    ['धर्मो रक्षति रक्षितः', 'Dharmo rakshati rakshitah', 'Dharma protects those who protect it'],
    ['ॐ शान्तिः शान्तिः शान्तिः', 'Om Shantih Shantih Shantih', 'Peace within, around and above'],
  ];
  /* navagraha of the weekday: beej mantra and its yantra (the 3 × 3 magic square; Surya 15, Chandra 18, Mangal 21, Budh 24, Guru 27, Shukra 30, Shani 33) */
  WM.GRAHA = [
    ['Surya', 'सूर्य', 'ॐ ह्रां ह्रीं ह्रौं सः सूर्याय नमः', 1],
    ['Chandra', 'चन्द्र', 'ॐ श्रां श्रीं श्रौं सः चन्द्रमसे नमः', 2],
    ['Mangal', 'मंगल', 'ॐ क्रां क्रीं क्रौं सः भौमाय नमः', 3],
    ['Budh', 'बुध', 'ॐ ब्रां ब्रीं ब्रौं सः बुधाय नमः', 4],
    ['Guru', 'गुरु', 'ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः', 5],
    ['Shukra', 'शुक्र', 'ॐ द्रां द्रीं द्रौं सः शुक्राय नमः', 6],
    ['Shani', 'शनि', 'ॐ प्रां प्रीं प्रौं सः शनैश्चराय नमः', 7],
  ];
  const LOSHU = [[6, 1, 8], [7, 5, 3], [2, 9, 4]];
  WM.square = w => { const add = WM.GRAHA[w][3] - 1; return LOSHU.map(r => r.map(x => x + add)); };
  const DEV = '०१२३४५६७८९';
  const deva = n => String(n).replace(/\d/g, c => DEV[+c]);
  const reduce = n => { n = Math.abs(n); while (n > 9) n = String(n).split('').reduce((a, c) => a + +c, 0); return n || 9; };
  WM.dayNumber = k => reduce(+k.replace(/-/g, ''));
  WM.personal = k => { const b = ED.store.data.dreams && ED.store.data.dreams.dob; if (!U.isKey(b)) return null; return reduce(reduce(+b.slice(5, 7)) + reduce(+b.slice(8, 10)) + reduce(+k.replace(/-/g, ''))); };
  WM.NUMS = { 1: 'a start — lead, begin something', 2: 'partnership — listen, work with others', 3: 'expression — speak, write, present', 4: 'steady work — plan and finish', 5: 'change — try something new, travel', 6: 'care — family, home, service', 7: 'study — think, research, rest', 8: 'achievement — money, decisions, career', 9: 'completion — wrap up, give, forgive' };
  WM.mantra = k => WM.MANTRAS[((dayNo(k) % WM.MANTRAS.length) + WM.MANTRAS.length) % WM.MANTRAS.length];
  const yantraSvg = (w, cls) => { const sq = WM.square(w), c = 30, x0 = 10, y0 = 10; let s = '<svg class="' + cls + '" viewBox="0 0 110 110" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="102" height="102"/><rect x="' + x0 + '" y="' + y0 + '" width="90" height="90"/><path d="M40 10 V100 M70 10 V100 M10 40 H100 M10 70 H100"/></g>';
    sq.forEach((r, i) => r.forEach((v, j) => { s += '<text x="' + (x0 + j * c + 15) + '" y="' + (y0 + i * c + 21) + '" font-size="15" text-anchor="middle" fill="currentColor" font-family="Noto Serif Devanagari, Mangal, serif">' + deva(v) + '</text>'; }));
    return s + '</svg>'; };
  WM.yantraSvg = yantraSvg;

  /* ---------------- your own pictures (photos you add, or image addresses) ---------------- */
  const L = () => { const d = ED.store.data; if (!d.luck || typeof d.luck !== 'object') d.luck = {}; if (!Array.isArray(d.luck.pics)) d.luck.pics = []; return d.luck; };
  WM.mode = () => (ED.store.data.luck && ED.store.data.luck.mode) || 'mix';     // mix | mine | drawn
  WM.ownFor = k => {
    const lk = ED.store.data.luck; if (!lk || !Array.isArray(lk.pics) || WM.mode() === 'drawn') return null;
    const w = String(U.dow(k)), l = lk.pics.filter(p => ED.pics && ED.pics.ok(p.src) && (!p.day || p.day === w)); if (!l.length) return null;
    const n = dayNo(k);
    if (WM.mode() === 'mix') { const mine = l.filter(p => p.day === w); if (!mine.length && n % 2) return null; const use = mine.length ? mine : l; return use[Math.floor(n / (mine.length ? 7 : 2)) % use.length]; }
    return l[n % l.length];
  };
  WM.pick = k => {
    const dr = WM.drawn(k);
    const own = !dr.why ? WM.ownFor(k) : null;            // festivals and Armed Forces days keep their own drawing
    return Object.assign({}, dr, own ? { own: own.src, ownTitle: own.title || '' } : {});
  };

  WM.on = () => S().watermark !== false;
  WM.lineOn = () => S().luckLine !== false;
  WM.svg = (id, line) => '<svg viewBox="0 0 400 420" aria-hidden="true" focusable="false">' + (ART[id] || ART.shiv)() +
    (line ? '<text x="200" y="408" text-anchor="middle" font-size="24" fill="currentColor" font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, Nirmala UI, Kohinoor Devanagari, Mangal, serif">' + e(line) + '</text>' : '') + '</svg>';
  WM.html = k => {
    if (!WM.on()) return '';
    const x = WM.pick(k), w = U.dow(k), v = dayNo(k) % 3;      // three layouts so even a repeated drawing sits differently
    const main = x.own ? '<img class="wm-own" src="' + e(x.own) + '" alt="" draggable="false"><span class="wm-line">' + e(x.line || '') + '</span>' : WM.svg(x.id, x.line);
    return '<div class="wm v' + v + (x.own ? ' own' : '') + '" data-wm="' + (x.own ? 'own' : x.id) + '" aria-hidden="true">' + main + yantraSvg(w, 'wm-yantra') + '</div>';
  };
  /* the line at the foot of the Daily page: mantra of the day · today's numbers */
  WM.stripHtml = k => {
    if (!WM.lineOn()) return '';
    const m = WM.mantra(k), gr = WM.GRAHA[U.dow(k)], pn = WM.personal(k);
    return '<button type="button" class="wm-strip" data-act="wm-today" data-date="' + k + '" title="Mantra, graha and numbers of the day">' +
      '<span class="wm-s-m" lang="sa">🕉 ' + e(m[0].length > 46 ? m[0].slice(0, 44) + '…' : m[0]) + '</span>' +
      '<span class="wm-s-n">' + e(gr[0]) + ' yantra ' + (gr[3] * 3 + 12) + ' · Shubh ank ' + WM.dayNumber(k) + (pn ? ' · your day ' + pn : '') + '</span></button>';
  };
  WM.today = k => {
    const m = WM.mantra(k), w = U.dow(k), gr = WM.GRAHA[w], dn = WM.dayNumber(k), pn = WM.personal(k), x = WM.drawn(k);
    ED.ui.modal({
      title: 'Today’s mantra and numbers', cls: 'st-modal wm-modal',
      body: '<div class="wm-day"><div class="wm-art">' + WM.svg(x.id, '') + '</div><div>' +
        '<p class="hint">' + e(U.fmtLong(k)) + (x.why || x.month ? ' · ' + e(x.why || x.month) : '') + '</p>' +
        '<h3 class="wm-h">Mantra of the day</h3><p class="wm-big" lang="sa">' + e(m[0]) + '</p><p class="wm-tr">' + e(m[1]) + '</p><p>' + e(m[2]) + '</p>' +
        '<h3 class="wm-h">' + e(U.DAYS[w]) + ' — ' + e(gr[0]) + ' (' + gr[1] + ')</h3><p class="wm-big" lang="sa">' + e(gr[2]) + '</p>' +
        '<div class="wm-yrow">' + yantraSvg(w, 'wm-ybig') + '<p class="hint">The ' + e(gr[0]) + ' yantra — every row, column and diagonal adds up to <b>' + (gr[3] * 3 + 12) + '</b>.</p></div>' +
        '<h3 class="wm-h">Numbers</h3><p><b>Shubh ank of the day: ' + dn + '</b> — ' + e(WM.NUMS[dn]) + '.' + (pn ? '<br><b>Your personal day: ' + pn + '</b> — ' + e(WM.NUMS[pn]) + '.' : '<br><span class="hint">Add your birth date in Purpose → Dreams to see your personal day number.</span>') + ' <b>१०८</b> — chant a mala of 108.</p>' +
        '<p class="hint">Traditional prayers and numbers for faith and a focused start; the effort is yours. 🙏</p></div></div>',
      footer: '<button type="button" class="btn ghost" data-x="pics">' + ED.icon('image') + 'My pictures</button><span class="grow"></span>' + (ED.views.pooja ? '<button type="button" class="btn" data-x="japa">Count the jaap</button>' : '') + '<button type="button" class="btn primary" data-mclose>🙏 Done</button>',
      onMount(el, api) {
        el.querySelector('[data-x="pics"]').addEventListener('click', () => { api.close(); WM.picsDialog(); });
        const j = el.querySelector('[data-x="japa"]'); if (j) j.addEventListener('click', () => { api.close(); (ED.state.pj = ED.state.pj || {}).tab = 'aarti'; ED.go.tab('pooja'); });
      },
    });
  };
  WM.picsDialog = () => {
    const DAYS = [['', 'Any day']].concat(U.DAYS.map((d, i) => [String(i), d]));
    const draw = el => {
      const l = L().pics;
      el.querySelector('.wm-pics').innerHTML = l.length ? l.map(p => '<div class="wm-pc" data-id="' + e(p.id) + '"><img src="' + e(p.src) + '" alt="' + e(p.title || 'Picture') + '"><input class="field" data-f="title" value="' + e(p.title || '') + '" placeholder="Name (e.g. Kedarnath)" aria-label="Name">' +
        '<select class="field" data-f="day" aria-label="Show on">' + DAYS.map(d => '<option value="' + d[0] + '"' + ((p.day || '') === d[0] ? ' selected' : '') + '>' + d[1] + '</option>').join('') + '</select>' +
        '<button type="button" class="icon-btn sm" data-x="rm" aria-label="Remove" title="Remove">' + ED.icon('trash') + '</button></div>').join('') : '<p class="hint">No pictures yet. Add photos of your deities, temples you visited, your family deity or places that bring you luck.</p>';
    };
    ED.ui.modal({
      title: 'Pictures for the Daily page', cls: 'st-modal wide wm-modal',
      body: '<p>Add your own pictures — photos from this device or an image address. They are shown very faint behind your Daily notes, on the day you choose or in turn with the drawings. Festivals and Armed Forces days keep their own drawing.</p>' +
        '<div class="seg wm-mode" role="group" aria-label="Which pictures">' + [['mix', 'Mine and the drawings, in turn'], ['mine', 'Only mine'], ['drawn', 'Only the drawings']].map(m => '<button type="button" data-mode="' + m[0] + '" aria-pressed="' + (WM.mode() === m[0]) + '">' + m[1] + '</button>').join('') + '</div>' +
        '<div class="wm-pics"></div><div class="row-btns"><label class="btn small">' + ED.icon('image') + 'Add photos<input type="file" accept="image/*" multiple hidden data-x="file"></label>' +
        '<input class="field wm-url" type="url" placeholder="…or an image address (https://…)" aria-label="Image address"><button type="button" class="btn small" data-x="url">Add</button></div>' +
        '<p class="hint">Photos are made small (about 700 px) so the diary stays light to sync. Up to 30. Use pictures you are free to use.</p>',
      footer: '<span class="grow"></span><button type="button" class="btn primary" data-mclose>Done</button>',
      onClose() { if (ED.state.tab === 'daily') ED.app.render(); },
      onMount(el) {
        draw(el);
        const add = src => { const l = L().pics; if (l.length >= 30) { ED.ui.toast('30 pictures at most'); return false; } if (l.some(p => p.src === src)) return false; l.push({ id: U.uid('lp'), src, title: '', day: '', updatedAt: Date.now() }); return true; };
        el.addEventListener('change', async ev => {
          const t = ev.target;
          if (t.dataset.x === 'file') { ED.store.checkpoint('Daily pictures'); for (const f of Array.from(t.files || [])) { try { add(await U.imageToDataURL(f, 700, 0.72)); } catch (err) { ED.ui.toast('Could not read ' + f.name); } } t.value = ''; ED.store.commit(); draw(el); return; }
          const pc = t.closest('.wm-pc'); if (pc && t.dataset.f) { const p = L().pics.find(x => x.id === pc.dataset.id); if (p) { p[t.dataset.f] = t.value; p.updatedAt = Date.now(); ED.store.commit(); } }
        });
        el.addEventListener('click', ev => {
          const b = ev.target.closest('[data-x],[data-mode]'); if (!b) return;
          if (b.dataset.mode) { L().mode = b.dataset.mode; L().updatedAt = Date.now(); ED.store.commit(); U.$$('[data-mode]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
          if (b.dataset.x === 'url') { const i = el.querySelector('.wm-url'), v = i.value.trim(); if (!/^https:\/\/\S+$/.test(v)) { ED.ui.toast('Paste an address that starts with https://'); return; } ED.store.checkpoint('Daily pictures'); if (add(v)) { ED.store.commit(); i.value = ''; draw(el); } }
          if (b.dataset.x === 'rm') { const id = b.closest('.wm-pc').dataset.id; ED.store.checkpoint('Daily pictures'); L().pics = L().pics.filter(x => x.id !== id); ED.store.commit(); draw(el); }
        });
      },
    });
  };
  const A = (ED.actions = ED.actions || {});
  A['wm-today'] = el => WM.today(el.dataset.date || U.today());
  A['wm-pics'] = () => WM.picsDialog();

  /* settings: Appearance */
  if (ED.settings && ED.settings.tab_look) {
    const t0 = ED.settings.tab_look, b0 = ED.settings.bind_look;
    ED.settings.tab_look = () => t0() + '<h3 class="set-h">Daily page</h3>' +
      '<div class="set-row"><label class="switch" for="sg-wm"><input id="sg-wm" type="checkbox"' + (WM.on() ? ' checked' : '') + '><span class="track"></span><span>Light picture on the Daily page</span></label><p class="hint">A very light picture behind your daily notes, different each day — the Shiv Pariwar, temples, festivals of the Hindu calendar, the Armed Forces — with the weekday’s graha yantra in the corner.</p></div>' +
      '<div class="set-row"><label class="switch" for="sg-wl"><input id="sg-wl" type="checkbox"' + (WM.lineOn() ? ' checked' : '') + '><span class="track"></span><span>Mantra and numbers of the day</span></label><p class="hint">A line at the foot of the Daily page; tap it for the meaning, the graha mantra, the yantra and your numbers.</p></div>' +
      '<div class="set-row"><button type="button" class="btn small" data-act="wm-pics">' + ED.icon('image') + 'My pictures for the Daily page…</button></div>';
    ED.settings.bind_look = b => { b0(b); const x = b.querySelector('#sg-wm'); if (x) x.addEventListener('change', () => { S().watermark = x.checked; ED.store.commit(); }); const y = b.querySelector('#sg-wl'); if (y) y.addEventListener('change', () => { S().luckLine = y.checked; ED.store.commit(); }); };
  }
})();
