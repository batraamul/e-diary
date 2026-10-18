/* E-Diary — Finance: planning (monthly budget, savings goals, bills) and records (income, spending, accounts, policies).
   Data: ED.store.data.finance = { cats, accounts, goals, holdings, bills, records, plan }  (amounts are plain numbers in
   the currency chosen in Settings, kept to the paisa/cent).
   How the totals work:
     Received  = income records
     Spent     = spending records, not counting categories marked "saving" (Savings & investments) and not transfers
     Put aside = records in saving categories (SIPs, PPF, FD, money added to a savings goal)
     Saved     = Received − Spent  (= what you put aside + what stayed in the bank)
     Transfers move money between your own accounts (bank → cash, bank → credit card) and change no total.
   The long-range, goal-based plan (inflation, tax, year-by-year schedule) is in js/finplan.js. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const CH = ED.charts;
  const D = () => ED.store.data;
  const F = () => D().finance;
  const S = () => ED.store.data.settings;
  const A = (ED.actions = ED.actions || {});
  const st = () => ED.state.fin || (ED.state.fin = {});
  const opt = (v, label, sel) => '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';

  const FN = (ED.finance = {});

  /* ---------------- money formatting ---------------- */
  let fmtCache = {};
  FN.money = (v, opts) => {
    opts = opts || {};
    const cur = S().currency || 'INR';
    if (opts.dec == null) opts = Object.assign({}, opts, { dec: Math.abs(Math.round((v || 0) * 100)) % 100 !== 0 });
    const key = cur + (opts.dec ? 'd' : '');
    if (!fmtCache[key]) {
      try { fmtCache[key] = new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency: cur, maximumFractionDigits: opts.dec ? 2 : 0, minimumFractionDigits: opts.dec ? 2 : 0 }); }
      catch (err) { fmtCache[key] = { format: n => cur + ' ' + Math.round(n).toLocaleString() }; }
    }
    return fmtCache[key].format(v || 0);
  };
  FN.symbol = () => { try { return FN.money(0).replace(/[\d.,\s]/g, '') || S().currency; } catch (err) { return S().currency; } };
  const M$ = v => FN.money(v);
  const compact = v => (FN.symbol() + CH.compact(v)).replace(/\s/g, '');
  /* a money amount as people and banks write it: "Rs. 1,23,456.50", "(1,234.00)", "500.00-", "2,000.00 Dr", "1234Dr" */
  const amt = v => {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : 0;
    const t = String(v == null ? '' : v).trim();
    const m = /\d[\d,]*(?:\.\d+)?|\.\d+/.exec(t);
    if (!m) return 0;
    const n = parseFloat(m[0].replace(/,/g, ''));
    const neg = /^\(.*\)$/.test(t) || /^[-−]/.test(t.replace(/^(?:rs\.?|inr|₹|\$|€|£)\s*/i, '')) || /[-−]\s*$/.test(t) || /dr\.?\s*$/i.test(t);
    return isNaN(n) ? 0 : Math.round((neg ? -n : n) * 100) / 100;
  };
  const r2 = v => Math.round(v * 100) / 100;
  FN.amt = amt;

  /* ---------------- lookups & totals ---------------- */
  FN.cat = id => F().cats.find(c => c.id === id) || null;
  FN.account = id => F().accounts.find(a => a.id === id) || null;
  FN.catsOf = kind => F().cats.filter(c => c.kind === kind).sort((a, b) => (a.order || 0) - (b.order || 0));
  const monthEnd = m => U.addDays(U.addMonths(m, 1), -1);
  FN.inMonth = m => { const end = monthEnd(m); return F().records.filter(r => r.date >= m && r.date <= end); };
  FN.isSaving = id => { const c = FN.cat(id); return !!(c && c.kind === 'expense' && c.saving); };
  /* income, spending (without savings), put aside (savings categories), all money out, per category */
  FN.totals = list => {
    const t = { income: 0, expense: 0, saved: 0, out: 0, byCat: new Map() };
    list.forEach(r => {
      if (r.type === 'transfer') return;
      const a = +r.amount || 0;
      if (r.type === 'income') t.income += a;
      else if (r.type === 'expense') { if (FN.isSaving(r.categoryId)) t.saved += a; else t.expense += a; t.out += a; }
      t.byCat.set(r.categoryId, (t.byCat.get(r.categoryId) || 0) + a);
    });
    t.income = r2(t.income); t.expense = r2(t.expense); t.saved = r2(t.saved); t.out = r2(t.out);
    t.byCat.forEach((v, k) => t.byCat.set(k, r2(v)));
    t.left = r2(t.income - t.expense);                 // saved in all: put aside + left in the bank
    return t;
  };
  FN.budgetTotal = () => r2(FN.catsOf('expense').reduce((a, c) => a + (c.budget || 0), 0));
  FN.spendBudget = () => r2(FN.catsOf('expense').filter(c => !c.saving).reduce((a, c) => a + (c.budget || 0), 0));
  FN.saveBudget = () => r2(FN.catsOf('expense').filter(c => c.saving).reduce((a, c) => a + (c.budget || 0), 0));
  FN.balance = acc => r2(F().records.reduce((b, r) => {
    const a = +r.amount || 0;
    if (r.type === 'transfer') return r.accountId === acc.id ? b - a : r.toAccountId === acc.id ? b + a : b;
    if (r.accountId !== acc.id) return b;
    return r.type === 'income' ? b + a : r.type === 'expense' ? b - a : b;
  }, acc.opening || 0));
  /* financial year (April to March, as in India) */
  FN.fyStart = k => { const [y, m] = U.ymd(k); return (m >= 4 ? y : y - 1) + '-04-01'; };

  /* upcoming money: unpaid bills this month and policy/investment dates in the next 45 days */
  FN.dues = () => {
    const today = U.today(), m = U.firstOfMonth(today), mk = m.slice(0, 7);
    const out = [];
    F().bills.filter(b => b.active !== false).forEach(b => {
      if (b.paid && b.paid[mk]) return;
      const day = Math.min(b.dueDay || 1, U.daysInMonth(+m.slice(0, 4), +m.slice(5, 7) - 1));
      out.push({ kind: 'bill', item: b, date: m.slice(0, 8) + U.pad(day), amount: b.amount, name: b.name });
    });
    F().holdings.forEach(h => {
      if (!h.due) return;
      const d = U.diffDays(today, h.due);
      if (d >= -7 && d <= 45) out.push({ kind: 'holding', item: h, date: h.due, amount: h.premium || h.value || h.amount || 0, name: h.name + (h.type === 'insurance' ? ' — renewal' : ' — ' + (HTYPES[h.type] || 'due')) });
    });
    if (ED.purchases) ED.purchases.dues().forEach(x => out.push(x));   // groceries and clothes to buy (js/purchases.js)
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };

  const HTYPES = { insurance: 'Insurance', fd: 'Fixed deposit', rd: 'Recurring deposit', ppf: 'PPF', epf: 'EPF / GPF', nps: 'NPS', mf: 'Mutual fund', stocks: 'Shares', gold: 'Gold', property: 'Property', loan: 'Loan', other: 'Other' };
  const ATYPES = { bank: 'Bank account', card: 'Credit card', cash: 'Cash', wallet: 'UPI / wallet', other: 'Other' };
  FN.HTYPES = HTYPES;

  /* ---------------- changes ---------------- */
  FN.addRecord = r => {
    const rec = Object.assign({ id: U.uid('fr'), date: U.today(), type: 'expense', amount: 0, categoryId: 'fc-other', accountId: null, desc: '', notes: '', createdAt: Date.now(), updatedAt: Date.now() }, r);
    F().records.push(rec);
    return rec;
  };

  /* a first guess at the category from the description (you can always change it) */
  const GUESS = [
    [/grocer|vegetable|fruit|milk|kirana|bigbasket|blinkit|zepto|supermarket|ration/i, 'fc-grocery'], [/rent|maintenance|society|house tax|property tax/i, 'fc-home'],
    [/electric|water bill|gas|cylinder|lpg|bescom|bses|tata power/i, 'fc-utility'], [/mobile|recharge|internet|broadband|wifi|jio|airtel|dth/i, 'fc-phone'],
    [/fuel|petrol|diesel|cng|uber|ola|rapido|metro|taxi|auto|bus|parking|toll|fastag|service/i, 'fc-transport'], [/doctor|medicine|pharma|hospital|clinic|lab test|chemist/i, 'fc-health'],
    [/book|course|fee|tuition|school|college|exam|nptel|udemy|coursera/i, 'fc-edu'], [/insurance|premium|lic\b|policy/i, 'fc-ins'],
    [/sip|mutual fund|ppf|nps|fd\b|fixed deposit|rd\b|shares|stock|gold/i, 'fc-invest'], [/emi|loan/i, 'fc-emi'],
    [/restaurant|lunch|dinner|breakfast|cafe|coffee|movie|zomato|swiggy|pizza|snack/i, 'fc-food'], [/train|irctc|flight|air|hotel|trip|travel|holiday/i, 'fc-travel'],
    [/gift|donation|charity|temple|puja/i, 'fc-gifts'], [/amazon|flipkart|myntra|clothes|shoes|shirt|saree|shopping|electronics/i, 'fc-shop'],
    [/salary|pay\b|arrear|da arrear/i, 'fc-salary'], [/interest|dividend|coupon/i, 'fc-interest'],
  ];
  FN.guess = (desc, kind) => {
    for (const g of GUESS) if (g[0].test(desc || '')) { const c = FN.cat(g[1]); if (c && c.kind === kind) return c.id; }
    return null;
  };

  /* ======================= editors ======================= */
  FN.editRecord = (id, preset) => {
    const r = id ? F().records.find(x => x.id === id) : null;
    const accs = F().accounts;
    const d = r ? U.clone(r) : Object.assign({ date: U.today() > monthEnd(monthKey()) || U.today() < monthKey() ? monthKey() : U.today(), type: 'expense', amount: '', categoryId: 'fc-other', accountId: (accs[0] || {}).id || '', toAccountId: (accs[1] || {}).id || '', desc: '', notes: '' }, preset || {});
    const catOpts = kind => FN.catsOf(kind).map(c => opt(c.id, (c.icon ? c.icon + ' ' : '') + c.name + (c.saving ? ' (saving)' : ''), c.id === d.categoryId)).join('');
    const accOpts = sel => opt('', '—', !sel) + accs.map(a => opt(a.id, a.name, a.id === sel)).join('');
    const body = '<form class="fin-form">' +
      '<div class="seg fin-type" role="group" aria-label="Type"><button type="button" data-type="expense" aria-pressed="' + (d.type === 'expense') + '">Spent</button><button type="button" data-type="income" aria-pressed="' + (d.type === 'income') + '">Received</button><button type="button" data-type="transfer" aria-pressed="' + (d.type === 'transfer') + '" title="Between your own accounts: bank → cash, bank → credit card">Transfer</button></div>' +
      '<div class="st-grid">' +
      '<label class="lbl" for="fr-amt">Amount (' + e(FN.symbol()) + ')</label><input id="fr-amt" class="field num fin-amt" inputmode="decimal" autocomplete="off" value="' + e(d.amount === '' ? '' : String(d.amount)) + '" placeholder="0">' +
      '<label class="lbl" for="fr-desc">What for</label><input id="fr-desc" class="field" value="' + e(d.desc) + '" placeholder="e.g. Groceries at the market" autocomplete="off">' +
      '<label class="lbl fr-cat-l" for="fr-cat">Category</label><select id="fr-cat" class="field">' + catOpts(d.type === 'income' ? 'income' : 'expense') + '</select>' +
      '<label class="lbl" for="fr-date">Date</label><input id="fr-date" class="field" type="date" value="' + e(d.date) + '">' +
      '<label class="lbl" for="fr-acc" id="fr-acc-l">' + (d.type === 'transfer' ? 'From account' : 'Paid from / into') + '</label><select id="fr-acc" class="field">' + accOpts(d.accountId) + '</select>' +
      '<label class="lbl fr-to-l" for="fr-to">To account</label><select id="fr-to" class="field">' + accOpts(d.toAccountId) + '</select>' +
      '<label class="lbl" for="fr-notes">Notes</label><textarea id="fr-notes" class="field" rows="2" placeholder="Bill number, mode of payment…">' + e(d.notes || '') + '</textarea>' +
      '</div><p class="hint fr-thint">A transfer moves money between your own accounts. It changes their balances but is not income or spending.</p></form>';
    ED.ui.modal({
      title: r ? 'Record' : 'New record', cls: 'st-modal', body,
      footer: (r ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">' + (r ? 'Save' : 'Add') + '</button>',
      onMount(el, api) {
        let type = d.type === 'income' || d.type === 'transfer' ? d.type : 'expense';
        let shown = type === 'income' ? 'income' : 'expense';     // which category list the dropdown holds
        const cat = el.querySelector('#fr-cat');
        const show = () => {
          const tr = type === 'transfer';
          [cat, el.querySelector('.fr-cat-l')].forEach(x => { x.hidden = tr; });
          [el.querySelector('#fr-to'), el.querySelector('.fr-to-l'), el.querySelector('.fr-thint')].forEach(x => { x.hidden = !tr; });
          el.querySelector('#fr-acc-l').textContent = tr ? 'From account' : 'Paid from / into';
        };
        show();
        el.querySelector('.fin-type').addEventListener('click', ev => {
          const b = ev.target.closest('[data-type]'); if (!b) return;
          type = b.dataset.type;
          U.$$('.fin-type button', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          if (type !== 'transfer' && type !== shown) {
            d.categoryId = type === 'income' ? (FN.cat('fc-salary') ? 'fc-salary' : '') : 'fc-other';
            cat.innerHTML = catOpts(type); shown = type;
            picked = false; guess();
          }
          show();
        });
        let picked = !!r;
        cat.addEventListener('change', () => { picked = true; });
        const guess = () => { if (picked || type === 'transfer') return; const g = FN.guess(el.querySelector('#fr-desc').value, type); if (g) cat.value = g; };
        el.querySelector('#fr-desc').addEventListener('input', guess);
        const save = () => {
          const a = Math.abs(amt(el.querySelector('#fr-amt').value));
          if (!(a > 0)) { ED.ui.toast('Enter an amount'); el.querySelector('#fr-amt').focus(); return; }
          const date = el.querySelector('#fr-date').value; if (!U.isKey(date)) { ED.ui.toast('Choose a date'); return; }
          const from = el.querySelector('#fr-acc').value || null, to = el.querySelector('#fr-to').value || null;
          if (type === 'transfer' && (!from || !to || from === to)) { ED.ui.toast('Choose two different accounts for a transfer'); return; }
          ED.store.checkpoint('Record');
          const f = { type, amount: a, date, categoryId: type === 'transfer' ? null : cat.value, accountId: from, toAccountId: type === 'transfer' ? to : null, desc: el.querySelector('#fr-desc').value.trim(), notes: el.querySelector('#fr-notes').value.trim(), updatedAt: Date.now() };
          if (r) { Object.assign(r, f); delete r.sample; if (r.src) r.fixed = true; } else FN.addRecord(f);   // fixed: your edit stays (js/purchases.js)
          if (date.slice(0, 7) !== monthKey().slice(0, 7)) st().month = U.firstOfMonth(date);
          ED.store.commit(); api.close();
          ED.ui.toast((type === 'income' ? 'Received ' : type === 'transfer' ? 'Moved ' : 'Spent ') + M$(a) + (f.desc ? ' · ' + f.desc : ''));
        };
        el.querySelector('[data-x="save"]').addEventListener('click', save);
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
        el.querySelector('#fr-amt').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', () => {
          ED.store.checkpoint('Delete record');
          F().records = F().records.filter(x => x.id !== r.id);
          F().bills.forEach(b => { Object.keys(b.paid || {}).forEach(k => { if (b.paid[k] === r.id) delete b.paid[k]; }); });
          ED.store.commit(); api.close(); ED.ui.undoToast('Record deleted');
        });
        setTimeout(() => el.querySelector('#fr-amt').focus(), 40);
      },
    });
  };

  /* generic small editor for bills, goals, accounts, policies and categories */
  function itemEditor(o) {
    const it = o.item;
    const body = '<form class="fin-form"><div class="st-grid">' + o.fields.map(f => {
      const id = 'fe-' + f.k; const v = it[f.k] == null ? '' : it[f.k];
      let ctl;
      if (f.type === 'select') ctl = '<select id="' + id + '" class="field">' + f.options.map(x => opt(x[0], x[1], String(x[0]) === String(v))).join('') + '</select>';
      else if (f.type === 'area') ctl = '<textarea id="' + id + '" class="field" rows="2">' + e(v) + '</textarea>';
      else ctl = '<input id="' + id + '" class="field' + (f.type === 'money' || f.type === 'number' ? ' num' : '') + '" ' + (f.type === 'date' ? 'type="date"' : f.type === 'number' ? 'type="number"' : f.type === 'money' ? 'inputmode="decimal"' : 'type="text"') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + ' value="' + e(v) + '" placeholder="' + e(f.ph || '') + '" autocomplete="off">';
      return '<label class="lbl" for="' + id + '">' + e(f.label) + '</label>' + ctl;
    }).join('') + '</div>' + (o.hint ? '<p class="hint" style="margin-top:10px">' + o.hint + '</p>' : '') + '</form>';
    ED.ui.modal({
      title: o.title, cls: 'st-modal', body,
      footer: (o.onDelete ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">Save</button>',
      onMount(el, api) {
        const save = () => {
          const out = {};
          for (const f of o.fields) {
            const x = el.querySelector('#fe-' + f.k);
            let v = x.value;
            if (f.type === 'money') v = amt(v);
            else if (f.type === 'number') v = v === '' ? null : +v;
            else if (typeof v === 'string') v = v.trim();
            if (f.required && !v) { ED.ui.toast(f.label + ' is needed'); x.focus(); return; }
            out[f.k] = v;
          }
          ED.store.checkpoint(o.title);
          o.onSave(out);
          ED.store.commit(); api.close();
        };
        el.querySelector('[data-x="save"]').addEventListener('click', save);
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', async () => {
          const ok = await ED.ui.confirm({ title: 'Delete', message: 'Delete “' + (it.name || 'this item') + '”?', ok: 'Delete', danger: true });
          if (!ok) return;
          ED.store.checkpoint('Delete'); o.onDelete(); ED.store.commit(); api.close(); ED.ui.undoToast('Deleted');
        });
      },
    });
  }
  const catOptions = kind => FN.catsOf(kind).map(c => [c.id, (c.icon ? c.icon + ' ' : '') + c.name]);
  const accOptions = () => [['', '—']].concat(F().accounts.map(a => [a.id, a.name]));
  const upsert = (list, item, patch) => { const x = list.find(y => y.id === item.id); if (x) { Object.assign(x, patch); delete x.sample; } else list.push(Object.assign(item, patch)); };

  FN.editBill = id => {
    const b = id ? F().bills.find(x => x.id === id) : { id: U.uid('fb'), name: '', amount: 0, dueDay: 1, categoryId: 'fc-home', accountId: '', active: true, paid: {} };
    itemEditor({ title: id ? 'Monthly bill' : 'New monthly bill', item: b,
      fields: [{ k: 'name', label: 'Name', required: true, ph: 'Rent, SIP, electricity…' }, { k: 'amount', label: 'Amount', type: 'money' }, { k: 'dueDay', label: 'Due on day', type: 'number', min: 1, max: 31 },
        { k: 'categoryId', label: 'Category', type: 'select', options: catOptions('expense') }, { k: 'accountId', label: 'Paid from', type: 'select', options: accOptions() }],
      hint: 'Tick a bill as paid each month and it is written into your records automatically.',
      onSave: v => { v.dueDay = Math.max(1, Math.min(31, v.dueDay || 1)); upsert(F().bills, b, v); },
      onDelete: id ? () => { F().bills = F().bills.filter(x => x.id !== id); } : null });
  };
  FN.editGoal = id => {
    const g = id ? F().goals.find(x => x.id === id) : { id: U.uid('fg'), name: '', target: 0, saved: 0, due: U.addMonths(U.today(), 12), notes: '', createdAt: Date.now() };
    itemEditor({ title: id ? 'Savings goal' : 'New savings goal', item: g,
      fields: [{ k: 'name', label: 'Goal', required: true, ph: 'Emergency fund, children’s education…' }, { k: 'target', label: 'Target amount', type: 'money' }, { k: 'saved', label: 'Saved so far', type: 'money' }, { k: 'due', label: 'Reach it by', type: 'date' }, { k: 'notes', label: 'Notes', type: 'area' }],
      onSave: v => upsert(F().goals, g, v),
      onDelete: id ? () => { F().goals = F().goals.filter(x => x.id !== id); } : null });
  };
  FN.editAccount = id => {
    const a = id ? F().accounts.find(x => x.id === id) : { id: U.uid('fa'), name: '', type: 'bank', institution: '', last4: '', opening: 0, notes: '' };
    itemEditor({ title: id ? 'Account' : 'New account', item: a,
      fields: [{ k: 'name', label: 'Name', required: true, ph: 'Salary account, cash, credit card…' }, { k: 'type', label: 'Type', type: 'select', options: Object.keys(ATYPES).map(k => [k, ATYPES[k]]) },
        { k: 'institution', label: 'Bank / issuer' }, { k: 'last4', label: 'Last 4 digits', ph: 'Only the last four' }, { k: 'opening', label: 'Opening balance', type: 'money' }, { k: 'notes', label: 'Notes', type: 'area' }],
      hint: 'Keep full account and card numbers, PINs and passwords out of here — the Passwords tab keeps secrets encrypted.',
      onSave: v => { v.last4 = String(v.last4 || '').replace(/\D/g, '').slice(-4); upsert(F().accounts, a, v); },
      onDelete: id ? () => { F().accounts = F().accounts.filter(x => x.id !== id); F().records.forEach(r => { if (r.accountId === id) r.accountId = null; }); } : null });
  };
  FN.editHolding = id => {
    const h = id ? F().holdings.find(x => x.id === id) : { id: U.uid('fh'), name: '', type: 'insurance', institution: '', amount: 0, value: 0, premium: 0, frequency: 'yearly', start: '', due: '', ref: '', notes: '' };
    itemEditor({ title: id ? 'Policy or investment' : 'New policy or investment', item: h,
      fields: [{ k: 'name', label: 'Name', required: true, ph: 'Health insurance, PPF, FD…' }, { k: 'type', label: 'Type', type: 'select', options: Object.keys(HTYPES).map(k => [k, HTYPES[k]]) },
        { k: 'institution', label: 'Company / bank' }, { k: 'ref', label: 'Policy / folio no.' }, { k: 'amount', label: 'Invested / sum assured', type: 'money' }, { k: 'value', label: 'Current value', type: 'money' },
        { k: 'premium', label: 'Premium / instalment', type: 'money' }, { k: 'frequency', label: 'Paid', type: 'select', options: [['', '—'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['half-yearly', 'Half-yearly'], ['yearly', 'Yearly'], ['once', 'Once']] },
        { k: 'start', label: 'Started', type: 'date' }, { k: 'due', label: 'Next due / maturity', type: 'date' }, { k: 'notes', label: 'Notes', type: 'area' }],
      onSave: v => upsert(F().holdings, h, v),
      onDelete: id ? () => { F().holdings = F().holdings.filter(x => x.id !== id); } : null });
  };
  FN.editCategory = id => {
    const c = id ? FN.cat(id) : { id: U.uid('fc'), name: '', kind: 'expense', icon: '🧾', budget: 0, order: F().cats.length };
    const item = Object.assign({}, c, { kind: c.kind === 'income' ? 'income' : c.saving ? 'saving' : 'expense' });
    itemEditor({ title: id ? 'Category' : 'New category', item,
      fields: [{ k: 'name', label: 'Name', required: true }, { k: 'kind', label: 'For', type: 'select', options: [['expense', 'Spending'], ['saving', 'Saving or investing (not spending)'], ['income', 'Income']] }, { k: 'icon', label: 'Emoji' }, { k: 'budget', label: 'Monthly budget', type: 'money' }],
      hint: '“Saving or investing” is money you move out of your account but still own — SIPs, PPF, RD, FD. It is shown as put aside, not spent.',
      onSave: v => { v.saving = v.kind === 'saving'; if (v.kind === 'saving') v.kind = 'expense'; upsert(F().cats, c, v); },
      onDelete: id && !F().records.some(r => r.categoryId === id) ? () => { F().cats = F().cats.filter(x => x.id !== id); } : null });
  };

  /* ---------------- import / export ---------------- */
  FN.exportCSV = async () => {
    const rows = [['Date', 'Type', 'Category', 'Account', 'Description', 'Amount', 'Notes']];
    F().records.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
      const c = FN.cat(r.categoryId), a = FN.account(r.accountId);
      const to = FN.account(r.toAccountId);
      rows.push([r.date, r.type === 'income' ? 'Income' : r.type === 'transfer' ? 'Transfer' : FN.isSaving(r.categoryId) ? 'Saving' : 'Expense', c ? c.name : r.type === 'transfer' ? 'Transfer' + (to ? ' to ' + to.name : '') : '', a ? a.name : '', r.desc, r.amount, r.notes || '']);
    });
    await U.download('finance-records-' + U.today() + '.csv', ED.xlsx.toCSV(rows), 'text/csv');
  };
  /* bank statements and spreadsheets: Date + (Amount | Debit/Withdrawal + Credit/Deposit) + Description */
  FN.importFile = async () => {
    const file = await U.pickFile('.csv,.xlsx,.xlsm,.tsv,.txt');
    if (!file) return;
    try {
      const sheets = await ED.xlsx.readFile(file);
      const low = v => String(v == null ? '' : v).trim().toLowerCase();
      let best = null;
      for (const sh of sheets) {
        for (let hi = 0; hi < Math.min(sh.rows.length, 25); hi++) {
          const head = (sh.rows[hi] || []).map(low);
          const col = names => head.findIndex(h => names.some(n => h === n || h.indexOf(n) === 0));
          const dc = head.findIndex(h => /^(dr\s*\/\s*cr|cr\s*\/\s*dr|debit\s*\/\s*credit|credit\s*\/\s*debit|txn type|transaction type|type)$/.test(h));
          const colX = names => head.findIndex((h, i) => i !== dc && names.some(n => h === n || h.indexOf(n + ' ') === 0 || h.indexOf(n + '.') === 0 || h.indexOf(n + '(') === 0 || (n.length > 3 && h.indexOf(n) === 0)));
          const c = { date: col(['date', 'txn date', 'transaction date', 'value date', 'tran date']), desc: col(['description', 'narration', 'particulars', 'details', 'remarks', 'what for']),
            amount: colX(['amount', 'transaction amount', 'amount (inr)']), debit: colX(['debit', 'withdrawal', 'withdrawals', 'dr', 'paid out', 'debit amount', 'withdrawal amt']), credit: colX(['credit', 'deposit', 'deposits', 'cr', 'paid in', 'credit amount', 'deposit amt']), type: dc, cat: col(['category']) };
          if (c.date >= 0 && (c.amount >= 0 || c.debit >= 0 || c.credit >= 0)) { best = { sh, hi, c }; break; }
        }
        if (best) break;
      }
      if (!best) throw new Error('No sheet with a Date column and an Amount (or Debit/Credit) column was found.');
      const { sh, hi, c } = best;
      const out = [];
      // one signed Amount column: negative = spent, positive = received; all positive = all spent
      const hasNeg = c.amount >= 0 && sh.rows.slice(hi + 1).some(r => r && amt(r[c.amount]) < 0 && !/\bdr\.?\s*$/i.test(String(r[c.amount])));
      sh.rows.slice(hi + 1).forEach(r => {
        r = r || [];
        const date = ED.xlsx.anyDate(r[c.date]); if (!date) return;
        if (c.type >= 0 && /^transfer/.test(low(r[c.type]))) return;
        let type = 'expense', a = 0;
        if (c.debit >= 0 && Math.abs(amt(r[c.debit])) > 0) { a = Math.abs(amt(r[c.debit])); type = 'expense'; }
        else if (c.credit >= 0 && Math.abs(amt(r[c.credit])) > 0) { a = Math.abs(amt(r[c.credit])); type = 'income'; }
        else if (c.amount >= 0) {
          const raw = String(r[c.amount] == null ? '' : r[c.amount]);
          const v = amt(raw); a = Math.abs(v);
          const t = c.type >= 0 ? low(r[c.type]) : '';
          type = /income|credit|^cr\b|^c$|received/.test(t) ? 'income' : /expense|debit|^dr\b|^d$|spent/.test(t) ? 'expense' : /\bcr\.?\s*$/i.test(raw) ? 'income' : /\bdr\.?\s*$/i.test(raw) ? 'expense' : hasNeg && v > 0 ? 'income' : 'expense';
        }
        if (!(a > 0)) return;
        const cname = c.cat >= 0 ? low(r[c.cat]) : '';
        const catm = F().cats.find(x => low(x.name) === cname && x.kind === type);
        out.push({ date, type, amount: a, desc: c.desc >= 0 ? String(r[c.desc] || '').trim().slice(0, 140) : '', categoryId: catm ? catm.id : type === 'income' ? 'fc-otherin' : 'fc-other', accountId: null, notes: 'Imported from ' + file.name });
      });
      if (!out.length) throw new Error('No rows with a date and an amount.');
      const dup = new Set(F().records.map(r => r.date + '|' + r.type + '|' + r.amount + '|' + r.desc));
      const fresh = out.filter(r => !dup.has(r.date + '|' + r.type + '|' + r.amount + '|' + r.desc));
      const ok = await ED.ui.confirm({ title: 'Import records', message: 'Found ' + out.length + ' records in “' + file.name + '”' + (out.length - fresh.length ? ' (' + (out.length - fresh.length) + ' already in your diary will be skipped)' : '') + '. Add ' + fresh.length + '? You can set their categories afterwards.', ok: 'Add ' + fresh.length });
      if (!ok || !fresh.length) return;
      ED.store.checkpoint('Import records');
      fresh.forEach(r => FN.addRecord(r));
      st().month = U.firstOfMonth(fresh[fresh.length - 1].date);
      ED.store.commit(); ED.ui.undoToast(U.plural(fresh.length, 'record') + ' imported');
    } catch (err) { ED.ui.toast('Could not import: ' + (err.message || err), { kind: 'err', timeout: 8000 }); }
  };

  /* ======================= the Finance page ======================= */
  const monthKey = () => { const s = st(); if (!s.month) s.month = U.firstOfMonth(U.today()); return s.month; };
  const tile = (label, value, sub, cls) => '<div class="tile' + (cls ? ' ' + cls : '') + '"><span class="tile-l">' + e(label) + '</span><span class="tile-v">' + e(value) + '</span><span class="tile-s hint">' + sub + '</span></div>';
  const bar = (v, t, over) => '<span class="st-bar fin-bar' + (over ? ' over' : '') + '"><i style="width:' + (t ? Math.min(100, Math.round(v / t * 100)) : 0) + '%"></i></span>';

  const view = {
    id: 'finance', label: 'Finance',
    left() {
      const m = monthKey();
      const [y, mo] = U.ymd(m);
      const list = FN.inMonth(m);
      const t = FN.totals(list);
      const sb = FN.spendBudget();
      const saved = t.left;
      const tiles = '<div class="tiles fin-tiles">' +
        tile('Received', M$(t.income), U.plural(list.filter(r => r.type === 'income').length, 'entry', 'entries')) +
        tile('Spent', M$(t.expense), sb ? 'budget ' + M$(sb) : 'no budget set') +
        tile(saved >= 0 ? 'Saved' : 'Overspent', M$(Math.abs(saved)), (t.saved ? M$(t.saved) + ' invested · ' : '') + (t.income ? Math.round(saved / t.income * 100) + '% of income' : '—'), saved < 0 ? 'neg' : '') +
        tile('Budget left', sb ? M$(Math.max(0, sb - t.expense)) : '—', sb ? (t.expense > sb ? 'over by ' + M$(t.expense - sb) : Math.round(t.expense / sb * 100) + '% used') : '<button type="button" class="link-btn" data-act="fin-rtab" data-tab="budget">Set a budget</button>') +
        '</div>';
      const f = st().cat || '';
      const shown = list.filter(r => !f || r.categoryId === f).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
      const byDay = new Map();
      shown.forEach(r => { if (!byDay.has(r.date)) byDay.set(r.date, []); byDay.get(r.date).push(r); });
      const rows = Array.from(byDay.entries()).map(([k, l]) => '<li class="fin-day"><div class="fin-dayh"><span>' + e(U.DAY3[U.dow(k)] + ', ' + U.fmtDM(k)) + '</span><span class="hint num">' + (v => (v < 0 ? '−' : v > 0 ? '+' : '') + M$(Math.abs(v)))(r2(l.reduce((a, r) => a + (r.type === 'income' ? r.amount : r.type === 'transfer' ? 0 : -r.amount), 0))) + '</span></div>' +
        l.map(r => {
          const c = FN.cat(r.categoryId), a = FN.account(r.accountId), to = FN.account(r.toAccountId);
          const tr = r.type === 'transfer', sv = !tr && FN.isSaving(r.categoryId);
          return '<button type="button" class="fin-rec ' + r.type + (sv ? ' saving' : '') + '" data-act="fin-rec" data-id="' + e(r.id) + '"><span class="fin-ic emo" aria-hidden="true">' + (tr ? '⇄' : e(c ? c.icon || '•' : '•')) + '</span>' +
            '<span class="fin-rt"><b>' + e(r.desc || (tr ? 'Transfer' : c ? c.name : 'Record')) + '</b><span class="hint">' + e(tr ? (a ? a.name : '?') + ' → ' + (to ? to.name : '?') : (c ? c.name : '') + (sv ? ' · put aside' : '') + (a ? ' · ' + a.name : '')) + '</span></span>' +
            '<span class="fin-amt num">' + (r.type === 'income' ? '+' : tr ? '' : '−') + e(M$(r.amount)) + '</span></button>';
        }).join('') + '</li>').join('');
      const filt = f ? '<span class="chip">' + e((FN.cat(f) || {}).name || '') + '<button type="button" data-act="fin-cat" data-id="" aria-label="Show all categories">' + ED.icon('x') + '</button></span>' : '';
      return '<div class="fin">' +
        '<div class="pg-head st-head"><div class="st-nav"><button type="button" class="cp-arrow" data-act="fin-month" data-dir="-1" aria-label="Previous month">' + ED.icon('chevL') + '</button>' +
        '<h2 class="pg-title">' + e(U.MONTHS[mo - 1] + ' ' + y) + '</h2>' +
        '<button type="button" class="cp-arrow" data-act="fin-month" data-dir="1" aria-label="Next month">' + ED.icon('chevR') + '</button></div>' +
        '<div class="fin-tools"><button type="button" class="btn small primary" data-act="fin-add">' + ED.icon('plus') + 'Add record</button>' +
        '<button type="button" class="icon-btn" data-act="fin-menu" aria-label="Finance menu" title="More">' + ED.icon('more') + '</button></div></div>' +
        '<div class="st-scroll scroll" data-keep-scroll="fin-left">' + tiles +
        '<div class="fin-listh"><h3 class="gh">Records</h3>' + filt + '</div>' +
        (rows ? '<ul class="fin-list">' + rows + '</ul>' : '<div class="empty">' + ED.icon('receipt') + '<div><b>No records for ' + e(U.MONTHS[mo - 1]) + '.</b><br>Add what you receive and spend; tick monthly bills as paid on the right.</div></div>') +
        '</div></div>';
    },
    right() {
      const tab = st().rtab || 'overview';
      const seg = '<div class="seg st-seg" role="group" aria-label="Show">' + [['overview', 'Overview'], ['budget', 'Budget'], ['bills', 'Bills'], ['goals', 'Goals'], ['assets', 'Accounts & policies']].map(x =>
        '<button type="button" data-act="fin-rtab" data-tab="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>';
      const body = view['r_' + tab] ? view['r_' + tab]() : '';
      return '<div class="fin fin-r"><div class="pg-head"><h2 class="pg-title">Planning</h2>' + seg + '</div><div class="st-scroll scroll" data-keep-scroll="fin-r-' + tab + '">' + body + '</div></div>';
    },

    r_overview() {
      const m = monthKey();
      const months = []; for (let i = 11; i >= 0; i--) months.push(U.addMonths(m, -i));
      const tot = months.map(k => FN.totals(FN.inMonth(k)));
      const groups = CH.groups({
        title: 'Received, spent and put aside · last 12 months', fmt: compact, cur: 11,
        series: [{ name: 'Received', color: 'var(--s1)' }, { name: 'Spent', color: 'var(--s2)' }, { name: 'Put aside', color: 'var(--s3)' }],
        data: months.map((k, i) => ({ label: U.MON[+k.slice(5, 7) - 1], long: U.MONTHS[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4), values: [tot[i].income, tot[i].expense, tot[i].saved], tip: 'Received ' + M$(tot[i].income) + ' · Spent ' + M$(tot[i].expense) + ' · Put aside ' + M$(tot[i].saved) })),
        legend: CH.legend([{ kind: 'g', color: 'var(--s1)', label: 'Received' }, { kind: 'g', color: 'var(--s2)', label: 'Spent' }, { kind: 'g', color: 'var(--s3)', label: 'Put aside' }]),
        table: CH.table(['Month', 'Received', 'Spent', 'Put aside', 'Saved (received − spent)'], months.map((k, i) => [U.fmtMonthYear(k), M$(tot[i].income), M$(tot[i].expense), M$(tot[i].saved), M$(tot[i].left)])),
      });
      // financial year so far (April to March)
      const fy = FN.fyStart(U.today()), fyEnd = U.addDays(U.addMonths(fy, 12), -1);
      const ft = FN.totals(F().records.filter(r => r.date >= fy && r.date <= U.today()));
      const fyCard = '<div class="fin-fy"><h3 class="gh">Financial year ' + fy.slice(0, 4) + '–' + fyEnd.slice(2, 4) + ' so far</h3><div class="fin-fy-row">' +
        '<span>Received <b class="num">' + M$(ft.income) + '</b></span><span>Spent <b class="num">' + M$(ft.expense) + '</b></span><span>Put aside <b class="num">' + M$(ft.saved) + '</b></span>' +
        '<span>Saved <b class="num ' + (ft.left < 0 ? 'fin-bad' : 'fin-ok') + '">' + M$(ft.left) + '</b>' + (ft.income ? ' <span class="hint">(' + Math.round(ft.left / ft.income * 100) + '%)</span>' : '') + '</span></div></div>';
      const cur = tot[11];
      const cats = FN.catsOf('expense').filter(c => !c.saving).map(c => ({ c, v: cur.byCat.get(c.id) || 0 })).filter(x => x.v || x.c.budget).sort((a, b) => b.v - a.v);
      const where = cats.length ? CH.meters({
        title: 'Where the money went in ' + U.MONTHS[+m.slice(5, 7) - 1],
        sub: 'Bar = spent; pale bar = budget. Red means over budget.' + (cur.saved ? ' Also put aside: <b>' + e(M$(cur.saved)) + '</b> (savings & investments).' : ''),
        rows: cats.map(x => ({ label: (x.c.icon ? x.c.icon + ' ' : '') + x.c.name, value: x.v, total: x.c.budget || null, over: true, valueLabel: M$(x.v) + (x.c.budget ? ' / ' + M$(x.c.budget) : ''), tip: x.c.budget ? (x.v > x.c.budget ? 'Over budget by ' + M$(x.v - x.c.budget) : M$(x.c.budget - x.v) + ' left') : 'No budget set' })),
        table: CH.table(['Category', 'Spent', 'Budget'], cats.map(x => [x.c.name, M$(x.v), x.c.budget ? M$(x.c.budget) : '—'])),
      }) : '';
      const rate = CH.columns({
        title: 'Share of income saved', fmt: v => Math.round(v) + '%', cur: 11, maxLabels: 12,
        data: months.map((k, i) => { const x = tot[i]; const r = x.income ? Math.max(0, Math.round(x.left / x.income * 100)) : 0; return { label: U.MON[+k.slice(5, 7) - 1], long: U.fmtMonthYear(k), value: r, tip: x.income ? (x.left < 0 ? 'Spent ' + M$(-x.left) + ' more than received' : r + '% saved (' + M$(x.left) + ', of which ' + M$(x.saved) + ' invested)') : 'No income recorded' }; }),
        sub: 'Saved = received − spent (money put into savings and investments counts as saved). Months where you spent more than you received show 0%.',
        table: CH.table(['Month', 'Saved', 'Saved %'], months.map((k, i) => [U.fmtMonthYear(k), M$(tot[i].left), tot[i].income ? Math.round(tot[i].left / tot[i].income * 100) + '%' : '—'])),
      });
      const dues = FN.dues();
      const duesHtml = '<h3 class="gh">Coming up</h3>' + (dues.length ? '<ul class="fin-dues">' + dues.map(d => {
        const days = U.diffDays(U.today(), d.date);
        const when = days < 0 ? Math.abs(days) + ' days late' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
        return '<li class="' + (days < 0 ? 'late' : days <= 3 ? 'soon' : '') + '"><span class="fin-due-d num">' + e(U.fmtDM(d.date)) + '</span><span class="grow">' + e(d.name) + '<span class="hint"> · ' + e(when) + (days < 0 ? ' ⚠' : '') + '</span></span><span class="num">' + (d.amount ? e(M$(d.amount)) : '') + '</span>' +
          (d.kind === 'purchase' ? '<button type="button" class="btn small" data-act="pu-pay" data-key="' + e(d.key) + '">Bought</button>' : d.kind === 'bill' ? '<button type="button" class="btn small" data-act="fin-billpay" data-id="' + e(d.item.id) + '">Paid</button>' : '<button type="button" class="btn small ghost" data-act="fin-remind" data-id="' + e(d.item.id) + '" title="Add a task on the due date">' + ED.icon('bell') + '</button>') + '</li>';
      }).join('') + '</ul>' : '<p class="hint">No bills or renewals due soon.</p>');
      return duesHtml + fyCard + groups + where + rate;
    },

    r_budget() {
      const m = monthKey();
      const t = FN.totals(FN.inMonth(m));
      const row = c => {
        const v = t.byCat.get(c.id) || 0, b = c.budget || 0;
        const spend = c.kind === 'expense' && !c.saving;
        return '<tr><td><span class="emo">' + e(c.icon || '•') + '</span> ' + e(c.name) + '</td><td class="num"><input class="field num fin-bin" data-cat="' + e(c.id) + '" inputmode="decimal" value="' + (b || '') + '" placeholder="0" aria-label="Monthly budget for ' + e(c.name) + '"></td><td class="num">' + M$(v) + '</td><td>' + (b ? bar(v, b, v > b && spend) + '<span class="hint num"> ' + (spend ? (v > b ? 'over ' + M$(r2(v - b)) : M$(r2(b - v)) + ' left') : Math.round(v / b * 100) + '%') + '</span>' : '') + '</td>' +
          '<td><button type="button" class="icon-btn sm" data-act="fin-cedit" data-id="' + e(c.id) + '" aria-label="Edit ' + e(c.name) + '">' + ED.icon('pencil') + '</button></td></tr>';
      };
      const spendC = FN.catsOf('expense').filter(c => !c.saving), saveC = FN.catsOf('expense').filter(c => c.saving);
      const tb = FN.spendBudget(), sb = FN.saveBudget();
      const ti = r2(FN.catsOf('income').reduce((a, c) => a + (c.budget || 0), 0));
      const head = x => '<thead><tr><th>Category</th><th class="num">' + x + '</th><th class="num">' + (x === 'Expected' ? 'Received' : x === 'Plan' ? 'Put aside' : 'Spent') + '</th><th>Progress</th><th></th></tr></thead>';
      return '<p class="hint">Set a monthly amount for each category. Spending is compared with it every month; the Overview chart turns red where you go over.</p>' +
        '<h3 class="gh">Spending</h3><table class="st-table fin-bt">' + head('Budget') + '<tbody>' + spendC.map(row).join('') +
        '<tr class="fin-total"><td>Total</td><td class="num">' + M$(tb) + '</td><td class="num">' + M$(t.expense) + '</td><td>' + (tb ? bar(t.expense, tb, t.expense > tb) : '') + '</td><td></td></tr></tbody></table>' +
        (saveC.length ? '<h3 class="gh">Saving & investing</h3><table class="st-table fin-bt">' + head('Plan') + '<tbody>' + saveC.map(row).join('') +
          '<tr class="fin-total"><td>Total</td><td class="num">' + M$(sb) + '</td><td class="num">' + M$(t.saved) + '</td><td></td><td></td></tr></tbody></table>' : '') +
        '<h3 class="gh">Income</h3><table class="st-table fin-bt">' + head('Expected') + '<tbody>' + FN.catsOf('income').map(row).join('') +
        '<tr class="fin-total"><td>Total</td><td class="num">' + M$(ti) + '</td><td class="num">' + M$(t.income) + '</td><td></td><td></td></tr></tbody></table>' +
        (ti && tb ? '<p class="fin-plan">Planned saving each month: <b>' + M$(r2(ti - tb)) + '</b> (' + Math.round((ti - tb) / ti * 100) + '% of expected income)' + (sb ? ', of which <b>' + M$(sb) + '</b> goes into savings & investments and <b>' + M$(r2(ti - tb - sb)) + '</b> stays in the bank' : '') + '.</p>' : '') +
        '<button type="button" class="btn small" data-act="fin-cnew">' + ED.icon('plus') + 'Add category</button>';
    },

    r_bills() {
      const mk = monthKey().slice(0, 7);
      const bills = F().bills.slice().sort((a, b) => (a.dueDay || 0) - (b.dueDay || 0));
      const total = bills.filter(b => b.active !== false).reduce((a, b) => a + (b.amount || 0), 0);
      const paid = bills.filter(b => b.paid && b.paid[mk]).reduce((a, b) => a + (b.amount || 0), 0);
      return '<p class="hint">Rent, EMIs, SIPs, subscriptions and other amounts that repeat every month. Tick one as paid and it is added to your records for ' + e(U.fmtMonthYear(monthKey())) + '.</p>' +
        (bills.length ? '<div class="fin-bsum">' + bar(paid, total) + '<span class="num">' + M$(paid) + ' of ' + M$(total) + ' paid this month</span></div>' +
        '<ul class="fin-bills">' + bills.map(b => {
          const on = !!(b.paid && b.paid[mk]); const c = FN.cat(b.categoryId);
          return '<li class="' + (on ? 'paid' : '') + '"><button type="button" class="stick' + (on ? ' on' : '') + '" data-act="fin-billpay" data-id="' + e(b.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Paid — click to undo' : 'Mark as paid') + '">' + ED.tasksUI.statusIcon(on ? 'done' : 'open') + '</button>' +
            '<button type="button" class="plain-btn grow fin-bn" data-act="fin-bedit" data-id="' + e(b.id) + '"><b>' + e(b.name) + '</b><span class="hint">' + e('Due on the ' + ordinal(b.dueDay || 1) + (c ? ' · ' + c.name : '')) + '</span></button><span class="num">' + M$(b.amount) + '</span></li>';
        }).join('') + '</ul>' : '<div class="empty">' + ED.icon('receipt') + '<div><b>No monthly bills yet.</b></div></div>') +
        '<button type="button" class="btn small" data-act="fin-bnew">' + ED.icon('plus') + 'Add monthly bill</button>' +
        (ED.purchases ? ED.purchases.billsHtml(monthKey()) : '');   // groceries and clothes to buy (js/purchases.js)
    },

    r_goals() {
      const today = U.today();
      const goals = F().goals;
      return '<p class="hint">Savings pots with a target and a date. The diary works out how much to put aside each month. For long-range goals with inflation and tax — a house, children’s education — use the <button type="button" class="link-btn" data-act="tab" data-tab="finplan">Financial Plan</button> tab.</p>' +
        (goals.length ? goals.map(g => {
          const left = Math.max(0, (g.target || 0) - (g.saved || 0));
          const late = g.due && g.due < today;
          const months = g.due && !late ? Math.max(1, Math.round(U.diffDays(today, g.due) / 30.44)) : null;
          const pct = g.target ? Math.min(100, Math.round((g.saved || 0) / g.target * 100)) : 0;
          return '<article class="fin-goal"><div class="fin-goal-h"><button type="button" class="plain-btn" data-act="fin-gedit" data-id="' + e(g.id) + '"><b>' + e(g.name) + '</b></button><span class="hint">' + (g.due ? 'by ' + e(U.fmtShort(g.due)) : '') + '</span></div>' +
            '<div class="fin-goal-bar">' + bar(g.saved || 0, g.target || 0) + '<span class="num">' + pct + '%</span></div>' +
            '<div class="fin-goal-f"><span class="num">' + M$(g.saved || 0) + ' of ' + M$(g.target || 0) + '</span>' +
            (left ? '<span class="hint">' + (late ? '<span class="fin-bad">Date passed</span> · ' + M$(left) + ' to go' : months ? M$(Math.ceil(left / months)) + ' a month for ' + U.plural(months, 'month') : M$(left) + ' to go') + '</span>' : '<span class="fin-ok">Reached ✓</span>') +
            '<button type="button" class="btn small" data-act="fin-gadd" data-id="' + e(g.id) + '">' + ED.icon('plus') + 'Add money</button></div></article>';
        }).join('') : '<div class="empty">' + ED.icon('piggy') + '<div><b>No savings goals yet.</b><br>An emergency fund of six months’ expenses is a good first one.</div></div>') +
        '<button type="button" class="btn small" data-act="fin-gnew">' + ED.icon('plus') + 'Add savings goal</button>';
    },

    r_assets() {
      const acc = F().accounts, hs = F().holdings.slice().sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
      const inv = hs.reduce((a, h) => a + (h.type === 'loan' ? 0 : h.amount || 0), 0), val = hs.reduce((a, h) => a + (h.type === 'loan' ? 0 : h.value || h.amount || 0), 0);
      const today = U.today();
      return '<h3 class="gh">Accounts</h3>' +
        (acc.length ? '<table class="st-table"><thead><tr><th>Account</th><th>Type</th><th class="num">Balance in diary</th></tr></thead><tbody>' + acc.map(a => '<tr><td><button type="button" class="plain-btn" data-act="fin-aedit" data-id="' + e(a.id) + '"><b>' + e(a.name) + '</b></button><div class="hint">' + e([a.institution, a.last4 ? '•••• ' + a.last4 : ''].filter(Boolean).join(' · ')) + '</div></td><td>' + e(ATYPES[a.type] || '') + '</td><td class="num">' + M$(FN.balance(a)) + '</td></tr>').join('') + '</tbody></table>' +
          '<p class="hint">Balance = opening balance + money received − money spent recorded here.</p>' : '<p class="hint">No accounts yet.</p>') +
        '<button type="button" class="btn small" data-act="fin-anew">' + ED.icon('plus') + 'Add account</button>' +
        '<h3 class="gh fin-gap">Policies & investments</h3>' +
        (hs.length ? '<div class="fin-inv"><span>Invested <b class="num">' + M$(inv) + '</b></span><span>Worth now <b class="num">' + M$(val) + '</b></span>' + (inv ? '<span class="' + (val >= inv ? 'fin-ok' : 'fin-bad') + '">' + (val >= inv ? '+' : '−') + M$(Math.abs(val - inv)) + '</span>' : '') + '</div>' +
          '<table class="st-table"><thead><tr><th>Name</th><th>Type</th><th class="num">Value</th><th>Next due</th></tr></thead><tbody>' + hs.map(h => {
            const d = h.due ? U.diffDays(today, h.due) : null;
            return '<tr><td><button type="button" class="plain-btn" data-act="fin-hedit" data-id="' + e(h.id) + '"><b>' + e(h.name) + '</b></button><div class="hint">' + e([h.institution, h.ref ? 'No. ' + h.ref : '', h.premium ? M$(h.premium) + (h.frequency ? ' ' + h.frequency : '') : ''].filter(Boolean).join(' · ')) + '</div></td><td>' + e(HTYPES[h.type] || '') + '</td><td class="num">' + M$(h.value || h.amount || 0) + '</td>' +
              '<td>' + (h.due ? '<span class="' + (d < 0 ? 'fin-bad' : d <= 30 ? 'fin-warn' : '') + '">' + e(U.fmtShort(h.due)) + (d != null && d <= 30 ? (d < 0 ? ' · overdue' : ' · ' + (d === 0 ? 'today' : 'in ' + d + ' d')) : '') + '</span> <button type="button" class="icon-btn sm" data-act="fin-remind" data-id="' + e(h.id) + '" title="Add a task on this date" aria-label="Add a reminder task">' + ED.icon('bell') + '</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<p class="hint">Insurance, FDs, PPF, mutual funds, NPS, loans — keep their numbers, values and renewal dates here.</p>') +
        '<button type="button" class="btn small" data-act="fin-hnew">' + ED.icon('plus') + 'Add policy or investment</button>';
    },

    mount(L, R) { CH.bind(L); CH.bind(R); bindBudget(R); },
    key(ev) { if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { A['fin-month']({ dataset: { dir: ev.key === 'ArrowLeft' ? -1 : 1 } }); return true; } return false; },
  };
  const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

  function bindBudget(R) {
    U.$$('.fin-bin', R).forEach(inp => {
      inp.addEventListener('change', () => {
        const c = FN.cat(inp.dataset.cat); if (!c) return;
        c.budget = amt(inp.value); delete c.sampleBudget;
        ED.store.commit();
      });
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
    });
  }

  ED.views = ED.views || {};
  ED.views.finance = view;

  /* ---------------- actions ---------------- */
  A['fin-month'] = el => { st().month = U.addMonths(monthKey(), +el.dataset.dir); ED.app.render(); };
  A['fin-rtab'] = el => { st().rtab = el.dataset.tab; ED.app.renderPage('right'); const R = document.getElementById('pg-right'); CH.bind(R); bindBudget(R); };
  A['fin-add'] = () => FN.editRecord(null);
  A['fin-rec'] = el => FN.editRecord(el.dataset.id);
  A['fin-cat'] = el => { st().cat = el.dataset.id || ''; ED.app.renderPage('left'); };
  A['fin-bnew'] = () => FN.editBill(null);
  A['fin-bedit'] = el => FN.editBill(el.dataset.id);
  A['fin-gnew'] = () => FN.editGoal(null);
  A['fin-gedit'] = el => FN.editGoal(el.dataset.id);
  A['fin-anew'] = () => FN.editAccount(null);
  A['fin-aedit'] = el => FN.editAccount(el.dataset.id);
  A['fin-hnew'] = () => FN.editHolding(null);
  A['fin-hedit'] = el => FN.editHolding(el.dataset.id);
  A['fin-cnew'] = () => FN.editCategory(null);
  A['fin-cedit'] = el => FN.editCategory(el.dataset.id);
  A['fin-billpay'] = el => {
    const b = F().bills.find(x => x.id === el.dataset.id); if (!b) return;
    const m = el.closest('.fin-dues') ? U.firstOfMonth(U.today()) : monthKey();
    const mk = m.slice(0, 7);
    b.paid = b.paid || {};
    ED.store.checkpoint('Bill');
    if (b.paid[mk]) {
      const rid = b.paid[mk]; delete b.paid[mk];
      F().records = F().records.filter(r => r.id !== rid);
      ED.store.commit(); ED.ui.undoToast(b.name + ' marked unpaid');
      return;
    }
    const day = Math.min(b.dueDay || 1, U.daysInMonth(+m.slice(0, 4), +m.slice(5, 7) - 1));
    const date = mk === U.today().slice(0, 7) && U.today() < m.slice(0, 8) + U.pad(day) ? U.today() : m.slice(0, 8) + U.pad(day);
    const r = FN.addRecord({ date, type: 'expense', amount: b.amount || 0, categoryId: b.categoryId || 'fc-other', accountId: b.accountId || null, desc: b.name, notes: 'Monthly bill', billId: b.id });
    b.paid[mk] = r.id;
    ED.store.commit(); ED.ui.undoToast(b.name + ' paid · ' + M$(b.amount || 0) + ' recorded');
  };
  A['fin-gadd'] = async el => {
    const g = F().goals.find(x => x.id === el.dataset.id); if (!g) return;
    const v = await ED.ui.prompt({ title: 'Add to “' + g.name + '”', label: 'Amount put aside (' + FN.symbol() + ')', type: 'text', ok: 'Add', hint: 'It is also recorded as spending under Savings & investments, so your monthly totals stay right.' });
    const a = amt(v); if (!(a > 0)) return;
    ED.store.checkpoint('Savings');
    g.saved = (g.saved || 0) + a; delete g.sample;
    FN.addRecord({ date: U.today(), type: 'expense', amount: a, categoryId: FN.cat('fc-invest') ? 'fc-invest' : 'fc-other', desc: 'Saved for ' + g.name, notes: '' });
    ED.store.commit(); ED.ui.undoToast(M$(a) + ' added to ' + g.name);
  };
  A['fin-remind'] = el => {
    const h = F().holdings.find(x => x.id === el.dataset.id); if (!h || !h.due) return;
    const date = h.due < U.today() ? U.today() : h.due;
    const t = ED.model.addTask({ title: (h.type === 'insurance' ? 'Renew ' : 'Due: ') + h.name + (h.premium ? ' (' + M$(h.premium) + ')' : ''), prio: 'A', date, categoryId: (D().categories.find(c => /financ/i.test(c.name)) || {}).id || null, notes: h.institution ? '<p>' + e(h.institution) + (h.ref ? ' · ' + e(h.ref) : '') + '</p>' : '' });
    ED.store.commit();
    ED.ui.toast('Task added on ' + U.fmtShort(date), { action: 'Open', onAction: () => ED.editors.task({ id: t.id, k: t.date }) });
  };
  A['fin-menu'] = el => ED.ui.menu(el, [
    { label: 'Import records (bank statement .csv / .xlsx)…', icon: 'upload', onClick: () => FN.importFile() },
    { label: 'Export all records (.csv for Excel)', icon: 'download', onClick: () => FN.exportCSV() },
    { sep: true },
    { label: 'Currency: ' + (S().currency || 'INR') + '…', icon: 'wallet', onClick: async () => {
      const v = await ED.ui.prompt({ title: 'Currency', label: 'Three-letter currency code', value: S().currency || 'INR', hint: 'For example INR, USD, EUR, GBP, AED.' });
      if (!v) return; const c = v.trim().toUpperCase();
      try { new Intl.NumberFormat('en', { style: 'currency', currency: c }); } catch (err) { ED.ui.toast('Unknown currency code'); return; }
      S().currency = c; fmtCache = {}; ED.store.commit();
    } },
    { label: 'Filter by category…', icon: 'list', onClick: () => {
      ED.ui.menu(el, [{ label: 'All categories', onClick: () => A['fin-cat']({ dataset: { id: '' } }) }].concat(F().cats.map(c => ({ label: (c.icon ? c.icon + ' ' : '') + c.name, onClick: () => A['fin-cat']({ dataset: { id: c.id } }) }))), { placement: 'right-align' });
    } },
  ], { placement: 'right-align' });
})();
