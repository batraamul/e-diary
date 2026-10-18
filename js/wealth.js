/* E-Diary — Wealth plan (Finance Plan → "Portfolio & risk" and the "Wealth report" tab), laid out like a
   wealth manager's report:
     • the facts at the top: amount invested, period, approach, money saved each month, goals, emergency fund
     • investment approaches (conservative / balanced / aggressive / your own mix) built from six asset classes,
       each with an expected yearly return and volatility you can change; the mix gives the portfolio's expected
       growth and its volatility (the correlations between assets are included)
     • short-term cash-flow buckets: an emergency corpus in liquid funds, and money needed in 0–12, 12–24 and
       24–36 months set aside in safer funds; the rest is invested for the long term
     • compounding at the expected growth and ±2%, with "today's value" (discounted at a rate you choose)
     • the portfolio year by year with your cash flows: what you save goes in, goals come out, and money for
       goals due within three years is parked in debt so a market fall does not hit it
     • what a monthly SIP and a yearly step-up add
     • risk: the chance of beating 7% a year and of not losing capital over 1, 3, 5 and 7 years, a bad year in 20,
       and a Monte Carlo run of the whole plan (1,000 simulated markets) giving the chance the money lasts and the
       10th, 50th and 90th percentile outcomes.
   The maths (all yearly). Asset i has median growth g_i and volatility σ_i, so its mean return is a_i = g_i + σ_i²/2.
   The portfolio (rebalanced yearly) has a = Σ w_i a_i and σ² = Σ_i Σ_j w_i w_j σ_i σ_j ρ_ij. Its yearly growth
   factor is taken as lognormal with s² = ln(1 + σ²/(1+a)²) and μ = ln(1+a) − s²/2, so the mean is a and the spread σ;
   the median growth is e^μ − 1. Over n years the growth rate is normal in logs, so
   P(yearly growth over n years ≥ t) = 1 − Φ((ln(1+t) − μ)·√n / s) exactly under this model.
   The simulation uses a fixed seed so the numbers stay put between visits. Everything is an estimate. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const CH = ED.charts;
  const D = () => ED.store.data;
  const P = () => D().finance.plan;
  const W = () => P().wealth || ED.sample.wealth();
  const A = (ED.actions = ED.actions || {});
  const CHG = (ED.changes = ED.changes || {});
  const st = () => ED.state.fp || (ED.state.fp = {});
  const M$ = v => ED.finance.money(Math.round(v || 0), { dec: false });
  const C$ = v => (v < 0 ? '−' : '') + (ED.finance.symbol() + CH.compact(Math.abs(v))).replace(/\s/g, '');
  const pc = (v, d) => { const k = Math.pow(10, d == null ? 1 : d); return (Math.round(v * k) / k) + '%'; };
  const opt = (v, label, sel) => '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';

  /* six asset classes, in a fixed colour order. ret = expected yearly growth (median), vol = spread of yearly returns.
     "history": index returns 2005–2025 as printed in typical Indian wealth reports (median 5-year rolling growth);
     volatility is the spread of calendar-year returns, which includes years like 2008 and 2020.
     "cautious": lower returns, for a plan that should still work if the next 20 years are weaker. */
  const ASSETS = [
    { k: 'eqL', label: 'Large & multi-cap equity', index: 'e.g. NIFTY 500 TRI', why: 'Core long-term growth', color: 'var(--s1)' },
    { k: 'eqM', label: 'Mid & small-cap equity', index: 'e.g. NIFTY MidSmallcap 400 TRI', why: 'Extra growth, with bigger swings', color: 'var(--s2)' },
    { k: 'debt', label: 'Debt / bonds', index: 'e.g. short-term AA bond funds', why: 'Steady income; cushions falls', color: 'var(--s3)' },
    { k: 'gold', label: 'Gold', index: 'e.g. gold ETF / MCX gold (₹)', why: 'Moves differently from shares; guards against a weak rupee', color: 'var(--s4)' },
    { k: 'arb', label: 'Arbitrage / hybrid', index: 'e.g. arbitrage funds', why: 'Low-risk parking, taxed like equity', color: 'var(--s5)' },
    { k: 'cash', label: 'Liquid / cash', index: 'e.g. liquid funds, savings account', why: 'Emergency money and bills due soon', color: 'var(--s6)' },
  ];
  const PRESETS = {
    history: { label: 'Past 20 years', eqL: [13.1, 18], eqM: [14.6, 24], debt: [7.5, 3], gold: [12.5, 15], arb: [6.7, 1], cash: [6.5, 0.5] },
    cautious: { label: 'Cautious', eqL: [11, 18], eqM: [12, 24], debt: [7, 3], gold: [8, 15], arb: [6.3, 1], cash: [6, 0.5] },
  };
  /* correlations between yearly returns, same order as ASSETS */
  const RHO = [
    [1, 0.88, 0.05, -0.05, 0.2, 0],
    [0.88, 1, 0, -0.05, 0.15, 0],
    [0.05, 0, 1, 0.15, 0.3, 0.3],
    [-0.05, -0.05, 0.15, 1, 0, 0],
    [0.2, 0.15, 0.3, 0, 1, 0.5],
    [0, 0, 0.3, 0, 0.5, 1],
  ];
  const APPROACHES = [
    { k: 'conservative', label: 'Conservative growth', note: 'Measured growth with limited swings', w: { eqL: 32, eqM: 0, debt: 30, gold: 6, arb: 32, cash: 0 } },
    { k: 'balanced', label: 'Balanced growth', note: 'Equal weight on stability and market growth', w: { eqL: 45, eqM: 19, debt: 10, gold: 10, arb: 16, cash: 0 } },
    { k: 'aggressive', label: 'Aggressive growth', note: 'Mostly shares — for money not needed for 10+ years', w: { eqL: 50, eqM: 30, debt: 5, gold: 10, arb: 5, cash: 0 } },
    { k: 'custom', label: 'My own mix', note: 'Your own weights' },
  ];
  const WL = (ED.wealth = { ASSETS, APPROACHES, PRESETS, RHO });

  /* ---------------- assumptions and portfolio maths ---------------- */
  WL.assets = () => {
    const over = W().assets || {};
    const base = PRESETS.history;
    return ASSETS.map(a => Object.assign({}, a, { ret: over[a.k] && over[a.k].ret != null ? over[a.k].ret : base[a.k][0], vol: over[a.k] && over[a.k].vol != null ? over[a.k].vol : base[a.k][1] }));
  };
  const amap = () => { const m = {}; WL.assets().forEach(a => { m[a.k] = a; }); return m; };
  WL.weights = k => {
    const ap = APPROACHES.find(x => x.k === k) || APPROACHES[1];
    if (ap.k === 'custom') return Object.assign({ eqL: 0, eqM: 0, debt: 0, gold: 0, arb: 0, cash: 0 }, W().custom || APPROACHES[1].w);
    return ap.w;
  };
  WL.label = k => (APPROACHES.find(x => x.k === k) || APPROACHES[1]).label;
  WL.stats = w => {
    const as = WL.assets();
    const tot = as.reduce((s, x) => s + Math.max(0, +w[x.k] || 0), 0);
    const ws = as.map(x => tot ? Math.max(0, +w[x.k] || 0) / tot : 0);
    const g = as.map(x => x.ret / 100), sd = as.map(x => x.vol / 100);
    const a = ws.reduce((s, wi, i) => s + wi * (g[i] + sd[i] * sd[i] / 2), 0);
    let v = 0;
    for (let i = 0; i < ws.length; i++) for (let j = 0; j < ws.length; j++) v += ws[i] * ws[j] * sd[i] * sd[j] * RHO[i][j];
    const s2 = Math.log(1 + v / ((1 + a) * (1 + a)));
    const s = Math.sqrt(Math.max(s2, 1e-10)), mu = Math.log(1 + a) - s2 / 2;
    return { a, sd: Math.sqrt(v), s, mu, g: Math.exp(mu) - 1, ws, sum: tot };
  };
  /* an approach's numbers; "my own mix" with every weight at 0 uses the balanced mix until weights are entered */
  WL.statsOf = k => { const T = WL.stats(WL.weights(k)); if (T.sum) return T; return Object.assign(WL.stats(APPROACHES[1].w), { sum: 0, fallback: true }); };
  /* expected growth of the chosen approach, in % (the plan can use it instead of its own figure) */
  WL.expected = () => WL.statsOf(W().approach).g * 100;

  /* normal distribution */
  const Phi = x => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804 * Math.exp(-x * x / 2);
    const q = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - q : q;
  };
  /* chance that the yearly growth over n years is at least t (t = 0 means capital is not lost) */
  WL.chance = (S, t, n) => 1 - Phi((Math.log(1 + t) - S.mu) * Math.sqrt(n) / S.s);
  WL.badYear = S => Math.exp(S.mu - 1.6449 * S.s) - 1;     // 1 year in 20 is worse than this
  WL.goodYear = S => Math.exp(S.mu + 1.6449 * S.s) - 1;
  const word = p => p >= 0.8 ? 'High' : p >= 0.6 ? 'Moderate' : 'Low';

  /* seeded random numbers */
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gauss = r => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };

  /* ---------------- the portfolio year by year ---------------- */
  WL.start = () => {
    const p = P(), w = W();
    const S0 = w.amount != null && w.amount !== '' ? Math.max(0, +w.amount || 0) : Math.max(0, p.savings || 0);
    const E0 = Math.max(0, Math.min(S0, (p.expenses || 0) * (p.emergencyMonths || 0)));
    return { S0, E0 };
  };
  /* one path through the plan. retFn(i) = growth of the long-term portfolio in year i.
     Money saved in a year (+) goes in through the year; money drawn for goals (−) comes out of the parked part.
     At the start of each year, what the next three years will draw is parked in debt; the emergency fund sits in
     liquid funds and is topped up with inflation. Tax on growth as in the plan. */
  WL.path = (R, retFn, o) => {
    o = o || {};
    const p = P(), am = amap();
    const rt = (p.retTax || 0) / 100, rd = am.debt.ret / 100, rc = am.cash.ret / 100, inf = (p.inflation || 0) / 100;
    const f = R.rows.map(x => o.noFlows ? 0 : x.surplus);
    const need = f.map(v => Math.max(0, -v));
    const { S0, E0 } = WL.start();
    let Em = o.noEmergency ? 0 : E0, L = S0 - Em, Pk = 0, broke = -1;
    const rows = [];
    for (let i = 0; i < f.length; i++) {
      const open = L + Pk + Em;
      const target = need[i] + (need[i + 1] || 0) / (1 + rd) + (need[i + 2] || 0) / Math.pow(1 + rd, 2);
      const tot = L + Pk;
      if (tot > 0) { Pk = Math.min(target, tot); L = tot - Pk; } else { Pk = 0; L = tot; }
      const parked = Pk;
      const rL = retFn(i);
      const inflow = Math.max(0, f[i]), draw = need[i];
      const bL = L + inflow / 2, gL = bL > 0 ? bL * rL : 0;
      const bP = Pk - draw / 2, gP = bP > 0 ? bP * rd : 0;
      const gE = Em > 0 ? Em * rc : 0;
      const tax = (Math.max(0, gL) + Math.max(0, gP) + Math.max(0, gE)) * rt;
      L += inflow + gL - Math.max(0, gL) * rt;
      Pk += gP - Math.max(0, gP) * rt - draw;
      if (Pk < 0) { L += Pk; Pk = 0; }
      Em += gE - Math.max(0, gE) * rt;
      const eT = o.noEmergency ? 0 : E0 * Math.pow(1 + inf, i + 1);
      if (Em < eT && L > 0) { const d = Math.min(eT - Em, L); Em += d; L -= d; }
      const close = L + Pk + Em;
      if (close < 0 && broke < 0) broke = i;
      rows.push({ i, fy: R.rows[i].fy, age: R.rows[i].age, open, growth: gL + gP + gE, tax, inflow, draw, parked, close, names: R.rows[i].goalNames.concat(R.rows[i].evNames) });
    }
    return { rows, broke };
  };

  /* Monte Carlo over the whole plan: many possible market paths for the long-term portfolio */
  let memo = { key: '', val: null };
  WL.simulate = (R, S, n) => {
    n = n || 1000;
    const key = JSON.stringify([P(), R.y0, S.mu, S.s, n]);
    if (memo.key === key) return memo.val;
    const H = R.rows.length, r = rng(20260930);
    const cols = Array.from({ length: H }, () => new Float64Array(n));
    let ok = 0;
    const z = new Float64Array(H);
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < H; i++) z[i] = gauss(r);
      const res = WL.path(R, i => Math.exp(S.mu + S.s * z[i]) - 1);
      res.rows.forEach((x, i) => { cols[i][k] = x.close; });
      if (res.broke < 0) ok++;
    }
    const q = (a, t) => a[Math.min(a.length - 1, Math.max(0, Math.round(t * (a.length - 1))))];
    const p10 = [], p50 = [], p90 = [];
    cols.forEach(c => { const a = Array.from(c).sort((x, y) => x - y); p10.push(q(a, 0.1)); p50.push(q(a, 0.5)); p90.push(q(a, 0.9)); });
    const val = { p10, p50, p90, success: ok / n, n };
    memo = { key, val };
    return val;
  };

  /* lump sum with a monthly SIP (optionally raised every year), invested at the start of each month */
  WL.sipValue = (S0, g, years, sip, step) => {
    const rm = Math.pow(1 + g, 1 / 12) - 1;
    let v = S0 * Math.pow(1 + g, years);
    for (let m = 0; m < years * 12; m++) v += (sip || 0) * Math.pow(1 + (step || 0), Math.floor(m / 12)) * Math.pow(1 + rm, years * 12 - m);
    return v;
  };
  const pv = (v, n) => v / Math.pow(1 + (W().discount != null ? W().discount : 9) / 100, n);

  /* the monthly amount the SIP illustration uses: your own figure, or what the plan saves a month now */
  WL.sipAmount = R => { const w = W(); return w.sip != null && w.sip !== '' ? Math.max(0, +w.sip || 0) : Math.max(0, Math.round((R.first.surplus / 12) / 500) * 500); };

  /* ---------------- left page: portfolio & risk ---------------- */
  const bar = ws => '<span class="wl-bar" aria-hidden="true">' + ASSETS.map((a, i) => ws[i] > 0.0005 ? '<i style="flex:' + ws[i] + ';background:' + a.color + '"></i>' : '').join('') + '</span>';
  const fact = (icon, label, value, sub) => '<div class="wl-fact"><span class="wl-fi" aria-hidden="true">' + icon + '</span><span class="hint">' + e(label) + '</span><b>' + value + '</b>' + (sub ? '<span class="hint">' + sub + '</span>' : '') + '</div>';

  WL.left = () => {
    const p = P(), w = W();
    const R = ED.finplan.run();
    const { S0, E0 } = WL.start();
    const k = w.approach || 'balanced';
    const S = WL.statsOf(k);
    const monthly = R.first.surplus / 12;
    const goalsToday = (p.goals || []).reduce((a, g) => a + (g.cost || 0), 0);
    const facts = '<div class="wl-facts">' +
      fact('💰', 'Investment amount', C$(S0), w.amount != null && w.amount !== '' ? 'your figure' : 'savings today') +
      fact('⏳', 'Investment period', U.plural(R.H, 'year'), 'FY ' + ED.finplan.fyLabel(R.y0) + ' to ' + ED.finplan.fyLabel(R.y0 + R.H - 1)) +
      fact('🧭', 'Approach', e(WL.label(k)), pc(S.g * 100) + ' a year expected') +
      fact('↗️', 'Saved each month', C$(Math.max(0, monthly)), monthly < 0 ? '<span class="fin-bad">short ' + C$(-monthly) + '</span>' : 'this year, from income') +
      fact('🎯', 'Goals', String((p.goals || []).length), goalsToday ? C$(goalsToday) + ' in today’s money' : 'add goals on the other page') +
      fact('🛟', 'Emergency fund', C$(E0), (p.emergencyMonths || 0) + ' months of costs') + '</div>';

    const cmp = w.compare || '';
    const cards = APPROACHES.map(ap => {
      const T = WL.statsOf(ap.k);
      const on = ap.k === k, vs = ap.k === cmp && !on;
      return '<article class="wl-ap' + (on ? ' on' : '') + (vs ? ' vs' : '') + '"><div class="wl-aph"><b>' + e(ap.label) + '</b>' + (on ? '<span class="chip">chosen</span>' : vs ? '<span class="chip">comparing</span>' : '') + '</div>' +
        '<span class="hint">' + e(ap.note) + '</span>' + bar(T.ws) +
        '<dl class="wl-apn"><div><dt>Expected growth</dt><dd>' + (T.sum ? pc(T.g * 100) : '—') + '</dd></div><div><dt>Yearly swings</dt><dd>' + (T.sum ? '±' + pc(T.sd * 100) : '—') + '</dd></div><div title="1 year in 20 could be worse than this"><dt>Bad year</dt><dd>' + (T.sum ? pc(WL.badYear(T) * 100) : '—') + '</dd></div></dl>' +
        '<div class="row-btns"><button type="button" class="btn small' + (on ? ' primary' : '') + '" data-act="wl-use" data-k="' + ap.k + '" aria-pressed="' + on + '">' + (on ? 'Using this' : 'Use this') + '</button>' +
        (on ? '' : '<button type="button" class="btn small ghost" data-act="wl-cmp" data-k="' + ap.k + '" aria-pressed="' + vs + '">' + (vs ? 'Stop comparing' : 'Compare') + '</button>') + '</div></article>';
    }).join('');

    const as = WL.assets(), wk = WL.weights(k), long = Math.max(0, S0 - E0 - WL.nearNeed(R));
    const custom = k === 'custom';
    const rowsT = as.map((a, i) => {
      const wt = S.ws[i];
      if (!custom && !(wt > 0)) return '';
      return '<tr><th><span class="wl-dot" style="background:' + a.color + '"></span>' + e(a.label) + '<span class="hint wl-ix">' + e(a.index) + '</span></th>' +
        '<td class="num">' + (custom ? '<input class="field num wl-w" type="number" min="0" max="100" step="1" value="' + (+wk[a.k] || 0) + '" data-change="wl-w" data-k="' + a.k + '" aria-label="' + e(a.label) + ' %">' : pc(wt * 100, 0)) + '</td>' +
        '<td class="num">' + C$(long * wt) + '</td><td class="num">' + pc(a.ret) + '</td><td class="num">' + pc(a.vol) + '</td><td class="wl-why">' + e(a.why) + '</td></tr>';
    }).join('');
    const sumWarn = custom && S.fallback ? '<p class="hint fin-bad">Your weights are all 0%, so the balanced mix is used until you enter them.</p>' : custom && Math.abs(S.sum - 100) > 0.5 ? '<p class="hint fin-bad">Your weights add up to ' + pc(S.sum, 0) + '; they are scaled to 100% in the sums.</p>' : '';
    const table = '<div class="fp-tablew"><table class="st-table wl-table"><thead><tr><th>Asset class</th><th class="num">Weight</th><th class="num">Amount</th><th class="num">Expected growth</th><th class="num">Yearly swings</th><th>Why it is in the mix</th></tr></thead><tbody>' + rowsT +
      '<tr class="wl-tot"><th>Total</th><td class="num">100%</td><td class="num">' + C$(long) + '</td><td class="num">' + pc(S.g * 100) + '</td><td class="num">' + pc(S.sd * 100) + '</td><td class="wl-why hint">after mixing: assets do not all move together</td></tr></tbody></table></div>' + sumWarn +
      (custom ? '' : '<button type="button" class="btn small" data-act="wl-copy">' + ED.icon('pencil') + 'Change the weights (make it my own mix)</button>');

    const bk = WL.buckets(R);
    const buckets = '<div class="wl-buckets">' + bk.map(b => '<div class="wl-bk"><span class="wl-bki" aria-hidden="true">' + b.icon + '</span><b>' + C$(b.amount) + '</b><span>' + b.text + '</span>' + (b.sub ? '<span class="hint">' + b.sub + '</span>' : '') + '</div>').join('') + '</div>' +
      '<p class="hint">The rest, <b>' + M$(long) + '</b>, is the long-term money, invested in the “' + e(WL.label(k)) + '” allocation above. As each goal comes within about two to three years, its money moves to the safer funds so a market fall just before you need it cannot hurt it.</p>';

    const am = amap();
    const assump = '<details class="wl-assume"' + (st().assume ? ' open' : '') + '><summary data-act="wl-assume-t">Return and risk assumptions</summary>' +
      '<div class="row-btns"><span class="hint">Start from:</span>' + Object.keys(PRESETS).map(pk => '<button type="button" class="btn small" data-act="wl-preset" data-k="' + pk + '">' + e(PRESETS[pk].label) + '</button>').join('') + '</div>' +
      '<div class="fp-tablew"><table class="st-table wl-table"><thead><tr><th>Asset class</th><th class="num">Expected growth % a year</th><th class="num">Yearly swings %</th></tr></thead><tbody>' +
      ASSETS.map(a => '<tr><th><span class="wl-dot" style="background:' + a.color + '"></span>' + e(a.label) + '</th><td class="num"><input class="field num wl-w" type="number" step="0.1" min="0" max="30" value="' + am[a.k].ret + '" data-change="wl-as" data-k="' + a.k + '" data-f="ret" aria-label="' + e(a.label) + ' growth"></td><td class="num"><input class="field num wl-w" type="number" step="0.5" min="0" max="60" value="' + am[a.k].vol + '" data-change="wl-as" data-k="' + a.k + '" data-f="vol" aria-label="' + e(a.label) + ' swings"></td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="fp-formw">' +
      '<label class="fp-f"><span class="fp-l">Amount invested today</span><span class="fp-in"><span class="fp-u">' + e(ED.finance.symbol()) + '</span><input class="field num" inputmode="decimal" data-change="wl-num" data-k="amount" value="' + (w.amount != null && w.amount !== '' ? w.amount : '') + '" placeholder="' + e(String(Math.round(p.savings || 0))) + '"></span><span class="fp-h hint">empty = your savings on the other page</span></label>' +
      '<label class="fp-f"><span class="fp-l">Today’s value: discount at</span><span class="fp-in"><input class="field num" type="number" step="0.5" min="0" max="20" data-change="wl-num" data-k="discount" value="' + (w.discount != null ? w.discount : 9) + '"><span class="fp-u">% a year</span></span><span class="fp-h hint">reports often use 9%; your inflation (' + (p.inflation || 0) + '%) shows buying power</span></label>' +
      '<label class="fp-f"><span class="fp-l">SIP for the illustration</span><span class="fp-in"><span class="fp-u">' + e(ED.finance.symbol()) + '</span><input class="field num" inputmode="decimal" data-change="wl-num" data-k="sip" value="' + (w.sip != null && w.sip !== '' ? w.sip : '') + '" placeholder="' + WL.sipAmount(R) + '"><span class="fp-u">a month</span></span><span class="fp-h hint">empty = what you save a month now</span></label>' +
      '<label class="fp-f"><span class="fp-l">Step-up</span><span class="fp-in"><input class="field num" type="number" step="1" min="0" max="30" data-change="wl-num" data-k="sipStep" value="' + (w.sipStep != null ? w.sipStep : 10) + '"><span class="fp-u">% more each year</span></span></label>' +
      '</div>' +
      '<p class="hint">“Past 20 years” uses index growth from 2005 to 2025 (median of 5-year periods) as printed in typical wealth reports; the swings are the spread of calendar-year returns, which include falls like 2008 and 2020. Past growth may not repeat — try “Cautious” to see a weaker future.</p></details>';

    const use = '<label class="switch fp-sw wl-use"><input type="checkbox" data-change="wl-planret"' + (p.retFrom === 'portfolio' ? ' checked' : '') + '><span class="track"></span><span>Use this approach’s growth (' + pc(S.g * 100) + ') for the savings in the goal plan, instead of ' + pc(p.ret || 0) + '</span></label>';

    return facts +
      '<h3 class="gh">Investment approach</h3><p class="hint">Pick the mix for your long-term money. Compare two to see the trade-off between growth and swings.</p><div class="wl-aps">' + cards + '</div>' + use +
      '<h3 class="gh fin-gap">Underlying allocation — ' + e(WL.label(k)) + '</h3>' + table +
      '<h3 class="gh fin-gap">Short-term cash flow &amp; emergency corpus</h3>' + buckets +
      assump;
  };

  /* money the plan draws from savings in each of the next three years (goals the year's income cannot cover) */
  WL.nearNeed = R => [0, 1, 2].reduce((a, i) => a + (R.rows[i] ? Math.max(0, -R.rows[i].surplus) : 0), 0);
  WL.buckets = R => {
    const { E0 } = WL.start();
    const yr = i => R.rows[i] || { surplus: 0, goals: 0, evOut: 0, goalNames: [] };
    const fund = ['an arbitrage fund', 'a short-term debt fund', 'a conservative hybrid or income-plus-arbitrage fund'];
    const lab = ['0–12', '12–24', '24–36'];
    const out = [{ icon: '🛟', amount: E0, text: 'kept in liquid funds or a sweep-in FD as your emergency corpus', sub: '' }];
    [0, 1, 2].forEach(i => {
      const x = yr(i), need = Math.max(0, -x.surplus), paid = x.goals + x.evOut;
      out.push({ icon: ['⏱️', '📆', '🗓️'][i], amount: need, text: 'set aside for months ' + lab[i] + ', kept in ' + fund[i],
        sub: paid ? 'Payments due then: ' + C$(paid) + (x.goalNames.length ? ' (' + e(x.goalNames.filter(n => !/^EMI/.test(n)).map(n => n.replace(/^\S+\s/, '')).join(', ') || 'EMIs') + ')' : '') + (need < paid ? '; ' + (need ? 'the rest' : 'all of it') + ' comes from that year’s income' : '') : 'nothing planned' });
    });
    return out;
  };

  /* ---------------- right page: the wealth report ---------------- */
  WL.right = R => {
    const p = P(), w = W();
    const k = w.approach || 'balanced', cmp = w.compare && w.compare !== k ? w.compare : '';
    const S = WL.statsOf(k), S2 = cmp ? WL.statsOf(cmp) : null;
    const { S0 } = WL.start();
    const rows = R.rows, H = rows.length;
    const labels = rows.map(x => "'" + String(x.fy + 1).slice(2));
    const long = rows.map(x => 'End of FY ' + ED.finplan.fyLabel(x.fy) + (x.age ? ' · age ' + (x.age + 1) : ''));
    const ri = p.age && p.retireAge > p.age ? p.retireAge - p.age - 1 : -1;
    const disc = w.discount != null ? w.discount : 9;
    const emptyNote = !S0 && !(R.first.surplus > 0) ? '<div class="fp-start"><p>Put in what you have invested today (under “Your numbers” on the Goals page, or “Amount invested today” below the approaches) and your income and costs, and this report fills in.</p></div>' : '';

    // 1. the chance the plan works, from the simulation
    const MC = WL.simulate(R, S);
    const end = H - 1;
    const sum = '<div class="fp-sum wl-sum">' +
      '<div class="wl-big ' + (MC.success >= 0.8 ? 'ok' : MC.success >= 0.6 ? 'mid' : 'bad') + '"><span class="hint">Chance the money lasts</span><b>' + pc(MC.success * 100, 0) + '</b><span class="hint">' + word(MC.success) + ' · every goal paid in ' + pc(MC.success * 100, 0) + ' of ' + MC.n.toLocaleString('en-IN') + ' simulated markets</span></div>' +
      '<div><span class="hint">Likely by FY ' + ED.finplan.fyLabel(rows[end].fy) + '</span><b>' + C$(MC.p50[end]) + '</b><span class="hint">' + C$(pv(MC.p50[end], H)) + ' today · middle outcome</span></div>' +
      '<div><span class="hint">Bad case (1 in 10)</span><b class="' + (MC.p10[end] < 0 ? 'fin-bad' : '') + '">' + C$(MC.p10[end]) + '</b><span class="hint">' + C$(pv(MC.p10[end], H)) + ' today</span></div>' +
      '<div><span class="hint">Good case (1 in 10)</span><b>' + C$(MC.p90[end]) + '</b><span class="hint">' + C$(pv(MC.p90[end], H)) + ' today</span></div></div>';

    // 2. compounding at the expected growth and ±2%
    const mode = st().wx || 'flows';
    const run = d => WL.path(R, () => S.g + d).rows.map(x => x.close);
    const lump = d => rows.map((x, i) => S0 * Math.pow(1 + S.g + d, i + 1));
    const f = mode === 'lump' ? lump : run;
    const base = f(0), up = f(0.02), dn = f(-0.02);
    const other = S2 ? (mode === 'lump' ? rows.map((x, i) => S0 * Math.pow(1 + S2.g, i + 1)) : WL.path(R, () => S2.g).rows.map(x => x.close)) : null;
    const chip = (lb, v, c) => '<div class="wl-cv"><i style="background:' + c + '"></i><span class="hint">' + e(lb) + '</span><b>' + C$(v) + '</b><span class="hint">' + C$(pv(v, H)) + ' today</span></div>';
    const series = [{ name: WL.label(k) + ' ' + pc(S.g * 100), color: 'var(--s1)', points: base.map(Math.round), area: true },
      { name: '+2% (' + pc((S.g + 0.02) * 100) + ')', color: 'var(--s3)', points: up.map(Math.round), dash: true },
      { name: '−2% (' + pc((S.g - 0.02) * 100) + ')', color: 'var(--s2)', points: dn.map(Math.round), dash: true }];
    if (other) series.push({ name: WL.label(cmp) + ' ' + pc(S2.g * 100), color: 'var(--s4)', points: other.map(Math.round) });
    const seg = '<div class="seg" role="group" aria-label="Compounding">' + [['flows', 'With your savings and goals'], ['lump', 'Lump sum only']].map(x => '<button type="button" data-act="wl-wx" data-k="' + x[0] + '" aria-pressed="' + (mode === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>';
    const comp = '<div class="wl-cvs">' + chip('Expected ' + pc(S.g * 100), base[end], 'var(--s1)') + chip('+2%', up[end], 'var(--s3)') + chip('−2%', dn[end], 'var(--s2)') + (other ? chip(WL.label(cmp), other[end], 'var(--s4)') : '') + '</div>' +
      CH.lines({
        title: 'Power of compounding over ' + U.plural(H, 'year'), labels, long, maxLabels: 8, h: 230, left: 56, tools: seg,
        series, marker: ri >= 0 && ri < H ? ri : null, markerLabel: 'Retire', fmt: v => C$(v), tipFmt: v => M$(v),
        legend: CH.legend(series.map(s => ({ kind: s.dash ? 'dash' : 'line', color: s.color, label: s.name.replace(/ [\d.]+%$/, '') }))),
        sub: mode === 'lump' ? 'What ' + M$(S0) + ' grows to if left alone, before tax, at the approach’s expected growth and 2% above and below it.' : 'Your whole portfolio with what you save each year added and every goal paid out, after tax on growth (' + (p.retTax || 0) + '%). The emergency fund and money parked for goals due soon earn the liquid and debt rates.',
        table: CH.table(['Year end', 'Expected', '+2%', '−2%'].concat(other ? [WL.label(cmp)] : []), rows.map((x, i) => [ED.finplan.fyLabel(x.fy), M$(base[i]), M$(up[i]), M$(dn[i])].concat(other ? [M$(other[i])] : []))),
      }) + '<p class="hint wl-note">“Today” = the future amount discounted at ' + disc + '% a year, to show what it is worth in present-day terms.</p>';

    // 3. range of outcomes
    const steady = mode === 'flows' ? base : run(0);
    const fan = CH.lines({
      title: 'Range of outcomes', labels, long, maxLabels: 8, h: 230, left: 56,
      series: [{ name: 'Middle outcome', color: 'var(--s1)', points: MC.p50.map(Math.round) }, { name: 'Steady growth', color: 'var(--s3)', points: steady.map(Math.round), dash: true }],
      range: { lo: MC.p10.map(Math.round), hi: MC.p90.map(Math.round), color: 'var(--s1)', name: '1-in-10 bad to good' },
      marker: ri >= 0 && ri < H ? ri : null, markerLabel: 'Retire', fmt: v => C$(v), tipFmt: v => M$(v),
      legend: CH.legend([{ kind: 'line', color: 'var(--s1)', label: 'Middle' }, { kind: 'range', color: 'var(--s1)', label: '8 in 10 outcomes' }, { kind: 'dash', color: 'var(--s3)', label: 'Steady growth' }]),
      sub: 'Each simulated year the long-term money grows by a random amount that fits the approach (' + pc(S.g * 100) + ' expected, swings of ±' + pc(S.sd * 100) + '), with your savings and goals as planned. The shaded area holds 8 in 10 of the outcomes; the dashed line is steady growth every year.',
      table: CH.table(['Year end', '1 in 10 bad', 'Middle', '1 in 10 good'], rows.map((x, i) => [ED.finplan.fyLabel(x.fy), M$(MC.p10[i]), M$(MC.p50[i]), M$(MC.p90[i])])),
    });

    // 4. growth with cash flows
    const pr = WL.path(R, () => S.g).rows;
    const tb = '<div class="fp-tablew"><table class="st-table fp-table"><thead><tr><th>Year</th><th class="num">Starting value</th><th class="num">Growth</th><th class="num">Saved in</th><th class="num">Paid out</th><th class="num">Parked for goals</th><th class="num">Ending value</th><th class="num">Today’s value</th></tr></thead><tbody>' +
      pr.map((x, i) => '<tr class="' + (x.close < 0 ? 'neg' : '') + (x.draw ? ' has-goal' : '') + '"><th>' + ED.finplan.fyLabel(x.fy) + '</th><td class="num">' + C$(x.open) + '</td><td class="num">' + C$(x.growth - x.tax) + '</td><td class="num">' + (x.inflow ? C$(x.inflow) : '—') + '</td><td class="num"' + (x.names.length ? ' title="' + e(x.names.join(' · ')) + '"' : '') + '>' + (x.draw ? '<span class="fin-bad">−' + C$(x.draw) + '</span>' : '—') + '</td><td class="num">' + (x.parked ? C$(x.parked) : '—') + '</td><td class="num"><b class="' + (x.close < 0 ? 'fin-bad' : '') + '">' + C$(x.close) + '</b></td><td class="num">' + C$(pv(x.close, i + 1)) + '</td></tr>').join('') +
      '</tbody></table></div>';
    const flows = '<figure class="chart"><figcaption><span class="gh">Portfolio growth with cash flows</span></figcaption><p class="chart-sub hint">At the expected ' + pc(S.g * 100) + ' a year. “Saved in” is what is left from income after tax, costs and goals; “Paid out” is what goals take from savings when that year’s income is not enough. About two years before a payment its money is “parked” in debt (' + pc(amap().debt.ret) + '). Growth is after tax.</p>' + tb + '</figure>';

    // 5. SIP effect
    const sip = WL.sipAmount(R), step = (w.sipStep != null ? +w.sipStep : 10) / 100;
    const ys = [5, 10, 15, 20, 25, 30, 40, 50].filter(y => y < H); if (!ys.includes(H)) ys.push(H);
    const sipData = ys.map(y => { const a = WL.sipValue(S0, S.g, y, 0, 0), b = WL.sipValue(S0, S.g, y, sip, 0), c = WL.sipValue(S0, S.g, y, sip, step); return { label: y + ' yrs', long: 'After ' + U.plural(y, 'year'), values: [a, b, c], tip: 'No SIP ' + C$(a) + ' · SIP ' + C$(b) + ' · with step-up ' + C$(c) }; });
    const lastS = sipData[sipData.length - 1].values;
    const sipC = CH.groups({
      title: 'What a monthly SIP adds', h: 220, left: 56, fmt: v => C$(v), maxLabels: 8,
      series: [{ name: 'No SIP', color: 'var(--s3)' }, { name: 'SIP', color: 'var(--s1)' }, { name: 'Step-up', color: 'var(--s2)' }],
      data: sipData,
      legend: CH.legend([{ kind: 'g', color: 'var(--s3)', label: 'No SIP' }, { kind: 'g', color: 'var(--s1)', label: 'SIP ' + C$(sip) + '/month' }, { kind: 'g', color: 'var(--s2)', label: '+' + Math.round(step * 100) + '% a year' }]),
      sub: M$(S0) + ' invested today at ' + pc(S.g * 100) + ' a year, before tax, with no withdrawals: alone, with ' + M$(sip) + ' a month, and with that SIP raised ' + Math.round(step * 100) + '% every year. After ' + U.plural(ys[ys.length - 1], 'year') + ': <b>' + C$(lastS[0]) + '</b>, <b>' + C$(lastS[1]) + '</b> and <b>' + C$(lastS[2]) + '</b>. Change the SIP under “Return and risk assumptions” on the left.',
      table: CH.table(['After', 'No SIP', 'SIP', 'SIP with step-up', 'Put in (step-up)'], ys.map((y, i) => { let put = S0; for (let m = 0; m < y * 12; m++) put += sip * Math.pow(1 + step, Math.floor(m / 12)); return [U.plural(y, 'year'), M$(sipData[i].values[0]), M$(sipData[i].values[1]), M$(sipData[i].values[2]), M$(put)]; })),
    });

    // 6. risk
    const list = APPROACHES.filter(ap => ap.k !== 'custom' || ap.k === k || ap.k === cmp || W().custom);
    const hz = [1, 3, 5, 7];
    const avg = (T, t) => hz.reduce((a, n) => a + WL.chance(T, t, n), 0) / hz.length;
    const riskRows = list.map(ap => { const T = WL.statsOf(ap.k); if (!T.sum) return ''; const b7 = avg(T, 0.07), cp = avg(T, 0);
      return '<tr class="' + (ap.k === k ? 'on' : '') + '"><th>' + e(ap.label) + (ap.k === k ? ' <span class="chip">chosen</span>' : '') + '</th><td class="num">' + pc(T.g * 100) + '</td><td class="num">±' + pc(T.sd * 100) + '</td><td class="num">±' + pc(T.sd * 100 / Math.sqrt(3)) + '</td><td class="num">' + pc(WL.badYear(T) * 100) + '</td><td class="num"><b>' + pc(b7 * 100) + '</b><span class="wl-w8 ' + word(b7).toLowerCase() + '">' + word(b7) + '</span></td><td class="num"><b>' + pc(cp * 100) + '</b><span class="wl-w8 ' + word(cp).toLowerCase() + '">' + word(cp) + '</span></td></tr>'; }).join('');
    const detail = '<details class="chart-table"><summary>By how long you stay invested</summary><div class="ct-scroll"><table><thead><tr><th>Approach</th>' + hz.map(n => '<th>≥7% · ' + n + 'y</th>').join('') + hz.map(n => '<th>No loss · ' + n + 'y</th>').join('') + '</tr></thead><tbody>' +
      list.map(ap => { const T = WL.statsOf(ap.k); if (!T.sum) return ''; return '<tr><td>' + e(ap.label) + '</td>' + hz.map(n => '<td class="num">' + pc(WL.chance(T, 0.07, n) * 100, 0) + '</td>').join('') + hz.map(n => '<td class="num">' + pc(WL.chance(T, 0, n) * 100, 0) + '</td>').join('') + '</tr>'; }).join('') + '</tbody></table></div></details>';
    const risk = '<figure class="chart"><figcaption><span class="gh">Understanding the risks</span></figcaption><p class="chart-sub hint">How often each approach could grow at least 7% a year, and how often it keeps your capital (no loss), averaged over holding periods of 1, 3, 5 and 7 years. Longer holding makes both far more likely.</p>' +
      '<div class="fp-tablew"><table class="st-table wl-table wl-risk"><thead><tr><th>Approach</th><th class="num">Expected growth</th><th class="num">Swings, 1 year</th><th class="num">Swings, 3 years</th><th class="num">Bad year (1 in 20)</th><th class="num">Chance of ≥7% a year</th><th class="num">Chance of no loss</th></tr></thead><tbody>' + riskRows + '</tbody></table></div>' + detail +
      '<details class="wl-defs"><summary>What these risks mean</summary><dl>' +
      [['Short-term volatility', 'How much the value can swing in a single year. Higher means bigger ups and downs; money needed within 3 years should not be exposed to it.'],
        ['Long-term volatility', 'The swing of the yearly growth rate over 3-year periods. It shrinks the longer you stay invested, which is why goals 7+ years away can hold more shares.'],
        ['Credit risk', 'A bond issuer may not repay. Lower-rated bonds pay more because of this. Prefer high-quality debt funds for money you must not lose.'],
        ['Liquidity risk', 'How quickly you can get your money out. Lock-ins (PPF, ELSS, FDs with penalties, some AIFs) mean less flexibility for emergencies.'],
        ['Reinvestment risk', 'When a deposit or bond matures, rates may be lower, so the same money earns less. Longer lock-ins reduce it.'],
        ['Macro uncertainty', 'Inflation, interest rates, the rupee and the economy change every asset at once; mixing asset classes softens this.'],
        ['Concentration risk', 'Too much in one share, sector or fund. Index funds and a mix of asset classes spread it.'],
        ['The last risk: not staying invested', 'Selling after a fall turns a temporary drop into a permanent loss. The chances above assume you keep going through bad years.']].map(x => '<dt>' + e(x[0]) + '</dt><dd>' + e(x[1]) + '</dd>').join('') + '</dl></details></figure>';

    const method = '<details class="wl-defs"><summary>How this is worked out</summary><div class="wl-method">' +
      '<p><b>Expected growth and swings.</b> Each asset class has an expected yearly growth and a yearly spread (volatility). The approach’s growth and spread come from its weights and how the assets move together (correlations), rebalanced once a year.</p>' +
      '<p><b>Chances.</b> Yearly returns are modelled as lognormal: over n years, the chance of at least t a year is 1 − Φ((ln(1+t) − μ)·√n / s). This is exact under the model; real markets have fatter tails, so treat the numbers as a guide.</p>' +
      '<p><b>Monte Carlo.</b> ' + MC.n.toLocaleString('en-IN') + ' possible futures, each drawing a random return for every year for the long-term money, run through your plan’s savings and goals. The chance the money lasts is the share of futures where savings never go below zero.</p>' +
      '<p><b>Today’s value</b> = future value ÷ (1 + ' + disc + '%)<sup>years</sup>. For example ₹5 Cr in 20 years is about ' + M$(5e7 / Math.pow(1 + disc / 100, 20)) + ' today.</p>' +
      '<p>No past-performance backtest is shown: the diary has no index history, and the past need not repeat. These are illustrations from your assumptions, not advice.</p></div></details>';

    return emptyNote + sum + comp + fan + flows + sipC + risk + method +
      '<p class="hint fp-note">All figures are estimates from the assumptions you can see and change on the left. Markets are volatile and returns are not guaranteed. This is not investment advice — check big decisions with a SEBI-registered adviser.</p>';
  };

  /* ---------------- actions ---------------- */
  const WW = () => { const p = P(); if (!p.wealth) p.wealth = ED.sample.wealth(); return p.wealth; };
  A['wl-use'] = el => { ED.store.checkpoint('Approach'); const w = WW(); w.approach = el.dataset.k; if (w.compare === w.approach) w.compare = ''; if (w.approach === 'custom' && !w.custom) w.custom = Object.assign({}, APPROACHES[1].w); ED.store.commit(); };
  A['wl-cmp'] = el => { const w = WW(); w.compare = w.compare === el.dataset.k ? '' : el.dataset.k; if (el.dataset.k === 'custom' && !w.custom) w.custom = Object.assign({}, APPROACHES[1].w); ED.store.commit(); };
  A['wl-copy'] = () => { ED.store.checkpoint('My own mix'); const w = WW(); w.custom = Object.assign({}, WL.weights(w.approach)); w.approach = 'custom'; if (w.compare === 'custom') w.compare = ''; ED.store.commit(); ED.ui.toast('Copied into “My own mix” — change the weights in the table'); };
  A['wl-preset'] = el => {
    ED.store.checkpoint('Assumptions');
    const pr = PRESETS[el.dataset.k]; const w = WW(); w.assets = {};
    ASSETS.forEach(a => { w.assets[a.k] = { ret: pr[a.k][0], vol: pr[a.k][1] }; });
    st().assume = true; ED.store.commit(); ED.ui.toast('Assumptions set to “' + pr.label + '”');
  };
  A['wl-wx'] = el => { st().wx = el.dataset.k; ED.app.renderPage('right'); CH.bind(document.getElementById('pg-right')); };
  A['wl-assume-t'] = el => { st().assume = !el.parentElement.open; };
  CHG['wl-w'] = el => { const w = WW(); w.custom = Object.assign({}, WL.weights('custom')); w.custom[el.dataset.k] = Math.max(0, Math.min(100, +el.value || 0)); ED.store.commit(); };
  CHG['wl-as'] = el => {
    const w = WW(); w.assets = w.assets || {};
    const a = w.assets[el.dataset.k] = Object.assign({}, w.assets[el.dataset.k]);
    if (el.value.trim() === '') delete a[el.dataset.f]; else a[el.dataset.f] = Math.max(0, +el.value || 0);   // empty = back to the default
    if (!Object.keys(a).length) delete w.assets[el.dataset.k];
    ED.store.commit();
  };
  CHG['wl-num'] = el => { const w = WW(); const k = el.dataset.k; if (el.value.trim() === '') w[k] = k === 'discount' ? 9 : k === 'sipStep' ? 10 : null; else w[k] = /amount|sip$/.test(k) ? ED.finance.amt(el.value) : +el.value || 0; ED.store.commit(); };
  CHG['wl-planret'] = el => { P().retFrom = el.checked ? 'portfolio' : 'own'; ED.store.commit(); ED.ui.toast(el.checked ? 'The goal plan now grows savings at ' + pc(WL.expected()) + ' a year' : 'The goal plan uses your own expected return again'); };
})();
