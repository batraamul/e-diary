/* E-Diary — defaults, starter diary and removable example entries */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util;
  const S = (ED.sample = {});

  S.settings = () => ({
    diaryTitle: 'My E-Diary',
    ownerName: '',
    theme: 'auto',          // auto | light | dark
    matrix: { days: 2, imp: 'AB', rep: false },   // Eisenhower Matrix: urgent = due within N days; important = A/B (or goal); show repeating tasks
    lockAfter: 15,          // minutes without use before a password-locked diary locks itself (0 = never)
    weekStart: 0,           // 0 = Sunday, 1 = Monday
    h12: true,
    carryForward: true,     // unfinished tasks from past days appear today
    carryDays: 30,          // ...if they are at most this many days old
    showCompleted: true,
    dayStart: 5,            // hour the timeline scrolls to
    activeFrom: 6,          // shaded "active" hours on the timeline
    activeTo: 22,
    defaultPrio: 'B',
    weather: { on: true, name: 'New Delhi', admin: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209, unit: 'C' },
    builtinQuotes: true,
    reminders: true,
    sound: true,
    cal: { monthly: 'week7', roles: 'week5', goals: 'month' },
    sampleBanner: true,
    cover: true,            // show the closed cover for a moment when the diary opens
    currency: 'INR',        // finance pages
    vaultLock: 5,           // minutes of inactivity before the password log locks
    gcal: { on: false, clientId: '', calendarId: 'primary', email: '', tasks: true, events: true, study: false, untimed: false, holidays: false, offer: true },
  });

  /* finance: starter categories (monthly budget is 0 until you set it) */
  S.financeCats = () => [
    ['fc-salary', 'Salary', 'income', '💼'], ['fc-otherin', 'Other income', 'income', '➕'], ['fc-interest', 'Interest & dividends', 'income', '🏦'],
    ['fc-home', 'Rent & housing', 'expense', '🏠'], ['fc-grocery', 'Groceries', 'expense', '🛒'], ['fc-utility', 'Electricity, water & gas', 'expense', '💡'],
    ['fc-phone', 'Phone & internet', 'expense', '📱'], ['fc-transport', 'Transport & fuel', 'expense', '🚗'], ['fc-health', 'Health & medicines', 'expense', '💊'],
    ['fc-edu', 'Education & books', 'expense', '📚'], ['fc-ins', 'Insurance premiums', 'expense', '🛡️'], ['fc-invest', 'Savings & investments', 'expense', '📈'],
    ['fc-emi', 'Loan EMI', 'expense', '🏧'], ['fc-shop', 'Shopping & clothes', 'expense', '🛍️'], ['fc-food', 'Eating out & leisure', 'expense', '🍽️'],
    ['fc-travel', 'Travel', 'expense', '✈️'], ['fc-gifts', 'Gifts & donations', 'expense', '🎁'], ['fc-other', 'Other expenses', 'expense', '🧾'],
  ].map((c, i) => Object.assign({ id: c[0], name: c[1], kind: c[2], icon: c[3], budget: 0, order: i }, c[0] === 'fc-invest' ? { saving: true } : {}));
  /* the goal-based financial plan (js/finplan.js): today's numbers, goals in today's money, other money in/out */
  S.finPlan = () => ({ age: null, retireAge: 60, years: 25, income: 0, raise: 7, otherIncome: 0, pension: 0, expenses: 0, inflation: 6, retireSpend: 80,
    emergencyMonths: 6, savings: 0, ret: 9, retFrom: 'own', retTax: 12.5, stepUp: 0, taxMode: 'new', flatRate: 12, deductions: 150000, indexSlabs: false, goals: [], events: [], wealth: S.wealth() });
  /* the wealth plan on top of it (js/wealth.js): chosen investment approach, a second one to compare, your own mix,
     your own return/risk figures per asset class (null = the defaults), amount invested (null = savings), discount rate for
     "today's value", and the SIP used in the illustration (null = what the plan saves a month) with its yearly step-up */
  S.wealth = () => ({ approach: 'balanced', compare: 'conservative', custom: null, assets: null, amount: null, discount: 9, sip: null, sipStep: 10 });
  S.finance = () => ({ cats: S.financeCats(), accounts: [], goals: [], holdings: [], bills: [], records: [], plan: S.finPlan() });

  S.empty = () => ({
    meta: { schema: 1, app: 'E-Diary', createdAt: Date.now(), updatedAt: Date.now(), sampleDayNotes: [], sampleMission: false },
    settings: S.settings(),
    categories: [],
    roles: [],
    goals: [],
    values: [],
    tasks: [],
    events: [],
    dayNotes: {},
    mission: { html: '' },
    notebooks: [],
    notes: [],
    quotes: [],
    study: { plan: null, sessions: [] },   // study planner (imported from Excel or made here)
    finance: S.finance(),                  // budget, records, bills, goals, accounts, policies
    sites: [],                             // important websites (not secret)
    vault: null,                           // password log, encrypted with your master password
    gcal: { map: {} },                     // which diary items are in Google Calendar
    habits: { list: [], log: {} },         // habit tracker: habits and what was marked each day
    interview: S.interview(),              // interview preparation
    health: S.health(),                    // medicines, treatments, appointments, readings
    meetings: S.meetings(),
    exam: S.exam(),                        // exam preparation: exams, syllabus topics, mock tests (js/exam.js)
    maps: { list: [] },
    bucket: { list: [] },                  // bucket list (js/bucket.js)
    wardrobe: { items: [], wish: [], plan: {}, budget: 0 },   // Notes & Life → Wardrobe (js/wardrobe.js)
    siteCats: null,                        // website categories (made on first use, js/vault.js)
    jobs: S.jobs(),                        // Govt jobs at Level 13A/14 — fetched list + your status (js/jobs.js)
    lists: { trips: [], groc: [], meals: {} },   // Career Graph → Travel & Tour, Grocery (js/lists.js)                // Events & Meetings: Google calendars shown, meeting plans
  });
  S.interview = () => ({ list: [], qs: [], cats: [], docs: [], mocks: [], log: {} });
  S.health = () => ({ card: { blood: '', allergies: '', conditions: '', contact: '', doctor: '', insurance: '', notes: '' }, meds: [], taken: {}, treats: [], visits: [], vitals: [], reports: [] });
  S.meetings = () => ({ cals: ['primary'], calInfo: {}, notes: {} });
  S.exam = () => ({ list: [], topics: [], mocks: [], log: {} });
  S.jobs = () => ({ items: [], sites: [], fetchedAt: null, seeded: 0 });

  S.categories = () => [
    { id: 'cat-work', name: 'Work', color: '#c62828', icon: '💼' },
    { id: 'cat-home', name: 'Home', color: '#1f6fe0', icon: '🏠' },
    { id: 'cat-health', name: 'Health', color: '#2e7d32', icon: '💪' },
    { id: 'cat-learning', name: 'Learning', color: '#7b3fb8', icon: '📚' },
    { id: 'cat-family', name: 'Family', color: '#c2185b', icon: '👪' },
    { id: 'cat-finance', name: 'Finance', color: '#8a6d00', icon: '💰' },
    { id: 'cat-personal', name: 'Personal', color: '#d9542b', icon: '🌱' },
    { id: 'cat-errands', name: 'Errands', color: '#00838f', icon: '🛒' },
  ];

  S.roles = () => [
    { id: 'role-frog', name: 'FROG: To be tamed first', icon: '🐸', color: '#b3261e', order: 0,
      desc: 'The most important and usually the hardest task of the day. Do it first, before anything else.' },
    { id: 'role-small', name: 'Smaller Frog: Should be done', icon: '🐸', color: '#cf4a22', order: 1,
      desc: 'Important tasks that come right after the big frog.' },
    { id: 'role-do', name: 'Do / Delegate or Schedule', icon: '📌', color: '#3c4a54', order: 2,
      desc: 'Routine work: do it quickly, hand it to someone else, or give it a time slot.' },
    { id: 'role-health', name: 'Health & Fitness', icon: '💪', color: '#2e7d32', order: 3,
      desc: 'Exercise, sleep, food and check-ups.' },
    { id: 'role-family', name: 'Family & Home', icon: '🏡', color: '#1f6fe0', order: 4,
      desc: 'Time with family and running the house.' },
  ];

  S.notebooks = () => [
    { id: 'nb-career', name: 'Career', icon: '📚' },
    { id: 'nb-ideas', name: 'Ideas', icon: '💡' },
  ];

  S.starter = () => {
    const d = S.empty();
    d.categories = S.categories();
    d.roles = S.roles();
    d.notebooks = S.notebooks();
    return d;
  };

  /* ---------------- example entries (all flagged sample:true) ---------------- */
  S.addDemo = d => {
    const T = U.today();
    const at = n => U.addDays(T, n);
    const now = Date.now();
    const mk = (o) => Object.assign({
      id: U.uid('t'), title: '', prio: 'B', num: 1, status: 'open', date: T, time: null, dur: 30,
      roleId: null, categoryId: null, goalId: null, parentId: null, eventId: null, showSub: 'none',
      notes: '', checklist: [], repeat: null, occ: {}, exdates: [], alarm: false, alarmBefore: 0,
      delegatedTo: '', startDate: null, createdAt: now, updatedAt: now, sample: true,
    }, o);

    // values
    d.values.push(
      { id: 'val-resp', title: 'Responsibility', color: '#9b1d16', order: 0, sample: true,
        desc: 'Own my work and my word. Serve the people who depend on me with competence and integrity.' },
      { id: 'val-learn', title: 'Learning', color: '#e0603c', order: 1, sample: true,
        desc: 'Stay curious. Learn something new every day and share what I learn.' },
      { id: 'val-family', title: 'Family secure and happy', color: '#1f6fe0', order: 2, sample: true,
        desc: 'Be present for my family, keep them safe and help each of them grow.' },
      { id: 'val-health', title: 'Health', color: '#2e7d32', order: 3, sample: true,
        desc: 'A strong body and a calm mind: move every day, sleep well, eat simply.' }
    );

    // goals (two already achieved)
    d.goals.push(
      { id: 'g-papers', title: 'Publish two research papers this year', desc: 'One journal paper and one conference paper.', valueId: 'val-resp', roleId: 'role-frog', color: '#1f6fe0', startDate: at(-120), due: at(95), done: false, doneAt: null, createdAt: now, sample: true },
      { id: 'g-ml', title: 'Complete the Machine Learning course', desc: 'All lectures and graded assignments.', valueId: 'val-learn', roleId: 'role-small', color: '#7b3fb8', startDate: at(-30), due: at(40), done: false, doneAt: null, createdAt: now, sample: true },
      { id: 'g-run', title: 'Run a 10 km race', desc: 'Build up from 5 km, three runs a week.', valueId: 'val-health', roleId: 'role-health', color: '#2e7d32', startDate: at(-25), due: at(70), done: false, doneAt: null, createdAt: now, sample: true },
      { id: 'g-trip', title: 'Plan a family holiday', desc: 'Dates, tickets and a simple itinerary.', valueId: 'val-family', roleId: 'role-family', color: '#c2185b', startDate: at(-6), due: at(30), done: false, doneAt: null, createdAt: now, sample: true },
      { id: 'g-interview', title: 'Clear the promotion interview', desc: '', valueId: 'val-resp', roleId: 'role-frog', color: '#1f6fe0', startDate: at(-80), due: at(-20), done: true, doneAt: at(-21), createdAt: now, sample: true },
      { id: 'g-thesis', title: 'Submit the thesis draft to the committee', desc: '', valueId: 'val-learn', roleId: 'role-frog', color: '#1f6fe0', startDate: at(-200), due: at(-45), done: true, doneAt: at(-50), createdAt: now, sample: true }
    );

    const doneOcc = (days) => { const o = {}; days.forEach(n => { o[at(n)] = { st: 'done', at: now }; }); return o; };

    d.tasks.push(
      // repeating
      mk({ title: 'Diary writing', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-personal', date: at(-13), repeat: { freq: 'daily', interval: 1 },
        occ: doneOcc([-13, -12, -11, -10, -9, -7, -6, -5, -4, -2, -1]), notes: 'Ten minutes, before checking the phone.' }),
      mk({ title: 'Music practice — 30 minutes', prio: 'C', num: 1, roleId: 'role-do', categoryId: 'cat-personal', date: at(-13), repeat: { freq: 'daily', interval: 1 },
        occ: doneOcc([-13, -11, -10, -8, -6, -5, -3, -1]) }),
      mk({ title: 'Cycling — 30 minutes', prio: 'C', num: 2, roleId: 'role-health', categoryId: 'cat-health', date: at(-13), time: '06:30', dur: 30, repeat: { freq: 'daily', interval: 1 },
        occ: doneOcc([-13, -12, -10, -9, -8, -6, -4, -3, -2, -1]) }),
      mk({ title: 'Read the newspaper', prio: 'C', num: 3, roleId: 'role-do', categoryId: 'cat-personal', date: at(-13), repeat: { freq: 'daily', interval: 1 },
        occ: doneOcc([-13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1]) }),
      mk({ title: 'Long run', prio: 'B', num: 5, roleId: 'role-health', categoryId: 'cat-health', goalId: 'g-run', date: at(-21), time: '06:00', dur: 60,
        repeat: { freq: 'weekly', interval: 1, days: [0, 3] }, occ: doneOcc([-21, -18, -14, -11, -7, -4]) }),

      // today — the frog
      mk({ title: 'Draft the results section of paper 1', prio: 'A', num: 2, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', time: '10:00', dur: 90,
        checklist: [{ id: U.uid('c'), text: 'Table 2 with final numbers', done: true }, { id: U.uid('c'), text: 'Figure 4 caption', done: false }, { id: U.uid('c'), text: 'Discussion paragraph', done: false }] }),
      mk({ title: 'Reply to reviewer comments', prio: 'A', num: 3, status: 'progress', roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers' }),
      // today — smaller frog
      mk({ title: 'Machine Learning course — lecture 6', prio: 'A', num: 1, roleId: 'role-small', categoryId: 'cat-learning', goalId: 'g-ml' }),
      mk({ title: 'Make the children’s study timetable', prio: 'B', num: 1, roleId: 'role-small', categoryId: 'cat-family' }),
      mk({ title: 'Submit the conference registration form', prio: 'B', num: 2, roleId: 'role-small', categoryId: 'cat-work', goalId: 'g-papers', time: '17:00', alarm: true, alarmBefore: 15 }),
      // today — do / delegate
      mk({ title: 'Pay the phone bill', prio: 'C', num: 4, roleId: 'role-do', categoryId: 'cat-finance', time: '18:00' }),
      mk({ title: 'Order printer ink', prio: 'C', num: 5, roleId: 'role-do', categoryId: 'cat-errands', status: 'delegated', delegatedTo: 'Ravi' }),
      mk({ title: 'Book the gas cylinder', prio: 'B', num: 4, roleId: 'role-family', categoryId: 'cat-home', status: 'done' }),
      // carried forward from two days ago
      mk({ title: 'Renew vehicle insurance', prio: 'B', num: 3, roleId: 'role-do', categoryId: 'cat-finance', date: at(-2) }),

      // coming days
      mk({ title: 'Prepare slides for the Monday review', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', date: at(1) }),
      mk({ title: 'Water the plants', prio: 'C', num: 4, roleId: 'role-family', categoryId: 'cat-home', date: at(1) }),
      mk({ title: 'Finish ML assignment 3', prio: 'A', num: 1, roleId: 'role-small', categoryId: 'cat-learning', goalId: 'g-ml', date: at(3) }),
      mk({ title: 'Shortlist holiday destinations', prio: 'B', num: 1, roleId: 'role-family', categoryId: 'cat-family', goalId: 'g-trip', date: at(2) }),
      mk({ title: 'Book train tickets', prio: 'B', num: 1, roleId: 'role-family', categoryId: 'cat-family', goalId: 'g-trip', date: at(8) }),

      // done in the past (feeds the goals and the career graph)
      mk({ title: 'Outline paper 2', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', date: at(-1), status: 'done' }),
      mk({ title: 'Call the bank about the new card', prio: 'B', num: 1, roleId: 'role-do', categoryId: 'cat-finance', date: at(-1), status: 'done' }),
      mk({ title: 'Literature review — five papers', prio: 'A', num: 2, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', date: at(-3), status: 'done' }),
      mk({ title: 'Buy running shoes', prio: 'B', num: 1, roleId: 'role-health', categoryId: 'cat-errands', goalId: 'g-run', date: at(-5), status: 'done' }),
      mk({ title: 'ML assignment 2', prio: 'A', num: 1, roleId: 'role-small', categoryId: 'cat-learning', goalId: 'g-ml', date: at(-6), status: 'done' }),
      mk({ title: 'Submit the abstract', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', date: at(-12), status: 'done' }),
      mk({ title: 'Collect data for experiment 3', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', date: at(-17), status: 'done' }),
      mk({ title: 'ML assignment 1', prio: 'A', num: 2, roleId: 'role-small', categoryId: 'cat-learning', goalId: 'g-ml', date: at(-20), status: 'done' }),
      mk({ title: 'Mock interview with a colleague', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-interview', date: at(-26), status: 'done' }),
      mk({ title: 'Prepare interview presentation', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-interview', date: at(-30), status: 'done' }),
      mk({ title: 'Revise chapter 4', prio: 'A', num: 1, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', date: at(-40), status: 'done' }),

      // master list (no date yet)
      mk({ title: 'Renew passport', prio: 'A', num: 1, date: null, roleId: 'role-do', categoryId: 'cat-errands' }),
      mk({ title: 'Test-ride electric bikes', prio: 'A', num: 2, date: null, roleId: 'role-family', categoryId: 'cat-personal' }),
      mk({ title: 'Set up a home gym and an exercise plan', prio: 'A', num: 3, date: null, roleId: 'role-health', categoryId: 'cat-health', goalId: 'g-run' }),
      mk({ title: 'Get the car serviced', prio: 'B', num: 1, date: null, roleId: 'role-do', categoryId: 'cat-errands' }),
      mk({ title: 'Sort old books for donation', prio: 'C', num: 1, date: null, roleId: 'role-family', categoryId: 'cat-home' })
    );

    // one subtask to show the "Subtasks" tab
    const paper = d.tasks.find(t => t.title === 'Draft the results section of paper 1');
    d.tasks.push(mk({ title: 'Ask co-author for the final plots', prio: 'B', num: 3, roleId: 'role-frog', categoryId: 'cat-work', goalId: 'g-papers', parentId: paper.id }));
    paper.showSub = 'indent';

    const y = T.slice(0, 4);
    d.events.push(
      { id: U.uid('e'), title: 'Team stand-up', date: T, allDay: false, start: '09:00', end: '09:30', color: '#1f6fe0', repeat: null, exdates: [], location: '', notes: '', reminder: null, sample: true },
      { id: U.uid('e'), title: 'Lunch with Arjun', date: T, allDay: false, start: '13:00', end: '14:00', color: '#2e7d32', repeat: null, exdates: [], location: 'Canteen', notes: '', reminder: null, sample: true },
      { id: U.uid('e'), title: 'Project review meeting', date: T, allDay: false, start: '15:30', end: '16:30', color: '#7b4bd6', repeat: null, exdates: [], location: 'Conference room 2', notes: '', reminder: 10, sample: true },
      { id: U.uid('e'), title: 'Dentist', date: at(2), allDay: false, start: '10:30', end: '11:00', color: '#d93025', repeat: null, exdates: [], location: '', notes: '', reminder: 30, sample: true },
      { id: U.uid('e'), title: 'Family function', date: at(4), allDay: true, start: null, end: null, color: '#ef6c00', repeat: null, exdates: [], location: '', notes: '', reminder: null, sample: true },
      { id: U.uid('e'), title: 'Republic Day', date: y + '-01-26', allDay: true, start: null, end: null, color: '#c2185b', repeat: { freq: 'yearly', interval: 1 }, exdates: [], location: '', notes: 'Holiday', reminder: null, sample: true },
      { id: U.uid('e'), title: 'Independence Day', date: y + '-08-15', allDay: true, start: null, end: null, color: '#c2185b', repeat: { freq: 'yearly', interval: 1 }, exdates: [], location: '', notes: 'Holiday', reminder: null, sample: true },
      { id: U.uid('e'), title: 'Gandhi Jayanti', date: y + '-10-02', allDay: true, start: null, end: null, color: '#c2185b', repeat: { freq: 'yearly', interval: 1 }, exdates: [], location: '', notes: 'Holiday', reminder: null, sample: true }
    );

    d.dayNotes[T] = '<p>Started early. The frog today is the results section: two hours, phone in the other room.</p>' +
      '<p>Reminder to self: finish the reviewer replies before the review meeting at 3:30.</p>' +
      '<p><em>This is an example entry. Write your own diary here; it saves as you type.</em></p>';
    d.dayNotes[at(-1)] = '<p>Good day. Outline for paper 2 is done and the bank issue is sorted.</p>';
    d.meta.sampleDayNotes = [T, at(-1)];

    d.mission = {
      html: '<p style="text-align: center"><strong>Begin with the end in mind.</strong></p>' +
        '<p style="text-align: center">MY MISSION IS TO DO THE MOST IMPORTANT WORK FIRST, TO KEEP LEARNING EVERY DAY, TO SERVE WITH INTEGRITY, AND TO BE THE PERSON MY FAMILY CAN ALWAYS COUNT ON — A STRONG MIND IN A HEALTHY BODY.</p>' +
        '<p style="text-align: center"><em>This is an example. Click Edit to write your own mission and add photos.</em></p>',
    };
    d.meta.sampleMission = true;

    const n = (o) => Object.assign({ id: U.uid('n'), notebookId: 'nb-career', title: '', html: '', done: false, pinned: false, createdAt: now, updatedAt: now, sample: true }, o);
    const daysAgo = k => now - k * 864e5;
    d.notes.push(
      n({ title: 'Time allotment for an ideal day', createdAt: daysAgo(376), updatedAt: daysAgo(376), done: true,
        html: '<h3>Time allotment for an ideal day</h3><ol><li>Time in a day = 24 hours</li><li>Sleep — 7 hours</li><li>Deep work on the frog — 3 hours</li><li>Office work and meetings — 6 hours</li><li>Learning — 1 hour</li><li>Exercise — 45 minutes</li><li>Family time — 2 hours</li><li>Reading and reflection — 30 minutes</li></ol>' }),
      n({ title: 'Skills to build this year', createdAt: daysAgo(40), updatedAt: daysAgo(3),
        html: '<ul><li>Machine learning: finish the course and two small projects</li><li>Scientific writing: one page a day</li><li>Public speaking: present at two seminars</li></ul>' }),
      n({ title: 'Milestones so far', createdAt: daysAgo(20), updatedAt: daysAgo(20), done: true,
        html: '<ul><li>Thesis draft submitted</li><li>Promotion interview cleared</li></ul><p>Next: two papers and the 10 km run.</p>' }),
      n({ notebookId: 'nb-ideas', title: 'Research ideas', createdAt: daysAgo(9), updatedAt: daysAgo(9),
        html: '<p>Use lightweight models on edge devices for faster field reports.</p>' })
    );

    // finance examples
    const F = d.finance;
    const m0 = T.slice(0, 8);
    const rec = (day, type, amount, cat, desc) => ({ id: U.uid('fr'), date: m0 + U.pad(Math.min(day, +T.slice(8))), type, amount, categoryId: cat, accountId: 'fa-bank', desc, notes: '', createdAt: now, updatedAt: now, sample: true });
    F.accounts.push({ id: 'fa-bank', name: 'Salary account', type: 'bank', institution: 'Example Bank', last4: '', notes: '', sample: true },
      { id: 'fa-cash', name: 'Cash', type: 'cash', institution: '', last4: '', notes: '', sample: true });
    const rent = rec(2, 'expense', 25000, 'fc-home', 'House rent'), sip = rec(3, 'expense', 10000, 'fc-invest', 'Mutual fund SIP');
    const mk0 = T.slice(0, 7);
    F.records.push(rec(1, 'income', 150000, 'fc-salary', 'Salary'), rent,
      sip, rec(5, 'expense', 6200, 'fc-grocery', 'Monthly groceries'),
      rec(7, 'expense', 2350, 'fc-utility', 'Electricity bill'), rec(9, 'expense', 1800, 'fc-transport', 'Fuel'),
      rec(12, 'expense', 3400, 'fc-food', 'Family dinner'), rec(14, 'expense', 1200, 'fc-edu', 'Books'),
      Object.assign(rec(10, 'transfer', 5000, null, 'Cash from ATM'), { toAccountId: 'fa-cash' }));
    F.cats.forEach(c => { const b = { 'fc-home': 25000, 'fc-grocery': 12000, 'fc-utility': 4000, 'fc-transport': 5000, 'fc-food': 6000, 'fc-invest': 20000, 'fc-edu': 3000, 'fc-salary': 150000 }[c.id]; if (b && !c.budget) { c.budget = b; c.sampleBudget = true; } });
    const rentBill = U.uid('fb'), sipBill = U.uid('fb');
    rent.billId = rentBill; sip.billId = sipBill;
    F.bills.push({ id: rentBill, name: 'House rent', amount: 25000, dueDay: 2, categoryId: 'fc-home', accountId: 'fa-bank', active: true, paid: +T.slice(8) >= 2 ? { [mk0]: rent.id } : {}, sample: true },
      { id: sipBill, name: 'Mutual fund SIP', amount: 10000, dueDay: 3, categoryId: 'fc-invest', accountId: 'fa-bank', active: true, paid: +T.slice(8) >= 3 ? { [mk0]: sip.id } : {}, sample: true },
      { id: U.uid('fb'), name: 'Mobile & broadband', amount: 1199, dueDay: 20, categoryId: 'fc-phone', accountId: 'fa-bank', active: true, paid: {}, sample: true });
    F.goals.push({ id: U.uid('fg'), name: 'Emergency fund (6 months)', target: 600000, saved: 240000, due: U.addMonths(T, 14), notes: '', createdAt: now, sample: true });
    F.holdings.push({ id: U.uid('fh'), name: 'Vehicle insurance', type: 'insurance', institution: 'Example Insurance Co.', amount: 0, value: 0, premium: 9800, frequency: 'yearly', start: U.addMonths(T, -11), due: at(12), ref: '', notes: 'Renew online before the due date.', sample: true },
      { id: U.uid('fh'), name: 'Fixed deposit', type: 'fd', institution: 'Example Bank', amount: 200000, value: 214000, premium: 0, frequency: '', start: U.addMonths(T, -10), due: U.addMonths(T, 2), ref: '', notes: '', sample: true });

    // financial plan example: numbers that match the example records, and four common goals
    const FPl = F.plan || (F.plan = S.finPlan());
    if (!FPl.income && !FPl.goals.length) {
      const y0 = +(T.slice(5, 7) >= '04' ? T.slice(0, 4) : +T.slice(0, 4) - 1);
      Object.assign(FPl, { age: 38, income: 180000, expenses: 65000, savings: 1500000, sampleNumbers: true });
      FPl.goals.push({ id: U.uid('pg'), type: 'house', name: 'Own flat', cost: 7500000, year: y0 + 5, inflation: 7, saved: 500000, every: 0, times: 0, loanPct: 75, loanRate: 8.5, loanYears: 20, notes: '', sample: true },
        { id: U.uid('pg'), type: 'education', name: 'Child’s engineering degree', cost: 2500000, year: y0 + 9, inflation: 10, saved: 200000, every: 0, times: 0, loanPct: 0, loanRate: 8.5, loanYears: 0, notes: '', sample: true },
        { id: U.uid('pg'), type: 'travel', name: 'Family sightseeing trip', cost: 150000, year: y0 + 1, inflation: 6, saved: 0, every: 2, times: 0, loanPct: 0, loanRate: 8.5, loanYears: 0, notes: '', sample: true },
        { id: U.uid('pg'), type: 'computer', name: 'New laptop', cost: 120000, year: y0 + 2, inflation: 4, saved: 0, every: 5, times: 0, loanPct: 0, loanRate: 8.5, loanYears: 0, notes: '', sample: true });
    }

    // study planner example (a short plan, so the three study pages have something to show)
    if (ED.study && ED.study.examplePlan) d.study = ED.study.examplePlan(T);

    // important websites
    const site = (name, url, cat, notes) => ({ id: U.uid('ws'), name, url, category: cat, notes: notes || '', pinned: false, createdAt: now, sample: true });
    d.sites.push(site('Income Tax e-Filing', 'https://www.incometax.gov.in/', 'Government'),
      site('DigiLocker', 'https://www.digilocker.gov.in/', 'Government'),
      site('NPTEL courses', 'https://nptel.ac.in/', 'Learning'),
      site('Google Calendar', 'https://calendar.google.com/', 'Tools'));

    // habit tracker: three habits with the last five weeks marked (a made-up but believable pattern)
    const HBt = d.habits || (d.habits = { list: [], log: {} });
    if (!HBt.list.length) {
      const start = U.addDays(T, -35);
      HBt.list.push({ id: 'hb-walk', name: 'Walk 30 minutes', icon: '🚶', days: null, start, stop: null, notes: 'Partly = under 30 minutes.', order: 0, sample: true },
        { id: 'hb-read', name: 'Read 20 pages', icon: '📖', days: null, start, stop: null, notes: '', order: 1, sample: true },
        { id: 'hb-medit', name: 'Meditate 10 minutes', icon: '🧘', days: [1, 2, 3, 4, 5], start, stop: null, notes: 'Weekdays, before work.', order: 2, sample: true });
      const pat = { 'hb-walk': 'ffpf fffnffpffff fpfnfffffpf ffff', 'hb-read': 'fpnffppfnfpfffpnffpfffnppffpfffnf', 'hb-medit': 'fffffffnfffpfffffpffnfffffffpfff' };
      HBt.sampleLog = {};                     // made-up marks, removed by "Clear examples" even from habits you kept
      for (let i = 0; i < 35; i++) {
        const k = U.addDays(start, i);
        HBt.list.forEach(h => {
          const c = (pat[h.id] || '')[i % 33];
          if ((!h.days || h.days.indexOf(U.dow(k)) >= 0) && (c === 'f' || c === 'p')) { (HBt.log[k] = HBt.log[k] || {})[h.id] = c === 'f' ? 'full' : 'part'; (HBt.sampleLog[h.id] = HBt.sampleLog[h.id] || []).push(k); }
        });
      }
    }
    return d;
  };

  /* remove everything flagged as an example */
  S.clearDemo = d => {
    const keep = x => !x.sample;
    d.tasks = d.tasks.filter(keep);
    d.events = d.events.filter(keep);
    d.goals = d.goals.filter(keep);
    d.values = d.values.filter(keep);
    d.notes = d.notes.filter(keep);
    (d.meta.sampleDayNotes || []).forEach(k => { delete d.dayNotes[k]; });
    d.meta.sampleDayNotes = [];
    if (d.meta.sampleMission) { d.mission = { html: '' }; d.meta.sampleMission = false; }
    const goalIds = new Set(d.goals.map(g => g.id));
    const valIds = new Set(d.values.map(v => v.id));
    d.tasks.forEach(t => { if (t.goalId && !goalIds.has(t.goalId)) t.goalId = null; });
    d.goals.forEach(g => { if (g.valueId && !valIds.has(g.valueId)) g.valueId = null; });
    const F = d.finance;
    if (F) {
      ['accounts', 'goals', 'holdings', 'bills', 'records'].forEach(k => { F[k] = (F[k] || []).filter(keep); });
      (F.cats || []).forEach(c => { if (c.sampleBudget) { c.budget = 0; delete c.sampleBudget; } });
      if (F.plan) {
        F.plan.goals = (F.plan.goals || []).filter(keep); F.plan.events = (F.plan.events || []).filter(keep);
        if (F.plan.sampleNumbers) { Object.assign(F.plan, { age: null, income: 0, expenses: 0, savings: 0 }); delete F.plan.sampleNumbers; }
      }
    }
    d.sites = (d.sites || []).filter(keep);
    if (d.habits) {
      const gone = new Set(d.habits.list.filter(h => h.sample).map(h => h.id));
      d.habits.list = d.habits.list.filter(keep);
      const made = d.habits.sampleLog || {};
      Object.keys(made).forEach(id => (made[id] || []).forEach(k => { if (d.habits.log[k]) delete d.habits.log[k][id]; }));
      Object.keys(d.habits.log).forEach(k => { gone.forEach(id => { delete d.habits.log[k][id]; }); if (!Object.keys(d.habits.log[k]).length) delete d.habits.log[k]; });
      delete d.habits.sampleLog;
      d.habits.list.forEach(h => { if (h.start && h.start < U.today()) h.start = U.today(); });   // kept example habits start afresh today
    }
    if (d.study && d.study.plan && d.study.plan.sample) {
      // the example plan goes, but papers, patents, news… and categories you added to it stay, in a plan of their own
      const p = d.study.plan, items = (p.items || []).filter(keep), cats = p.srcCats || [];
      if (items.length || cats.length) {
        const T0 = U.today();
        d.study = { plan: { id: U.uid('sp'), title: 'My reading & writing list', subtitle: '', start: T0, end: U.addDays(T0, 6), hoursPerWeek: 0, tracks: [], weeks: [], slots: [], books: [], lectures: [], topics: [], notes: [], howto: [],
          items: items.map(i => Object.assign({}, i, { trackId: '' })), srcCats: cats }, sessions: [] };
      } else d.study = { plan: null, sessions: [] };
    }
    // meeting plans kept for example events that are now gone
    if (d.meetings && d.meetings.notes) {
      const ids = new Set(d.events.map(x => x.id));
      Object.keys(d.meetings.notes).forEach(k => { const m = /^e:([^@]+)/.exec(k); if (m && !ids.has(m[1])) delete d.meetings.notes[k]; });
    }
    d.settings.sampleBanner = false;
  };

  S.hasDemo = d => d.tasks.some(t => t.sample) || d.goals.some(g => g.sample) || d.notes.some(n => n.sample) || d.events.some(e => e.sample) ||
    !!(d.finance && d.finance.records.some(r => r.sample)) || (d.sites || []).some(x => x.sample) || !!(d.habits && d.habits.list.some(h => h.sample));
})();
