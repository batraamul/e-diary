/* E-Diary — SIPs and money committed to goals (added in 1.19; Money → Accounts & policies and Money → Goals).
   SIP:     every month on a chosen day, an amount moves from a bank account into a policy or investment. On (or after)
            that day the diary records it as a Transfer (fixed id fr-sip-<sip>-<YYYY-MM>, so two devices never record it
            twice): the account's balance goes down and the investment's invested amount and value go up (js/finance.js
            hInvested / hValue). Deleting an instalment skips that month; stopping the SIP stops the next ones.
   Commit:  all, an amount or a share (%) of an account or an investment is set aside for a goal — a savings goal (Money →
            Goals) or a Financial Plan goal — by a date. The goal shows it next to what is saved. A reminder "withdraw
            ₹… from … and move it to …" can go into the daily tasks (tk-gc-<id>, on the date or some days before) and/or
            the calendar, as you choose; ticking the task marks it done, and "Record the transfer" moves the money.
   Data: finance.sips = [{ id, name, accountId, holdingId, amount, day, start, end, off, skip: { 'YYYY-MM': 1 } }]
         finance.commits = [{ id, goal: 'm:<id>' | 'p:<id>', src: 'a:<account>' | 'h:<holding>', mode: 'full' | 'amount' |
                              'pct', value, by, to, remind: '' | 'task' | 'cal' | 'both', days, done, doneOn, eventId }] */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const A = (ED.actions = ED.actions || {});
  const D = () => ED.store.data;
  const FN = () => ED.finance;
  const FX = () => ED.fx;
  const F = () => { const f = D().finance; if (!Array.isArray(f.sips)) f.sips = []; if (!Array.isArray(f.commits)) f.commits = []; return f; };
  const FL = (ED.finLinks = {});
  const r2 = v => Math.round(v * 100) / 100;
  const M$ = v => FN().money(v);
  const ym = k => k.slice(0, 7);
  const dayIn = (y, m, d) => y + '-' + U.pad(m) + '-' + U.pad(Math.min(d, U.daysInMonth(y, m - 1)));
  const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

  /* ---------------- SIPs ---------------- */
  FL.sipDates = (s, upto) => {
    const out = []; if (!U.isKey(s.start) || !(+s.amount > 0)) return out;
    let [y, m] = U.ymd(s.start);
    for (let i = 0; i < 600; i++) {
      const k = dayIn(y, m, +s.day || 1);
      if (k > upto || (s.end && k > s.end)) break;
      if (k >= s.start) out.push(k);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  };
  FL.sipNext = s => { if (s.off) return null; const far = U.addDays(U.today(), 400); return FL.sipDates(s, far).find(k => k > U.today()) || null; };
  const RID = (s, k) => 'fr-sip-' + s.id + '-' + ym(k);

  /* ---------------- commitments ---------------- */
  FL.goals = () => {
    const out = (F().goals || []).map(g => ({ ref: 'm:' + g.id, name: g.name, kind: 'Savings goal', due: g.due, target: g.target }));
    ((F().plan && F().plan.goals) || []).forEach(g => out.push({ ref: 'p:' + g.id, name: g.name, kind: 'Financial Plan', due: g.year ? g.year + '-12-31' : '', target: g.cost }));
    return out;
  };
  FL.goal = ref => FL.goals().find(g => g.ref === ref) || null;
  FL.srcName = src => { const [k, id] = String(src || '').split(':'); if (k === 'h') { const h = FN().holding(id); return h ? h.name : '(deleted investment)'; } const a = FN().account(id); return a ? a.name : '(deleted account)'; };
  FL.srcValue = src => { const [k, id] = String(src || '').split(':'); if (k === 'h') { const h = FN().holding(id); return h ? FN().hValue(h) : 0; } const a = FN().account(id); return a ? FN().balance(a) : 0; };
  FL.amount = c => { const v = Math.max(0, FL.srcValue(c.src)); return r2(c.mode === 'full' ? v : c.mode === 'pct' ? v * Math.min(100, +c.value || 0) / 100 : Math.min(v, +c.value || 0)); };
  FL.forGoal = ref => F().commits.filter(c => c.goal === ref);
  FL.committed = ref => r2(FL.forGoal(ref).filter(c => !c.done).reduce((a, c) => a + FL.amount(c), 0));
  /* 1.19.1: money already moved for the goal (commitments marked Done) */
  FL.moved = ref => r2(FL.forGoal(ref).filter(c => c.done).reduce((a, c) => a + (+c.movedAmount || 0), 0));
  FL.forSrc = src => F().commits.filter(c => c.src === src && !c.done);
  const toName = c => !c.to ? '' : /^h:/.test(c.to) ? FL.srcName(c.to) : (FN().account(c.to) ? FN().account(c.to).name : c.to);
  const howMuch = c => c.mode === 'full' ? 'all of it (' + M$(FL.amount(c)) + ' now)' : c.mode === 'pct' ? (+c.value || 0) + '% (' + M$(FL.amount(c)) + ' now)' : M$(+c.value || 0);
  const remindDate = c => U.isKey(c.by) ? U.addDays(c.by, -Math.max(0, Math.round(+c.days || 0))) : null;
  const ttl = c => { const g = FL.goal(c.goal); return '💰 Withdraw ' + (c.mode === 'amount' ? M$(+c.value || 0) : c.mode === 'pct' ? (+c.value || 0) + '%' : 'all') + ' from ' + FL.srcName(c.src) + (c.to ? ' → ' + toName(c) : '') + ' for “' + (g ? g.name : 'goal') + '”'; };
  const evSpec = c => ({ on: (c.remind === 'cal' || c.remind === 'both') && !!remindDate(c) && !c.done, title: ttl(c), date: remindDate(c), time: null, notes: 'Goal: ' + ((FL.goal(c.goal) || {}).name || '') + '\nHow much: ' + howMuch(c) + '\nFrom: ' + FL.srcName(c.src) + (c.to ? '\nTo: ' + toName(c) : '') + (c.by ? '\nBy: ' + U.fmtShort(c.by) : ''), color: '#16a34a' });
  FL.calSync = c => { if (FX() && FX().linkEvent) FX().linkEvent(c, evSpec(c)); };

  /* ---------------- keeping records, tasks and the calendar in step ---------------- */
  let busy = false;
  FL.reconcile = () => {
    const d = D(); if (busy || !d || !d.finance || !Array.isArray(d.tasks)) return false;
    busy = true; let ch = false;
    try {
      const f = F(), today = U.today();
      // SIP instalments due up to today
      f.sips.forEach(s => {
        if (s.off || !s.accountId || !s.holdingId) return;
        if (!s.skip || typeof s.skip !== 'object') s.skip = {};
        FL.sipDates(s, today).forEach(k => {
          const id = RID(s, k); if (s.skip[ym(k)] || f.records.some(r => r.id === id)) return;
          const h = FN().holding(s.holdingId);
          FN().addRecord({ id, type: 'transfer', amount: +s.amount, date: k, accountId: s.accountId, toAccountId: null, fromHoldingId: null, toHoldingId: s.holdingId, categoryId: null, desc: 'SIP: ' + (s.name || (h ? h.name : 'investment')), notes: 'Monthly SIP on the ' + ord(+s.day || 1), sipId: s.id, createdAt: Date.parse(k + 'T09:00:00') || Date.now() });
          ch = true;
        });
      });
      if (FL.syncMoves()) ch = true;
      // goal withdrawal reminders as tasks
      const live = new Set();
      f.commits.forEach(c => {
        const k = remindDate(c);
        if (!k || !(c.remind === 'task' || c.remind === 'both')) return;
        const id = 'tk-gc-' + c.id; live.add(id);
        const title = ttl(c), notes = '<p>Goal: <b>' + e((FL.goal(c.goal) || {}).name || '') + '</b></p><p>How much: ' + e(howMuch(c)) + '</p><p>From: ' + e(FL.srcName(c.src)) + (c.to ? ' → ' + e(toName(c)) : '') + '</p>' + (c.by ? '<p>Must be done by ' + e(U.fmtShort(c.by)) + '</p>' : '');
        let t = d.tasks.find(x => x.id === id);
        if (!t) {
          t = M.newTask({ id, title, date: k, prio: 'A', link: { k: 'gcommit', id: c.id }, linkTitle: title, linkDate: k, linkSt: c.done ? 'done' : 'open', notes, categoryId: (d.categories.find(x => /financ|money/i.test(x.name || '')) || {}).id || null });
          t.num = M.nextNum(t.prio, t.date); if (c.done) M.setStatus(t, k, 'done');
          d.tasks.push(t); ch = true; return;
        }
        if (t.date !== t.linkDate && U.isKey(t.date)) { c.by = U.addDays(t.date, Math.max(0, Math.round(+c.days || 0))); t.linkDate = t.date; FL.calSync(c); ch = true; }
        else if (t.date !== k) { t.date = k; t.linkDate = k; ch = true; }
        if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
        const tDone = M.isClosed(t.status);
        if (tDone !== (t.linkSt === 'done')) { c.done = tDone; c.doneOn = tDone ? today : null; t.linkSt = tDone ? 'done' : 'open'; FL.calSync(c); ch = true; }
        else if (tDone !== !!c.done) { M.setStatus(t, t.date, c.done ? 'done' : 'open'); t.linkSt = c.done ? 'done' : 'open'; ch = true; }
      });
      if (FL.syncMoves()) ch = true;                 // a reminder ticked just now: record the move at once
      const ids = new Set(f.commits.map(c => c.id)), before = d.tasks.length;
      d.tasks = d.tasks.filter(t => !t.link || t.link.k !== 'gcommit' || live.has(t.id) || (ids.has(t.link.id) && M.isClosed(t.status)));
      if (d.tasks.length !== before) ch = true;
    } catch (err) { console.warn('[e-diary] finance links', err); }
    finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => { if (type !== 'change' || (detail && detail.reason === 'finlinks')) return; if (FL.reconcile()) ED.store.commit({ reason: 'finlinks' }); });
  setTimeout(() => { if (FL.reconcile()) ED.store.commit({ reason: 'finlinks' }); }, 0);
  let lastDay = U.today();
  setInterval(() => { const k = U.today(); if (k !== lastDay) { lastDay = k; if (FL.reconcile()) ED.store.commit({ reason: 'finlinks' }); } }, 60e3);
  // a deleted SIP instalment is a skipped month (it is not made again)
  FL.recordDeleted = r => { if (!r || !r.sipId) return; const s = F().sips.find(x => x.id === r.sipId); if (s) { s.skip = s.skip || {}; s.skip[ym(r.date)] = 1; s.updatedAt = Date.now(); } };
  const del0 = M.deleteTask;
  M.deleteTask = id => { const t = M.task(id); if (t && t.link && t.link.k === 'gcommit') { const c = F().commits.find(x => x.id === t.link.id); if (c) { c.remind = c.remind === 'both' ? 'cal' : ''; c.updatedAt = Date.now(); } } return del0(id); };
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    if (o && o.t.link && o.t.link.k === 'gcommit' && F().commits.some(c => c.id === o.t.link.id)) { FL.editCommit(o.t.link.id); return; }
    return open0 && open0(el, ev);
  };

  /* ---------------- upcoming (Money → Overview → Coming up) ---------------- */
  FL.dues = () => {
    const today = U.today(), lim = U.addDays(today, 45), out = [];
    F().sips.forEach(s => { const k = FL.sipNext(s); if (k && k <= lim) out.push({ kind: 'sip', item: s, date: k, amount: +s.amount, name: 'SIP → ' + FL.srcName('h:' + s.holdingId) }); });
    F().commits.forEach(c => { const k = remindDate(c); if (k && !c.done && k <= lim && k >= U.addDays(today, -30)) out.push({ kind: 'commit', item: c, date: k, amount: FL.amount(c), name: 'Withdraw for ' + ((FL.goal(c.goal) || {}).name || 'goal') + ' from ' + FL.srcName(c.src) }); });
    return out;
  };

  /* ---------------- editors ---------------- */
  const accOpts = () => F().accounts.map(a => [a.id, a.name]);
  const holdOpts = () => F().holdings.filter(h => h.type !== 'loan').map(h => [h.id, h.name + (h.ref ? ' · ' + h.ref : '')]);
  FL.editSip = (id, pre) => {
    const s = id ? F().sips.find(x => x.id === id) : null;
    if (!F().accounts.length || !F().holdings.length) { ED.ui.toast('Add a bank account and the investment (e.g. the mutual fund) first'); return; }
    FX().form({
      title: s ? 'SIP' : 'New SIP',
      intro: 'Every month on this day the amount moves from the account into the investment — recorded by itself on that day (or the next time the diary is opened). The account’s balance goes down and the investment’s value goes up.',
      data: s ? Object.assign({}, s) : Object.assign({ name: '', accountId: (F().accounts[0] || {}).id, holdingId: (F().holdings[0] || {}).id, amount: null, day: Math.min(28, +U.today().slice(8)), start: U.today(), end: '' }, pre || {}),
      fields: [
        { k: 'holdingId', label: 'Into (investment)', type: 'select', options: holdOpts },
        { k: 'accountId', label: 'From account', type: 'select', options: accOpts },
        { k: 'amount', label: 'Amount each month (₹)', type: 'number', min: 1, req: true },
        { k: 'day', label: 'Day of the month', type: 'number', min: 1, max: 31, req: true, hint: 'A day the month does not have (31 in April) becomes its last day.' },
        { k: 'start', label: 'First instalment from', type: 'date', req: true, hint: 'Instalments from this date up to today are recorded at once.' },
        { k: 'end', label: 'Last instalment by (optional)', type: 'date' },
        { k: 'name', label: 'Name (optional)', ph: 'e.g. Parag Parikh Flexi Cap SIP' },
      ],
      check: v => !(v.amount > 0) ? 'Enter the amount' : v.end && v.end < v.start ? 'The end is before the start' : !v.holdingId || !v.accountId ? 'Choose the account and the investment' : '',
      extra: s ? '<button type="button" class="btn" data-x="stop">' + (s.off ? 'Start again' : 'Stop the SIP') + '</button>' : '',
      mount(el, api) {
        const b = el.querySelector('[data-x="stop"]');
        if (b) b.addEventListener('click', () => { ED.store.checkpoint('SIP'); s.off = !s.off; if (s.off && !s.end) s.end = U.today(); else if (!s.off && s.end && s.end <= U.today()) s.end = ''; s.updatedAt = Date.now(); ED.store.commit(); api.close(); ED.ui.toast(s.off ? 'SIP stopped — no more instalments' : 'SIP started again'); });
      },
      del: s ? async () => {
        const n = F().records.filter(r => r.sipId === s.id).length;
        const ch = n ? await ED.ui.confirm({ title: 'Delete the SIP?', message: U.plural(n, 'instalment') + ' already recorded. Keep them (the money did move) or delete them too?', choices: [{ id: 'keep', label: 'Keep the instalments', primary: false }, { id: 'all', label: 'Delete them too', danger: true }] }) : 'keep';
        if (!ch) return false;
        ED.store.checkpoint('Delete SIP');
        F().sips = F().sips.filter(x => x.id !== s.id);
        if (ch === 'all') F().records = F().records.filter(r => r.sipId !== s.id); else F().records.forEach(r => { if (r.sipId === s.id) delete r.sipId; });
        ED.store.commit(); ED.ui.undoToast('SIP deleted');
      } : null,
      save(v, api) {
        ED.store.checkpoint('SIP');
        v.amount = +v.amount; v.day = Math.max(1, Math.min(31, Math.round(+v.day || 1)));
        if (s) Object.assign(s, v, { updatedAt: Date.now() }); else F().sips.push(Object.assign({ id: U.uid('sip'), skip: {}, createdAt: Date.now(), updatedAt: Date.now() }, v));
        ED.store.commit(); api.close();
        const n = F().records.filter(r => r.sipId === (s || F().sips[F().sips.length - 1]).id).length;
        ED.ui.toast('SIP saved' + (n ? ' — ' + U.plural(n, 'instalment') + ' recorded so far' : ' — the first instalment is recorded on its day'));
      },
    });
  };
  FL.editCommit = (id, pre) => {
    const c = id ? F().commits.find(x => x.id === id) : null;
    const goals = FL.goals();
    if (!goals.length) { ED.ui.toast('Make a goal first (Money → Goals, or the Financial Plan)'); return; }
    const srcs = F().accounts.map(a => ['a:' + a.id, '🏦 ' + a.name + ' — ' + M$(FN().balance(a))]).concat(F().holdings.filter(h => h.type !== 'loan' && h.type !== 'insurance').map(h => ['h:' + h.id, '📈 ' + h.name + ' — ' + M$(FN().hValue(h))]));
    FX().form({
      title: c ? 'Money for a goal' : 'Commit money to a goal', wide: true,
      intro: 'Set aside all, an amount or a share of an account or investment for a goal, and the date by which it has to be taken out and moved. The goal counts it; a reminder can tell you when to withdraw, how much, from where and to where.',
      data: c ? Object.assign({}, c, { value: c.value }) : Object.assign({ goal: goals[0].ref, src: (srcs[0] || [])[0], mode: 'amount', value: null, by: goals[0].due || '', to: (F().accounts[0] || {}).id || '', remind: 'both', days: 7, notes: '' }, pre || {}),
      fields: [
        { k: 'goal', label: 'Goal', type: 'select', options: goals.map(g => [g.ref, g.name + ' (' + g.kind + ')']) },
        { k: 'src', label: 'From (account or investment)', type: 'select', options: srcs },
        { k: 'mode', label: 'How much', type: 'select', options: [['amount', 'An amount'], ['pct', 'A share (%)'], ['full', 'All of it']] },
        { k: 'value', label: 'Amount (₹) or share (%)', type: 'number', min: 0, hint: 'Not needed for “All of it”.' },
        { k: 'by', label: 'Withdraw by', type: 'date', hint: 'The date by which the money has to come out of it for the goal.' },
        { k: 'to', label: 'Move it to', type: 'select', options: () => [['', '— (say in the notes) —']].concat(accOpts(), F().holdings.filter(h => h.type !== 'loan').map(h => ['h:' + h.id, '📈 ' + h.name])) },
        { k: 'remind', label: 'Remind me', type: 'select', options: [['both', 'In my daily tasks and calendar'], ['task', 'In my daily tasks'], ['cal', 'In my calendar'], ['', 'No reminder']] },
        { k: 'days', label: 'Days before the date', type: 'number', min: 0, max: 365, hint: '0 = on the date itself.' },
        { k: 'done', label: 'Done — the money has been moved (it is recorded in Money as a transfer)', type: 'check' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      check: v => v.mode !== 'full' && !(v.value > 0) ? 'Enter the amount or the share' : v.mode === 'pct' && v.value > 100 ? 'A share cannot be over 100%' : v.remind && !v.by ? 'Give the “Withdraw by” date for a reminder' : '',
      del: c ? async () => { ED.store.checkpoint('Delete'); FX().dropEvent(c); F().commits = F().commits.filter(x => x.id !== c.id); ED.store.commit(); ED.ui.undoToast('Removed'); } : null,
      extra: c && c.done && F().records.some(r => r.id === GID(c)) ? '<button type="button" class="btn" data-x="rec">' + ED.icon('receipt') + 'See the record</button>' : '',
      mount(el, api) { const b = el.querySelector('[data-x="rec"]'); if (b) b.addEventListener('click', () => { api.close(); FN().editRecord(GID(c)); }); },
      save(v, api) {
        ED.store.checkpoint('Goal money');
        v.days = Math.max(0, Math.round(+v.days || 0)); v.doneOn = v.done ? ((c && c.doneOn) || U.today()) : null;
        const x = c || { id: U.uid('gc'), createdAt: Date.now() };
        Object.assign(x, v, { updatedAt: Date.now() }); if (!c) F().commits.push(x);
        FL.calSync(x);
        ED.store.commit(); api.close();
        ED.ui.toast(M$(FL.amount(x)) + ' committed to “' + ((FL.goal(x.goal) || {}).name || '') + '”' + (x.remind ? ' — reminder on ' + U.fmtShort(remindDate(x)) : ''));
      },
    });
  };
  /* marking a commitment Done records the move: a transfer from the account / investment to "Move it to" (fixed id
     fr-gc-<id>), dated the day it was marked done, for the amount at that moment (kept in movedAmount). Unticking Done
     takes the record out again. Deleting the record yourself keeps it out (recOff); an edited record is left as it is. */
  const GID = c => 'fr-gc-' + c.id;
  FL.syncMoves = () => {
    const f = F(); let ch = false;
    f.commits.forEach(c => {
      const id = GID(c), r = f.records.find(x => x.id === id);
      if (c.done) {
        if (r) { if (!r.fixed && c.mode === 'amount' && +r.amount !== +c.value && +c.value > 0) { r.amount = +c.value; c.movedAmount = +c.value; r.updatedAt = Date.now(); ch = true; } return; }
        if (c.recMade) { if (!c.recOff) { c.recOff = true; ch = true; } return; }       // you deleted it in Money: leave it out
        const amt = +c.movedAmount || FL.amount(c); if (!(amt > 0)) return;
        const [k, sid] = String(c.src).split(':'), toH = /^h:/.test(c.to || '') ? c.to.slice(2) : null;
        FN().addRecord({ id, type: 'transfer', amount: amt, date: U.isKey(c.doneOn) ? c.doneOn : U.today(), accountId: k === 'a' ? sid : null, fromHoldingId: k === 'h' ? sid : null, toAccountId: c.to && !toH ? c.to : null, toHoldingId: toH, categoryId: null, desc: 'For goal: ' + ((FL.goal(c.goal) || {}).name || ''), notes: 'Moved for the goal (marked done in Money → Goals)', commitId: c.id });
        c.movedAmount = amt; c.recMade = true; ch = true;
      } else {
        if (r && !r.fixed) { f.records = f.records.filter(x => x !== r); ch = true; }
        if (c.recMade || c.recOff || c.movedAmount) { delete c.recMade; delete c.recOff; delete c.movedAmount; ch = true; }
      }
    });
    return ch;
  };
  FL.moveNow = id => { const c = F().commits.find(x => x.id === id); if (!c) return; ED.store.checkpoint('Money moved'); c.done = true; c.doneOn = U.today(); FL.calSync(c); ED.store.commit(); };

  /* ---------------- pieces of the Money pages ---------------- */
  FL.sipsHtml = () => {
    const l = F().sips;
    return '<h3 class="gh fin-gap">SIPs <span class="hint num">· ' + l.filter(s => !s.off).length + ' running</span></h3>' +
      (l.length ? '<table class="st-table"><thead><tr><th>SIP</th><th>From</th><th class="num">Each month</th><th>Next</th><th class="num">Paid so far</th></tr></thead><tbody>' + l.map(s => {
        const n = FL.sipNext(s), paid = r2(F().records.filter(r => r.sipId === s.id).reduce((a, r) => a + (+r.amount || 0), 0));
        return '<tr class="' + (s.off ? 'dim' : '') + '"><td><button type="button" class="plain-btn" data-act="fl-sip" data-id="' + e(s.id) + '"><b>' + e(s.name || FL.srcName('h:' + s.holdingId)) + '</b></button><div class="hint">into ' + e(FL.srcName('h:' + s.holdingId)) + ' · on the ' + ord(+s.day || 1) + (s.end ? ' · until ' + e(U.fmtShort(s.end)) : '') + '</div></td><td>' + e(FL.srcName('a:' + s.accountId)) + '</td><td class="num">' + M$(+s.amount) + '</td><td>' + (s.off ? '<span class="hint">stopped</span>' : n ? e(U.fmtShort(n)) : '—') + '</td><td class="num">' + M$(paid) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">A SIP moves a fixed amount from a bank account into a mutual fund (or any investment) every month on its day — recorded by itself.</p>') +
      '<button type="button" class="btn small" data-act="fl-sip">' + ED.icon('plus') + 'Add SIP</button>';
  };
  /* under an account or investment: what is committed to goals */
  FL.srcNote = src => { const l = FL.forSrc(src); return l.length ? '<div class="hint fl-cn">🎯 ' + l.map(c => e(M$(FL.amount(c))) + ' for ' + e((FL.goal(c.goal) || {}).name || 'goal') + (c.by ? ' by ' + e(U.fmtDM(c.by)) : '')).join(' · ') + '</div>' : ''; };
  /* in a goal card: the money committed to it */
  FL.goalHtml = ref => {
    const l = FL.forGoal(ref);
    return '<div class="fl-goal">' + (l.length ? '<ul class="fl-cl">' + l.map(c => '<li class="' + (c.done ? 'done' : '') + '"><button type="button" class="plain-btn grow" data-act="fl-commit" data-id="' + e(c.id) + '"><b>' + e(M$(c.done ? +c.movedAmount || FL.amount(c) : FL.amount(c))) + '</b> from ' + e(FL.srcName(c.src)) + ' <span class="hint">' + e(c.mode === 'full' ? 'all of it' : c.mode === 'pct' ? (+c.value || 0) + '%' : 'fixed amount') + (c.by ? ' · withdraw by ' + U.fmtShort(c.by) : '') + (c.to ? ' → ' + toName(c) : '') + (c.done ? ' · moved ✓ ' + (c.doneOn ? U.fmtDM(c.doneOn) : '') + ' — in Records' : '') + (c.remind && !c.done ? ' · 🔔 ' + U.fmtDM(remindDate(c)) : '') + '</span></button></li>').join('') + '</ul>' : '') +
      '<button type="button" class="btn small ghost" data-act="fl-commit" data-goal="' + e(ref) + '">' + ED.icon('plus') + 'Commit money from an account or investment</button></div>';
  };
  /* Financial Plan goals have no card here: list their commitments together */
  FL.planGoalsHtml = () => {
    const pg = FL.goals().filter(g => g.ref[0] === 'p' && FL.forGoal(g.ref).length);
    return pg.length ? '<h3 class="gh fin-gap">Financial Plan goals — money committed</h3>' + pg.map(g => '<article class="fin-goal"><div class="fin-goal-h"><b>' + e(g.name) + '</b><span class="hint">' + (g.target ? 'cost ' + M$(g.target) : '') + ' · committed ' + M$(FL.committed(g.ref)) + '</span></div>' + FL.goalHtml(g.ref) + '</article>').join('') : '';
  };

  A['fl-sip'] = el => FL.editSip(el.dataset.id || null, el.dataset.h ? { holdingId: el.dataset.h } : null);
  A['fl-commit'] = el => FL.editCommit(el.dataset.id || null, el.dataset.goal ? { goal: el.dataset.goal } : el.dataset.src ? { src: el.dataset.src } : null);
})();
