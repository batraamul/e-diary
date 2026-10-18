/* E-Diary — how the diary looks (added in 1.14): cover colour and texture, the paper, the accent colour, the rings and
   the lettering, and ready-made looks that set them all at once. Light / dark stays where it was (the theme button).
   settings.look = { preset, cover, texture, paper, accent, rings, foil, font }
   The chosen look is written as one small stylesheet (<style id="ed-look">) that only overrides colour variables and
   background patterns, so every page follows it. The "Classic" look writes nothing: the diary looks exactly as before.
   The stylesheet is also kept in this browser, so the closed cover shows in your colours before the diary has opened. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const LK = (ED.look = {});
  const KEY = 'e-diary-look-css';

  /* ---------------- choices ---------------- */
  const DEF = { preset: 'classic', cover: '#5c2618', texture: 'leather', paper: 'plain', accent: '#1f6fe0', rings: 'silver', foil: 'gold', font: 'sans' };
  const PRESETS = [
    ['classic', 'Classic leather', { cover: '#5c2618', texture: 'leather', paper: 'plain', accent: '#1f6fe0', rings: 'silver', foil: 'gold' }],
    ['executive', 'Executive black', { cover: '#1d1d20', texture: 'pebble', paper: 'white', accent: '#8a6512', rings: 'gold', foil: 'gold' }],
    ['navy', 'Navy officer', { cover: '#1b2a4a', texture: 'linen', paper: 'cream', accent: '#1f5fc7', rings: 'silver', foil: 'gold' }],
    ['oxblood', 'Oxblood', { cover: '#4a0e1a', texture: 'leather', paper: 'cream', accent: '#ad1457', rings: 'gold', foil: 'gold' }],
    ['forest', 'Forest green', { cover: '#1e3b2a', texture: 'canvas', paper: 'cream', accent: '#2e7d32', rings: 'gold', foil: 'gold' }],
    ['royal', 'Royal purple', { cover: '#36204f', texture: 'suede', paper: 'plain', accent: '#6a3fb0', rings: 'silver', foil: 'silver' }],
    ['denim', 'Denim', { cover: '#2a4a63', texture: 'denim', paper: 'dotted', accent: '#00796b', rings: 'silver', foil: 'silver' }],
    ['sky', 'Sky blue', { cover: '#2f6db5', texture: 'linen', paper: 'white', accent: '#1f6fe0', rings: 'silver', foil: 'silver' }],
    ['teal', 'Deep teal', { cover: '#0f4f54', texture: 'pebble', paper: 'plain', accent: '#00796b', rings: 'silver', foil: 'gold' }],
    ['rose', 'Dusty rose', { cover: '#9a5562', texture: 'suede', paper: 'cream', accent: '#ad1457', rings: 'rose', foil: 'gold' }],
    ['walnut', 'Walnut wood', { cover: '#5a3a22', texture: 'wood', paper: 'cream', accent: '#8a6512', rings: 'gold', foil: 'gold' }],
    ['kraft', 'Kraft paper', { cover: '#9c7650', texture: 'kraft', paper: 'aged', accent: '#8a6512', rings: 'black', foil: 'gold' }],
    ['carbon', 'Carbon', { cover: '#25282c', texture: 'carbon', paper: 'grid', accent: '#c25100', rings: 'black', foil: 'silver' }],
    ['ivory', 'Ivory', { cover: '#e6dfd0', texture: 'smooth', paper: 'white', accent: '#3949ab', rings: 'silver', foil: 'gold' }],
    // service and profession looks (colours and patterns only — no emblems or insignia)
    ['army', 'Indian Army', { cover: '#4b5320', texture: 'camo', paper: 'cream', accent: '#556b2f', rings: 'black', foil: 'gold' }],
    ['airforce', 'Indian Air Force', { cover: '#2c4f7c', texture: 'sky', paper: 'white', accent: '#1f5fa8', rings: 'silver', foil: 'silver' }],
    ['navy-in', 'Indian Navy', { cover: '#0b1f3a', texture: 'waves', paper: 'white', accent: '#1f4e8c', rings: 'gold', foil: 'gold' }],
    ['intel', 'Intelligence', { cover: '#1a1d21', texture: 'contour', paper: 'grid', accent: '#9b1c1c', rings: 'black', foil: 'silver' }],
    ['cyber', 'Cyber Security', { cover: '#06222e', texture: 'circuit', paper: 'grid', accent: '#00838f', rings: 'silver', foil: 'silver' }],
    ['hacker', 'Hacking', { cover: '#0a120c', texture: 'matrix', paper: 'grid', accent: '#1b7f3a', rings: 'black', foil: 'silver' }],
    ['aviation', 'Aviation', { cover: '#3a4652', texture: 'aero', paper: 'white', accent: '#c25100', rings: 'silver', foil: 'silver' }],
  ];
  const COVERS = [['#5c2618', 'Brown leather'], ['#7a4a2a', 'Tan'], ['#4a0e1a', 'Oxblood'], ['#8f1d35', 'Maroon'], ['#9a5562', 'Dusty rose'], ['#9c7650', 'Kraft'],
    ['#1e3b2a', 'Forest green'], ['#0f4f54', 'Teal'], ['#2a4a63', 'Denim blue'], ['#2f6db5', 'Sky blue'], ['#1b2a4a', 'Navy'], ['#36204f', 'Purple'],
    ['#1d1d20', 'Black'], ['#25282c', 'Graphite'], ['#5f6670', 'Slate grey'], ['#e6dfd0', 'Ivory'], ['#4b5320', 'Army olive'], ['#2c4f7c', 'Air force blue'], ['#0b1f3a', 'Naval blue']];
  const TEXTURES = [['leather', 'Leather'], ['pebble', 'Pebbled leather'], ['suede', 'Suede'], ['linen', 'Linen cloth'], ['canvas', 'Canvas'], ['denim', 'Denim'],
    ['wood', 'Wood'], ['kraft', 'Kraft paper'], ['carbon', 'Carbon fibre'], ['smooth', 'Smooth matte'],
    ['camo', 'Camouflage'], ['sky', 'Sky & clouds'], ['waves', 'Sea waves'], ['contour', 'Map contours'], ['circuit', 'Circuit board'], ['matrix', 'Code (0 1)'], ['aero', 'Aircraft']];
  const PAPERS = [['plain', 'Plain'], ['white', 'Bright white'], ['cream', 'Cream'], ['ruled', 'Ruled lines'], ['dotted', 'Dotted'], ['grid', 'Squared'], ['aged', 'Vintage']];
  const ACCENTS = [['#1f6fe0', 'Blue'], ['#3949ab', 'Indigo'], ['#6a3fb0', 'Purple'], ['#ad1457', 'Rose'], ['#c62828', 'Red'], ['#c25100', 'Orange'],
    ['#8a6512', 'Gold'], ['#2e7d32', 'Green'], ['#556b2f', 'Olive'], ['#00796b', 'Teal'], ['#455a64', 'Graphite']];
  const RINGS = [['silver', 'Silver'], ['gold', 'Gold'], ['rose', 'Rose gold'], ['black', 'Black']];
  const FOILS = [['gold', 'Gold'], ['silver', 'Silver']];
  const FONTS = [['sans', 'Modern'], ['serif', 'Classic (book type)']];
  LK.PRESETS = PRESETS; LK.TEXTURES = TEXTURES; LK.PAPERS = PAPERS;

  /* ---------------- colour arithmetic ---------------- */
  const hex2rgb = h => {
    h = String(h || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const okHex = (h, fb) => hex2rgb(h) ? '#' + String(h).trim().replace('#', '').toLowerCase().replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3') : fb;
  const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const rgba = (h, a) => 'rgba(' + hex2rgb(h).join(', ') + ', ' + a + ')';
  const lum = h => { const c = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const toHsl = h => {
    const [r, g, b] = hex2rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l * 100];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [hh * 60, s * 100, l * 100];
  };
  const fromHsl = (h, s, l) => {
    s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgb2hex([f(0) * 255, f(8) * 255, f(4) * 255]);
  };
  const shade = (hex, ds, lf, la) => { const [h, s, l] = toHsl(hex); return fromHsl(h, s * ds, l * lf + (la || 0)); };
  LK.contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /* ---------------- patterns (transparent layers over the colour) ---------------- */
  const svg = s => 'url("data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' " + s + '</svg>') + '")';
  const noise = (freq, oct, alpha, w, h, seed, light, kind) => svg("width='" + w + "' height='" + (h || w) + "'><filter id='n'><feTurbulence type='" + (kind || 'fractalNoise') + "' baseFrequency='" + freq + "' numOctaves='" + oct + "' seed='" + (seed || 2) + "' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 " + (light ? 1 : 0) + ' 0 0 0 0 ' + (light ? 1 : 0) + ' 0 0 0 0 ' + (light ? 1 : 0) + ' 0 0 0 ' + alpha + " 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>");
  const PEBBLE = svg("width='180' height='180'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='.16' numOctaves='2' seed='5' stitchTiles='stitch'/><feDiffuseLighting lighting-color='#fff' surfaceScale='2.6' diffuseConstant='1'><feDistantLight azimuth='225' elevation='48'/></feDiffuseLighting><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#p)' opacity='.55'/>");
  const CARBON = svg("width='12' height='12'><path d='M0 0h6v6H0zM6 6h6v6H6z' fill='rgba(0,0,0,.28)'/><path d='M0 0h6L0 6zM6 6h6L6 12z' fill='rgba(255,255,255,.06)'/><path d='M6 0h6v6H6zM0 6h6v6H0z' fill='rgba(255,255,255,.025)'/>");
  const blob = (seed, rgb, a) => "<filter id='b" + seed + "'><feTurbulence type='fractalNoise' baseFrequency='.016' numOctaves='2' seed='" + seed + "' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 " + rgb[0] + ' 0 0 0 0 ' + rgb[1] + ' 0 0 0 0 ' + rgb[2] + " 0 0 0 1 0'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0 0 " + a + ' ' + a + "'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#b" + seed + ")'/>";
  const CAMO = svg("width='260' height='260'>" + blob(3, [0.55, 0.5, 0.31], 0.85) + blob(8, [0.25, 0.19, 0.12], 0.8) + blob(13, [0.07, 0.09, 0.05], 0.75));
  const WAVES = svg("width='64' height='22'><path d='M0 11 Q16 2 32 11 T64 11' fill='none' stroke='rgba(255,255,255,.11)' stroke-width='1.4'/><path d='M0 20 Q16 13 32 20 T64 20' fill='none' stroke='rgba(0,0,0,.18)' stroke-width='1.2'/>");
  const CONTOUR = svg("width='320' height='320'><filter id='c'><feTurbulence type='fractalNoise' baseFrequency='.007' numOctaves='2' seed='9' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/><feComponentTransfer><feFuncA type='table' tableValues='0 .13 0 .13 0 .13 0 .13 0 .13 0 .13 0 .13 0'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#c)'/>");
  const CIRCUIT = svg("width='96' height='96'><g fill='none' stroke='rgba(90,220,255,.17)' stroke-width='1.3'><path d='M0 22h28l10 10v22h58M44 0v16l9 9h43M12 96V70l10-10h18M66 96V76l-9-9H40M80 40v14'/></g><g fill='rgba(90,220,255,.28)'><circle cx='28' cy='22' r='2.4'/><circle cx='53' cy='25' r='2.4'/><circle cx='40' cy='60' r='2.4'/><circle cx='57' cy='67' r='2.4'/><circle cx='80' cy='40' r='2.4'/></g>");
  const MATRIX = svg("width='132' height='132'><g font-family='monospace' font-size='10' fill='rgba(70,255,130,.15)'>" + ['1 0 1 1 0 0 1 0 1 1 0', '0 1 1 0 1 0 0 1 1 0 1', '1 1 0 0 1 1 0 1 0 0 1', '0 0 1 0 1 1 1 0 0 1 0', '1 0 0 1 0 1 0 1 1 1 0', '0 1 0 1 1 0 1 0 0 1 1', '1 1 1 0 0 1 0 0 1 0 1', '0 1 0 0 1 0 1 1 0 1 0', '1 0 1 1 1 0 0 1 0 0 1', '0 0 1 1 0 1 1 0 1 0 0', '1 1 0 1 0 0 1 1 0 1 1'].map((t, i) => "<text x='2' y='" + (11 + i * 12) + "'>" + t + '</text>').join('') + '</g>');
  const AERO = svg("width='110' height='110'><g fill='rgba(255,255,255,.085)' transform='rotate(-35 55 55)'><path d='M55 26l3 15 17 9v5l-17-5-1 12 5 4v4l-7-2-7 2v-4l5-4-1-12-17 5v-5l17-9z'/></g><path d='M0 100h110' stroke='rgba(255,255,255,.05)' stroke-dasharray='6 6'/>");
  const TEX = {
    camo: () => [CAMO],
    sky: () => [noise('.011', 4, 0.3, 300, 300, 6, true), 'linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.08))'],
    waves: () => [WAVES, noise('.9', 1, 0.06, 200)],
    contour: () => [CONTOUR, noise('.9', 1, 0.06, 200)],
    circuit: () => [CIRCUIT],
    matrix: () => [MATRIX],
    aero: () => [AERO, noise('.9', 1, 0.05, 200)],
    leather: () => [noise('.85', 3, 0.23, 240)],
    pebble: () => [PEBBLE, noise('.9', 2, 0.12, 200)],
    suede: () => [noise('1.5', 2, 0.2, 200), noise('1.5', 1, 0.05, 200, 200, 7, true)],
    linen: () => ['repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px)', 'repeating-linear-gradient(90deg, rgba(0,0,0,.1) 0 1px, transparent 1px 3px)', noise('.9', 2, 0.12, 200)],
    canvas: () => [noise('.9 .06', 2, 0.24, 180), noise('.06 .9', 2, 0.18, 180, 180, 4), noise('.8', 1, 0.05, 160, 160, 9, true)],
    denim: () => ['repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 1.5px, transparent 1.5px 5px)', 'repeating-linear-gradient(-45deg, rgba(0,0,0,.13) 0 1px, transparent 1px 4px)', noise('1.1', 2, 0.16, 200)],
    wood: () => [noise('.005 .13', 4, 0.32, 420, 210, 11), noise('.9', 1, 0.07, 200)],
    kraft: () => [noise('.75', 4, 0.26, 220), noise('.6', 2, 0.1, 220, 220, 9, true)],
    carbon: () => [CARBON],
    smooth: () => [noise('.9', 1, 0.05, 200)],
  };
  const PAPER_NOISE = noise('1.2', 2, 0.09, 180);
  const PAGE = {
    plain: () => [], white: () => [], cream: () => [],
    ruled: () => ['repeating-linear-gradient(180deg, transparent 0 31px, var(--look-line) 31px 32px)'],
    dotted: () => ['radial-gradient(circle at 1.5px 1.5px, var(--look-dot) 1.2px, transparent 1.6px)'],
    grid: () => ['linear-gradient(var(--look-line) 1px, transparent 1px)', 'linear-gradient(90deg, var(--look-line) 1px, transparent 1px)'],
    aged: () => ['radial-gradient(140% 110% at 50% 45%, transparent 55%, rgba(120, 78, 20, .17) 100%)', noise('.55', 3, 0.07, 260, 260, 5)],
  };
  const PAGE_SIZE = { dotted: '18px 18px', grid: '22px 22px' };
  const RING = { silver: null, gold: ['#fff4cf', '#c9a24a', '#6b4f14'], rose: ['#ffe4dc', '#c98b7a', '#6e3a2e'], black: ['#7c8188', '#2c2f34', '#0c0d0f'] };
  const FOIL = { gold: ['#e8c58c', '#ffd98f', '#3b1d10', '#7a5518'], silver: ['#dfe4ea', '#f4f7fa', '#1d2229', '#454e5c'] };
  LK.textureCss = (k, color) => { const l = (TEX[k] || TEX.leather)(); return 'background-color:' + color + ';background-image:' + l.join(',') + ';'; };

  /* ---------------- the look ---------------- */
  LK.get = () => {
    const s = ED.store && ED.store.data && ED.store.data.settings;
    const L = Object.assign({}, DEF, (s && s.look) || {});
    L.cover = okHex(L.cover, DEF.cover); L.accent = okHex(L.accent, DEF.accent);
    if (!TEX[L.texture]) L.texture = DEF.texture; if (!PAGE[L.paper]) L.paper = DEF.paper;
    if (!(L.rings in RING)) L.rings = DEF.rings; if (!FOIL[L.foil]) L.foil = DEF.foil;
    return L;
  };
  const isClassic = L => ['cover', 'texture', 'paper', 'accent', 'rings', 'foil', 'font'].every(k => String(L[k]).toLowerCase() === String(DEF[k]).toLowerCase());

  LK.css = L => {
    if (isClassic(L)) return '';
    const c = L.cover, light = lum(c) > 0.33;
    const [h, sat, l] = toHsl(c);
    const v = {};   // light mode
    const dk = {};  // dark mode
    // cover
    v['--leather'] = c; v['--leather-2'] = shade(c, 0.92, 1, light ? -6 : 8); v['--leather-3'] = shade(c, 1.08, light ? 0.78 : 0.5);
    dk['--leather'] = shade(c, 0.9, light ? 0.3 : 0.45); dk['--leather-2'] = shade(c, 0.88, light ? 0.42 : 0.68); dk['--leather-3'] = shade(c, 1.05, 0.18);
    const thread = light ? 'rgba(0, 0, 0, .22)' : rgba(mix(fromHsl(h, Math.min(sat, 60), 85), '#ffe6c8', 0.5), 0.34);
    v['--stitch'] = thread; dk['--stitch'] = light ? 'rgba(255, 255, 255, .14)' : rgba(mix(fromHsl(h, Math.min(sat, 60), 80), '#ffe6c8', 0.5), 0.2);
    const ink = light ? '#2a2622' : mix(fromHsl(h, Math.min(sat, 30), 92), '#ffffff', 0.4);
    v['--topbar-ink'] = ink; v['--topbar-ink-2'] = light ? 'rgba(42, 38, 34, .7)' : rgba(ink, 0.74); v['--topbar-hover'] = light ? 'rgba(0, 0, 0, .07)' : 'rgba(255, 255, 255, .12)';
    const dInk = mix(fromHsl(h, Math.min(sat, 30), 88), '#ffffff', 0.3);
    dk['--topbar-ink'] = dInk; dk['--topbar-ink-2'] = rgba(dInk, 0.68); dk['--topbar-hover'] = 'rgba(255, 255, 255, .1)';
    const F = FOIL[L.foil] || FOIL.gold;
    v['--look-foil'] = light ? F[3] : F[0]; v['--look-foil-hi'] = light ? F[3] : F[1]; v['--look-foil-ink'] = light ? '#ffffff' : F[2];
    dk['--look-foil'] = F[0]; dk['--look-foil-hi'] = F[1]; dk['--look-foil-ink'] = F[2];
    // accent
    const a = L.accent;
    v['--accent'] = a; v['--accent-2'] = mix(a, '#ffffff', 0.45); v['--accent-ink'] = LK.contrast(a, '#ffffff') >= 3 ? '#ffffff' : '#111111';
    v['--accent-soft'] = rgba(a, 0.12); v['--focus'] = a; v['--selected'] = mix(a, '#000000', 0.08); v['--today-cell'] = mix(a, '#ffffff', 0.86);
    v['--chart-track'] = mix(a, '#ffffff', 0.78); v['--banner-1'] = mix(a, '#ffffff', 0.45); v['--banner-2'] = a;
    v['--info-bg'] = mix(a, '#ffffff', 0.9); v['--info-ink'] = mix(a, '#000000', 0.55); v['--info-bd'] = mix(a, '#ffffff', 0.7);
    dk['--accent'] = mix(a, '#ffffff', 0.32); dk['--accent-2'] = mix(a, '#ffffff', 0.55); dk['--accent-ink'] = '#0b1220'; dk['--accent-soft'] = rgba(mix(a, '#ffffff', 0.32), 0.18);
    dk['--focus'] = mix(a, '#ffffff', 0.5); dk['--selected'] = mix(a, '#000000', 0.1); dk['--today-cell'] = mix(a, '#1f2226', 0.74); dk['--chart-track'] = mix(a, '#1f2226', 0.68);
    dk['--banner-1'] = mix(a, '#000000', 0.25); dk['--banner-2'] = mix(a, '#000000', 0.62);
    dk['--info-bg'] = mix(a, '#1f2226', 0.78); dk['--info-ink'] = mix(a, '#ffffff', 0.78); dk['--info-bd'] = mix(a, '#1f2226', 0.55);
    // paper
    const P = L.paper;
    if (P === 'white') Object.assign(v, { '--paper': '#fdfdfb', '--paper-2': '#ececea', '--paper-3': '#ffffff', '--paper-edge': '#d4d4cf', '--hours-shade': '#ececea' });
    if (P === 'cream' || P === 'aged') {
      Object.assign(v, { '--paper': P === 'aged' ? '#f1e6cc' : '#f6efdf', '--paper-2': P === 'aged' ? '#e4d5b2' : '#e9dfc8', '--paper-3': '#fcf8ee', '--paper-edge': '#d3c4a3',
        '--rule': '#dccdae', '--rule-strong': '#c6b48f', '--hours-shade': '#ebe0c6', '--card-bg': 'rgba(255, 252, 242, .6)', '--card-border': '#d6c8a8' });
      Object.assign(dk, { '--paper': '#25221d', '--paper-2': '#2e2a23', '--paper-3': '#322e27', '--rule': '#4a4439', '--rule-strong': '#5b5446', '--hours-shade': '#2b2721' });
    }
    v['--look-line'] = 'rgba(66, 104, 160, .16)'; v['--look-dot'] = 'rgba(40, 50, 70, .26)';
    dk['--look-line'] = 'rgba(150, 175, 220, .1)'; dk['--look-dot'] = 'rgba(200, 210, 230, .2)';
    // rings
    const R = RING[L.rings];
    if (R) { v['--ring-metal-1'] = R[0]; v['--ring-metal-2'] = R[1]; v['--ring-metal-3'] = R[2]; dk['--ring-metal-1'] = mix(R[0], '#000000', 0.15); dk['--ring-metal-2'] = mix(R[1], '#000000', 0.18); dk['--ring-metal-3'] = mix(R[2], '#000000', 0.2); }
    if (L.font === 'serif') v['--font-ui'] = 'var(--font-serif)';

    const block = o => Object.keys(o).map(k => k + ':' + o[k] + ';').join('');
    const tex = (TEX[L.texture] || TEX.leather)();
    const body = tex.concat(['radial-gradient(120% 90% at 20% 0%, var(--leather-2) 0%, transparent 60%)', 'radial-gradient(120% 120% at 100% 100%, var(--leather-3) 0%, transparent 55%)']);
    const pg = [PAPER_NOISE].concat((PAGE[P] || PAGE.plain)());
    const pgSize = ['auto'].concat((PAGE[P] || PAGE.plain)().map(() => PAGE_SIZE[P] || 'auto'));
    return ':root{' + block(v) + '}' +
      '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not([data-ed-theme="light"]){' + block(dk) + '}}' +
      ':root[data-theme="dark"]:not([data-ed-theme="light"]),:root[data-ed-theme="dark"]{' + block(dk) + '}' +
      'body{background-image:' + body.join(',') + ';}' +
      '.binder{background-image:' + tex.concat(['linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.12))']).join(',') + ';background-color:var(--leather-2);}' +
      '.modal-frame,.mframe{background-color:var(--leather-2);}' +
      '.page{background-image:' + pg.join(',') + ';background-size:' + pgSize.join(',') + ';}' +
      '.brand-title,.bc-emboss{color:var(--look-foil);}' +
      '.bc-rule{border-top-color:var(--look-foil);}' +
      '.tool.on,.toast > .ic{color:var(--look-foil-hi);}' +
      '.subnav .sub.on{background:var(--look-foil);color:var(--look-foil-ink);}' +
      (light ? '.subnav .sub{background:rgba(0,0,0,.07);}.brand-title{text-shadow:none;}.bc-emboss{text-shadow:0 1px 0 rgba(255,255,255,.4);}' : '') +
      '.bc-face{background-color:' + c + ';background-image:' + tex.concat(['radial-gradient(120% 90% at 30% 10%, ' + shade(c, 0.92, 1, light ? -4 : 9) + ' 0%, transparent 60%)', 'radial-gradient(120% 120% at 100% 100%, ' + shade(c, 1.08, light ? 0.75 : 0.5) + ' 0%, transparent 55%)', 'linear-gradient(90deg, rgba(0,0,0,.35) 0, rgba(0,0,0,.1) 5%, rgba(255,255,255,.06) 6.5%, transparent 9%)']).join(',') + ';}' +
      '.bc-stitch{border-color:' + (light ? 'rgba(0,0,0,.25)' : thread) + ';}' +
      '.book-back{background:' + shade(c, 1, light ? 0.6 : 0.45) + ';}';
  };

  let styleEl = null;
  const inject = css => {
    if (!styleEl) { styleEl = document.getElementById('ed-look'); }
    if (!css) { if (styleEl) { styleEl.remove(); styleEl = null; } return; }
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'ed-look'; }
    styleEl.textContent = css;
    if (styleEl.parentNode !== document.head || document.head.lastElementChild !== styleEl) document.head.appendChild(styleEl);   // last, so it wins
  };
  LK.apply = () => {
    if (!ED.store || !ED.store.data) return;
    const css = LK.css(LK.get());
    inject(css);
    try { if (css) localStorage.setItem(KEY, css); else localStorage.removeItem(KEY); } catch (err) { /* private window */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--leather').trim() || '#5c2618');
  };
  // before the diary opens: the look last used in this browser (so the closed cover is already in its colours)
  try { const c = localStorage.getItem(KEY); if (c) inject(c); } catch (err) { /* ignore */ }

  LK.set = patch => {
    const s = ED.store.data.settings;
    s.look = Object.assign({}, LK.get(), patch);
    if (!('preset' in patch)) s.look.preset = 'custom';
    ED.store.commit({ reason: 'look' });
    LK.apply();
  };
  LK.preset = id => {
    const p = PRESETS.find(x => x[0] === id); if (!p) return;
    const s = ED.store.data.settings;
    s.look = Object.assign({}, DEF, p[2], { preset: id, font: LK.get().font });
    ED.store.commit({ reason: 'look' });
    LK.apply();
  };

  /* ---------------- choosing ---------------- */
  const swatch = (k, val, name, cur) => '<label class="sw lk-sw" title="' + e(name) + '"><input type="radio" name="lk-' + k + '" data-lk="' + k + '" value="' + e(val) + '"' + (String(cur).toLowerCase() === String(val).toLowerCase() ? ' checked' : '') + ' aria-label="' + e(name) + '"><span style="--sw:' + e(val) + '"></span></label>';
  const custom = (k, cur, list) => {
    const known = list.some(x => x[0].toLowerCase() === String(cur).toLowerCase());
    return '<label class="sw sw-custom lk-sw" title="Any colour"><input type="radio" name="lk-' + k + '" data-lk-custom="' + k + '"' + (known ? '' : ' checked') + ' aria-label="Choose any colour"><span style="--sw:' + e(cur) + '"></span><input type="color" class="sw-color" data-lk-color="' + k + '" value="' + e(cur) + '" aria-label="Any colour"></label>';
  };
  const tile = (k, val, name, cur, style) => '<button type="button" class="lk-tile' + (cur === val ? ' on' : '') + '" data-lk-tile="' + k + '" data-v="' + e(val) + '" aria-pressed="' + (cur === val) + '"><i class="lk-prev" style="' + e(style) + '"></i><span>' + e(name) + '</span></button>';
  const paperStyle = (k, dark) => {
    const base = k === 'white' ? '#fdfdfb' : k === 'cream' ? '#f6efdf' : k === 'aged' ? '#f1e6cc' : '#f2f2ef';
    const layers = (PAGE[k] || PAGE.plain)().map(x => x.replace(/var\(--look-line\)/g, 'rgba(66,104,160,.22)').replace(/var\(--look-dot\)/g, 'rgba(40,50,70,.35)'));
    return 'background-color:' + base + ';' + (layers.length ? 'background-image:' + layers.join(',') + ';background-size:' + layers.map(() => (PAGE_SIZE[k] || 'auto').replace(/\d+/g, n => Math.round(n * 0.6))).join(',') + ';' : '');
  };
  LK.picker = () => {
    const L = LK.get();
    const preset = p => {
      const x = Object.assign({}, DEF, p[2]);
      return '<button type="button" class="lk-preset' + (L.preset === p[0] ? ' on' : '') + '" data-lk-preset="' + p[0] + '" aria-pressed="' + (L.preset === p[0]) + '">' +
        '<i class="lk-book" style="' + e(LK.textureCss(x.texture, x.cover)) + '"><i class="lk-paper" style="' + e(paperStyle(x.paper)) + '"></i><i class="lk-dot" style="background:' + e(x.accent) + '"></i></i><span>' + e(p[1]) + '</span></button>';
    };
    return '<div class="lk">' +
      '<h3 class="set-h">Ready-made looks</h3><div class="lk-presets">' + PRESETS.map(preset).join('') + '</div>' +
      '<h3 class="set-h">Cover colour</h3><div class="swatches lk-row">' + COVERS.map(x => swatch('cover', x[0], x[1], L.cover)).join('') + custom('cover', L.cover, COVERS) + '</div>' +
      '<h3 class="set-h">Cover texture</h3><div class="lk-tiles">' + TEXTURES.map(x => tile('texture', x[0], x[1], L.texture, LK.textureCss(x[0], L.cover))).join('') + '</div>' +
      '<h3 class="set-h">Pages</h3><div class="lk-tiles">' + PAPERS.map(x => tile('paper', x[0], x[1], L.paper, paperStyle(x[0]))).join('') + '</div>' +
      '<h3 class="set-h">Accent colour <span class="hint">buttons, links, today, the weather banner</span></h3><div class="swatches lk-row">' + ACCENTS.map(x => swatch('accent', x[0], x[1], L.accent)).join('') + custom('accent', L.accent, ACCENTS) + '</div>' +
      '<div class="lk-split"><div><h3 class="set-h">Rings</h3><div class="seg lk-seg" role="group" aria-label="Rings">' + RINGS.map(x => '<button type="button" data-lk-tile="rings" data-v="' + x[0] + '" aria-pressed="' + (L.rings === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div></div>' +
      '<div><h3 class="set-h">Lettering</h3><div class="seg lk-seg" role="group" aria-label="Lettering">' + FOILS.map(x => '<button type="button" data-lk-tile="foil" data-v="' + x[0] + '" aria-pressed="' + (L.foil === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div></div>' +
      '<div><h3 class="set-h">Text</h3><div class="seg lk-seg" role="group" aria-label="Text">' + FONTS.map(x => '<button type="button" data-lk-tile="font" data-v="' + x[0] + '" aria-pressed="' + (L.font === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div></div>' +
      '<div><h3 class="set-h">Light or dark</h3><div class="seg lk-seg" role="group" aria-label="Light or dark">' + [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(x => '<button type="button" data-lk-theme="' + x[0] + '" aria-pressed="' + ((ED.store.data.settings.theme || 'auto') === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div></div>' +
      '<div class="btn-row lk-foot"><button type="button" class="btn" data-lk-preset="classic">' + ED.icon('undo') + 'Back to Classic leather</button></div>' +
      '<p class="hint">The look is saved with the diary, so it is the same on every device you sync. Light or dark follows each device (Auto) unless you choose one.</p></div>';
  };
  LK.bind = (root, after) => {
    const redo = () => { if (after) after(); };
    root.addEventListener('click', ev => {
      const p = ev.target.closest('[data-lk-preset]'); if (p) { LK.preset(p.dataset.lkPreset); redo(); return; }
      const t = ev.target.closest('[data-lk-tile]'); if (t) { LK.set({ [t.dataset.lkTile]: t.dataset.v }); redo(); return; }
      const th = ev.target.closest('[data-lk-theme]'); if (th) { ED.store.data.settings.theme = th.dataset.lkTheme; ED.app.applyTheme(); ED.store.commit(); redo(); }
    });
    root.addEventListener('change', ev => {
      const r = ev.target.closest('[data-lk]'); if (r && r.checked) { LK.set({ [r.dataset.lk]: r.value }); redo(); return; }
      const c = ev.target.closest('[data-lk-color]'); if (c) { LK.set({ [c.dataset.lkColor]: c.value }); redo(); }
    });
    root.addEventListener('input', ev => {   // live while dragging in the colour picker
      const c = ev.target.closest('[data-lk-color]'); if (!c) return;
      const s = ED.store.data.settings; s.look = Object.assign({}, LK.get(), { [c.dataset.lkColor]: c.value, preset: 'custom' }); inject(LK.css(LK.get()));
      const sp = c.parentNode.querySelector('span'); if (sp) sp.style.setProperty('--sw', c.value);
    });
  };

  /* Settings → Appearance (js/settings.js lists the tab) */
  if (ED.settings) {
    ED.settings.tab_look = () => LK.picker();
    ED.settings.bind_look = b => LK.bind(b, () => ED.settings.refresh());
  }
  /* the palette button in the top bar: quick looks */
  (ED.actions = ED.actions || {}).look = el => {
    const L = LK.get();
    ED.ui.popover(el, '<div class="lk-pop"><b class="lk-pop-h">Diary look</b><div class="lk-mini">' + PRESETS.map(p => { const x = Object.assign({}, DEF, p[2]); return '<button type="button" class="lk-m' + (L.preset === p[0] ? ' on' : '') + '" data-lk-preset="' + p[0] + '" title="' + e(p[1]) + '" aria-label="' + e(p[1]) + '"><i style="' + e(LK.textureCss(x.texture, x.cover)) + '"><b style="background:' + e(x.accent) + '"></b></i></button>'; }).join('') + '</div>' +
      '<button type="button" class="btn small" data-lk-more>' + ED.icon('palette') + 'Colours, textures and pages…</button></div>', {
      onMount(box, pop) {
        box.addEventListener('click', ev => {
          const p = ev.target.closest('[data-lk-preset]');
          if (p) { LK.preset(p.dataset.lkPreset); U.$$('.lk-m', box).forEach(b => b.classList.toggle('on', b === p)); ED.ui.toast('Look: ' + (PRESETS.find(x => x[0] === p.dataset.lkPreset) || [, ''])[1]); return; }
          if (ev.target.closest('[data-lk-more]')) { pop.close(true); ED.settings.open('look'); }
        });
      },
    });
  };
})();
