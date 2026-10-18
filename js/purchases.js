/* E-Diary — purchases from the Grocery list and the Wardrobe "To buy" list (added in 1.14).
   • Finance → Bills shows them under "Planned purchases". They are worked out from the lists each time, so nothing is
     typed twice and nothing can get out of step: change a price on the list and the bill changes; delete the list and
     the bill is gone. Ticking one as paid marks the groceries / clothes as bought, and the spending is added to the
     Money records (Groceries, or Shopping & clothes).
   • Every grocery list with items gets one task on its shopping date — "Groceries — 17 Oct 2026" — on the daily page.
     Clicking it opens the list. Ticking it done marks the list as bought (and the bill as paid); unticking undoes that.
     Deleting the task takes the list out of the planner and out of Bills (the list stays; "Add it back" on the
     Grocery page). Moving the task to another day moves the shopping date, and the other way round.
   Fixed ids (tk-groc-<list>, fr-pu-groc-<list>, fr-pu-ward-<item>) mean two devices that sync never make two copies. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const D = () => ED.store.data;
  const S = () => ED.store.data.settings;
  const A = (ED.actions = ED.actions || {}), CH = (ED.changes = ED.changes || {});
  const PU = (ED.purchases = {});
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const r2 = v => Math.round(v * 100) / 100;
  const groc = () => (D().lists && Array.isArray(D().lists.groc)) ? D().lists.groc : [];
  const wish = () => (D().wardrobe && Array.isArray(D().wardrobe.wish)) ? D().wardrobe.wish : [];
  const TID = id => 'tk-groc-' + id;
  const RID = (k, id) => 'fr-pu-' + k + '-' + id;
  PU.on = () => S().purchases !== false;              // show them in Bills and put the grocery task in the planner
  const recOn = () => S().purchaseRecords !== false;  // add bought purchases to Money records
  const money = v => ED.finance ? ED.finance.money(v) : '₹' + Math.round(v).toLocaleString('en-IN');

  /* "Groceries — 17 Oct 2026" (a list called "Monthly ration" becomes "Monthly ration — 17 Oct 2026") */
  PU.title = g => {
    const base = String(g.name || '').replace(/\s+[—–-]\s+\d{1,2}\s+[A-Za-z]{3}(\s+\d{4})?\s*$/, '').trim() || 'Groceries';
    return base + ' — ' + U.fmtShort(g.date || U.today());
  };
  const items = g => Array.isArray(g.items) ? g.items : [];
  const gTotal = g => r2(items(g).reduce((a, i) => a + num(i.price), 0));
  const gDone = g => items(g).length > 0 && items(g).every(i => i.done);
  const catId = kind => {
    const F = D().finance, want = kind === 'groc' ? 'fc-grocery' : 'fc-shop';
    if (F && F.cats.some(c => c.id === want)) return want;
    return (ED.finance && ED.finance.guess(kind === 'groc' ? 'groceries' : 'clothes shopping', 'expense')) || 'fc-other';
  };

  /* everything planned, as bill rows */
  PU.items = () => {
    if (!PU.on()) return [];
    const out = [];
    groc().forEach(g => {
      if (g.noPlan || !items(g).length) return;
      const done = gDone(g), left = items(g).filter(i => !i.done).length;
      out.push({ key: 'groc:' + g.id, kind: 'groc', id: g.id, name: PU.title(g), amount: gTotal(g), date: g.date || null,
        paid: done, paidOn: done ? (g.boughtOn || g.date || U.today()) : null, paidAmount: done ? gTotal(g) : 0,
        sub: done ? 'all bought' : U.plural(left, 'item') + ' to buy' + (gTotal(g) ? '' : ' · add prices on the list for the amount'), src: 'Grocery' });
    });
    wish().forEach(x => {
      if (x.noBill) return;
      out.push({ key: 'ward:' + x.id, kind: 'ward', id: x.id, name: 'Wardrobe: ' + x.name, amount: num(x.cost), date: x.by || null,
        paid: !!x.done, paidOn: x.done ? (x.doneOn || null) : null, paidAmount: x.done ? (num(x.paid) || num(x.cost)) : 0,
        sub: [x.type, x.prio === 'need' ? 'must have' : 'nice to have', x.where].filter(Boolean).join(' · '), src: 'Wardrobe' });
    });
    return out;
  };
  const find = key => PU.items().find(x => x.key === key) || null;

  /* unpaid purchases with a date, for Finance → Overview → Coming up */
  PU.dues = () => {
    const today = U.today(), lim = U.addDays(today, 45);
    return PU.items().filter(x => !x.paid && x.date && x.date <= lim).map(x => ({ kind: 'purchase', key: x.key, date: x.date, amount: x.amount, name: x.name }));
  };

  /* ---------------- keeping the grocery task and the Money records in step ---------------- */
  let busy = false, quiet = false;
  PU.reconcile = () => {
    if (busy || !D()) return false;
    busy = true; let ch = false;
    try {
      const d = D(), today = U.today();
      const live = new Set();
      groc().forEach(g => {
        if (!g || !Array.isArray(g.items)) return;
        const done = gDone(g);
        if (done && !g.boughtOn) { g.boughtOn = today; ch = true; }
        else if (!done && g.boughtOn) { delete g.boughtOn; ch = true; }
        const id = TID(g.id);
        let t = d.tasks.find(x => x.id === id);
        if (!PU.on() || g.noPlan || !g.items.length) return;     // no task (an old one is tidied below)
        live.add(id);
        if (!U.isKey(g.date)) { g.date = today; ch = true; }
        const title = PU.title(g);
        if (!t) {
          t = M.newTask({ id, title, date: g.date, prio: S().defaultPrio || 'B', link: { k: 'groc', id: g.id }, linkTitle: title, linkDate: g.date, linkSt: done ? 'done' : 'open',
            categoryId: (d.categories.find(c => /grocer|shop|house|home/i.test(c.name)) || {}).id || null });
          t.num = M.nextNum(t.prio, t.date);
          if (done) M.setStatus(t, t.date, 'done');
          if (g.sample) t.sample = true;
          d.tasks.push(t); ch = true;
          return;
        }
        if (!t.link) { t.link = { k: 'groc', id: g.id }; ch = true; }
        // the shopping date: moved in the planner → the list follows; changed on the list → the task follows
        if (t.date && t.date !== t.linkDate) { if (g.date !== t.date) { g.date = t.date; ch = true; } }
        else if (t.date !== g.date) { t.date = g.date; ch = true; }
        if (t.linkDate !== t.date) { t.linkDate = t.date; ch = true; }
        // the name follows the list unless you renamed the task yourself
        const nt = PU.title(g);
        if (t.linkTitle !== nt) { if (!t.title || t.title === t.linkTitle) t.title = nt; t.linkTitle = nt; ch = true; }
        // done / not done: ticking the task marks the list; ticking the last item marks the task
        const tDone = M.isClosed(t.status);
        if (t.linkSt != null && tDone !== (t.linkSt === 'done')) {
          g.items.forEach(i => { i.done = tDone; });
          g.updatedAt = Date.now();
          if (tDone) g.boughtOn = today; else delete g.boughtOn;
          ch = true;
        } else if (gDone(g) !== tDone) { M.setStatus(t, t.date, gDone(g) ? 'done' : 'open'); ch = true; }
        const st = M.isClosed(t.status) ? 'done' : 'open';
        if (t.linkSt !== st) { t.linkSt = st; ch = true; }
      });
      // grocery tasks whose list is gone or taken out: open ones go; done ones stay as history (no longer linked)
      const before = d.tasks.length;
      d.tasks = d.tasks.filter(t => {
        if (!t.link || t.link.k !== 'groc' || live.has(t.id)) return true;
        if (M.isClosed(t.status)) { delete t.link; ch = true; return true; }
        return false;
      });
      if (d.tasks.length !== before) ch = true;

      // spending records for what was bought (one per list / item; never twice)
      const F = d.finance;
      if (F && Array.isArray(F.records)) {
        const all = PU.items();
        all.forEach(x => {
          const rid = RID(x.kind, x.id), src = x.kind === 'groc' ? groc().find(g => g.id === x.id) : wish().find(w => w.id === x.id);
          if (!src) return;
          const r = F.records.find(y => y.id === rid);
          const want = recOn() && x.paid && x.paidAmount > 0;
          if (want) {
            if (!r && src.recMade) { if (!src.recOff) { src.recOff = true; ch = true; } return; }   // you deleted it in Money: leave it out
            if (!r) {
              ED.finance.addRecord({ id: rid, date: x.paidOn || today, type: 'expense', amount: x.paidAmount, categoryId: catId(x.kind), accountId: null,
                desc: x.name, notes: 'From ' + (x.kind === 'groc' ? 'the Grocery list' : 'the Wardrobe “To buy” list'), src: x.key });
              src.recMade = true; ch = true;
            } else if (!r.fixed && (r.amount !== x.paidAmount || r.date !== (x.paidOn || r.date) || r.desc !== x.name)) {
              r.amount = x.paidAmount; if (x.paidOn) r.date = x.paidOn; r.desc = x.name; r.updatedAt = Date.now(); ch = true;
            }
          } else {
            if (r && !r.fixed) { F.records = F.records.filter(y => y !== r); ch = true; }
            if (!x.paid && (src.recMade || src.recOff)) { delete src.recMade; delete src.recOff; ch = true; }
          }
        });
      }
    } catch (err) { console.warn('[e-diary] purchases', err); }
    finally { busy = false; }
    return ch;
  };

  // run after every change (and once at start, js/app.js); a change made here is saved like any other
  ED.store.on((type, detail) => {
    if (type !== 'change' || (detail && detail.reason === 'purchases')) return;
    if (PU.reconcile()) ED.store.commit({ reason: 'purchases' });
  });

  // deleting the grocery task takes the list out of the planner and Bills (undo brings both back)
  const del0 = M.deleteTask;
  M.deleteTask = id => {
    const t = M.task(id);
    if (t && t.link && t.link.k === 'groc' && !quiet) {
      const g = groc().find(x => x.id === t.link.id);
      if (g) { g.noPlan = true; g.updatedAt = Date.now(); }
    }
    return del0(id);
  };

  /* ---------------- going to the list ---------------- */
  PU.open = key => {
    const [k, id] = String(key || '').split(':');
    if (k === 'groc') {
      (ED.state.lists = ED.state.lists || { trip: null, groc: null }).groc = id;
      ED.state.career.mode = 'grocery';
    } else if (k === 'ward') {
      (ED.state.wd = ED.state.wd || { tab: 'clothes', type: '', occ: '' }).tab = 'buy';
      ED.state.career.mode = 'wardrobe';
    } else return false;
    ED.go.tab('career');
    return true;
  };
  // clicking a grocery task (daily list, calendars, Eisenhower…) opens its list; ⋯ → Open… still edits the task
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI.occFrom(el);
    if (o && o.t.link && o.t.link.k === 'groc' && groc().some(g => g.id === o.t.link.id)) { PU.open('groc:' + o.t.link.id); return; }
    return open0 && open0(el, ev);
  };

  /* ---------------- Finance → Bills: "Planned purchases" ---------------- */
  PU.billsHtml = m => {
    const head = '<h3 class="gh fin-gap">Planned purchases <span class="hint">from Grocery &amp; Wardrobe</span></h3>';
    const sw = (id, on, label) => '<label class="switch pu-sw"><input type="checkbox" data-change="pu-set" data-k="' + id + '"' + (on ? ' checked' : '') + '><span class="track"></span><span>' + label + '</span></label>';
    if (!PU.on()) return head + '<p class="hint">Purchases from the Grocery list and the Wardrobe “To buy” list are not shown here.</p>' + sw('purchases', false, 'Show them here (and the grocery task in the planner)');
    const mk = m.slice(0, 7), today = U.today(), all = PU.items();
    const open = all.filter(x => !x.paid).sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    const paid = all.filter(x => x.paid && String(x.paidOn || '').slice(0, 7) === mk).sort((a, b) => String(a.paidOn).localeCompare(String(b.paidOn)));
    const toPay = r2(open.reduce((a, x) => a + x.amount, 0)), spent = r2(paid.reduce((a, x) => a + x.paidAmount, 0));
    const row = x => {
      const late = !x.paid && x.date && x.date < today, dd = x.date ? U.diffDays(today, x.date) : null;
      const when = x.paid ? 'bought ' + U.fmtShort(x.paidOn) : x.date ? (late ? U.plural(-dd, 'day') + ' late' : dd === 0 ? 'today' : dd === 1 ? 'tomorrow' : 'on ' + U.fmtShort(x.date)) : 'no date set';
      return '<li class="pu-row' + (x.paid ? ' paid' : '') + (late ? ' late' : '') + '"><button type="button" class="stick' + (x.paid ? ' on' : '') + '" data-act="pu-pay" data-key="' + e(x.key) + '" aria-pressed="' + x.paid + '" aria-label="' + (x.paid ? 'Bought — click to undo' : 'Mark as bought and paid') + '">' + ED.tasksUI.statusIcon(x.paid ? 'done' : 'open') + '</button>' +
        '<button type="button" class="plain-btn grow fin-bn" data-act="pu-open" data-key="' + e(x.key) + '" title="Open the ' + (x.kind === 'groc' ? 'grocery list' : 'Wardrobe “To buy” list') + '"><b>' + e(x.name) + '</b><span class="hint">' + e(when + (x.sub ? ' · ' + x.sub : '')) + (late ? ' ⚠' : '') + '</span></button>' +
        '<span class="chip pu-src pu-' + x.kind + '">' + ED.icon(x.kind === 'groc' ? 'cart' : 'user') + e(x.src) + '</span>' +
        '<span class="num">' + (x.paid ? money(x.paidAmount) : x.amount ? money(x.amount) : '—') + '</span>' +
        (x.paid ? '' : '<button type="button" class="icon-btn sm" data-act="pu-hide" data-key="' + e(x.key) + '" aria-label="Take ' + e(x.name) + ' out of Bills" title="Take out of Bills' + (x.kind === 'groc' ? ' and the planner' : '') + '">' + ED.icon('x') + '</button>') + '</li>';
    };
    return head +
      (all.length ? '<div class="fin-bsum pu-sum"><span class="num">To buy: <b>' + money(toPay) + '</b>' + (open.length ? ' · ' + U.plural(open.length, 'purchase') : '') + '</span><span class="num">Bought in ' + e(U.MONTHS[+m.slice(5, 7) - 1]) + ': <b>' + money(spent) + '</b></span></div>' : '') +
      (open.length ? '<ul class="fin-bills pu-bills">' + open.map(row).join('') + '</ul>' : '<p class="hint">Nothing to buy. Grocery lists with items and the Wardrobe “To buy” list appear here by themselves.</p>') +
      (paid.length ? '<h4 class="pu-h4">Bought in ' + e(U.fmtMonthYear(m)) + '</h4><ul class="fin-bills pu-bills">' + paid.map(row).join('') + '</ul>' : '') +
      '<div class="btn-row"><button type="button" class="btn small" data-act="pu-goto" data-k="groc">' + ED.icon('cart') + 'Grocery lists</button><button type="button" class="btn small" data-act="pu-goto" data-k="ward">' + ED.icon('user') + 'Wardrobe — to buy</button></div>' +
      '<div class="pu-sws">' + sw('purchaseRecords', recOn(), 'Add them to my Money records when bought') + sw('purchases', true, 'Show them here (and the grocery task in the planner)') + '</div>';
  };

  /* note on the Grocery page (js/lists.js) */
  PU.grocNote = g => {
    if (!g || !PU.on()) return '';
    if (g.noPlan) return '<div class="notice pu-note">' + ED.icon('info') + '<span class="grow">This list is not in your planner or in Finance → Bills.</span><button type="button" class="btn small primary" data-act="pu-back" data-key="groc:' + e(g.id) + '">Add it back</button></div>';
    if (!items(g).length) return '';
    const t = M.task(TID(g.id));
    return '<p class="hint pu-hint">' + ED.icon('calendar') + ' In the planner as <button type="button" class="link-btn" data-act="pu-day" data-date="' + e((t && t.date) || g.date || U.today()) + '">“' + e(PU.title(g)) + '”</button> and in <button type="button" class="link-btn" data-act="pu-bills">Finance → Bills</button>' + (gTotal(g) ? ' (' + e(money(gTotal(g))) + ')' : '') + '.</p>';
  };
  /* note on the Wardrobe "To buy" page */
  PU.wardNote = () => PU.on() && wish().some(x => !x.done && !x.noBill) ? '<p class="hint pu-hint">' + ED.icon('receipt') + ' These are also in <button type="button" class="link-btn" data-act="pu-bills">Finance → Bills</button> as planned purchases.</p>' : '';

  /* ---------------- actions ---------------- */
  A['pu-open'] = el => PU.open(el.dataset.key);
  A['pu-goto'] = el => PU.open(el.dataset.k === 'groc' ? 'groc:' + ((groc()[groc().length - 1] || {}).id || '') : 'ward:');
  A['pu-bills'] = () => { (ED.state.fin = ED.state.fin || {}).rtab = 'bills'; ED.go.tab('finance'); };
  A['pu-day'] = el => ED.go.day(el.dataset.date || U.today());
  A['pu-pay'] = async el => {
    const x = find(el.dataset.key); if (!x) return;
    if (x.kind === 'groc') {
      const g = groc().find(y => y.id === x.id); if (!g) return;
      ED.store.checkpoint(x.paid ? 'Not bought' : 'Bought');
      g.items.forEach(i => { i.done = !x.paid; });
      g.updatedAt = Date.now();
      ED.store.commit();
      ED.ui.undoToast(x.paid ? x.name + ' — marked as not bought' : x.name + ' — bought' + (x.amount && recOn() ? ' · ' + money(x.amount) + ' recorded' : ''));
      return;
    }
    const w = wish().find(y => y.id === x.id); if (!w) return;
    if (x.paid) { ED.store.checkpoint('To buy'); w.done = false; w.doneOn = null; w.updatedAt = Date.now(); ED.store.commit(); ED.ui.undoToast(w.name + ' — marked as not bought'); return; }
    const paid = await ED.ui.prompt({ title: 'Bought: ' + w.name, label: 'What did it cost (₹)?', type: 'number', value: w.cost || '', ok: 'Bought' });
    if (paid == null) return;
    ED.store.checkpoint('Bought');
    if (ED.wardrobe && ED.wardrobe.markBought) ED.wardrobe.markBought(w, paid);
    else { w.done = true; w.doneOn = U.today(); w.paid = +paid || +w.cost || 0; w.updatedAt = Date.now(); }
    ED.store.commit(); ED.ui.undoToast(w.name + ' — bought and added to My clothes' + (recOn() && w.paid ? ' · ' + money(w.paid) + ' recorded' : ''));
  };
  A['pu-hide'] = el => {
    const [k, id] = String(el.dataset.key).split(':');
    const src = k === 'groc' ? groc().find(g => g.id === id) : wish().find(w => w.id === id); if (!src) return;
    ED.store.checkpoint('Take out of Bills');
    if (k === 'groc') src.noPlan = true; else src.noBill = true;
    src.updatedAt = Date.now();
    ED.store.commit();
    ED.ui.undoToast(k === 'groc' ? 'Taken out of Bills and the planner (the list stays)' : 'Taken out of Bills (still on the Wardrobe list)');
  };
  A['pu-back'] = el => {
    const [k, id] = String(el.dataset.key).split(':');
    const src = k === 'groc' ? groc().find(g => g.id === id) : wish().find(w => w.id === id); if (!src) return;
    if (k === 'groc') delete src.noPlan; else delete src.noBill;
    src.updatedAt = Date.now();
    ED.store.commit();
    ED.ui.toast(k === 'groc' ? 'Back in the planner and in Bills' : 'Back in Bills');
  };
  CH['pu-set'] = el => { S()[el.dataset.k] = el.checked; ED.store.commit(); };
})();
