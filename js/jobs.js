/* E-Diary — Study → Govt jobs: Government of India openings at Pay Level 13A / 14 (direct recruitment, deputation,
   lateral entry) in Defence, Intelligence, AI & deep tech and scientific organisations.
   Where the list comes from:
     • inside Claude, a weekly scheduled task searches the official recruitment pages and writes what it finds to this
       page's shared document `jobs/feed` ({ fetchedAt, items: [...], sources: [...] }); the page reads it when opened
       and merges it into your diary (new ones are marked "new");
     • the list it found on 10 Oct 2026 is built in, so the downloaded copy starts with it too;
     • you can add jobs yourself or import a list (.json).
   Your own fields on each job are kept: status (interested / applied / not for me), notes, and the last date in your
   calendar. Applying can also add it to Interview Prep.
   Data: ED.store.data.jobs = { items: [{ id, org, post, level, mode, area, location, lastDate, published, eligibility,
   vacancies, link, source, verified, notes, from: 'feed'|'me', seen, status, mine, eventId }], fetchedAt, seeded } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const FX = () => ED.fx, CH = () => ED.charts;
  const D = () => ED.store.data;
  const J = () => { const d = D(); if (!d.jobs || typeof d.jobs !== 'object') d.jobs = ED.sample.jobs(); if (!Array.isArray(d.jobs.items)) d.jobs.items = []; return d.jobs; };
  const A = (ED.actions = ED.actions || {});
  const CHG = (ED.changes = ED.changes || {});
  const st = () => ED.state.jobs || (ED.state.jobs = { area: '', level: '', mode: '', show: 'open', q: '' });
  const JB = (ED.jobs = {});

  const AREAS = ['Defence', 'Intelligence', 'AI & deep tech', 'Scientific'];
  const LEVELS = ['13A', '14', '13A/14', '13/13A', 'other'];
  const MODES = ['Direct recruitment', 'Deputation', 'Deputation / absorption', 'Lateral entry', 'Contract'];
  const FEED_FIELDS = ['org', 'post', 'level', 'mode', 'area', 'location', 'lastDate', 'published', 'eligibility', 'vacancies', 'link', 'source', 'verified', 'notes'];

  /* the list found on 10 Oct 2026 (official notices, checked by hand where the sites allowed it) */
  const SEED = { fetchedAt: '2026-10-10T18:52:51Z', items: [
    { id: 'negd-director-deputation-2026-09', org: 'National e-Governance Division (NeGD), Digital India Corporation, MeitY', post: 'Director (management positions in NeGD)', level: '13/13A', mode: 'Deputation', area: 'AI & deep tech', location: 'New Delhi', lastDate: '2026-10-11', published: '2026-09-21', eligibility: 'Officers at Pay Level 13 or above (Central/State Govt, PSUs, autonomous bodies) with a B.E./B.Tech and end-to-end project, budget and IT architecture/integration/cyber-security experience. Age below 56 (58 for Level-14 officers).', vacancies: '2', link: 'https://www.meity.gov.in/static/uploads/2026/09/a72273a0dc459dc9bfd91edf21fa8a3d.pdf', source: 'MeitY vacancies', verified: true, notes: 'Circular N-21012/8/2021-NeGD dated 21.09.2026. Deputation pay rules apply, so you keep your parent pay level. Apply through proper channel to negdhr@digitalindia.gov.in (advance copy accepted).' },
    { id: 'upsc-sr-director-is-2026-08', org: 'Union Public Service Commission (UPSC)', post: 'Senior Director (Information Systems)', level: '13A', mode: 'Deputation', area: 'AI & deep tech', location: 'New Delhi (Dholpur House)', lastDate: '2026-10-23', published: '2026-08-31', eligibility: 'MCA, or a Master’s in IT/CS/Computer Engg, or B.Tech (CS/IT/CE), with about 15 years’ experience across software development, AI, networks, cyber security and databases. Serving officers of Govt/PSUs/universities/research and autonomous bodies; maximum age 56.', vacancies: '1', link: 'https://www.upsc.gov.in/sites/default/files/VacCirc01-SrDirectorIS-Engl-250826.pdf', source: 'Job listing citing the UPSC vacancy circular', verified: false, notes: 'UPSC’s site could not be opened automatically — check the circular in your browser. Deputation including short-term contract, initial tenure 2 years; apply in duplicate through proper channel to the Under Secretary (Admn.II), UPSC.' },
    { id: 'drdo-dia-coe-iitbhu-director-2026-09', org: 'DRDO Industry-Academia Centre of Excellence (DIA-CoE), IIT (BHU) Varanasi', post: 'Director, DIA-CoE (full-time contract)', level: 'other', mode: 'Contract', area: 'Defence', location: 'Varanasi', lastDate: '2026-10-30', published: '2026-09-30', eligibility: 'Doctorate or Master’s in Engineering/Technology/Science with 25 years’ experience in technology or the defence technical domain; below 62. Serving government employees attach a parent-organisation NOC.', vacancies: '1', link: 'https://iitbhu.ac.in/contents/institute/2026/project/project_director_dia_coe_30sep_2026.pdf', source: 'IIT (BHU) positions; DRDO vacancies', verified: true, notes: 'Not a pay-matrix post: Rs 1.75–2.0 lakh a month consolidated, 3 years extendable by 2. Areas: powder metallurgy, functional materials, high-power microwave devices, ceramics.' },
    { id: 'dos-nesac-director-2026-09', org: 'North Eastern Space Applications Centre (NE-SAC), Department of Space', post: 'Director, NE-SAC', level: '14', mode: 'Deputation / absorption', area: 'Scientific', location: 'Umiam (near Shillong), Meghalaya', lastDate: '2026-10-31', published: '2026-09-30', eligibility: 'Central/State Govt officers (incl. autonomous bodies, R&D institutions, universities) with a PG/Doctorate and at least 10 years’ specialisation in space science, space applications, space communications or remote sensing. Maximum age for absorption 56.', vacancies: '1', link: 'https://www.isro.gov.in/media_isro/pdf/recruitmentNotice/2026/Sept/Advertisement_NESAC_30092026.pdf', source: 'ISRO / Department of Space careers', verified: true, notes: 'Advt DS_8C-12012/1/2026-Sec.VIII dated 30.09.2026. Filled by immediate absorption — you would leave the IMD cadre. Apply through proper channel to the Under Secretary (ABs), DoS, Bengaluru.' },
    { id: 'dbt-bric-rgcb-scientist-f-2026-09', org: 'BRIC-Rajiv Gandhi Centre for Biotechnology (RGCB), Department of Biotechnology', post: 'Scientist F (faculty, rolling advertisement)', level: '13A', mode: 'Direct recruitment', area: 'Scientific', location: 'Thiruvananthapuram', lastDate: '2026-11-30', published: '2026-09-01', eligibility: 'MD/PhD with 8 years’ post-doctoral experience, a strong publication record and the ability to lead a research group; age limit 50.', vacancies: '2', link: 'https://rgcb.res.in/adv-sci-01-2026.php', source: 'RGCB careers', verified: true, notes: 'Rolling, reviewed quarterly (this quarter closes 30 Nov 2026). Life-sciences areas — a weak fit for an electronics/AI profile.' },
  ] };
  const SOURCES = [
    ['DRDO — Vacancies', 'https://drdo.gov.in/drdo/en/offerings/vacancies', 'DRDO lab and RAC adverts, DRDO-linked posts, some deputation circulars'],
    ['DRDO RAC', 'https://rac.gov.in/', 'DRDS Scientist B–G, including lateral Scientist E/F/G'],
    ['Aeronautical Development Agency', 'https://www.ada.gov.in/', 'Scientist/Engineer, Joint Director on deputation'],
    ['ISRO / Department of Space — Opportunities', 'https://www.isro.gov.in/ViewAllOpportunities.html', 'DoS, ISRO centres, NE-SAC, NARL, IN-SPACe'],
    ['MeitY — Vacancies', 'https://www.meity.gov.in/offerings/vacancies', 'MeitY, NeGD, STQC, SCL, IndiaAI: Scientist, Director, DG'],
    ['Digital India Corporation — Jobs', 'https://dic.gov.in/job-category/open-job/', 'IndiaAI Mission, NeGD, Bhashini (mostly contract; senior roles at times)'],
    ['Principal Scientific Adviser', 'https://www.psa.gov.in/', 'Scientist D–G deputation circulars'],
    ['MHA — Vacancies', 'https://www.mha.gov.in/en/notifications/vacancies', 'I4C, NCB, NATGRID, IB, BPR&D deputation circulars'],
    ['Cabinet Secretariat — Vacancies', 'https://cabsec.gov.in/more/vacancies/', 'Deputation posts incl. technical cadres'],
    ['NTRO — deputation circulars (web search, last month)', 'https://www.google.com/search?tbs=qdr:m&q=NTRO+deputation+vacancy+circular', 'NTRO and NCIIPC rarely post on their own site; their circulars appear on other ministries’ sites and DoPT'],
    ['Intelligence Bureau — circulars (web search, last month)', 'https://www.google.com/search?tbs=qdr:m&q=%22Intelligence+Bureau%22+deputation+vacancy+circular', 'IB deputation posts (direct recruitment is on MHA’s page above)'],
    ['ARC / DG Security — circulars (web search, last month)', 'https://www.google.com/search?tbs=qdr:m&q=%22Aviation+Research+Centre%22+OR+%22DG+Security%22+deputation+circular', 'ARC, SFF and other Cabinet Secretariat units'],
    ['NATGRID, NSCS, DIA — circulars (web search, last month)', 'https://www.google.com/search?tbs=qdr:m&q=NATGRID+OR+NSCS+OR+%22Defence+Intelligence+Agency%22+deputation+vacancy', 'NATGRID, National Security Council Secretariat, Defence Intelligence Agency'],
    ['UPSC — Vacancy circulars', 'https://www.upsc.gov.in/vacancy-circulars', 'Deputation posts in UPSC (open in a browser)'],
    ['DAE — Vacancy notices', 'https://dae.gov.in/notice-category/vacancy-notices/', 'DAE and BARC deputation posts'],
    ['DAE — Vacancies in other ministries', 'https://dae.gov.in/vacancies-in-other-ministry/', 'Circulated GoI deputation vacancies'],
    ['CSIR — Recruitment', 'https://www.csir.res.in/en/career-opportunities/recruitment', 'CSIR HQ adverts incl. lab Directors'],
    ['CSIR Recruitment & Assessment Board', 'https://rab.csir.res.in/recruitments.php', 'Scientist to Chief Scientist, Levels 11–14'],
    ['ICMR — Employment', 'https://www.icmr.gov.in/employment-opportunities', 'Scientist B–G, ADG, deputation'],
    ['DBT — Advertisements', 'https://dbtindia.gov.in/whats-new/advertisement', 'DBT and BRIC institutes'],
    ['DST — Recruitment cell', 'https://dst.gov.in/administrationfinance/recruitment-cell', 'Scientist C–G, Scientific Attaché, Mission Director'],
    ['ANRF', 'https://anrf.gov.in/', 'Scientist C/D/G/H, Director'],
    ['MoES — Vacancies', 'https://www.moes.gov.in/offerings/vacancies', 'MoES and IMD: Scientist C–G, Mission Director'],
    ['NCPOR — Careers', 'https://ncpor.res.in/recruitment', 'NCPOR scientific posts'],
  ].map(x => ({ name: x[0], url: x[1], what: x[2] }));

  /* ---------------- merging a fetched list into the diary ---------------- */
  const clean = x => {
    const o = {}; FEED_FIELDS.forEach(k => { if (x[k] != null) o[k] = typeof x[k] === 'string' ? x[k].slice(0, 1200) : x[k]; });
    if (o.lastDate && !U.isKey(o.lastDate)) o.lastDate = null;
    if (o.published && !U.isKey(o.published)) o.published = null;
    if (o.link && !/^https?:\/\//i.test(o.link)) o.link = '';
    return o;
  };
  JB.merge = (feed, mark) => {
    const items = Array.isArray(feed) ? feed : (feed && feed.items) || [];
    const j = J(); let added = 0, changed = 0;
    items.forEach(raw => {
      if (!raw || typeof raw !== 'object' || !raw.post) return;
      const id = String(raw.id || (raw.org + '-' + raw.post + '-' + (raw.lastDate || ''))).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90);
      const x = j.items.find(y => y.id === id), v = clean(raw);
      if (x) { const before = JSON.stringify(FEED_FIELDS.map(k => x[k])); Object.assign(x, v); if (JSON.stringify(FEED_FIELDS.map(k => x[k])) !== before) { changed++; x.updatedAt = Date.now(); } }
      else { j.items.push(Object.assign({ id, from: 'feed', seen: U.today(), fresh: !!mark, status: '', mine: '', createdAt: Date.now(), updatedAt: Date.now() }, v)); added++; }
    });
    if (feed && feed.fetchedAt && (!j.fetchedAt || feed.fetchedAt > j.fetchedAt)) j.fetchedAt = feed.fetchedAt;
    if (feed && Array.isArray(feed.sources) && feed.sources.length) j.sources = feed.sources.filter(s => s && /^https?:\/\//i.test(s.url || '')).slice(0, 40).map(s => ({ name: String(s.name || s.url).slice(0, 120), url: s.url, what: String(s.what || '').slice(0, 200) }));
    return { added, changed };
  };
  /* the built-in list, once per diary */
  const seed = () => { const j = J(); if (j.seeded >= 1) return false; JB.merge(SEED, false); j.seeded = 1; return true; };
  /* inside Claude: the list the weekly task keeps up to date */
  let pulling = false;
  JB.pull = async (manual) => {
    const s = st();
    if (pulling || !(ED.env && ED.env.claude) || !window.claude || !window.claude.use) { if (manual) ED.ui.toast('The automatic list is read inside Claude. Here, add jobs yourself or import a list.'); return; }
    if (!manual && s.pulledAt && Date.now() - s.pulledAt < 30 * 60000) return;
    pulling = true; s.pulledAt = Date.now(); s.err = '';
    try {
      const db = await window.claude.use('db');
      if (!db) throw new Error('not available');
      const snap = await db.doc('jobs/feed').get();
      if (!snap.exists) { s.err = 'none'; if (manual) ED.ui.toast('No list from the weekly check yet — it runs every Monday.'); return; }
      const r = JB.merge(snap.data() || {}, true);
      ED.store.commit();
      if (manual || r.added) ED.ui.toast(r.added ? U.plural(r.added, 'new opening') + ' found' : 'The list is up to date');
    } catch (err) { s.err = (err && (err.code || err.message)) || 'error'; if (manual) ED.ui.toast('Could not read the list: ' + s.err, { kind: 'err' }); }
    finally { pulling = false; }
  };

  /* on your computer: a linked "E-Diary Jobs" folder inside Google Drive for desktop.
     The Monday task writes e-diary-jobs-feed-YYYY-MM-DD.json there; Google Drive brings it down; the diary reads the newest
     one when it opens. The diary writes e-diary-my-websites.json back there so the Monday task knows your websites. */
  const FEED_RE = /^e-diary-jobs-feed.*\.json$/i, SITES_FILE = 'e-diary-my-websites.json';
  const DIR = JB.dir = {
    supported: typeof window.showDirectoryPicker === 'function' && !(ED.env && (ED.env.framed || ED.env.claude)),
    handle: null, perm: '', name: '', readAt: 0, error: '',
    async init() {
      if (!this.supported) return;
      try { await ED.idb.open(); this.handle = (await ED.idb.get('jobs-dir')) || null; } catch (err) { this.handle = null; }
      if (!this.handle) return;
      this.name = this.handle.name;
      try { this.perm = await this.handle.queryPermission({ mode: 'readwrite' }); } catch (err) { this.perm = 'prompt'; }
      if (this.perm === 'granted') await JB.dirRead(false);
      ED.app.requestRender();
    },
    async pick() {
      let h; try { h = await window.showDirectoryPicker({ id: 'ediary-jobs', mode: 'readwrite' }); } catch (err) { return; }
      this.handle = h; this.name = h.name; this.perm = 'granted';
      try { await ED.idb.set('jobs-dir', h); } catch (err) { /* stays linked until the diary closes */ }
      await JB.dirWriteSites(); await JB.dirRead(true);
    },
    async allow() {
      if (!this.handle) return;
      try { this.perm = await this.handle.requestPermission({ mode: 'readwrite' }); } catch (err) { this.perm = 'denied'; }
      if (this.perm === 'granted') { await JB.dirWriteSites(); await JB.dirRead(true); } else ED.app.requestRender();
    },
    async forget() { try { await ED.idb.del('jobs-dir'); } catch (err) { /* ignore */ } this.handle = null; this.perm = ''; this.name = ''; ED.app.requestRender(); },
  };
  JB.dirInit = () => DIR.init();
  JB.dirRead = async manual => {
    if (!DIR.handle || DIR.perm !== 'granted') return;
    if (!manual && DIR.readAt && Date.now() - DIR.readAt < 10 * 60000) return;
    DIR.readAt = Date.now(); DIR.error = '';
    try {
      const files = [];
      for await (const [name, h] of DIR.handle.entries()) if (h.kind === 'file' && FEED_RE.test(name)) files.push(await h.getFile());
      if (!files.length) { if (manual) ED.ui.toast('No job list in “' + DIR.name + '” yet — the Monday check puts one there.'); ED.app.requestRender(); return; }
      // newest list wins (by its own fetchedAt, else the file date)
      let best = null, bestAt = '';
      for (const f of files.sort((a, b) => b.lastModified - a.lastModified).slice(0, 8)) {
        try { const d = JSON.parse(await f.text()); const at = String(d.fetchedAt || new Date(f.lastModified).toISOString()); if (!best || at > bestAt) { best = d; bestAt = at; } } catch (err) { /* skip a half-synced file */ }
      }
      if (!best) throw new Error('the list file could not be read');
      if (!best.fetchedAt) best.fetchedAt = bestAt;
      const r = JB.merge(best, true); ED.store.commit();
      if (manual || r.added) ED.ui.toast(r.added ? U.plural(r.added, 'new opening') + ' found' : 'The list is up to date');
    } catch (err) { DIR.error = (err && err.message) || 'error'; if (manual) ED.ui.toast('Could not read the jobs folder: ' + DIR.error, { kind: 'err' }); ED.app.requestRender(); }
  };
  JB.dirWriteSites = async () => {
    if (!DIR.handle || DIR.perm !== 'granted') return;
    try {
      const fh = await DIR.handle.getFileHandle(SITES_FILE, { create: true }), w = await fh.createWritable();
      await w.write(JSON.stringify({ sites: (J().sites || []).map(x => ({ name: x.name, url: x.url, what: x.what || '' })), updatedAt: new Date().toISOString() }, null, 1));
      await w.close();
    } catch (err) { ED.ui.toast('Could not write your websites to the jobs folder', { kind: 'err' }); }
  };

  /* ---------------- helpers ---------------- */
  const closed = x => !!(x.lastDate && x.lastDate < U.today());
  const daysTo = x => x.lastDate ? U.diffDays(U.today(), x.lastDate) : null;
  const shown = () => {
    const s = st(), q = (s.q || '').toLowerCase();
    return J().items.filter(x =>
      (!s.area || x.area === s.area) && (!s.level || (x.level || '').indexOf(s.level) >= 0) && (!s.mode || (x.mode || '').indexOf(s.mode) === 0) &&
      (s.show === 'all' ? true : s.show === 'open' ? !closed(x) && x.status !== 'no' : s.show === 'closed' ? closed(x) : x.status === s.show) &&
      (!q || [x.org, x.post, x.eligibility, x.notes, x.location, x.mine].join(' ').toLowerCase().indexOf(q) >= 0))
      .sort((a, b) => (closed(a) ? 1 : 0) - (closed(b) ? 1 : 0) || String(a.lastDate || '9999').localeCompare(String(b.lastDate || '9999')));
  };
  const lvlText = l => !l ? '' : l === 'other' ? 'Other pay' : 'Level ' + l;
  const card = x => {
    const n = daysTo(x), cl = closed(x);
    const due = x.lastDate ? '<span class="jb-due' + (cl ? ' over' : n <= 7 ? ' soon' : '') + '">' + ED.icon('clock') + 'Last date ' + e(U.fmtShort(x.lastDate)) + (cl ? ' · closed' : n === 0 ? ' · today' : ' · ' + U.plural(n, 'day') + ' left') + '</span>' : '<span class="jb-due">' + ED.icon('clock') + 'Open / rolling</span>';
    const sb = (v, label, icon) => '<button type="button" class="btn small' + (x.status === v ? ' on' : ' ghost') + '" data-act="jb-status" data-id="' + e(x.id) + '" data-v="' + v + '" aria-pressed="' + (x.status === v) + '">' + (icon ? ED.icon(icon) : '') + label + '</button>';
    return '<article class="jb-card' + (cl ? ' closed' : '') + (x.fresh ? ' fresh' : '') + '">' +
      '<div class="jb-h"><b class="jb-post">' + e(x.post) + '</b>' + (x.fresh ? '<span class="chip jb-new">new</span>' : '') + '</div>' +
      '<div class="jb-org">' + e(x.org || '') + (x.location ? ' · ' + e(x.location) : '') + '</div>' +
      '<div class="jb-tags">' + (x.level ? '<span class="jb-lv">' + e(lvlText(x.level)) + '</span>' : '') + (x.mode ? '<span class="chip">' + e(x.mode) + '</span>' : '') + (x.area ? '<span class="chip">' + e(x.area) + '</span>' : '') + (x.vacancies ? '<span class="hint">' + e(x.vacancies) + ' post' + (x.vacancies === '1' ? '' : 's') + '</span>' : '') + due + '</div>' +
      (x.eligibility ? '<p class="jb-el">' + e(x.eligibility) + '</p>' : '') +
      (x.notes ? '<p class="hint jb-notes">' + e(x.notes) + '</p>' : '') +
      (x.verified === false ? '<p class="jb-warn">' + ED.icon('info') + 'Not checked against the official notice — confirm the details there.</p>' : '') +
      (x.mine ? '<p class="jb-mine">' + ED.icon('pencil') + e(x.mine) + '</p>' : '') +
      '<div class="row-btns jb-btns">' + (x.link ? '<a class="btn small" href="' + e(x.link) + '" target="_blank" rel="noopener noreferrer">' + ED.icon('external') + 'Notice</a>' : '') +
      sb('interested', 'Interested', 'star') + sb('applied', 'Applied', 'check') + sb('no', 'Not for me', '') +
      '<button type="button" class="icon-btn sm" data-act="jb-menu" data-id="' + e(x.id) + '" aria-label="More for this job" title="More">' + ED.icon('more') + '</button></div></article>';
  };

  const view = {
    id: 'jobs', label: 'Govt Jobs',
    left() {
      const j = J(), s = st(), all = j.items, open = all.filter(x => !closed(x));
      const soon = open.filter(x => { const n = daysTo(x); return n != null && n <= 7; });
      const tiles = '<div class="tiles xp-tiles">' + FX().tile('Open now', String(open.filter(x => x.status !== 'no').length), U.plural(all.length, 'job') + ' in your list') +
        FX().tile('Closing in 7 days', String(soon.length), soon.length ? e(soon[0].post) : 'none', soon.length ? 'warn' : '') +
        FX().tile('Interested / applied', all.filter(x => x.status === 'interested').length + ' / ' + all.filter(x => x.status === 'applied').length, '') +
        FX().tile('List checked', j.fetchedAt ? e(U.fmtDM(U.key(new Date(j.fetchedAt)))) : '—', ED.env.claude || (DIR.handle && DIR.perm === 'granted') ? 'refreshed every Monday' : 'link the jobs folder') + '</div>';
      const sel = (k, label, opts) => '<select class="field" data-change="jb-filter" data-k="' + k + '" aria-label="' + e(label) + '">' + opts.map(o => FX().opt(o[0], o[1], (s[k] || '') === o[0])).join('') + '</select>';
      const filters = '<div class="xp-filters jb-filters">' +
        sel('show', 'Show', [['open', 'Open (not dismissed)'], ['interested', 'Interested'], ['applied', 'Applied'], ['no', 'Not for me'], ['closed', 'Closed'], ['all', 'Everything']]) +
        sel('area', 'Area', [['', 'All areas']].concat(AREAS.map(a => [a, a]))) +
        sel('level', 'Level', [['', 'Any level'], ['13A', 'Level 13A'], ['14', 'Level 14']]) +
        sel('mode', 'Way in', [['', 'Any way in'], ['Direct', 'Direct recruitment'], ['Deputation', 'Deputation'], ['Lateral', 'Lateral entry'], ['Contract', 'Contract']]) +
        '<input class="field" type="search" placeholder="Search" value="' + e(s.q || '') + '" data-change="jb-q" aria-label="Search jobs"></div>';
      const list = shown();
      const body = tiles + filters + (list.length ? list.map(card).join('') : '<p class="hint">' + (all.length ? 'No jobs match these filters.' : 'No jobs yet.') + '</p>');
      return FX().page('jb', 'Govt jobs · Level 13A / 14',
        '<button type="button" class="btn small primary" data-act="jb-new">' + ED.icon('plus') + 'Add a job</button><button type="button" class="icon-btn" data-act="jb-more" aria-label="More" title="More">' + ED.icon('more') + '</button>', body, 'jb-left');
    },
    right() {
      // the official pages listed here, plus any new ones the weekly check came across
      const j = J(), applied = j.items.filter(x => x.status === 'applied'), urls = new Set(SOURCES.map(x => x.url)), src = SOURCES.concat((j.sources || []).filter(x => !urls.has(x.url)));
      const counts = AREAS.map(a => ({ a, n: j.items.filter(x => x.area === a && !closed(x)).length }));
      const how = ED.env.claude
        ? '<p>A scheduled task checks the official recruitment pages every <b>Monday</b> for Level 13A and 14 openings in defence, intelligence, AI & deep tech and scientific organisations — direct recruitment, deputation and lateral entry — and this page picks up what it finds. New ones are marked <span class="chip jb-new">new</span>.</p><div class="row-btns"><button type="button" class="btn small" data-act="jb-pull">' + ED.icon('sync') + 'Read the latest list now</button></div>'
        : !DIR.supported
          ? '<p>To have this list fill itself every Monday, open the diary in <b>Chrome or Edge</b> on a computer and link your <b>E-Diary Jobs</b> folder (in Google Drive). Here you can add openings yourself or import a list (.json).</p>'
          : !DIR.handle
            ? '<p><b>Automatic updates:</b> every Monday a scheduled check puts the latest Level 13A/14 openings into the <b>E-Diary Jobs</b> folder in your Google Drive. With <b>Google Drive for desktop</b> installed, link that folder once and the diary reads the newest list each time it opens.</p><div class="row-btns"><button type="button" class="btn small primary" data-act="jb-dir">' + ED.icon('cloud') + 'Link the E-Diary Jobs folder…</button></div><p class="hint">Pick <i>Google Drive → My Drive → E-Diary Jobs</i>. When Chrome asks, choose <b>Allow on every visit</b>.</p>'
            : DIR.perm !== 'granted'
              ? '<p>Linked to <b>' + e(DIR.name) + '</b>. The browser needs your OK once this session to read it.</p><div class="row-btns"><button type="button" class="btn small primary" data-act="jb-dir-allow">' + ED.icon('cloud') + 'Allow reading the jobs folder</button><button type="button" class="btn small ghost" data-act="jb-dir-off">Unlink</button></div>'
              : '<p>Linked to <b>' + e(DIR.name) + '</b> in Google Drive. A scheduled check puts a fresh list there every <b>Monday</b>; the diary reads it when it opens. New ones are marked <span class="chip jb-new">new</span>.' + (DIR.error ? ' <span class="err-text">' + e(DIR.error) + '</span>' : '') + '</p><div class="row-btns"><button type="button" class="btn small" data-act="jb-dir-read">' + ED.icon('sync') + 'Read the folder now</button><button type="button" class="btn small ghost" data-act="jb-dir-off">Unlink</button></div>';
      const meters = CH().meters({ title: 'Open jobs by area', rows: counts.map(c => ({ label: c.a, value: c.n, valueLabel: String(c.n) })), max: Math.max(1, ...counts.map(c => c.n)) });
      return '<div class="xp jb-r"><div class="pg-head"><h2 class="pg-title">Where they come from</h2></div><div class="st-scroll scroll" data-keep-scroll="jb-right">' +
        '<div class="jb-how">' + how + '<p class="hint">Always confirm eligibility, the feeder grade and the last date in the official notice, and apply through proper channel where required.</p></div>' + meters +
        (applied.length ? '<h3 class="gh">My applications <span class="hint num">· ' + applied.length + '</span></h3><ul class="jb-apps">' + applied.map(x => '<li><span class="grow"><b>' + e(x.post) + '</b><span class="hint">' + e(x.org || '') + '</span></span><span class="hint num">' + (x.lastDate ? 'last date ' + e(U.fmtDM(x.lastDate)) : '') + '</span></li>').join('') + '</ul>' : '') +
        '<h3 class="gh">My websites <span class="hint num">· ' + (j.sites || []).length + '</span></h3>' + ((j.sites || []).length ? '<ul class="jb-src">' + j.sites.map(x => '<li><span class="grow"><a href="' + e(x.url) + '" target="_blank" rel="noopener noreferrer">' + e(x.name) + ED.icon('external') + '</a><span class="hint">' + e(x.what || '') + '</span></span><button type="button" class="icon-btn sm" data-act="jb-site-del" data-id="' + e(x.id) + '" aria-label="Remove ' + e(x.name) + '" title="Remove">' + ED.icon('x') + '</button></li>').join('') + '</ul>' : '<p class="hint">Add any page you want watched — an agency’s careers page, a ministry’s vacancy list.' + (ED.env.claude ? ' The Monday check searches these too.' : '') + '</p>') +
        '<div class="row-btns"><button type="button" class="btn small" data-act="jb-site-add">' + ED.icon('plus') + 'Add a website</button></div>' +
        '<h3 class="gh">Pages to check</h3><ul class="jb-src">' + src.map(x => '<li><a href="' + e(x.url) + '" target="_blank" rel="noopener noreferrer">' + e(x.name) + ED.icon('external') + '</a><span class="hint">' + e(x.what || '') + '</span></li>').join('') + '</ul>' +
        '<p class="hint">Also: Employment News (weekly), DoPT deputation circulars, and your own ministry’s circulation of vacancies.</p></div></div>';
    },
    mount() {
      if (seed()) ED.store.commit();
      const j = J(); let fresh = false;
      // "new" marks fade once seen for a day
      j.items.forEach(x => { if (x.fresh && x.seen && x.seen < U.addDays(U.today(), -2)) { delete x.fresh; fresh = true; } });
      if (fresh) ED.store.commit({ silent: true });
      JB.pull(false); JB.dirRead(false);
    },
  };
  ED.views = ED.views || {};
  ED.views.jobs = view;

  /* ---------------- actions ---------------- */
  const job = id => J().items.find(x => x.id === id);
  CHG['jb-filter'] = el => { st()[el.dataset.k] = el.value; ED.app.renderPage('left'); };
  CHG['jb-q'] = el => { st().q = el.value.trim(); ED.app.renderPage('left'); };
  A['jb-pull'] = () => JB.pull(true);
  A['jb-status'] = el => {
    const x = job(el.dataset.id); if (!x) return;
    const v = x.status === el.dataset.v ? '' : el.dataset.v;
    x.status = v; delete x.fresh; x.updatedAt = Date.now();
    ED.store.commit();
    if (v === 'applied') {
      const iv = D().interview && D().interview.list;
      const has = iv && iv.some(y => y.jobId === x.id);
      if (iv && !has) ED.ui.toast('Marked as applied', { action: 'Track in Interview Prep', timeout: 9000, onAction: () => A['jb-iv']({ dataset: { id: x.id } }) });
    }
  };
  A['jb-iv'] = el => {
    const x = job(el.dataset.id); if (!x) return;
    const d = D(); if (!d.interview) return;
    if (d.interview.list.some(y => y.jobId === x.id)) { ED.go.tab('interview'); return; }
    ED.store.checkpoint('Interview from job');
    d.interview.list.push({ id: U.uid('iv'), jobId: x.id, role: x.post, org: x.org, ref: [lvlText(x.level), x.mode].filter(Boolean).join(' · '), date: '', time: '', mode: 'in-person', venue: x.location || '', stage: 'Applied', notes: [x.link, x.eligibility].filter(Boolean).join('\n'), createdAt: Date.now(), updatedAt: Date.now() });
    ED.store.commit(); ED.ui.toast('Added to Interview Prep', { action: 'Open', onAction: () => ED.go.tab('interview') });
  };
  A['jb-menu'] = el => {
    const x = job(el.dataset.id); if (!x) return;
    ED.ui.menu(el, [
      { label: x.eventId ? 'Remove the last date from my calendar' : 'Put the last date in my calendar', icon: 'calendar', disabled: !x.lastDate, onClick: () => {
        ED.store.checkpoint('Job date');
        FX().linkEvent(x, { on: !x.eventId, title: 'Last date: ' + x.post + (x.org ? ' — ' + x.org.split(',')[0] : ''), date: x.lastDate, color: '#d93025', notes: x.link || '' });
        ED.store.commit(); ED.ui.toast(x.eventId ? 'In your calendar on ' + U.fmtDM(x.lastDate) : 'Removed from your calendar');
      } },
      { label: 'Track in Interview Prep', icon: 'users', onClick: () => A['jb-iv']({ dataset: { id: x.id } }) },
      { label: 'My notes…', icon: 'doc', onClick: async () => { const v = await ED.ui.prompt({ title: 'My notes', label: x.post, value: x.mine || '', multiline: true, ok: 'Save' }); if (v == null) return; x.mine = v.trim(); x.updatedAt = Date.now(); ED.store.commit(); } },
      { label: 'Copy the details', icon: 'copy', onClick: async () => ED.ui.toast(await U.copy([x.post, x.org, lvlText(x.level) + ' · ' + (x.mode || ''), x.lastDate ? 'Last date: ' + U.fmtLong(x.lastDate) : '', x.eligibility, x.link].filter(Boolean).join('\n')) ? 'Copied' : 'Could not copy') },
      { label: 'Edit', icon: 'pencil', onClick: () => JB.edit(x.id) },
      { sep: true },
      { label: 'Delete', icon: 'trash', danger: true, onClick: () => { ED.store.checkpoint('Delete job'); FX().dropEvent(x); J().items = J().items.filter(y => y !== x); ED.store.commit(); ED.ui.undoToast('Job deleted'); } },
    ], { placement: 'right-align' });
  };
  JB.edit = id => {
    const x = id ? job(id) : null;
    FX().form({
      title: x ? 'Job' : 'Add a job', wide: true,
      data: x || { level: '13A', mode: 'Deputation', area: 'Scientific' },
      fields: [
        { k: 'post', label: 'Post', req: true, ph: 'e.g. Scientist G, Director (Technical)' }, { k: 'org', label: 'Organisation', ph: 'e.g. DRDO, ISRO, MeitY, NTRO' },
        { k: 'level', label: 'Pay level', type: 'select', options: LEVELS.map(l => [l, lvlText(l)]) },
        { k: 'mode', label: 'Way in', type: 'select', options: MODES.map(m => [m, m]) },
        { k: 'area', label: 'Area', type: 'select', options: AREAS.map(a => [a, a]) },
        { k: 'location', label: 'Place' }, { k: 'lastDate', label: 'Last date', type: 'date' },
        { k: 'link', label: 'Link to the notice', ph: 'https://…' },
        { k: 'eligibility', label: 'Eligibility (short)', type: 'textarea', rows: 2 }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      save(v, api) {
        if (v.link && !/^https?:\/\//i.test(v.link)) { ED.ui.toast('The link must start with https://'); return; }
        ED.store.checkpoint(x ? 'Job' : 'New job');
        if (x) Object.assign(x, v, { updatedAt: Date.now() }); else J().items.push(Object.assign({ id: U.uid('jb'), from: 'me', status: 'interested', seen: U.today(), createdAt: Date.now(), updatedAt: Date.now() }, v));
        ED.store.commit(); api.close();
      },
    });
  };
  /* websites you add: kept in the diary and, inside Claude, shared with the Monday check (doc jobs/sources — names and links only) */
  JB.pushSites = async () => {
    if (!(ED.env && ED.env.claude) || !window.claude || !window.claude.use) return;
    try { const db = await window.claude.use('db'); if (db) await db.doc('jobs/sources').set({ sites: (J().sites || []).map(x => ({ name: x.name, url: x.url, what: x.what || '' })), updatedAt: Date.now() }); }
    catch (err) { ED.ui.toast('Saved in the diary, but the Monday check could not be told: ' + ((err && (err.code || err.message)) || 'error'), { kind: 'err' }); }
  };
  A['jb-site-add'] = () => FX().form({
    title: 'Add a website to watch',
    data: {},
    fields: [{ k: 'url', label: 'Web address', req: true, ph: 'https://…' }, { k: 'name', label: 'Name', ph: 'e.g. NTRO careers' }, { k: 'what', label: 'What to look for', ph: 'e.g. Scientist F/G, deputation' }],
    save(v, api) {
      let url = String(v.url || '').trim(); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      try { new URL(url); } catch (err) { ED.ui.toast('That is not a web address'); return; }
      const j = J(); j.sites = j.sites || [];
      if (j.sites.some(x => x.url === url)) { ED.ui.toast('Already in your list'); return; }
      ED.store.checkpoint('Add website');
      j.sites.push({ id: U.uid('ws'), url, name: String(v.name || '').trim() || new URL(url).hostname, what: String(v.what || '').trim(), createdAt: Date.now(), updatedAt: Date.now() });
      ED.store.commit(); api.close(); JB.pushSites(); JB.dirWriteSites();
    },
  });
  A['jb-site-del'] = el => { const j = J(); const x = (j.sites || []).find(y => y.id === el.dataset.id); if (!x) return; ED.store.checkpoint('Remove website'); j.sites = j.sites.filter(y => y !== x); ED.store.commit(); ED.ui.undoToast('Removed: ' + x.name); JB.pushSites(); JB.dirWriteSites(); };
  A['jb-dir'] = () => DIR.pick();
  A['jb-dir-allow'] = () => DIR.allow();
  A['jb-dir-read'] = () => JB.dirRead(true);
  A['jb-dir-off'] = () => DIR.forget();
  A['jb-new'] = () => JB.edit(null);
  A['jb-more'] = el => ED.ui.menu(el, [
    { label: 'Read the latest list now', icon: 'sync', disabled: !ED.env.claude && !(DIR.handle && DIR.perm === 'granted'), onClick: () => ED.env.claude ? JB.pull(true) : JB.dirRead(true) },
    { label: 'Import a list (.json)…', icon: 'upload', onClick: async () => {
      const f = await U.pickFile('.json,application/json'); if (!f) return;
      try { const r = JB.merge(JSON.parse(await U.readText(f)), true); ED.store.commit(); ED.ui.toast(U.plural(r.added, 'new job') + ', ' + U.plural(r.changed, 'update')); }
      catch (err) { ED.ui.toast('That file is not a job list.', { kind: 'err' }); }
    } },
    { label: 'Remove closed jobs I did not mark', icon: 'trash', onClick: () => { const j = J(); const n = j.items.filter(x => closed(x) && !x.status).length; if (!n) { ED.ui.toast('Nothing to remove'); return; } ED.store.checkpoint('Remove closed'); j.items = j.items.filter(x => !(closed(x) && !x.status)); ED.store.commit(); ED.ui.undoToast(U.plural(n, 'closed job') + ' removed'); } },
  ], { placement: 'right-align' });
})();
