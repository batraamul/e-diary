/* E-Diary — Health, medicine and treatment.
   Left page:  today's medicines to tick (taken / skipped) with any day's list a click away, your medicines (dose, times,
               before or after food, what for, how many are left and when to refill), and treatments / conditions with
               their doctor, status and next follow-up.
   Right page: doctor's appointments (each can sit in the calendar with a reminder), health readings (blood pressure,
               pulse, blood sugar, weight, temperature, SpO₂) with charts, reports (lab tests, scans) and a medical card
               to show or print in an emergency.
   Medicines with "Remind me" ring at their times while the diary is open (like task alarms).
   These entries are kept in the diary like everything else (not in the encrypted password log).
   Data: ED.store.data.health = {
     card:   { blood, allergies, conditions, contact, doctor, insurance, notes },
     meds:   [{ id, name, dose, form, times: ['08:00', …], days: [0–6] | null, food, start, end, purpose, doctor, stock, perDose, remind, notes,
               stockDay, stockUsed0 }]   stock = the count you entered on stockDay; what is left = stock − doses ticked Taken since
               (stockUsed0 = what was already ticked that day when you entered it). Worked out from the ticks, so two devices add up.
     taken:  { 'YYYY-MM-DD': { '<medId>@HH:MM': 'taken' | 'skipped' } },
     treats: [{ id, name, kind, doctor, place, start, end, status, next, notes }],
     visits: [{ id, date, time, doctor, place, purpose, outcome, next, cost, eventId }],
     vitals: [{ id, date, time, sys, dia, pulse, fbs, ppbs, rbs, weight, temp, spo2, notes }],
     reports:[{ id, date, test, result, lab, link, notes }] } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const CH = ED.charts, FX = ED.fx;
  const D = () => ED.store.data;
  const H = () => D().health || (D().health = ED.sample.health());
  const A = (ED.actions = ED.actions || {});
  const st = () => ED.state.hl || (ED.state.hl = {});
  const HL = (ED.health = {});

  const FORMS = [['tablet', 'Tablet'], ['capsule', 'Capsule'], ['syrup', 'Syrup'], ['drops', 'Drops'], ['injection', 'Injection'], ['inhaler', 'Inhaler'], ['cream', 'Cream / ointment'], ['other', 'Other']];
  const FOOD = [['', '—'], ['before', 'Before food'], ['after', 'After food'], ['with', 'With food'], ['empty', 'Empty stomach'], ['bed', 'At bedtime']];
  const KINDS = [['condition', 'Condition'], ['treatment', 'Treatment / course'], ['therapy', 'Therapy (physio, etc.)'], ['surgery', 'Surgery / procedure'], ['vaccination', 'Vaccination'], ['checkup', 'Regular check-up']];
  const TSTATUS = [['ongoing', 'Ongoing'], ['paused', 'Paused'], ['completed', 'Completed']];

  /* ---------------- medicines ---------------- */
  /* every: 1 = daily, 2 = alternate days, n = once in n days — counted from the "From" date */
  const EVERY = [['1', 'Every day'], ['2', 'Alternate days (once in 2 days)']].concat([3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 21, 28, 30, 45, 60, 90].map(n => [String(n), 'Once in ' + n + ' days']));
  const every = m => Math.max(1, Math.round(+m.every || 1));
  const everyText = m => every(m) === 1 ? '' : every(m) === 2 ? 'alternate days' : 'once in ' + every(m) + ' days';
  const onCycle = (m, k) => { const n = every(m); if (n === 1) return true; const from = m.start || U.key(new Date(m.createdAt || Date.now())); const d = U.diffDays(from, k); return d >= 0 && d % n === 0; };
  const active = (m, k) => (!m.start || k >= m.start) && (!m.end || k <= m.end) && (!m.days || !m.days.length || m.days.indexOf(U.dow(k)) >= 0) && onCycle(m, k);
  HL.everyText = everyText;
  HL.doses = k => {
    const out = [];
    H().meds.forEach(m => { if (!active(m, k)) return; (m.times && m.times.length ? m.times : ['08:00']).forEach(t => out.push({ m, t, key: m.id + '@' + t, st: ((H().taken[k] || {})[m.id + '@' + t]) || '' })); });
    return out.sort((a, b) => a.t.localeCompare(b.t) || a.m.name.localeCompare(b.m.name));
  };
  /* units used per dose: empty = 1, 0 = not counted (a cream, drops…) */
  const perDose = m => m.perDose == null || m.perDose === '' ? 1 : Math.max(0, +m.perDose || 0);
  /* units ticked Taken for a medicine from a day on (that day included) */
  HL.used = (m, from) => {
    const t = H().taken, pre = m.id + '@', per = perDose(m); let n = 0;
    Object.keys(t).forEach(k => { if (from && k < from) return; Object.keys(t[k]).forEach(key => { if (key.indexOf(pre) === 0 && t[k][key] === 'taken') n++; }); });
    return n * per;
  };
  /* how many are left: the count you entered, less what you have ticked Taken since */
  HL.stockLeft = m => {
    if (m.stock == null || m.stock === '') return null;
    if (!m.stockDay) return +m.stock;
    return Math.max(0, +m.stock - (HL.used(m, m.stockDay) - (m.stockUsed0 || 0)));
  };
  /* how many days the stock lasts at the current schedule */
  HL.daysLeft = m => {
    const left = HL.stockLeft(m); if (left == null) return null;
    const per = perDose(m) * Math.max(1, (m.times || []).length) * (m.days && m.days.length ? m.days.length / 7 : 1) / every(m);
    return per > 0 ? Math.floor(left / per) : null;
  };
  HL.setDose = (k, key, v) => {
    const t = H().taken, day = t[k] || (t[k] = {});
    const was = day[key] || '';
    if (v) day[key] = v; else delete day[key];
    if (!Object.keys(day).length) delete t[k];
    return was;                          // the stock left is worked out from these ticks (HL.stockLeft)
  };
  const foodText = f => (FOOD.find(x => x[0] === f) || ['', ''])[1];
  const medLine = m => [m.dose, foodText(m.food) !== '—' ? foodText(m.food) : ''].filter(Boolean).join(' · ');

  /* ---------------- vitals ---------------- */
  const bpWord = (s, d) => !s || !d ? '' : s >= 180 || d >= 120 ? 'very high — see a doctor' : s >= 140 || d >= 90 ? 'high' : s >= 130 || d >= 80 ? 'raised' : s < 90 || d < 60 ? 'low' : 'normal';
  const last = key => { const l = H().vitals.filter(v => v[key] != null && v[key] !== '').sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))); return l[0] || null; };

  /* ---------------- left page ---------------- */
  const view = {
    id: 'health', label: 'Health',
    left() {
      const h = H(), today = U.today();
      const k = st().day || today;
      const doses = HL.doses(k), taken = doses.filter(x => x.st === 'taken').length;
      const nextVisit = h.visits.filter(v => v.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
      const bp = last('sys'), wt = last('weight');
      const low = h.meds.filter(m => (!m.end || m.end >= today) && HL.daysLeft(m) != null && HL.daysLeft(m) <= 5);
      const tiles = '<div class="tiles xp-tiles">' +
        FX.tile(k === today ? 'Today’s doses' : 'Doses ' + U.fmtDM(k), doses.length ? taken + '/' + doses.length : '—', doses.length ? (doses.length - taken ? (doses.length - taken) + ' still to take or skip' : 'all done') : 'no medicines that day') +
        FX.tile('Next appointment', nextVisit ? e(FX.when(nextVisit.date)) : '—', nextVisit ? e([nextVisit.doctor, FX.dm(nextVisit.date)].filter(Boolean).join(' · ')) : 'none planned') +
        FX.tile('Blood pressure', bp ? bp.sys + '/' + bp.dia : '—', bp ? e(bpWord(bp.sys, bp.dia)) + ' · ' + e(FX.dm(bp.date)) : 'add a reading', bp && /high/.test(bpWord(bp.sys, bp.dia)) ? 'warn' : '') +
        FX.tile('Refill soon', String(low.length), low.length ? e(low.map(m => m.name).join(', ')) : 'stock is fine', low.length ? 'warn' : '') + '</div>';
      const nav = '<div class="hl-daynav"><button type="button" class="icon-btn sm" data-act="hl-day" data-dir="-1" aria-label="Previous day">' + ED.icon('chevL') + '</button><b>' + (k === today ? 'Today' : e(U.fmtLong(k))) + '</b><button type="button" class="icon-btn sm" data-act="hl-day" data-dir="1" aria-label="Next day">' + ED.icon('chevR') + '</button>' +
        (k !== today ? '<button type="button" class="btn small ghost" data-act="hl-day" data-dir="0">Today</button>' : '') + '</div>';
      const doseList = doses.length ? '<ul class="hl-doses">' + doses.map(x => '<li class="hl-dose ' + (x.st || 'none') + '"><span class="num hl-t">' + e(FX.time(x.t)) + '</span><span class="hl-dm"><b>' + e(x.m.name) + '</b><span class="hint">' + e(medLine(x.m)) + '</span></span>' +
        '<span class="seg hl-seg" role="group" aria-label="' + e(x.m.name + ' at ' + x.t) + '"><button type="button" data-act="hl-dose" data-k="' + k + '" data-key="' + e(x.key) + '" data-v="taken" aria-pressed="' + (x.st === 'taken') + '">' + ED.icon('check') + 'Taken</button><button type="button" data-act="hl-dose" data-k="' + k + '" data-key="' + e(x.key) + '" data-v="skipped" aria-pressed="' + (x.st === 'skipped') + '">Skipped</button></span></li>').join('') + '</ul>'
        : '<p class="hint">' + (h.meds.length ? 'No medicines are due on this day.' : 'Add your medicines below to tick them off each day.') + '</p>';
      const meds = h.meds.slice().sort((a, b) => (a.end && a.end < today ? 1 : 0) - (b.end && b.end < today ? 1 : 0) || a.name.localeCompare(b.name)).map(m => {
        const over = m.end && m.end < today, dl = HL.daysLeft(m);
        return '<li class="' + (over ? 'dim' : '') + '"><button type="button" class="plain-btn xp-li hl-med" data-act="hl-med" data-id="' + e(m.id) + '"><span class="hl-mi" aria-hidden="true">💊</span><span class="grow"><b>' + e(m.name) + '</b> <span class="hint">' + e(medLine(m)) + '</span>' +
          '<span class="hint hl-sub">' + e((m.times || []).map(FX.time).join(', ')) + (m.days && m.days.length ? ' · ' + e(m.days.map(d => U.DAY3[d]).join(', ')) : '') + (everyText(m) ? ' · ' + e(everyText(m)) : '') + (m.purpose ? ' · for ' + e(m.purpose) : '') + (over ? ' · stopped ' + e(FX.dm(m.end)) : m.end ? ' · until ' + e(FX.dm(m.end)) : '') + (m.remind ? ' · 🔔' : '') + '</span></span>' +
          (dl != null && !over ? '<span class="hl-stock' + (dl <= 5 ? ' low' : '') + '"><b class="num">' + e(HL.stockLeft(m)) + '</b><span class="hint">' + (dl <= 0 ? 'none left' : '~' + U.plural(dl, 'day')) + '</span></span>' : '') + '</button></li>';
      }).join('');
      const treats = h.treats.slice().sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0) || String(a.next || '9999').localeCompare(String(b.next || '9999'))).map(t => '<li class="' + (t.status === 'completed' ? 'dim' : '') + '"><button type="button" class="plain-btn xp-li" data-act="hl-treat" data-id="' + e(t.id) + '"><span class="grow"><b>' + e(t.name) + '</b> <span class="hint">' + e((KINDS.find(x => x[0] === t.kind) || ['', ''])[1]) + '</span>' +
        '<span class="hint hl-sub">' + e([t.doctor, t.place, t.start ? 'since ' + FX.dm(t.start) : ''].filter(Boolean).join(' · ')) + '</span></span><span class="xp-r"><span class="xp-stage">' + e((TSTATUS.find(x => x[0] === t.status) || TSTATUS[0])[1]) + '</span>' + (t.next && t.status !== 'completed' ? '<span class="hint num' + (t.next < today ? ' fin-bad' : '') + '">follow-up ' + e(FX.when(t.next)) + '</span>' : '') + '</span></button></li>').join('');
      const body = '<p class="hint hl-priv">' + ED.icon('lock') + ' Kept in your diary like your other entries — not in the encrypted password log. This page helps you keep track; it is not medical advice.</p>' + tiles +
        '<h3 class="gh">Medicines to take</h3>' + nav + doseList +
        '<h3 class="gh fin-gap">My medicines <span class="hint num">· ' + h.meds.filter(m => !m.end || m.end >= today).length + ' current</span></h3>' + (meds ? '<ul class="xp-list">' + meds + '</ul>' : '') +
        '<div class="row-btns"><button type="button" class="btn small primary" data-act="hl-med">' + ED.icon('plus') + 'Add a medicine</button></div>' +
        '<h3 class="gh fin-gap">Treatments &amp; conditions</h3>' + (treats ? '<ul class="xp-list">' + treats + '</ul>' : '<p class="hint">Conditions being treated, courses of treatment, physiotherapy, surgery, vaccinations — with the doctor, status and next follow-up.</p>') +
        '<div class="row-btns"><button type="button" class="btn small" data-act="hl-treat">' + ED.icon('plus') + 'Add a treatment or condition</button></div>';
      return FX.page('hl', 'Health, medicine &amp; treatment', '', body, 'hl-left');
    },

    right() {
      const tab = st().tab || 'visits';
      const seg = FX.seg('hl-tab', tab, [['visits', 'Appointments'], ['vitals', 'Readings'], ['reports', 'Reports'], ['card', 'Medical card']]);
      const body = tab === 'vitals' ? vitals() : tab === 'reports' ? reports() : tab === 'card' ? card() : visits();
      return '<div class="xp hl-r"><div class="pg-head"><h2 class="pg-title">' + ({ visits: 'Doctor’s appointments', vitals: 'Health readings', reports: 'Reports', card: 'Medical card' })[tab] + '</h2>' + seg + '</div><div class="st-scroll scroll" data-keep-scroll="hl-r-' + tab + '">' + body + '</div></div>';
    },
    mount(L, R) { CH.bind(R); },
  };

  function visits() {
    const h = H(), today = U.today();
    const up = h.visits.filter(v => v.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const past = h.visits.filter(v => v.date < today).sort((a, b) => b.date.localeCompare(a.date));
    const row = v => '<li><button type="button" class="plain-btn xp-card-b hl-visit" data-act="hl-visit" data-id="' + e(v.id) + '"><span class="xp-date"><b>' + (+v.date.slice(8)) + '</b><span>' + U.MON[+v.date.slice(5, 7) - 1] + '</span></span>' +
      '<span class="xp-m"><b>' + e(v.doctor || 'Appointment') + '</b><span class="hint">' + e([v.time ? FX.time(v.time) : '', v.place, v.purpose].filter(Boolean).join(' · ')) + '</span>' + (v.outcome ? '<span class="hint hl-out">' + e(v.outcome.slice(0, 140)) + '</span>' : '') + '</span>' +
      '<span class="xp-r">' + (v.date >= today ? '<span class="hint num">' + e(FX.when(v.date)) + '</span>' : '') + (v.eventId ? '<span class="hint">' + ED.icon('calendar') + ' in calendar</span>' : '') + (v.next ? '<span class="hint">next ' + e(FX.dm(v.next)) + '</span>' : '') + '</span></button></li>';
    return '<div class="row-btns"><button type="button" class="btn small primary" data-act="hl-visit">' + ED.icon('plus') + 'Add an appointment</button></div>' +
      '<h3 class="gh">Coming up</h3>' + (up.length ? '<ul class="xp-list hl-visits">' + up.map(row).join('') + '</ul>' : '<p class="hint">No appointments planned.</p>') +
      '<h3 class="gh fin-gap">Earlier visits</h3>' + (past.length ? '<ul class="xp-list hl-visits">' + past.map(row).join('') + '</ul>' : '<p class="hint">After a visit, note what the doctor said, tests ordered and the next date.</p>');
  }

  function vitals() {
    const l = H().vitals.slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const lab = x => U.fmtDM(x.date) + (x.time ? ' ' + x.time : '');
    const chart = (title, keys, names, colors, unit, sub) => {
      const pts = l.filter(x => keys.some(k => x[k] != null && x[k] !== ''));
      if (pts.length < 2) return '';
      const series = keys.map((k, i) => ({ name: names[i], color: colors[i], points: pts.map(x => x[k] == null || x[k] === '' ? null : +x[k]) })).filter(s => s.points.some(v => v != null));
      return CH.lines({
        title, labels: pts.map(lab), long: pts.map(x => U.fmtLong(x.date) + (x.time ? ', ' + FX.time(x.time) : '')), h: 180, left: 40, maxLabels: 7,
        series, fmt: v => String(Math.round(v)), tipFmt: v => (Math.round(v * 10) / 10) + ' ' + unit,
        legend: series.length > 1 ? CH.legend(series.map(s => ({ kind: 'line', color: s.color, label: s.name }))) : '',
        sub, table: CH.table(['Date'].concat(names), pts.map(x => [lab(x)].concat(keys.map(k => x[k] == null || x[k] === '' ? '' : String(x[k]))))),
      });
    };
    const charts = chart('Blood pressure', ['sys', 'dia'], ['Upper (systolic)', 'Lower (diastolic)'], ['var(--s1)', 'var(--s3)'], 'mmHg', 'mmHg. Usually aimed below 130/80 for adults — your doctor sets your target.') +
      chart('Blood sugar', ['fbs', 'ppbs', 'rbs'], ['Fasting', 'After food (2 h)', 'Random'], ['var(--s1)', 'var(--s2)', 'var(--s4)'], 'mg/dL', 'mg/dL. Fasting 70–99 is the usual normal range.') +
      chart('Weight', ['weight'], ['Weight'], ['var(--s1)'], 'kg', '') + chart('Pulse', ['pulse'], ['Pulse'], ['var(--s2)'], 'beats a minute', '') +
      chart('Oxygen (SpO₂)', ['spo2'], ['SpO₂'], ['var(--s3)'], '%', '');
    const rows = l.slice().reverse().slice(0, 60).map(x => '<tr><td><button type="button" class="plain-btn" data-act="hl-vital" data-id="' + e(x.id) + '">' + e(lab(x)) + '</button></td><td class="num">' + (x.sys ? e(x.sys + '/' + x.dia) : '') + '</td><td class="num">' + e(x.pulse || '') + '</td><td class="num">' + e([x.fbs ? 'F ' + x.fbs : '', x.ppbs ? 'PP ' + x.ppbs : '', x.rbs ? 'R ' + x.rbs : ''].filter(Boolean).join(' · ')) + '</td><td class="num">' + e(x.weight || '') + '</td><td class="num">' + e(x.temp || '') + '</td><td class="num">' + e(x.spo2 || '') + '</td></tr>').join('');
    return '<div class="row-btns"><button type="button" class="btn small primary" data-act="hl-vital">' + ED.icon('plus') + 'Add a reading</button></div>' +
      (l.length ? charts + '<h3 class="gh">All readings</h3><div class="fp-tablew"><table class="st-table hl-table"><thead><tr><th>When</th><th class="num">BP</th><th class="num">Pulse</th><th class="num">Sugar (mg/dL)</th><th class="num">Weight</th><th class="num">Temp</th><th class="num">SpO₂</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="hint">Note blood pressure, pulse, blood sugar, weight, temperature or oxygen whenever you measure them — fill in only what you have. Charts appear after two readings.</p>');
  }

  function reports() {
    const l = H().reports.slice().sort((a, b) => b.date.localeCompare(a.date));
    return '<div class="row-btns"><button type="button" class="btn small primary" data-act="hl-report">' + ED.icon('plus') + 'Add a report</button></div>' +
      (l.length ? '<table class="st-table"><thead><tr><th>Date</th><th>Test</th><th>Result</th><th>Link</th><th></th></tr></thead><tbody>' + l.map(r => '<tr><td class="num">' + e(FX.dm(r.date)) + '</td><td><b>' + e(r.test) + '</b>' + (r.lab ? '<div class="hint">' + e(r.lab) + '</div>' : '') + '</td><td>' + e(r.result || '') + (r.notes ? '<div class="hint">' + e(r.notes) + '</div>' : '') + '</td><td>' + FX.link(r.link) + '</td><td><button type="button" class="icon-btn sm" data-act="hl-report" data-id="' + e(r.id) + '" aria-label="Edit ' + e(r.test) + '" title="Edit">' + ED.icon('pencil') + '</button></td></tr>').join('') + '</tbody></table>'
        : '<p class="hint">Blood tests, scans, ECGs, prescriptions — the date, the main result, and a link to the file (for example in Google Drive or DigiLocker).</p>');
  }

  function card() {
    const c = H().card, today = U.today();
    const meds = H().meds.filter(m => !m.end || m.end >= today);
    const f = (k, label) => '<div class="hl-cf"><span class="hint">' + e(label) + '</span><b>' + (c[k] ? e(c[k]).replace(/\n/g, '<br>') : '<span class="hint">—</span>') + '</b></div>';
    return '<div class="hl-card"><div class="hl-card-h">' + ED.icon('shield') + '<b>Medical card</b><span class="grow"></span><span class="hint">' + e(D().settings.ownerName || '') + '</span></div>' +
      f('blood', 'Blood group') + f('allergies', 'Allergies') + f('conditions', 'Long-term conditions') +
      '<div class="hl-cf"><span class="hint">Current medicines</span><b>' + (meds.length ? meds.map(m => e(m.name + (m.dose ? ' ' + m.dose : '') + ((m.times || []).length ? ' × ' + m.times.length + '/day' : ''))).join('<br>') : '<span class="hint">—</span>') + '</b></div>' +
      f('contact', 'Emergency contact') + f('doctor', 'Family doctor') + f('insurance', 'Health insurance / CGHS no.') + f('notes', 'Other notes') + '</div>' +
      '<div class="row-btns"><button type="button" class="btn small primary" data-act="hl-card">' + ED.icon('pencil') + 'Edit the card</button><button type="button" class="btn small" data-act="hl-card-copy">' + ED.icon('copy') + 'Copy as text</button></div>';
  }

  /* ---------------- editors ---------------- */
  HL.editMed = id => {
    const h = H(); const x = id ? h.meds.find(m => m.id === id) : null;
    FX.form({
      title: x ? 'Medicine' : 'Add a medicine', wide: true,
      data: x ? Object.assign({}, x, { stock: HL.stockLeft(x), every: String(x.every || 1) }) : { name: '', dose: '', form: 'tablet', times: ['08:00'], days: null, every: '1', food: 'after', start: U.today(), end: '', purpose: '', doctor: '', stock: null, perDose: 1, remind: false, notes: '' },
      fields: [
        { k: 'name', label: 'Medicine', req: true, ph: 'Name and strength, e.g. Metformin 500 mg' },
        { k: 'dose', label: 'Dose', ph: '1 tablet, 5 ml, 2 puffs…' },
        { k: 'form', label: 'Form', type: 'select', options: FORMS },
        { k: 'times', label: 'Times a day', type: 'times' },
        { k: 'days', label: 'Days', type: 'days' },
        { k: 'every', label: 'How often', type: 'select', options: EVERY, hint: 'Alternate days or once in a few days are counted from the “From” date (that day is a dose day).' },
        { k: 'food', label: 'Food', type: 'select', options: FOOD },
        { k: 'start', label: 'From', type: 'date' },
        { k: 'end', label: 'Until', type: 'date', hint: 'Leave empty for ongoing medicines.' },
        { k: 'purpose', label: 'What it is for', ph: 'optional' },
        { k: 'doctor', label: 'Prescribed by', ph: 'optional' },
        { k: 'stock', label: 'How many you have', type: 'number', min: 0, hint: 'Counts down as you tick Taken; warns when about 5 days are left.' },
        { k: 'perDose', label: 'Used per dose', type: 'number', min: 0, step: 0.5 },
        { k: 'remind', label: 'Remind me at these times (while the diary is open)', type: 'check' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, ph: 'Side effects to watch, how to take it…' },
      ],
      check: v => !v.times.length ? 'Add at least one time' : v.end && v.start && v.end < v.start ? '“Until” is before “From”' : '',
      del: x ? async () => {
        const ok = await ED.ui.confirm({ title: 'Delete medicine', message: 'Delete “' + x.name + '” and its ticks? To keep its history, set an “Until” date instead.', ok: 'Delete', danger: true });
        if (!ok) return false;
        ED.store.checkpoint('Delete medicine'); h.meds = h.meds.filter(m => m.id !== x.id);
        Object.keys(h.taken).forEach(k => { Object.keys(h.taken[k]).forEach(key => { if (key.split('@')[0] === x.id) delete h.taken[k][key]; }); if (!Object.keys(h.taken[k]).length) delete h.taken[k]; });
        ED.store.commit(); ED.ui.undoToast('Medicine deleted');
      } : null,
      save(v, api) {
        if (v.remind && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (err) { /* optional */ } }
        ED.store.checkpoint(x ? 'Medicine' : 'New medicine');
        if (v.perDose == null || v.perDose === '') v.perDose = 1;
        v.every = Math.max(1, Math.round(+v.every || 1));
        if (v.every > 1 && !v.start) v.start = U.today();
        const id = x ? x.id : U.uid('md');
        // the count shown is what is left today; remember it with today's ticks so later ticks count down from here
        if (v.stock == null || v.stock === '') { v.stock = null; v.stockDay = null; v.stockUsed0 = 0; }
        else { const today = U.today(); v.stockDay = today; v.stockUsed0 = HL.used(Object.assign({}, x || {}, v, { id }), today); }
        if (x) Object.assign(x, v, { updatedAt: Date.now() }); else h.meds.push(Object.assign({ id, createdAt: Date.now() }, v));
        ED.store.commit(); api.close(); ED.ui.toast(x ? 'Saved' : 'Medicine added');
      },
    });
  };

  HL.editTreat = id => {
    const h = H(); const x = id ? h.treats.find(t => t.id === id) : null;
    FX.form({
      title: x ? 'Treatment or condition' : 'Add a treatment or condition',
      data: x || { name: '', kind: 'treatment', doctor: '', place: '', start: U.today(), end: '', status: 'ongoing', next: '', notes: '' },
      fields: [
        { k: 'name', label: 'Name', req: true, ph: 'e.g. Knee physiotherapy, Thyroid, Dental root canal' },
        { k: 'kind', label: 'Kind', type: 'select', options: KINDS },
        { k: 'doctor', label: 'Doctor' }, { k: 'place', label: 'Hospital / clinic' },
        { k: 'start', label: 'Started', type: 'date' }, { k: 'end', label: 'Ended', type: 'date' },
        { k: 'status', label: 'Status', type: 'select', options: TSTATUS },
        { k: 'next', label: 'Next follow-up', type: 'date' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 4, ph: 'Diagnosis in the doctor’s words, advice, sessions left…' },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete'); h.treats = h.treats.filter(t => t.id !== x.id); ED.store.commit(); ED.ui.undoToast('Deleted'); } : null,
      save(v, api) { ED.store.checkpoint('Treatment'); if (x) Object.assign(x, v, { updatedAt: Date.now() }); else h.treats.push(Object.assign({ id: U.uid('tr') }, v)); ED.store.commit(); api.close(); },
    });
  };

  HL.editVisit = id => {
    const h = H(); const x = id ? h.visits.find(t => t.id === id) : null;
    FX.form({
      title: x ? 'Appointment' : 'Add an appointment', wide: true,
      data: x ? Object.assign({ cal: !!x.eventId }, x) : { date: U.today(), time: '10:00', doctor: '', place: '', purpose: '', outcome: '', next: '', cost: null, cal: true },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'time', label: 'Time', type: 'time' },
        { k: 'doctor', label: 'Doctor', req: true, ph: 'Dr …, speciality' }, { k: 'place', label: 'Hospital / clinic' },
        { k: 'purpose', label: 'Purpose', ph: 'Check-up, follow-up, test results…' },
        { k: 'outcome', label: 'What the doctor said', type: 'textarea', rows: 4, ph: 'Diagnosis, medicines changed, tests ordered, advice' },
        { k: 'next', label: 'Next visit', type: 'date' },
        { k: 'cost', label: 'Fee paid', type: 'number', min: 0 },
        { k: 'cal', label: 'Show it in my calendar, with a reminder an hour before', type: 'check' },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete'); FX.dropEvent(x); h.visits = h.visits.filter(t => t.id !== x.id); ED.store.commit(); ED.ui.undoToast('Deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint('Appointment');
        const it = x || { id: U.uid('vs') };
        const cal = v.cal; delete v.cal;
        Object.assign(it, v, { updatedAt: Date.now() });
        FX.linkEvent(it, { on: cal, title: 'Doctor: ' + it.doctor, date: it.date, time: it.time, mins: 45, location: it.place, notes: it.purpose, reminder: 60, color: '#2e7d32' });
        if (!x) h.visits.push(it);
        ED.store.commit(); api.close(); ED.ui.toast('Appointment saved' + (it.eventId ? ' — it is in your calendar too' : ''));
      },
    });
  };

  HL.editVital = id => {
    const h = H(); const x = id ? h.vitals.find(t => t.id === id) : null;
    const n = new Date();
    FX.form({
      title: x ? 'Reading' : 'Add a reading', intro: 'Fill in only what you measured.',
      data: x || { date: U.today(), time: U.pad(n.getHours()) + ':' + U.pad(n.getMinutes()) },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'time', label: 'Time', type: 'time' },
        { k: 'sys', label: 'BP upper (mmHg)', type: 'number', min: 50, max: 260 }, { k: 'dia', label: 'BP lower (mmHg)', type: 'number', min: 30, max: 160 },
        { k: 'pulse', label: 'Pulse (per minute)', type: 'number', min: 20, max: 220 },
        { k: 'fbs', label: 'Sugar fasting (mg/dL)', type: 'number', min: 20, max: 600 }, { k: 'ppbs', label: 'Sugar after food (mg/dL)', type: 'number', min: 20, max: 600 }, { k: 'rbs', label: 'Sugar random (mg/dL)', type: 'number', min: 20, max: 600 },
        { k: 'weight', label: 'Weight (kg)', type: 'number', min: 1, max: 350, step: 0.1 }, { k: 'temp', label: 'Temperature (°F)', type: 'number', min: 90, max: 110, step: 0.1 },
        { k: 'spo2', label: 'Oxygen SpO₂ (%)', type: 'number', min: 50, max: 100 },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      check: v => (v.sys == null) !== (v.dia == null) ? 'Give both blood-pressure numbers (upper and lower)' : ['sys', 'pulse', 'fbs', 'ppbs', 'rbs', 'weight', 'temp', 'spo2'].every(k => v[k] == null) ? 'Enter at least one reading' : '',
      del: x ? async () => { ED.store.checkpoint('Delete'); h.vitals = h.vitals.filter(t => t.id !== x.id); ED.store.commit(); ED.ui.undoToast('Deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint('Reading');
        if (x) Object.assign(x, v); else h.vitals.push(Object.assign({ id: U.uid('vt') }, v));
        ED.store.commit(); api.close();
        const w = bpWord(v.sys, v.dia);
        if (/very high/.test(w)) ED.ui.toast('Blood pressure ' + v.sys + '/' + v.dia + ' is very high. If you have chest pain, breathlessness, weakness or a severe headache, get medical help now.', { kind: 'err', timeout: 15000 });
      },
    });
  };

  HL.editReport = id => {
    const h = H(); const x = id ? h.reports.find(t => t.id === id) : null;
    FX.form({
      title: x ? 'Report' : 'Add a report', data: x || { date: U.today(), test: '', result: '', lab: '', link: '', notes: '' },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'test', label: 'Test', req: true, ph: 'HbA1c, Lipid profile, X-ray chest…' },
        { k: 'result', label: 'Main result', ph: 'e.g. 6.1 %, normal' }, { k: 'lab', label: 'Lab / hospital' },
        { k: 'link', label: 'Link to the file', ph: 'Google Drive, DigiLocker, lab portal…' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete'); h.reports = h.reports.filter(t => t.id !== x.id); ED.store.commit(); ED.ui.undoToast('Deleted'); } : null,
      save(v, api) { ED.store.checkpoint('Report'); if (x) Object.assign(x, v); else h.reports.push(Object.assign({ id: U.uid('rp') }, v)); ED.store.commit(); api.close(); },
    });
  };

  HL.editCard = () => {
    const c = H().card;
    FX.form({
      title: 'Medical card', data: c,
      fields: [
        { k: 'blood', label: 'Blood group', type: 'select', options: [['', '—']].concat(['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map(x => [x, x])) },
        { k: 'allergies', label: 'Allergies', type: 'textarea', rows: 2, ph: 'Medicines, foods… or “None known”' },
        { k: 'conditions', label: 'Long-term conditions', type: 'textarea', rows: 2 },
        { k: 'contact', label: 'Emergency contact', ph: 'Name, relation, phone' },
        { k: 'doctor', label: 'Family doctor', ph: 'Name, phone' },
        { k: 'insurance', label: 'Health insurance / CGHS no.' },
        { k: 'notes', label: 'Other notes', type: 'textarea', rows: 2 },
      ],
      save(v, api) { ED.store.checkpoint('Medical card'); Object.assign(c, v); ED.store.commit(); api.close(); },
    });
  };
  HL.cardText = () => {
    const c = H().card, today = U.today();
    const meds = H().meds.filter(m => !m.end || m.end >= today).map(m => m.name + (m.dose ? ' ' + m.dose : '')).join('; ');
    return ['MEDICAL CARD' + (D().settings.ownerName ? ' — ' + D().settings.ownerName : ''), 'Blood group: ' + (c.blood || '—'), 'Allergies: ' + (c.allergies || '—'), 'Long-term conditions: ' + (c.conditions || '—'), 'Current medicines: ' + (meds || '—'), 'Emergency contact: ' + (c.contact || '—'), 'Family doctor: ' + (c.doctor || '—'), 'Insurance / CGHS: ' + (c.insurance || '—')].concat(c.notes ? ['Notes: ' + c.notes] : []).join('\n');
  };

  /* medicine reminders ring through the diary's reminder loop */
  HL.remind = ({ due, mark, fire }) => {
    const k = U.today();
    HL.doses(k).forEach(x => {
      if (!x.m.remind || x.st) return;
      const key = 'med:' + x.key + '@' + k;
      if (!due(U.toMin(x.t), key)) return;
      mark(key);
      fire('💊 ' + x.m.name, [x.m.dose, foodText(x.m.food) !== '—' ? foodText(x.m.food) : '', FX.time(x.t)].filter(Boolean).join(' · '), key, () => ED.go.tab('health'));
    });
  };

  ED.views = ED.views || {};
  ED.views.health = view;

  /* ---------------- actions ---------------- */
  A['hl-tab'] = el => { st().tab = el.dataset.k; ED.app.renderPage('right'); CH.bind(document.getElementById('pg-right')); };
  A['hl-day'] = el => { const s = st(); const d = +el.dataset.dir; s.day = d === 0 ? U.today() : U.addDays(s.day || U.today(), d); ED.app.renderPage('left'); };
  A['hl-dose'] = el => { const k = el.dataset.k, key = el.dataset.key, v = el.dataset.v; const cur = ((H().taken[k] || {})[key]) || ''; HL.setDose(k, key, cur === v ? '' : v); ED.store.commit(); };
  A['hl-med'] = el => HL.editMed(el.dataset.id || null);
  A['hl-treat'] = el => HL.editTreat(el.dataset.id || null);
  A['hl-visit'] = el => HL.editVisit(el.dataset.id || null);
  A['hl-vital'] = el => HL.editVital(el.dataset.id || null);
  A['hl-report'] = el => HL.editReport(el.dataset.id || null);
  A['hl-card'] = () => HL.editCard();
  A['hl-card-copy'] = async () => { const ok = await U.copy(HL.cardText()); ED.ui.toast(ok ? 'Copied — paste it into a message or a note' : 'Could not copy'); };
})();
