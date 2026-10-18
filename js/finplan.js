/* E-Diary — Financial Plan: a goal-based plan for the years ahead.
   You give today's numbers (income, living costs, savings, age) and your goals in today's money (a house, children's
   education, sightseeing, a computer…). The plan grows income with your yearly raise, costs with inflation (each goal
   can have its own rate), works out income tax each year (India new or old regime, or a flat rate) and tax on
   investment growth, pays each goal in its year (a loan turns it into a down payment and EMIs), and shows:
     • a year-by-year schedule: earnings, tax, in-hand money, living costs, goals and EMIs, what is saved, growth,
       savings at year end, and the same in today's money
     • what each goal will cost when it is due and how much to invest every month to have it ready
     • guidance on emergency fund, where to keep money for near and far goals, tax regime, and when money runs short.
   Data: ED.store.data.finance.plan (see ED.sample.finPlan). Everything is an estimate from fixed rates.
   Tax figures: Income-tax slabs for FY 2026-27 (unchanged from FY 2025-26 by Budget 2026):
     new regime 0–4 L nil, 4–8 L 5%, 8–12 L 10%, 12–16 L 15%, 16–20 L 20%, 20–24 L 25%, above 24 L 30%;
     standard deduction ₹75,000; rebate u/s 87A makes tax nil up to ₹12 L taxable (marginal relief above);
     old regime 0–2.5 L nil, 2.5–5 L 5%, 5–10 L 20%, above 10 L 30%, standard deduction ₹50,000, rebate up to ₹5 L;
     surcharge 10% above ₹50 L, 15% above ₹1 Cr, 25% above ₹2 Cr (old regime 37% above ₹5 Cr); cess 4%. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const CH = ED.charts;
  const D = () => ED.store.data;
  const P = () => D().finance.plan;
  const S = () => ED.store.data.settings;
  const A = (ED.actions = ED.actions || {});
  const st = () => ED.state.fp || (ED.state.fp = {});
  const opt = (v, label, sel) => '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';
  const M$ = v => ED.finance.money(Math.round(v || 0), { dec: false });
  const C$ = v => (v < 0 ? '−' : '') + (ED.finance.symbol() + CH.compact(Math.abs(v))).replace(/\s/g, '');
  const pc = v => (Math.round(v * 10) / 10) + '%';

  const GT = {
    house: { icon: '🏠', label: 'House', inf: 7, cost: 6000000, years: 6, loan: { pct: 80, rate: 8.5, years: 20 } },
    education: { icon: '🎓', label: 'Child’s education', inf: 10, cost: 2500000, years: 10 },
    marriage: { icon: '💍', label: 'Child’s wedding', inf: 7, cost: 2000000, years: 15 },
    travel: { icon: '✈️', label: 'Sightseeing / travel', inf: 6, cost: 150000, years: 1, every: 2 },
    computer: { icon: '💻', label: 'Computer / gadgets', inf: 4, cost: 120000, years: 2, every: 5 },
    car: { icon: '🚗', label: 'Car', inf: 5, cost: 1200000, years: 4 },
    health: { icon: '🏥', label: 'Medical / health', inf: 10, cost: 500000, years: 8 },
    emergency: { icon: '🛟', label: 'Emergency fund', inf: 6, cost: 0, years: 1 },
    other: { icon: '🎯', label: 'Something else', inf: 6, cost: 300000, years: 3 },
  };
  const FP = (ED.finplan = { GT });

  /* ---------------- tax ---------------- */
  const NEW = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
  const OLD = [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]];
  const slabTax = (x, slabs, k) => { let t = 0, lo = 0; for (const [hi, r] of slabs) { const h = hi * k; if (x > lo) t += (Math.min(x, h) - lo) * r; lo = h; } return t; };
  /* surcharge with marginal relief: above each threshold, the extra tax may not exceed the extra income */
  const SUR = old => [[5e6, 0.10], [1e7, 0.15], [2e7, 0.25], [5e7, old ? 0.37 : 0.25]];
  const withSurcharge = (base, x, k, old) => {
    const steps = SUR(old);
    let i = -1; steps.forEach((st, j) => { if (x > st[0] * k) i = j; });
    if (i < 0) return base(x);
    const h = steps[i][0] * k, r = steps[i][1], rPrev = i ? steps[i - 1][1] : 0;
    return Math.min(base(x) * (1 + r), base(h) * (1 + rPrev) + (x - h));
  };
  /* yearly income tax on gross income; k raises the slabs (1 = today's slabs) */
  FP.tax = (gross, o) => {
    o = o || {};
    const mode = o.mode || 'new', k = o.k || 1;
    if (!(gross > 0)) return 0;
    if (mode === 'flat') return gross * (o.flat || 0) / 100;
    if (mode === 'old') {
      const x = Math.max(0, gross - (o.salaried ? 50000 * k : 0) - (o.deductions || 0) * k);
      const base = y => y <= 500000 * k ? 0 : slabTax(y, OLD, k);
      return Math.round(withSurcharge(base, x, k, true) * 1.04);
    }
    const x = Math.max(0, gross - (o.salaried ? 75000 * k : 0));
    const base = y => y <= 1200000 * k ? 0 : Math.min(slabTax(y, NEW, k), y - 1200000 * k);   // rebate u/s 87A and its marginal relief
    return Math.round(withSurcharge(base, x, k, false) * 1.04);
  };

  /* ---------------- money maths ---------------- */
  const pmt = (rate, n, pv) => { if (!(n > 0)) return 0; if (!rate) return pv / n; return pv * rate / (1 - Math.pow(1 + rate, -n)); };
  /* monthly amount that grows to `gap` in `months` at monthly rate rm, raised by `step` once a year */
  const sipFor = (gap, rm, months, step) => {
    if (!(gap > 0)) return 0;
    if (!(months > 0)) return gap;
    let fv1 = 0;
    for (let m = 0; m < months; m++) { const y = Math.floor(m / 12); fv1 += Math.pow(1 + (step || 0), y) * Math.pow(1 + rm, months - m - 1); }
    return gap / fv1;
  };
  FP.sipFor = sipFor; FP.pmt = pmt;

  const Y0 = () => +ED.finance.fyStart(U.today()).slice(0, 4);      // this financial year starts in April of Y0
  /* months from today to the middle of financial year n (goals are paid during that year) */
  const monthsTo = n => Math.max(0, Math.round((new Date(Y0() + n, 9, 1) - new Date()) / (30.44 * 864e5)));
  FP.monthsTo = monthsTo;
  const fyLabel = y => y + '–' + String(y + 1).slice(2);
  FP.fyLabel = fyLabel;

  /* each time a goal is paid: year index and its price then */
  FP.occurrences = (g, H) => {
    const y0 = Y0(), out = [];
    const first = Math.max(0, (g.year || y0) - y0);
    const every = Math.max(0, g.every || 0);
    const times = every ? (g.times > 0 ? g.times : Infinity) : 1;
    for (let i = first, n = 0; i < H && n < times; i += every || H, n++) out.push({ i, price: (g.cost || 0) * Math.pow(1 + (g.inflation || 0) / 100, i) });
    return out;
  };

  /* ---------------- the projection ---------------- */
  /* the yearly return the plan grows savings at: your own figure, or the chosen portfolio's expected growth */
  FP.retPct = () => { const p = P(); return p.retFrom === 'portfolio' && ED.wealth ? Math.round(ED.wealth.expected() * 100) / 100 : (p.ret || 0); };
  FP.run = () => {
    const p = P();
    const y0 = Y0();
    const inf = (p.inflation || 0) / 100, g = (p.raise || 0) / 100, r = FP.retPct() / 100, rt = (p.retTax || 0) / 100;
    const H = Math.max(3, Math.min(50, p.years || 25));
    const rows = [];
    const goalOut = Array.from({ length: H }, () => ({ amt: 0, names: [] }));
    const loans = [];
    (p.goals || []).forEach(gl => {
      FP.occurrences(gl, H).forEach(o => {
        const lp = gl.loanYears > 0 ? Math.max(0, Math.min(100, gl.loanPct || 0)) / 100 : 0;
        const down = o.price * (1 - lp);
        goalOut[o.i].amt += down; goalOut[o.i].names.push((GT[gl.type] || GT.other).icon + ' ' + gl.name + (lp ? ' (down payment)' : ''));
        if (lp > 0 && gl.loanYears > 0) {
          const emi = pmt((gl.loanRate || 0) / 1200, gl.loanYears * 12, o.price * lp);
          loans.push({ goal: gl, i: o.i, emi, amount: o.price * lp });
          for (let j = o.i; j < Math.min(H, o.i + gl.loanYears); j++) { goalOut[j].amt += emi * 12; if (j !== o.i) goalOut[j].names.push('EMI · ' + gl.name); }
        }
      });
    });
    let C = p.savings || 0;
    for (let i = 0; i < H; i++) {
      const age = p.age ? p.age + i : null;
      const working = !p.age || age < (p.retireAge || 60);
      const salary = working ? (p.income || 0) * 12 * Math.pow(1 + g, i) : 0;
      const pension = !working ? (p.pension || 0) * 12 * Math.pow(1 + inf, i) : 0;
      const other = (p.otherIncome || 0) * 12 * Math.pow(1 + inf, i);
      let evInT = 0, evInF = 0, evOut = 0; const evNames = [];
      (p.events || []).forEach(ev => {
        const a = (ev.from || y0) - y0, n = Math.max(1, ev.years || 1);
        if (i < a || i >= a + n) return;
        const grow = ev.grow === 'none' ? 1 : Math.pow(1 + (ev.grow === 'custom' ? (ev.rate || 0) / 100 : inf), i);
        const v = (ev.amount || 0) * grow;
        if (ev.kind === 'in') { if (ev.taxable) evInT += v; else evInF += v; } else evOut += v;
        evNames.push((ev.kind === 'in' ? '+ ' : '− ') + ev.name);
      });
      const gross = salary + pension + other + evInT;
      const k = p.indexSlabs ? Math.pow(1 + inf, i) : 1;
      const tax = FP.tax(gross, { mode: p.taxMode, flat: p.flatRate, deductions: p.deductions, salaried: salary > 0 || pension > 0, k });
      const inHand = gross - tax + evInF;
      const living = (working ? (p.expenses || 0) : (p.expenses || 0) * (p.retireSpend || 100) / 100) * 12 * Math.pow(1 + inf, i);
      const goals = goalOut[i].amt;
      const surplus = inHand - living - goals - evOut;
      const open = C;
      const base = open + surplus / 2;
      const growth = base > 0 ? base * r : 0;
      const gtax = growth * rt;
      C = open + surplus + growth - gtax;
      rows.push({ i, fy: y0 + i, age, working, salary, pension, other: other + evInT + evInF, gross, tax, inHand, living, goals, goalNames: goalOut[i].names, evOut, evNames, surplus, open, growth, gtax, close: C, real: C / Math.pow(1 + inf, i + 1) });
    }
    // goal-by-goal: what it costs then and the monthly investment to have it ready
    const rAfter = r * (1 - rt);
    const rm = Math.pow(1 + rAfter, 1 / 12) - 1;
    const goals = (p.goals || []).map(gl => {
      const occ = FP.occurrences(gl, H);
      const next = occ[0] || null;
      const lp = gl.loanYears > 0 ? Math.max(0, Math.min(100, gl.loanPct || 0)) / 100 : 0;
      const n = next ? next.i : 0;
      const need = next ? next.price * (1 - lp) : 0;
      const savedFV = (gl.saved || 0) * Math.pow(1 + rAfter, n);
      const gap = Math.max(0, need - savedFV);
      const months = monthsTo(n);
      // due this financial year: paid from this year's money (already in "can save a month"), not a monthly investment
      const thisYear = !!next && (n === 0 || !months);
      const sip = next && !thisYear ? sipFor(gap, rm, months, (p.stepUp || 0) / 100) : 0;
      const loan = loans.find(l => l.goal === gl) || null;
      const row = next ? rows[next.i] : null;
      const funded = row ? row.close >= 0 : true;
      return { g: gl, next, occ, need, savedFV, gap, sip: gap > 0 ? sip : 0, now: thisYear ? gap : 0, months, loan, funded, short: row && row.close < 0 ? -row.close : 0, n };
    });
    const first = rows[0];
    return { rows, goals, loans, H, y0, first, rAfter, runsOut: rows.find(x => x.close < 0) || null };
  };

  /* ---------------- guidance ---------------- */
  function guidance(R) {
    const p = P(), f = R.first;
    const out = [];
    const mS = f.surplus / 12;
    const sipAll = R.goals.reduce((a, x) => a + x.sip, 0);
    out.push(['📊', 'This year', 'You earn about <b>' + M$(f.gross) + '</b>, pay <b>' + M$(f.tax) + '</b> in income tax (' + pc(f.gross ? f.tax / f.gross * 100 : 0) + ' of it) and keep <b>' + M$(f.inHand) + '</b> — about <b>' + M$(f.inHand / 12) + '</b> a month. Living costs take ' + M$(f.living / 12) + ' a month' + (f.goals ? ', goals and EMIs ' + M$(f.goals / 12) : '') + ', leaving <b>' + M$(mS) + '</b> a month to save (' + pc(f.inHand ? f.surplus / f.inHand * 100 : 0) + ' of what you keep).']);
    const em = (p.expenses || 0) * (p.emergencyMonths || 6);
    out.push(['🛟', 'Emergency fund first', 'Keep ' + (p.emergencyMonths || 6) + ' months of living costs — <b>' + M$(em) + '</b> — where you can reach it within a day: a savings account, sweep-in FD or liquid fund. Top it up before investing for other goals, and raise it as costs grow.']);
    const nowGoals = R.goals.filter(x => x.now > 0);
    if (nowGoals.length) out.push(['📅', 'Due this year', nowGoals.map(x => e(x.g.name) + ' needs <b>' + M$(x.now) + '</b>').join('; ') + '. This is already taken out of this year’s saving above, so set it aside now in a savings account or short FD rather than investing it.']);
    if (R.goals.length) {
      const ok = mS >= sipAll;
      out.push([ok ? '✅' : '⚠️', 'Goals need ' + M$(sipAll) + ' a month', ok
        ? 'Your monthly surplus of ' + M$(mS) + ' covers it, with <b>' + M$(mS - sipAll) + '</b> a month to spare for retirement or extra safety.'
        : 'That is <b>' + M$(sipAll - mS) + '</b> a month more than your surplus of ' + M$(mS) + '. Ways to close the gap: raise the monthly investment every year with your pay (set a yearly step-up below), move a goal a year or two later, lower its cost, or use a loan for a large purchase.']);
      const near = R.goals.filter(x => x.next && x.n < 3), mid = R.goals.filter(x => x.next && x.n >= 3 && x.n <= 7), far = R.goals.filter(x => x.next && x.n > 7);
      const list = l => l.map(x => e(x.g.name) + (x.sip ? ' (' + M$(x.sip) + '/month)' : '')).join(', ');
      out.push(['🧺', 'Where to keep the money', '<ul class="fp-ul">' +
        (near.length ? '<li><b>Needed within 3 years</b> — ' + list(near) + ': keep it safe and easy to reach (bank FD or RD, liquid or short-term debt funds). Shares can fall just when you need the money.</li>' : '') +
        (mid.length ? '<li><b>3 to 7 years</b> — ' + list(mid) + ': a balance of safety and growth (hybrid or balanced funds, PPF, some equity), moving it to safe options in the last 2–3 years.</li>' : '') +
        (far.length ? '<li><b>More than 7 years away</b> — ' + list(far) + ': mostly growth assets such as equity index funds through a SIP; PPF and NPS alongside.</li>' : '') + '</ul>']);
    }
    // tax regime comparison for this year
    if (p.taxMode !== 'flat' && f.gross) {
      const sal = f.salary > 0 || f.pension > 0;
      const tn = FP.tax(f.gross - 0, { mode: 'new', salaried: sal }), to = FP.tax(f.gross, { mode: 'old', salaried: sal, deductions: p.deductions });
      out.push(['🧾', 'Tax', 'This year the new regime comes to about <b>' + M$(tn) + '</b> and the old regime <b>' + M$(to) + '</b> with ' + M$(p.deductions || 0) + ' of deductions (80C, 80D, home-loan interest…). ' + (Math.abs(tn - to) < 1000 ? 'They are about the same.' : 'The <b>' + (tn < to ? 'new' : 'old') + ' regime</b> saves ' + M$(Math.abs(tn - to)) + '.') +
        ' As pay rises, tax grows faster than income' + (p.indexSlabs ? '' : ' (this plan keeps today’s slabs; the government may raise them)') + ': in FY ' + fyLabel(R.rows[Math.min(R.rows.length - 1, 9)].fy) + ' it is about ' + pc(R.rows[Math.min(R.rows.length - 1, 9)].gross ? R.rows[Math.min(R.rows.length - 1, 9)].tax / R.rows[Math.min(R.rows.length - 1, 9)].gross * 100 : 0) + ' of income.']);
    }
    if (R.runsOut) {
      const x = R.runsOut;
      out.push(['🔴', 'Money runs short in FY ' + fyLabel(x.fy), 'If nothing changes, savings go below zero in FY ' + fyLabel(x.fy) + (x.age ? ' (age ' + x.age + ')' : '') + (x.goalNames.length ? ', the year of ' + e(x.goalNames.join(', ')) : '') + ', short by <b>' + M$(-x.close) + '</b>. Save more now, push that goal later, or plan a loan for it.']);
    } else {
      const last = R.rows[R.rows.length - 1];
      out.push(['🟢', 'Savings stay positive', 'Every goal in the plan is paid and savings stay above zero through FY ' + fyLabel(last.fy) + ', ending near <b>' + M$(last.close) + '</b> — worth about <b>' + M$(last.real) + '</b> in today’s money.']);
    }
    if (p.age && p.retireAge && p.retireAge > p.age) {
      const ri = p.retireAge - p.age;
      const row = R.rows[Math.min(R.rows.length - 1, ri - 1)];
      if (row && ri <= R.rows.length) {
        const livingThen = (p.expenses || 0) * (p.retireSpend || 100) / 100 * 12 * Math.pow(1 + (p.inflation || 0) / 100, ri);
        const yrs = livingThen > 0 ? row.close / livingThen : 0;
        out.push(['🌴', 'Retirement at ' + p.retireAge, 'At retirement (FY ' + fyLabel(row.fy + 1) + ') savings would be about <b>' + M$(row.close) + '</b> (' + M$(row.real) + ' in today’s money). Living costs then are about ' + M$(livingThen) + ' a year, so the savings cover roughly <b>' + (yrs > 0 ? Math.floor(yrs) : 0) + ' years</b>' + (p.pension ? ' plus your pension' : '') + ' if returns only keep pace with inflation. A common aim is 25–30 years.']);
      }
    }
    out.push(['🛡️', 'Protect the plan', 'Term life cover of about 10–15 times your yearly income (roughly ' + M$(f.gross * 10) + '–' + M$(f.gross * 15) + ') and family health insurance keep one bad event from undoing the goals. Review this plan once a year, when your pay changes.']);
    return '<ol class="fp-guide">' + out.map(x => '<li><span class="fp-gi" aria-hidden="true">' + x[0] + '</span><div><b>' + e(x[1]) + '</b><div class="fp-gt">' + x[2] + '</div></div></li>').join('') + '</ol>' +
      '<p class="hint fp-note">These are estimates from your numbers and fixed yearly rates; real returns, inflation and tax rules change. This is not financial advice — check big decisions with a qualified adviser.</p>';
  }

  /* ---------------- editors ---------------- */
  FP.editGoal = (id, type) => {
    const p = P();
    const x = id ? p.goals.find(g => g.id === id) : null;
    const t = GT[(x && x.type) || type] || GT.other;
    const y0 = Y0();
    const d = x ? U.clone(x) : { id: U.uid('pg'), type: type || 'other', name: t.label, cost: t.type === 'emergency' ? 0 : t.cost, year: y0 + t.years, inflation: t.inf, saved: 0, every: t.every || 0, times: 0, loanPct: t.loan ? t.loan.pct : 0, loanRate: t.loan ? t.loan.rate : 8.5, loanYears: t.loan ? t.loan.years : 0, notes: '' };
    if (!x && type === 'emergency') { d.cost = (p.expenses || 0) * (p.emergencyMonths || 6); d.year = y0 + 1; }
    const body = '<form class="st-form fp-form"><div class="st-grid">' +
      '<label class="lbl" for="pg-type">Kind of goal</label><select id="pg-type" class="field">' + Object.keys(GT).map(k => opt(k, GT[k].icon + ' ' + GT[k].label, k === d.type)).join('') + '</select>' +
      '<label class="lbl" for="pg-name">Name</label><input id="pg-name" class="field" value="' + e(d.name) + '" placeholder="e.g. Flat in Dwarka, Riya’s engineering">' +
      '<label class="lbl" for="pg-cost">Cost in today’s money</label><input id="pg-cost" class="field num" inputmode="decimal" value="' + (d.cost || '') + '" placeholder="0">' +
      '<label class="lbl" for="pg-year">Needed in (year)</label><div class="te-dt"><input id="pg-year" class="field num" type="number" min="' + y0 + '" max="' + (y0 + 50) + '" value="' + d.year + '"><span class="hint" id="pg-yh"></span></div>' +
      '<label class="lbl" for="pg-inf">Price rise per year (%)</label><div class="te-dt"><input id="pg-inf" class="field num" type="number" min="0" max="25" step="0.5" value="' + d.inflation + '"><span class="hint">education often 10%, houses 6–8%, gadgets 3–5%</span></div>' +
      '<label class="lbl" for="pg-saved">Already set aside for it</label><input id="pg-saved" class="field num" inputmode="decimal" value="' + (d.saved || '') + '" placeholder="0">' +
      '<label class="lbl" for="pg-every">Repeats</label><div class="te-dt"><select id="pg-every" class="field">' + [[0, 'Once'], [1, 'Every year'], [2, 'Every 2 years'], [3, 'Every 3 years'], [4, 'Every 4 years'], [5, 'Every 5 years'], [6, 'Every 6 years'], [10, 'Every 10 years']].map(o => opt(o[0], o[1], +d.every === o[0])).join('') + '</select>' +
      '<input id="pg-times" class="field num" type="number" min="0" max="50" value="' + (d.times || '') + '" placeholder="times" title="How many times (empty = to the end of the plan)" aria-label="How many times"></div>' +
      '</div>' +
      '<details class="fp-loan"' + (d.loanPct ? ' open' : '') + '><summary>Pay part of it with a loan</summary><div class="st-grid">' +
      '<label class="lbl" for="pg-lpct">Loan (% of the price)</label><input id="pg-lpct" class="field num" type="number" min="0" max="95" step="5" value="' + (d.loanPct || 0) + '">' +
      '<label class="lbl" for="pg-lrate">Interest (% a year)</label><input id="pg-lrate" class="field num" type="number" min="0" max="30" step="0.05" value="' + (d.loanRate || 8.5) + '">' +
      '<label class="lbl" for="pg-lyears">Years</label><input id="pg-lyears" class="field num" type="number" min="1" max="30" value="' + (d.loanYears || 20) + '">' +
      '</div><p class="hint" id="pg-lh"></p></details>' +
      '<p class="fp-preview" id="pg-prev"></p>' +
      '<label class="lbl" for="pg-notes" style="margin-top:8px;display:block">Notes</label><textarea id="pg-notes" class="field" rows="2">' + e(d.notes || '') + '</textarea>' +
      '</form>';
    ED.ui.modal({
      title: x ? 'Goal' : 'New goal', cls: 'st-modal', body,
      footer: (x ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save goal</button>',
      onMount(el, api) {
        const $ = k => el.querySelector('#pg-' + k);
        const read = () => ({ type: $('type').value, name: $('name').value.trim(), cost: ED.finance.amt($('cost').value), year: +$('year').value || y0, inflation: +$('inf').value || 0, saved: ED.finance.amt($('saved').value),
          every: +$('every').value || 0, times: +$('times').value || 0, loanPct: +$('lpct').value || 0, loanRate: +$('lrate').value || 0, loanYears: +$('lyears').value || 0, notes: $('notes').value.trim() });
        const prev = () => {
          const v = read(); const n = Math.max(0, v.year - y0);
          $('yh').textContent = n ? 'in ' + U.plural(n, 'year') + ' (FY ' + fyLabel(v.year) + ')' : 'this year';
          const price = v.cost * Math.pow(1 + v.inflation / 100, n);
          const lp = v.loanPct / 100;
          const emi = lp && v.loanYears ? pmt(v.loanRate / 1200, v.loanYears * 12, price * lp) : 0;
          $('lh').textContent = lp ? 'Loan of ' + M$(price * lp) + ' → EMI about ' + M$(emi) + ' a month for ' + U.plural(v.loanYears, 'year') + '; you pay ' + M$(price * (1 - lp)) + ' up front.' : '';
          const rAfter = FP.retPct() / 100 * (1 - (P().retTax || 0) / 100);
          const rm = Math.pow(1 + rAfter, 1 / 12) - 1;
          const need = Math.max(0, price * (1 - lp) - v.saved * Math.pow(1 + rAfter, n));
          const mo = n === 0 ? 0 : monthsTo(n);
          const sip = mo ? sipFor(need, rm, mo, (P().stepUp || 0) / 100) : need;
          $('prev').innerHTML = v.cost ? '<b>' + M$(v.cost) + '</b> today will cost about <b>' + M$(price) + '</b> in ' + v.year + '. ' + (need > 0 ? (mo ? 'Invest about <b>' + M$(sip) + '</b> a month from now' : 'Needed this year: <b>' + M$(need) + '</b>') + (P().stepUp ? ' (raised ' + P().stepUp + '% each year)' : '') + ' at ' + pc(rAfter * 100) + ' a year after tax.' : 'What you have set aside already covers it.') : '';
        };
        el.addEventListener('input', prev); el.addEventListener('change', prev); prev();
        $('type').addEventListener('change', () => {
          const t2 = GT[$('type').value]; if (!t2) return;
          if (!$('name').value.trim() || Object.keys(GT).some(k => GT[k].label === $('name').value.trim())) $('name').value = t2.label;
          $('inf').value = t2.inf; $('every').value = String(t2.every || 0);
          if (t2.loan && !+$('lpct').value) { $('lpct').value = t2.loan.pct; $('lrate').value = t2.loan.rate; $('lyears').value = t2.loan.years; el.querySelector('.fp-loan').open = true; }
          if (!ED.finance.amt($('cost').value)) $('cost').value = $('type').value === 'emergency' ? (P().expenses || 0) * (P().emergencyMonths || 6) : t2.cost;
          prev();
        });
        el.querySelector('[data-x="save"]').addEventListener('click', () => {
          const v = read();
          if (!v.name) { ED.ui.toast('Give the goal a name'); $('name').focus(); return; }
          if (!(v.cost > 0)) { ED.ui.toast('Enter what it costs today'); $('cost').focus(); return; }
          if (v.loanPct > 0 && !(v.loanYears > 0)) { ED.ui.toast('Give the loan a number of years'); $('lyears').focus(); return; }
          if (!v.loanPct) { v.loanYears = 0; }
          ED.store.checkpoint('Goal');
          if (x) { Object.assign(x, v); delete x.sample; } else p.goals.push(Object.assign(d, v));
          ED.store.commit(); api.close(); ED.ui.toast('Goal saved');
        });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', async () => {
          const ok = await ED.ui.confirm({ title: 'Delete goal', message: 'Delete “' + x.name + '” from the plan?', ok: 'Delete', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Delete goal'); p.goals = p.goals.filter(g => g.id !== x.id); ED.store.commit(); api.close(); ED.ui.undoToast('Goal deleted');
        });
      },
    });
  };

  FP.editEvent = id => {
    const p = P();
    const x = id ? p.events.find(v => v.id === id) : null;
    const y0 = Y0();
    const d = x ? U.clone(x) : { id: U.uid('pe'), name: '', kind: 'out', amount: 0, from: y0, years: 1, grow: 'inflation', rate: 0, taxable: false };
    const body = '<form class="st-form"><div class="seg fin-type" role="group" aria-label="Type"><button type="button" data-k="out" aria-pressed="' + (d.kind !== 'in') + '">Money out</button><button type="button" data-k="in" aria-pressed="' + (d.kind === 'in') + '">Money in</button></div><div class="st-grid">' +
      '<label class="lbl" for="pe-name">What</label><input id="pe-name" class="field" value="' + e(d.name) + '" placeholder="Parents’ care, rent received, bonus, LIC maturity…">' +
      '<label class="lbl" for="pe-amt">Amount a year</label><input id="pe-amt" class="field num" inputmode="decimal" value="' + (d.amount || '') + '" placeholder="0">' +
      '<label class="lbl" for="pe-from">From (year)</label><input id="pe-from" class="field num" type="number" min="' + y0 + '" max="' + (y0 + 50) + '" value="' + d.from + '">' +
      '<label class="lbl" for="pe-years">For how many years</label><input id="pe-years" class="field num" type="number" min="1" max="50" value="' + (d.years || 1) + '">' +
      '<label class="lbl" for="pe-grow">Grows each year</label><div class="te-dt"><select id="pe-grow" class="field">' + opt('inflation', 'With inflation', d.grow === 'inflation') + opt('none', 'Stays the same', d.grow === 'none') + opt('custom', 'By my own rate', d.grow === 'custom') + '</select><input id="pe-rate" class="field num" type="number" step="0.5" value="' + (d.rate || 0) + '" aria-label="Rate %" title="% a year"></div>' +
      '<label class="lbl" for="pe-tax">Taxable income</label><label class="switch"><input id="pe-tax" type="checkbox"' + (d.taxable ? ' checked' : '') + '><span class="track"></span><span>Add to income for tax</span></label>' +
      '</div><p class="hint" style="margin-top:8px">For one-off amounts set “For how many years” to 1. The amount is in today’s money when it grows with inflation.</p></form>';
    ED.ui.modal({
      title: x ? 'Money in or out' : 'Add money in or out', cls: 'st-modal', body,
      footer: (x ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        let kind = d.kind === 'in' ? 'in' : 'out';
        el.querySelector('.fin-type').addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; U.$$('.fin-type button', el).forEach(y => y.setAttribute('aria-pressed', String(y === b))); });
        el.querySelector('[data-x="save"]').addEventListener('click', () => {
          const v = { kind, name: el.querySelector('#pe-name').value.trim(), amount: ED.finance.amt(el.querySelector('#pe-amt').value), from: +el.querySelector('#pe-from').value || y0, years: Math.max(1, +el.querySelector('#pe-years').value || 1), grow: el.querySelector('#pe-grow').value, rate: +el.querySelector('#pe-rate').value || 0, taxable: el.querySelector('#pe-tax').checked };
          if (!v.name) { ED.ui.toast('Say what it is'); return; }
          if (!(v.amount > 0)) { ED.ui.toast('Enter the amount'); return; }
          ED.store.checkpoint('Plan entry');
          if (x) { Object.assign(x, v); delete x.sample; } else p.events.push(Object.assign(d, v));
          ED.store.commit(); api.close();
        });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', () => { ED.store.checkpoint('Delete'); p.events = p.events.filter(v => v.id !== x.id); ED.store.commit(); api.close(); ED.ui.undoToast('Deleted'); });
      },
    });
  };

  /* your numbers from the Finance records: average of the last three full months, and today's investments */
  FP.fromRecords = () => {
    const F = D().finance, FN = ED.finance;
    const m0 = U.firstOfMonth(U.today());
    const months = [1, 2, 3].map(i => U.addMonths(m0, -i));
    const tot = months.map(m => FN.totals(FN.inMonth(m)));
    const withData = tot.filter(t => t.income || t.expense);
    const inv = F.holdings.reduce((a, h) => a + (h.type === 'loan' || h.type === 'insurance' ? 0 : h.value || h.amount || 0), 0) + F.accounts.reduce((a, x) => a + Math.max(0, FN.balance(x)), 0);
    return { income: withData.length ? Math.round(withData.reduce((a, t) => a + t.income, 0) / withData.length) : 0, expenses: withData.length ? Math.round(withData.reduce((a, t) => a + t.expense, 0) / withData.length) : 0, months: withData.length, savings: Math.round(inv) };
  };

  /* ---------------- the page ---------------- */
  const num = (k, label, o) => {
    o = o || {};
    const v = P()[k];
    return '<label class="fp-f"><span class="fp-l">' + e(label) + '</span><span class="fp-in">' + (o.pre ? '<span class="fp-u">' + e(o.pre) + '</span>' : '') +
      '<input class="field num" data-change="fp-num" data-k="' + k + '" ' + (o.money ? 'inputmode="decimal"' : 'type="number" step="' + (o.step || 1) + '"') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') +
      ' value="' + (v == null || v === '' ? '' : v) + '" placeholder="' + e(o.ph || '0') + '">' + (o.suf ? '<span class="fp-u">' + e(o.suf) + '</span>' : '') + '</span>' + (o.hint ? '<span class="fp-h hint">' + o.hint + '</span>' : '') + '</label>';
  };
  const tile = (label, value, sub, cls) => '<div class="tile' + (cls ? ' ' + cls : '') + '"><span class="tile-l">' + e(label) + '</span><span class="tile-v">' + e(value) + '</span><span class="tile-s hint">' + sub + '</span></div>';

  const view = {
    id: 'finplan', label: 'Financial Plan',
    left() {
      const p = P();
      const R = FP.run();
      const f = R.first;
      const sym = ED.finance.symbol();
      const sipAll = R.goals.reduce((a, x) => a + x.sip, 0);
      const empty = !p.income && !p.expenses && !p.goals.length;
      const mode = st().left === 'wealth' && ED.wealth ? 'wealth' : 'plan';
      const lseg = '<div class="seg" role="group" aria-label="Page">' + [['plan', 'Goals & numbers'], ['wealth', 'Portfolio & risk']].map(x => '<button type="button" data-act="fp-left" data-k="' + x[0] + '" aria-pressed="' + (mode === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>';
      const head = '<div class="pg-head st-head"><h2 class="pg-title">' + (mode === 'wealth' ? 'Wealth plan' : 'Financial plan') + '</h2><div class="fin-tools">' + lseg + '<button type="button" class="icon-btn" data-act="fp-menu" aria-label="Plan menu" title="More">' + ED.icon('more') + '</button></div></div>';
      if (mode === 'wealth') return '<div class="fin fp wl">' + head + '<div class="st-scroll scroll" data-keep-scroll="fp-wl">' + ED.wealth.left() + '</div></div>';
      const tiles = '<div class="tiles fin-tiles fp-tiles">' +
        tile('Earnings this year', C$(f.gross), p.raise ? 'rising ' + p.raise + '% a year' : 'before tax') +
        tile('Income tax', C$(f.tax), f.gross ? pc(f.tax / f.gross * 100) + ' of earnings · ' + (p.taxMode === 'flat' ? 'flat ' + p.flatRate + '%' : p.taxMode === 'old' ? 'old regime' : 'new regime') : '—') +
        tile('Can save a month', C$(f.surplus / 12), 'in hand ' + C$(f.inHand / 12) + ' − costs', f.surplus < 0 ? 'neg' : '') +
        tile('Goals need a month', C$(sipAll), sipAll > f.surplus / 12 ? '<span class="fin-bad">short ' + C$(sipAll - f.surplus / 12) + '</span>' : R.goals.length ? '<span class="fin-ok">covered</span>' : 'add a goal', sipAll > f.surplus / 12 ? 'neg' : '') + '</div>';
      const goals = R.goals.slice().sort((a, b) => (a.next ? a.next.i : 99) - (b.next ? b.next.i : 99)).map(x => {
        const g = x.g, t = GT[g.type] || GT.other;
        const when = x.next ? (x.g.every ? 'next ' : '') + (R.y0 + x.next.i) + (x.occ.length > 1 ? ' · ' + x.occ.length + ' times' : '') : 'after the plan ends';
        return '<article class="fp-goal' + (x.funded ? '' : ' short') + '"><button type="button" class="plain-btn fp-goal-b" data-act="fp-goal" data-id="' + e(g.id) + '">' +
          '<span class="fp-gic" aria-hidden="true">' + t.icon + '</span><span class="fp-gm"><b>' + e(g.name) + '</b><span class="hint">' + e(when) + ' · ' + C$(g.cost) + ' today → <b>' + (x.next ? C$(x.next.price) : '—') + '</b> then</span></span>' +
          '<span class="fp-gr"><span class="num">' + (x.sip ? C$(x.sip) + '<span class="hint">/month</span>' : x.now ? C$(x.now) + '<span class="hint"> this year</span>' : x.next ? '<span class="fin-ok">covered</span>' : '') + '</span>' +
          (x.loan ? '<span class="hint">EMI ' + C$(x.loan.emi) + '/month</span>' : '') + (!x.funded ? '<span class="fin-bad">short ' + C$(x.short) + '</span>' : '') + '</span></button></article>';
      }).join('');
      const addBtns = '<div class="fp-add">' + ['house', 'education', 'travel', 'computer', 'car', 'marriage', 'health', 'emergency', 'other'].map(k => '<button type="button" class="chip-btn" data-act="fp-goal-new" data-type="' + k + '"><span aria-hidden="true">' + GT[k].icon + '</span>' + e(GT[k].label) + '</button>').join('') + '</div>';
      const events = (p.events || []).map(v => '<li><button type="button" class="plain-btn fp-ev" data-act="fp-event" data-id="' + e(v.id) + '"><span class="' + (v.kind === 'in' ? 'fin-ok' : 'fin-bad') + '">' + (v.kind === 'in' ? '+' : '−') + '</span> <b>' + e(v.name) + '</b><span class="hint">' + C$(v.amount) + ' a year · ' + v.from + (v.years > 1 ? '–' + (v.from + v.years - 1) : '') + '</span></button></li>').join('');
      const taxSel = '<label class="fp-f"><span class="fp-l">Income tax</span><select class="field" data-change="fp-sel" data-k="taxMode">' + opt('new', 'New regime (India, FY 2026-27)', p.taxMode === 'new') + opt('old', 'Old regime (with deductions)', p.taxMode === 'old') + opt('flat', 'Flat rate on all income', p.taxMode === 'flat') + '</select></label>';
      const form = '<div class="fp-form-g"><h4>Earnings</h4>' +
        num('income', 'Monthly salary before tax', { money: true, pre: sym, hint: 'gross pay, including DA and allowances' }) + num('raise', 'Yearly pay rise', { step: 0.5, suf: '%', min: 0, max: 30, hint: 'increments and DA together' }) +
        num('otherIncome', 'Other taxable income a month', { money: true, pre: sym, hint: 'rent, interest, side income' }) + num('pension', 'Pension a month after retiring', { money: true, pre: sym, hint: 'today’s money' }) + '</div>' +
        '<div class="fp-form-g"><h4>Living costs</h4>' + num('expenses', 'Household costs a month', { money: true, pre: sym, hint: 'everything except savings and goals' }) + num('inflation', 'Inflation', { step: 0.5, suf: '%', min: 0, max: 20 }) +
        num('retireSpend', 'Costs after retiring', { step: 5, suf: '% of now', min: 30, max: 150 }) + num('emergencyMonths', 'Emergency fund', { step: 1, suf: 'months', min: 0, max: 24 }) + '</div>' +
        '<div class="fp-form-g"><h4>Savings</h4>' + num('savings', 'Invested and saved today', { money: true, pre: sym, hint: 'FDs, PPF, EPF/GPF, funds, shares, bank' }) +
        (p.retFrom === 'portfolio' ? '<div class="fp-f"><span class="fp-l">Expected return</span><span class="fp-in"><b>' + pc(FP.retPct()) + '</b><span class="fp-u">a year, from the ' + e(ED.wealth.label(p.wealth && p.wealth.approach).toLowerCase()) + ' mix</span></span><button type="button" class="btn small ghost" data-act="fp-left" data-k="wealth">Change it on Portfolio &amp; risk</button></div>' : num('ret', 'Expected return', { step: 0.5, suf: '% a year', min: 0, max: 20, hint: 'before tax; 8–10% for a mix — or pick a mix on Portfolio &amp; risk' })) +
        num('retTax', 'Tax on the growth', { step: 0.5, suf: '%', min: 0, max: 40, hint: '12.5% equity LTCG; slab rate for FD interest' }) + num('stepUp', 'Raise monthly investing by', { step: 1, suf: '% a year', min: 0, max: 25 }) + '</div>' +
        '<div class="fp-form-g"><h4>Tax</h4>' + taxSel +
        (p.taxMode === 'flat' ? num('flatRate', 'Flat rate', { step: 0.5, suf: '%', min: 0, max: 50, hint: 'for example 12%' }) : '') +
        (p.taxMode === 'old' ? num('deductions', 'Deductions a year', { money: true, pre: sym, hint: '80C, 80D, home-loan interest' }) : '') +
        '<label class="switch fp-sw"><input type="checkbox" data-change="fp-chk" data-k="indexSlabs"' + (p.indexSlabs ? ' checked' : '') + '><span class="track"></span><span>Assume tax slabs rise with inflation</span></label></div>' +
        '<div class="fp-form-g"><h4>You</h4>' + num('age', 'Your age', { step: 1, min: 18, max: 90, ph: '—' }) + num('retireAge', 'Retire at', { step: 1, min: 40, max: 80 }) + num('years', 'Plan for', { step: 1, suf: 'years', min: 3, max: 50 }) + '</div>';
      return '<div class="fin fp">' +
        head +
        '<div class="st-scroll scroll" data-keep-scroll="fp-left">' +
        (empty ? '<div class="fp-start"><p>Start with today’s numbers — your salary, household costs and what you have saved — then add your goals. Everything is in today’s money; the plan adds inflation, pay rises and tax for each year.</p><div class="row-btns"><button type="button" class="btn small primary" data-act="fp-fill">' + ED.icon('wallet') + 'Fill from my records</button><button type="button" class="btn small" data-act="fp-common">' + ED.icon('plus') + 'Start with common goals</button></div></div>' : '') +
        tiles +
        '<h3 class="gh">Goals</h3>' + (goals ? '<div class="fp-goals">' + goals + '</div>' : '<p class="hint">No goals yet. Pick one below.</p>') + addBtns +
        '<h3 class="gh fin-gap">Other money in and out</h3><p class="hint">Regular or one-off amounts not covered above: a bonus, rent received, a policy maturing, support for parents, a big repair.</p>' +
        (events ? '<ul class="fp-evs">' + events + '</ul>' : '') + '<button type="button" class="btn small" data-act="fp-event-new">' + ED.icon('plus') + 'Add money in or out</button>' +
        '<h3 class="gh fin-gap">Your numbers</h3><div class="fp-formw">' + form + '</div>' +
        '</div></div>';
    },
    right() {
      const R = FP.run();
      const tab = st().tab || 'projection';
      const seg = '<div class="seg st-seg" role="group" aria-label="Show">' + [['projection', 'Projection'], ['schedule', 'Year by year'], ['wealth', 'Wealth report'], ['guide', 'How to manage']].map(x =>
        '<button type="button" data-act="fp-tab" data-tab="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>';
      const body = tab === 'schedule' ? schedule(R) : tab === 'guide' ? guidance(R) : tab === 'wealth' && ED.wealth ? ED.wealth.right(R) : projection(R);
      return '<div class="fin fin-r fp-r"><div class="pg-head"><h2 class="pg-title">Over the years</h2>' + seg + '</div><div class="st-scroll scroll" data-keep-scroll="fp-r-' + tab + '">' + body + '</div></div>';
    },
    mount(L, R) { CH.bind(L); CH.bind(R); },
  };

  function projection(R) {
    const p = P();
    const rows = R.rows;
    const labels = rows.map(x => "'" + String(x.fy).slice(2));
    const long = rows.map(x => 'FY ' + fyLabel(x.fy) + (x.age ? ' · age ' + x.age : '') + (x.goalNames.length ? ' · ' + x.goalNames.join(', ') : ''));
    const marks = [];
    rows.forEach((x, i) => { if (x.goals > 0 && x.goalNames.some(n => !/^EMI/.test(n))) marks.push({ i }); });
    const ri = p.age && p.retireAge > p.age ? p.retireAge - p.age : -1;
    const savings = CH.lines({
      title: 'Your savings over the years', labels, long, maxLabels: 10, h: 240,
      series: [{ name: 'Savings', color: 'var(--s1)', points: rows.map(x => Math.round(x.close)), area: true }, { name: 'In today’s money', color: 'var(--s3)', points: rows.map(x => Math.round(x.real)) }],
      marks, marker: ri >= 0 && ri < rows.length ? ri : null, markerLabel: 'Retire', fmt: v => C$(v), tipFmt: v => M$(v), left: 54,
      legend: CH.legend([{ kind: 'line', color: 'var(--s1)', label: 'Savings' }, { kind: 'line', color: 'var(--s3)', label: 'In today’s money' }]),
      sub: 'Savings at the end of each financial year after paying every goal. ◆ marks a year a goal is paid' + (R.runsOut ? '; <b class="fin-bad">below zero from FY ' + fyLabel(R.runsOut.fy) + '</b>.' : '.'),
      table: CH.table(['Year', 'Savings', 'In today’s money'], rows.map(x => ['FY ' + fyLabel(x.fy), M$(x.close), M$(x.real)])),
    });
    const money = CH.groups({
      title: 'Earnings, tax and spending each year', h: 230, left: 54, fmt: v => C$(v), maxLabels: 10,
      series: [{ name: 'In hand', color: 'var(--s1)' }, { name: 'Income tax', color: 'var(--s2)' }, { name: 'Living costs', color: 'var(--s3)' }, { name: 'Goals & EMIs', color: 'var(--s4)' }],
      data: rows.map((x, i) => ({ label: labels[i], long: long[i], values: [x.inHand, x.tax, x.living, x.goals + x.evOut], tip: 'In hand ' + C$(x.inHand) + ' · Tax ' + C$(x.tax) + ' · Living ' + C$(x.living) + ' · Goals & EMIs ' + C$(x.goals + x.evOut) })),
      legend: CH.legend([{ kind: 'g', color: 'var(--s1)', label: 'In hand' }, { kind: 'g', color: 'var(--s2)', label: 'Tax' }, { kind: 'g', color: 'var(--s3)', label: 'Living' }, { kind: 'g', color: 'var(--s4)', label: 'Goals & EMIs' }]),
      table: CH.table(['Year', 'Earnings', 'Tax', 'In hand', 'Living', 'Goals & EMIs'], rows.map(x => ['FY ' + fyLabel(x.fy), M$(x.gross), M$(x.tax), M$(x.inHand), M$(x.living), M$(x.goals + x.evOut)])),
    });
    const gl = R.goals.filter(x => x.next);
    const maxP = Math.max(1, ...gl.map(x => x.next.price));
    const goals = gl.length ? CH.meters({
      title: 'What each goal will cost', max: maxP,
      sub: 'Dark bar = cost today; pale bar = cost in the year it is needed, after price rises.',
      rows: gl.map(x => ({ label: (GT[x.g.type] || GT.other).icon + ' ' + x.g.name + ' · ' + (R.y0 + x.next.i), value: x.g.cost, total: x.next.price, valueLabel: C$(x.g.cost) + ' → ' + C$(x.next.price), tip: 'Today ' + M$(x.g.cost) + ', in ' + (R.y0 + x.next.i) + ' about ' + M$(x.next.price) + ' (' + (x.g.inflation || 0) + '% a year)' })),
      table: CH.table(['Goal', 'Year', 'Cost today', 'Cost then', 'Invest a month'], gl.map(x => [x.g.name, String(R.y0 + x.next.i), M$(x.g.cost), M$(x.next.price), M$(x.sip)])),
    }) : '';
    const f = R.first, last = rows[rows.length - 1];
    // a year worth showing: ten years on, or the last working year if that comes first
    let ti = Math.min(rows.length - 1, 10);
    if (p.age && p.retireAge > p.age) ti = Math.min(ti, p.retireAge - p.age - 1);
    const at = rows[Math.max(0, ti)];
    const summary = '<div class="fp-sum"><div><span class="hint">In FY ' + fyLabel(at.fy) + (at.age ? ' (age ' + at.age + ')' : '') + '</span><b>' + M$(at.inHand / 12) + '</b><span class="hint">a month in hand, from ' + M$(f.inHand / 12) + ' today (' + M$(at.inHand / 12 / Math.pow(1 + (p.inflation || 0) / 100, at.i)) + ' in today’s money)</span></div>' +
      '<div><span class="hint">Tax paid over the plan</span><b>' + M$(rows.reduce((a, x) => a + x.tax, 0)) + '</b><span class="hint">' + pc(rows.reduce((a, x) => a + x.tax, 0) / Math.max(1, rows.reduce((a, x) => a + x.gross, 0)) * 100) + ' of all earnings</span></div>' +
      '<div><span class="hint">Spent on goals and EMIs</span><b>' + M$(rows.reduce((a, x) => a + x.goals, 0)) + '</b><span class="hint">' + U.plural(R.goals.reduce((a, x) => a + x.occ.length, 0), 'payment') + '</span></div></div>';
    return summary + savings + money + goals;
  }

  function schedule(R) {
    const head = ['Year', 'Age', 'Earnings', 'Tax', 'In hand', 'Living', 'Goals, loans & other', 'Saved', 'Savings at year end', 'In today’s money'];
    const icons = names => names.map(n => { const m = /^(\S+)\s/.exec(n); return /^EMI/.test(n) ? 'EMI' : /^[+−]/.test(n) ? n.slice(0, 1) : m ? m[1] : '•'; }).filter((x, i, a) => a.indexOf(x) === i).join(' ');
    const body = R.rows.map(x => {
      const names = x.goalNames.concat(x.evNames);
      const out = x.goals + x.evOut;
      return '<tr class="' + (x.close < 0 ? 'neg' : '') + (x.goalNames.some(n => !/^EMI/.test(n)) ? ' has-goal' : '') + '"><th>' + fyLabel(x.fy) + '</th><td class="num">' + (x.age || '') + (x.age && !x.working ? '🌴' : '') + '</td><td class="num">' + C$(x.gross) + '</td><td class="num">' + C$(x.tax) + '</td><td class="num">' + C$(x.inHand) + '</td><td class="num">' + C$(x.living) + '</td>' +
        '<td class="num"' + (names.length ? ' title="' + e(names.join(' · ')) + '"' : '') + '>' + (out ? C$(out) + '<span class="fp-gn">' + e(icons(names)) + '</span>' : '—') + '</td>' +
        '<td class="num' + (x.surplus < 0 ? ' fin-bad' : '') + '">' + C$(x.surplus) + '</td><td class="num"><b class="' + (x.close < 0 ? 'fin-bad' : '') + '">' + C$(x.close) + '</b></td><td class="num">' + C$(x.real) + '</td></tr>';
    }).join('');
    const legend = R.goals.map(x => (GT[x.g.type] || GT.other).icon + ' ' + e(x.g.name)).join(' · ');
    return '<p class="hint">Each financial year from April to March, rounded (L = lakh, Cr = crore). Point at a goals cell to see what is paid that year. “Saved” is what is left after tax, living costs and goals; savings also grow by the expected return after tax. 🌴 marks years after retirement; red rows are years when savings are below zero.</p>' +
      (legend ? '<p class="hint fp-legend">' + legend + ' · EMI = loan instalments</p>' : '') +
      '<div class="fp-tablew"><table class="st-table fp-table"><thead><tr>' + head.map((h, i) => '<th' + (i ? ' class="num"' : '') + '>' + e(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<button type="button" class="btn small" data-act="fp-export">' + ED.icon('download') + 'Export the schedule with every rupee (.csv for Excel)</button>';
  }

  FP.exportCSV = async () => {
    const R = FP.run();
    const rows = [['Financial year', 'Age', 'Earnings', 'Income tax', 'In hand', 'Living costs', 'Goals & loans', 'Goals paid', 'Other out', 'Other items', 'Saved in the year', 'Growth', 'Tax on growth', 'Savings at year end', "In today's money"]];
    R.rows.forEach(x => rows.push(['FY ' + fyLabel(x.fy), x.age || '', Math.round(x.gross), Math.round(x.tax), Math.round(x.inHand), Math.round(x.living), Math.round(x.goals), x.goalNames.join('; '), Math.round(x.evOut), x.evNames.join('; '), Math.round(x.surplus), Math.round(x.growth), Math.round(x.gtax), Math.round(x.close), Math.round(x.real)]));
    rows.push([]); rows.push(['Goal', 'Kind', 'Cost today', 'Year', 'Cost then', 'Price rise %', 'Loan %', 'EMI a month', 'Invest a month']);
    R.goals.forEach(x => rows.push([x.g.name, (GT[x.g.type] || GT.other).label, Math.round(x.g.cost), x.next ? R.y0 + x.next.i : '', x.next ? Math.round(x.next.price) : '', x.g.inflation, x.g.loanPct || 0, x.loan ? Math.round(x.loan.emi) : '', Math.round(x.sip)]));
    await U.download('financial-plan-' + U.today() + '.csv', ED.xlsx.toCSV(rows), 'text/csv');
  };

  ED.views = ED.views || {};
  ED.views.finplan = view;

  /* ---------------- actions ---------------- */
  const CHG = (ED.changes = ED.changes || {});
  CHG['fp-num'] = el => { const k = el.dataset.k; const v = el.value === '' ? (k === 'age' ? null : 0) : ED.finance.amt(el.value); P()[k] = v; ED.store.commit(); };
  CHG['fp-sel'] = el => { P()[el.dataset.k] = el.value; ED.store.commit(); };
  CHG['fp-chk'] = el => { P()[el.dataset.k] = el.checked; ED.store.commit(); };
  A['fp-tab'] = el => { st().tab = el.dataset.tab; ED.app.renderPage('right'); CH.bind(document.getElementById('pg-right')); };
  A['fp-left'] = el => {
    const k = el.dataset.k === 'wealth' ? 'wealth' : 'plan';
    st().left = k;
    if (k === 'wealth') st().tab = 'wealth'; else if (st().tab === 'wealth') st().tab = 'projection';
    ED.app.render();
  };
  A['fp-goal'] = el => FP.editGoal(el.dataset.id);
  A['fp-goal-new'] = el => FP.editGoal(null, el.dataset.type);
  A['fp-event'] = el => FP.editEvent(el.dataset.id);
  A['fp-event-new'] = () => FP.editEvent(null);
  A['fp-export'] = () => FP.exportCSV();
  A['fp-fill'] = async () => {
    const r = FP.fromRecords();
    if (!r.months && !r.savings) { ED.ui.toast('No records yet in the Finance tab — type your numbers under “Your numbers”.', { timeout: 7000 }); return; }
    const ok = await ED.ui.confirm({ title: 'Fill from my records', message: 'From the last ' + U.plural(r.months, 'month') + ' of records: income about ' + M$(r.income) + ' a month, spending about ' + M$(r.expenses) + ' a month; accounts and investments now ' + M$(r.savings) + '. Put these into the plan? (Income here is what reached your account; if that is after tax, raise the salary to your gross pay.)', ok: 'Use these numbers' });
    if (!ok) return;
    ED.store.checkpoint('Plan numbers');
    const p = P(); if (r.income) p.income = r.income; if (r.expenses) p.expenses = r.expenses; if (r.savings) p.savings = r.savings;
    delete p.sampleNumbers;
    ED.store.commit(); ED.ui.undoToast('Numbers filled in');
  };
  A['fp-common'] = () => {
    const p = P(), y0 = Y0();
    ED.store.checkpoint('Common goals');
    ['house', 'education', 'travel', 'computer'].forEach(k => {
      const t = GT[k];
      if (p.goals.some(g => g.type === k)) return;
      p.goals.push({ id: U.uid('pg'), type: k, name: t.label, cost: t.cost, year: y0 + t.years, inflation: t.inf, saved: 0, every: t.every || 0, times: 0, loanPct: t.loan ? t.loan.pct : 0, loanRate: t.loan ? t.loan.rate : 8.5, loanYears: t.loan ? t.loan.years : 0, notes: '' });
    });
    ED.store.commit(); ED.ui.undoToast('Added a house, education, sightseeing and a computer — click each to set your own amounts and years');
  };
  A['fp-menu'] = el => ED.ui.menu(el, [
    { label: 'Fill income, costs and savings from my records', icon: 'wallet', onClick: () => A['fp-fill']() },
    { label: 'Add common goals (house, education, travel, computer)', icon: 'plus', onClick: () => A['fp-common']() },
    { label: 'Export the schedule (.csv for Excel)', icon: 'download', onClick: () => FP.exportCSV() },
    { sep: true },
    { label: 'Start the plan again…', icon: 'trash', danger: true, onClick: async () => {
      const ok = await ED.ui.confirm({ title: 'Start again', message: 'Clear every goal, entry and number in the financial plan? Your Finance records are not touched.', ok: 'Clear the plan', danger: true });
      if (!ok) return;
      ED.store.checkpoint('Clear plan'); D().finance.plan = ED.sample.finPlan(); ED.store.commit(); ED.ui.undoToast('Plan cleared');
    } },
  ], { placement: 'right-align' });
})();
