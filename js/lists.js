/* E-Diary — Career Graph → "Travel & Tour" and "Grocery" pages (beside Notes and Progress).
   Data (ED.store.data.lists):
     trips: [ { id, name, dest, from, to, by, purpose, stay, tickets, contacts, budget, itinerary, notes,
                items: [ { id, text, qty, cat, done } ], createdAt, updatedAt } ]
     groc:  [ { id, name, date, budget, notes, items: [ { id, text, qty, unit, cat, price, done } ], createdAt, updatedAt } ]
     meals: { 0..6: { b|l|s|d: [ { f, q } ] } }   this week's meal plan by weekday (0 = Sunday), with protein
     foods: [ { id, name, serving, p, kcal, fat, carb, cat } ] your own foods; weight, goalWeight (kg), height (cm), age, sex, act, pace, perKg
     stock: home stock of groceries and usables (1.21, below); mealPlans: saved meal plans (1.21, below)
   Every list is editable in place: add, change, tick, delete; categories are free text (pick one or type a new one). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const FX = () => ED.fx;
  const LS = () => { const d = ED.store.data; if (!d.lists || typeof d.lists !== 'object') d.lists = {}; const l = d.lists; if (!Array.isArray(l.trips)) l.trips = []; if (!Array.isArray(l.groc)) l.groc = []; if (!l.meals || typeof l.meals !== 'object') l.meals = {}; return l; };
  const st = () => ED.state.lists || (ED.state.lists = { trip: null, groc: null });
  const A = (ED.actions = ED.actions || {}), CH = (ED.changes = ED.changes || {}), F = (ED.forms = ED.forms || {});
  const LI = (ED.lists = {});
  const opt = (v, l, s) => '<option value="' + e(v) + '"' + (s ? ' selected' : '') + '>' + e(l) + '</option>';
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const money = n => '₹' + Math.round(n).toLocaleString('en-IN');

  const T_CATS = ['Documents', 'Money & cards', 'Clothes', 'Toiletries', 'Medicines', 'Electronics', 'Food & snacks', 'Travel gear', 'Office / work', 'Other'];
  const G_CATS = ['Vegetables', 'Fruits', 'Dairy & eggs', 'Grains & atta', 'Pulses & dals', 'Spices & masala', 'Oil & ghee', 'Snacks & beverages', 'Bakery', 'Household & cleaning', 'Personal care', 'Other'];
  const UNITS = ['', 'kg', 'g', 'L', 'ml', 'pcs', 'dozen', 'packet', 'bottle', 'box'];
  const MEALS = [['b', 'Breakfast'], ['l', 'Lunch'], ['s', 'Snacks'], ['d', 'Dinner']];

  /* the usual packing list; n = number of days of the trip */
  const usualTrip = n => [
    ['Documents', 'Identity card (Aadhaar / PAN / office ID)', 1], ['Documents', 'Tickets (printout or on phone)', 1], ['Documents', 'Tour order / travel sanction', 1],
    ['Documents', 'Hotel / guest house booking', 1], ['Documents', 'Passport & visa (if abroad)', 1], ['Documents', 'Emergency contacts list', 1],
    ['Money & cards', 'Cash', 1], ['Money & cards', 'Debit / credit card', 1],
    ['Clothes', 'Shirts / tops', n], ['Clothes', 'Trousers', Math.max(1, Math.ceil(n / 2))], ['Clothes', 'Undergarments', n + 1], ['Clothes', 'Socks (pairs)', n],
    ['Clothes', 'Night wear', 1], ['Clothes', 'Jacket / sweater', 1], ['Clothes', 'Shoes / slippers', 1],
    ['Toiletries', 'Toothbrush & paste', 1], ['Toiletries', 'Soap / shampoo', 1], ['Toiletries', 'Comb, razor', 1], ['Toiletries', 'Towel', 1],
    ['Medicines', 'Regular medicines (for ' + n + ' days + spare)', 1], ['Medicines', 'First-aid / ORS / pain relief', 1],
    ['Electronics', 'Phone & charger', 1], ['Electronics', 'Power bank', 1], ['Electronics', 'Laptop & charger', 1], ['Electronics', 'Earphones', 1],
    ['Travel gear', 'Water bottle', 1], ['Travel gear', 'Umbrella', 1], ['Travel gear', 'Bag lock', 1],
    ['Food & snacks', 'Dry snacks', 1],
  ];
  const usualGroc = [
    ['Grains & atta', 'Atta', '5', 'kg'], ['Grains & atta', 'Rice', '5', 'kg'], ['Pulses & dals', 'Toor dal', '1', 'kg'], ['Pulses & dals', 'Moong dal', '1', 'kg'],
    ['Oil & ghee', 'Cooking oil', '1', 'L'], ['Oil & ghee', 'Ghee', '500', 'g'], ['Spices & masala', 'Salt', '1', 'kg'], ['Spices & masala', 'Haldi, mirch, dhania', '1', 'packet'],
    ['Dairy & eggs', 'Milk', '7', 'L'], ['Dairy & eggs', 'Curd', '1', 'kg'], ['Dairy & eggs', 'Paneer', '200', 'g'], ['Dairy & eggs', 'Eggs', '1', 'dozen'],
    ['Vegetables', 'Onion', '2', 'kg'], ['Vegetables', 'Tomato', '1', 'kg'], ['Vegetables', 'Potato', '2', 'kg'], ['Vegetables', 'Green vegetables', '1', 'kg'],
    ['Fruits', 'Bananas', '1', 'dozen'], ['Snacks & beverages', 'Tea', '250', 'g'], ['Snacks & beverages', 'Sugar', '1', 'kg'], ['Bakery', 'Bread', '1', 'packet'],
    ['Household & cleaning', 'Dish wash', '1', 'bottle'], ['Household & cleaning', 'Detergent', '1', 'kg'], ['Personal care', 'Soap / toothpaste', '1', 'pcs'],
  ];

  const trip = () => { const l = LS(); const s = st(); let t = l.trips.find(x => x.id === s.trip); if (!t) { t = l.trips.slice().sort((a, b) => (a.from || '9').localeCompare(b.from || '9'))[0] || null; s.trip = t ? t.id : null; } return t; };
  const glist = () => { const l = LS(); const s = st(); let g = l.groc.find(x => x.id === s.groc); if (!g) { g = l.groc[l.groc.length - 1] || null; s.groc = g ? g.id : null; } return g; };
  const days = t => t && U.isKey(t.from) && U.isKey(t.to) && t.to >= t.from ? U.diffDays(t.from, t.to) + 1 : 1;
  const touch = o => { o.updatedAt = Date.now(); };

  /* grouped, editable checklist rows (shared by both pages) */
  const groups = (items, cats, kind) => {
    const order = cats.slice(); items.forEach(i => { if (i.cat && order.indexOf(i.cat) < 0) order.push(i.cat); });
    return order.map(c => {
      const rows = items.filter(i => (i.cat || 'Other') === c); if (!rows.length) return '';
      const done = rows.filter(i => i.done).length;
      return '<section class="ls-grp"><h4 class="ls-gh">' + e(c) + ' <span class="hint num">' + done + '/' + rows.length + '</span></h4><ul class="ls-list">' +
        rows.map(i => '<li class="ls-row' + (i.done ? ' done' : '') + '">' +
          '<input type="checkbox" class="ls-ck" data-change="ls-done" data-kind="' + kind + '" data-id="' + e(i.id) + '"' + (i.done ? ' checked' : '') + ' aria-label="' + (kind === 'trip' ? 'Packed' : 'Bought') + '">' +
          '<input class="ls-in ls-text" value="' + e(i.text) + '" data-change="ls-edit" data-f="text" data-kind="' + kind + '" data-id="' + e(i.id) + '" aria-label="Item">' +
          '<input class="ls-in ls-qty num" value="' + e(i.qty == null ? '' : i.qty) + '" data-change="ls-edit" data-f="qty" data-kind="' + kind + '" data-id="' + e(i.id) + '" aria-label="How many" placeholder="qty">' +
          (kind === 'groc' ? '<select class="ls-in ls-unit" data-change="ls-edit" data-f="unit" data-kind="groc" data-id="' + e(i.id) + '" aria-label="Unit">' + UNITS.map(u => opt(u, u || '—', u === (i.unit || ''))).join('') + '</select>' +
            '<input class="ls-in ls-price num" value="' + e(i.price == null ? '' : i.price) + '" data-change="ls-edit" data-f="price" data-kind="groc" data-id="' + e(i.id) + '" aria-label="Price (₹)" placeholder="₹">' : '') +
          '<button type="button" class="icon-btn sm" data-act="ls-del" data-kind="' + kind + '" data-id="' + e(i.id) + '" aria-label="Remove ' + e(i.text) + '" title="Remove">' + ED.icon('x') + '</button></li>').join('') +
        '</ul></section>';
    }).join('');
  };
  const addForm = (kind, cats) => '<form class="ls-add" data-form="ls-add" data-kind="' + kind + '">' +
    '<input name="text" class="field" placeholder="' + (kind === 'trip' ? 'Add an item to carry…' : 'Add a grocery item…') + '" autocomplete="off" aria-label="Item">' +
    '<input name="qty" class="field num ls-qty" placeholder="qty" aria-label="How many">' +
    (kind === 'groc' ? '<select name="unit" class="field ls-unit" aria-label="Unit">' + UNITS.map(u => opt(u, u || 'unit', !u)).join('') + '</select><input name="price" class="field num ls-price" placeholder="₹" aria-label="Price">' : '') +
    '<input name="cat" class="field ls-cat" list="ls-cats-' + kind + '" placeholder="Category" aria-label="Category (choose or type a new one)">' +
    '<datalist id="ls-cats-' + kind + '">' + cats.map(c => '<option value="' + e(c) + '">').join('') + '</datalist>' +
    '<button type="submit" class="btn small primary">' + ED.icon('plus') + 'Add</button></form>';
  const bar = (done, all) => '<div class="ls-bar" title="' + done + ' of ' + all + '"><i style="width:' + (all ? Math.round(done / all * 100) : 0) + '%"></i></div>';
  const wrap = (head, body, keep) => '<div class="career ls">' + head + '<div class="ls-scroll scroll" data-keep-scroll="' + keep + '">' + body + '</div></div>';

  /* ---------------- Travel & Tour ---------------- */
  const tripCats = t => T_CATS.concat((t ? t.items : []).map(i => i.cat).filter(c => c && T_CATS.indexOf(c) < 0)).filter((c, i, a) => a.indexOf(c) === i);
  LI.travelLeft = head => {
    const l = LS(), t = trip(), today = U.today();
    const cards = l.trips.slice().sort((a, b) => (a.from || '9').localeCompare(b.from || '9')).map(x => {
      const done = x.items.filter(i => i.done).length;
      const when = x.from ? U.fmtShort(x.from) + (x.to && x.to !== x.from ? ' – ' + U.fmtShort(x.to) : '') : 'dates not set';
      const tag = x.from && x.from > today ? 'in ' + U.plural(U.diffDays(today, x.from), 'day') : x.to && x.to < today ? 'done' : x.from ? 'now' : '';
      return '<button type="button" class="ls-card' + (t && x.id === t.id ? ' sel' : '') + '" data-act="ls-trip" data-id="' + e(x.id) + '"><b>' + e(x.name || x.dest || 'Trip') + '</b>' +
        '<span class="hint">' + e([x.dest, when].filter(Boolean).join(' · ')) + (tag ? ' · ' + e(tag) : '') + '</span>' + bar(done, x.items.length) + '<span class="hint num">' + done + '/' + x.items.length + ' packed</span></button>';
    }).join('');
    const det = t ? '<div class="ls-det"><div class="ls-det-h"><h3>' + e(t.name || t.dest || 'Trip') + '</h3><button type="button" class="btn small" data-act="ls-trip-edit">' + ED.icon('pencil') + 'Edit details</button></div>' +
      '<dl class="ls-dl">' + [['Destination', t.dest], ['Dates', t.from ? U.fmtLong(t.from) + (t.to && t.to !== t.from ? ' → ' + U.fmtLong(t.to) + ' (' + U.plural(days(t), 'day') + ')' : '') : ''], ['Travel by', t.by], ['Purpose', t.purpose],
        ['Stay', t.stay], ['Tickets / PNR', t.tickets], ['Contacts', t.contacts], ['Budget', t.budget ? money(num(t.budget)) : ''], ['Itinerary', t.itinerary], ['Notes', t.notes]]
        .filter(x => x[1]).map(x => '<dt>' + e(x[0]) + '</dt><dd>' + e(x[1]).replace(/\n/g, '<br>') + '</dd>').join('') + '</dl>' +
      (t.dest || t.from ? '' : '<p class="hint">Add the destination, dates, tickets, stay and itinerary with <b>Edit details</b>.</p>') + '</div>' : '';
    return wrap(head, '<div class="ls-tools"><button type="button" class="btn small primary" data-act="ls-trip-new">' + ED.icon('plus') + 'New trip / tour</button></div>' +
      (cards ? '<div class="ls-cards">' + cards + '</div>' : '<div class="empty">' + ED.icon('compass') + '<div><b>No trips planned yet.</b><br>Plan a tour: what to carry, how many, which documents, tickets, stay and itinerary.</div></div>') + det, 'ls-travel-l');
  };
  LI.travelRight = () => {
    const t = trip();
    if (!t) return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">Packing list</h2></div><p class="hint">Create a trip on the left to start its list.</p></div>';
    const done = t.items.filter(i => i.done).length;
    return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">What to carry</h2><span class="hint num">' + done + '/' + t.items.length + ' packed</span></div>' + bar(done, t.items.length) +
      addForm('trip', tripCats(t)) +
      '<div class="ls-tools"><button type="button" class="btn small" data-act="ls-usual" data-kind="trip">' + ED.icon('checkSq') + 'Add the usual list (' + U.plural(days(t), 'day') + ')</button>' +
      '<button type="button" class="btn small ghost" data-act="ls-uncheck" data-kind="trip">Untick all</button><button type="button" class="btn small ghost" data-act="ls-copy" data-kind="trip">' + ED.icon('copy') + 'Copy list</button></div>' +
      '<div class="ls-scroll scroll" data-keep-scroll="ls-travel-r">' + (t.items.length ? groups(t.items, tripCats(t), 'trip') : '<p class="hint">Add items above, or start with the usual list — quantities follow the number of days. Everything can be changed or removed.</p>') + '</div></div>';
  };
  LI.editTrip = id => {
    const l = LS(), x = id ? l.trips.find(t => t.id === id) : null;
    FX().form({
      title: x ? 'Trip details' : 'New trip / tour', wide: true,
      data: x || { name: '', dest: '', from: U.today(), to: U.today() },
      fields: [
        { k: 'name', label: 'Name', req: true, ph: 'e.g. Pune inspection tour, Family trip to Shimla' }, { k: 'dest', label: 'Destination' },
        { k: 'from', label: 'From', type: 'date' }, { k: 'to', label: 'To', type: 'date' },
        { k: 'by', label: 'Travel by', list: ['Train', 'Flight', 'Bus', 'Car', 'Office vehicle'] }, { k: 'purpose', label: 'Purpose', list: ['Official tour', 'Conference', 'Training', 'Family', 'Holiday'] },
        { k: 'tickets', label: 'Tickets / PNR', type: 'textarea', rows: 2 }, { k: 'stay', label: 'Stay (hotel / guest house, address)', type: 'textarea', rows: 2 },
        { k: 'contacts', label: 'Contacts there', type: 'textarea', rows: 2 }, { k: 'budget', label: 'Budget (₹)', type: 'number', min: 0 },
        { k: 'itinerary', label: 'Itinerary (one line per day)', type: 'textarea', rows: 4 }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      delLabel: 'Delete trip',
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Delete trip', message: 'Delete “' + (x.name || 'this trip') + '” and its list?', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Delete trip'); l.trips = l.trips.filter(t => t.id !== x.id); st().trip = null; ED.store.commit(); ED.ui.undoToast('Trip deleted'); } : null,
      save(v, api) {
        if (v.from && v.to && v.to < v.from) v.to = v.from;
        ED.store.checkpoint(x ? 'Trip' : 'New trip');
        if (x) Object.assign(x, v); else { const n = Object.assign({ id: U.uid('tr'), items: [], createdAt: Date.now() }, v); l.trips.push(n); st().trip = n.id; }
        touch(x || l.trips[l.trips.length - 1]); ED.store.commit(); api.close();
      },
    });
  };

  /* ---------------- Grocery ---------------- */
  const grocCats = g => G_CATS.concat((g ? g.items : []).map(i => i.cat).filter(c => c && G_CATS.indexOf(c) < 0)).filter((c, i, a) => a.indexOf(c) === i);
  LI.grocLeft = head => {
    const l = LS(), g = glist();
    const sel = '<div class="ls-tools">' + (l.groc.length ? '<select class="field ls-pick" data-change="ls-groc-pick" aria-label="Grocery list">' + l.groc.map(x => opt(x.id, (x.name || 'List') + (x.date ? ' · ' + U.fmtShort(x.date) : ''), g && x.id === g.id)).join('') + '</select>' +
      '<button type="button" class="icon-btn" data-act="ls-groc-edit" aria-label="Rename or delete this list" title="List details">' + ED.icon('pencil') + '</button>' : '') +
      '<button type="button" class="btn small primary" data-act="ls-groc-new">' + ED.icon('plus') + 'New list</button></div>';
    if (!g) return wrap(head, sel + '<div class="empty">' + ED.icon('list') + '<div><b>No grocery list yet.</b><br>Make one for the week or the month; add, change and tick items as you buy them.</div></div>', 'ls-groc-l');
    const done = g.items.filter(i => i.done).length;
    const cost = g.items.reduce((a, i) => a + num(i.price), 0), spent = g.items.filter(i => i.done).reduce((a, i) => a + num(i.price), 0);
    return wrap(head, sel +
      '<div class="tiles xp-tiles">' + FX().tile('Items', String(g.items.length), (g.items.length - done) + ' still to buy') + FX().tile('Bought', String(done), bar(done, g.items.length)) +
      FX().tile('Estimated', cost ? money(cost) : '—', cost ? 'bought ' + money(spent) : 'add prices to see the total') + FX().tile('Budget', g.budget ? money(num(g.budget)) : '—', g.budget && cost > num(g.budget) ? 'over by ' + money(cost - num(g.budget)) : g.budget ? 'within budget' : 'set in list details', g.budget && cost > num(g.budget) ? 'warn' : '') + '</div>' +
      (ED.purchases ? ED.purchases.grocNote(g) : '') +   // the "Groceries — date" task and the bill (js/purchases.js)
      addForm('groc', grocCats(g)) +
      '<div class="ls-tools"><button type="button" class="btn small" data-act="ls-usual" data-kind="groc">' + ED.icon('checkSq') + 'Add usual staples</button>' +
      '<button type="button" class="btn small ghost" data-act="ls-clear-done">Remove bought</button><button type="button" class="btn small ghost" data-act="ls-uncheck" data-kind="groc">Untick all</button>' +
      '<button type="button" class="btn small ghost" data-act="ls-copy" data-kind="groc">' + ED.icon('copy') + 'Copy list</button></div>' +
      (g.items.length ? groups(g.items, grocCats(g), 'groc') : '<p class="hint">Add items above, or start with the usual staples and change them.</p>'), 'ls-groc-l');
  };
  /* ---------------- meal planner with protein ----------------
     meals[d][meal] = [ { f: food name, q: servings } ]   (older plans kept text; shown as a food of that name)
     foods: your own foods [ { id, name, cat, serving, p } ]   p = grams of protein in one serving
     weight (kg), perKg (g of protein per kg of body weight per day) */
  // name, serving, protein g per serving — approximate values for home-cooked portions (IFCT / NIN, rounded)
  const FOODS = {
    'Breads': [['Roti / chapati', '1 roti (40 g)', 3], ['Phulka', '1 small', 2.5], ['Paratha (plain)', '1', 4], ['Aloo paratha', '1', 5], ['Paneer paratha', '1', 9], ['Methi thepla', '1', 3], ['Puri', '1', 1.5], ['Naan', '1', 8], ['Missi roti', '1', 5], ['Makki roti', '1', 3], ['Bajra roti', '1', 3.5], ['Jowar bhakri', '1', 3.5], ['Bread slice (brown)', '1 slice', 3]],
    'Rice & grains': [['Rice (cooked)', '1 katori (150 g)', 4], ['Jeera rice', '1 katori', 4], ['Veg pulao', '1 plate', 6], ['Veg biryani', '1 plate', 8], ['Chicken biryani', '1 plate', 22], ['Khichdi', '1 katori', 7], ['Curd rice', '1 katori', 6], ['Lemon rice', '1 katori', 4], ['Quinoa (cooked)', '1 katori', 6]],
    'Dals & legumes': [['Dal (toor / arhar)', '1 katori', 7], ['Moong dal', '1 katori', 7], ['Masoor dal', '1 katori', 8], ['Chana dal', '1 katori', 8], ['Dal makhani', '1 katori', 9], ['Rajma', '1 katori', 9], ['Chole / chana masala', '1 katori', 9], ['Kadhi', '1 katori', 5], ['Sambar', '1 katori', 5], ['Sprouts salad', '1 katori', 7], ['Lobia', '1 katori', 8]],
    'Sabzi': [['Aloo sabzi', '1 katori', 2], ['Aloo gobi', '1 katori', 3], ['Bhindi', '1 katori', 2], ['Baingan bharta', '1 katori', 2], ['Palak sabzi', '1 katori', 3], ['Mixed veg', '1 katori', 3], ['Lauki / tori', '1 katori', 1.5], ['Cabbage / patta gobi', '1 katori', 2], ['Matar mushroom', '1 katori', 6], ['Aloo matar', '1 katori', 4], ['Soya chunks curry', '1 katori', 15], ['Green salad', '1 plate', 1]],
    'Paneer & dairy': [['Paneer (raw)', '100 g', 18], ['Palak paneer', '1 katori', 12], ['Paneer bhurji', '1 katori', 14], ['Matar paneer', '1 katori', 11], ['Curd / dahi', '1 katori (150 g)', 5], ['Greek yogurt / hung curd', '100 g', 9], ['Raita', '1 katori', 4], ['Milk', '1 glass (250 ml)', 8], ['Buttermilk / chaas', '1 glass', 3], ['Lassi', '1 glass', 6], ['Cheese slice', '1', 4], ['Tofu', '100 g', 12]],
    'Eggs, meat & fish': [['Egg (boiled)', '1', 6], ['Omelette (2 eggs)', '1', 12], ['Egg bhurji (2 eggs)', '1 katori', 13], ['Egg curry (2 eggs)', '1 katori', 13], ['Chicken curry', '1 katori', 20], ['Chicken breast (cooked)', '100 g', 31], ['Tandoori chicken', '2 pieces', 25], ['Fish curry', '1 katori', 18], ['Mutton curry', '1 katori', 20], ['Prawns', '100 g', 20]],
    'Breakfast': [['Poha', '1 plate', 5], ['Upma', '1 plate', 6], ['Idli', '1', 2], ['Dosa (plain)', '1', 3], ['Masala dosa', '1', 6], ['Uttapam', '1', 5], ['Besan chilla', '1', 6], ['Moong dal chilla', '1', 7], ['Oats (with milk)', '1 bowl', 10], ['Daliya (with milk)', '1 bowl', 9], ['Cornflakes with milk', '1 bowl', 9], ['Sandwich (veg)', '1', 6], ['Medu vada', '1', 3]],
    'Snacks': [['Roasted chana', '30 g', 6], ['Peanuts', '30 g', 8], ['Almonds', '10', 2.5], ['Makhana (roasted)', '1 cup', 3], ['Dhokla', '2 pieces', 4], ['Samosa', '1', 4], ['Pakora', '4 pieces', 4], ['Bhel puri', '1 plate', 4], ['Biscuits', '4', 2], ['Peanut butter', '1 tbsp', 4], ['Protein / whey shake', '1 scoop', 24], ['Soya chunks (dry)', '30 g', 15]],
    'Fruits': [['Banana', '1', 1.3], ['Apple', '1', 0.5], ['Orange', '1', 1], ['Papaya', '1 bowl', 1], ['Guava', '1', 2.5], ['Mango', '1', 1.5], ['Seasonal fruit bowl', '1 bowl', 1]],
    'Drinks & sweets': [['Tea with milk', '1 cup', 1.5], ['Coffee with milk', '1 cup', 2], ['Coconut water', '1', 1], ['Kheer', '1 katori', 6], ['Halwa', '1 katori', 4], ['Gulab jamun', '1', 1.5]],
  };
  /* 1.16: calories, fat and carbohydrate in one serving — [kcal, fat g, carbs g], approximate for usual home cooking (IFCT 2017 / NIN, rounded) */
  const NUT = {
    'Roti / chapati': [110, 3, 18], 'Phulka': [80, 1, 15], 'Paratha (plain)': [230, 9, 32], 'Aloo paratha': [290, 11, 40], 'Paneer paratha': [330, 15, 35], 'Methi thepla': [140, 5, 20], 'Puri': [100, 6, 10], 'Naan': [260, 5, 45], 'Missi roti': [150, 5, 20], 'Makki roti': [150, 5, 25], 'Bajra roti': [130, 4, 22], 'Jowar bhakri': [120, 2, 23], 'Bread slice (brown)': [70, 1, 12],
    'Rice (cooked)': [195, 0.5, 43], 'Jeera rice': [230, 5, 42], 'Veg pulao': [330, 9, 55], 'Veg biryani': [420, 14, 60], 'Chicken biryani': [500, 18, 55], 'Khichdi': [210, 5, 33], 'Curd rice': [220, 6, 33], 'Lemon rice': [250, 8, 40], 'Quinoa (cooked)': [180, 3, 32],
    'Dal (toor / arhar)': [150, 4, 20], 'Moong dal': [140, 3, 19], 'Masoor dal': [150, 4, 20], 'Chana dal': [180, 5, 24], 'Dal makhani': [260, 15, 22], 'Rajma': [210, 7, 28], 'Chole / chana masala': [240, 9, 30], 'Kadhi': [160, 9, 13], 'Sambar': [130, 4, 18], 'Sprouts salad': [110, 1, 18], 'Lobia': [190, 5, 26],
    'Aloo sabzi': [170, 8, 22], 'Aloo gobi': [150, 8, 16], 'Bhindi': [120, 8, 10], 'Baingan bharta': [130, 9, 11], 'Palak sabzi': [100, 7, 7], 'Mixed veg': [130, 7, 13], 'Lauki / tori': [80, 5, 8], 'Cabbage / patta gobi': [90, 5, 9], 'Matar mushroom': [150, 8, 13], 'Aloo matar': [180, 8, 22], 'Soya chunks curry': [210, 8, 15], 'Green salad': [40, 0.3, 8],
    'Paneer (raw)': [265, 20, 4], 'Palak paneer': [270, 20, 10], 'Paneer bhurji': [300, 22, 8], 'Matar paneer': [290, 20, 14], 'Curd / dahi': [90, 4.5, 7], 'Greek yogurt / hung curd': [75, 3, 5], 'Raita': [80, 3, 8], 'Milk': [150, 8, 12], 'Buttermilk / chaas': [40, 1, 5], 'Lassi': [220, 6, 35], 'Cheese slice': [60, 4.5, 1], 'Tofu': [80, 4.5, 2],
    'Egg (boiled)': [75, 5, 0.6], 'Omelette (2 eggs)': [190, 14, 2], 'Egg bhurji (2 eggs)': [220, 16, 4], 'Egg curry (2 eggs)': [250, 18, 8], 'Chicken curry': [250, 14, 6], 'Chicken breast (cooked)': [165, 3.6, 0], 'Tandoori chicken': [260, 13, 4], 'Fish curry': [220, 12, 6], 'Mutton curry': [300, 20, 6], 'Prawns': [105, 1.5, 1],
    'Poha': [250, 8, 40], 'Upma': [250, 9, 36], 'Idli': [60, 0.4, 12], 'Dosa (plain)': [130, 4, 20], 'Masala dosa': [330, 13, 45], 'Uttapam': [200, 6, 30], 'Besan chilla': [150, 6, 17], 'Moong dal chilla': [140, 4, 18], 'Oats (with milk)': [250, 7, 35], 'Daliya (with milk)': [230, 6, 38], 'Cornflakes with milk': [230, 4, 40], 'Sandwich (veg)': [250, 9, 33], 'Medu vada': [130, 8, 12],
    'Roasted chana': [110, 2, 18], 'Peanuts': [170, 14, 5], 'Almonds': [70, 6, 2.5], 'Makhana (roasted)': [100, 1, 20], 'Dhokla': [150, 6, 20], 'Samosa': [260, 17, 24], 'Pakora': [200, 13, 16], 'Bhel puri': [250, 8, 40], 'Biscuits': [140, 6, 20], 'Peanut butter': [95, 8, 3], 'Protein / whey shake': [120, 1.5, 3], 'Soya chunks (dry)': [105, 0.2, 10],
    'Banana': [105, 0.4, 27], 'Apple': [95, 0.3, 25], 'Orange': [60, 0.2, 15], 'Papaya': [60, 0.4, 15], 'Guava': [70, 1, 15], 'Mango': [200, 1, 50], 'Seasonal fruit bowl': [90, 0.4, 22],
    'Tea with milk': [60, 2, 9], 'Coffee with milk': [80, 3, 10], 'Coconut water': [45, 0.5, 9], 'Kheer': [220, 7, 33], 'Halwa': [300, 15, 38], 'Gulab jamun': [150, 7, 20],
  };
  const DEFAULT_FOODS = Object.keys(FOODS).flatMap(c => FOODS[c].map(x => { const n = NUT[x[0]] || []; return { name: x[0], serving: x[1], p: x[2], kcal: n[0], fat: n[1], carb: n[2], cat: c }; }));
  const allFoods = () => {
    const mine = (LS().foods || []).map(f => Object.assign({ mine: true }, f));
    const names = new Set(mine.map(f => f.name.toLowerCase()));
    return mine.concat(DEFAULT_FOODS.filter(f => !names.has(f.name.toLowerCase())));   // your version of a food wins
  };
  const food = name => { const n = String(name || '').toLowerCase(); return allFoods().find(f => f.name.toLowerCase() === n) || null; };
  const mealItems = (d, k) => { const v = (LS().meals[d] || {})[k]; return Array.isArray(v) ? v : v ? [{ f: String(v), q: 1 }] : []; };
  const prot = list => list.reduce((a, x) => { const f = food(x.f); return a + (f ? f.p * (+x.q || 0) : 0); }, 0);
  /* totals of a list of foods: kcal, protein, fat, carbs, and how many foods have no calories yet */
  const tot = list => list.reduce((a, x) => {
    const f = food(x.f), q = +x.q || 0;
    if (!f) { a.unk++; return a; }
    a.p += (+f.p || 0) * q;
    if (f.kcal == null || f.kcal === '') a.unk++; else { a.kcal += +f.kcal * q; a.fat += (+f.fat || 0) * q; a.carb += (+f.carb || 0) * q; }
    return a;
  }, { kcal: 0, p: 0, fat: 0, carb: 0, unk: 0 });
  const dayTot = d => { const out = { kcal: 0, p: 0, fat: 0, carb: 0, unk: 0 }; MEALS.forEach(m => { const t = tot(mealItems(d, m[0])); Object.keys(out).forEach(k => { out[k] += t[k]; }); }); return out; };
  const g1 = n => Math.round(n * 10) / 10;
  const need = () => { const t = LI.targets(); return t ? t.p : 0; };
  /* 1.16: calorie, protein, fat and carb targets from your body and your goal
     BMR: Mifflin-St Jeor; × activity; a deficit of (kg a week × 7700) ÷ 7 to lose (at most 25 %), a small surplus to gain */
  const ACT = [[1.2, 'Mostly sitting (desk work, little walking)'], [1.375, 'Lightly active (walks, 1–3 workouts a week)'], [1.55, 'Moderately active (3–5 workouts a week)'], [1.725, 'Very active (6–7 hard workouts a week)'], [1.9, 'Extra active (physical job + training)']];
  const PACE = [[0.25, '0.25 kg a week (gentle)'], [0.5, '0.5 kg a week (recommended)'], [0.75, '0.75 kg a week (fast)'], [1, '1 kg a week (only with a doctor)']];
  LI.targets = () => {
    const l = LS(), w = +l.weight || 0, h = +l.height || 0, age = +l.age || 0, sex = l.sex || 'm', act = +l.act || 1.375, gw = +l.goalWeight || 0, pace = +l.pace || 0.5;
    if (!w) return null;
    const bmi = h ? w / Math.pow(h / 100, 2) : null;
    const bmr = h && age ? 10 * w + 6.25 * h - 5 * age + (sex === 'f' ? -161 : 5) : null;
    const tdee = bmr ? bmr * act : w * 30 * act / 1.375;          // without height and age: about 30 kcal per kg, lightly active
    const mode = gw && gw < w - 0.4 ? 'lose' : gw && gw > w + 0.4 ? 'gain' : 'keep';
    let kcal = tdee, note = '';
    if (mode === 'lose') { const def = Math.min(pace * 7700 / 7, tdee * 0.25); kcal = Math.max(tdee - def, bmr || 0, sex === 'f' ? 1200 : 1500); note = 'a deficit of about ' + Math.round(tdee - kcal) + ' kcal a day'; }
    else if (mode === 'gain') { kcal = tdee + Math.min(pace * 7700 / 7, 400); note = 'a surplus of about ' + Math.round(kcal - tdee) + ' kcal a day for lean gain'; }
    const perKg = +l.perKg || (mode === 'gain' ? 1.6 : mode === 'lose' ? 1.2 : 0.83);
    const p = Math.round(w * perKg);
    const fat = Math.max(Math.round(w * 0.6), Math.round(kcal * 0.27 / 9));
    const carb = Math.max(0, Math.round((kcal - p * 4 - fat * 9) / 4));
    const weeks = mode !== 'keep' ? Math.ceil(Math.abs(w - gw) / pace) : 0;
    return { w, h, bmi, bmr, tdee: Math.round(tdee), kcal: Math.round(kcal / 10) * 10, p, fat, carb, satfat: Math.round(kcal * 0.1 / 9), fibre: Math.round(kcal / 1000 * 14), mode, note, weeks, gw, pace,
      healthy: h ? [Math.round(18.5 * Math.pow(h / 100, 2)), Math.round(22.9 * Math.pow(h / 100, 2))] : null, exact: !!bmr };
  };
  const bmiWord = b => b < 18.5 ? 'underweight' : b < 23 ? 'healthy' : b < 25 ? 'overweight (Asian cut-off 23)' : b < 30 ? 'obese class I (Asian cut-off 25)' : 'obese';
  const PERKG = [[0.83, '0.83 g/kg — adult RDA (ICMR-NIN), little activity'], [1.0, '1.0 g/kg — moderately active'], [1.2, '1.2 g/kg — active / walking, yoga'], [1.6, '1.6 g/kg — strength training, building muscle'], [2.0, '2.0 g/kg — heavy training, keeping muscle while losing fat']];

  /* Grocery → right page (1.16): the list's notes and a summary; the meal plan moved to Weekly meals */
  LI.grocRight = () => {
    const g = glist(), dt = dayTot(new Date().getDay()), t = LI.targets();
    const cats = {}; (g ? g.items : []).forEach(i => { const c = i.cat || 'Other'; cats[c] = cats[c] || { n: 0, done: 0, amt: 0 }; cats[c].n++; if (i.done) cats[c].done++; cats[c].amt += num(i.price); });
    const total = g ? g.items.reduce((a, i) => a + num(i.price), 0) : 0;
    const body = LI.stockHtml() + (g ? '<h3 class="gh fin-gap">This list</h3><div class="tiles xp-tiles">' + FX().tile('Items', String(g.items.length), g.items.filter(i => i.done).length + ' bought') + FX().tile('Total', total ? '₹' + Math.round(total).toLocaleString('en-IN') : '—', g.budget ? 'budget ₹' + Math.round(g.budget).toLocaleString('en-IN') : 'add prices to see it', g.budget && total > g.budget ? 'warn' : '') + '</div>' +
      (Object.keys(cats).length ? '<table class="mm-table"><thead><tr><th>Group</th><th>Items</th><th>Bought</th><th>₹</th></tr></thead><tbody>' + Object.keys(cats).map(c => '<tr><td>' + e(c) + '</td><td class="num">' + cats[c].n + '</td><td class="num">' + cats[c].done + '</td><td class="num">' + (cats[c].amt ? Math.round(cats[c].amt).toLocaleString('en-IN') : '—') + '</td></tr>').join('') + '</tbody></table>' : '') +
      '<h4 class="ls-gh">Notes for “' + e(g.name || 'this list') + '”</h4><textarea class="field ls-notes" rows="5" data-change="ls-groc-notes" placeholder="Shop, offers, things to check at home…">' + e(g.notes || '') + '</textarea>' : '<p class="hint">Make a grocery list on the left.</p>') +
      '<div class="ml-moved"><span class="ml-moved-i" aria-hidden="true">🥗</span><div><b>Meal plan, protein and calories</b><span class="hint">Today: ' + Math.round(dt.kcal) + (t ? ' / ' + t.kcal : '') + ' kcal · ' + Math.round(dt.p) + (t ? ' / ' + t.p : '') + ' g protein</span></div>' +
      '<button type="button" class="btn small primary" data-act="career-mode" data-mode="meals">Open Weekly meals ' + ED.icon('chevR') + '</button></div>';
    return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">List summary &amp; notes</h2></div><div class="ls-scroll scroll" data-keep-scroll="ls-groc-r">' + body + '</div></div>';
  };
  LI.editFood = (name, then) => {
    const l = LS(); l.foods = l.foods || [];
    const x = l.foods.find(f => f.name.toLowerCase() === String(name || '').toLowerCase());
    const base = x || food(name) || { name: name || '', serving: '1 katori', p: null, cat: 'My foods' };
    FX().form({
      title: x ? 'My food' : 'Add a food',
      data: { name: base.name, serving: base.serving, p: base.p, kcal: base.kcal, fat: base.fat, carb: base.carb, cat: base.cat && base.cat !== 'My foods' ? base.cat : '' },
      fields: [{ k: 'name', label: 'Food', req: true, ph: 'e.g. Rajma chawal, Besan ladoo' }, { k: 'serving', label: 'One serving is', ph: '1 katori, 1 piece, 100 g' },
        { k: 'p', label: 'Protein in one serving (g)', type: 'number', min: 0, step: 0.5, req: true, hint: 'From the pack label, or roughly: dal katori 7 g, roti 3 g, egg 6 g, 100 g paneer 18 g' },
        { k: 'kcal', label: 'Calories in one serving (kcal)', type: 'number', min: 0, step: 5, hint: 'Roti ≈ 110, katori dal ≈ 150, katori rice ≈ 195, egg ≈ 75, glass of milk ≈ 150, 100 g paneer ≈ 265' },
        { k: 'fat', label: 'Fat in one serving (g)', type: 'number', min: 0, step: 0.5 }, { k: 'carb', label: 'Carbohydrate in one serving (g)', type: 'number', min: 0, step: 0.5 },
        { k: 'cat', label: 'Group (optional)', list: Object.keys(FOODS) }],
      del: x ? async () => { l.foods = l.foods.filter(f => f !== x); ED.store.commit(); ED.ui.toast('Removed from my foods'); } : null, delLabel: 'Remove',
      save(v, api) {
        ED.store.checkpoint('Food');
        const old = l.foods.find(f => f.name.toLowerCase() === v.name.toLowerCase());
        if (old) Object.assign(old, v, { updatedAt: Date.now() }); else l.foods.push(Object.assign({ id: U.uid('fd'), updatedAt: Date.now() }, v));
        ED.store.commit(); api.close(); ED.ui.toast(v.name + ' is in the food list');
        if (then) then(v.name);
      },
    });
  };
  LI.editGroc = id => {
    const l = LS(), x = id ? l.groc.find(g => g.id === id) : null;
    FX().form({
      title: x ? 'Grocery list' : 'New grocery list',
      data: x || { name: 'Groceries — ' + U.fmtShort(U.today()), date: U.today() },
      fields: [{ k: 'name', label: 'Name', req: true }, { k: 'date', label: 'Shopping date', type: 'date' }, { k: 'budget', label: 'Budget (₹)', type: 'number', min: 0 }],
      extra: x ? '' : '<label class="switch ls-copyprev"><input type="checkbox" id="ls-copyprev"' + (l.groc.length ? ' checked' : ' disabled') + '><span class="track"></span><span>Copy items from the last list</span></label>',
      delLabel: 'Delete list',
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Delete list', message: 'Delete “' + x.name + '”?', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Delete list'); l.groc = l.groc.filter(g => g.id !== x.id); st().groc = null; ED.store.commit(); ED.ui.undoToast('List deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint(x ? 'Grocery list' : 'New grocery list');
        if (x) { Object.assign(x, v); touch(x); }
        else {
          const cp = api.el.querySelector('#ls-copyprev'), prev = l.groc[l.groc.length - 1];
          const n = Object.assign({ id: U.uid('gl'), items: cp && cp.checked && prev ? prev.items.map(i => Object.assign({}, i, { id: U.uid('gi'), done: false })) : [], notes: '', createdAt: Date.now(), updatedAt: Date.now() }, v);
          l.groc.push(n); st().groc = n.id;
        }
        ED.store.commit(); api.close();
      },
    });
  };

  /* ---------------- shared actions ---------------- */
  const owner = kind => kind === 'trip' ? trip() : glist();
  const item = (kind, id) => { const o = owner(kind); return o ? [o, o.items.find(i => i.id === id)] : [null, null]; };
  F['ls-add'] = f => {
    const kind = f.dataset.kind, o = owner(kind); if (!o) return;
    const v = n => (f.elements[n] ? f.elements[n].value.trim() : '');
    if (!v('text')) { f.elements.text.focus(); return; }
    o.items.push({ id: U.uid(kind === 'trip' ? 'ti' : 'gi'), text: v('text'), qty: v('qty'), cat: v('cat') || 'Other', unit: kind === 'groc' ? v('unit') : undefined, price: kind === 'groc' && v('price') ? num(v('price')) : undefined, done: false });
    touch(o); ED.store.commit();
    setTimeout(() => { const x = document.querySelector('form[data-form="ls-add"] [name="text"]'); if (x) x.focus(); }, 30);
  };
  CH['ls-done'] = el => { const [o, i] = item(el.dataset.kind, el.dataset.id); if (!i) return; i.done = el.checked; touch(o); ED.store.commit(); };
  CH['ls-edit'] = el => {
    const [o, i] = item(el.dataset.kind, el.dataset.id); if (!i) return;
    const f = el.dataset.f, v = el.value.trim();
    if (f === 'text' && !v) { el.value = i.text; return; }
    i[f] = f === 'price' ? (v === '' ? undefined : num(v)) : v;
    touch(o); ED.store.commit({ silent: f !== 'price' });
  };
  A['ls-del'] = el => { const [o, i] = item(el.dataset.kind, el.dataset.id); if (!i) return; ED.store.checkpoint('Remove item'); o.items = o.items.filter(x => x !== i); touch(o); ED.store.commit(); ED.ui.undoToast('Removed: ' + i.text); };
  A['ls-uncheck'] = el => { const o = owner(el.dataset.kind); if (!o) return; o.items.forEach(i => { i.done = false; }); touch(o); ED.store.commit(); };
  A['ls-usual'] = el => {
    const kind = el.dataset.kind, o = owner(kind); if (!o) return;
    const have = new Set(o.items.map(i => i.text.toLowerCase()));
    const add = kind === 'trip' ? usualTrip(days(o)).map(x => ({ id: U.uid('ti'), cat: x[0], text: x[1], qty: String(x[2]), done: false }))
      : usualGroc.map(x => ({ id: U.uid('gi'), cat: x[0], text: x[1], qty: x[2], unit: x[3], done: false }));
    const fresh = add.filter(x => !have.has(x.text.toLowerCase()));
    ED.store.checkpoint('Add usual list'); o.items = o.items.concat(fresh); touch(o); ED.store.commit();
    ED.ui.undoToast(fresh.length ? U.plural(fresh.length, 'item') + ' added — change or remove any of them' : 'They are all on the list already');
  };
  A['ls-copy'] = async el => {
    const kind = el.dataset.kind, o = owner(kind); if (!o) return;
    const cats = kind === 'trip' ? tripCats(o) : grocCats(o);
    const lines = [o.name || ''];
    cats.forEach(c => { const rows = o.items.filter(i => (i.cat || 'Other') === c); if (!rows.length) return; lines.push('', c.toUpperCase()); rows.forEach(i => lines.push((i.done ? '☑ ' : '☐ ') + i.text + (i.qty ? ' × ' + i.qty + (i.unit ? ' ' + i.unit : '') : ''))); });
    ED.ui.toast(await U.copy(lines.join('\n').trim()) ? 'List copied — paste it in WhatsApp or a note' : 'Could not copy');
  };
  A['ls-trip'] = el => { st().trip = el.dataset.id; ED.app.render(); };
  A['ls-trip-new'] = () => LI.editTrip(null);
  A['ls-trip-edit'] = () => { const t = trip(); if (t) LI.editTrip(t.id); };
  A['ls-groc-new'] = () => LI.editGroc(null);
  A['ls-groc-edit'] = () => { const g = glist(); if (g) LI.editGroc(g.id); };
  A['ls-clear-done'] = () => { const g = glist(); if (!g) return; const n = g.items.filter(i => i.done).length; if (!n) { ED.ui.toast('Nothing ticked as bought'); return; } ED.store.checkpoint('Remove bought'); g.items = g.items.filter(i => !i.done); touch(g); ED.store.commit(); ED.ui.undoToast(U.plural(n, 'item') + ' removed'); };
  CH['ls-groc-pick'] = el => { st().groc = el.value; ED.app.render(); };
  CH['ls-groc-notes'] = el => { const g = glist(); if (!g) return; g.notes = el.value; touch(g); ED.store.commit({ silent: true }); };
  CH['ls-meal'] = el => { const m = LS().meals; const d = el.dataset.d; m[d] = Object.assign({}, m[d] || {}, { [el.dataset.m]: el.value.trim() }); ED.store.commit({ silent: true }); };
  const setMeal = (d, k, list) => { const m = LS().meals; m[d] = Object.assign({}, m[d] || {}, { [k]: list }); };
  CH['ls-fadd'] = el => {
    const d = el.dataset.d, k = el.dataset.m, v = el.value; el.value = '';
    if (!v) return;
    if (v === '__new') { LI.editFood('', name => { setMeal(d, k, mealItems(d, k).concat([{ f: name, q: 1 }])); ED.store.commit(); }); return; }
    const list = mealItems(d, k), same = list.find(x => x.f === v);
    if (same) same.q = (+same.q || 0) + 1; else list.push({ f: v, q: 1 });
    setMeal(d, k, list); ED.store.commit();
  };
  CH['ls-fq'] = el => { const d = el.dataset.d, k = el.dataset.m, list = mealItems(d, k), it = list[+el.dataset.i]; if (!it) return; it.q = Math.max(0, +el.value || 0); setMeal(d, k, list); ED.store.commit(); };
  A['ls-fdel'] = el => { const d = el.dataset.d, k = el.dataset.m, list = mealItems(d, k); list.splice(+el.dataset.i, 1); setMeal(d, k, list); ED.store.commit(); };
  A['ls-mday'] = el => { st().mday = +el.dataset.d; ED.app.render(); };
  A['ls-food-new'] = el => LI.editFood(el && el.dataset && el.dataset.name || '');
  A['ls-foods'] = el => ED.ui.menu(el, (LS().foods || []).map(f => ({ label: f.name + ' — ' + g1(+f.p || 0) + ' g protein' + (f.kcal != null && f.kcal !== '' ? ' · ' + Math.round(f.kcal) + ' kcal' : ' · no calories yet'), icon: 'pencil', onClick: () => LI.editFood(f.name) })));
  A['ls-mcopy'] = async () => {
    const s = st(), day = s.mday != null ? +s.mday : new Date().getDay();
    if (!await ED.ui.confirm({ title: 'Copy to every day', message: 'Use ' + U.DAYS[day] + '’s meals for every day of the week?', ok: 'Copy' })) return;
    ED.store.checkpoint('Copy meals'); const src = LS().meals[day] || {};
    for (let d = 0; d < 7; d++) if (d !== day) LS().meals[d] = JSON.parse(JSON.stringify(src));
    ED.store.commit(); ED.ui.undoToast('Copied to every day');
  };
  CH['ls-weight'] = el => { const v = parseFloat(el.value); LS().weight = v > 0 ? v : null; ED.store.commit(); };
  CH['ls-perkg'] = el => { LS().perKg = el.value === '' ? null : +el.value; ED.store.commit(); };
  CH['ls-prof'] = el => { const k = el.dataset.k, v = el.value; LS()[k] = k === 'sex' ? v : v === '' ? null : parseFloat(v); ED.store.commit(); };
  A['ls-meals-clear'] = async () => { if (!await ED.ui.confirm({ title: 'Clear the meal plan', message: 'Empty all the meals for the week?', ok: 'Clear' })) return; ED.store.checkpoint('Clear meals'); LS().meals = {}; ED.store.commit(); ED.ui.undoToast('Meal plan cleared'); };
  /* ---------------- Weekly meals: the meal plan as a chart for one week (read only) ---------------- */
  const wstart = () => st().mw || (st().mw = U.startOfWeek(U.today(), ED.store.data.settings.weekStart || 0));
  const short = list => list.map(x => (+x.q && +x.q !== 1 ? x.q + '× ' : '') + x.f).join(', ');
  const dayProt = d => MEALS.reduce((a, x) => a + prot(mealItems(d, x[0])), 0);
  const wdays = () => U.range(wstart(), 7);
  const wlabel = () => { const d = wdays(); return U.fmtShort(d[0]) + ' – ' + U.fmtShort(d[6]); };
  const nav = () => '<div class="ls-mnav"><button type="button" class="icon-btn" data-act="ls-mm" data-dir="-1" aria-label="Previous week">' + ED.icon('chevL') + '</button><b>' + e(wlabel()) + '</b>' +
    '<button type="button" class="icon-btn" data-act="ls-mm" data-dir="1" aria-label="Next week">' + ED.icon('chevR') + '</button><button type="button" class="btn small ghost" data-act="ls-mm" data-dir="0">This week</button></div>';
  /* ---------------- Weekly meals (1.16): plan the week's meals with calories, protein, fat and carbs ---------------- */
  const pct = (have, want) => want ? Math.min(100, Math.round(have / want * 100)) : 0;
  const meterRow = (label, have, want, unit, cls) => '<div class="ml-meter ' + (cls || '') + '"><span class="ml-ml">' + label + '</span><span class="ml-bar' + (want && have > want * 1.08 && cls !== 'p' ? ' over' : want && have >= want * 0.92 ? ' ok' : '') + '"><i style="width:' + pct(have, want) + '%"></i></span><span class="num ml-mv">' + Math.round(have) + (want ? ' / ' + want : '') + ' ' + unit + '</span></div>';
  const fmtq = q => (+q === 0.5 ? '½' : +q === 1.5 ? '1½' : String(+q));
  LI.mealMonthLeft = head => {
    const l = LS(), s = st(), today = new Date().getDay(), t = LI.targets();
    const wk = wdays(), order = wk.map(k => U.dow(k));
    const day = s.mday != null ? +s.mday : today;
    const cats = {}; allFoods().forEach(f => { const c = f.mine ? 'My foods' : f.cat; (cats[c] = cats[c] || []).push(f); });
    const picker = (d, k) => '<select class="field ls-fpick" data-change="ls-fadd" data-d="' + d + '" data-m="' + k + '" aria-label="Add a food"><option value="">＋ Add food…</option>' +
      Object.keys(cats).map(c => '<optgroup label="' + e(c) + '">' + cats[c].map(f => opt(f.name, f.name + ' — ' + f.serving + ' · ' + (f.kcal != null && f.kcal !== '' ? Math.round(f.kcal) + ' kcal · ' : '') + g1(f.p) + ' g protein', false)).join('') + '</optgroup>').join('') +
      '<option value="__new">✎ A food not in the list…</option></select>';
    const strip = '<div class="ml-week" role="group" aria-label="Day">' + order.map(d => {
      const x = dayTot(d), k = wk.find(z => U.dow(z) === d);
      return '<button type="button" class="ml-wd' + (d === day ? ' sel' : '') + (d === today ? ' today' : '') + (t && x.p >= t.p * 0.95 ? ' pok' : '') + '" data-act="ls-mday" data-d="' + d + '" aria-pressed="' + (d === day) + '"><b>' + U.DAY3[d] + ' <span class="hint num">' + (k ? +k.slice(8) : '') + '</span></b>' +
        '<span class="num ml-k">' + Math.round(x.kcal) + '<small> kcal</small></span><span class="num ml-p">' + Math.round(x.p) + ' g P</span>' +
        (t ? '<span class="ml-mini"><i class="k" style="width:' + pct(x.kcal, t.kcal) + '%"></i></span><span class="ml-mini"><i class="p" style="width:' + pct(x.p, t.p) + '%"></i></span>' : '') + '</button>';
    }).join('') + '</div>';
    const dt = dayTot(day);
    const sum = '<div class="ml-daysum"><div class="ml-dsh"><b>' + U.DAYS[day] + '</b>' + (t ? '<span class="hint">targets from your numbers on the right</span>' : '<span class="hint">enter your weight on the right for targets</span>') + '</div>' +
      meterRow('Calories', dt.kcal, t && t.kcal, 'kcal', 'k') + meterRow('Protein', dt.p, t && t.p, 'g', 'p') + meterRow('Fat', dt.fat, t && t.fat, 'g', 'f') + meterRow('Carbs', dt.carb, t && t.carb, 'g', 'c') +
      (dt.unk ? '<p class="hint">' + U.plural(dt.unk, 'food') + ' without calories yet — click “add calories” beside it.</p>' : '') + '</div>';
    const meals = MEALS.map(x => {
      const items = mealItems(day, x[0]), mt = tot(items);
      return '<section class="ls-meal ml-meal m-' + x[0] + '"><h4 class="ls-gh"><span class="ml-mi" aria-hidden="true">' + MICON[x[0]] + '</span>' + x[1] + ' <span class="hint num">' + Math.round(mt.kcal) + ' kcal · ' + g1(mt.p) + ' g protein · ' + g1(mt.fat) + ' g fat</span></h4>' +
        '<ul class="ls-list">' + items.map((it, i) => { const f = food(it.f), q = +it.q || 0; const nk = f && f.kcal != null && f.kcal !== ''; return '<li class="ls-row' + (f ? '' : ' unk') + '"><input type="number" class="ls-in ls-q num" min="0" step="0.5" value="' + e(it.q) + '" data-change="ls-fq" data-d="' + day + '" data-m="' + x[0] + '" data-i="' + i + '" aria-label="Servings">' +
          '<span class="ls-text">× ' + e(it.f) + (f ? ' <span class="hint">(' + e(f.serving) + ')</span>' : '') + (!f || !nk ? ' <button type="button" class="link-btn" data-act="ls-food-new" data-name="' + e(it.f) + '">' + (f ? 'add calories' : 'add its nutrition') + '</button>' : '') + '</span>' +
          '<span class="num ls-p">' + (nk ? Math.round(f.kcal * q) + ' kcal' : '—') + '</span><span class="num ls-p">' + (f ? g1(f.p * q) + ' g' : '—') + '</span>' +
          '<button type="button" class="icon-btn sm" data-act="ls-fdel" data-d="' + day + '" data-m="' + x[0] + '" data-i="' + i + '" aria-label="Remove ' + e(it.f) + '">' + ED.icon('x') + '</button></li>'; }).join('') + '</ul>' + picker(day, x[0]) + '</section>';
    }).join('');
    const np = (LS().mealPlans || []).length;
    const tools = '<div class="ls-tools ml-save"><button type="button" class="btn small primary" data-act="mp-save">' + ED.icon('download') + 'Save plan…</button><button type="button" class="btn small" data-act="mp-open">' + ED.icon('list') + 'Saved plans' + (np ? ' (' + np + ')' : '') + '</button></div>' +
      '<div class="ls-tools"><button type="button" class="btn small ghost" data-act="ls-food-new">' + ED.icon('plus') + 'Add a new food</button>' + ((l.foods || []).length ? '<button type="button" class="btn small ghost" data-act="ls-foods">My foods (' + l.foods.length + ')</button>' : '') +
      '<button type="button" class="btn small ghost" data-act="ls-mcopy">' + ED.icon('copy') + 'Copy ' + U.DAY3[day] + ' to every day</button><button type="button" class="btn small ghost" data-act="ls-meals-clear">Clear week</button></div>' +
      '<p class="hint">Values are approximate for usual home portions (IFCT / NIN); change any food with “Add a new food” using the same name. A general guide, not medical advice.</p>';
    return wrap(head, '<div class="ml-head"><h3 class="ml-title">Meal plan · nutrition</h3><span class="hint">Pick a day, add foods to each meal — calories, protein, fat and carbs add up.</span></div>' + strip + sum + meals + tools, 'ls-mm-l');
  };
  LI.mealMonthRight = () => {
    const l = LS(), t = LI.targets(), days = wdays();
    const f = (k, label, input) => '<label class="ml-f"><span>' + label + '</span>' + input + '</label>';
    const numIn = (k, ph, min, max, step) => '<input type="number" class="field num" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" value="' + e(l[k] || '') + '" data-change="ls-prof" data-k="' + k + '" placeholder="' + ph + '">';
    const ex = ED.exercise, burnT = ex && ex.burnOn ? ex.burnOn(U.today()) : 0;
    const prof = '<div class="ml-prof">' +
      f('weight', 'Weight now (kg)', numIn('weight', 'kg', 20, 250, 0.5)) + f('goalWeight', 'Weight I want (kg)', numIn('goalWeight', 'kg', 30, 250, 0.5)) +
      f('height', 'Height (cm)', numIn('height', 'cm', 100, 230)) + f('age', 'Age', numIn('age', 'years', 14, 100)) +
      f('sex', 'Sex', '<select class="field" data-change="ls-prof" data-k="sex">' + opt('m', 'Male', (l.sex || 'm') === 'm') + opt('f', 'Female', l.sex === 'f') + '</select>') +
      f('act', 'Activity', '<select class="field" data-change="ls-prof" data-k="act">' + ACT.map(a => opt(a[0], a[1], +(l.act || 1.375) === a[0])).join('') + '</select>') +
      f('pace', 'Change per week', '<select class="field" data-change="ls-prof" data-k="pace">' + PACE.map(a => opt(a[0], a[1], +(l.pace || 0.5) === a[0])).join('') + '</select>') +
      f('perKg', 'Protein', '<select class="field" data-change="ls-perkg">' + opt('', 'Suggested for my goal', !l.perKg) + PERKG.map(x => opt(x[0], x[1], +l.perKg === x[0])).join('') + '</select>') + '</div>';
    let targ;
    if (!t) targ = '<p class="hint">Enter your weight (and height and age for an exact figure) to see how many calories, and how much protein, fat and carbohydrate, you need.</p>';
    else {
      const goalLine = t.mode === 'lose' ? 'To go from <b>' + t.w + ' kg</b> to <b>' + t.gw + ' kg</b> at ' + t.pace + ' kg a week: about <b>' + t.weeks + ' weeks</b> (' + e(U.fmtShort(U.addDays(U.today(), t.weeks * 7))) + '), with ' + e(t.note) + '.'
        : t.mode === 'gain' ? 'To go from <b>' + t.w + ' kg</b> to <b>' + t.gw + ' kg</b>: about <b>' + t.weeks + ' weeks</b> with ' + e(t.note) + ' and strength training (see Exercise).'
        : 'Calories to keep your weight' + (t.gw ? '' : ' (enter the weight you want to plan a change)') + '.';
      targ = '<div class="ml-targets"><div class="ml-tg k"><span>Calories</span><b class="num">' + t.kcal.toLocaleString('en-IN') + '</b><i>kcal a day</i></div><div class="ml-tg p"><span>Protein</span><b class="num">' + t.p + ' g</b><i>' + Math.round(t.p * 4 / t.kcal * 100) + '% of kcal</i></div>' +
        '<div class="ml-tg f"><span>Fat</span><b class="num">' + t.fat + ' g</b><i>saturated under ' + t.satfat + ' g</i></div><div class="ml-tg c"><span>Carbs</span><b class="num">' + t.carb + ' g</b><i>fibre ' + t.fibre + ' g+</i></div></div>' +
        '<p class="ml-goal">' + goalLine + '</p>' +
        '<ul class="ml-facts">' + (t.bmr ? '<li>Your body burns about <b>' + Math.round(t.bmr) + ' kcal</b> at rest (BMR) and <b>' + t.tdee + ' kcal</b> with your activity.</li>' : '<li>Add your height and age for an exact figure; this one assumes about 30 kcal per kg.</li>') +
        (t.bmi ? '<li>BMI <b>' + (Math.round(t.bmi * 10) / 10) + '</b> — ' + e(bmiWord(t.bmi)) + (t.healthy ? '; a healthy weight for your height is about <b>' + t.healthy[0] + '–' + t.healthy[1] + ' kg</b> (Asian cut-offs).' : '') + '</li>' : '') +
        (burnT ? '<li>Burned in exercise and steps today: <b>' + burnT + ' kcal</b> (from Exercise). Your activity level already counts usual exercise — eat to the target, not back the burn.</li>' : '') +
        '<li>Never go below ' + (l.sex === 'f' ? '1,200' : '1,500') + ' kcal a day without a doctor. Fat about 25–30% of calories, mostly from nuts, seeds, mustard / groundnut oil, curd; little ghee, butter and fried food.</li></ul>';
    }
    const rows = days.map(k => { const d = U.dow(k), x = dayTot(d); const cell = (v, w, u, cls) => '<td class="num' + (w ? (cls === 'p' ? (v >= w * 0.95 ? ' ok-text' : ' short') : (v > w * 1.08 ? ' short' : v >= w * 0.9 ? ' ok-text' : '')) : '') + '">' + Math.round(v) + (u || '') + '</td>';
      return '<tr' + (k === U.today() ? ' class="today"' : '') + '><th class="num">' + U.DAY3[d] + ' ' + +k.slice(8) + '</th>' + MEALS.map(m => '<td>' + e(short(mealItems(d, m[0]))) + '</td>').join('') + cell(x.kcal, t && t.kcal, '', 'k') + cell(x.p, t && t.p, ' g', 'p') + cell(x.fat, t && t.fat, ' g', 'f') + cell(x.carb, t && t.carb, ' g', 'c') + '</tr>'; }).join('');
    const avg = days.reduce((a, k) => { const x = dayTot(U.dow(k)); a.k += x.kcal / 7; a.p += x.p / 7; return a; }, { k: 0, p: 0 });
    const body = '<h3 class="gh">My numbers</h3>' + prof + '<h3 class="gh fin-gap">What I need each day</h3>' + targ +
      '<h3 class="gh fin-gap" id="mp-saved">Saved plans <span class="hint">· use a week or a day again</span></h3>' + LI.mealPlansHtml() +
      '<h3 class="gh fin-gap">This week’s insights</h3>' + LI.mealInsights() +
      '<h3 class="gh fin-gap">The week at a glance <span class="hint">· average ' + Math.round(avg.k) + ' kcal and ' + Math.round(avg.p) + ' g protein a day</span></h3>' +
      '<div class="ml-tablewrap"><table class="mm-table ml-table"><thead><tr><th>Day</th>' + MEALS.map(x => '<th>' + x[1] + '</th>').join('') + '<th>kcal</th><th>Protein</th><th>Fat</th><th>Carbs</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="hint">Green: on target · red: short of protein, or more than 8% over calories or fat.</p>';
    return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">Targets &amp; weekly chart</h2><button type="button" class="btn small ghost" data-act="ls-mm-copy">' + ED.icon('copy') + 'Copy chart</button></div>' +
      '<div class="ls-scroll scroll" data-keep-scroll="ls-mm-r">' + body + '</div></div>';
  };
  A['ls-mm'] = el => { const d = +el.dataset.dir; st().mw = d ? U.addDays(wstart(), 7 * d) : null; ED.app.render(); };
  A['ls-mm-copy'] = async () => {
    const lines = ['Meal chart — week of ' + wlabel()];
    wdays().forEach(k => { const d = U.dow(k); const x = dayTot(d); lines.push('', U.DAY3[d] + ' ' + +k.slice(8) + ' (' + Math.round(x.kcal) + ' kcal, ' + Math.round(x.p) + ' g protein, ' + Math.round(x.fat) + ' g fat, ' + Math.round(x.carb) + ' g carbs)'); MEALS.forEach(x => { const t = short(mealItems(d, x[0])); if (t) lines.push('  ' + x[1] + ': ' + t); }); });
    ED.ui.toast(await U.copy(lines.join('\n')) ? 'Meal chart copied' : 'Could not copy');
  };

  /* ---------------- 1.21: home stock — groceries & usables ----------------
     stock: [ { id, name, kind: 'groc' | 'use', have, unit, by (needed by), buy (how much to get), cat, notes, boughtOn, updatedAt } ]
     "→ List" pulls an item into the open grocery list (the list item keeps stockId). When that item is ticked as bought
     — on the list, by its task or by its bill — the bought quantity is added to what you have and the "needed by" date
     is cleared; unticking puts both back (item.stockIn remembers what was changed). */
  const U_CATS = ['Household & cleaning', 'Personal care', 'Kitchen items', 'Electrical & bulbs', 'Stationery', 'Medicines & first aid', 'Gas & fuel', 'Other'];
  const STK = () => { const l = LS(); if (!Array.isArray(l.stock)) l.stock = []; return l.stock; };
  const stOpen = s => { for (const g of LS().groc) for (const i of g.items || []) if (i.stockId === s.id && !i.done) return { g, i }; return null; };
  const stLeft = s => s.by ? U.diffDays(U.today(), s.by) : null;
  const stNeed = s => { const d = stLeft(s); return (d != null && d <= 7) || (s.have !== '' && s.have != null && num(s.have) <= 0); };
  const stState = s => {
    const d = stLeft(s), out = s.have !== '' && s.have != null && num(s.have) <= 0;
    if (d != null && d < 0) return ['late', 'needed ' + U.plural(-d, 'day') + ' ago'];
    if (d === 0) return ['late', 'needed today'];
    if (out) return ['late', 'finished'];
    if (d != null && d <= 3) return ['soon', 'in ' + U.plural(d, 'day')];
    if (d != null && d <= 7) return ['week', 'in ' + d + ' days'];
    if (d != null) return ['later', 'by ' + U.fmtDM(s.by)];
    return ['ok', s.boughtOn ? 'bought ' + U.fmtDM(s.boughtOn) : 'in stock'];
  };
  const stOrder = (a, b) => (a.by || '9999').localeCompare(b.by || '9999') || (num(a.have) - num(b.have)) || String(a.name).localeCompare(String(b.name));
  LI.stockHtml = () => {
    const all = STK(), f = st().sk || 'all', today = U.today();
    const list = all.filter(s => f === 'all' || (f === 'need' ? stNeed(s) : s.kind === f)).sort(stOrder);
    const needN = all.filter(s => stNeed(s) && !stOpen(s)).length;
    const counts = { all: all.length, groc: all.filter(s => s.kind !== 'use').length, use: all.filter(s => s.kind === 'use').length, need: all.filter(stNeed).length };
    const seg = '<div class="seg sk-seg" role="group" aria-label="Show">' + [['all', 'All'], ['groc', '🥫 Groceries'], ['use', '🧴 Usables'], ['need', '⏰ Needed soon']].map(x => '<button type="button" data-act="sk-f" data-k="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + ' <span class="num">' + counts[x[0]] + '</span></button>').join('') + '</div>';
    const unitSel = (v, attrs) => '<select class="ls-in sk-unit" ' + attrs + ' aria-label="Unit">' + UNITS.map(u => opt(u, u || '—', u === (v || ''))).join('') + '</select>';
    const rows = list.map(s => {
      const [cls, txt] = stState(s), open = stOpen(s), A2 = 'data-change="sk-edit" data-id="' + e(s.id) + '"';
      return '<li class="sk-row s-' + cls + '"><span class="sk-k" title="' + (s.kind === 'use' ? 'Usable' : 'Grocery') + '">' + (s.kind === 'use' ? '🧴' : '🥫') + '</span>' +
        '<span class="sk-main"><input class="ls-in sk-name" value="' + e(s.name) + '" ' + A2 + ' data-f="name" aria-label="Item"><span class="sk-chip c-' + cls + '">' + e(txt) + '</span></span>' +
        (open ? '<span class="sk-in" title="On “' + e(open.g.name || 'the list') + '”">' + ED.icon('check') + 'In list</span>' : '<button type="button" class="btn small sk-pull" data-act="sk-pull" data-id="' + e(s.id) + '" title="Put it on the grocery list">' + ED.icon('cart') + 'To list</button>') +
        '<button type="button" class="icon-btn sm" data-act="sk-more" data-id="' + e(s.id) + '" aria-label="More for ' + e(s.name) + '" title="More">' + ED.icon('more') + '</button>' +
        '<span class="sk-fields"><label class="sk-f"><span>Have</span><input class="ls-in num sk-have" inputmode="decimal" value="' + e(s.have == null ? '' : s.have) + '" ' + A2 + ' data-f="have" aria-label="Available quantity" placeholder="—">' + unitSel(s.unit, A2 + ' data-f="unit"') + '</label>' +
        '<label class="sk-f"><span>Needed by</span><input type="date" class="ls-in sk-by" value="' + e(s.by || '') + '" ' + A2 + ' data-f="by" aria-label="Needed by"></label>' +
        '<label class="sk-f"><span>Get</span><input class="ls-in num sk-buy" value="' + e(s.buy == null ? '' : s.buy) + '" ' + A2 + ' data-f="buy" aria-label="How much to get" placeholder="qty"></label>' +
        (s.cat ? '<span class="hint sk-cat">' + e(s.cat) + '</span>' : '') + '</span></li>';
    }).join('');
    const add = '<form class="sk-add" data-form="sk-add"><div class="sk-ar"><select name="kind" class="field sk-kind" aria-label="Kind">' + opt('groc', '🥫 Grocery', f !== 'use') + opt('use', '🧴 Usable', f === 'use') + '</select>' +
      '<input name="name" class="field sk-aname" placeholder="Item — e.g. Atta, Detergent, LED bulb" autocomplete="off" aria-label="Item" required>' +
      '<button type="submit" class="btn small primary">' + ED.icon('plus') + 'Add</button></div>' +
      '<div class="sk-ar sk-ar2"><label><span>Have</span><input name="have" class="field num" inputmode="decimal" placeholder="qty" aria-label="Available quantity"></label><select name="unit" class="field sk-aunit" aria-label="Unit">' + UNITS.map(u => opt(u, u || 'unit', !u)).join('') + '</select>' +
      '<label><span>Needed by</span><input name="by" type="date" class="field" aria-label="Needed by"></label><label><span>Get</span><input name="buy" class="field num" placeholder="qty" aria-label="How much to get"></label>' +
      '<input name="cat" class="field sk-acat" list="sk-cats" placeholder="Category (optional)" aria-label="Category"><datalist id="sk-cats">' + G_CATS.concat(U_CATS).filter((c, i, a) => a.indexOf(c) === i).map(c => '<option value="' + e(c) + '">').join('') + '</datalist></div></form>';
    const soon = all.filter(s => { const d = stLeft(s); return d != null && d >= 0 && d <= 7; }).length, late = all.filter(s => stState(s)[0] === 'late').length;
    return '<section class="sk"><div class="sk-h"><h3 class="sk-t"><span aria-hidden="true">🏠</span> Home stock <span class="hint">· groceries &amp; usables</span></h3>' +
      (needN ? '<button type="button" class="btn small primary" data-act="sk-pull-all">' + ED.icon('cart') + 'Pull ' + U.plural(needN, 'needed item') + ' into the list</button>' : '') + '</div>' +
      (all.length ? '<div class="sk-sum"><span class="sk-pill c-late">' + late + ' due / finished</span><span class="sk-pill c-soon">' + soon + ' needed this week</span><span class="sk-pill c-ok">' + (all.length - late - soon) + ' fine</span></div>' : '') +
      add + (all.length ? seg : '') +
      (rows ? '<ul class="sk-list">' + rows + '</ul>' : all.length ? '<p class="hint">Nothing here for this filter.</p>' : '<p class="hint sk-empty">Keep what you have at home: how much is left, and the date you will need more. Items needed within a week (or finished) can be pulled into the grocery list in one click; when you tick them bought there, the quantity is added back here.</p>') +
      '</section>';
  };
  const stTarget = () => {
    let g = glist();
    if (!g) { g = { id: U.uid('gl'), name: 'Groceries — ' + U.fmtShort(U.today()), date: U.today(), items: [], notes: '', createdAt: Date.now(), updatedAt: Date.now() }; LS().groc.push(g); st().groc = g.id; }
    return g;
  };
  const stPull = (s, g) => {
    if (stOpen(s)) return false;
    g.items.push({ id: U.uid('gi'), text: s.name, qty: s.buy != null && s.buy !== '' ? String(s.buy) : '', unit: s.unit || '', cat: s.cat || (s.kind === 'use' ? 'Household & cleaning' : 'Other'), done: false, stockId: s.id });
    touch(g); return true;
  };
  F['sk-add'] = f => {
    const v = n => (f.elements[n] ? f.elements[n].value.trim() : '');
    if (!v('name')) { f.elements.name.focus(); return; }
    ED.store.checkpoint('Home stock');
    STK().push({ id: U.uid('sk'), name: v('name'), kind: v('kind') === 'use' ? 'use' : 'groc', have: v('have') === '' ? '' : num(v('have')), unit: v('unit'), by: U.isKey(v('by')) ? v('by') : '', buy: v('buy'), cat: v('cat'), updatedAt: Date.now() });
    ED.store.commit();
    setTimeout(() => { const x = document.querySelector('form[data-form="sk-add"] [name="name"]'); if (x) x.focus(); }, 30);
  };
  CH['sk-edit'] = el => {
    const s = STK().find(x => x.id === el.dataset.id); if (!s) return;
    const k = el.dataset.f, v = el.value.trim();
    if (k === 'name' && !v) { el.value = s.name; return; }
    s[k] = k === 'have' ? (v === '' ? '' : num(v)) : k === 'by' ? (U.isKey(v) ? v : '') : v;
    s.updatedAt = Date.now(); ED.store.commit();
  };
  A['sk-f'] = el => { st().sk = el.dataset.k; ED.app.render(); };
  A['sk-pull'] = el => {
    const s = STK().find(x => x.id === el.dataset.id); if (!s) return;
    ED.store.checkpoint('To the grocery list'); const g = stTarget();
    if (stPull(s, g)) { ED.store.commit(); ED.ui.undoToast(s.name + ' is on “' + (g.name || 'the list') + '”'); } else ED.ui.toast('Already on the list');
  };
  A['sk-pull-all'] = () => {
    const due = STK().filter(s => stNeed(s) && !stOpen(s)); if (!due.length) return;
    ED.store.checkpoint('To the grocery list'); const g = stTarget(); let n = 0;
    due.sort(stOrder).forEach(s => { if (stPull(s, g)) n++; });
    ED.store.commit(); ED.ui.undoToast(U.plural(n, 'item') + ' added to “' + (g.name || 'the list') + '”');
  };
  A['sk-more'] = el => {
    const s = STK().find(x => x.id === el.dataset.id); if (!s) return;
    ED.ui.menu(el, [
      { label: s.kind === 'use' ? 'Make it a grocery' : 'Make it a usable', icon: 'repeat', onClick: () => { s.kind = s.kind === 'use' ? 'groc' : 'use'; s.updatedAt = Date.now(); ED.store.commit(); } },
      { label: 'Category and notes…', icon: 'pencil', onClick: () => FX().form({ title: s.name, data: s, fields: [{ k: 'cat', label: 'Category', list: G_CATS.concat(U_CATS) }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, ph: 'Brand, shop, size…' }], save(v, api) { Object.assign(s, v, { updatedAt: Date.now() }); ED.store.commit(); api.close(); } }) },
      { label: 'Remove', icon: 'trash', danger: true, onClick: () => { ED.store.checkpoint('Remove from stock'); LS().stock = STK().filter(x => x !== s); LS().groc.forEach(g => (g.items || []).forEach(i => { if (i.stockId === s.id) delete i.stockId; })); ED.store.commit(); ED.ui.undoToast('Removed: ' + s.name); } },
    ]);
  };
  /* bought on the list (or by its task / bill): add it to what you have */
  LI.stockSync = () => {
    const l = ED.store.data && ED.store.data.lists; if (!l || !Array.isArray(l.stock) || !l.stock.length || !Array.isArray(l.groc)) return false;
    let ch = false;
    l.groc.forEach(g => (g.items || []).forEach(i => {
      if (!i.stockId) return;
      const s = l.stock.find(x => x.id === i.stockId);
      if (!s) { if (i.stockIn) { delete i.stockIn; ch = true; } return; }
      const same = !i.unit || !s.unit || i.unit === s.unit, q = parseFloat(i.qty);
      if (i.done && !i.stockIn) {
        const add = same && q > 0 ? q : 0;
        i.stockIn = { add, by: s.by || '', have: s.have, on: s.boughtOn || '' };
        if (add) s.have = Math.round((num(s.have) + add) * 1000) / 1000;
        if (!s.unit && i.unit) s.unit = i.unit;
        s.by = ''; s.boughtOn = U.today(); s.updatedAt = Date.now(); ch = true;
      } else if (!i.done && i.stockIn) {
        const x = i.stockIn;
        if (x.add) s.have = Math.max(0, Math.round((num(s.have) - x.add) * 1000) / 1000);
        if (x.have === '' || x.have == null) { if (!x.add) s.have = x.have; }
        if (!s.by && x.by) s.by = x.by;
        s.boughtOn = x.on || ''; s.updatedAt = Date.now(); delete i.stockIn; ch = true;
      }
    }));
    return ch;
  };
  ED.store.on((type, d) => { if (type !== 'change' || (d && d.reason === 'stock')) return; if (LI.stockSync()) ED.store.commit({ reason: 'stock' }); });

  /* ---------------- 1.21: saved meal plans, and the meal plan's informatics ----------------
     mealPlans: [ { id, name, kind: 'week' | 'day', meals: { 0..6: { b|l|s|d: [ {f, q} ] } } (week) | day: { b|l|s|d } (day), note, savedAt, updatedAt } ] */
  const MICON = { b: '🌅', l: '☀️', s: '🍪', d: '🌙' };
  LI.MICON = MICON;
  const PLANS = () => { const l = LS(); if (!Array.isArray(l.mealPlans)) l.mealPlans = []; return l.mealPlans; };
  const norm = v => Array.isArray(v) ? v : v ? [{ f: String(v), q: 1 }] : [];
  const objTot = day => { const out = { kcal: 0, p: 0, fat: 0, carb: 0, unk: 0, n: 0 }; MEALS.forEach(m => { const it = norm((day || {})[m[0]]); out.n += it.length; const t = tot(it); ['kcal', 'p', 'fat', 'carb', 'unk'].forEach(k => { out[k] += t[k]; }); }); return out; };
  const planAvg = p => {
    const days = p.kind === 'day' ? [p.day || {}] : [0, 1, 2, 3, 4, 5, 6].map(d => (p.meals || {})[d] || {});
    const t = days.map(objTot), used = t.filter(x => x.n).length || 1;
    return { kcal: t.reduce((a, x) => a + x.kcal, 0) / used, p: t.reduce((a, x) => a + x.p, 0) / used, n: t.reduce((a, x) => a + x.n, 0), days: t.filter(x => x.n).length };
  };
  const copyDay = d => JSON.parse(JSON.stringify(d || {}));
  const curDay = () => { const s = st(); return s.mday != null ? +s.mday : new Date().getDay(); };
  LI.savePlan = () => {
    const day = curDay(), dayHas = objTot(LS().meals[day]).n, weekHas = [0, 1, 2, 3, 4, 5, 6].some(d => objTot(LS().meals[d]).n);
    if (!weekHas) { ED.ui.toast('Add some foods to the plan first'); return; }
    ED.ui.modal({
      title: 'Save this meal plan', cls: 'st-modal',
      body: '<div class="st-form"><div class="st-grid"><label class="lbl" for="mp-name">Name</label><input id="mp-name" class="field" placeholder="e.g. High-protein week, Navratri fast, Winter menu" value="">' +
        '<span class="lbl">Save</span><div class="mp-kind"><label class="chip-check"><input type="radio" name="mp-k" value="week" checked><span>The whole week</span></label>' +
        '<label class="chip-check"><input type="radio" name="mp-k" value="day"' + (dayHas ? '' : ' disabled') + '><span>Only ' + U.DAYS[day] + '</span></label></div>' +
        '<label class="lbl" for="mp-note">Note</label><input id="mp-note" class="field" placeholder="Optional — when to use it"></div></div>',
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="ok">' + ED.icon('check') + 'Save plan</button>',
      onMount(el, api) {
        const go = () => {
          const name = el.querySelector('#mp-name').value.trim(), kind = (el.querySelector('input[name="mp-k"]:checked') || {}).value || 'week';
          if (!name) { ED.ui.toast('Give the plan a name'); el.querySelector('#mp-name').focus(); return; }
          ED.store.checkpoint('Save meal plan');
          const p = { id: U.uid('mp'), name, kind, note: el.querySelector('#mp-note').value.trim(), savedAt: Date.now(), updatedAt: Date.now() };
          if (kind === 'day') p.day = copyDay(LS().meals[day]); else { p.meals = {}; for (let d = 0; d < 7; d++) p.meals[d] = copyDay(LS().meals[d]); }
          PLANS().push(p); ED.store.commit(); api.close(); ED.ui.toast('Saved: ' + name + ' — find it under Saved plans');
        };
        el.querySelector('[data-x="ok"]').addEventListener('click', go);
        el.querySelector('#mp-name').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
        setTimeout(() => el.querySelector('#mp-name').focus(), 40);
      },
    });
  };
  LI.usePlan = async (id, how) => {
    const p = PLANS().find(x => x.id === id); if (!p) return;
    const day = curDay(), m = LS().meals;
    if (p.kind === 'week' && how !== 'day') {
      if (!await ED.ui.confirm({ title: 'Use “' + p.name + '”', message: 'Replace this week’s meals with the saved plan?', ok: 'Use it' })) return;
      ED.store.checkpoint('Use meal plan'); for (let d = 0; d < 7; d++) m[d] = copyDay((p.meals || {})[d]);
    } else {
      const src = p.kind === 'day' ? p.day : (p.meals || {})[day];
      const targets = how === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [day];
      ED.store.checkpoint('Use meal plan'); targets.forEach(d => { m[d] = copyDay(src); });
    }
    ED.store.commit(); ED.ui.undoToast('Using “' + p.name + '”' + (p.kind === 'day' || how === 'day' ? (how === 'all' ? ' for every day' : ' for ' + U.DAYS[day]) : ' for the week'));
  };
  const planCards = () => {
    const ps = PLANS().slice().sort((a, b) => (b.usedAt || b.savedAt || 0) - (a.usedAt || a.savedAt || 0)), t = LI.targets(), day = curDay();
    if (!ps.length) return '<p class="hint mp-empty">Save a week or a day you liked with <b>Save plan</b> on the left, and use it again any time.</p>';
    return '<div class="mp-cards">' + ps.map(p => {
      const a = planAvg(p), on = t && a.p >= t.p * 0.95;
      const prev = p.kind === 'day' ? p.day : (p.meals || {})[day];
      const peek = MEALS.map(m => { const it = norm((prev || {})[m[0]]); return it.length ? '<li><span aria-hidden="true">' + MICON[m[0]] + '</span>' + e(short(it)) + '</li>' : ''; }).join('');
      return '<article class="mp-card k-' + p.kind + '"><header><b>' + e(p.name) + '</b><span class="mp-badge">' + (p.kind === 'day' ? '1 day' : 'week') + '</span></header>' +
        '<div class="mp-nums"><span><b class="num">' + Math.round(a.kcal).toLocaleString('en-IN') + '</b> kcal</span><span class="' + (on ? 'ok-text' : '') + '"><b class="num">' + Math.round(a.p) + ' g</b> protein</span><span class="hint">' + U.plural(a.n, 'food') + (p.kind === 'week' ? ' · ' + a.days + '/7 days' : '') + '</span></div>' +
        (peek ? '<ul class="mp-peek">' + peek + '</ul>' + (p.kind === 'week' ? '<span class="hint mp-pk">' + U.DAY3[day] + ' in this plan</span>' : '') : '') +
        (p.note ? '<p class="hint mp-note">' + e(p.note) + '</p>' : '') +
        '<footer>' + (p.kind === 'week' ? '<button type="button" class="btn small primary" data-act="mp-use" data-id="' + e(p.id) + '" data-how="week">Use for the week</button>' : '<button type="button" class="btn small primary" data-act="mp-use" data-id="' + e(p.id) + '" data-how="day">Use for ' + U.DAY3[day] + '</button>') +
        '<button type="button" class="icon-btn sm" data-act="mp-more" data-id="' + e(p.id) + '" aria-label="More for ' + e(p.name) + '" title="More">' + ED.icon('more') + '</button></footer></article>';
    }).join('') + '</div>';
  };
  /* the informatics: calories and protein by day against the targets, where the calories come from, which meal, top protein foods */
  LI.mealInsights = () => {
    const t = LI.targets(), days = wdays(), C = ED.charts;
    const per = days.map(k => ({ k, d: U.dow(k), x: dayTot(U.dow(k)) })), used = per.filter(r => r.x.kcal || r.x.p);
    if (!used.length) return '<p class="hint">Add foods to the week to see the insights here.</p>';
    const n = used.length, avg = used.reduce((a, r) => { a.k += r.x.kcal / n; a.p += r.x.p / n; a.f += r.x.fat / n; a.c += r.x.carb / n; return a; }, { k: 0, p: 0, f: 0, c: 0 });
    const onP = t ? used.filter(r => r.x.p >= t.p * 0.95).length : 0, onK = t ? used.filter(r => Math.abs(r.x.kcal - t.kcal) <= t.kcal * 0.08).length : 0;
    const foods = new Map(), meal = { b: 0, l: 0, s: 0, d: 0 };
    used.forEach(r => MEALS.forEach(m => mealItems(r.d, m[0]).forEach(it => { const f = food(it.f), q = +it.q || 0; if (!f) return; const o = foods.get(f.name) || { p: 0, k: 0, n: 0 }; o.p += (+f.p || 0) * q; o.k += (+f.kcal || 0) * q; o.n++; foods.set(f.name, o); meal[m[0]] += (+f.kcal || 0) * q; })));
    const tiles = '<div class="tiles xp-tiles ml-itiles">' + FX().tile('Average', Math.round(avg.k).toLocaleString('en-IN') + ' <small>kcal</small>', t ? (avg.k > t.kcal * 1.08 ? Math.round(avg.k - t.kcal) + ' over the target' : avg.k < t.kcal * 0.9 ? Math.round(t.kcal - avg.k) + ' under the target' : 'on target ✓') : 'a day', t && avg.k > t.kcal * 1.08 ? 'warn' : '') +
      FX().tile('Protein', Math.round(avg.p) + ' <small>g a day</small>', t ? onP + '/' + n + ' days on target' : '', t && onP < n / 2 ? 'warn' : '') +
      FX().tile('Calories on target', t ? onK + '/' + n : '—', t ? 'days within 8%' : 'enter your numbers') + FX().tile('Variety', String(foods.size), 'different foods this week') + '</div>';
    const kc = C.columns({ title: 'Calories by day', h: 150, left: 44, color: '#f59e0b', data: per.map(r => ({ label: U.DAY3[r.d], long: U.fmtLong(r.k), value: Math.round(r.x.kcal), total: t ? t.kcal : null, tip: Math.round(r.x.kcal) + ' kcal' + (t ? ' (target ' + t.kcal + ')' : '') })), cur: per.findIndex(r => r.k === U.today()), sub: t ? 'Pale bar: your daily calorie target.' : '' });
    const pc = C.columns({ title: 'Protein by day (g)', h: 150, left: 44, color: 'var(--s2)', fine: false, data: per.map(r => ({ label: U.DAY3[r.d], long: U.fmtLong(r.k), value: Math.round(r.x.p), total: t ? t.p : null, tip: Math.round(r.x.p) + ' g protein' + (t ? ' (need ' + t.p + ' g)' : '') })), cur: per.findIndex(r => r.k === U.today()), sub: t ? 'Pale bar: the protein you need.' : '' });
    // where the calories come from (week average) against the usual ranges
    const kP = avg.p * 4, kF = avg.f * 9, kC = avg.c * 4, kT = kP + kF + kC || 1;
    const pp = Math.round(kP / kT * 100), pf = Math.round(kF / kT * 100), pcb = Math.max(0, 100 - pp - pf);
    const ok = (v, a, b) => v >= a && v <= b;
    const split = '<figure class="chart ml-split"><figcaption><span class="gh">Where the calories come from</span><span class="legend"><i class="lg-g" style="--c:var(--s2)"></i>Protein <i class="lg-g" style="--c:var(--s6)"></i>Fat <i class="lg-g" style="--c:var(--s4)"></i>Carbs</span></figcaption>' +
      '<div class="ml-stack" role="img" aria-label="Protein ' + pp + '%, fat ' + pf + '%, carbs ' + pcb + '%"><i style="width:' + pp + '%;--c:var(--s2)"><span>' + pp + '%</span></i><i style="width:' + pf + '%;--c:var(--s6)"><span>' + pf + '%</span></i><i style="width:' + pcb + '%;--c:var(--s4)"><span>' + pcb + '%</span></i></div>' +
      '<ul class="ml-ranges"><li class="' + (ok(pp, 10, 35) ? 'ok-text' : 'short') + '">Protein ' + pp + '% <span class="hint">(10–35%)</span></li><li class="' + (ok(pf, 20, 30) ? 'ok-text' : 'short') + '">Fat ' + pf + '% <span class="hint">(20–30%)</span></li><li class="' + (ok(pcb, 45, 65) ? 'ok-text' : 'short') + '">Carbs ' + pcb + '% <span class="hint">(45–65%)</span></li></ul></figure>';
    const mt = Object.values(meal).reduce((a, v) => a + v, 0) || 1;
    const share = C.meters({ title: 'Calories by meal', rows: MEALS.map((m, i) => ({ label: MICON[m[0]] + ' ' + m[1], value: Math.round(meal[m[0]] / mt * 100), total: 100, valueLabel: Math.round(meal[m[0]] / mt * 100) + '% · ' + Math.round(meal[m[0]] / n) + ' kcal', color: ['var(--s4)', 'var(--s2)', 'var(--s5)', 'var(--s1)'][i], tip: Math.round(meal[m[0]] / n) + ' kcal a day on average' })), max: 100 });
    const top = Array.from(foods.entries()).sort((a, b) => b[1].p - a[1].p).slice(0, 6);
    const tp = top.length ? C.meters({ title: 'Top protein sources this week', rows: top.map(([nm, o]) => ({ label: nm, value: Math.round(o.p), valueLabel: Math.round(o.p) + ' g · ' + U.plural(o.n, 'time'), color: 'var(--s2)', tip: Math.round(o.k) + ' kcal from it this week' })) }) : '';
    return tiles + '<div class="ml-charts">' + kc + pc + '</div>' + split + share + tp;
  };
  LI.mealPlansHtml = planCards;
  A['mp-save'] = () => LI.savePlan();
  A['mp-use'] = el => { const p = PLANS().find(x => x.id === el.dataset.id); if (p) p.usedAt = Date.now(); LI.usePlan(el.dataset.id, el.dataset.how); };
  A['mp-more'] = el => {
    const p = PLANS().find(x => x.id === el.dataset.id); if (!p) return; const day = curDay();
    const items = p.kind === 'week' ? [{ label: 'Use only ' + U.DAYS[day] + ' of it', icon: 'calendar', onClick: () => LI.usePlan(p.id, 'day') }] : [{ label: 'Use for every day', icon: 'repeat', onClick: () => LI.usePlan(p.id, 'all') }];
    ED.ui.menu(el, items.concat([
      { label: 'Update it with the plan now', icon: 'sync', onClick: async () => { if (!await ED.ui.confirm({ title: 'Update “' + p.name + '”', message: 'Replace the saved plan with ' + (p.kind === 'day' ? U.DAYS[day] + '’s meals' : 'this week’s meals') + '?', ok: 'Update' })) return; ED.store.checkpoint('Meal plan'); if (p.kind === 'day') p.day = copyDay(LS().meals[day]); else { p.meals = {}; for (let d = 0; d < 7; d++) p.meals[d] = copyDay(LS().meals[d]); } p.updatedAt = Date.now(); ED.store.commit(); ED.ui.toast('Updated'); } },
      { label: 'Rename / note…', icon: 'pencil', onClick: () => FX().form({ title: 'Saved plan', data: p, fields: [{ k: 'name', label: 'Name', req: true }, { k: 'note', label: 'Note' }], save(v, api) { Object.assign(p, v, { updatedAt: Date.now() }); ED.store.commit(); api.close(); } }) },
      { label: 'Copy as text', icon: 'copy', onClick: async () => { const lines = [p.name]; const ds = p.kind === 'day' ? [[null, p.day]] : [1, 2, 3, 4, 5, 6, 0].map(d => [d, (p.meals || {})[d]]); ds.forEach(([d, x]) => { if (d != null) lines.push('', U.DAYS[d]); MEALS.forEach(m => { const s2 = short(norm((x || {})[m[0]])); if (s2) lines.push('  ' + m[1] + ': ' + s2); }); }); ED.ui.toast(await U.copy(lines.join('\n')) ? 'Copied' : 'Could not copy'); } },
      { label: 'Delete', icon: 'trash', danger: true, onClick: () => { ED.store.checkpoint('Delete meal plan'); LS().mealPlans = PLANS().filter(x => x !== p); ED.store.commit(); ED.ui.undoToast('Deleted: ' + p.name); } },
    ]));
  };
  A['mp-open'] = () => { const x = document.getElementById('mp-saved'); if (x && x.scrollIntoView) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
})();
