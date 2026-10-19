/* E-Diary — Notes & Life → Wardrobe: your clothes, a weekly outfit plan and a list of things to buy.
   Data (ED.store.data.wardrobe):
     items: [ { id, name, type, color, occasion, size, brand, cost, bought, lastWorn, wears, cond: good|worn|repair|discard, notes, updatedAt } ]
     wish:  [ { id, name, type, cost, prio: need|want, by, where, notes, done, doneOn, paid, updatedAt } ]
     plan:  { 'YYYY-MM-DD': { top, bottom, shoes, layer } }   item ids for each day
     budget: number (₹ for the things to buy) */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const FX = () => ED.fx, CH = () => ED.charts;
  const A = (ED.actions = ED.actions || {}), CHG = (ED.changes = ED.changes || {});
  const W = () => { const d = ED.store.data; if (!d.wardrobe || typeof d.wardrobe !== 'object') d.wardrobe = {}; const w = d.wardrobe; if (!Array.isArray(w.items)) w.items = []; if (!Array.isArray(w.wish)) w.wish = []; if (!w.plan || typeof w.plan !== 'object') w.plan = {}; return w; };
  const st = () => ED.state.wd || (ED.state.wd = { tab: 'clothes', type: '', occ: '' });
  const WD = (ED.wardrobe = {});

  const TYPES = ['Shirt', 'T-shirt', 'Kurta', 'Trousers', 'Pant / Jeans', 'Shorts', 'Blazer / Suit', 'Jacket / Sweater', 'Tie', 'Belt', 'Shoes', 'Sandals / Slippers', 'Socks', 'Innerwear', 'Nightwear', 'Sportswear', 'Other'];
  const SLOTS = [['top', 'Top', ['Shirt', 'T-shirt', 'Kurta', 'Sportswear']], ['bottom', 'Bottom', ['Trousers', 'Pant / Jeans', 'Shorts']], ['shoes', 'Footwear', ['Shoes', 'Sandals / Slippers']], ['layer', 'Layer / extra', ['Blazer / Suit', 'Jacket / Sweater', 'Tie', 'Belt']]];
  const OCC = ['Office', 'Formal / ceremony', 'Casual', 'Party', 'Sports', 'Home', 'Travel'];
  const COND = [['good', 'Good'], ['worn', 'Getting worn'], ['repair', 'Needs repair'], ['discard', 'Replace']];
  // a basic set for an office week; below it, the type is suggested for buying
  const BASIC = { Shirt: 6, Trousers: 4, Shoes: 2, Belt: 1, Socks: 6, 'T-shirt': 3, Innerwear: 7 };
  const money = n => '₹' + Math.round(+n || 0).toLocaleString('en-IN');
  const item = id => W().items.find(x => x.id === id) || null;
  const usable = x => x.cond !== 'discard';
  const daysSince = k => k ? U.diffDays(k, U.today()) : null;
  const swatch = c => c ? '<i class="wd-sw" style="--c:' + e(c) + '" title="' + e(c) + '"></i>' : '';
  const wk = () => U.startOfWeek(st().w || U.today(), (ED.store.data.settings.weekStart || 0));

  /* ---------------- pages ---------------- */
  const tabs = () => { const s = st(); return '<div class="seg wd-seg" role="group" aria-label="Wardrobe">' + [['clothes', 'My clothes'], ['plan', 'Outfit plan'], ['buy', 'To buy']].map(x => '<button type="button" data-act="wd-tab" data-k="' + x[0] + '" aria-pressed="' + (s.tab === x[0]) + '">' + x[1] + '</button>').join('') + '</div>'; };
  const card = x => {
    const d = daysSince(x.lastWorn);
    return '<article class="wd-card' + (x.cond === 'discard' ? ' gone' : '') + '">' +
      '<div class="wd-h">' + swatch(x.color) + '<button type="button" class="link-btn wd-name" data-act="wd-edit" data-id="' + e(x.id) + '"><b>' + e(x.name) + '</b></button></div>' +
      '<div class="hint">' + [x.occasion, x.color, x.size, x.brand].filter(Boolean).map(e).join(' · ') + '</div>' +
      '<div class="wd-f"><span class="hint num">' + (x.lastWorn ? 'worn ' + (d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago') : 'not worn yet') + (x.wears ? ' · ' + x.wears + '×' : '') + '</span>' +
      (x.cond && x.cond !== 'good' ? '<span class="chip wd-c-' + e(x.cond) + '">' + e((COND.find(c => c[0] === x.cond) || [])[1] || '') + '</span>' : '') +
      '<button type="button" class="btn small ghost" data-act="wd-wore" data-id="' + e(x.id) + '"' + (x.lastWorn === U.today() ? ' disabled' : '') + '>' + ED.icon('check') + 'Wore today</button></div></article>';
  };
  const clothesLeft = () => {
    const s = st(), all = W().items, list = all.filter(x => (!s.type || x.type === s.type) && (!s.occ || x.occasion === s.occ));
    const idle = all.filter(x => usable(x) && (!x.lastWorn || daysSince(x.lastWorn) > 60)).length;
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('Items', String(all.filter(usable).length), U.plural(new Set(all.map(x => x.type)).size, 'type')) +
      FX().tile('Not worn for 60+ days', String(idle), idle ? 'consider giving away' : '') + FX().tile('To replace / repair', String(all.filter(x => x.cond === 'discard' || x.cond === 'repair').length), '') +
      FX().tile('Worth', money(all.filter(usable).reduce((a, x) => a + (+x.cost || 0), 0)), 'what you paid') + '</div>';
    const filters = '<div class="xp-filters"><select class="field" data-change="wd-f" data-k="type" aria-label="Type"><option value="">All types</option>' + TYPES.map(t => FX().opt(t, t, s.type === t)).join('') + '</select>' +
      '<select class="field" data-change="wd-f" data-k="occ" aria-label="Occasion"><option value="">Any occasion</option>' + OCC.map(t => FX().opt(t, t, s.occ === t)).join('') + '</select></div>';
    const groups = TYPES.map(t => ({ t, l: list.filter(x => (x.type || 'Other') === t).sort((a, b) => String(a.lastWorn || '').localeCompare(String(b.lastWorn || ''))) })).filter(g => g.l.length);
    return tiles + filters + (groups.length ? groups.map(g => '<h3 class="gh">' + e(g.t) + ' <span class="hint num">· ' + g.l.length + '</span></h3><div class="wd-grid">' + g.l.map(card).join('') + '</div>').join('')
      : '<div class="empty">' + ED.icon('list') + '<div><b>' + (all.length ? 'Nothing matches.' : 'No clothes added yet.') + '</b>' + (all.length ? '' : '<br>Add your shirts, trousers, shoes and the rest — then plan the week’s outfits and keep a list of what to buy.') + '</div></div>');
  };
  const planLeft = () => {
    const w = wk(), P = W().plan, items = W().items.filter(usable), today = U.today();
    const nav = '<div class="wk-nav"><button type="button" class="icon-btn sm" data-act="wd-week" data-dir="-1" aria-label="Previous week">' + ED.icon('chevL') + '</button><span class="num">' + e(U.fmtRange(w, U.addDays(w, 6))) + '</span>' +
      '<button type="button" class="icon-btn sm" data-act="wd-week" data-dir="1" aria-label="Next week">' + ED.icon('chevR') + '</button><span class="grow"></span>' +
      '<button type="button" class="btn small" data-act="wd-suggest">' + ED.icon('sparkle') + 'Suggest the week</button></div>';
    const rows = Array.from({ length: 7 }, (x, i) => U.addDays(w, i)).map(k => {
      const p = P[k] || {};
      return '<div class="wd-day' + (k === today ? ' cur' : '') + '"><div class="wd-dh"><b>' + U.DAY3[U.dow(k)] + '</b> <span class="num hint">' + e(U.fmtShort(k)) + '</span>' +
        (k === today && Object.values(p).some(Boolean) ? '<button type="button" class="link-btn" data-act="wd-wear-plan" data-date="' + k + '">' + ED.icon('check') + 'Wore this</button>' : '') + '</div>' +
        '<div class="wd-slots">' + SLOTS.map(s => '<select class="field" data-change="wd-plan" data-date="' + k + '" data-slot="' + s[0] + '" aria-label="' + e(s[1]) + ' on ' + e(U.fmtShort(k)) + '"><option value="">' + e(s[1]) + ' —</option>' +
          items.filter(x => s[2].indexOf(x.type) >= 0).map(x => FX().opt(x.id, x.name + (x.color ? ' (' + x.color + ')' : ''), p[s[0]] === x.id)).join('') + '</select>').join('') + '</div></div>';
    }).join('');
    return nav + (items.length ? rows : '<p class="hint">Add clothes under “My clothes” first.</p>') + '<p class="hint">Suggest the week picks office clothes you have worn least recently and repeats a top in the same week only when there are not enough. Change any day by hand.</p>';
  };
  const buyLeft = () => {
    const l = W().wish, open = l.filter(x => !x.done), done = l.filter(x => x.done);
    const tot = open.reduce((a, x) => a + (+x.cost || 0), 0), need = open.filter(x => x.prio === 'need').reduce((a, x) => a + (+x.cost || 0), 0), bud = +W().budget || 0;
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('To buy', String(open.length), money(tot) + ' in all') + FX().tile('Must have', money(need), U.plural(open.filter(x => x.prio === 'need').length, 'item')) +
      FX().tile('Budget', bud ? money(bud) : '—', bud ? (tot > bud ? money(tot - bud) + ' over' : money(bud - tot) + ' left') : 'set one on the right', bud && tot > bud ? 'warn' : '') + FX().tile('Bought', String(done.length), money(done.reduce((a, x) => a + (+x.paid || +x.cost || 0), 0)) + ' spent') + '</div>';
    const row = x => '<li class="wd-wish' + (x.done ? ' done' : '') + '"><button type="button" class="hz-tick' + (x.done ? ' on' : '') + '" data-act="wd-bought" data-id="' + e(x.id) + '" aria-pressed="' + !!x.done + '" aria-label="' + (x.done ? 'Bought' : 'Mark as bought') + '">' + (x.done ? ED.icon('check') : '') + '</button>' +
      '<button type="button" class="link-btn grow wd-wn" data-act="wd-wish" data-id="' + e(x.id) + '"><b>' + e(x.name) + '</b><span class="hint">' + [x.type, x.where, x.by ? 'by ' + U.fmtShort(x.by) : ''].filter(Boolean).map(e).join(' · ') + '</span></button>' +
      (!x.done && x.noBill && ED.purchases && ED.purchases.on() ? '<button type="button" class="link-btn" data-act="pu-back" data-key="ward:' + e(x.id) + '" title="Put it back in the daily planner and Finance → Bills">Add back to planner</button>' : '') +
      '<span class="chip wd-p-' + e(x.prio || 'want') + '">' + (x.prio === 'need' ? 'Must have' : 'Nice to have') + '</span><b class="num">' + (x.done && x.paid ? money(x.paid) : x.cost ? money(x.cost) : '') + '</b></li>';
    return tiles + '<div class="xp-filters"><button type="button" class="btn small primary" data-act="wd-wish">' + ED.icon('plus') + 'Add something to buy</button></div>' + (ED.purchases ? ED.purchases.wardNote() : '') +
      (open.length ? '<ul class="wd-wl">' + open.sort((a, b) => (a.prio === 'need' ? 0 : 1) - (b.prio === 'need' ? 0 : 1) || String(a.by || '9999').localeCompare(String(b.by || '9999'))).map(row).join('') + '</ul>' : '<p class="hint">Nothing on the list. Add what you want to buy and roughly what it costs — or take one of the suggestions on the right.</p>') +
      (done.length ? '<h3 class="gh">Bought</h3><ul class="wd-wl">' + done.sort((a, b) => String(b.doneOn || '').localeCompare(String(a.doneOn || ''))).slice(0, 20).map(row).join('') + '</ul>' : '');
  };
  WD.left = head => {
    const s = st();
    const body = s.tab === 'plan' ? planLeft() : s.tab === 'buy' ? buyLeft() : clothesLeft();
    return '<div class="career wd">' + head + '<div class="wd-bar">' + tabs() + (s.tab === 'clothes' ? '<button type="button" class="btn small primary" data-act="wd-edit">' + ED.icon('plus') + 'Add clothes</button>' : '') + '</div>' +
      '<div class="graph scroll" data-keep-scroll="wd-' + s.tab + '">' + body + '</div></div>';
  };

  /* purchase suggestions: short of a basic office set, worn-out items, things not worn for long */
  WD.suggest = () => {
    const items = W().items, wish = W().wish.filter(x => !x.done), out = [];
    const avg = t => { const l = items.filter(x => x.type === t && +x.cost); return l.length ? Math.round(l.reduce((a, x) => a + +x.cost, 0) / l.length) : ''; };
    Object.keys(BASIC).forEach(t => { const n = items.filter(x => x.type === t && usable(x) && x.cond !== 'worn').length; if (n < BASIC[t] && !wish.some(w => w.type === t)) out.push({ type: t, name: (BASIC[t] - n) + ' × ' + t, why: 'you have ' + n + ' in good shape; an office week needs about ' + BASIC[t], cost: avg(t) ? avg(t) * (BASIC[t] - n) : '' }); });
    items.filter(x => x.cond === 'discard' || x.cond === 'worn').forEach(x => { if (!wish.some(w => w.replaces === x.id)) out.push({ type: x.type, name: 'Replace: ' + x.name, why: x.cond === 'discard' ? 'marked to replace' : 'getting worn', cost: x.cost || avg(x.type), replaces: x.id }); });
    return out.slice(0, 10);
  };
  WD.right = () => {
    const s = st(), w = W();
    let body = '';
    if (s.tab === 'buy') {
      const sug = WD.suggest();
      body = '<div class="set-row"><label class="lbl" for="wd-bud">Budget for clothes (₹)</label><input id="wd-bud" class="field num" type="number" min="0" step="500" value="' + e(w.budget || '') + '" data-change="wd-budget" placeholder="e.g. 15000"></div>' +
        '<h3 class="gh">Suggested</h3>' + (sug.length ? '<ul class="wd-sug">' + sug.map((x, i) => '<li><span class="grow"><b>' + e(x.name) + '</b><span class="hint">' + e(x.why) + (x.cost ? ' · about ' + money(x.cost) : '') + '</span></span><button type="button" class="btn small ghost" data-act="wd-take" data-i="' + i + '">' + ED.icon('plus') + 'Add</button></li>').join('') + '</ul>' : '<p class="hint">Nothing to suggest — your basics are covered.</p>');
    } else if (s.tab === 'plan') {
      const p = w.plan[U.today()] || {}, l = SLOTS.map(sl => [sl[1], item(p[sl[0]])]).filter(x => x[1]);
      body = '<h3 class="gh">Today</h3>' + (l.length ? '<ul class="wd-today">' + l.map(x => '<li>' + swatch(x[1].color) + '<span class="hint">' + e(x[0]) + '</span> <b>' + e(x[1].name) + '</b></li>').join('') + '</ul>' : '<p class="hint">No outfit planned for today.</p>');
    } else {
      const types = TYPES.filter(t => w.items.some(x => x.type === t && usable(x)));
      body = types.length ? CH().meters({ title: 'What you have', rows: types.map(t => ({ label: t, value: w.items.filter(x => x.type === t && usable(x)).length, valueLabel: String(w.items.filter(x => x.type === t && usable(x)).length) })), max: Math.max(1, ...types.map(t => w.items.filter(x => x.type === t && usable(x)).length)) }) : '';
      const idle = w.items.filter(x => usable(x) && x.lastWorn && daysSince(x.lastWorn) > 60).sort((a, b) => a.lastWorn.localeCompare(b.lastWorn)).slice(0, 8);
      body += idle.length ? '<h3 class="gh">Not worn for a while</h3><ul class="wd-today">' + idle.map(x => '<li>' + swatch(x.color) + '<b>' + e(x.name) + '</b> <span class="hint">' + daysSince(x.lastWorn) + ' days</span></li>').join('') + '</ul>' : '';
    }
    return '<div class="xp wd-r"><div class="pg-head"><h2 class="pg-title">' + (s.tab === 'buy' ? 'Budget & suggestions' : s.tab === 'plan' ? 'Today’s outfit' : 'Overview') + '</h2></div><div class="st-scroll scroll" data-keep-scroll="wd-r">' + body + '</div></div>';
  };

  /* ---------------- editors ---------------- */
  WD.edit = id => {
    const x = id ? item(id) : null;
    FX().form({
      title: x ? 'Clothes' : 'Add clothes', wide: true,
      data: x || { type: 'Shirt', occasion: 'Office', cond: 'good' },
      fields: [
        { k: 'name', label: 'Name', req: true, ph: 'e.g. White formal shirt' }, { k: 'type', label: 'Type', type: 'select', options: TYPES.map(t => [t, t]) },
        { k: 'color', label: 'Colour', ph: 'white, navy, #1f3a5f…' }, { k: 'occasion', label: 'Occasion', type: 'select', options: OCC.map(t => [t, t]) },
        { k: 'size', label: 'Size', ph: '40, L, 32…' }, { k: 'brand', label: 'Brand', ph: 'optional' },
        { k: 'cost', label: 'Cost (₹)', type: 'number', min: 0 }, { k: 'bought', label: 'Bought on', type: 'date' },
        { k: 'cond', label: 'Condition', type: 'select', options: COND }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete clothes'); W().items = W().items.filter(y => y !== x); ED.store.commit(); ED.ui.undoToast('Removed: ' + x.name); } : null,
      save(v, api) { ED.store.checkpoint(x ? 'Clothes' : 'New clothes'); if (x) Object.assign(x, v, { updatedAt: Date.now() }); else W().items.push(Object.assign({ id: U.uid('wd'), wears: 0, lastWorn: null, updatedAt: Date.now() }, v)); ED.store.commit(); api.close(); },
    });
  };
  WD.wish = (id, pre) => {
    const x = id ? W().wish.find(y => y.id === id) : null;
    FX().form({
      title: x ? 'To buy' : 'Add something to buy', wide: true,
      data: x || Object.assign({ prio: 'want', type: 'Shirt' }, pre || {}),
      fields: [
        { k: 'name', label: 'What', req: true, ph: 'e.g. Navy blazer' }, { k: 'type', label: 'Type', type: 'select', options: TYPES.map(t => [t, t]) },
        { k: 'cost', label: 'Expected cost (₹)', type: 'number', min: 0 }, { k: 'prio', label: 'Priority', type: 'select', options: [['need', 'Must have'], ['want', 'Nice to have']] },
        { k: 'by', label: 'Buy by', type: 'date' }, { k: 'where', label: 'Where', ph: 'shop, website…' }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete'); W().wish = W().wish.filter(y => y !== x); ED.store.commit(); ED.ui.undoToast('Removed: ' + x.name); } : null,
      save(v, api) { ED.store.checkpoint('To buy'); if (x) Object.assign(x, v, { updatedAt: Date.now() }); else W().wish.push(Object.assign({ id: U.uid('wb'), done: false, updatedAt: Date.now() }, pre && pre.replaces ? { replaces: pre.replaces } : {}, v)); ED.store.commit(); api.close(); },
    });
  };

  /* ---------------- actions ---------------- */
  A['wd-tab'] = el => { st().tab = el.dataset.k; ED.app.render(); };
  A['wd-edit'] = el => WD.edit(el.dataset.id || null);
  A['wd-wish'] = el => WD.wish(el.dataset.id || null);
  A['wd-take'] = el => { const x = WD.suggest()[+el.dataset.i]; if (x) WD.wish(null, { name: x.name, type: x.type, cost: x.cost || '', prio: 'need', replaces: x.replaces }); };
  A['wd-week'] = el => { st().w = U.addDays(wk(), 7 * +el.dataset.dir); ED.app.render(); };
  const wear = (ids, k) => { ids.forEach(id => { const x = item(id); if (!x || x.lastWorn === k) return; x.lastWorn = k; x.wears = (x.wears || 0) + 1; x.updatedAt = Date.now(); }); };
  A['wd-wore'] = el => { ED.store.checkpoint('Wore'); wear([el.dataset.id], U.today()); ED.store.commit(); };
  A['wd-wear-plan'] = el => { const p = W().plan[el.dataset.date] || {}; ED.store.checkpoint('Wore'); wear(Object.values(p).filter(Boolean), el.dataset.date); ED.store.commit(); ED.ui.toast('Marked as worn today'); };
  A['wd-suggest'] = () => {
    const w = wk(), items = W().items.filter(x => usable(x) && (x.occasion === 'Office' || !x.occasion)), P = W().plan;
    if (!items.length) { ED.ui.toast('Add office clothes first'); return; }
    ED.store.checkpoint('Suggest outfits');
    const used = {}; let n = 0;
    for (let i = 0; i < 7; i++) {
      const k = U.addDays(w, i), d = U.dow(k); if (d === 0) continue;   // Sunday left free
      const p = P[k] || (P[k] = {});
      SLOTS.slice(0, 3).forEach(s => {
        if (p[s[0]]) return;
        let pool = items.filter(x => s[2].indexOf(x.type) >= 0 && (s[0] !== 'top' || !used[x.id]));
        if (!pool.length) pool = items.filter(x => s[2].indexOf(x.type) >= 0);   // fewer tops than days: repeat the least used
        pool = pool.sort((a, b) => String(a.lastWorn || '').localeCompare(String(b.lastWorn || '')) || (used[a.id] || 0) - (used[b.id] || 0));
        if (pool.length) { p[s[0]] = pool[0].id; used[pool[0].id] = (used[pool[0].id] || 0) + 1; n++; }
      });
    }
    ED.store.commit(); ED.ui.undoToast(n ? 'Planned ' + U.plural(n, 'piece') + ' for the week' : 'Nothing to add — every day is already planned');
  };
  A['wd-bought'] = async el => {
    const x = W().wish.find(y => y.id === el.dataset.id); if (!x) return;
    if (x.done) { ED.store.checkpoint('To buy'); WD.unBuy(x); ED.store.commit(); return; }
    const paid = await ED.ui.prompt({ title: 'Bought: ' + x.name, label: 'What did it cost (₹)?', type: 'number', value: x.cost || '', ok: 'Bought' });
    if (paid == null) return;
    ED.store.checkpoint('Bought');
    WD.markBought(x, paid);
    ED.store.commit(); ED.ui.undoToast('Bought and added to My clothes');
  };
  /* bought: into My clothes (also used by Finance → Bills → Planned purchases, js/purchases.js) */
  WD.markBought = (x, paid) => {
    x.done = true; x.doneOn = U.today(); x.paid = +paid || +x.cost || 0; x.updatedAt = Date.now();
    x.itemId = U.uid('wd');
    W().items.push({ id: x.itemId, name: x.name.replace(/^Replace:\s*/, '').replace(/^\d+\s*×\s*/, ''), type: x.type || 'Other', occasion: 'Office', cond: 'good', cost: x.paid, bought: U.today(), wears: 0, lastWorn: null, notes: x.notes || '', updatedAt: Date.now() });
    if (x.replaces) { const o = item(x.replaces); if (o) { o.cond = 'discard'; o.updatedAt = Date.now(); } }
  };
  /* not bought after all (1.15): the clothes added for it go again, unless you have worn them since */
  WD.unBuy = x => {
    x.done = false; x.doneOn = null; x.updatedAt = Date.now();
    if (x.itemId) {
      const it = item(x.itemId);
      if (it && !(it.wears > 0)) W().items = W().items.filter(y => y !== it);
      delete x.itemId;
    }
    if (x.replaces) { const o = item(x.replaces); if (o && o.cond === 'discard') { o.cond = 'worn'; o.updatedAt = Date.now(); } }
  };
  CHG['wd-f'] = el => { st()[el.dataset.k] = el.value; ED.app.render(); };
  CHG['wd-plan'] = el => { const P = W().plan, k = el.dataset.date; const p = P[k] || (P[k] = {}); if (el.value) p[el.dataset.slot] = el.value; else delete p[el.dataset.slot]; if (!Object.keys(p).length) delete P[k]; ED.store.commit(); };
  CHG['wd-budget'] = el => { W().budget = +el.value || 0; ED.store.commit(); };
})();
