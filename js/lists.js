/* E-Diary — Career Graph → "Travel & Tour" and "Grocery" pages (beside Notes and Progress).
   Data (ED.store.data.lists):
     trips: [ { id, name, dest, from, to, by, purpose, stay, tickets, contacts, budget, itinerary, notes,
                items: [ { id, text, qty, cat, done } ], createdAt, updatedAt } ]
     groc:  [ { id, name, date, budget, notes, items: [ { id, text, qty, unit, cat, price, done } ], createdAt, updatedAt } ]
     meals: { 0..6: { b|l|s|d: [ { f, q } ] } }   this week's meal plan by weekday (0 = Sunday), with protein
     foods: [ { id, name, serving, p, cat } ] your own foods; weight (kg), perKg (protein goal, g per kg)
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
  const DEFAULT_FOODS = Object.keys(FOODS).flatMap(c => FOODS[c].map(x => ({ name: x[0], serving: x[1], p: x[2], cat: c })));
  const allFoods = () => {
    const mine = (LS().foods || []).map(f => Object.assign({ mine: true }, f));
    const names = new Set(mine.map(f => f.name.toLowerCase()));
    return mine.concat(DEFAULT_FOODS.filter(f => !names.has(f.name.toLowerCase())));   // your version of a food wins
  };
  const food = name => { const n = String(name || '').toLowerCase(); return allFoods().find(f => f.name.toLowerCase() === n) || null; };
  const mealItems = (d, k) => { const v = (LS().meals[d] || {})[k]; return Array.isArray(v) ? v : v ? [{ f: String(v), q: 1 }] : []; };
  const prot = list => list.reduce((a, x) => { const f = food(x.f); return a + (f ? f.p * (+x.q || 0) : 0); }, 0);
  const g1 = n => Math.round(n * 10) / 10;
  const need = () => { const l = LS(); return l.weight ? Math.round(l.weight * (l.perKg || 0.83)) : 0; };
  const PERKG = [[0.83, '0.83 g/kg — adult RDA (ICMR-NIN), little activity'], [1.0, '1.0 g/kg — moderately active'], [1.2, '1.2 g/kg — active / walking, yoga'], [1.6, '1.6 g/kg — strength training, building muscle']];

  LI.grocRight = () => {
    const l = LS(), g = glist(), s = st(), today = new Date().getDay();
    const order = [1, 2, 3, 4, 5, 6, 0];
    const day = s.mday != null ? +s.mday : today;
    const req = need();
    const cats = {}; allFoods().forEach(f => { const c = f.mine ? 'My foods' : f.cat; (cats[c] = cats[c] || []).push(f); });
    const picker = (d, k) => '<select class="field ls-fpick" data-change="ls-fadd" data-d="' + d + '" data-m="' + k + '" aria-label="Add a food"><option value="">＋ Add food…</option>' +
      Object.keys(cats).map(c => '<optgroup label="' + e(c) + '">' + cats[c].map(f => opt(f.name, f.name + ' — ' + f.serving + ' · ' + g1(f.p) + ' g protein', false)).join('') + '</optgroup>').join('') +
      '<option value="__new">✎ A food not in the list…</option></select>';
    const meter = (have, want) => want ? '<div class="ls-bar pr' + (have >= want ? ' ok' : '') + '"><i style="width:' + Math.min(100, Math.round(have / want * 100)) + '%"></i></div>' : '';
    const dayP = order.map(d => ({ d, p: MEALS.reduce((a, x) => a + prot(mealItems(d, x[0])), 0) }));
    const dp = dayP.find(x => x.d === day).p;
    const body = '<div class="ls-prof">' +
      '<label>Body weight <span class="ls-wt"><input type="number" class="field num" min="20" max="250" step="0.5" value="' + e(l.weight || '') + '" data-change="ls-weight" placeholder="kg" aria-label="Body weight in kg"> kg</span></label>' +
      '<label>Protein goal <select class="field" data-change="ls-perkg" aria-label="Protein per kg">' + PERKG.map(x => opt(x[0], x[1], +(l.perKg || 0.83) === x[0])).join('') + '</select></label>' +
      '<div class="ls-need">' + (req ? 'You need about <b>' + req + ' g</b> protein a day' : '<span class="hint">Enter your weight to see how much protein you need.</span>') + '</div></div>' +
      '<div class="ls-week" role="group" aria-label="Day">' + dayP.map(x => '<button type="button" class="ls-wd' + (x.d === day ? ' sel' : '') + (x.d === today ? ' today' : '') + (req && x.p >= req ? ' ok' : '') + '" data-act="ls-mday" data-d="' + x.d + '" aria-pressed="' + (x.d === day) + '"><b>' + U.DAY3[x.d] + '</b><span class="num">' + Math.round(x.p) + (req ? '/' + req : '') + ' g</span></button>').join('') + '</div>' +
      '<div class="ls-dtot"><b>' + U.DAYS[day] + ':</b> <span class="num">' + g1(dp) + ' g</span> protein planned' + (req ? ' of <span class="num">' + req + ' g</span> needed — ' + (dp >= req ? '<span class="ok-text">goal met</span>' : '<b class="num">' + g1(req - dp) + ' g</b> short') : '') + meter(dp, req) + '</div>' +
      MEALS.map(x => {
        const items = mealItems(day, x[0]), mp = prot(items);
        return '<section class="ls-meal"><h4 class="ls-gh">' + x[1] + ' <span class="hint num">' + g1(mp) + ' g protein</span></h4>' +
          '<ul class="ls-list">' + items.map((it, i) => { const f = food(it.f); return '<li class="ls-row' + (f ? '' : ' unk') + '"><input type="number" class="ls-in ls-q num" min="0" step="0.5" value="' + e(it.q) + '" data-change="ls-fq" data-d="' + day + '" data-m="' + x[0] + '" data-i="' + i + '" aria-label="Servings">' +
            '<span class="ls-text">× ' + e(it.f) + (f ? ' <span class="hint">(' + e(f.serving) + ')</span>' : ' <button type="button" class="link-btn" data-act="ls-food-new" data-name="' + e(it.f) + '">add its protein</button>') + '</span>' +
            '<span class="num ls-p">' + (f ? g1(f.p * (+it.q || 0)) + ' g' : '—') + '</span>' +
            '<button type="button" class="icon-btn sm" data-act="ls-fdel" data-d="' + day + '" data-m="' + x[0] + '" data-i="' + i + '" aria-label="Remove ' + e(it.f) + '">' + ED.icon('x') + '</button></li>'; }).join('') + '</ul>' + picker(day, x[0]) + '</section>';
      }).join('') +
      '<div class="ls-tools"><button type="button" class="btn small ghost" data-act="ls-food-new">' + ED.icon('plus') + 'Add a new food</button>' + ((l.foods || []).length ? '<button type="button" class="btn small ghost" data-act="ls-foods">My foods (' + l.foods.length + ')</button>' : '') +
      '<button type="button" class="btn small ghost" data-act="ls-mcopy">' + ED.icon('copy') + 'Copy ' + U.DAY3[day] + ' to every day</button></div>' +
      '<p class="hint">Protein values are approximate for usual home portions; change any food with “Add a new food” using the same name. A general guide, not medical advice.</p>' +
      (g ? '<h4 class="ls-gh">Notes for “' + e(g.name || 'this list') + '”</h4><textarea class="field ls-notes" rows="3" data-change="ls-groc-notes" placeholder="Shop, offers, things to check at home…">' + e(g.notes || '') + '</textarea>' : '');
    return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">Meal plan &amp; protein</h2><button type="button" class="btn small ghost" data-act="ls-meals-clear">Clear week</button></div>' +
      '<div class="ls-scroll scroll" data-keep-scroll="ls-groc-r">' + body + '</div></div>';
  };
  LI.editFood = (name, then) => {
    const l = LS(); l.foods = l.foods || [];
    const x = l.foods.find(f => f.name.toLowerCase() === String(name || '').toLowerCase());
    const base = x || food(name) || { name: name || '', serving: '1 katori', p: null, cat: 'My foods' };
    FX().form({
      title: x ? 'My food' : 'Add a food',
      data: { name: base.name, serving: base.serving, p: base.p, cat: base.cat && base.cat !== 'My foods' ? base.cat : '' },
      fields: [{ k: 'name', label: 'Food', req: true, ph: 'e.g. Rajma chawal, Besan ladoo' }, { k: 'serving', label: 'One serving is', ph: '1 katori, 1 piece, 100 g' },
        { k: 'p', label: 'Protein in one serving (g)', type: 'number', min: 0, step: 0.5, req: true, hint: 'From the pack label, or roughly: dal katori 7 g, roti 3 g, egg 6 g, 100 g paneer 18 g' },
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
  A['ls-foods'] = el => ED.ui.menu(el, (LS().foods || []).map(f => ({ label: f.name + ' — ' + g1(+f.p || 0) + ' g', icon: 'pencil', onClick: () => LI.editFood(f.name) })));
  A['ls-mcopy'] = async () => {
    const s = st(), day = s.mday != null ? +s.mday : new Date().getDay();
    if (!await ED.ui.confirm({ title: 'Copy to every day', message: 'Use ' + U.DAYS[day] + '’s meals for every day of the week?', ok: 'Copy' })) return;
    ED.store.checkpoint('Copy meals'); const src = LS().meals[day] || {};
    for (let d = 0; d < 7; d++) if (d !== day) LS().meals[d] = JSON.parse(JSON.stringify(src));
    ED.store.commit(); ED.ui.undoToast('Copied to every day');
  };
  CH['ls-weight'] = el => { const v = parseFloat(el.value); LS().weight = v > 0 ? v : null; ED.store.commit(); };
  CH['ls-perkg'] = el => { LS().perKg = +el.value; ED.store.commit(); };
  A['ls-meals-clear'] = async () => { if (!await ED.ui.confirm({ title: 'Clear the meal plan', message: 'Empty all the meals for the week?', ok: 'Clear' })) return; ED.store.checkpoint('Clear meals'); LS().meals = {}; ED.store.commit(); ED.ui.undoToast('Meal plan cleared'); };
  /* ---------------- Weekly meals: the meal plan as a chart for one week (read only) ---------------- */
  const wstart = () => st().mw || (st().mw = U.startOfWeek(U.today(), ED.store.data.settings.weekStart || 0));
  const short = list => list.map(x => (+x.q && +x.q !== 1 ? x.q + '× ' : '') + x.f).join(', ');
  const dayProt = d => MEALS.reduce((a, x) => a + prot(mealItems(d, x[0])), 0);
  const wdays = () => U.range(wstart(), 7);
  const wlabel = () => { const d = wdays(); return U.fmtShort(d[0]) + ' – ' + U.fmtShort(d[6]); };
  const nav = () => '<div class="ls-mnav"><button type="button" class="icon-btn" data-act="ls-mm" data-dir="-1" aria-label="Previous week">' + ED.icon('chevL') + '</button><b>' + e(wlabel()) + '</b>' +
    '<button type="button" class="icon-btn" data-act="ls-mm" data-dir="1" aria-label="Next week">' + ED.icon('chevR') + '</button><button type="button" class="btn small ghost" data-act="ls-mm" data-dir="0">This week</button></div>';
  LI.mealMonthLeft = head => {
    const today = U.today(), req = need();
    const cols = wdays().map(k => {
      const d = U.dow(k), p = dayProt(d);
      return '<div class="wk-col' + (k === today ? ' today' : '') + '"><div class="wk-h"><b>' + U.DAY3[d] + '</b><span class="num">' + +k.slice(8) + '</span></div>' +
        MEALS.map(x => { const it = mealItems(d, x[0]); return '<div class="wk-m"><i>' + x[1] + '</i>' + (it.length ? e(short(it)) : '<span class="hint">—</span>') + '</div>'; }).join('') +
        '<div class="wk-p num' + (req ? (p >= req ? ' ok' : ' short') : '') + '">' + Math.round(p) + (req ? '/' + req : '') + ' g</div>' + (req ? '<div class="ls-bar pr' + (p >= req ? ' ok' : '') + '"><i style="width:' + Math.min(100, Math.round(p / req * 100)) + '%"></i></div>' : '') + '</div>';
    }).join('');
    return wrap(head, nav() +
      '<p class="hint">The week’s meals, as chosen in <b>Grocery → Meal plan &amp; protein</b>. Change the plan there.</p>' +
      '<div class="wk-grid">' + cols + '</div>', 'ls-mm-l');
  };
  LI.mealMonthRight = () => {
    const req = need(), days = wdays();
    const tot = days.reduce((a, k) => a + dayProt(U.dow(k)), 0), met = req ? days.filter(k => dayProt(U.dow(k)) >= req).length : 0;
    const planned = days.filter(k => dayProt(U.dow(k)) > 0).length;
    return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">Weekly meal chart</h2><button type="button" class="btn small ghost" data-act="ls-mm-copy">' + ED.icon('copy') + 'Copy</button></div>' +
      '<div class="tiles xp-tiles">' + FX().tile('Days planned', planned + '/7', '') + FX().tile('Average protein', Math.round(tot / 7) + ' g', req ? 'need ' + req + ' g a day' : 'enter your weight in Grocery') +
      FX().tile('Days goal met', req ? met + '/7' : '—', req ? '' : 'needs your weight', req && met < 7 ? 'warn' : '') + FX().tile('Week total', Math.round(tot) + ' g', 'protein planned') + '</div>' +
      '<div class="ls-scroll scroll" data-keep-scroll="ls-mm-r"><table class="mm-table"><thead><tr><th>Day</th>' + MEALS.map(x => '<th>' + x[1] + '</th>').join('') + '<th>Protein</th></tr></thead><tbody>' +
      days.map(k => { const d = U.dow(k), p = dayProt(d); return '<tr' + (k === U.today() ? ' class="today"' : '') + '><th class="num">' + U.DAY3[d] + ' ' + +k.slice(8) + '</th>' + MEALS.map(x => '<td>' + e(short(mealItems(d, x[0]))) + '</td>').join('') +
        '<td class="num' + (req ? (p >= req ? ' ok-text' : ' short') : '') + '">' + Math.round(p) + (req ? '/' + req : '') + ' g</td></tr>'; }).join('') + '</tbody></table></div></div>';
  };
  A['ls-mm'] = el => { const d = +el.dataset.dir; st().mw = d ? U.addDays(wstart(), 7 * d) : null; ED.app.render(); };
  A['ls-mm-copy'] = async () => {
    const lines = ['Meal chart — week of ' + wlabel()];
    wdays().forEach(k => { const d = U.dow(k); lines.push('', U.DAY3[d] + ' ' + +k.slice(8) + ' (' + Math.round(dayProt(d)) + ' g protein)'); MEALS.forEach(x => { const t = short(mealItems(d, x[0])); if (t) lines.push('  ' + x[1] + ': ' + t); }); });
    ED.ui.toast(await U.copy(lines.join('\n')) ? 'Meal chart copied' : 'Could not copy');
  };
})();
