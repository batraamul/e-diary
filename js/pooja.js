/* E-Diary — Notes & Life → Pooja & Vrat (added in 1.16).
   Left page:  the Hindu calendar (Panchang, js/panchang.js) for any day — tithi, paksha, Hindu month, Vikram and
               Shaka samvat, nakshatra, yoga, sunrise and sunset — a month calendar with tithis and festivals, and the
               festivals and vrats coming up.
   Right page: My poojas (everyday rituals: morning pooja, Surya arghya, Hanuman Chalisa… each with its time and days),
               Vrats (Ekadashi, Pradosh, Purnima, Sankashti, Somvar… with how to keep them, food and paran), and
               settings.
   In the planner (like groceries): every pooja you keep is a repeating task, each vrat you choose is a task on its
   day (the next 30 days are kept filled in), and festivals can be shown too — all under the role "Spiritual &
   Pooja" (made once, rename it as you like). Clicking one opens this page. The Daily page shows a Panchang line.
   Data: ED.store.data.pooja = {
     daily: [{ id, key (preset) | '', name, icon, time, days: [0–6] | null, every, start, notes, off }],
     vrats: [key, …], custom: [{ id, name, rule: daily|weekly|tithi|once, days, tithi, start, stop, deity, food, paran, notes }],
     fest: false, strip: true, ahead: 30, roleId, skip: { taskId: 1 } } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const P = ED.panchang;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const CH = (ED.changes = ED.changes || {});
  const FX = () => ED.fx;
  const PJ = (ED.pooja = {});
  const st = () => ED.state.pj || (ED.state.pj = { tab: 'poojas' });
  const PD = () => {
    const d = D();
    if (!d.pooja || typeof d.pooja !== 'object') d.pooja = ED.sample.pooja ? ED.sample.pooja() : { daily: [], vrats: [], custom: [], fest: false, festV: 2, strip: true, ahead: 30, skip: {} };
    const p = d.pooja;
    if (!Array.isArray(p.daily)) p.daily = []; if (!Array.isArray(p.vrats)) p.vrats = []; if (!p.skip || typeof p.skip !== 'object') p.skip = {}; if (!p.vratEnd || typeof p.vratEnd !== 'object') p.vratEnd = {};
    if (!Array.isArray(p.custom)) p.custom = [];
    if (p.festV !== 2) { p.fest = false; p.festV = 2; }   // 1.16.2: festivals stay on the calendar, not in the task list (switch them on in Settings)
    return p;
  };

  /* a role (side heading on the Daily page) for a kind of task: found by name, or made once */
  ED.lifeRole = (re, name, icon, color, store) => {
    const d = D();
    if (store && store.roleId && d.roles.some(r => r.id === store.roleId)) return store.roleId;
    const r = d.roles.find(x => re.test(x.name || ''));
    if (r) { if (store) store.roleId = r.id; return r.id; }
    const x = { id: U.uid('role'), name, icon, color, desc: '', order: d.roles.length ? Math.max.apply(null, d.roles.map(q => q.order || 0)) + 1 : 0, updatedAt: Date.now() };
    d.roles.push(x); if (store) store.roleId = x.id;
    return x.id;
  };

  /* ---------------- everyday poojas ---------------- */
  PJ.PRESETS = [
    { key: 'morning', name: 'Morning pooja (nitya puja)', icon: '🪔', time: '06:30', days: null, notes: 'Clean the altar → light the diya and agarbatti → offer water, flowers, akshat (rice) and naivedya → chant your ishta mantra → aarti.' },
    { key: 'surya', name: 'Surya Arghya at sunrise', icon: '🌅', time: '06:15', days: null, notes: 'Offer water from a copper lota facing the rising sun; chant “Om Suryaya Namah” or the 12 names of Surya.' },
    { key: 'gayatri', name: 'Gayatri mantra jaap (108)', icon: '📿', time: '06:45', days: null, notes: 'One mala (108) of the Gayatri mantra after bath, sitting facing east.' },
    { key: 'evening', name: 'Sandhya aarti (evening lamp)', icon: '🕯️', time: '18:30', days: null, notes: 'Light a ghee diya at the altar and at the entrance at dusk; aarti and a short prayer.' },
    { key: 'tulsi', name: 'Tulsi puja and diya', icon: '🌿', time: '18:00', days: null, notes: 'Water the Tulsi in the morning, light a diya near it in the evening. Tulsi leaves are not plucked on Sunday, Ekadashi and at night.' },
    { key: 'hanuman', name: 'Hanuman Chalisa', icon: '🙏', time: '07:00', days: [2, 6], notes: 'Recite the Hanuman Chalisa (or Sundar Kand on Tuesdays); offer sindoor and jasmine oil, laddoo or gud-chana.' },
    { key: 'shiv', name: 'Shiv abhishek', icon: '🔱', time: '07:00', days: [1], notes: 'Offer water / milk on the Shivling with bel patra; chant “Om Namah Shivaya” 108 times.' },
    { key: 'vishnu', name: 'Vishnu Sahasranama path', icon: '🪷', time: '07:00', days: [4], notes: 'Read the Vishnu Sahasranama; offer yellow flowers, chana dal and gud (Guruvar).' },
    { key: 'lakshmi', name: 'Lakshmi puja', icon: '🌸', time: '19:00', days: [5], notes: 'Friday evening: diya, lotus or red flowers, kheer or mishri; Shri Suktam or Lakshmi aarti.' },
    { key: 'shani', name: 'Shani puja — diya under peepal', icon: '🪔', time: '19:00', days: [6], notes: 'Saturday: a mustard-oil diya under a peepal tree; give black til, urad or oil in daan.' },
    { key: 'gita', name: 'Bhagavad Gita path (a chapter)', icon: '📖', time: '21:00', days: null, notes: 'Read one chapter (or a few shlokas) with its meaning.' },
    { key: 'dhyan', name: 'Meditation / dhyan (15 minutes)', icon: '🧘', time: '05:45', days: null, notes: 'Sit quietly, breathe slowly, mantra or breath awareness.' },
    { key: 'sandhya', name: 'Sandhya vandanam', icon: '💧', time: '06:00', days: null, notes: 'Achamana, pranayama, arghya and Gayatri at dawn, noon and dusk.' },
  ];

  /* ---------------- vrats ---------------- */
  PJ.VRATS = {
    ekadashi: { name: 'Ekadashi', group: 'Twice a month', when: 'The 11th tithi of each paksha (twice a month)', deity: 'Lord Vishnu',
      how: ['Bath early, light a lamp before Vishnu / Krishna; offer tulsi leaves (plucked the day before) and yellow flowers.', 'Chant “Om Namo Bhagavate Vasudevaya”, read the Ekadashi katha or Vishnu Sahasranama.', 'Evening aarti; spend the night in bhajan if you can.'],
      food: 'No rice, grains, pulses, onion or garlic. Fruit, milk, curd, sabudana, kuttu, singhara, rajgira, potatoes, sendha namak. Nirjala for the devout.', paran: 'Break the fast (paran) the next day, Dwadashi, after sunrise — with a little rice or the prasad.' },
    pradosh: { name: 'Pradosh', group: 'Twice a month', when: 'Trayodashi (13th tithi) of each paksha; the puja is at pradosh kaal, about 1½ hours around sunset', deity: 'Lord Shiva',
      how: ['Fast through the day.', 'At dusk: bath, abhishek of the Shivling with water, milk, curd, honey; bel patra and white flowers.', 'Pradosh katha, “Om Namah Shivaya”, aarti.'], food: 'Fruit and milk in the day; a satvik meal after the evening puja.', paran: 'After the evening puja.' },
    purnima: { name: 'Purnima', group: 'Twice a month', when: 'Full-moon day', deity: 'Lord Vishnu (Satyanarayan), Chandra',
      how: ['Satyanarayan katha and puja with panchamrit and prasad.', 'Arghya to the moon at moonrise.', 'Daan and a holy dip if possible.'], food: 'One satvik meal or fruit and milk.', paran: 'After the moon arghya.' },
    amavasya: { name: 'Amavasya', group: 'Twice a month', when: 'New-moon day', deity: 'Pitrs (ancestors)',
      how: ['Tarpan for the ancestors with water, black til and kusha.', 'A diya under a peepal tree in the evening.', 'Feed a cow, crows, dogs or the needy.'], food: 'A simple satvik meal; many fast till noon.', paran: '' },
    sankashti: { name: 'Sankashti Chaturthi', group: 'Twice a month', when: 'Krishna Chaturthi — the day it is current at moonrise', deity: 'Lord Ganesha',
      how: ['Fast from sunrise.', 'Evening Ganesh puja with durva grass, red flowers and modak / laddoo; Sankashti katha.', 'Arghya to the moon when it rises.'], food: 'Fruit, milk, sabudana, peanuts; no grains.', paran: 'After sighting the moon and offering arghya.' },
    vinayaka: { name: 'Vinayaka Chaturthi', group: 'Twice a month', when: 'Shukla Chaturthi (4th tithi after the new moon)', deity: 'Lord Ganesha',
      how: ['Ganesh puja at midday with durva, modak and red flowers.', 'Do not look at the moon on this night.'], food: 'Fruit and milk, or one meal.', paran: 'Evening.' },
    shivaratri: { name: 'Masik Shivaratri', group: 'Twice a month', when: 'Krishna Chaturdashi each month', deity: 'Lord Shiva',
      how: ['Fast through the day; night puja of the Shivling.', 'Chant “Om Namah Shivaya”; bel patra, dhatura, milk.'], food: 'Fruit and milk.', paran: 'Next morning after bath.' },
    durgashtami: { name: 'Masik Durgashtami', group: 'Twice a month', when: 'Shukla Ashtami each month', deity: 'Maa Durga',
      how: ['Durga puja with red flowers and chunri; Durga Chalisa or Saptashati path.'], food: 'Fruit and milk.', paran: 'Evening.' },
    skanda: { name: 'Skanda Shashti', group: 'Twice a month', when: 'Shukla Shashti each month', deity: 'Lord Kartikeya (Murugan)',
      how: ['Puja of Lord Murugan; Skanda Shashti Kavacham.'], food: 'One meal or fruit.', paran: 'Evening.' },
    somvar: { name: 'Somvar (Monday)', group: 'Weekly', when: 'Every Monday (16 Somvar, or Sawan Mondays)', deity: 'Lord Shiva',
      how: ['Jal or milk abhishek of the Shivling, bel patra; Somvar vrat katha.'], food: 'One meal after the evening puja; no salt for some.', paran: 'Evening.' },
    mangalvar: { name: 'Mangalvar (Tuesday)', group: 'Weekly', when: 'Every Tuesday', deity: 'Lord Hanuman',
      how: ['Hanuman Chalisa / Sundar Kand; sindoor and chameli oil; boondi or gud-chana prasad.'], food: 'One meal, no salt (sweet food).', paran: 'Evening.' },
    budhvar: { name: 'Budhvar (Wednesday)', group: 'Weekly', when: 'Every Wednesday', deity: 'Lord Ganesha / Budh',
      how: ['Ganesh puja with durva; green moong or green clothes in daan.'], food: 'One meal.', paran: 'Evening.' },
    guruvar: { name: 'Guruvar (Thursday)', group: 'Weekly', when: 'Every Thursday', deity: 'Lord Vishnu / Brihaspati',
      how: ['Yellow clothes; puja of the banana tree; chana dal, gud and haldi; Brihaspativar katha.'], food: 'One meal of yellow food; no banana.', paran: 'Evening.' },
    shukravar: { name: 'Shukravar (Friday)', group: 'Weekly', when: 'Every Friday (16 Fridays)', deity: 'Santoshi Mata / Lakshmi',
      how: ['Gud-chana prasad, Santoshi Mata katha; Lakshmi puja in the evening.'], food: 'One meal; nothing sour (no curd, lemon, tamarind) for Santoshi Mata vrat.', paran: 'Evening.' },
    shanivar: { name: 'Shanivar (Saturday)', group: 'Weekly', when: 'Every Saturday', deity: 'Shani Dev / Hanuman',
      how: ['Mustard-oil diya under a peepal; black til, urad and oil in daan; Hanuman Chalisa.'], food: 'One meal after sunset.', paran: 'Evening.' },
    ravivar: { name: 'Ravivar (Sunday)', group: 'Weekly', when: 'Every Sunday', deity: 'Surya Dev',
      how: ['Arghya to the sun with red flowers and roli; Aditya Hridayam.'], food: 'One meal before sunset, without salt.', paran: 'Before sunset.' },
    navratri: { name: 'Navratri', group: 'Festivals', when: 'Chaitra and Sharad Navratri: Shukla Pratipada to Navami', deity: 'Maa Durga (nine forms)',
      how: ['Ghatasthapana on day 1; akhand jyoti if you keep one.', 'Each day the goddess of the day (Shailaputri, Brahmacharini, Chandraghanta, Kushmanda, Skandamata, Katyayani, Kalaratri, Mahagauri, Siddhidatri).', 'Kanya pujan on Ashtami or Navami.'],
      food: 'Phalahar: kuttu, singhara, sabudana, samak rice, fruit, milk; sendha namak; no onion and garlic.', paran: 'On Navami after Kanya pujan, or on Dashami.' },
    karvachauth: { name: 'Karva Chauth', group: 'Festivals', when: 'Krishna Chaturthi of Kartik (purnimanta)', deity: 'Shiva-Parvati, Ganesha, Chandra',
      how: ['Sargi before sunrise.', 'Nirjala fast through the day; evening katha with the karva.', 'Look at the moon through a sieve, arghya, then the husband offers water.'], food: 'Nirjala (no food or water) till moonrise.', paran: 'After moonrise and arghya.' },
    ahoi: { name: 'Ahoi Ashtami', group: 'Festivals', when: 'Krishna Ashtami of Kartik (purnimanta)', deity: 'Ahoi Mata',
      how: ['Fast by mothers for their children; Ahoi Mata picture and katha in the evening.', 'Arghya to the stars.'], food: 'Nirjala or phalahar till the stars appear.', paran: 'After sighting the stars.' },
    janmashtami: { name: 'Janmashtami', group: 'Festivals', when: 'Krishna Ashtami of Bhadrapada (purnimanta), midnight', deity: 'Lord Krishna',
      how: ['Fast through the day; decorate Laddu Gopal’s jhula.', 'Midnight birth celebration, abhishek with panchamrit, aarti.'], food: 'Phalahar; no grains.', paran: 'After the midnight puja, or the next morning.' },
    mahashivaratri: { name: 'Maha Shivaratri', group: 'Festivals', when: 'Krishna Chaturdashi of Phalguna (purnimanta)', deity: 'Lord Shiva',
      how: ['Fast and stay awake; four prahar pujas through the night.', 'Abhishek with water, milk, curd, honey, ghee; bel patra, dhatura.'], food: 'Fruit and milk, or nirjala.', paran: 'Next morning after bath and puja.' },
    hartalika: { name: 'Hartalika Teej', group: 'Festivals', when: 'Shukla Tritiya of Bhadrapada', deity: 'Shiva-Parvati',
      how: ['Nirjala fast by women; clay idols of Shiva-Parvati; night-long puja and katha.'], food: 'Nirjala.', paran: 'Next morning.' },
    teej: { name: 'Hariyali Teej', group: 'Festivals', when: 'Shukla Tritiya of Shravana', deity: 'Parvati',
      how: ['Green clothes, mehendi, swings; Parvati puja and katha.'], food: 'Fast or phalahar.', paran: 'Evening.' },
    vatsavitri: { name: 'Vat Savitri', group: 'Festivals', when: 'Jyeshtha Amavasya (North India)', deity: 'Savitri-Satyavan, the banyan tree',
      how: ['Tie raw cotton thread round a banyan tree, 7 or 108 rounds; Savitri katha.'], food: 'Fast till the puja.', paran: 'After the puja.' },
    chhath: { name: 'Chhath', group: 'Festivals', when: 'Kartik Shukla Shashti (4 days, Chaturthi to Saptami)', deity: 'Surya and Chhathi Maiya',
      how: ['Nahay-khay, Kharna, evening arghya to the setting sun, morning arghya to the rising sun.'], food: '36-hour nirjala fast from Kharna evening.', paran: 'After the morning arghya.' },
    ramnavami: { name: 'Ram Navami', group: 'Festivals', when: 'Chaitra Shukla Navami (midday)', deity: 'Lord Rama',
      how: ['Puja at midday when Rama was born; Ramcharitmanas path.'], food: 'Phalahar.', paran: 'After the midday puja.' },
    sankranti: { name: 'Makar Sankranti', group: 'Festivals', when: 'When the Sun enters Makara (14/15 January)', deity: 'Surya',
      how: ['Holy dip, arghya to the sun; daan of til, gud, khichdi and blankets.'], food: 'Til-gud, khichdi.', paran: '' },
  };
  const VKEYS = Object.keys(PJ.VRATS);
  const vname = (k, day) => k === 'ekadashi' && day && day.ekadashi ? day.ekadashi : k === 'navratri' && day && day.navratriDay ? 'Navratri day ' + day.navratriDay : (PJ.VRATS[k] || {}).name || k;

  /* my own vrat: is it kept on day k? (between start and stop; every day, chosen weekdays, a tithi, or once) */
  PJ.TITHIS = Array.from({ length: 30 }, (_, i) => [String(i + 1), (i < 15 ? 'Shukla ' : 'Krishna ') + (i === 14 ? 'Purnima' : i === 29 ? 'Amavasya' : P ? P.TITHI[i % 15] : String(i % 15 + 1))]);
  PJ.customOn = (c, k, day) => {
    if (!c || c.off || !U.isKey(c.start) || k < c.start || (c.stop && k > c.stop)) return false;
    if (c.rule === 'once') return k === c.start;
    if (c.rule === 'weekly') return (c.days || []).indexOf(U.dow(k)) >= 0;
    if (c.rule === 'tithi') { day = day || P.day(k); return day.tithi === +c.tithi || day.kshaya && P.tithiShort(+c.tithi) === day.kshaya && (+c.tithi <= 15) === (day.tithi <= 15); }
    return true;
  };
  const customWhen = c => (c.rule === 'once' ? 'on ' + U.fmtShort(c.start) : c.rule === 'weekly' ? 'every ' + (c.days || []).map(d => U.DAY3[d]).join(', ') : c.rule === 'tithi' ? 'on every ' + (PJ.TITHIS[(+c.tithi || 1) - 1] || [0, ''])[1] : 'every day') +
    (c.rule === 'once' ? '' : ' from ' + U.fmtShort(c.start) + (c.stop ? ' to ' + U.fmtShort(c.stop) : ''));

  /* ---------------- planner tasks ---------------- */
  const PID = id => 'tk-pj-' + id, VID = (k, d) => 'tk-vr-' + k + '-' + d, FID = d => 'tk-fs-' + d;
  const BIG = /Navratri|Ram Navami|Hanuman Jayanti|Akshaya|Buddha|Rath|Guru Purnima|Raksha|Janmashtami|Ganesh|Dussehra|Karva|Ahoi|Dhanteras|Diwali|Govardhan|Bhai Dooj|Chhath|Dev Uthani|Kartik Purnima|Vasant|Shivaratri|Holi|Makar|Baisakhi|Lohri|Teej|Nag Panchami|Pitru|Mahalaya|Gita Jayanti|Vat |Ganga/;
  let busy = false;
  PJ.reconcile = () => {
    if (busy || !D() || !D().tasks) return false;
    busy = true; let ch = false;
    try {
      const p = PD(), d = D(), today = U.today(), live = new Set();
      const need = p.daily.some(x => !x.off) || p.vrats.length || p.custom.length || p.fest;
      const role = need ? ED.lifeRole(/spiritual|pooja|puja|devotion|religio|faith|prayer/i, 'Spiritual & Pooja', '🕉️', '#c2410c', p) : null;
      const find = id => d.tasks.find(t => t.id === id);
      // everyday poojas: one repeating task each
      const yday = U.addDays(today, -1);
      p.daily.forEach(x => {
        const id = PID(x.id); live.add(id);
        if (x.off || x.noPlan) {      // switched off: the task stops from today; the days already ticked stay
          const t = find(id);
          if (t && t.repeat && !(t.repeat.until && t.repeat.until <= yday)) {
            const ticked = Object.keys(t.occ || {}).sort().pop();       // keep any day already ticked
            if (t.date > yday && !ticked) d.tasks = d.tasks.filter(y => y !== t);
            else t.repeat = Object.assign({}, t.repeat, { until: t.date > yday ? ticked : yday });
            ch = true;
          }
          return;
        }
        const every = Math.max(1, +x.every || 1);
        const rep = x.days && x.days.length && x.days.length < 7 ? { freq: 'weekly', days: x.days.slice(), interval: 1 } : { freq: 'daily', interval: every };
        if (U.isKey(x.end)) rep.until = x.end;                      // 1.19: an end date for the pooja
        const title = (x.icon ? x.icon + ' ' : '') + x.name;
        let t = find(id);
        if (!t) {
          t = M.newTask({ id, title, date: x.start || today, time: x.time || null, dur: 15, prio: 'A', repeat: rep, roleId: role, link: { k: 'pooja', id: x.id }, linkTitle: title, notes: x.notes || '' });
          d.tasks.push(t); ch = true; return;
        }
        const want = { time: x.time || null };
        // switched on again: the old task carries on (its ticked days stay); otherwise it starts on the pooja's "From" day
        const anchor = t.repeat && t.repeat.until ? t.date : (x.start || t.date);
        if (anchor && t.date !== anchor) { t.date = anchor; ch = true; }
        if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
        if (t.time !== want.time) { t.time = want.time; ch = true; }
        if (JSON.stringify(t.repeat) !== JSON.stringify(rep)) { t.repeat = rep; ch = true; }
        if (!t.roleId && role) { t.roleId = role; ch = true; }
      });
      // vrats and festivals: one task on each day, for the days ahead
      const ahead = Math.max(7, Math.min(120, +p.ahead || 30));
      if ((p.vrats.length || p.custom.length || p.fest) && P) {
        for (let i = 0; i < ahead; i++) {
          const k = U.addDays(today, i), day = P.day(k);
          p.vrats.forEach(key => {
            if (day.vrats.indexOf(key) < 0) return;
            if (U.isKey(p.vratEnd[key]) && k > p.vratEnd[key]) return;      // 1.19: kept until this date
            const id = VID(key, k); if (p.skip[id]) return;
            live.add(id);
            const v = PJ.VRATS[key] || {};
            const title = '🙏 Vrat: ' + vname(key, day);
            let t = find(id);
            if (!t) {
              t = M.newTask({ id, title, date: k, allDay: true, prio: 'A', noCarry: true, roleId: role, link: { k: 'vrat', id: key, date: k }, linkTitle: title,
                notes: [v.when, v.food ? 'Food: ' + v.food : '', v.paran ? 'Paran: ' + v.paran : ''].filter(Boolean).join('\n') });
              t.num = M.nextNum(t.prio, t.date);
              d.tasks.push(t); ch = true;
            } else if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
          });
          // my own vrats, between their start and stop dates
          p.custom.forEach(c => {
            if (!PJ.customOn(c, k, day)) return;
            const id = 'tk-vc-' + c.id + '-' + k; if (p.skip[id]) return;
            live.add(id);
            const title = '🙏 Vrat: ' + c.name;
            let t = find(id);
            if (!t) {
              t = M.newTask({ id, title, date: k, allDay: true, prio: 'A', noCarry: true, roleId: role, link: { k: 'vrat', id: 'c:' + c.id, date: k }, linkTitle: title,
                notes: [c.deity ? 'For: ' + c.deity : '', c.food ? 'Food: ' + c.food : '', c.paran ? 'Paran: ' + c.paran : '', c.notes || ''].filter(Boolean).join('\n') });
              t.num = M.nextNum(t.prio, t.date); d.tasks.push(t); ch = true;
            } else if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
          });
          if (p.fest && !(U.isKey(p.festEnd) && k > p.festEnd)) {
            const fs = day.festivals.filter(f => BIG.test(f));
            if (fs.length) {
              const id = FID(k);
              if (!p.skip[id]) {
                live.add(id);
                const title = '🪔 ' + fs.join(' · ');
                let t = find(id);
                if (!t) { t = M.newTask({ id, title, date: k, allDay: true, prio: 'B', noCarry: true, roleId: role, link: { k: 'fest', id: k, date: k }, linkTitle: title }); d.tasks.push(t); ch = true; }
                else if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
              }
            }
          }
        }
      }
      // tasks no longer wanted: open ones from today on go; past and done ones stay as your record
      const before = d.tasks.length;
      d.tasks = d.tasks.filter(t => {
        if (!t.link || ['pooja', 'vrat', 'fest'].indexOf(t.link.k) < 0 || live.has(t.id)) return true;
        if (t.link.k === 'pooja') return false;                    // the pooja was removed or switched off
        if (t.date && t.date < today) return true;
        return M.isClosed(t.status);
      });
      if (d.tasks.length !== before) ch = true;
      // tidy the skip list (days gone by)
      Object.keys(p.skip).forEach(id => { const m = id.match(/(\d{4}-\d{2}-\d{2})$/); if (m && m[1] < U.addDays(today, -2)) { delete p.skip[id]; ch = true; } });
    } catch (err) { console.warn('[e-diary] pooja', err); }
    finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => {
    if (type !== 'change' || (detail && detail.reason === 'pooja')) return;
    if (PJ.reconcile()) ED.store.commit({ reason: 'pooja' });
  });
  const kick = () => { if (!ED.store.data) { setTimeout(kick, 400); return; } if (PJ.reconcile()) ED.store.commit({ reason: 'pooja' }); };
  setTimeout(kick, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ED.store.data) setTimeout(kick, 300); });

  // deleting one of these tasks: a pooja is taken out of the planner; a vrat or festival day is skipped
  const del0 = M.deleteTask;
  M.deleteTask = id => {
    const t = M.task(id);
    if (t && t.link && D().pooja) {
      const p = PD();
      if (t.link.k === 'pooja') { const x = p.daily.find(y => y.id === t.link.id); if (x) { x.noPlan = true; x.updatedAt = Date.now(); } }
      else if (t.link.k === 'vrat' || t.link.k === 'fest') p.skip[t.id] = 1;
    }
    return del0(id);
  };
  // clicking one opens this page
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    if (o && o.t.link && ['pooja', 'vrat', 'fest'].indexOf(o.t.link.k) >= 0) {
      const s = st(); s.day = o.k || o.t.link.date || U.today();
      if (o.t.link.k === 'vrat') { s.tab = 'vrats'; s.open = String(o.t.link.id).indexOf('c:') === 0 ? null : o.t.link.id; } else if (o.t.link.k === 'pooja') s.tab = 'poojas';
      ED.go.tab('pooja'); return;
    }
    return open0 && open0(el, ev);
  };

  /* ---------------- the Panchang line on the Daily page ---------------- */
  PJ.dailyStrip = k => {
    if (!P || PD().strip === false) return '';
    let x; try { x = P.day(k); } catch (err) { return ''; }
    const mine = PD().vrats.filter(v => x.vrats.indexOf(v) >= 0 && ['ravivar', 'somvar', 'mangalvar', 'budhvar', 'guruvar', 'shukravar', 'shanivar'].indexOf(v) < 0);
    return '<button type="button" class="pj-strip" data-act="pj-go" data-date="' + k + '" title="Hindu calendar — open Pooja &amp; Vrat">' +
      '<span class="pj-om" aria-hidden="true">🕉️</span><span class="pj-st"><b>' + e(x.month + ' ' + x.label) + '</b>' + (x.tithiEnds ? ' <span class="hint">till ' + e(FX().time(x.tithiEnds)) + '</span>' : '') +
      ' · ' + e(x.nakshatra) + ' · ' + e(x.vara) + ' · <span class="hint">VS ' + x.samvat + '</span></span>' +
      (x.festivals.length ? '<span class="pj-fest">' + e(x.festivals.join(' · ')) + '</span>' : '') +
      mine.map(v => '<span class="chip pj-vchip">🙏 ' + e(vname(v, x)) + '</span>').join('') + '</button>';
  };

  /* ---------------- left page: the Hindu calendar ---------------- */
  const day = () => st().day || U.today();
  const row = (l, v) => '<div class="pj-row"><span class="pj-l">' + l + '</span><span class="pj-rv">' + v + '</span></div>';
  const monthGrid = k => {
    const [y, m] = U.ymd(k), first = U.firstOfMonth(k), n = U.daysInMonth(y, m - 1), today = U.today();
    const lead = U.dow(first);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="pj-c empty"></span>';
    for (let i = 0; i < n; i++) {
      const kk = U.addDays(first, i), x = P.day(kk);
      const big = x.festivals.some(f => BIG.test(f)), mark = x.tithi === 15 ? '🌕' : x.tithi === 30 ? '🌑' : x.vrats.indexOf('ekadashi') >= 0 ? 'E' : '';
      cells += '<button type="button" class="pj-c' + (kk === today ? ' today' : '') + (kk === k ? ' sel' : '') + (big ? ' fest' : '') + '" data-act="pj-day" data-date="' + kk + '" title="' + e(x.label + (x.festivals.length ? ' — ' + x.festivals.join(', ') : '')) + '">' +
        '<b class="num">' + (i + 1) + '</b><span class="pj-ct">' + e(x.tithi === 15 ? 'Purnima' : x.tithi === 30 ? 'Amavasya' : (x.tithi > 15 ? 'K' : 'S') + (((x.tithi - 1) % 15) + 1)) + '</span>' + (mark ? '<i class="pj-mk">' + mark + '</i>' : '') + '</button>';
    }
    return '<div class="pj-cal"><div class="pj-cal-h">' + U.DAY3.map(w => '<span>' + w + '</span>').join('') + '</div><div class="pj-cal-g">' + cells + '</div></div>';
  };
  const upcoming = (from, n) => {
    const out = [], mine = PD().vrats;
    for (let i = 0; i < n; i++) {
      const k = U.addDays(from, i), x = P.day(k);
      const v = mine.filter(key => x.vrats.indexOf(key) >= 0 && ['ravivar', 'somvar', 'mangalvar', 'budhvar', 'guruvar', 'shukravar', 'shanivar'].indexOf(key) < 0).map(key => vname(key, x));
      const f = x.festivals.filter(t => BIG.test(t) || /Ekadashi|Purnima|Amavasya/.test(t));
      if (x.tithi === 15 && !f.some(t => /Purnima/.test(t))) f.push('Purnima');
      if (x.tithi === 30 && !f.some(t => /Amavasya/.test(t))) f.push('Amavasya');
      if (x.ekadashi && !v.some(t => /Ekadashi/.test(t))) f.push(x.ekadashi);
      if (f.length || v.length) out.push({ k, x, f, v });
    }
    return out;
  };
  const left = () => {
    const k = day(), x = P.day(k), today = U.today();
    const nav = '<div class="hl-daynav"><button type="button" class="icon-btn sm" data-act="pj-step" data-dir="-1" aria-label="Previous day">' + ED.icon('chevL') + '</button><b>' + (k === today ? 'Today · ' : '') + e(U.fmtLong(k)) + '</b>' +
      '<button type="button" class="icon-btn sm" data-act="pj-step" data-dir="1" aria-label="Next day">' + ED.icon('chevR') + '</button>' + (k !== today ? '<button type="button" class="btn small ghost" data-act="pj-step" data-dir="0">Today</button>' : '') + '</div>';
    const card = '<div class="pj-card">' +
      '<div class="pj-big"><span class="pj-moon" aria-hidden="true">' + (x.tithi === 15 ? '🌕' : x.tithi === 30 ? '🌑' : x.tithi < 15 ? (x.tithi < 8 ? '🌒' : '🌔') : (x.tithi < 23 ? '🌖' : '🌘')) + '</span>' +
      '<div><div class="pj-t">' + e(x.label) + '</div><div class="pj-m">' + e(x.month) + ' maas · ' + e(x.monthHindi) + ' · ' + e(x.paksha) + ' paksha</div></div></div>' +
      row('Tithi', e(x.tithiName) + (x.tithiEnds ? ' <span class="hint">till ' + e(FX().time(x.tithiEnds)) + '</span>' : ' <span class="hint">all day</span>') + (x.kshaya ? ' · then ' + e(x.kshaya) + ' (kshaya)' : '')) +
      row('Nakshatra', e(x.nakshatra) + (x.nakEnds ? ' <span class="hint">till ' + e(FX().time(x.nakEnds)) + '</span>' : '')) +
      row('Yoga', e(x.yoga)) + row('Vaar', e(x.vara)) +
      row('Month', e(x.month) + ' (purnimanta, North India) · ' + e(x.monthAmanta) + ' (amanta)') +
      row('Samvat', 'Vikram ' + x.samvat + ' · Shaka ' + x.shaka) + row('Ritu', e(x.ritu)) +
      row('Sun · Moon', e(x.sunSign) + ' · ' + e(x.moonSign)) +
      row('Sunrise · Sunset', e(FX().time(x.sunrise)) + ' · ' + e(FX().time(x.sunset)) + ' <span class="hint">' + e(x.place) + '</span>') +
      (x.festivals.length ? '<div class="pj-fests">' + x.festivals.map(f => '<span class="chip pj-fchip">🪔 ' + e(f) + '</span>').join('') + '</div>' : '') +
      (x.ekadashi ? '<div class="pj-fests"><span class="chip pj-vchip">🙏 ' + e(x.ekadashi) + '</span></div>' : '') + '</div>';
    const up = upcoming(today, 45).slice(0, 18);
    const upHtml = up.length ? '<ul class="xp-list pj-up">' + up.map(u => '<li><button type="button" class="plain-btn xp-li" data-act="pj-day" data-date="' + u.k + '"><span class="num pj-ud">' + e(U.fmtDM(u.k)) + ' <span class="hint">' + U.DAY3[U.dow(u.k)] + '</span></span><span class="grow">' +
      u.v.map(t => '<b class="pj-mine">🙏 ' + e(t) + '</b>').join(' ') + (u.v.length && u.f.length ? ' · ' : '') + e(u.f.join(' · ')) + '</span><span class="hint">' + e(FX().when(u.k)) + '</span></button></li>').join('') + '</ul>' : '<p class="hint">Nothing in the next weeks.</p>';
    const [y, m] = U.ymd(k);
    const body = nav + card +
      '<h3 class="gh fin-gap">' + e(U.MONTHS[m - 1] + ' ' + y) + ' <span class="hint">· S = Shukla, K = Krishna, E = Ekadashi</span><span class="grow"></span><button type="button" class="icon-btn sm" data-act="pj-month" data-dir="-1" aria-label="Previous month">' + ED.icon('chevL') + '</button><button type="button" class="icon-btn sm" data-act="pj-month" data-dir="1" aria-label="Next month">' + ED.icon('chevR') + '</button></h3>' + monthGrid(k) +
      '<h3 class="gh fin-gap">Coming up <span class="hint">· festivals, Ekadashi, Purnima, Amavasya and your vrats</span></h3>' + upHtml +
      '<p class="hint pj-note">Worked out on this device for ' + e(x.place) + ' (change the city in Settings → Weather). Tithi at sunrise (udaya tithi); a festival can fall a day apart in your local almanac when a tithi changes near sunrise or sunset.</p>';
    return FX().page('pj', 'Hindu calendar · पंचांग', '', body, 'pj-l');
  };

  /* ---------------- right page: my poojas, vrats, settings ---------------- */
  const daysText = x => x.days && x.days.length && x.days.length < 7 ? x.days.map(d => U.DAY3[d]).join(', ') : (+x.every > 1 ? (+x.every === 2 ? 'alternate days' : 'once in ' + x.every + ' days') : 'every day');
  const poojasTab = () => {
    const p = PD(), list = p.daily.slice().sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')));
    const have = new Set(p.daily.map(x => x.key).filter(Boolean));
    const rows = list.map(x => '<li class="pj-p' + (x.off ? ' off' : '') + '"><label class="switch pj-sw" title="In the daily planner"><input type="checkbox" data-change="pj-on" data-id="' + e(x.id) + '"' + (!x.off && !x.noPlan ? ' checked' : '') + '><span class="track"></span></label>' +
      '<button type="button" class="plain-btn grow pj-pb" data-act="pj-edit" data-id="' + e(x.id) + '"><b>' + e((x.icon ? x.icon + ' ' : '') + x.name) + '</b><span class="hint">' + e([x.time ? FX().time(x.time) : 'any time', daysText(x)].join(' · ')) + '</span>' + (x.notes ? '<span class="hint pj-pn">' + e(x.notes) + '</span>' : '') + '</button></li>').join('');
    const presets = PJ.PRESETS.filter(x => !have.has(x.key)).map(x => '<button type="button" class="chip pj-preset" data-act="pj-add" data-key="' + x.key + '" title="' + e(x.notes) + '">' + e(x.icon + ' ' + x.name) + '</button>').join('');
    return '<p class="hint">Everyday rituals you keep. Each one ticked here is a repeating task in the Daily planner under “Spiritual &amp; Pooja”, at its time.</p>' +
      (rows ? '<ul class="pj-plist">' + rows + '</ul>' : '<p class="hint">No poojas yet — add one below.</p>') +
      '<div class="row-btns"><button type="button" class="btn small primary" data-act="pj-edit">' + ED.icon('plus') + 'Add my own pooja / ritual</button></div>' +
      (presets ? '<h4 class="ls-gh">Add from the list</h4><div class="pj-presets">' + presets + '</div>' : '');
  };
  const vratsTab = () => {
    const p = PD(), s = st(), today = U.today();
    const groups = {}; VKEYS.forEach(k => { const g = PJ.VRATS[k].group; (groups[g] = groups[g] || []).push(k); });
    const own = p.custom.map(c => { const nx = []; for (let i = 0; i < 120 && nx.length < 3; i++) { const k = U.addDays(today, i); if (PJ.customOn(c, k)) nx.push(k); }
      return '<li class="pj-v' + (c.off ? '' : ' on') + '"><div class="pj-vh"><label class="switch pj-sw"><input type="checkbox" data-change="pj-con" data-id="' + e(c.id) + '"' + (c.off ? '' : ' checked') + '><span class="track"></span></label>' +
        '<button type="button" class="plain-btn grow pj-vb" data-act="pj-cedit" data-id="' + e(c.id) + '"><b>' + e(c.name) + '</b>' + (c.deity ? ' <span class="hint">· ' + e(c.deity) + '</span>' : '') + '<span class="hint pj-vn">' + e(customWhen(c)) + (nx.length ? ' · next: ' + nx.map(k => e(U.fmtDM(k))).join(', ') : c.stop && c.stop < today ? ' · finished' : '') + '</span></button>' + ED.icon('pencil') + '</div></li>'; }).join('');
    const ownHtml = '<h4 class="ls-gh">My own vrats</h4>' + (own ? '<ul class="pj-vlist">' + own + '</ul>' : '<p class="hint">A vrat of your own — a sankalp for 40 days, 16 Somvar, Sawan Mondays, a Navratri you keep differently — with its start and stop dates.</p>') +
      '<div class="row-btns"><button type="button" class="btn small primary" data-act="pj-cedit">' + ED.icon('plus') + 'Add my own vrat</button></div>';
    return ownHtml + '<p class="hint">Tick the vrats you keep. Each falls on its day as a task in the Daily planner (the next ' + (+p.ahead || 30) + ' days are filled in), with the food rules and paran in its notes.</p>' +
      Object.keys(groups).map(g => '<h4 class="ls-gh">' + e(g) + '</h4><ul class="pj-vlist">' + groups[g].map(k => {
        const v = PJ.VRATS[k], on = p.vrats.indexOf(k) >= 0, open = s.open === k;
        const nx = P.next(k, today, k === 'navratri' || PJ.VRATS[k].group === 'Festivals' ? 400 : 60).slice(0, 3);
        return '<li class="pj-v' + (on ? ' on' : '') + '"><div class="pj-vh"><label class="switch pj-sw"><input type="checkbox" data-change="pj-vrat" data-k="' + k + '"' + (on ? ' checked' : '') + '><span class="track"></span></label>' +
          '<button type="button" class="plain-btn grow pj-vb" data-act="pj-vopen" data-k="' + k + '" aria-expanded="' + open + '"><b>' + e(v.name) + '</b> <span class="hint">· ' + e(v.deity) + '</span>' + (on && p.vratEnd[k] ? '<span class="hint pj-vn">until ' + e(U.fmtShort(p.vratEnd[k])) + '</span>' : '') + '<span class="hint pj-vn">' + (nx.length ? 'Next: ' + nx.map(d => e(U.fmtDM(d)) + (k === 'ekadashi' ? ' (' + e(P.day(d).ekadashi || '') + ')' : '')).join(', ') : e(v.when)) + '</span></button>' + ED.icon(open ? 'chevD' : 'chevR') + '</div>' +
          (open ? '<div class="pj-vd"><label class="pj-vend">Keep it until <input type="date" class="field" data-change="pj-vend" data-k="' + k + '" value="' + e(p.vratEnd[k] || '') + '"> <span class="hint">optional — leave empty to keep it every year</span></label><p><b>When:</b> ' + e(v.when) + '</p><p><b>How to keep it:</b></p><ul>' + v.how.map(h => '<li>' + e(h) + '</li>').join('') + '</ul>' + (v.food ? '<p><b>Food:</b> ' + e(v.food) + '</p>' : '') + (v.paran ? '<p><b>Paran (breaking the fast):</b> ' + e(v.paran) + '</p>' : '') + '<p class="hint">Customs differ by family and region — follow yours. Not medical advice: people who are unwell, pregnant, elderly or on medicines should keep a lighter fast.</p></div>' : '') + '</li>';
      }).join('') + '</ul>').join('');
  };
  const setTab = () => {
    const p = PD();
    return '<div class="pj-set">' +
      '<label class="switch"><input type="checkbox" data-change="pj-set" data-k="strip"' + (p.strip !== false ? ' checked' : '') + '><span class="track"></span><span>Show the Panchang line on the Daily page</span></label>' +
      '<label class="switch"><input type="checkbox" data-change="pj-set" data-k="fest"' + (p.fest ? ' checked' : '') + '><span class="track"></span><span>Also put the main festivals in the Daily planner as tasks (they are always on the calendar and the Panchang line)</span></label>' +
      (p.fest ? '<label class="pj-ahead">Festivals in the planner until <input type="date" class="field" data-change="pj-fend" value="' + e(p.festEnd || '') + '"> <span class="hint">optional</span></label>' : '') +
      '<label class="pj-ahead">Fill the planner ahead for <select class="field" data-change="pj-ahead">' + [14, 30, 45, 60, 90].map(n => FX().opt(n, n + ' days', (+p.ahead || 30) === n)).join('') + '</select></label>' +
      '<p class="hint">City for sunrise and the tithi: <b>' + e(P.place().name) + '</b> — change it in Settings → Weather &amp; Quotes.</p>' +
      '<p class="hint">Only your poojas and the vrats you keep go into the Daily planner as tasks, under the role <b>' + e(((D().roles.find(r => r.id === p.roleId)) || {}).name || 'Spiritual & Pooja') + '</b> (rename it on the Roles page). Deleting a pooja’s task takes it out of the planner (switch it on again here); deleting a vrat or festival task skips that day only.</p></div>';
  };
  const right = () => {
    const s = st(), tab = s.tab || 'poojas';
    const seg = FX().seg('pj-tab', tab, [['poojas', 'My poojas'], ['vrats', 'Vrats'], ['set', 'Settings']], 'Show');
    const body = tab === 'vrats' ? vratsTab() : tab === 'set' ? setTab() : poojasTab();
    return '<div class="xp pj-r"><div class="pg-head st-head"><h2 class="pg-title">' + ({ poojas: 'My everyday poojas', vrats: 'Vrats (fasts)', set: 'Pooja settings' })[tab] + '</h2>' + seg + '</div><div class="st-scroll scroll" data-keep-scroll="pj-r-' + tab + '">' + body + '</div></div>';
  };

  ED.views = ED.views || {};
  ED.views.pooja = { id: 'pooja', label: 'Pooja & Vrat', left: () => P ? left() : '', right };

  /* ---------------- editor and actions ---------------- */
  PJ.edit = (id, preset) => {
    const p = PD(), x = id ? p.daily.find(y => y.id === id) : null;
    const base = x || Object.assign({ name: '', icon: '🪔', time: '07:00', days: null, every: 1, notes: '', start: U.today() }, preset || {});
    FX().form({
      title: x ? 'Pooja / ritual' : 'Add a pooja / ritual', wide: true,
      data: Object.assign({}, base, { every: String(base.every || 1) }),
      fields: [
        { k: 'name', label: 'Pooja / ritual', req: true, ph: 'e.g. Morning pooja, Hanuman Chalisa, Surya arghya' },
        { k: 'icon', label: 'Symbol', ph: '🪔 🙏 📿 🌅 🔱 🌿' },
        { k: 'time', label: 'Time', type: 'time' },
        { k: 'days', label: 'Days', type: 'days' },
        { k: 'every', label: 'How often', type: 'select', options: [['1', 'On the days ticked'], ['2', 'Alternate days'], ['3', 'Once in 3 days'], ['7', 'Once a week'], ['15', 'Once a fortnight']], hint: 'Used when every day is ticked.' },
        { k: 'start', label: 'From', type: 'date' },
        { k: 'end', label: 'Until (optional)', type: 'date', hint: 'Leave empty to keep it going.' },
        { k: 'notes', label: 'How I do it', type: 'textarea', rows: 3, ph: 'Steps, mantra, samagri…' },
      ],
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Remove pooja', message: 'Remove “' + x.name + '” and its task in the planner?', ok: 'Remove', danger: true })) return false; ED.store.checkpoint('Remove pooja'); p.daily = p.daily.filter(y => y !== x); ED.store.commit(); ED.ui.undoToast('Pooja removed'); } : null,
      save(v, api) {
        ED.store.checkpoint(x ? 'Pooja' : 'New pooja');
        v.every = Math.max(1, +v.every || 1); if (!v.start) v.start = U.today();
        if (v.end && v.end < v.start) { ED.ui.toast('“Until” is before “From”'); return; }
        if (x) { Object.assign(x, v, { updatedAt: Date.now() }); delete x.noPlan; }
        else p.daily.push(Object.assign({ id: U.uid('pj'), key: (preset && preset.key) || '', updatedAt: Date.now() }, v));
        ED.store.commit(); api.close(); ED.ui.toast(x ? 'Saved' : 'Added — it is in the Daily planner under Spiritual & Pooja');
      },
    });
  };
  PJ.editCustom = id => {
    const p = PD(), c = id ? p.custom.find(y => y.id === id) : null;
    FX().form({
      title: c ? 'My vrat' : 'Add my own vrat', wide: true,
      data: c ? Object.assign({}, c, { tithi: String(c.tithi || 11) }) : { name: '', rule: 'weekly', days: [1], tithi: '11', start: U.today(), stop: '', deity: '', food: '', paran: '', notes: '' },
      fields: [
        { k: 'name', label: 'Vrat', req: true, ph: 'e.g. 16 Somvar, Sawan Somvar, 40-day sankalp' },
        { k: 'rule', label: 'Kept', type: 'select', options: [['weekly', 'On chosen weekdays'], ['daily', 'Every day'], ['tithi', 'On a tithi (every month)'], ['once', 'Once (on the start date)']] },
        { k: 'days', label: 'Weekdays', type: 'days', hint: 'Used for “On chosen weekdays”.' },
        { k: 'tithi', label: 'Tithi', type: 'select', options: PJ.TITHIS, hint: 'Used for “On a tithi”.' },
        { k: 'start', label: 'Start date', type: 'date', req: true },
        { k: 'stop', label: 'Stop date', type: 'date', hint: 'Leave empty to keep it going.' },
        { k: 'deity', label: 'For (deity / intention)', ph: 'optional' },
        { k: 'food', label: 'Food rules', ph: 'phalahar, one meal, nirjala…' },
        { k: 'paran', label: 'Breaking the fast', ph: 'after the evening puja, next morning…' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      check: v => v.stop && v.stop < v.start ? 'The stop date is before the start date' : v.rule === 'weekly' && (!v.days || !v.days.length) && v.days !== null ? 'Pick at least one weekday' : '',
      del: c ? async () => { if (!await ED.ui.confirm({ title: 'Remove vrat', message: 'Remove “' + c.name + '”? Its days from today are taken out of the planner; days already past stay.', ok: 'Remove', danger: true })) return false; ED.store.checkpoint('Remove vrat'); p.custom = p.custom.filter(y => y !== c); ED.store.commit(); ED.ui.undoToast('Vrat removed'); } : null,
      save(v, api) {
        ED.store.checkpoint(c ? 'Vrat' : 'New vrat');
        if (v.rule === 'weekly' && !v.days) v.days = [0, 1, 2, 3, 4, 5, 6];
        v.tithi = +v.tithi || 11;
        if (c) Object.assign(c, v, { updatedAt: Date.now() }); else p.custom.push(Object.assign({ id: U.uid('vc'), updatedAt: Date.now() }, v));
        ED.store.commit(); api.close(); ED.ui.toast(c ? 'Saved' : 'Added — its days are in the Daily planner under Spiritual & Pooja');
      },
    });
  };
  A['pj-cedit'] = el => PJ.editCustom(el.dataset.id || null);
  CH['pj-con'] = el => { const c = PD().custom.find(y => y.id === el.dataset.id); if (!c) return; ED.store.checkpoint('Vrat'); c.off = !el.checked; c.updatedAt = Date.now(); ED.store.commit(); };
  A['pj-go'] = el => { st().day = el.dataset.date || U.today(); ED.go.tab('pooja'); };
  A['pj-day'] = el => { st().day = el.dataset.date; ED.app.render(); };
  A['pj-step'] = el => { const d = +el.dataset.dir; st().day = d ? U.addDays(day(), d) : U.today(); ED.app.render(); };
  A['pj-month'] = el => { st().day = U.addMonths(U.firstOfMonth(day()), +el.dataset.dir); ED.app.render(); };
  A['pj-tab'] = el => { st().tab = el.dataset.k; ED.app.render(); };
  A['pj-vopen'] = el => { const s = st(); s.open = s.open === el.dataset.k ? null : el.dataset.k; ED.app.render(); };
  A['pj-edit'] = el => PJ.edit(el.dataset.id || null);
  A['pj-add'] = el => { const pr = PJ.PRESETS.find(x => x.key === el.dataset.key); if (!pr) return; ED.store.checkpoint('Add pooja'); PD().daily.push(Object.assign({ id: U.uid('pj'), every: 1, start: U.today(), updatedAt: Date.now() }, U.clone(pr))); ED.store.commit(); ED.ui.undoToast(pr.name + ' added to your poojas and the Daily planner'); };
  CH['pj-on'] = el => { const x = PD().daily.find(y => y.id === el.dataset.id); if (!x) return; ED.store.checkpoint('Pooja'); x.off = !el.checked; delete x.noPlan; x.updatedAt = Date.now(); ED.store.commit(); };
  CH['pj-vrat'] = el => {
    const p = PD(), k = el.dataset.k; ED.store.checkpoint('Vrat');
    p.vrats = p.vrats.filter(x => x !== k); if (el.checked) p.vrats.push(k);
    ED.store.commit(); ED.ui.toast(el.checked ? PJ.VRATS[k].name + ' — in the Daily planner on its days' : PJ.VRATS[k].name + ' — taken out of the planner');
  };
  CH['pj-vend'] = el => { const p = PD(); ED.store.checkpoint('Vrat until'); if (U.isKey(el.value)) p.vratEnd[el.dataset.k] = el.value; else delete p.vratEnd[el.dataset.k]; ED.store.commit(); ED.ui.toast(el.value ? (PJ.VRATS[el.dataset.k] || {}).name + ' — kept until ' + U.fmtShort(el.value) : 'No end date'); };
  CH['pj-fend'] = el => { const p = PD(); ED.store.checkpoint('Festivals until'); if (U.isKey(el.value)) p.festEnd = el.value; else delete p.festEnd; ED.store.commit(); };
  CH['pj-set'] = el => { PD()[el.dataset.k] = el.checked; ED.store.commit(); };
  CH['pj-ahead'] = el => { PD().ahead = +el.value || 30; ED.store.commit(); };
})();
