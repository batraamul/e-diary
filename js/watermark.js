/* E-Diary — 1.24: a very light picture behind the Daily page's notes (the right-hand page of the Planner).
   Original line drawings (made for this diary — no photographs), chosen for the day:
     festivals first (Maha Shivaratri, Ganesh Chaturthi, Navratri and Durga Ashtami, Diwali and Dhanteras, Kartik
     Purnima / Dev Deepawali, Janmashtami, Ram Navami and Dussehra, Hanuman Jayanti, Holi, Guru Purnima),
     then the days of the Armed Forces (Army Day 15 Jan, Republic Day 26 Jan, Kargil Vijay Diwas 26 Jul, Independence
     Day 15 Aug, Air Force Day 8 Oct, Navy Day 4 Dec, Vijay Diwas 16 Dec), then the month (Shravan → Shiva), then the
     weekday — mostly the Shiv Pariwar: Monday Shiva at Kailash, Tuesday Hanuman (Rudra), Wednesday Ganesh, Thursday
     a Shiva temple, Friday Parvati (Gauri), Saturday the Armed Forces and Intelligence by turns, Sunday Surya and
     Kartikeya by turns. Each carries a short line in Sanskrit / Hindi.
   Settings → Appearance → "Light picture on the Daily page" (settings.watermark, on unless switched off). */
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
  WM.ART = ART;
  /* which picture for a day */
  WM.pick = k => {
    let d = {}; try { d = ED.panchang ? ED.panchang.day(k) : {}; } catch (err) { d = {}; }
    const f = (d.festivals || []).join(' · '), md = k.slice(5), line = (id, l) => ({ id, line: l || LINES[id] });
    if (/Shivaratri/.test(f)) return line('shiv', 'ॐ नमः शिवाय · महाशिवरात्रि');
    if (/Ganesh/.test(f)) return line('ganesh', 'गणपति बप्पा मोरया');
    if (/Navratri|Durga Ashtami|Maha Navami/.test(f)) return line('parvati', 'जय माता दी');
    if (/Dussehra|Ram Navami/.test(f)) return line('ram');
    if (/Diwali|Dhanteras|Dev Deepawali|Govardhan|Bhai Dooj/.test(f)) return line('diya', 'शुभ दीपावली');
    if (/Janmashtami/.test(f)) return line('krishna', 'जय श्री कृष्ण');
    if (/Hanuman Jayanti/.test(f)) return line('hanuman', 'जय बजरंगबली');
    if (/Holi/.test(f)) return line('krishna', 'होली की शुभकामनाएँ');
    if (/Guru Purnima/.test(f)) return line('temple', 'गुरुर्ब्रह्मा गुरुर्विष्णुः');
    const days = { '01-15': 'Army Day', '01-26': 'Republic Day', '07-26': 'Kargil Vijay Diwas', '08-15': 'Independence Day', '10-08': 'Air Force Day', '12-04': 'Navy Day', '12-16': 'Vijay Diwas' };
    if (days[md]) return { id: 'forces', line: 'जय हिन्द · ' + days[md] };
    if (/Shravan/.test(d.month || '') && U.dow(k) !== 6) return line('shiv', 'ॐ नमः शिवाय · श्रावण');
    if (/Kartik/.test(d.month || '') && U.dow(k) !== 1 && U.dow(k) !== 6) return line('diya', 'कार्तिक मास · दीपदान');
    const wk = Math.floor(U.diffDays('2026-01-04', k) / 7);
    return [() => line(wk % 2 ? 'kartikeya' : 'surya'), () => line('shiv'), () => line('hanuman'), () => line('ganesh'), () => line('temple'), () => line('parvati'), () => line(wk % 2 ? 'intel' : 'forces')][U.dow(k)]();
  };
  WM.on = () => S().watermark !== false;
  WM.svg = (id, line) => '<svg viewBox="0 0 400 420" aria-hidden="true" focusable="false">' + (ART[id] || ART.shiv)() +
    (line ? '<text x="200" y="408" text-anchor="middle" font-size="24" fill="currentColor" font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, Nirmala UI, Kohinoor Devanagari, Mangal, serif">' + e(line) + '</text>' : '') + '</svg>';
  WM.html = k => { if (!WM.on()) return ''; const x = WM.pick(k); return '<div class="wm" data-wm="' + x.id + '" aria-hidden="true">' + WM.svg(x.id, x.line) + '</div>'; };

  /* settings: Appearance */
  if (ED.settings && ED.settings.tab_look) {
    const t0 = ED.settings.tab_look, b0 = ED.settings.bind_look;
    ED.settings.tab_look = () => t0() + '<h3 class="set-h">Daily page</h3><div class="set-row"><label class="switch" for="sg-wm"><input id="sg-wm" type="checkbox"' + (WM.on() ? ' checked' : '') + '><span class="track"></span><span>Light picture on the Daily page</span></label><p class="hint">A very light drawing behind your daily notes, chosen for the day — Shiva and the Shiv Pariwar, temples, festivals of the Hindu calendar, and the days of the Armed Forces.</p></div>';
    ED.settings.bind_look = b => { b0(b); const x = b.querySelector('#sg-wm'); if (x) x.addEventListener('change', () => { S().watermark = x.checked; ED.store.commit(); }); };
  }
})();
