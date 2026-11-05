/* E-Diary — 1.25: Daily Manifestation Journal (Purpose → Manifest).
   Built on what research shows actually moves people towards a wish — and on the Sankalpa tradition:
     1. Gratitude first, specific and with the reason (Emmons & McCullough 2003; Seligman et al. 2005, "three good things").
     2. The desire written as already true, felt in detail (Best Possible Self writing — Carrillo et al. 2019 meta-analysis;
        a sankalpa is stated in the present tense: "not a petition or a prayer").
     3. Kept believable — sweeping affirmations backfire when they are far from what one believes (Wood, Perunovic & Lee 2009),
        so the page asks "how believable is this?" and offers bridge wording.
     4. Then the inner obstacle and an if–then plan (mental contrasting with implementation intentions / WOOP — Oettingen;
        Gollwitzer & Sheeran 2006; Wang et al. 2021). Pure positive fantasy lowers energy (Kappes & Oettingen 2011).
     5. A 2-minute visualisation of the steps, not only the finish (Pham & Taylor 1999).
     6. One aligned action, sent to today's tasks (small wins — Amabile & Kramer).
     7. Evening: what moved me closer, signs and opportunities, belief and closeness 1–10.
     8. A weekly progress report to someone you trust (Matthews, Dominican University).
   Popular rituals (3-6-9, 55×5) and the traditional Sanskrit sankalpa (with today's Panchang) are offered as focus rituals.
   Data: ED.store.data.manifest = {
     desires: [ { id, title, statement, sankalpa, hi, why, outcome, obstacle, ifc, then, believe, area, target, dreamId, goalId,
                  pics: [], method: 'daily' | '369' | '55x5' | 'bps', status: 'active' | 'manifested' | 'released', start, doneOn,
                  doneNote, createdAt, updatedAt } ],
     days: { 'YYYY-MM-DD': { focus, grat: ['', '', ''], say: { m, a, n }, sayTxt, vis, obstacle, plan, action, taskId, script,
             moved, signs, thanks, belief, close, mood, updatedAt } },
     cfg: { main, quick, remind, morning: '06:30', evening: '21:30', name, gotra, fem } } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const FX = () => ED.fx;
  const A = (ED.actions = ED.actions || {});
  const D = () => ED.store.data;
  const MJ = (ED.manifest = {});
  const MD = () => { const d = D(); if (!d.manifest || typeof d.manifest !== 'object') d.manifest = {}; const m = d.manifest; if (!Array.isArray(m.desires)) m.desires = []; if (!m.days || typeof m.days !== 'object') m.days = {}; if (!m.cfg || typeof m.cfg !== 'object') m.cfg = {}; return m; };
  const st = () => ED.state.mj || (ED.state.mj = { tab: 'desires', date: null });
  const today = () => U.today();
  const curDate = () => { const s = st(); return U.isKey(s.date) && s.date <= today() ? s.date : today(); };
  const touch = x => { x.updatedAt = Date.now(); return x; };
  const txt = s => String(s || '').trim();
  const AREAS = () => (ED.dreams && ED.dreams.AREAS) || [['self', 'Life', '✨', '#7c3aed']];
  const areaOf = id => AREAS().find(a => a[0] === id) || AREAS()[AREAS().length - 1];
  const METHODS = [
    ['daily', 'Daily Sankalpa', 'Say your sankalpa 3 times, see the steps, one action — about 5 minutes (recommended)'],
    ['369', '3-6-9', 'Write it 3 times in the morning, 6 in the afternoon, 9 at night — a focus ritual'],
    ['55x5', '55 × 5', 'Write it 55 times a day for 5 days — a focus ritual'],
    ['bps', 'Best Possible Self', 'Write 15 minutes a day for 14 days about the life where it came true'],
    ['100', '100-day journey', 'One theme a day for 100 days — gratitude, seeing it, words, belief, action, letting go'],
  ];
  /* a theme for each day of the journey (after the 100-day practice of Manifest Anything in 100 Days and Doty's six steps) */
  const THEMES = [
    ['Attention', 'Notice when your mind drifts to worry today — and bring it back to your intention and the next small step.'],
    ['Clarity', 'Read your desire. Is it exactly what you want? Make one word more specific.'],
    ['Gratitude', 'Thank one person today, out loud or in a message, for something real.'],
    ['Seeing it', 'Spend one extra minute picturing an ordinary day in the life where it came true.'],
    ['Self-kindness', 'Write the doubt you hear most — then answer it as you would answer a friend.'],
    ['Words', 'Say your sankalpa silently, then aloud, then write it once.'],
    ['Belief', 'Write one piece of proof that you can do this — something you have done before.'],
    ['Action', 'Do the hardest small step first, before noon.'],
    ['Others', 'Who else will it help when it comes true? Picture their face.'],
    ['Opportunity', 'Look for one opening today — a person, a call, a notice, an idea. Note it tonight.'],
    ['Body', 'Walk, stretch or breathe for 10 minutes; a calm body keeps the mind on the wish.'],
    ['Letting go', 'Do your part fully, then hold the result lightly. Setbacks are information.'],
  ];
  MJ.dayOf = (x, k) => Math.max(1, U.diffDays(x.start || k, k) + 1);
  MJ.theme = (x, k) => THEMES[(MJ.dayOf(x, k) - 1) % THEMES.length];
  const MOODS = [['😞', 'Low'], ['😐', 'Flat'], ['🙂', 'Okay'], ['😄', 'Good'], ['🤩', 'Great']];

  MJ.desires = () => MD().desires;
  MJ.active = () => MD().desires.filter(x => (x.status || 'active') === 'active').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  MJ.desire = id => MD().desires.find(x => x.id === id) || null;
  MJ.day = (k, make) => { const dd = MD().days; if (!dd[k] && make) dd[k] = { updatedAt: Date.now() }; return dd[k] || null; };
  MJ.focus = k => {
    const d = MJ.day(k), act = MJ.active();
    const x = d && d.focus && MJ.desire(d.focus);
    if (x && ((x.status || 'active') === 'active' || k < today())) return x;
    return MJ.desire(MD().cfg.main) && (MJ.desire(MD().cfg.main).status || 'active') === 'active' ? MJ.desire(MD().cfg.main) : act[0] || null;
  };

  /* ---------------- how much of the day's practice is done ---------------- */
  const slot = () => { const h = new Date().getHours(); return h < 12 ? 'm' : h < 17 ? 'a' : 'n'; };
  const target = (x, sl) => !x ? 3 : x.method === '369' ? ({ m: 3, a: 6, n: 9 })[sl || 'm'] : x.method === '55x5' ? 55 : 3;
  const said = (d, sl) => (d && d.say && +d.say[sl || 'm']) || 0;
  MJ.STEPS = [
    ['grat', '🙏', 'Gratitude', d => !!(d && (d.grat || []).some(s => txt(s)))],
    ['say', '🕉', 'Sankalpa', (d, x) => said(d, 'm') >= target(x, 'm')],
    ['vis', '🎬', 'See the steps', d => !!(d && (d.vis || 0) >= 60)],
    ['plan', '🧱', 'Obstacle → plan', (d, x) => !!(d && (txt(d.plan) || (x && txt(x.then) && (d.vis || 0) >= 60)))],   // the desire's own plan counts once it has been rehearsed in the visualisation
    ['act', '🎯', 'One action', d => !!(d && txt(d.action))],
    ['eve', '🌙', 'Evening', d => !!(d && (txt(d.moved) || d.belief))],
  ];
  MJ.score = k => { const d = MJ.day(k), x = MJ.focus(k); if (!d) return 0; return MJ.STEPS.filter(s => s[3](d, x)).length / MJ.STEPS.length; };
  MJ.practised = k => MJ.score(k) >= 0.5;
  MJ.streak = () => {
    let k = today(), n = 0;
    if (!MJ.practised(k)) k = U.addDays(k, -1);
    while (MJ.practised(k) && n < 3660) { n++; k = U.addDays(k, -1); }
    return n;
  };
  MJ.best = () => { const ks = Object.keys(MD().days).filter(MJ.practised).sort(); let best = 0, run = 0, prev = null; ks.forEach(k => { run = prev && U.addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }); return best; };
  const taskOf = d => d && d.taskId ? D().tasks.find(t => t.id === d.taskId) || null : null;
  const taskDone = (d, k) => { const t = taskOf(d); return !!(t && M.statusOf(t, k) === 'done'); };

  /* ---------------- the traditional sankalpa, with the Panchang of the day ---------------- */
  const DEV = '०१२३४५६७८९', deva = n => String(n).replace(/\d/g, c => DEV[+c]);
  const TITHI_LOC = ['प्रतिपदायां', 'द्वितीयायां', 'तृतीयायां', 'चतुर्थ्यां', 'पञ्चम्यां', 'षष्ठ्यां', 'सप्तम्यां', 'अष्टम्यां', 'नवम्यां', 'दशम्यां', 'एकादश्यां', 'द्वादश्यां', 'त्रयोदश्यां', 'चतुर्दश्यां'];
  const VARA_LOC = ['रविवासरे', 'सोमवासरे', 'भौमवासरे', 'बुधवासरे', 'गुरुवासरे', 'शुक्रवासरे', 'शनिवासरे'];
  const VARA_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  MJ.tradSankalpa = (k, x) => {
    let p = null; try { p = ED.panchang ? ED.panchang.day(k) : null; } catch (err) { p = null; }
    if (!p) return null;
    const c = MD().cfg, t = p.tithi;
    const tithi = t === 15 ? 'पूर्णिमायां' : t === 30 ? 'अमावास्यायां' : TITHI_LOC[(t - 1) % 15];
    const month = (p.adhik ? 'अधिक' : '') + String(ED.panchang.HINDI_MONTHS[p.purnimanta] || '').replace(/़/g, '');
    const who = (txt(c.gotra) ? txt(c.gotra) + 'गोत्रोत्पन्न' + (c.fem ? 'ा' : 'ः') + ' ' : '') + (txt(c.name) ? txt(c.name) + ' ' : '');
    const purpose = txt(x && x.hi) || 'मम मनोकामना';
    const sa = 'ॐ विष्णुर्विष्णुर्विष्णुः । अद्य विक्रमसंवत् ' + deva(p.samvat) + ' ' + month + 'मासे ' + (p.paksha === 'Shukla' ? 'शुक्लपक्षे' : 'कृष्णपक्षे') + ' ' + tithi + ' तिथौ ' + VARA_LOC[U.dow(k)] + ' ' + who + 'अहं ' + purpose + ' सिद्ध्यर्थं संकल्पं करोमि ॥';
    const en = 'Om Vishnu, Vishnu, Vishnu. Today — Vikram Samvat ' + p.samvat + ', month of ' + p.month + ', ' + p.paksha + ' paksha, ' + p.tithiName + ' tithi, ' + VARA_EN[U.dow(k)] + ' — I' + (txt(c.name) ? ', ' + txt(c.name) : '') + (txt(c.gotra) ? ' of ' + txt(c.gotra) + ' gotra' : '') + ', take this resolve for ' + (txt(x && x.hi) ? '“' + txt(x.hi) + '”' : 'my heart’s wish') + (x ? ' (' + x.title + ')' : '') + '.';
    return { sa, en, p };
  };

  /* ---------------- left page: today's journal ---------------- */
  const sec = (id, ico, title, body, done, sub) => '<section class="mj-sec' + (done ? ' done' : '') + '" data-step="' + id + '"><h3 class="mj-h"><span class="mj-ico" aria-hidden="true">' + ico + '</span><span class="grow">' + title + (sub ? ' <span class="hint">' + sub + '</span>' : '') + '</span><span class="mj-ok" aria-label="' + (done ? 'done' : 'not yet') + '">' + (done ? '✓' : '') + '</span></h3>' + body + '</section>';
  const inp = (key, val, ph, extra) => '<input class="field mj-in" data-mj="' + key + '" value="' + e(val || '') + '" placeholder="' + e(ph) + '"' + (extra || '') + '>';
  const area_ = (key, val, ph, rows) => '<textarea class="field mj-ta" data-mj="' + key + '" rows="' + (rows || 2) + '" placeholder="' + e(ph) + '">' + e(val || '') + '</textarea>';
  const ring = f => { const r = 17, c = 2 * Math.PI * r; return '<svg class="mj-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="' + r + '" class="tr"/><circle cx="22" cy="22" r="' + r + '" class="fg" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 22 22)"/></svg>'; };

  const empty = () => '<div class="mj-empty"><div class="mj-om" aria-hidden="true">🕉</div><h3>Your daily manifestation journal</h3>' +
    '<p>Five minutes in the morning, three at night. Write what you want as if it is already true, keep it believable, see the obstacle and your plan, picture the steps, and take one real action — then notice what moved you closer.</p>' +
    '<button type="button" class="btn primary" data-act="mj-new">' + ED.icon('sparkle') + 'Write my first desire</button>' +
    '<p class="hint">Ideas: a role or promotion, a paper accepted, a healthy routine, a calm mind, a home, a family wish. Keep 1–3 at a time.</p></div>';

  const left = () => {
    const k = curDate(), s = st(), c = MD().cfg, x = MJ.focus(k), d = MJ.day(k) || {};
    const isToday = k === today();
    const nav = '<div class="mj-nav"><button type="button" class="icon-btn" data-act="mj-date" data-d="-1" aria-label="Previous day">' + ED.icon('chevL') + '</button>' +
      '<button type="button" class="btn small ghost' + (isToday ? ' on' : '') + '" data-act="mj-date" data-d="0">Today</button>' +
      '<button type="button" class="icon-btn" data-act="mj-date" data-d="1" aria-label="Next day"' + (isToday ? ' disabled' : '') + '>' + ED.icon('chevR') + '</button></div>';
    const tools = nav + '<button type="button" class="btn small ghost" data-act="mj-quick" aria-pressed="' + !!c.quick + '" title="Show only the essentials">' + (c.quick ? 'Quick ✓' : 'Quick') + '</button>';
    if (!MD().desires.length) return FX().page('mj mj-l', 'Daily Manifestation', tools, empty(), 'mj-l');
    let p = null; try { p = ED.panchang ? ED.panchang.day(k) : null; } catch (err) { p = null; }
    const sc = MJ.score(k), streak = MJ.streak();
    const head = '<div class="mj-top">' + ring(sc) + '<div class="grow"><b>' + e(U.fmtLong(k)) + '</b><span class="hint">' + (p ? e(p.label + ' · ' + p.month + (p.festivals.length ? ' · ' + p.festivals[0] : '')) : '') + '</span></div>' +
      '<div class="mj-streak" title="Days in a row with at least half of the practice">🔥 <b>' + streak + '</b><span class="hint">day' + (streak === 1 ? '' : 's') + '</span></div></div>';
    if (!x) return FX().page('mj mj-l', 'Daily Manifestation', tools, head + '<p class="hint">No active desire. <button type="button" class="link-btn" data-act="mj-new">Write one</button> or bring one back from the list.</p>', 'mj-l');
    const act = MJ.active();
    const pic = (x.pics || []).find(src => ED.pics && ED.pics.ok(src));
    const focus = '<div class="mj-focus">' + (act.length > 1 ? '<div class="mj-chips" role="group" aria-label="Today’s desire">' + act.map(y => '<button type="button" class="chip-btn" data-act="mj-focus" data-id="' + e(y.id) + '" aria-pressed="' + (y.id === x.id) + '">' + areaOf(y.area)[2] + ' ' + e(y.title) + '</button>').join('') + '</div>' : '') +
      '<div class="mj-card" style="--c:' + areaOf(x.area)[3] + '">' + (pic ? '<span class="mj-pic" style="background-image:url(&quot;' + e(pic) + '&quot;)"></span>' : '<span class="mj-pic none" aria-hidden="true">' + areaOf(x.area)[2] + '</span>') +
      '<div class="grow"><span class="mj-title">' + e(x.title) + '</span><span class="mj-dayn hint">Day ' + MJ.dayOf(x, k) + (x.method === '100' ? ' of 100' : '') + '</span><p class="mj-stmt">“' + e(x.statement || x.title) + '”</p>' + (x.why ? '<span class="hint">Why: ' + e(x.why) + '</span>' : '') + (x.others ? '<span class="hint">It will also help: ' + e(x.others) + '</span>' : '') + '</div></div>' +
      '<p class="mj-theme"><b>Today’s theme · ' + e(MJ.theme(x, k)[0]) + '</b> — ' + e(MJ.theme(x, k)[1]) + '</p></div>';

    // 1 gratitude
    const g = d.grat || [];
    const n = c.quick ? 1 : 3;
    const grat = sec('grat', '🙏', 'Gratitude', '<p class="hint mj-tip">Three specific things from the last day — and why each happened.</p>' +
      Array.from({ length: n }, (_, i) => inp('grat' + i, g[i], ['I’m grateful for … because …', 'Someone who helped me …', 'A small win …'][i])).join(''), MJ.STEPS[0][3](d));
    // 2 sankalpa
    const sl = x.method === '369' ? slot() : 'm', tg = target(x, sl), cnt = said(d, sl);
    const tr = MJ.tradSankalpa(k, x);
    const rit = x.method === '369' ? '<div class="mj-369">' + [['m', 'Morning', 3], ['a', 'Afternoon', 6], ['n', 'Night', 9]].map(z => '<span class="' + (said(d, z[0]) >= z[2] ? 'ok' : '') + (z[0] === sl ? ' now' : '') + '">' + z[1] + ' <b class="num">' + said(d, z[0]) + '/' + z[2] + '</b></span>').join('') + '</div>' : '';
    const writeBox = x.method === '369' || x.method === '55x5' ? '<label class="lbl" for="mj-w">Write it here — every line counts (or tap the button each time you write it on paper)</label><textarea id="mj-w" class="field mj-ta mj-write" data-mj="sayTxt" rows="3" placeholder="' + e(x.sankalpa || x.statement || '') + '">' + e(d.sayTxt && d.sayTxt[sl] || '') + '</textarea>' : '';
    const sank = sec('say', '🕉', 'Sankalpa', '<p class="mj-sank" lang="' + (/[ऀ-ॿ]/.test(x.sankalpa || '') ? 'hi' : 'en') + '">' + e(x.sankalpa || x.statement || x.title) + '</p>' + rit +
      '<div class="mj-sayrow"><button type="button" class="btn mj-saybtn" data-act="mj-say" data-sl="' + sl + '">🙏 I said it <b class="num">' + cnt + '/' + tg + '</b></button><span class="hint">' + (x.method === 'daily' || !x.method || x.method === 'bps' || x.method === '100' ? 'Silently, then aloud, then once in writing — feeling it as already true.' : x.method === '55x5' ? 'Day ' + Math.min(5, U.diffDays(x.start || k, k) + 1) + ' of 5.' : 'Now: ' + ({ m: 'morning', a: 'afternoon', n: 'night' })[sl] + '.') + '</span></div>' + writeBox +
      (tr && !c.quick ? '<details class="mj-trad"><summary>Traditional sankalpa with today’s Panchang</summary><p class="mj-sa" lang="sa">' + e(tr.sa) + '</p><p class="hint">' + e(tr.en) + '</p><p class="hint">Hold a little water in the right palm, say it once, and let the water fall. ' + (txt(c.name) ? '' : 'Add your name and gotra in the Method tab.') + '</p></details>' : ''),
      MJ.STEPS[1][3](d, x), x.method && x.method !== 'daily' ? METHODS.find(m => m[0] === x.method)[1] : '');
    // 3 visualise
    const vis = sec('vis', '🎬', 'See the steps', '<p class="hint mj-tip">Two and a half minutes, eyes closed: relax, feel it done — then the obstacle, your plan, and you doing today’s step.</p>' +
      '<div class="mj-sayrow"><button type="button" class="btn" data-act="mj-vis">▶ Start (2½ minutes)</button><span class="hint">' + (d.vis ? 'Done today: ' + Math.round(d.vis / 60 * 10) / 10 + ' min' : 'Not yet today') + '</span></div>', MJ.STEPS[2][3](d), c.quick ? '' : '');
    // 4 obstacle → plan
    const plan = sec('plan', '🧱', 'Obstacle → plan', '<p class="hint mj-tip">What inside you could get in the way today — a habit, a feeling, a doubt? Meet it kindly, then decide: if it shows up, what will you do?</p>' +
      '<div class="mj-if"><span>If</span>' + inp('obstacle', d.obstacle != null ? d.obstacle : (x.ifc || x.obstacle || ''), 'I feel like putting it off…') + '<span>then I will</span>' + inp('plan', d.plan != null ? d.plan : (x.then || ''), 'start with just 10 minutes') + '</div>', MJ.STEPS[3][3](d, x));
    // 5 one action
    const t = taskOf(d), tdone = taskDone(d, k);
    const action = sec('act', '🎯', 'One aligned action today', inp('action', d.action, 'e.g. Send the revised paper to Prof. …, walk 30 min, call …') +
      '<div class="mj-sayrow">' + (t ? '<span class="mj-tk' + (tdone ? ' ok' : '') + '">' + (tdone ? '✓ Done' : '• In today’s tasks') + ' — ' + e(t.title.replace(/^✨\s*/, '')) + '</span>' : '<button type="button" class="btn small" data-act="mj-task"' + (txt(d.action) ? '' : ' disabled') + '>' + ED.icon('plus') + 'Add to ' + (isToday ? 'today’s' : 'that day’s') + ' tasks</button>') + '</div>', MJ.STEPS[4][3](d));
    // script (optional)
    const script = c.quick && x.method !== 'bps' ? '' : '<details class="mj-script"' + (x.method === 'bps' ? ' open' : '') + '><summary>✍ Script it — a few lines from the day it came true' + (x.method === 'bps' ? ' (15 minutes)' : ' (optional)') + '</summary>' +
      area_('script', d.script, 'It is ' + (x.target ? U.fmtLong(x.target) : 'that day') + '. I wake up and … I feel … The people around me … The first thing I do is …', x.method === 'bps' ? 8 : 4) + '<span class="hint mj-wc">' + wc(d.script) + '</span></details>';
    // evening
    const eve = sec('eve', '🌙', 'Evening reflection', area_('moved', d.moved, 'What moved me closer today? (even something small)') + (c.quick ? '' : area_('signs', d.signs, 'Signs, opportunities or help I noticed', 2)) +
      '<div class="mj-rate"><label>Belief it will happen <b class="num" data-v="belief">' + (d.belief || '–') + '</b><input type="range" min="1" max="10" step="1" data-mj="belief" value="' + (d.belief || 5) + '"></label>' +
      '<label>How close it feels <b class="num" data-v="close">' + (d.close || '–') + '</b><input type="range" min="1" max="10" step="1" data-mj="close" value="' + (d.close || 5) + '"></label></div>' +
      '<div class="mj-moods" role="group" aria-label="Mood">' + MOODS.map((m, i) => '<button type="button" class="mj-mood" data-act="mj-mood" data-i="' + i + '" aria-pressed="' + (d.mood === i) + '" title="' + m[1] + '">' + m[0] + '</button>').join('') + '</div>' +
      (c.quick ? '' : inp('thanks', d.thanks, 'Thank you for … (as if it is already done)')) +
      '<label class="switch mj-let"><input type="checkbox" data-mj="release"' + (d.release ? ' checked' : '') + '><span class="track"></span><span>I did my part today — I hold the result lightly 🙏</span></label>', MJ.STEPS[5][3](d), isToday && new Date().getHours() < 17 ? 'tonight' : '');
    const body = head + focus + grat + sank + (c.quick ? '' : vis + plan) + action + script + eve;
    return FX().page('mj mj-l', 'Daily Manifestation', tools, body, 'mj-l');
  };
  const wc = s => { const n = txt(s) ? txt(s).split(/\s+/).length : 0; return n ? n + ' words' : ''; };

  /* ---------------- right page: desires · progress · method ---------------- */
  const right = () => {
    const s = st(), tabs = FX().seg('mj-tab', s.tab, [['desires', 'Desires'], ['progress', 'Progress'], ['method', 'How it works']], 'Show');
    const tools = s.tab === 'desires' ? '<button type="button" class="btn small primary" data-act="mj-new">' + ED.icon('plus') + 'Desire</button>' : '';
    const body = s.tab === 'progress' ? progress() : s.tab === 'method' ? method() : desiresHtml();
    return FX().page('mj mj-r', 'Manifest', tools, tabs + body, 'mj-r-' + s.tab);
  };
  const daysFor = id => Object.keys(MD().days).filter(k => MD().days[k].focus === id || (!MD().days[k].focus && MJ.focus(k) && MJ.focus(k).id === id));
  const desiresHtml = () => {
    const all = MD().desires, act = MJ.active();
    if (!all.length) return '<div class="mj-empty sm"><p>Write a desire to begin. The guide takes about 4 minutes: your wish, how it will feel, the inner obstacle and your if–then plan, a sankalpa you can believe, and a picture.</p><button type="button" class="btn primary" data-act="mj-new">' + ED.icon('sparkle') + 'Write my first desire</button></div>';
    const card = x => {
      const pic = (x.pics || []).find(src => ED.pics && ED.pics.ok(src)), ar = areaOf(x.area), ds = daysFor(x.id), last = ds.sort().reverse().map(k => MD().days[k].belief).find(v => v);
      const left = x.target ? U.diffDays(today(), x.target) : null;
      return '<article class="mj-dcard s-' + (x.status || 'active') + '" style="--c:' + ar[3] + '">' + (pic ? '<span class="mj-dpic" style="background-image:url(&quot;' + e(pic) + '&quot;)"></span>' : '<span class="mj-dpic none" aria-hidden="true">' + ar[2] + '</span>') +
        '<div class="mj-dbody"><b>' + e(x.title) + '</b><p class="mj-stmt">“' + e(x.statement || x.title) + '”</p>' +
        '<span class="hint">' + ar[2] + ' ' + e(ar[1]) + (x.target && (x.status || 'active') === 'active' ? ' · ' + (left >= 0 ? U.plural(left, 'day') + ' to ' + e(U.fmtShort(x.target)) : 'target passed') : '') + (x.status === 'manifested' ? ' · 🎉 manifested ' + e(U.fmtShort(x.doneOn || '')) : '') + '</span>' +
        '<span class="hint num">' + U.plural(ds.length, 'day') + ' practised' + (last ? ' · belief ' + last + '/10' : '') + (x.believe ? ' · started at ' + x.believe + '/10' : '') + ' · ' + e((METHODS.find(m => m[0] === (x.method || 'daily')) || METHODS[0])[1]) + '</span>' +
        (x.status === 'manifested' && x.doneNote ? '<p class="mj-note">' + e(x.doneNote) + '</p>' : '') +
        '<div class="row-btns"><button type="button" class="btn small" data-act="mj-edit" data-id="' + e(x.id) + '">' + ED.icon('pencil') + 'Edit</button>' +
        ((x.status || 'active') === 'active' ? '<button type="button" class="btn small" data-act="mj-done" data-id="' + e(x.id) + '">🎉 Manifested</button><button type="button" class="btn small ghost" data-act="mj-release" data-id="' + e(x.id) + '">Let go</button>' + (MD().cfg.main === x.id ? '<span class="chip">main</span>' : '<button type="button" class="btn small ghost" data-act="mj-main" data-id="' + e(x.id) + '">Make main</button>') : '<button type="button" class="btn small ghost" data-act="mj-again" data-id="' + e(x.id) + '">Make active again</button>') +
        '</div></div></article>';
    };
    const won = all.filter(x => x.status === 'manifested'), rel = all.filter(x => x.status === 'released');
    return (act.length > 3 ? '<p class="notice">' + act.length + ' desires are active. Attention works best on 1–3 at a time — you could let some rest for now.</p>' : '') +
      (act.length ? '<div class="mj-dlist">' + act.map(card).join('') + '</div>' : '<p class="hint">No active desire.</p>') +
      (won.length ? '<h3 class="mj-sub">🎉 Manifested</h3><div class="mj-dlist">' + won.map(card).join('') + '</div>' : '') +
      (rel.length ? '<details class="mj-rel"><summary>Let go (' + rel.length + ')</summary><div class="mj-dlist">' + rel.map(card).join('') + '</div></details>' : '');
  };
  const progress = () => {
    const t = today(), days = MD().days, keys30 = U.range(U.addDays(t, -29), 30);
    const prac30 = keys30.filter(MJ.practised).length;
    const acts = keys30.map(k => days[k]).filter(d => d && d.taskId);
    const actsDone = keys30.filter(k => days[k] && days[k].taskId && taskDone(days[k], k)).length;
    const won = MD().desires.filter(x => x.status === 'manifested').length;
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('Practised', prac30 + '/30', 'days, last 30') + FX().tile('Streak', '🔥 ' + MJ.streak(), 'best ' + MJ.best()) + FX().tile('Actions done', actsDone + '/' + acts.length, 'last 30 days') + FX().tile('Manifested', String(won), won ? '🎉' : 'so far') + '</div>';
    const CH = ED.charts;
    const first = U.addDays(t, -181);
    const heat = CH ? CH.heat({ title: 'Days practised', days: U.range(first, 182).map(k => ({ k, v: days[k] ? MJ.score(k) : 0, tip: Math.round(MJ.score(k) * 6) + ' of 6 steps' })), weekStart: D().settings.weekStart || 0 }) : '';
    const lab = keys30.map(k => U.fmtDM ? U.fmtDM(k) : k.slice(5));
    const bel = keys30.map(k => (days[k] && days[k].belief) || null), clo = keys30.map(k => (days[k] && days[k].close) || null);
    const lines = CH && (bel.some(v => v) || clo.some(v => v)) ? CH.lines({ title: 'Belief and closeness (1–10)', labels: lab, series: [{ name: 'Belief', color: 'var(--s2)', points: bel }, { name: 'How close', color: 'var(--s3)', points: clo }], yMax: 10, legend: CH.legend([{ kind: 'line', color: 'var(--s2)', label: 'Belief' }, { kind: 'line', color: 'var(--s3)', label: 'How close' }]), table: CH.table(['Day', 'Belief', 'How close'], keys30.map((k, i) => [k, bel[i] == null ? '–' : String(bel[i]), clo[i] == null ? '–' : String(clo[i])])) }) : '<p class="hint">Rate belief and closeness in the evening to see them grow here.</p>';
    const ev = Object.keys(days).filter(k => txt(days[k].moved) || txt(days[k].signs)).sort().reverse().slice(0, 12);
    const evid = '<h3 class="mj-sub">What moved me closer</h3>' + (ev.length ? '<ul class="mj-ev">' + ev.map(k => { const d = days[k], x = MJ.focus(k); return '<li><span class="hint num">' + e(U.fmtShort(k)) + (x ? ' · ' + e(x.title) : '') + '</span>' + (txt(d.moved) ? '<span>' + e(d.moved) + '</span>' : '') + (txt(d.signs) ? '<span class="hint">✨ ' + e(d.signs) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="hint">Each evening, one line about what moved you closer. Over weeks this list is the proof that keeps belief growing.</p>');
    return tiles + '<div class="mj-week"><button type="button" class="btn small" data-act="mj-week">' + ED.icon('share') + 'Weekly report to someone I trust</button><span class="hint">People who sent a weekly progress note to a friend did best.</span></div>' + heat + lines + evid;
  };

  /* ---------------- the research, in plain words ---------------- */
  const SRC = [
    ['Emmons & McCullough (2003) — counting blessings', 'https://en.wikipedia.org/wiki/Gratitude_journal'],
    ['Seligman et al. (2005) — three good things', 'https://ggia.berkeley.edu/practice/three-good-things%20'],
    ['Carrillo et al. (2019) — Best Possible Self meta-analysis', 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0222386'],
    ['Wood, Perunovic & Lee (2009) — when positive self-statements backfire', 'https://www.discovermagazine.com/mind/the-peril-of-positive-thinking-why-positive-messages-hurt-people-with-low-self-esteem'],
    ['Kappes & Oettingen (2011) — positive fantasies drain energy', 'https://www.psy.uni-hamburg.de/arbeitsbereiche/paedagogische-psychologie-und-motivation/personen/oettingen-gabriele/dokumente/kappes-oettingen-2011.pdf'],
    ['Wang et al. (2021) — WOOP / MCII meta-analysis', 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.565202/full'],
    ['Character Lab — the WOOP steps', 'https://characterlab.org/wp-content/uploads/2019/03/characterlab_WOOP.pdf'],
    ['Pham & Taylor (1999) — visualise the process, not only the result', 'https://dailybruin.com/1998/11/29/programs-professors-offer-stre/'],
    ['Matthews (Dominican University) — written goals and weekly reports', 'https://resources.blanchard.com/blanchard-leaderchat/do-these-3-things-and-increase-your-chances-of-achieving-your-goals-to-76'],
    ['Lally et al. (2010) — how long a habit takes', 'https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit'],
    ['Yoga International — how to create a sankalpa', 'https://yogainternational.com/article/view/how-to-create-a-sankalpa'],
    ['Dixon et al. (2023) — belief in “manifesting” and financial risk', 'https://news.uq.edu.au/2023-09-20-manifesting-your-way-bankruptcy'],
    ['Mind Magic — Doty’s six steps (summary)', 'https://spdrdng.com/?p=14653'],
    ['Manifest Anything in 100 Days — Penguin India', 'https://www.penguin.co.in/book/manifest-anything-in-100-days/'],
  ];
  const method = () => {
    const c = MD().cfg;
    const step = (ico, h, p) => '<li><span class="mj-mi" aria-hidden="true">' + ico + '</span><div><b>' + h + '</b><p>' + p + '</p></div></li>';
    return '<ol class="mj-method">' +
      step('🙏', 'Gratitude first — specific, with the reason', 'Weekly gratitude lists made people more optimistic and healthier; writing three good things and why they happened raised happiness for up to six months. It also turns attention to what is already working.') +
      step('✨', 'Write it as already true, and feel it', 'Writing about your “best possible self” reliably raises optimism and positive feeling (29 studies). A sankalpa is said in the present tense — a resolve, not a request.') +
      step('🌱', 'Keep it believable', 'Sweeping lines (“I am completely successful”) can make people who doubt themselves feel worse. Specific or bridge wording works better: “I am becoming…”, “Every day I move closer to…”. The page asks how believable it is.') +
      step('🧱', 'Then face the obstacle — and plan for it', 'Only dreaming of the result lowers energy and effort. Picturing the wish, then the inner obstacle, then an if–then plan (WOOP) improves goal attainment across 24 studies with almost 16,000 people; if–then plans alone show a medium-to-large effect.') +
      step('🎬', 'See the steps, not only the finish', 'Students who spent five minutes a day picturing how they would study did better than those who did nothing. So the visualisation walks through the obstacle, your plan and the first step, after a brief taste of the outcome.') +
      step('🎯', 'One action every day', 'Small, visible wins keep motivation alive. Your action goes to that day’s tasks, and its tick shows here.') +
      step('🌙', 'Evening: notice what moved you closer', 'Writing down progress and opportunities trains attention to see them — and the list becomes your evidence when belief is low.') +
      step('🤝', 'A weekly report to someone you trust', 'In a study of 149 adults, those who wrote their goals, committed to actions and sent weekly progress reports to a friend accomplished the most.') +
      step('🔥', 'Keep going — about two months', 'A daily habit took a median of 66 days to become automatic (18 to 254). Missing one day did not matter — just continue the next day.') + '</ol>' +
      '<h3 class="mj-sub">From the books you shared</h3><ul class="mj-books">' +
      '<li><b>Mind Magic — James R. Doty, MD</b> (Stanford neurosurgeon): six steps — take back your attention; get clear on what you want; meet doubts with self-compassion and rewrite them into believable lines; embed the intention by writing, reading silently and aloud and seeing it, often; pursue it with small scheduled actions and link it to a benefit for others; then hold the outcome loosely. Here they are: the relaxation before you visualise, the believable statement, the read–say–write sankalpa, “who else will it help”, the daily action and “I hold the result lightly”.</li>' +
      '<li><b>Manifest Anything in 100 Days — Amiett Kumar</b>: a 100-day practice, one idea and a small task each day (gratitude, visualisation, affirmations, belief). Here: the “100-day journey” method and a theme for each day.</li>' +
      '<li><b>The Magic of Manifesting — Ryuu Shinohara</b>: fifteen techniques. Its full list could not be checked from public sources, so only the widely used ones are here: scripting, gratitude, visualisation and the 3-6-9 ritual.</li></ul>' +
      '<p class="notice mj-honest">There is no evidence that thoughts alone change what happens — and people who trusted “manifesting” alone took more financial risks. This journal keeps the parts that work: a clear intention you believe, a plan for your obstacle, and daily action. The 3-6-9 and 55×5 rituals and the traditional sankalpa are focus practices — their power is repetition, attention and faith.</p>' +
      '<h3 class="mj-sub">Settings</h3><div class="mj-set">' +
      '<label class="switch"><input type="checkbox" data-mjc="remind"' + (c.remind ? ' checked' : '') + '><span class="track"></span><span>Remind me while the diary is open</span></label>' +
      '<div class="mj-times"><label>Morning <input type="time" class="field" data-mjc="morning" value="' + e(c.morning || '06:30') + '"></label><label>Evening <input type="time" class="field" data-mjc="evening" value="' + e(c.evening || '21:30') + '"></label></div>' +
      '<h4 class="mj-sub">Traditional sankalpa</h4><div class="mj-times"><label>Name <input class="field" data-mjc="name" value="' + e(c.name || '') + '" placeholder="e.g. Amul"></label><label>Gotra <input class="field" data-mjc="gotra" value="' + e(c.gotra || '') + '" placeholder="optional"></label>' +
      '<label class="switch"><input type="checkbox" data-mjc="fem"' + (c.fem ? ' checked' : '') + '><span class="track"></span><span>Feminine form (गोत्रोत्पन्ना)</span></label></div></div>' +
      '<h3 class="mj-sub">Sources</h3><ul class="mj-src">' + SRC.map(x => '<li><a href="' + e(x[1]) + '" target="_blank" rel="noopener noreferrer">' + e(x[0]) + '</a></li>').join('') + '</ul>';
  };

  /* ---------------- writing a desire: a guided 5-step dialog ---------------- */
  const presentTense = w => {
    const s = txt(w).replace(/[.!]+$/, ''); if (!s) return [];
    const low = s.charAt(0).toLowerCase() + s.slice(1);
    const m = low.match(/^(i want to |i wish to |i will |to )?(become|be) (.+)$/i);
    const out = [];
    if (m) out.push('I am ' + m[3] + '.');
    out.push('I have achieved this: ' + low + '.', 'Every day I move closer to ' + (m ? 'being ' + m[3] : low) + '.', 'It is done — ' + low + '. Thank you.');
    return out;
  };
  MJ.edit = id => {
    const old = id ? MJ.desire(id) : null;
    const x = old ? JSON.parse(JSON.stringify(old)) : { method: 'daily', area: 'career', believe: 6, pics: [] };
    let step = 0, pe = null;
    const goals = (D().goals || []).filter(g => !g.done), dreams = ((D().dreams && D().dreams.list) || []).filter(d => d.status !== 'done');
    const o = (v, l, s) => '<option value="' + e(v) + '"' + (s ? ' selected' : '') + '>' + e(l) + '</option>';
    const STEPS = ['Wish', 'Picture it', 'As if it’s true', 'Obstacle & plan', 'Why & method'];
    const panes = [
      '<p class="mj-q">What do you want? <span class="hint">Important to you, challenging but possible. Keep it short.</span></p><input class="field mj-big" id="mj-title" maxlength="90" value="' + e(x.title || '') + '" placeholder="e.g. Promotion to Scientist G, my paper accepted, a fit body by 45">' +
        '<div class="mj-2"><label>Area<select class="field" id="mj-area">' + AREAS().map(a => o(a[0], a[2] + ' ' + a[1], a[0] === x.area)).join('') + '</select></label><label>By when (optional)<input class="field" type="date" id="mj-target" value="' + e(x.target || '') + '"></label></div>' +
        '<div class="mj-2"><label>Linked dream<select class="field" id="mj-dream">' + o('', '—', !x.dreamId) + dreams.map(d => o(d.id, d.title, d.id === x.dreamId)).join('') + '</select></label><label>Linked goal<select class="field" id="mj-goal">' + o('', '—', !x.goalId) + goals.map(g => o(g.id, g.title, g.id === x.goalId)).join('') + '</select></label></div>',
      '<p class="mj-q">Close your eyes and picture the best outcome. <span class="hint">Where are you? Who is with you? How does it feel?</span></p><textarea class="field" id="mj-outcome" rows="4" placeholder="I walk into … people congratulate me … I feel light, proud, grateful …">' + e(x.outcome || '') + '</textarea>' +
        '<p class="mj-q">A picture that says it <span class="hint">(your vision board — optional)</span></p><div class="pi-host" id="mj-pics"></div>',
      '<p class="mj-q">Write it as if it is already true — present tense, with a feeling.</p><textarea class="field mj-big" id="mj-stmt" rows="2" placeholder="I am … / I have …">' + e(x.statement || '') + '</textarea><div class="mj-sugg" id="mj-sugg"></div>' +
        '<label class="mj-bel">How believable is this to you right now? <b id="mj-belv" class="num">' + (x.believe || 6) + '</b>/10<input type="range" min="1" max="10" id="mj-bel" value="' + (x.believe || 6) + '"></label><p class="hint" id="mj-belh"></p>' +
        '<p class="mj-q">Your sankalpa — the short line you will repeat <span class="hint">(under 12 words; Hindi or English)</span></p><input class="field" id="mj-sank" maxlength="120" value="' + e(x.sankalpa || '') + '" placeholder="I am Scientist G, serving with joy.">' +
        '<p class="mj-q">For the traditional Sanskrit sankalpa <span class="hint">— your wish in a few Hindi words (optional)</span></p><input class="field" id="mj-hi" lang="hi" value="' + e(x.hi || '') + '" placeholder="e.g. उत्तम पदोन्नति की प्राप्ति">',
      '<p class="mj-q">What inside you could stop you? <span class="hint">An inner obstacle you can work on — a habit, a feeling, a belief.</span></p><textarea class="field" id="mj-obst" rows="2" placeholder="I put it off when I’m tired; I doubt I’m good enough …">' + e(x.obstacle || '') + '</textarea>' +
        '<p class="mj-q">Your if–then plan</p><div class="mj-if"><span>If</span><input class="field" id="mj-ifc" value="' + e(x.ifc || '') + '" placeholder="I feel like putting it off after dinner"><span>then I will</span><input class="field" id="mj-then" value="' + e(x.then || '') + '" placeholder="open the file and work for just 10 minutes"></div>',
      '<p class="mj-q">Why does it matter to you? <span class="hint">The value behind it — family, service, freedom, growth.</span></p><textarea class="field" id="mj-why" rows="2">' + e(x.why || '') + '</textarea>' +
        '<p class="mj-q">Who else will it help when it comes true? <span class="hint">(family, colleagues, people you serve)</span></p><input class="field" id="mj-others" value="' + e(x.others || '') + '">' +
        '<p class="mj-q">How will you practise?</p><div class="mj-meth">' + METHODS.map(m => '<label class="sa-r"><input type="radio" name="mj-m" value="' + m[0] + '"' + ((x.method || 'daily') === m[0] ? ' checked' : '') + '><span><b>' + e(m[1]) + '</b><small>' + e(m[2]) + '</small></span></label>').join('') + '</div>',
    ];
    ED.ui.modal({
      title: old ? 'Edit desire' : 'A new desire', cls: 'st-modal wide mj-modal', sticky: true,
      body: '<ol class="mj-steps">' + STEPS.map((s, i) => '<li data-i="' + i + '">' + (i + 1) + '. ' + e(s) + '</li>').join('') + '</ol>' + panes.map((p, i) => '<div class="mj-pane" data-i="' + i + '" hidden>' + p + '</div>').join(''),
      footer: (old ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-x="back">Back</button><button type="button" class="btn primary" data-x="next">Next</button>',
      onMount(el, api) {
        const $ = s => el.querySelector(s);
        pe = ED.pics ? ED.pics.editor($('#mj-pics'), x.pics || [], { max: 4 }) : null;
        const show = () => {
          U.$$('.mj-pane', el).forEach(p => { p.hidden = +p.dataset.i !== step; });
          U.$$('.mj-steps li', el).forEach(li => { li.classList.toggle('on', +li.dataset.i === step); li.classList.toggle('done', +li.dataset.i < step); });
          $('[data-x="back"]').disabled = step === 0; $('[data-x="next"]').textContent = step === 4 ? 'Save' : 'Next';
          if (step === 2) { if (!txt($('#mj-stmt').value)) $('#mj-stmt').value = presentTense($('#mj-title').value)[0] || ''; sugg(); bel(); }
          const f = el.querySelector('.mj-pane:not([hidden]) input, .mj-pane:not([hidden]) textarea'); if (f) setTimeout(() => f.focus(), 30);
        };
        const sugg = () => { $('#mj-sugg').innerHTML = presentTense($('#mj-title').value).map(s => '<button type="button" class="chip-btn" data-s="' + e(s) + '">' + e(s) + '</button>').join(''); };
        const bel = () => { const v = +$('#mj-bel').value; $('#mj-belv').textContent = v; $('#mj-belh').innerHTML = v < 6 ? 'If it feels far, make it a bridge you can believe: <button type="button" class="link-btn" data-bridge="1">“I am becoming …”</button> or <button type="button" class="link-btn" data-bridge="2">“Every day I move closer to …”</button>. Belief can grow — you will rate it each evening.' : 'Good — believable enough to feel it.'; };
        el.addEventListener('input', ev => { if (ev.target.id === 'mj-bel') bel(); if (ev.target.id === 'mj-title' && step === 2) sugg(); });
        el.addEventListener('click', ev => {
          const s = ev.target.closest('[data-s]'); if (s) { $('#mj-stmt').value = s.dataset.s; return; }
          const b = ev.target.closest('[data-bridge]');
          if (b) { const base = txt($('#mj-title').value).replace(/^(i want to |i wish to |to )/i, '').replace(/^(become|be) /i, ''); $('#mj-stmt').value = (b.dataset.bridge === '1' ? 'I am becoming ' : 'Every day I move closer to ') + (/^[A-Z]{2}|^[A-Z][a-z]+ [A-Z]/.test(base) ? base : base.charAt(0).toLowerCase() + base.slice(1)) + '.'; return; }
          const li = ev.target.closest('.mj-steps li'); if (li && +li.dataset.i < step) { step = +li.dataset.i; show(); }
        });
        const read = () => {
          x.title = txt($('#mj-title').value); x.area = $('#mj-area').value; x.target = U.isKey($('#mj-target').value) ? $('#mj-target').value : '';
          x.dreamId = $('#mj-dream').value || ''; x.goalId = $('#mj-goal').value || ''; x.outcome = txt($('#mj-outcome').value);
          x.statement = txt($('#mj-stmt').value); x.believe = +$('#mj-bel').value; x.sankalpa = txt($('#mj-sank').value); x.hi = txt($('#mj-hi').value);
          x.obstacle = txt($('#mj-obst').value); x.ifc = txt($('#mj-ifc').value); x.then = txt($('#mj-then').value); x.why = txt($('#mj-why').value); x.others = txt($('#mj-others').value);
          x.method = (el.querySelector('input[name="mj-m"]:checked') || {}).value || 'daily';
          if (pe) x.pics = pe.get();
        };
        $('[data-x="back"]').addEventListener('click', () => { if (step > 0) { step--; show(); } });
        $('[data-x="next"]').addEventListener('click', () => {
          if (step === 0 && !txt($('#mj-title').value)) { ED.ui.toast('What do you want? Write it in a few words.'); $('#mj-title').focus(); return; }
          if (step < 4) { step++; show(); return; }
          read();
          if (!x.statement) x.statement = presentTense(x.title)[0] || x.title;
          if (!x.sankalpa) x.sankalpa = x.statement;
          ED.store.checkpoint(old ? 'Edit desire' : 'New desire');
          const m = MD();
          if (old) Object.assign(old, x, { updatedAt: Date.now(), start: old.method !== x.method ? today() : old.start });
          else { x.id = U.uid('mj'); x.status = 'active'; x.start = today(); x.createdAt = Date.now(); x.updatedAt = Date.now(); m.desires.push(x); if (!m.cfg.main || !MJ.desire(m.cfg.main)) m.cfg.main = x.id; }
          ED.store.commit(); api.close();
          ED.ui.toast(old ? 'Saved' : 'Desire written ✨ — your journal for today is ready');
        });
        const del = $('[data-x="del"]');
        if (del) del.addEventListener('click', async () => {
          if (!await ED.ui.confirm({ title: 'Delete “' + old.title + '”?', message: 'The desire is removed; your journal days stay. You can undo right after.', ok: 'Delete', danger: true })) return;
          ED.store.checkpoint('Delete desire'); MD().desires = MD().desires.filter(y => y.id !== old.id); if (MD().cfg.main === old.id) MD().cfg.main = ''; ED.store.commit(); api.close(); ED.ui.undoToast('Desire deleted');
        });
        show();
      },
    });
  };

  /* ---------------- the 2-minute visualisation ---------------- */
  MJ.visualise = () => {
    const k = curDate(), x = MJ.focus(k), d = MJ.day(k, true); if (!x) return;
    const plan = txt(d.plan) || txt(x.then), obst = txt(d.obstacle) || txt(x.ifc) || txt(x.obstacle), act = txt(d.action);
    const P = [
      ['Relax', 'Close your eyes. Breathe slowly. Soften your face, shoulders and belly; let the day go quiet.'],
      ['The wish fulfilled', 'Picture it done: ' + (x.statement || x.title) + ' Feel it for a few breaths' + (x.outcome ? ' — ' + x.outcome : '') + '.'],
      ['The obstacle', obst ? 'Now see the moment “' + obst + '” shows up. Notice it, calmly.' : 'Now see what inside you might get in the way. Notice it, calmly.'],
      ['Your plan', plan ? 'See yourself respond: “' + plan + '”. Watch yourself do it.' : 'See yourself handling it — the exact thing you will do.'],
      ['Where and when', 'Picture where and when you will take today’s step' + (act ? ': ' + act : '') + '.'],
      ['The first move', 'See yourself starting — the first small movement, the first minute.'],
      ['Finishing', 'See yourself finishing it, and the quiet feeling of progress. Then open your eyes.'],
    ];
    const SECS = 20 * P.length;
    let t0 = Date.now(), timer = null, spoke = -1;
    const speak = s => { try { if (!MD().cfg.speak || !window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(s); u.rate = 0.9; u.lang = 'en-IN'; speechSynthesis.speak(u); } catch (err) { /* ignore */ } };
    ED.ui.modal({
      title: 'See the steps — 2½ minutes', cls: 'st-modal mj-vmodal',
      body: '<div class="mj-breath" aria-hidden="true"><i></i></div><p class="mj-vh"></p><p class="mj-vstep" aria-live="polite"></p><div class="mj-vbar"><i></i></div><label class="switch mj-speak"><input type="checkbox"' + (MD().cfg.speak ? ' checked' : '') + '><span class="track"></span><span>Read the steps aloud</span></label>',
      footer: '<span class="hint">Breathe in as the circle grows, out as it shrinks.</span><span class="grow"></span><button type="button" class="btn primary" data-mclose>Finish</button>',
      onMount(el) {
        el.querySelector('.mj-speak input').addEventListener('change', ev => { MD().cfg.speak = ev.target.checked; ED.store.commit({ silent: true }); });
        const tick = () => {
          const s = (Date.now() - t0) / 1000, i = Math.min(P.length - 1, Math.floor(s / 20));
          el.querySelector('.mj-vh').textContent = (i + 1) + ' / ' + P.length + ' · ' + P[i][0];
          el.querySelector('.mj-vstep').textContent = P[i][1];
          el.querySelector('.mj-vbar i').style.width = Math.min(100, s / SECS * 100) + '%';
          if (spoke !== i) { spoke = i; speak(P[i][1]); }
          if (s >= SECS) { clearInterval(timer); el.querySelector('.mj-vh').textContent = 'Done 🙏'; }
        };
        tick(); timer = setInterval(tick, 500);
      },
      onClose() {
        clearInterval(timer); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (err) { /* ignore */ }
        const secs = Math.round((Date.now() - t0) / 1000);
        if (secs >= 10) { const dd = MJ.day(k, true); dd.vis = (dd.vis || 0) + secs; if (!dd.focus) dd.focus = x.id; touch(dd); ED.store.commit(); }
      },
    });
  };

  /* ---------------- the weekly report ---------------- */
  MJ.weekText = () => {
    const t = today(), ks = U.range(U.addDays(t, -6), 7), days = MD().days;
    const lines = ['My manifestation week (' + U.fmtShort(ks[0]) + ' – ' + U.fmtShort(t) + ')'];
    MJ.active().forEach(x => {
      const mine = ks.filter(k => days[k] && (days[k].focus === x.id || (!days[k].focus && MJ.focus(k) && MJ.focus(k).id === x.id)));
      const b = mine.map(k => days[k].belief).filter(v => v);
      const acts = mine.filter(k => days[k].taskId), done = acts.filter(k => taskDone(days[k], k));
      lines.push('', '✨ ' + x.title + ' — practised ' + mine.filter(MJ.practised).length + '/7 days' + (b.length ? ', belief ' + b[0] + '→' + b[b.length - 1] + '/10' : '') + (acts.length ? ', actions done ' + done.length + '/' + acts.length : ''));
      mine.filter(k => txt(days[k].moved)).slice(-3).forEach(k => lines.push('  • ' + txt(days[k].moved)));
      if (x.then) lines.push('  Plan: if ' + (x.ifc || 'the obstacle comes') + ', then I will ' + x.then + '.');
    });
    lines.push('', 'Streak: ' + MJ.streak() + ' days 🔥');
    return lines.join('\n');
  };
  MJ.week = () => {
    const text = MJ.weekText();
    ED.ui.modal({
      title: 'Weekly report', cls: 'st-modal mj-modal',
      body: '<p class="hint">Send it to one person you trust — a friend, your spouse, a mentor. Accountability is part of what works.</p><textarea class="field mj-wtext" rows="12" readonly>' + e(text) + '</textarea>',
      footer: '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(text) + '">WhatsApp</a><a class="btn" href="mailto:?subject=' + encodeURIComponent('My manifestation week') + '&body=' + encodeURIComponent(text) + '">Email</a><span class="grow"></span><button type="button" class="btn primary" data-x="copy">' + ED.icon('copy') + 'Copy</button>',
      onMount(el) { el.querySelector('[data-x="copy"]').addEventListener('click', async () => ED.ui.toast(await U.copy(text) ? 'Copied' : 'Select the text and copy it')); },
    });
  };

  /* ---------------- typing on the page is saved at once (no redraw) ---------------- */
  const marks = root => {
    const k = curDate(), d = MJ.day(k) || {}, x = MJ.focus(k);
    U.$$('.mj-sec', root).forEach(s => { const def = MJ.STEPS.find(z => z[0] === s.dataset.step); if (!def) return; const ok = def[3](d, x); s.classList.toggle('done', ok); const m = s.querySelector('.mj-ok'); if (m) m.textContent = ok ? '✓' : ''; });
    const r = root.querySelector('.mj-ring'); if (r) r.outerHTML = ring(MJ.score(k));
  };
  let tmr = 0;
  const onInput = (root, ev) => {
    const t = ev.target, key = t.dataset && t.dataset.mj; if (!key) return;
    const k = curDate(), d = MJ.day(k, true), x = MJ.focus(k);
    if (!d.focus && x) d.focus = x.id;
    if (/^grat\d$/.test(key)) { d.grat = d.grat || ['', '', '']; d.grat[+key.slice(4)] = t.value; }
    else if (key === 'release') d.release = t.checked;
    else if (key === 'belief' || key === 'close') { d[key] = +t.value; const v = root.querySelector('[data-v="' + key + '"]'); if (v) v.textContent = t.value; }
    else if (key === 'sayTxt') {
      const sl = x && x.method === '369' ? slot() : 'm';
      d.sayTxt = d.sayTxt || {}; d.sayTxt[sl] = t.value;
      const n = t.value.split(/\n/).filter(l => txt(l).length >= 3).length;
      d.say = d.say || {}; d.say[sl] = Math.max(n, d.sayTap && d.sayTap[sl] || 0);
      const b = root.querySelector('.mj-saybtn b'); if (b) b.textContent = d.say[sl] + '/' + target(x, sl);
    }
    else d[key] = t.value;
    if (key === 'action') { const b = root.querySelector('[data-act="mj-task"]'); if (b) b.disabled = !txt(t.value); }
    if (key === 'script') { const w = root.querySelector('.mj-wc'); if (w) w.textContent = wc(t.value); }
    touch(d);
    clearTimeout(tmr); tmr = setTimeout(() => ED.store.commit({ silent: true }), 400);
    marks(root);
  };

  /* ---------------- actions ---------------- */
  A['mj-new'] = () => MJ.edit(null);
  A['mj-edit'] = el => MJ.edit(el.dataset.id);
  A['mj-tab'] = el => { st().tab = el.dataset.k; ED.app.render(); };
  A['mj-quick'] = () => { MD().cfg.quick = !MD().cfg.quick; ED.store.commit(); };
  A['mj-date'] = el => { const n = +el.dataset.d; st().date = n === 0 ? null : U.addDays(curDate(), n) > today() ? null : U.addDays(curDate(), n); ED.app.render(); };
  A['mj-focus'] = el => { const d = MJ.day(curDate(), true); d.focus = el.dataset.id; touch(d); ED.store.commit(); };
  A['mj-main'] = el => { MD().cfg.main = el.dataset.id; ED.store.commit(); };
  A['mj-mood'] = el => { const d = MJ.day(curDate(), true), i = +el.dataset.i; d.mood = d.mood === i ? null : i; if (!d.focus && MJ.focus(curDate())) d.focus = MJ.focus(curDate()).id; touch(d); ED.store.commit(); };
  A['mj-say'] = el => {
    const k = curDate(), d = MJ.day(k, true), x = MJ.focus(k), sl = el.dataset.sl || 'm';
    if (!d.focus && x) d.focus = x.id;
    d.say = d.say || {}; d.sayTap = d.sayTap || {};
    d.sayTap[sl] = (d.sayTap[sl] || 0) + 1; d.say[sl] = (d.say[sl] || 0) + 1;
    touch(d); ED.store.commit({ silent: true });
    const b = el.querySelector('b'); if (b) b.textContent = d.say[sl] + '/' + target(x, sl);
    const root = el.closest('.mj-l'); if (root) marks(root);
    if (d.say[sl] === target(x, sl)) ED.ui.toast('🙏 ' + (x && x.method === '369' ? ({ m: 'Morning', a: 'Afternoon', n: 'Night' })[sl] + ' done' : 'Sankalpa done for today'));
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* ignore */ } }
  };
  A['mj-vis'] = () => MJ.visualise();
  A['mj-task'] = () => {
    const k = curDate(), d = MJ.day(k, true), x = MJ.focus(k);
    if (!txt(d.action)) { ED.ui.toast('Write the action first'); return; }
    if (taskOf(d)) return;
    ED.store.checkpoint('Manifest action');
    const t = M.newTask({ title: '✨ ' + txt(d.action), prio: 'A', date: k, goalId: (x && x.goalId) || null, notes: x ? 'For: ' + x.title + (x.then ? '\nIf ' + (x.ifc || 'it gets hard') + ', then I will ' + x.then + '.' : '') : '' });
    t.num = M.nextNum('A', k);
    if (ED.studyLink && ED.studyLink.place) { try { ED.studyLink.place(t); t.categoryId = null; } catch (err) { /* keep defaults */ } }
    D().tasks.push(t); d.taskId = t.id; if (!d.focus && x) d.focus = x.id; touch(d);
    ED.store.commit(); ED.ui.undoToast('Added to ' + (k === today() ? 'today’s' : U.fmtShort(k) + '’s') + ' tasks as A' + t.num);
  };
  A['mj-done'] = el => {
    const x = MJ.desire(el.dataset.id); if (!x) return;
    ED.ui.modal({
      title: '🎉 It manifested!', cls: 'st-modal mj-modal',
      body: '<p>Wonderful. Note the date and how it came — it will strengthen the next desire.</p><label class="lbl" for="mj-dd">Date</label><input class="field" type="date" id="mj-dd" value="' + today() + '"><label class="lbl" for="mj-dn">How it happened, and thanks</label><textarea class="field" id="mj-dn" rows="3"></textarea>',
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="ok">Mark manifested</button>',
      onMount(m, api) {
        m.querySelector('[data-x="ok"]').addEventListener('click', () => {
          ED.store.checkpoint('Manifested'); x.status = 'manifested'; x.doneOn = U.isKey(m.querySelector('#mj-dd').value) ? m.querySelector('#mj-dd').value : today(); x.doneNote = txt(m.querySelector('#mj-dn').value); touch(x);
          if (MD().cfg.main === x.id) MD().cfg.main = (MJ.active()[0] || {}).id || '';
          if (x.dreamId && ED.store.data.dreams) { const dr = (ED.store.data.dreams.list || []).find(y => y.id === x.dreamId); if (dr && dr.status !== 'done') { dr.status = 'done'; dr.doneOn = x.doneOn; dr.updatedAt = Date.now(); } }
          ED.store.commit(); api.close(); ED.ui.undoToast('🎉 “' + x.title + '” manifested — on your wall of thanks');
        });
      },
    });
  };
  A['mj-release'] = async el => {
    const x = MJ.desire(el.dataset.id); if (!x) return;
    if (!await ED.ui.confirm({ title: 'Let go of “' + x.title + '”?', message: 'It rests in “Let go” with all its days — you can make it active again any time.', ok: 'Let go' })) return;
    ED.store.checkpoint('Let go'); x.status = 'released'; touch(x); if (MD().cfg.main === x.id) MD().cfg.main = (MJ.active()[0] || {}).id || ''; ED.store.commit(); ED.ui.undoToast('Let go — with thanks');
  };
  A['mj-again'] = el => { const x = MJ.desire(el.dataset.id); if (!x) return; ED.store.checkpoint('Desire'); x.status = 'active'; x.start = today(); delete x.doneOn; touch(x); ED.store.commit(); };
  A['mj-week'] = () => MJ.week();

  ED.views = ED.views || {};
  ED.views.manifest = {
    id: 'manifest', label: 'Manifest', left, right,
    mount(L, R) {
      L.addEventListener('input', ev => onInput(L, ev));
      R.addEventListener('change', ev => {
        const t = ev.target, k = t.dataset && t.dataset.mjc; if (!k) return;
        MD().cfg[k] = t.type === 'checkbox' ? t.checked : t.value.trim(); ED.store.commit({ silent: true });
        if (k === 'name' || k === 'gotra' || k === 'fem') ED.app.renderPage('left');
      });
      if (ED.charts) ED.charts.bind(R);
    },
  };

  /* ---------------- reminders (while the diary is open) ---------------- */
  const FIRED = 'ed-mj-fired';
  MJ.remindCheck = () => {
    const m = D() && D().manifest; if (!m || !m.cfg || !m.cfg.remind || !MJ.active().length || !ED.reminders) return;
    const k = today(), now = U.nowMin(), d = MJ.day(k) || {}, x = MJ.focus(k);
    let f = {}; try { f = JSON.parse(localStorage.getItem(FIRED) || '{}'); } catch (err) { f = {}; }
    const due = (t, key) => { const a = U.toMin(t || '00:00'); return now >= a && now <= a + 30 && f[key] !== k; };
    const ring = (key, title, body) => { f[key] = k; try { localStorage.setItem(FIRED, JSON.stringify(f)); } catch (err) { /* ignore */ } ED.reminders.fire(title, body, 'mj-' + key + '-' + k, () => { ED.state.tab = 'manifest'; ED.go.tab('manifest'); }); };
    if (due(m.cfg.morning || '06:30', 'm') && MJ.score(k) < 0.5) ring('m', '✨ Your manifestation journal', 'Gratitude, sankalpa' + (x ? ' — “' + (x.sankalpa || x.title) + '”' : '') + ', and one action for today.');
    if (due(m.cfg.evening || '21:30', 'e') && !MJ.STEPS[5][3](d)) ring('e', '🌙 Evening reflection', 'What moved you closer today? Rate your belief, and say thank you.');
  };
  setInterval(() => { try { MJ.remindCheck(); } catch (err) { /* ignore */ } }, 60000);
})();
