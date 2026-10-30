/* E-Diary — Hindu calendar (Panchang) worked out on the device, no internet needed (added in 1.16).
   Sun and Moon positions from the standard low-precision formulae (Meeus, "Astronomical Algorithms", ch. 25 and 47 —
   good to a few hundredths of a degree), Lahiri ayanamsha for the sidereal (nirayana) places, and sunrise/sunset for
   the diary's city (Settings → Weather; New Delhi by default).
     ED.panchang.day('YYYY-MM-DD') → { tithi, paksha, tithiName, tithiEnds, nakshatra, yoga, month (amanta and
       purnimanta), adhik, vara, samvat (Vikram, Shaka), ritu, sunrise, sunset, festivals: [..], vrats: [keys] }
   The day's tithi is the one at sunrise (udaya tithi). A few festivals follow the tithi at another time of day
   (Diwali and Dhanteras at sunset, Karva Chauth at moonrise, Janmashtami and Shivaratri at midnight).
   Local almanacs can differ by a day when a tithi changes close to these times. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util;
  const P = (ED.panchang = {});
  const R = Math.PI / 180;
  const n360 = x => ((x % 360) + 360) % 360;
  const sin = d => Math.sin(d * R);

  P.TITHI = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
  P.MONTHS = ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashwin', 'Kartik', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'];
  P.HINDI_MONTHS = ['चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ़', 'श्रावण', 'भाद्रपद', 'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन'];
  P.NAK = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
  P.YOGA = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
  P.VARA = ['Ravivar', 'Somvar', 'Mangalvar', 'Budhvar', 'Guruvar', 'Shukravar', 'Shanivar'];
  P.RASHI = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
  P.RITU = ['Vasant (spring)', 'Grishma (summer)', 'Varsha (monsoon)', 'Sharad (autumn)', 'Hemant (pre-winter)', 'Shishir (winter)'];

  /* ---------------- astronomy ---------------- */
  const jdOf = ms => ms / 864e5 + 2440587.5;
  const T = jd => (jd - 2451545) / 36525;
  P.sun = jd => {                                   // apparent tropical longitude of the Sun (degrees)
    const t = T(jd);
    const L0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
    const M = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
    const C = (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(M) + (0.019993 - 0.000101 * t) * sin(2 * M) + 0.000289 * sin(3 * M);
    return n360(L0 + C - 0.00569 - 0.00478 * sin(125.04 - 1934.136 * t));
  };
  // main periodic terms of the Moon's longitude: D, M, M', F, coefficient (1e-6 degree)
  const ML = [[0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758],
    [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720], [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
    [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036], [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
    [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773], [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
    [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537], [4, -1, 0, 0, 520], [1, 0, -2, 0, -487]];
  P.moon = jd => {                                  // tropical longitude of the Moon (degrees)
    const t = T(jd);
    const Lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t;
    const D = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t;
    const M = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t;
    const Mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t;
    const F = 93.272095 + 483202.0175233 * t - 0.0036539 * t * t;
    const E = 1 - 0.002516 * t - 0.0000074 * t * t;
    let s = 0;
    for (const [d, m, mp, f, c] of ML) s += c * (Math.abs(m) === 1 ? E : m ? E * E : 1) * sin(d * D + m * M + mp * Mp + f * F);
    s += 3958 * sin(119.75 + 131.849 * t) + 1962 * sin(Lp - F) + 318 * sin(53.09 + 479264.29 * t);
    return n360(Lp + s / 1e6 - 0.00478 * sin(125.04 - 1934.136 * t));
  };
  P.ayanamsa = jd => 23.85306 + 1.39722 * T(jd) + 0.00018 * T(jd) * T(jd);     // Lahiri (Chitrapaksha)
  const elong = jd => n360(P.moon(jd) - P.sun(jd));
  /* the moment the Moon is `target` degrees ahead of the Sun, near jd0 */
  const solveElong = (jd0, target) => {
    let jd = jd0;
    for (let i = 0; i < 8; i++) {
      let d = n360(target - elong(jd)); if (d > 180) d -= 360;
      jd += d / 12.190749;
      if (Math.abs(d) < 1e-5) break;
    }
    return jd;
  };
  P.newMoonBefore = jd => { const e0 = elong(jd); return solveElong(jd - e0 / 12.19, 0); };

  /* ---------------- place and sunrise ---------------- */
  P.place = () => {
    const w = (ED.store && ED.store.data && ED.store.data.settings && ED.store.data.settings.weather) || {};
    const lat = isFinite(+w.lat) && w.lat !== '' && w.lat != null ? +w.lat : 28.6139, lon = isFinite(+w.lon) && w.lon !== '' && w.lon != null ? +w.lon : 77.209;
    return { lat, lon, name: w.name || 'New Delhi', tz: -new Date().getTimezoneOffset() / 60 };
  };
  /* sunrise / sunset in local clock minutes for a date (NOAA simple algorithm) */
  P.sunTimes = (k, pl) => {
    pl = pl || P.place();
    const [y, mo, d] = U.ymd(k);
    const N = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 864e5);
    const g = 2 * Math.PI / 365 * (N - 1);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const tz = -new Date(y, mo - 1, d, 12).getTimezoneOffset();
    const cosH = (Math.cos(90.833 * R) - Math.sin(pl.lat * R) * Math.sin(decl)) / (Math.cos(pl.lat * R) * Math.cos(decl));
    const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / R;
    const noon = 720 - 4 * pl.lon - eqt + tz;
    return { rise: noon - 4 * H, set: noon + 4 * H };
  };
  const localMs = (k, min) => { const [y, mo, d] = U.ymd(k); return new Date(y, mo - 1, d, 0, 0, 0).getTime() + min * 6e4; };
  const fmtMin = ms => { const d = new Date(ms); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };

  /* ---------------- the elements at a moment ---------------- */
  const cache = new Map();
  P.at = ms => {
    const jd = jdOf(ms), su = P.sun(jd), mo = P.moon(jd), ay = P.ayanamsa(jd);
    const el = n360(mo - su);
    const tithi = Math.floor(el / 12) + 1;                         // 1–30 (16–30 = Krishna paksha)
    const sSid = n360(su - ay), mSid = n360(mo - ay);
    // the lunar month (amanta): named from the Sun's sign at the new moon that began it; adhik when two begin in one sign
    const nm = P.newMoonBefore(jd), nm2 = solveElong(nm + 29.53, 0);
    const r1 = Math.floor(n360(P.sun(nm) - P.ayanamsa(nm)) / 30), r2 = Math.floor(n360(P.sun(nm2) - P.ayanamsa(nm2)) / 30);
    const adhik = r1 === r2;
    const am = (r1 + 1) % 12;
    return { jd, el, tithi, nak: Math.floor(mSid / (360 / 27)), yoga: Math.floor(n360(sSid + mSid) / (360 / 27)), rashiSun: Math.floor(sSid / 30), rashiMoon: Math.floor(mSid / 30), am, adhik };
  };
  const at = (k, min) => P.at(localMs(k, min));
  P.tithiLabel = n => (n <= 15 ? 'Shukla ' : 'Krishna ') + (n === 15 ? 'Purnima' : n === 30 ? 'Amavasya' : P.TITHI[(n - 1) % 15]);
  P.tithiShort = n => n === 15 ? 'Purnima' : n === 30 ? 'Amavasya' : P.TITHI[(n - 1) % 15];

  /* ---------------- festivals and vrats ----------------
     amanta month (0 = Chaitra … 11 = Phalguna), tithi 1–30 (Shukla 1–15, Krishna 16–30), when: rise|noon|aft|set|night|mid */
  const FEST = [
    [0, 1, 'Chaitra Navratri begins · Gudi Padwa / Ugadi · Hindu New Year', 'rise', 'navratri'], [0, 9, 'Ram Navami', 'noon', 'ramnavami'], [0, 15, 'Hanuman Jayanti', 'rise'],
    [1, 3, 'Akshaya Tritiya', 'rise'], [1, 15, 'Buddha Purnima', 'rise'], [1, 30, 'Vat Savitri Vrat (Shani Jayanti)', 'rise', 'vatsavitri'],
    [2, 10, 'Ganga Dussehra', 'rise'], [2, 15, 'Vat Purnima · Kabir Jayanti', 'rise'],
    [3, 2, 'Jagannath Rath Yatra', 'rise'], [3, 11, 'Chaturmas begins (Devshayani Ekadashi)', 'rise'], [3, 15, 'Guru Purnima', 'rise'],
    [4, 3, 'Hariyali Teej', 'rise', 'teej'], [4, 5, 'Nag Panchami', 'rise'], [4, 15, 'Raksha Bandhan', 'rise'], [4, 18, 'Kajari Teej', 'rise'], [4, 23, 'Krishna Janmashtami', 'mid', 'janmashtami'],
    [5, 3, 'Hartalika Teej', 'rise', 'hartalika'], [5, 4, 'Ganesh Chaturthi', 'noon'], [5, 14, 'Anant Chaturdashi · Ganesh Visarjan', 'rise'], [5, 16, 'Pitru Paksha begins', 'rise'], [5, 30, 'Sarva Pitru Amavasya (Mahalaya)', 'rise'],
    [6, 1, 'Sharad Navratri begins · Ghatasthapana', 'rise', 'navratri'], [6, 8, 'Durga Ashtami', 'rise'], [6, 9, 'Maha Navami', 'rise'], [6, 10, 'Dussehra / Vijayadashami', 'aft'], [6, 15, 'Sharad Purnima', 'set'],
    [6, 19, 'Karva Chauth', 'night', 'karvachauth'], [6, 23, 'Ahoi Ashtami', 'night', 'ahoi'], [6, 28, 'Dhanteras', 'set'], [6, 29, 'Narak Chaturdashi / Chhoti Diwali', 'rise'], [6, 30, 'Diwali — Lakshmi Puja', 'set'],
    [7, 1, 'Govardhan Puja', 'rise'], [7, 2, 'Bhai Dooj', 'rise'], [7, 6, 'Chhath Puja', 'set', 'chhath'], [7, 11, 'Dev Uthani Ekadashi · Tulsi Vivah', 'rise'], [7, 15, 'Kartik Purnima · Guru Nanak Jayanti · Dev Deepawali', 'rise'],
    [8, 11, 'Gita Jayanti', 'rise'], [8, 15, 'Dattatreya Jayanti', 'rise'],
    [9, 15, 'Paush Purnima', 'rise'], [9, 30, 'Mauni Amavasya', 'rise'],
    [10, 5, 'Vasant Panchami', 'rise'], [10, 15, 'Magha Purnima', 'rise'], [10, 29, 'Maha Shivaratri', 'mid', 'mahashivaratri'],
    [11, 15, 'Holika Dahan', 'rise'], [11, 16, 'Holi', 'rise'],
  ];
  // Ekadashi names by purnimanta month: [Krishna, Shukla]
  const EKA = [['Papmochani', 'Kamada'], ['Varuthini', 'Mohini'], ['Apara', 'Nirjala'], ['Yogini', 'Devshayani'], ['Kamika', 'Shravana Putrada'], ['Aja', 'Parivartini'], ['Indira', 'Papankusha'], ['Rama', 'Devutthana (Prabodhini)'], ['Utpanna', 'Mokshada'], ['Saphala', 'Pausha Putrada'], ['Shattila', 'Jaya'], ['Vijaya', 'Amalaki']];
  P.ekadashiName = (am, tithi) => tithi === 11 ? EKA[am][1] + ' Ekadashi' : EKA[(am + 1) % 12][0] + ' Ekadashi';

  /* the minutes of the day at which a festival's tithi is looked at */
  const whenMin = (w, s) => w === 'noon' ? (s.rise + s.set) / 2 : w === 'aft' ? s.rise + (s.set - s.rise) * 0.7 : w === 'set' ? s.set + 20 : w === 'night' ? s.set + 110 : w === 'mid' ? 24 * 60 - 1 : s.rise + 5;

  P.day = k => {
    const pl = P.place(), ck = k + '|' + pl.lat + ',' + pl.lon;
    if (cache.has(ck)) return cache.get(ck);
    const s = P.sunTimes(k, pl), sN = P.sunTimes(U.addDays(k, 1), pl);
    const a = at(k, s.rise + 5), b = at(U.addDays(k, 1), sN.rise + 5);
    const tithi = a.tithi, paksha = tithi <= 15 ? 'Shukla' : 'Krishna';
    // tithis during the day: the one at sunrise and, rarely, one that begins and ends before the next sunrise (kshaya)
    const present = [tithi]; if (((b.tithi - tithi + 30) % 30) === 2) present.push(tithi % 30 + 1);
    const ends = solveElong(a.jd, (tithi * 12) % 360);
    const endMs = (ends - 2440587.5) * 864e5;
    const nakEndJd = (() => { let jd = a.jd; const target = (a.nak + 1) * 360 / 27; for (let i = 0; i < 8; i++) { const m = n360(P.moon(jd) - P.ayanamsa(jd)); let d = n360(target - m); if (d > 180) d -= 360; jd += d / 13.176; if (Math.abs(d) < 1e-4) break; } return jd; })();
    const am = a.am, pm = tithi > 15 ? (am + 1) % 12 : am;
    const [y, mo] = U.ymd(k);
    const vs = y + (mo <= 4 && am >= 9 ? 56 : 57);
    const out = {
      key: k, tithi, paksha, tithiName: P.tithiShort(tithi), label: P.tithiLabel(tithi),
      tithiEnds: endMs < localMs(U.addDays(k, 1), sN.rise) ? fmtMin(endMs) : null,
      kshaya: present.length > 1 ? P.tithiShort(present[1]) : null,
      nakshatra: P.NAK[a.nak], nakEnds: (nakEndJd - 2440587.5) * 864e5 < localMs(U.addDays(k, 1), sN.rise) ? fmtMin((nakEndJd - 2440587.5) * 864e5) : null,
      yoga: P.YOGA[a.yoga], vara: P.VARA[U.dow(k)],
      amanta: am, purnimanta: pm, adhik: a.adhik,
      month: (a.adhik ? 'Adhik ' : '') + P.MONTHS[pm], monthAmanta: (a.adhik ? 'Adhik ' : '') + P.MONTHS[am], monthHindi: P.HINDI_MONTHS[pm],
      samvat: vs, shaka: vs - 135, ritu: P.RITU[Math.floor(((a.rashiSun + 1) % 12) / 2)],
      sunSign: P.RASHI[a.rashiSun], moonSign: P.RASHI[a.rashiMoon],
      sunrise: U.fromMin(s.rise), sunset: U.fromMin(s.set), place: pl.name,
      festivals: [], vrats: [],
    };
    // festivals by tithi (the tithi at the time that matters for each)
    FEST.forEach(f => {
      const m = whenMin(f[3], s);
      const x = f[3] === 'rise' ? a : at(k, m);
      let hit = x.am === f[0] && x.tithi === f[1] && !x.adhik;
      if (!hit && f[3] === 'rise' && present.length > 1 && present[1] === f[1] && a.am === f[0] && !a.adhik) hit = true;
      if (hit && f[3] !== 'rise') {   // only the first evening on which the tithi is current
        const sp = P.sunTimes(U.addDays(k, -1), pl), y0 = at(U.addDays(k, -1), whenMin(f[3], sp));
        if (y0.am === f[0] && y0.tithi === f[1]) hit = false;
      }
      if (hit) { out.festivals.push(f[2]); if (f[4]) out.vrats.push(f[4]); }
    });
    // Sankranti: the Sun enters a new sidereal sign between this sunrise and the next
    if (a.rashiSun !== b.rashiSun) {
      const nm = ['Mesha Sankranti · Baisakhi', 'Vrishabha Sankranti', 'Mithuna Sankranti', 'Karka Sankranti', 'Simha Sankranti', 'Kanya Sankranti', 'Tula Sankranti', 'Vrishchika Sankranti', 'Dhanu Sankranti', 'Makar Sankranti · Pongal · Uttarayan', 'Kumbha Sankranti', 'Meena Sankranti'][b.rashiSun];
      out.festivals.push(nm); out.sankranti = true;
      if (b.rashiSun === 9) out.vrats.push('sankranti');
    }
    if (a.rashiSun === 8 && b.rashiSun === 8) { const k2 = U.addDays(k, 2); if (at(k2, P.sunTimes(k2, pl).rise + 5).rashiSun === 9) out.festivals.push('Lohri'); }
    // the monthly vrats
    const has = n => present.indexOf(n) >= 0;
    if (has(11) || has(26)) { out.vrats.push('ekadashi'); out.ekadashi = P.ekadashiName(am, has(11) ? 11 : 26); }
    if (has(13) || has(28)) out.vrats.push('pradosh');
    if (has(15)) out.vrats.push('purnima');
    if (has(30)) out.vrats.push('amavasya');
    if (has(4)) out.vrats.push('vinayaka');
    if (has(29)) out.vrats.push('shivaratri');
    if (has(8)) out.vrats.push('durgashtami');
    if (has(6)) out.vrats.push('skanda');
    // Sankashti Chaturthi: Krishna chaturthi current at moonrise (about 2½ hours after sunset)
    const kc = at(k, s.set + 150);
    if (kc.tithi === 19) { const sp = P.sunTimes(U.addDays(k, -1), pl), y0 = at(U.addDays(k, -1), sp.set + 150); if (y0.tithi !== 19) out.vrats.push('sankashti'); }
    const dw = U.dow(k);
    out.vrats.push(['ravivar', 'somvar', 'mangalvar', 'budhvar', 'guruvar', 'shukravar', 'shanivar'][dw]);
    // Navratri days (Chaitra and Sharad): Shukla 1–9
    if ((am === 0 || am === 6) && !a.adhik && tithi >= 1 && tithi <= 9) { out.vrats.push('navratri'); out.navratriDay = tithi; }
    out.vrats = out.vrats.filter((v, i, l) => l.indexOf(v) === i);
    if (cache.size > 800) cache.clear();
    cache.set(ck, out);
    return out;
  };
  P.clearCache = () => cache.clear();
  /* the next days (from k) on which a vrat key falls */
  P.next = (key, from, days) => { const out = []; for (let i = 0; i < (days || 60); i++) { const k = U.addDays(from, i); if (P.day(k).vrats.indexOf(key) >= 0) out.push(k); } return out; };
})();
