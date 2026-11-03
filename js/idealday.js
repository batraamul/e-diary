/* E-Diary — 1.21: Ideal Day (Purpose → Ideal Day).
   Your best day, hour by hour, for each season (IMD's four seasons by default; which month belongs to which season can
   be changed) and for a working day and a holiday.
   Left page:  the season, the month ribbon, working day / holiday, and the day as a time-line of blocks (click to change).
   Right page: a 24-hour clock of the day, hours by kind, a balance check, the seasons compared, "now and next" for today,
               and "Put in Daily tasks" for any date.
   Data: ED.store.data.ideal = { months: { 1..12: seasonId }, blocks: [ { id, s, t: 'work' | 'off', from, to, what, cat, notes, updatedAt } ] }
   A block whose end is before its start runs past midnight (sleep). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const FX = () => ED.fx;
  const A = (ED.actions = ED.actions || {});
  const D = () => ED.store.data;
  const ID = (ED.ideal = {});
  const SEASONS = [
    { id: 'winter', name: 'Winter', icon: '❄️', months: [1, 2], c: '#3b82f6', note: 'Short, cold days: a later start, sunlight in the morning, exercise indoors or at noon.' },
    { id: 'summer', name: 'Summer', icon: '☀️', months: [3, 4, 5], c: '#f59e0b', note: 'Pre-monsoon heat: up early, outdoors before 8, rest in the hot afternoon, plenty of water.' },
    { id: 'monsoon', name: 'Monsoon', icon: '🌧️', months: [6, 7, 8, 9], c: '#10b981', note: 'Rain and humidity: indoor workouts, extra time for the commute, light food.' },
    { id: 'autumn', name: 'Post-monsoon', icon: '🍂', months: [10, 11, 12], c: '#ea580c', note: 'Pleasant mornings and early dusk: the best season for walks and cycling.' },
  ];
  const CATS = [
    ['sleep', 'Sleep', '😴', '#6366f1'], ['self', 'Prayer & self-care', '🙏', '#f59e0b'], ['exercise', 'Exercise', '🏃', '#16a34a'], ['meal', 'Meals', '🍽️', '#ea580c'],
    ['work', 'Office work', '💼', '#2563eb'], ['study', 'Study & research', '📚', '#7c3aed'], ['family', 'Family', '👨‍👩‍👦', '#db2777'], ['commute', 'Commute', '🚗', '#64748b'],
    ['chores', 'Home & chores', '🧹', '#0d9488'], ['leisure', 'Leisure & rest', '🎵', '#ca8a04'], ['plan', 'Planning & reflection', '📝', '#0891b2'], ['other', 'Other', '⏳', '#78716c'],
  ];
  ID.CATS = CATS; ID.SEASONS = SEASONS;
  const cat = id => CATS.find(c => c[0] === id) || CATS[CATS.length - 1];
  const TYPES = [['work', '💼 Working day'], ['off', '🏖️ Holiday']];
  const IDL = () => { const d = D(); if (!d.ideal || typeof d.ideal !== 'object') d.ideal = {}; const x = d.ideal; if (!Array.isArray(x.blocks)) x.blocks = []; if (!x.months || typeof x.months !== 'object') x.months = {}; return x; };
  const st = () => ED.state.ideal || (ED.state.ideal = {});
  const seasonOfMonth = m => IDL().months[m] || (SEASONS.find(s => s.months.indexOf(m) >= 0) || SEASONS[0]).id;
  ID.seasonOn = k => seasonOfMonth(+k.slice(5, 7));
  const season = id => SEASONS.find(s => s.id === id) || SEASONS[0];
  const monthsOf = id => { const out = []; for (let m = 1; m <= 12; m++) if (seasonOfMonth(m) === id) out.push(m); return out; };
  const monthsLabel = id => { const m = monthsOf(id); if (!m.length) return 'no months'; return m.length > 2 && m.every((x, i) => !i || x === m[i - 1] + 1) ? U.MON[m[0] - 1] + '–' + U.MON[m[m.length - 1] - 1] : m.map(x => U.MON[x - 1]).join(', '); };
  ID.isOff = k => { const d = U.dow(k); return d === 0 || d === 6 || M.eventsOn(k).some(ev => ev.holiday); };
  const curS = () => st().s || ID.seasonOn(U.today());
  const curT = () => st().t || (ID.isOff(U.today()) ? 'off' : 'work');
  const len = b => ((U.toMin(b.to) - U.toMin(b.from)) + 1440) % 1440 || 0;
  const blocks = (s, t) => IDL().blocks.filter(b => b.s === s && b.t === t).sort((a, b) => U.toMin(a.from) - U.toMin(b.from));
  const hm = m => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h ? h + ' h' + (r ? ' ' + r + ' m' : '') : r + ' m'; };
  const ft = t => FX().time(t);

  /* ---------------- a suggested day for each season ---------------- */
  const WAKE = { winter: '06:00', summer: '05:00', monsoon: '05:30', autumn: '05:30' };
  const EXER = { winter: 'Yoga & stretching indoors · sunlight', summer: 'Morning walk / cycling before the heat', monsoon: 'Indoor workout / yoga', autumn: 'Brisk walk / cycling ride' };
  ID.suggest = (s, t) => {
    const W = U.toMin(WAKE[s] || '05:30') + (t === 'off' ? 30 : 0);
    const sleep = U.fromMin(W - 7.5 * 60 + 1440 * (W - 450 < 0 ? 1 : 0));
    const at = m => U.fromMin(m);
    const out = [];
    const b = (from, to, cat0, what) => out.push({ from, to, cat: cat0, what });
    b(at(W), at(W + 30), 'self', 'Wake up · water · prayer / meditation');
    if (t === 'work') {
      b(at(W + 30), at(W + 80), 'exercise', EXER[s] || 'Exercise');
      b(at(W + 80), at(W + 110), 'self', 'Bath & get ready');
      b(at(W + 110), at(W + 140), 'meal', 'Breakfast with family');
      if (W + 140 < U.toMin('08:40')) b(at(W + 140), '08:45', 'study', 'Reading / research (papers, thesis)');
      b('08:45', '09:30', 'commute', 'Commute to office');
      b('09:30', '13:00', 'work', 'Office — the hardest work first');
      b('13:00', '13:45', 'meal', 'Lunch and a short walk');
      b('13:45', '17:30', 'work', 'Office — meetings, files, mails');
      b('17:30', '18:15', 'commute', 'Commute home');
      b('18:15', '19:15', 'family', s === 'summer' ? 'Tea with family · evening walk after sunset' : 'Tea and time with family');
      b('19:15', '20:30', 'study', 'Study / writing (deep work)');
      b('20:30', '21:15', 'meal', 'Dinner with family');
      b('21:15', at(Math.min(U.toMin(sleep) || 1440, 23 * 60) - 0), 'plan', 'Plan tomorrow · diary · gratitude');
    } else {
      b(at(W + 30), at(W + 105), 'exercise', s === 'monsoon' ? 'Yoga / home workout' : 'Long walk / cycling ride');
      b(at(W + 105), at(W + 135), 'self', 'Bath & pooja');
      b(at(W + 135), at(W + 180), 'meal', 'Leisurely breakfast');
      b(at(W + 180), '12:00', 'chores', 'Home chores, groceries, errands');
      b('12:00', '13:30', 'family', 'Family time');
      b('13:30', '14:15', 'meal', 'Lunch');
      b('14:15', '15:30', 'leisure', s === 'summer' ? 'Rest in the hot afternoon / nap' : 'Rest / read');
      b('15:30', '17:30', 'study', 'Study / project work');
      b('17:30', '19:30', 'family', 'Outing / friends / family');
      b('19:30', '20:15', 'meal', 'Dinner');
      b('20:15', '21:00', 'plan', 'Plan the week · review goals');
      b('21:00', at(Math.min(U.toMin(sleep) || 1440, 23 * 60)), 'leisure', 'Music / reading — screens off');
    }
    out[out.length - 1].to = sleep;
    b(sleep, at(W), 'sleep', 'Sleep');
    return out.filter(x => x.from !== x.to);
  };
  const fill = (s, t, list) => { const L = IDL().blocks; list.forEach(x => L.push(Object.assign({ id: U.uid('id'), s, t, notes: '', updatedAt: Date.now() }, x))); };

  /* minutes of each kind in a day; unplanned time counts as free */
  const byCat = list => {
    const out = {}; let used = 0;
    list.forEach(b => { const m = len(b); out[b.cat] = (out[b.cat] || 0) + m; used += m; });
    out._free = Math.max(0, 1440 - used); out._used = used; return out;
  };
  const overlaps = list => {
    const segs = []; list.forEach(b => { const a = U.toMin(b.from), l = len(b); if (a + l <= 1440) segs.push([a, a + l, b]); else { segs.push([a, 1440, b]); segs.push([0, a + l - 1440, b]); } });
    segs.sort((x, y) => x[0] - y[0]); const bad = [];
    for (let i = 1; i < segs.length; i++) if (segs[i][0] < segs[i - 1][1] && segs[i][2] !== segs[i - 1][2]) bad.push([segs[i - 1][2], segs[i][2]]);
    return bad;
  };
  ID.nowNext = k => {
    const list = blocks(ID.seasonOn(k), ID.isOff(k) ? 'off' : 'work'); if (!list.length) return null;
    const n = U.nowMin();
    const now = list.find(b => { const a = U.toMin(b.from), l = len(b); return (n - a + 1440) % 1440 < l; });
    const next = list.filter(b => b !== now).map(b => ({ b, d: (U.toMin(b.from) - n + 1440) % 1440 })).sort((x, y) => x.d - y.d)[0];
    return { now, next: next ? next.b : null, list };
  };

  /* ---------------- left page ---------------- */
  const PX = 0.6;   // pixels per minute on the time-line
  const left = () => {
    const s = curS(), t = curT(), list = blocks(s, t), today = U.today(), ss = season(s);
    const nowS = ID.seasonOn(today), nowT = ID.isOff(today) ? 'off' : 'work';
    const cards = '<div class="id-seasons" role="group" aria-label="Season">' + SEASONS.map(x => '<button type="button" class="id-sc' + (x.id === s ? ' sel' : '') + '" style="--c:' + x.c + '" data-act="id-season" data-k="' + x.id + '" aria-pressed="' + (x.id === s) + '">' +
      '<span class="id-si" aria-hidden="true">' + x.icon + '</span><b>' + e(x.name) + '</b><span class="hint">' + e(monthsLabel(x.id)) + '</span>' + (x.id === nowS ? '<i class="id-now">now</i>' : '') + '</button>').join('') + '</div>';
    const curM = +today.slice(5, 7);
    const ribbon = '<div class="id-ribbon" role="group" aria-label="Months">' + U.MON.map((m, i) => { const sid = seasonOfMonth(i + 1), x = season(sid); return '<button type="button" class="id-m' + (sid === s ? ' on' : '') + (i + 1 === curM ? ' cur' : '') + '" style="--c:' + x.c + '" data-act="id-season" data-k="' + sid + '" title="' + e(U.MONTHS[i] + ' — ' + x.name) + '">' + m.slice(0, 3) + '</button>'; }).join('') + '</div>';
    const seg = '<div class="seg id-type" role="group" aria-label="Day">' + TYPES.map(x => '<button type="button" data-act="id-type" data-k="' + x[0] + '" aria-pressed="' + (x[0] === t) + '">' + x[1] + '</button>').join('') + '</div>';
    let tl;
    if (!list.length) {
      const other = SEASONS.filter(x => x.id !== s && blocks(x.id, t).length).concat(blocks(s, t === 'work' ? 'off' : 'work').length ? [{ id: s, name: (t === 'work' ? 'the holiday' : 'the working day') + ' of ' + ss.name, same: true }] : []);
      tl = '<div class="id-empty"><span aria-hidden="true">' + ss.icon + '</span><b>No ' + (t === 'work' ? 'working day' : 'holiday') + ' planned for ' + e(ss.name) + ' yet.</b><p class="hint">' + e(ss.note) + '</p>' +
        '<div class="row-btns"><button type="button" class="btn small primary" data-act="id-suggest">' + ED.icon('sparkle') + 'Start from a suggested ' + e(ss.name.toLowerCase()) + ' day</button>' +
        other.map(x => '<button type="button" class="btn small" data-act="id-copy" data-from="' + x.id + '" data-ft="' + (x.same ? (t === 'work' ? 'off' : 'work') : t) + '">' + ED.icon('copy') + 'Copy ' + e(x.same ? x.name : x.name + '’s') + '</button>').join('') +
        '<button type="button" class="btn small ghost" data-act="id-add">' + ED.icon('plus') + 'Add a block</button></div></div>';
    } else {
      // the window shown: from an hour before waking (the end of the night's sleep) to midnight
      const sl = list.find(b => b.cat === 'sleep' && U.toMin(b.to) < U.toMin(b.from));
      const start = Math.max(0, Math.min(sl ? U.toMin(sl.to) - 60 : 300, ...list.filter(b => b.cat !== 'sleep').map(b => U.toMin(b.from))) - 0);
      const w0 = Math.floor(start / 60) * 60, w1 = 1440, H = (w1 - w0) * PX;
      const showNow = s === nowS && t === nowT, n = U.nowMin();
      let hours = ''; for (let h = w0; h <= w1; h += 60) hours += '<span class="id-hr" style="top:' + ((h - w0) * PX) + 'px">' + e(ft(U.fromMin(Math.min(h, 1439))).replace(':00', '').replace('23:59', '24').replace(/^11:59 PM$/, '12 AM')) + '</span>';
      const segs = [];
      list.forEach(b => { const a = U.toMin(b.from), l = len(b); if (!l) return; const parts = a + l <= 1440 ? [[a, a + l]] : [[a, 1440], [0, a + l - 1440]]; parts.forEach(p => { const y0 = Math.max(p[0], w0), y1 = Math.min(p[1], w1); if (y1 > y0) segs.push({ b, y0, y1 }); }); });
      const bl = segs.map(({ b, y0, y1 }) => {
        const c = cat(b.cat), h = (y1 - y0) * PX, l = len(b), live = showNow && ((n - U.toMin(b.from) + 1440) % 1440 < l);
        return '<button type="button" class="id-b' + (h < 26 ? ' tiny' : h < 44 ? ' small' : '') + (live ? ' live' : '') + '" style="top:' + ((y0 - w0) * PX) + 'px;height:' + Math.max(12, h - 2) + 'px;--c:' + c[3] + '" data-act="id-edit" data-id="' + e(b.id) + '" title="' + e(ft(b.from) + ' – ' + ft(b.to) + ' · ' + b.what) + '">' +
          '<span class="id-bi" aria-hidden="true">' + c[2] + '</span><span class="id-bt"><b>' + e(b.what || c[1]) + '</b><span class="num">' + e(ft(b.from)) + ' – ' + e(ft(b.to)) + ' · ' + hm(l) + '</span></span></button>';
      }).join('');
      const nowLine = showNow && n >= w0 ? '<div class="id-nowl" style="top:' + ((n - w0) * PX) + 'px"><span>' + e(ft(U.fromMin(n))) + '</span></div>' : '';
      const bad = overlaps(list);
      tl = (bad.length ? '<div class="notice warn">' + ED.icon('info') + '<span class="grow">' + e(bad.slice(0, 3).map(x => '“' + x[0].what + '” and “' + x[1].what + '” overlap').join('; ')) + '.</span></div>' : '') +
        '<div class="id-tl" style="height:' + H + 'px"><div class="id-hours">' + hours + '</div><div class="id-lane">' + bl + nowLine + '</div></div>';
    }
    const tools = '<button type="button" class="btn small primary" data-act="id-add">' + ED.icon('plus') + 'Block</button><button type="button" class="icon-btn" data-act="id-menu" aria-label="More" title="More">' + ED.icon('more') + '</button>';
    return FX().page('id', 'Ideal day', tools, cards + ribbon + '<div class="id-bar">' + seg + '<span class="hint id-sn">' + e(ss.note) + '</span></div>' + tl, 'id-l');
  };

  /* ---------------- right page: the informatics ---------------- */
  const clock = (list, showNow) => {
    const R = 92, r0 = 64, C = 110, ang = m => (m / 1440) * 2 * Math.PI - Math.PI / 2;
    const pt = (m, rr) => [C + rr * Math.cos(ang(m)), C + rr * Math.sin(ang(m))];
    const arc = (a, b, c) => { if (b - a >= 1439) b = a + 1439; const [x1, y1] = pt(a, R), [x2, y2] = pt(b, R), [x3, y3] = pt(b, r0), [x4, y4] = pt(a, r0), big = b - a > 720 ? 1 : 0; return '<path d="M' + x1 + ' ' + y1 + 'A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + x2 + ' ' + y2 + 'L' + x3 + ' ' + y3 + 'A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + x4 + ' ' + y4 + 'Z" style="fill:' + c + '"/>'; };
    let g = '<circle cx="' + C + '" cy="' + C + '" r="' + ((R + r0) / 2) + '" class="id-ctrack" style="stroke-width:' + (R - r0) + 'px"/>';
    list.forEach(b => { const a = U.toMin(b.from), l = len(b); if (!l) return; const c = cat(b.cat); const tip = c[2] + ' ' + (b.what || c[1]) + ' · ' + ft(b.from) + '–' + ft(b.to);
      g += '<g class="id-arc" tabindex="0" data-tip="' + e(hm(l)) + '" data-tipl="' + e(tip) + '">' + (a + l <= 1440 ? arc(a, a + l - 0.5, c[3]) : arc(a, 1439.5, c[3]) + arc(0, a + l - 1440 - 0.5, c[3])) + '</g>'; });
    for (let h = 0; h < 24; h += 3) { const [x, y] = pt(h * 60, R + 11); g += '<text class="tick" x="' + x + '" y="' + (y + 3.5) + '" text-anchor="middle">' + (h === 0 ? '0' : h) + '</text>'; }
    if (showNow) { const n = U.nowMin(), [x0, y0] = pt(n, r0 - 9), [x, y] = pt(n, R + 4); g += '<line class="id-hand" x1="' + x0 + '" y1="' + y0 + '" x2="' + x + '" y2="' + y + '"/><circle cx="' + x0 + '" cy="' + y0 + '" r="3.5" class="id-hub"><title>Now</title></circle>'; }
    return g;
  };
  const right = () => {
    const s = curS(), t = curT(), list = blocks(s, t), today = U.today(), ss = season(s);
    const nowS = ID.seasonOn(today), nowT = ID.isOff(today) ? 'off' : 'work', showNow = s === nowS && t === nowT;
    if (!list.length) return FX().page('id id-r', 'Day at a glance', '', '<p class="hint">Plan the ' + (t === 'work' ? 'working day' : 'holiday') + ' for ' + e(ss.name) + ' on the left to see the hours, the balance and the seasons compared here.</p>' + nnHtml(), 'id-r');
    const m = byCat(list), H = k => (m[k] || 0) / 60;
    const tiles = '<div class="tiles xp-tiles id-tiles">' + FX().tile('😴 Sleep', hm(m.sleep || 0), (H('sleep') >= 7 && H('sleep') <= 9) ? 'healthy (7–9 h)' : H('sleep') < 7 ? 'less than 7 h' : 'more than 9 h', H('sleep') < 7 ? 'warn' : '') +
      FX().tile('💼 Work', hm((m.work || 0)), t === 'work' ? 'office hours' : 'on a holiday') + FX().tile('🏃 Exercise', hm(m.exercise || 0), (m.exercise || 0) >= 30 ? 'aim 30 min+ ✓' : 'aim for 30 min+', (m.exercise || 0) < 30 ? 'warn' : '') +
      FX().tile('📚 Study', hm(m.study || 0), 'for growth') + FX().tile('👨‍👩‍👦 Family', hm(m.family || 0), (m.family || 0) >= 60 ? 'time together ✓' : 'try an hour', (m.family || 0) < 60 ? 'warn' : '') +
      FX().tile('⌛ Unplanned', hm(m._free), m._free ? 'free time' : 'every minute planned') + '</div>';
    const legend = Object.keys(m).filter(k => k[0] !== '_' && m[k]).sort((a, b) => m[b] - m[a]);
    const clockFig = '<figure class="chart id-clock"><figcaption><span class="gh">The 24 hours</span></figcaption><div class="chart-box id-cbox"><svg viewBox="0 0 220 220" role="img" aria-label="The day as a clock">' + clock(list, showNow) +
      '<text x="110" y="104" text-anchor="middle" class="id-cbig">' + ss.icon + '</text><text x="110" y="124" text-anchor="middle" class="id-csub">' + e(ss.name) + '</text><text x="110" y="138" text-anchor="middle" class="id-csub">' + (t === 'work' ? 'working day' : 'holiday') + '</text></svg>' +
      '<ul class="id-legend">' + legend.map(k => { const c = cat(k); return '<li><i style="background:' + c[3] + '"></i>' + c[2] + ' ' + e(c[1]) + '<span class="num">' + hm(m[k]) + '</span></li>'; }).join('') + (m._free ? '<li><i class="free"></i>⌛ Unplanned<span class="num">' + hm(m._free) + '</span></li>' : '') + '</ul><div class="chart-tip" hidden></div></div></figure>';
    const meters = ED.charts.meters({ title: 'Hours by kind', rows: legend.map(k => { const c = cat(k); return { label: c[2] + ' ' + c[1], value: Math.round((m[k] || 0) / 6) / 10, valueLabel: hm(m[k]) + ' · ' + Math.round(m[k] / 14.4) + '%', color: c[3], tip: Math.round(m[k] / 14.4) + '% of the day' }; }), max: Math.max(...legend.map(k => (m[k] || 0) / 60)) });
    // balance check
    const sorted = list.filter(b => b.cat !== 'sleep');
    const lastMeal = sorted.filter(b => b.cat === 'meal').map(b => U.toMin(b.from)).sort((a, b) => b - a)[0];
    const sleepB = list.find(b => b.cat === 'sleep');
    const longWork = (() => { let run = 0, best = 0, prevEnd = null; sorted.forEach(b => { const a = U.toMin(b.from); if (b.cat === 'work' || b.cat === 'study') { run = prevEnd === a ? run + len(b) : len(b); best = Math.max(best, run); prevEnd = a + len(b); } else { run = 0; prevEnd = null; } }); return best; })();
    const checks = [
      [H('sleep') >= 7 && H('sleep') <= 9, 'Sleep ' + hm(m.sleep || 0) + (sleepB ? ' (' + ft(sleepB.from) + ' – ' + ft(sleepB.to) + ')' : ''), 'Adults need 7–9 hours; the same bed-time every day helps most.'],
      [(m.exercise || 0) >= 30, 'Exercise ' + hm(m.exercise || 0), 'WHO: 150 minutes a week — 30 minutes on 5 days.'],
      [longWork <= 150, 'Longest stretch of desk work ' + hm(longWork), 'Stand up, walk or stretch at least every 2–2½ hours.'],
      [!(lastMeal && sleepB) || ((U.toMin(sleepB.from) - lastMeal + 1440) % 1440) >= 120, 'Dinner ' + (lastMeal != null && sleepB ? hm((U.toMin(sleepB.from) - lastMeal + 1440) % 1440) + ' before sleep' : '—'), 'Eat at least 2 hours before going to bed.'],
      [(m.family || 0) >= 60, 'Family time ' + hm(m.family || 0), 'Some unhurried time together every day.'],
      [(m.plan || 0) >= 10, 'Planning ' + hm(m.plan || 0), 'Ten minutes to plan the next day saves an hour.'],
    ];
    const chk = '<h3 class="gh fin-gap">Balance check</h3><ul class="id-checks">' + checks.map(c => '<li class="' + (c[0] ? 'ok' : 'no') + '"><span class="id-ck" aria-hidden="true">' + (c[0] ? '✓' : '!') + '</span><span><b>' + e(c[1]) + '</b><span class="hint">' + e(c[2]) + '</span></span></li>').join('') + '</ul>';
    // seasons compared
    const keys = ['sleep', 'work', 'exercise', 'study', 'family', 'leisure'];
    const sm = SEASONS.map(x => ({ x, m: byCat(blocks(x.id, t)), n: blocks(x.id, t).length }));
    const cmp = '<h3 class="gh fin-gap">The seasons compared <span class="hint">· ' + (t === 'work' ? 'working day' : 'holiday') + '</span></h3><div class="ml-tablewrap"><table class="mm-table id-cmp"><thead><tr><th></th>' + sm.map(r => '<th class="' + (r.x.id === s ? 'cur' : '') + '">' + r.x.icon + ' ' + e(r.x.name) + '</th>').join('') + '</tr></thead><tbody>' +
      '<tr><th>Wake up</th>' + sm.map(r => { const sb = blocks(r.x.id, t).find(b => b.cat === 'sleep'); return '<td class="num">' + (r.n ? e(sb ? ft(sb.to) : '—') : '—') + '</td>'; }).join('') + '</tr>' +
      keys.map(k => '<tr><th>' + cat(k)[2] + ' ' + e(cat(k)[1]) + '</th>' + sm.map(r => '<td class="num">' + (r.n ? hm(r.m[k] || 0) : '—') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    const put = '<div class="id-put"><span aria-hidden="true">🗓️</span><div><b>Live it</b><span class="hint">Put this day’s blocks in the Daily tasks for a date, with their times.</span></div><button type="button" class="btn small primary" data-act="id-put">' + ED.icon('checkSq') + 'Put in Daily tasks…</button></div>';
    return FX().page('id id-r', 'Day at a glance', '', nnHtml() + tiles + '<div class="id-two">' + clockFig + meters + '</div>' + chk + put + cmp, 'id-r');
  };
  /* now and next, from today's ideal day */
  function nnHtml() {
    const x = ID.nowNext(U.today()), sid = ID.seasonOn(U.today()), ss = season(sid);
    if (!x) return '<div class="id-nn empty"><span aria-hidden="true">' + ss.icon + '</span><span class="hint">Today is a ' + (ID.isOff(U.today()) ? 'holiday' : 'working day') + ' in ' + e(ss.name) + ' — plan that day to see “now and next” here.</span></div>';
    const n = U.nowMin();
    const nowL = x.now ? (() => { const c = cat(x.now.cat), left = (U.toMin(x.now.from) + len(x.now) - n + 1440) % 1440; return '<div class="id-nnb now" style="--c:' + c[3] + '"><span class="id-nnl">Now</span><b>' + c[2] + ' ' + e(x.now.what) + '</b><span class="hint">till ' + e(ft(x.now.to)) + ' · ' + hm(left) + ' left</span></div>'; })() : '<div class="id-nnb now"><span class="id-nnl">Now</span><b>⌛ Free time</b></div>';
    const nextL = x.next ? (() => { const c = cat(x.next.cat); return '<div class="id-nnb" style="--c:' + c[3] + '"><span class="id-nnl">Next</span><b>' + c[2] + ' ' + e(x.next.what) + '</b><span class="hint">at ' + e(ft(x.next.from)) + '</span></div>'; })() : '';
    return '<div class="id-nn"><span class="id-nnh">' + ss.icon + ' Today · ' + (ID.isOff(U.today()) ? 'holiday' : 'working day') + '</span>' + nowL + nextL + '</div>';
  }

  /* ---------------- editing ---------------- */
  ID.edit = id => {
    const x = id ? IDL().blocks.find(b => b.id === id) : null, s = curS(), t = curT();
    const last = blocks(s, t).filter(b => b.cat !== 'sleep').pop();
    FX().form({
      title: x ? 'Time block' : 'Add a time block · ' + season(s).name + ', ' + (t === 'work' ? 'working day' : 'holiday'),
      data: x || { from: last ? last.to : '09:00', to: U.fromMin(U.toMin(last ? last.to : '09:00') + 60), cat: 'work', what: '' },
      fields: [{ k: 'what', label: 'What', req: true, ph: 'e.g. Morning walk, Office, Study — thesis chapter' }, { k: 'cat', label: 'Kind', type: 'select', options: CATS.map(c => [c[0], c[2] + ' ' + c[1]]) },
        { k: 'from', label: 'From', type: 'time', req: true }, { k: 'to', label: 'To', type: 'time', req: true, hint: 'An end before the start runs past midnight (sleep).' }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 }],
      extra: x ? '' : '<label class="switch id-all"><input type="checkbox" id="id-allseasons"><span class="track"></span><span>Add to every season</span></label>',
      check: v => v.from === v.to ? 'The start and the end are the same' : '',
      del: x ? () => { ED.store.checkpoint('Ideal day'); IDL().blocks = IDL().blocks.filter(b => b !== x); ED.store.commit(); ED.ui.undoToast('Block removed'); } : null, delLabel: 'Remove',
      save(v, api) {
        ED.store.checkpoint('Ideal day');
        if (x) Object.assign(x, v, { updatedAt: Date.now() });
        else { const all = api.el.querySelector('#id-allseasons'); (all && all.checked ? SEASONS.map(z => z.id) : [s]).forEach(sid => fill(sid, t, [v])); }
        ED.store.commit(); api.close();
      },
    });
  };
  ID.put = () => {
    const s = curS(), t = curT(), list = blocks(s, t);
    const tomorrow = U.addDays(U.today(), 1);
    const body = '<div class="st-form"><div class="st-grid"><label class="lbl" for="id-pd">Date</label><input id="id-pd" type="date" class="field" value="' + tomorrow + '">' +
      '<span class="lbl">Blocks</span><ul class="xp-check id-pick">' + list.map(b => { const c = cat(b.cat); return '<li><label><input type="checkbox" value="' + e(b.id) + '"' + (['sleep', 'meal', 'commute'].indexOf(b.cat) < 0 ? ' checked' : '') + '><span>' + c[2] + ' <b>' + e(b.what) + '</b> <span class="hint num">' + e(ft(b.from)) + ' – ' + e(ft(b.to)) + '</span></span></label></li>'; }).join('') + '</ul></div></div>';
    ED.ui.modal({
      title: 'Put the ideal day in Daily tasks', cls: 'st-modal', body,
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="ok">' + ED.icon('check') + 'Add the tasks</button>',
      onMount(el, api) {
        el.querySelector('[data-x="ok"]').addEventListener('click', () => {
          const k = el.querySelector('#id-pd').value; if (!U.isKey(k)) { ED.ui.toast('Choose a date'); return; }
          const ids = U.$$('.id-pick input', el).filter(i => i.checked).map(i => i.value); if (!ids.length) { ED.ui.toast('Tick at least one block'); return; }
          ED.store.checkpoint('Ideal day → tasks');
          const have = new Set(M.tasksOn ? M.tasksOn(k).map(o => (o.t.title || '') + '@' + (o.t.time || '')) : []); let n = 0;
          list.filter(b => ids.indexOf(b.id) >= 0).forEach(b => {
            const c = cat(b.cat), title = c[2] + ' ' + b.what;
            if (have.has(title + '@' + b.from)) return;
            M.addTask({ title, date: k, time: b.from, dur: Math.max(5, Math.min(len(b), 12 * 60)), prio: b.cat === 'work' || b.cat === 'study' ? 'A' : 'B', notes: '<p>From your ideal day (' + U.esc(season(s).name) + ')' + (b.notes ? ' — ' + U.esc(b.notes) : '') + '</p>' });
            n++;
          });
          ED.store.commit(); api.close(); ED.ui.undoToast(U.plural(n, 'task') + ' added for ' + U.fmtShort(k));
        });
      },
    });
  };
  ID.months = () => {
    const body = '<p class="hint">Which season each month belongs to. IMD’s seasons are set to start with; change any month to suit your city.</p><div class="id-mgrid">' +
      U.MONTHS.map((m, i) => '<label class="ml-f"><span>' + e(m) + '</span><select class="field" data-m="' + (i + 1) + '">' + SEASONS.map(x => FX().opt(x.id, x.icon + ' ' + x.name, seasonOfMonth(i + 1) === x.id)).join('') + '</select></label>').join('') + '</div>';
    ED.ui.modal({
      title: 'Months and seasons', cls: 'st-modal', body,
      footer: '<button type="button" class="btn ghost" data-x="reset">IMD seasons</button><span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="ok">Save</button>',
      onMount(el, api) {
        el.querySelector('[data-x="reset"]').addEventListener('click', () => { U.$$('select', el).forEach(x => { const m = +x.dataset.m; x.value = (SEASONS.find(z => z.months.indexOf(m) >= 0) || SEASONS[0]).id; }); });
        el.querySelector('[data-x="ok"]').addEventListener('click', () => {
          ED.store.checkpoint('Seasons'); const mm = {};
          U.$$('select', el).forEach(x => { const m = +x.dataset.m; if ((SEASONS.find(z => z.months.indexOf(m) >= 0) || {}).id !== x.value) mm[m] = x.value; });
          IDL().months = mm; ED.store.commit(); api.close();
        });
      },
    });
  };

  /* ---------------- actions ---------------- */
  A['id-season'] = el => { st().s = el.dataset.k; ED.app.render(); };
  A['id-type'] = el => { st().t = el.dataset.k; ED.app.render(); };
  A['id-add'] = () => ID.edit(null);
  A['id-edit'] = el => ID.edit(el.dataset.id);
  A['id-put'] = () => ID.put();
  A['id-suggest'] = () => { const s = curS(), t = curT(); ED.store.checkpoint('Ideal day'); fill(s, t, ID.suggest(s, t)); ED.store.commit(); ED.ui.undoToast('A suggested ' + season(s).name.toLowerCase() + ' day — change any block to make it yours'); };
  A['id-copy'] = el => { const s = curS(), t = curT(); ED.store.checkpoint('Ideal day'); fill(s, t, blocks(el.dataset.from, el.dataset.ft).map(b => ({ from: b.from, to: b.to, cat: b.cat, what: b.what, notes: b.notes || '' }))); ED.store.commit(); ED.ui.undoToast('Copied — change what differs in ' + season(s).name); };
  A['id-menu'] = el => {
    const s = curS(), t = curT(), has = blocks(s, t).length;
    ED.ui.menu(el, [
      { label: 'Months and seasons…', icon: 'calendar', onClick: ID.months },
      has ? { label: 'Put in Daily tasks…', icon: 'checkSq', onClick: ID.put } : null,
      has ? { label: 'Copy as text', icon: 'copy', onClick: async () => { const lines = [season(s).name + ' — ' + (t === 'work' ? 'working day' : 'holiday')].concat(blocks(s, t).map(b => ft(b.from) + '–' + ft(b.to) + '  ' + cat(b.cat)[2] + ' ' + b.what)); ED.ui.toast(await U.copy(lines.join('\n')) ? 'Copied' : 'Could not copy'); } } : null,
      has ? { label: 'Clear this day', icon: 'trash', danger: true, onClick: async () => { if (!await ED.ui.confirm({ title: 'Clear', message: 'Remove every block of the ' + season(s).name + ' ' + (t === 'work' ? 'working day' : 'holiday') + '?', ok: 'Clear', danger: true })) return; ED.store.checkpoint('Ideal day'); IDL().blocks = IDL().blocks.filter(b => !(b.s === s && b.t === t)); ED.store.commit(); ED.ui.undoToast('Cleared'); } } : null,
    ].filter(Boolean));
  };

  ED.views = ED.views || {};
  ED.views.idealday = { id: 'idealday', label: 'Ideal Day', left, right, mount(root) { if (ED.charts && ED.charts.bind) ED.charts.bind(root || document); } };
})();
