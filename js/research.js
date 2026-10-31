/* E-Diary — Research papers (added in 1.17; Study → Year at a glance → Research papers, in place of Notes).
   Your topics and subtopics, with the papers you keep under them (title, authors, venue, year, DOI / link / PDF,
   abstract, your summary, reading status), and "Search latest" for a topic — which asks free, open scholarly
   services from the browser, only when you click:
     • Crossref (api.crossref.org)   journals and conferences of every publisher; the IEEE tab is Crossref limited
                                     to IEEE's DOI prefix 10.1109                          free, no key
     • DataCite (api.datacite.org)   arXiv preprints (arXiv is run by Cornell University)   free, no key
     • OpenAlex (api.openalex.org)   "Most cited" and "From India" (Indian institutions)    free; a small daily
                                     allowance per internet connection, ten times more with a free OpenAlex key
     • Wikipedia                     a short overview of the topic                          free, no key
   Sites without an open search service (ScienceDaily, Science Reporter, Electronics For You, gov.in, PIB, IITs,
   MIT, Cornell, YouTube, Google Scholar, IEEE Xplore…) are one click away under "Other sites", already searched.
   Nothing is fetched until you press Search latest (or open another results tab), so the diary stays quick.
   Data: ED.store.data.research = { topics: [{ id, name, parentId, q, notes, createdAt, updatedAt }],
          papers: [{ id, topicId, title, authors, year, date, venue, doi, link, pdf, abstract, summary, status, src, cites,
                     addedAt, updatedAt }], key: '' } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const A = (ED.actions = ED.actions || {});
  const F = (ED.forms = ED.forms || {});
  const D = () => ED.store.data;
  const RS = (ED.research = {});
  const R = () => {
    const d = D();
    if (!d.research || typeof d.research !== 'object') d.research = { topics: [], papers: [] };
    if (!Array.isArray(d.research.topics)) d.research.topics = [];
    if (!Array.isArray(d.research.papers)) d.research.papers = [];
    return d.research;
  };
  const st = () => ED.state.rs || (ED.state.rs = { topic: null, sub: null, tab: 'latest', q: '', res: {}, filter: 'all' });
  const FX = () => ED.fx;

  const STATUS = [['toread', 'To read'], ['reading', 'Reading'], ['read', 'Read'], ['cited', 'Cited in my work']];
  const stLabel = s => (STATUS.find(x => x[0] === s) || STATUS[0])[1];
  RS.STATUS = STATUS;

  /* ---------------- topics ---------------- */
  RS.topic = id => R().topics.find(t => t.id === id) || null;
  RS.tops = () => R().topics.filter(t => !t.parentId || !RS.topic(t.parentId)).sort((a, b) => a.name.localeCompare(b.name));
  RS.subs = id => R().topics.filter(t => t.parentId === id).sort((a, b) => a.name.localeCompare(b.name));
  const under = id => [id].concat(RS.subs(id).map(s => s.id));
  RS.papersOf = id => { const ids = new Set(under(id)); return R().papers.filter(p => ids.has(p.topicId)); };
  /* the words searched for a topic or subtopic (a subtopic adds its parent's words, so "Spectrum sensing" under SDR
     looks for spectrum sensing in software-defined radio) */
  RS.words = t => {
    if (!t) return '';
    const own = (t.q || t.name || '').trim();
    const par = t.parentId && RS.topic(t.parentId);
    return par && !t.q ? own + ' ' + (par.q || par.name || '').trim() : own;
  };
  const topicOptions = () => {
    const out = [['', '— No topic —']];
    RS.tops().forEach(t => { out.push([t.id, t.name]); RS.subs(t.id).forEach(s => out.push([s.id, '  ↳ ' + s.name])); });
    return out;
  };

  RS.editTopic = (id, parentId) => {
    const r = R(), x = id ? RS.topic(id) : null;
    const parents = [['', '— None (a main topic) —']].concat(RS.tops().filter(t => !x || t.id !== x.id).map(t => [t.id, t.name]));
    FX().form({
      title: x ? (x.parentId ? 'Subtopic' : 'Topic') : parentId ? 'Add a subtopic' : 'Add a research topic',
      intro: 'A topic (e.g. <b>SDR</b>) can have subtopics (e.g. <b>Spectrum sensing</b>, <b>FPGA implementation</b>). “Search words” are what Search latest looks for — write the full words for short forms (SDR → software defined radio).',
      data: x ? Object.assign({}, x, { parentId: x.parentId || '' }) : { name: '', parentId: parentId || '', q: '', notes: '' },
      fields: [
        { k: 'name', label: 'Name', req: true, ph: 'SDR, Super-resolution, Radiosonde…' },
        { k: 'parentId', label: 'Under', type: 'select', options: parents },
        { k: 'q', label: 'Search words', ph: 'software defined radio', hint: 'Leave empty to search for the name' + (parentId || (x && x.parentId) ? ' (with the main topic’s words).' : '.') },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, ph: 'Why this topic, research questions, gaps you have noticed…' },
      ],
      check: v => v.parentId && RS.subs(x ? x.id : '').length ? 'This topic has subtopics, so it stays a main topic' : '',
      del: x ? async () => {
        const ids = new Set(under(x.id)), n = r.papers.filter(p => ids.has(p.topicId)).length, ns = ids.size - 1;
        const ok = await ED.ui.confirm({ title: 'Delete “' + x.name + '”?', message: 'This deletes the topic' + (ns ? ', its ' + U.plural(ns, 'subtopic') : '') + (n ? ' and the ' + U.plural(n, 'paper') + ' saved under it' : '') + '.', ok: 'Delete', danger: true });
        if (!ok) return false;
        ED.store.checkpoint('Delete topic');
        r.topics = r.topics.filter(t => !ids.has(t.id)); r.papers = r.papers.filter(p => !ids.has(p.topicId));
        const s = st(); if (ids.has(s.topic)) { s.topic = null; s.sub = null; } else if (ids.has(s.sub)) s.sub = null;
        ED.store.commit(); ED.ui.undoToast('Deleted');
      } : null,
      save(v, api) {
        ED.store.checkpoint('Research topic');
        v.parentId = v.parentId || null;
        const s = st();
        if (x) { Object.assign(x, v, { updatedAt: Date.now() }); }
        else {
          const t = Object.assign({ id: U.uid('rt'), createdAt: Date.now(), updatedAt: Date.now() }, v); r.topics.push(t);
          if (t.parentId) { s.topic = t.parentId; s.sub = t.id; } else { s.topic = t.id; s.sub = null; }
          s.q = '';
        }
        ED.store.commit(); api.close();
      },
    });
  };

  /* ---------------- papers ---------------- */
  const doiOf = s => { const m = String(s || '').match(/10\.\d{4,9}\/[^\s"<>]+/); return m ? m[0].replace(/[.,;]$/, '') : ''; };
  const urlOf = p => p.link || (p.doi ? 'https://doi.org/' + p.doi : '');
  const sameAs = (p, x) => (p.doi && x.doi && p.doi.toLowerCase() === x.doi.toLowerCase()) || (p.title && x.title && p.title.trim().toLowerCase() === x.title.trim().toLowerCase());
  RS.saved = x => R().papers.find(p => sameAs(p, x)) || null;

  RS.editPaper = (id, pre) => {
    const r = R(), x = id ? r.papers.find(p => p.id === id) : null;
    const s = st();
    FX().form({
      title: x ? 'Paper' : 'Add a paper', wide: true,
      data: x || Object.assign({ title: '', authors: '', year: new Date().getFullYear(), venue: '', doi: '', link: '', pdf: '', topicId: s.sub || s.topic || '', status: 'toread', abstract: '', summary: '' }, pre || {}),
      fields: [
        { k: 'title', label: 'Title', req: true },
        { k: 'authors', label: 'Authors', ph: 'A. Kumar, B. Singh, …' },
        { k: 'venue', label: 'Journal / conference', ph: 'IEEE Access, ICASSP 2026, arXiv…' },
        { k: 'year', label: 'Year', type: 'number', min: 1900, max: 2100, step: 1 },
        { k: 'doi', label: 'DOI', ph: '10.1109/ACCESS.2026.1234567', hint: 'Paste a DOI or a doi.org link — the title link uses it.' },
        { k: 'link', label: 'Web page', ph: 'https://…' },
        { k: 'pdf', label: 'PDF link', ph: 'Open-access PDF or your Drive copy' },
        { k: 'topicId', label: 'Topic', type: 'select', options: topicOptions },
        { k: 'status', label: 'Status', type: 'select', options: STATUS },
        { k: 'abstract', label: 'Abstract', type: 'textarea', rows: 6 },
        { k: 'summary', label: 'My summary', type: 'textarea', rows: 5, ph: 'Problem · method · data · results · what I can use · gaps' },
      ],
      del: x ? async () => { ED.store.checkpoint('Delete paper'); r.papers = r.papers.filter(p => p.id !== x.id); ED.store.commit(); ED.ui.undoToast('Paper deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint('Paper');
        v.doi = doiOf(v.doi) || doiOf(v.link) || '';
        v.topicId = v.topicId || null;
        if (x) Object.assign(x, v, { updatedAt: Date.now() });
        else r.papers.push(Object.assign({ id: U.uid('rp'), addedAt: Date.now(), updatedAt: Date.now(), src: (pre && pre.src) || 'me' }, pre || {}, v));
        ED.store.commit(); api.close(); ED.ui.toast(x ? 'Saved' : 'Paper added');
      },
    });
  };

  /* ---------------- searching (only on a click) ---------------- */
  const enc = encodeURIComponent;
  const ymd = k => k;
  const strip = s => { if (!s) return ''; try { return new DOMParser().parseFromString(String(s).replace(/<\/?(jats:)?(p|sec|title)[^>]*>/g, ' ').replace(/<[^>]+>/g, ''), 'text/html').body.textContent.replace(/\s+/g, ' ').trim(); } catch (err) { return String(s).replace(/<[^>]+>/g, ''); } };
  const dp = parts => { const p = (parts && parts['date-parts'] && parts['date-parts'][0]) || []; return p[0] ? p[0] + (p[1] ? '-' + U.pad(p[1]) + (p[2] ? '-' + U.pad(p[2]) : '') : '') : ''; };
  const names = (l, f) => (l || []).map(f).filter(Boolean);
  const authorsText = l => l.length > 4 ? l.slice(0, 3).join(', ') + ' et al.' : l.join(', ');
  const getJSON = async (url, opt) => {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, Object.assign({ signal: ctl.signal }, opt || {}));
      if (!r.ok) { const err = new Error('HTTP ' + r.status); err.status = r.status; try { err.body = await r.text(); } catch (x) { /* ignore */ } throw err; }
      return await r.json();
    } finally { clearTimeout(tm); }
  };

  const fromCrossref = it => {
    const doi = it.DOI || '';
    const date = dp(it['published-online'] || it['published-print'] || it.issued || it.created);
    const link = (it.link || []).find(l => /pdf/i.test(l['content-type'] || '') && /^https?:/.test(l.URL || ''));
    return {
      title: strip((it.title || [])[0] || ''), authors: authorsText(names(it.author, a => [a.given, a.family].filter(Boolean).join(' ') || a.name)),
      venue: strip((it['container-title'] || [])[0] || it.publisher || ''), date, year: +String(date).slice(0, 4) || null,
      doi, link: doi ? 'https://doi.org/' + doi : it.URL || '', pdf: link && !/xplorestaging/.test(link.URL) ? link.URL : '', abstract: strip(it.abstract || ''),
      cites: it['is-referenced-by-count'] != null ? it['is-referenced-by-count'] : null, type: (it.type || '').replace(/-/g, ' '),
    };
  };
  const inverted = ix => { if (!ix) return ''; const w = []; Object.keys(ix).forEach(k => ix[k].forEach(i => { w[i] = k; })); return w.filter(x => x != null).join(' '); };
  const fromOpenAlex = it => {
    const doi = String(it.doi || '').replace(/^https?:\/\/doi\.org\//i, '');
    const src = it.primary_location && it.primary_location.source;
    return {
      title: strip(it.display_name || it.title || ''), authors: authorsText(names(it.authorships, a => a.author && a.author.display_name)),
      venue: (src && src.display_name) || '', date: it.publication_date || '', year: it.publication_year || null,
      doi, link: doi ? 'https://doi.org/' + doi : (it.primary_location && it.primary_location.landing_page_url) || it.id || '',
      pdf: (it.open_access && it.open_access.oa_url) || (it.primary_location && it.primary_location.pdf_url) || '', abstract: inverted(it.abstract_inverted_index),
      cites: it.cited_by_count != null ? it.cited_by_count : null, type: it.type || '',
      inst: Array.from(new Set(names([].concat.apply([], (it.authorships || []).map(a => a.institutions || [])), i => i.country_code === 'IN' ? i.display_name : null))).slice(0, 3).join(' · '),
    };
  };
  const fromDataCite = x => {
    const a = x.attributes || {}, doi = a.doi || '';
    const desc = (a.descriptions || []).find(d => d.descriptionType === 'Abstract') || (a.descriptions || [])[0] || {};
    const id = (String(a.url || '').match(/arxiv\.org\/abs\/([^\s?#]+)/) || [])[1];
    return {
      title: strip(((a.titles || [])[0] || {}).title || ''), authors: authorsText(names(a.creators, c => c.givenName ? c.givenName + ' ' + (c.familyName || '') : c.name)),
      venue: 'arXiv preprint', date: String(a.created || a.registered || '').slice(0, 10), year: a.publicationYear || null,
      doi, link: a.url || (doi ? 'https://doi.org/' + doi : ''), pdf: id ? 'https://arxiv.org/pdf/' + id : '', abstract: strip(desc.description || ''), cites: null, type: 'preprint',
    };
  };
  const oaKey = () => { const k = (R().key || '').trim(); return k ? '&api_key=' + enc(k) : ''; };
  const OA = '&select=id,doi,display_name,publication_date,publication_year,authorships,primary_location,open_access,cited_by_count,type,abstract_inverted_index';
  const oaGet = async url => {
    try { return await getJSON(url + OA + oaKey()); }
    catch (err) { if (err.status === 400) return getJSON(url + oaKey()); throw err; }   // in case a field cannot be selected
  };
  const back = n => U.addDays(U.today(), -n);
  const clean = q => q.replace(/[,:|"]/g, ' ').replace(/\s+/g, ' ').trim();
  const newest = l => l.slice().sort((a, b) => String(b.date || b.year || '').localeCompare(String(a.date || a.year || '')));

  /* 1.18.2: several words are looked for as one phrase where the service allows it ("software defined radio"), and every
     result is checked: all your words (with three or more, all but one) in its title or abstract — the rest are set aside */
  const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'with', 'by', 'at', 'from', 'is', 'are', 'about', 'using', 'based']);
  RS.terms = q => String(q || '').toLowerCase().replace(/["()]/g, ' ').split(/[\s\-_/]+/).map(w => w.replace(/[^a-z0-9.+#]/g, '')).filter(w => w && !STOP.has(w));
  const phrase = q => /["()]|\b(OR|AND)\b/.test(q) || RS.terms(q).length < 2 ? q : '"' + q.replace(/\s+/g, ' ').trim() + '"';
  RS.match = (x, q) => {
    const ws = RS.terms(q); if (!ws.length) return true;
    const t = ((x.title || '') + ' ' + (x.abstract || '')).toLowerCase().replace(/[-_/]+/g, ' ');
    const n = ws.filter(w => new RegExp('(^|[^a-z0-9])' + w.replace(/[.+#]/g, '\\$&') + '(s|es)?([^a-z0-9]|$)').test(t)).length;
    return n >= ws.length;                       // every word; papers missing one come next, under “less closely related”
  };
  RS.near = (x, q) => { const ws = RS.terms(q); const t = ((x.title || '') + ' ' + (x.abstract || '')).toLowerCase().replace(/[-_/]+/g, ' '); return ws.filter(w => t.indexOf(w) >= 0).length >= ws.length - 1; };
  /* each tab of results: [label, how to fetch, what it is] */
  const TABS = {
    latest: ['Latest papers', async q => newest((await getJSON('https://api.crossref.org/works?query.bibliographic=' + enc(q) + '&filter=from-pub-date:' + back(365) + ',until-pub-date:' + U.today() + ',type:journal-article,type:proceedings-article,type:posted-content&rows=60&select=DOI,title,author,container-title,issued,published-online,published-print,created,abstract,URL,publisher,type,is-referenced-by-count,link')).message.items.map(fromCrossref)), 'Journals and conferences of every publisher from the last 12 months (Crossref), the newest first.'],
    arxiv: ['Preprints · arXiv', async q => (await getJSON('https://api.datacite.org/dois?query=' + enc('titles.title:' + phrase(q) + ' OR descriptions.description:' + phrase(q)) + '&client-id=arxiv.content&sort=-created&page%5Bsize%5D=20')).data.map(fromDataCite), 'The newest preprints on arXiv (Cornell University), through DataCite — often months before a journal prints them.'],
    ieee: ['IEEE', async q => newest((await getJSON('https://api.crossref.org/works?query.bibliographic=' + enc(q) + '&filter=prefix:10.1109,from-pub-date:' + back(730) + ',until-pub-date:' + U.today() + '&rows=60&select=DOI,title,author,container-title,issued,published-online,published-print,created,abstract,URL,publisher,type,is-referenced-by-count')).message.items.map(fromCrossref)), 'IEEE journals, magazines and conferences from the last two years (Crossref, IEEE DOIs). The title opens IEEE Xplore.'],
    cited: ['Most cited', async q => (await oaGet('https://api.openalex.org/works?search=' + enc(phrase(q)) + '&filter=from_publication_date:' + back(3 * 365) + '&sort=cited_by_count:desc&per-page=20')).results.map(fromOpenAlex), 'The most cited work of the last three years (OpenAlex) — the papers the field is building on.'],
    india: ['From India', async q => newest((await oaGet('https://api.openalex.org/works?search=' + enc(phrase(q)) + '&filter=authorships.institutions.country_code:IN,from_publication_date:' + back(730) + '&per-page=25')).results.map(fromOpenAlex)), 'Recent work with authors at Indian institutions — IITs, IISc, NITs, ISRO, DRDO, CSIR labs, universities (OpenAlex).'],
    overview: ['Overview', null, 'A short introduction from Wikipedia.'],
    sites: ['Other sites', null, ''],
  };
  RS.TABS = TABS;
  const ckey = (q, tab) => tab + '|' + q.toLowerCase();

  const overview = async q => {
    const s = await getJSON('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=' + enc(q));
    const hits = ((s.query || {}).search || []).map(h => h.title);
    if (!hits.length) return { none: true };
    const sum = await getJSON('https://en.wikipedia.org/api/rest_v1/page/summary/' + enc(hits[0].replace(/ /g, '_')));
    return { title: sum.title || hits[0], text: sum.extract || '', url: (sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page) || 'https://en.wikipedia.org/wiki/' + enc(hits[0]), more: hits.slice(1) };
  };

  const why = err => {
    if (!navigator.onLine) return 'You are offline. Connect to the internet and press Search latest again.';
    if (err && err.name === 'AbortError') return 'The service took too long to answer. Try again in a minute.';
    if (err && err.status === 429) return /openalex/i.test(err.body || '') || /budget|api_key/i.test(err.body || '') ? 'OpenAlex’s free daily allowance for your internet connection is used up (it renews at 5:30 AM India time). Add a free OpenAlex key with ⚙ Search settings to get ten times more — or use the other tabs, which need no key.' : 'Too many searches just now — wait a minute and try again.';
    return 'Could not reach the service' + (err && err.status ? ' (' + err.status + ')' : '') + '. Try again, or use “Other sites”.';
  };
  const redraw = () => { if (document.querySelector('.rs')) { ED.app.renderPage('right'); } };
  RS.load = async (q, tab) => {
    const s = st(), k = ckey(q, tab);
    if (!q || !TABS[tab] || tab === 'sites') return;
    if (s.res[k] && (s.res[k].busy || s.res[k].items || s.res[k].ov)) return;
    s.res[k] = { busy: true };
    try {
      if (tab === 'overview') s.res[k] = { ov: await overview(q), at: Date.now() };
      else {
        const l = (await TABS[tab][1](q)).filter(x => x.title), seen = new Set();
        const u = l.filter(x => { const t = x.title.toLowerCase(); if (seen.has(t)) return false; seen.add(t); return true; });
        s.res[k] = { items: u.filter(x => RS.match(x, q)).slice(0, 30), other: u.filter(x => !RS.match(x, q)).sort((a, b) => (RS.near(b, q) ? 1 : 0) - (RS.near(a, q) ? 1 : 0)).slice(0, 20), at: Date.now() };
      }
    } catch (err) { console.warn('[e-diary] research', tab, err); s.res[k] = { err: why(err) }; }
    redraw();
  };
  RS.search = (q, again) => {
    const s = st(); q = clean(q || '');
    if (!q) { ED.ui.toast('Type what to search for'); return; }
    s.q = q; s.shown = q;
    if (again) Object.keys(s.res).forEach(k => { if (k.slice(k.indexOf('|') + 1) === q.toLowerCase()) delete s.res[k]; });
    if (!TABS[s.tab]) s.tab = 'latest';
    const tabs = [s.tab === 'sites' ? 'latest' : s.tab, 'overview'];
    if (s.tab === 'sites') s.tab = 'latest';
    tabs.filter((t, i, a) => a.indexOf(t) === i).forEach(t => RS.load(q, t));
    redraw();
  };

  /* other sites — searched in a new tab (no open search service to ask from here) */
  RS.sites = q => {
    const Q = enc(q), G = s => 'https://www.google.com/search?q=' + enc(q + ' ' + s), y = new Date().getFullYear() - 1;
    return [
      ['📄 Papers & journals', [['Google Scholar', 'https://scholar.google.com/scholar?q=' + Q + '&as_ylo=' + y], ['IEEE Xplore', 'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=' + Q + '&sortType=newest'], ['arXiv · Cornell University', 'https://arxiv.org/search/?query=' + Q + '&searchtype=all&order=-announced_date_first'], ['Semantic Scholar', 'https://www.semanticscholar.org/search?q=' + Q + '&sort=pub-date'], ['ScienceDirect (Elsevier)', 'https://www.sciencedirect.com/search?qs=' + Q], ['Springer', 'https://link.springer.com/search?query=' + Q + '&sortBy=newestFirst'], ['Nature', 'https://www.nature.com/search?q=' + Q + '&order=date_desc'], ['ResearchGate', 'https://www.researchgate.net/search/publication?q=' + Q], ['Hugging Face papers', 'https://huggingface.co/papers?q=' + Q]]],
      ['📰 Science news', [['ScienceDaily', 'https://www.sciencedaily.com/search/?keyword=' + Q], ['Science Reporter (CSIR-NIScPR)', G('site:niscpr.res.in')], ['Electronics For You (EFY)', 'https://www.electronicsforu.com/?s=' + Q], ['IEEE Spectrum', G('site:spectrum.ieee.org')], ['Phys.org', 'https://phys.org/search/?search=' + Q], ['Google News', 'https://news.google.com/search?q=' + Q + '&hl=en-IN&gl=IN&ceid=IN:en']]],
      ['🇮🇳 Government of India', [['gov.in websites', G('site:gov.in')], ['PIB press releases', G('site:pib.gov.in')], ['DST · Vigyan Prasar · India Science', G('site:dst.gov.in OR site:vigyanprasar.gov.in OR site:indiascience.in')], ['DRDO · ISRO · CSIR', G('site:drdo.gov.in OR site:isro.gov.in OR site:csir.res.in')], ['Shodhganga (Indian PhD theses)', G('site:shodhganga.inflibnet.ac.in')]]],
      ['🎓 Universities', [['IIT research', G('site:iitb.ac.in OR site:iitd.ac.in OR site:iitm.ac.in OR site:iitk.ac.in OR site:iitkgp.ac.in OR site:iitr.ac.in OR site:iith.ac.in')], ['IISc', G('site:iisc.ac.in')], ['MIT', G('site:mit.edu')], ['Cornell University', G('site:cornell.edu')], ['Stanford', G('site:stanford.edu')]]],
      ['▶️ Video & courses', [['YouTube', 'https://www.youtube.com/results?search_query=' + Q], ['NPTEL', G('site:nptel.ac.in')], ['MIT OpenCourseWare', G('site:ocw.mit.edu')]]],
    ];
  };

  /* ---------------- the page (Study → Year at a glance → Research papers) ---------------- */
  const cardMeta = x => [x.authors, x.venue, x.date ? (String(x.date).length > 7 ? U.fmtDM(x.date) + ' ' + String(x.date).slice(0, 4) : x.date) : x.year].filter(Boolean).map(v => e(String(v))).join(' · ');
  const extLink = (href, label, cls) => href ? '<a class="' + (cls || 'rs-a') + '" href="' + e(href) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : '';
  const absBlock = (txt, open) => txt ? '<details class="rs-abs"' + (open ? ' open' : '') + '><summary>Abstract</summary><p>' + e(txt) + '</p></details>' : '';

  const resultCard = (x, i, k) => {
    const sv = RS.saved(x);
    return '<article class="rs-card rs-res">' +
      '<h4 class="rs-t">' + (urlOf(x) ? extLink(urlOf(x), e(x.title) + ED.icon('external')) : e(x.title)) + '</h4>' +
      '<div class="rs-meta hint">' + cardMeta(x) + '</div>' +
      '<div class="rs-tags">' + (x.type ? '<span class="rs-tag">' + e(x.type) + '</span>' : '') + (x.cites ? '<span class="rs-tag num">' + U.plural(x.cites, 'citation') + '</span>' : '') + (x.pdf ? extLink(x.pdf, ED.icon('doc') + 'PDF', 'rs-tag rs-pdf') : '') + (x.inst ? '<span class="rs-tag rs-in">' + e(x.inst) + '</span>' : '') + '</div>' +
      absBlock(x.abstract) +
      '<div class="rs-act">' + (sv ? '<button type="button" class="btn small ghost" data-act="rs-paper" data-id="' + e(sv.id) + '">' + ED.icon('check') + 'Saved — open</button>'
        : '<button type="button" class="btn small" data-act="rs-save" data-k="' + e(k) + '" data-i="' + i + '">' + ED.icon('plus') + 'Save to ' + e(saveTo()) + '</button>') + '</div></article>';
  };
  const saveTo = () => { const s = st(), t = RS.topic(s.sub) || RS.topic(s.topic); return t ? t.name : 'my papers'; };

  const paperCard = p => {
    const t = RS.topic(p.topicId);
    return '<article class="rs-card rs-mine rs-st-' + e(p.status || 'toread') + '">' +
      '<div class="rs-hrow"><h4 class="rs-t">' + (urlOf(p) ? extLink(urlOf(p), e(p.title) + ED.icon('external')) : e(p.title)) + '</h4>' +
      '<button type="button" class="rs-stb" data-act="rs-status" data-id="' + e(p.id) + '" title="Change the status">' + e(stLabel(p.status)) + '</button></div>' +
      '<div class="rs-meta hint">' + cardMeta(p) + (t && st().topic !== t.id && st().sub !== t.id ? ' · <span class="rs-tp">' + e(t.name) + '</span>' : '') + '</div>' +
      (p.summary ? '<p class="rs-sum">' + e(p.summary) + '</p>' : '') + absBlock(p.abstract) +
      '<div class="rs-act">' + (p.pdf ? extLink(p.pdf, ED.icon('doc') + 'PDF', 'btn small ghost') : '') +
      '<button type="button" class="btn small ghost" data-act="rs-paper" data-id="' + e(p.id) + '">' + ED.icon('pencil') + (p.summary ? 'Edit' : 'Add my summary') + '</button></div></article>';
  };

  RS.html = () => {
    const r = R(), s = st();
    if (s.topic && !RS.topic(s.topic)) { s.topic = null; s.sub = null; }
    if (s.sub && !RS.topic(s.sub)) s.sub = null;
    const cur = RS.topic(s.sub) || RS.topic(s.topic);
    const tops = RS.tops();
    // topics and subtopics
    const chip = (t, on, act, n) => '<button type="button" class="rs-chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-id="' + e(t ? t.id : '') + '" aria-pressed="' + !!on + '">' + e(t ? t.name : 'All') + (n ? '<span class="num">' + n + '</span>' : '') + '</button>';
    const topicRow = '<div class="rs-topics" role="group" aria-label="Topics">' + chip(null, !s.topic, 'rs-topic', r.papers.length) + tops.map(t => chip(t, s.topic === t.id, 'rs-topic', RS.papersOf(t.id).length)).join('') +
      '<button type="button" class="rs-chip add" data-act="rs-topic-add">' + ED.icon('plus') + 'Topic</button></div>';
    const subs = s.topic ? RS.subs(s.topic) : [];
    const subRow = s.topic ? '<div class="rs-subs" role="group" aria-label="Subtopics"><span class="hint">Subtopics</span>' + (subs.length ? chip(null, !s.sub, 'rs-sub', 0).replace('>All<', '>All of ' + e(RS.topic(s.topic).name) + '<') : '') +
      subs.map(t => chip(t, s.sub === t.id, 'rs-sub', r.papers.filter(p => p.topicId === t.id).length)).join('') +
      '<button type="button" class="rs-chip add sm" data-act="rs-topic-add" data-parent="' + e(s.topic) + '">' + ED.icon('plus') + 'Subtopic</button>' +
      '<button type="button" class="icon-btn sm" data-act="rs-topic-edit" data-id="' + e((cur || {}).id || '') + '" title="Change or delete “' + e(cur ? cur.name : '') + '”" aria-label="Change this topic">' + ED.icon('gear') + '</button></div>' +
      (cur && cur.notes ? '<p class="rs-note hint">' + e(cur.notes) + '</p>' : '') : '';

    // search
    const q = s.q || RS.words(cur) || '';
    const shown = s.shown && s.shown.toLowerCase() === q.toLowerCase() ? s.shown : null;
    const tab = TABS[s.tab] ? s.tab : 'latest';
    let results = '';
    if (shown) {
      const tabsBar = '<div class="rs-tabs" role="tablist">' + Object.keys(TABS).map(k => {
        const c = s.res[ckey(shown, k)];
        const n = c && c.items ? '<span class="num">' + c.items.length + '</span>' : c && c.busy ? '<span class="rs-dot"></span>' : '';
        return '<button type="button" role="tab" data-act="rs-tab" data-k="' + k + '" aria-selected="' + (tab === k) + '">' + e(TABS[k][0]) + n + '</button>';
      }).join('') + '</div>';
      const c = s.res[ckey(shown, tab)];
      let body;
      if (tab === 'sites') {
        body = '<p class="hint">These sites have no open search service the diary can ask, so each link opens the site (or Google, limited to that site) already searched for <b>' + e(shown) + '</b>.</p>' +
          RS.sites(shown).map(g => '<div class="rs-sg"><h5>' + e(g[0]) + '</h5><div class="rs-sl">' + g[1].map(x => extLink(x[1], e(x[0]) + ED.icon('external'), 'rs-site')).join('') + '</div></div>').join('');
      } else if (!c) body = '<div class="rs-empty"><p>Not looked up yet.</p><button type="button" class="btn small primary" data-act="rs-load" data-k="' + tab + '">' + ED.icon('search') + 'Search ' + e(TABS[tab][0]) + '</button></div>';
      else if (c.busy) body = '<div class="rs-empty rs-busy"><span class="rs-spin" aria-hidden="true"></span><p>Searching ' + e(TABS[tab][0]) + '…</p></div>';
      else if (c.err) body = '<div class="rs-empty rs-err"><p>' + e(c.err) + '</p><button type="button" class="btn small" data-act="rs-retry" data-k="' + tab + '">Try again</button></div>';
      else if (tab === 'overview') {
        const o = c.ov || {};
        body = o.none ? '<p class="hint">Wikipedia has no article for this. Try fuller words.</p>' :
          '<article class="rs-card rs-ov"><h4 class="rs-t">' + extLink(o.url, e(o.title) + ED.icon('external')) + '</h4><p>' + e(o.text) + '</p>' + (o.more && o.more.length ? '<p class="hint">Also on Wikipedia: ' + o.more.map(t => extLink('https://en.wikipedia.org/wiki/' + enc(t.replace(/ /g, '_')), e(t))).join(' · ') + '</p>' : '') + '</article>';
      } else {
        const k = ckey(shown, tab);
        const oth = c.other || [];
        body = (c.items.length ? c.items.map((x, i) => resultCard(x, i, k)).join('') : '<p class="hint">No paper with <b>' + e(shown) + '</b> in its title or abstract here. Try fewer or other words, or another tab.</p>') +
          (oth.length ? '<details class="sb-other"><summary>' + U.plural(oth.length, 'less closely related paper') + ' (not every word of “' + e(shown) + '” in the title or abstract)</summary>' + oth.map((x, i) => resultCard(x, 'o' + i, k)).join('') + '</details>' : '');
      }
      results = tabsBar + '<p class="hint rs-what">' + e(TABS[tab][2]) + (c && c.at ? ' Looked up ' + e(U.fmtTime(new Date(c.at).toTimeString().slice(0, 5), D().settings.h12)) + '.' : '') + '</p><div class="rs-results">' + body + '</div>';
    }
    const search = '<section class="rs-search"><form class="rs-form" data-form="rs-search" role="search"><span class="rs-sic" aria-hidden="true">' + ED.icon('search') + '</span>' +
      '<input class="field" id="rs-q" type="search" value="' + e(q) + '" placeholder="' + (cur ? 'Words to search for' : 'Any topic — e.g. software defined radio') + '" aria-label="Search for">' +
      '<button type="submit" class="btn primary">' + ED.icon('search') + 'Search latest</button>' +
      (shown ? '<button type="button" class="icon-btn sm" data-act="rs-again" title="Search again (fresh results)" aria-label="Search again">' + ED.icon('sync') + '</button>' : '') + '</form>' +
      (shown ? '' : '<p class="hint rs-how">Looks up the newest journal and conference papers (all publishers), IEEE, arXiv preprints from Cornell, the most cited work, work from India and an overview — and links to ScienceDaily, Science Reporter, EFY, gov.in, IITs, MIT, YouTube and more. Nothing is fetched until you click.</p>') +
      results + '</section>';

    // my papers
    const list = (s.topic ? (s.sub ? r.papers.filter(p => p.topicId === s.sub) : RS.papersOf(s.topic)) : r.papers).slice();
    const counts = {}; list.forEach(p => { counts[p.status || 'toread'] = (counts[p.status || 'toread'] || 0) + 1; });
    const filt = s.filter && s.filter !== 'all' && counts[s.filter] ? s.filter : 'all';
    const shownP = list.filter(p => filt === 'all' || (p.status || 'toread') === filt).sort((a, b) => (+(b.year || 0) - +(a.year || 0)) || (b.addedAt || 0) - (a.addedAt || 0));
    const fbar = list.length ? '<div class="rs-filt" role="group" aria-label="Show">' + [['all', 'All', list.length]].concat(STATUS.filter(x => counts[x[0]]).map(x => [x[0], x[1], counts[x[0]]])).map(x => '<button type="button" data-act="rs-filter" data-k="' + x[0] + '" aria-pressed="' + (filt === x[0]) + '">' + e(x[1]) + ' <span class="num">' + x[2] + '</span></button>').join('') + '</div>' : '';
    const mine = '<section class="rs-mine-s"><h3 class="gh rs-h">My papers' + (cur ? ' · ' + e(cur.name) : '') + '<span class="grow"></span>' +
      '<button type="button" class="btn small primary" data-act="rs-paper">' + ED.icon('plus') + 'Add a paper</button></h3>' + fbar +
      (shownP.length ? '<div class="rs-list">' + shownP.map(paperCard).join('') + '</div>' : '<div class="rs-empty"><p>' + (list.length ? 'None with this status.' : cur ? 'No papers under ' + e(cur.name) + ' yet — add one, or press Search latest and save what you like.' : 'No papers yet.') + '</p></div>') + '</section>';

    const intro = !tops.length ? '<div class="rs-welcome"><span class="rs-big" aria-hidden="true">🔬</span><div><b>Your research desk</b><p class="hint">Make a topic for each area you follow (e.g. <i>SDR</i>), add subtopics, keep papers with their abstracts and your own summary — and see what is new with one click.</p>' +
      '<button type="button" class="btn small primary" data-act="rs-topic-add">' + ED.icon('plus') + 'Add your first topic</button></div></div>' : '';
    const tools = '<div class="rs-tools"><button type="button" class="btn small ghost" data-act="rs-csv"' + (r.papers.length ? '' : ' disabled') + '>' + ED.icon('download') + 'Export (CSV)</button><button type="button" class="btn small ghost" data-act="rs-settings">' + ED.icon('gear') + 'Search settings</button></div>';
    return '<div class="rs">' + intro + topicRow + subRow + search + mine + tools + '</div>';
  };

  /* ---------------- actions ---------------- */
  const keepQ = () => { const i = document.getElementById('rs-q'); if (i) st().q = i.value; };
  const pick = (topic, sub) => { const s = st(); s.topic = topic; s.sub = sub; s.q = ''; s.filter = 'all'; ED.app.renderPage('right'); };
  A['rs-topic'] = el => pick(el.dataset.id || null, null);
  A['rs-sub'] = el => pick(st().topic, el.dataset.id || null);
  A['rs-topic-add'] = el => RS.editTopic(null, el.dataset.parent || null);
  A['rs-topic-edit'] = el => { if (el.dataset.id) RS.editTopic(el.dataset.id); };
  A['rs-paper'] = el => RS.editPaper(el.dataset.id || null);
  A['rs-filter'] = el => { st().filter = el.dataset.k; keepQ(); ED.app.renderPage('right'); };
  A['rs-tab'] = el => { const s = st(); keepQ(); s.tab = el.dataset.k; if (s.shown) RS.load(s.shown, s.tab); ED.app.renderPage('right'); };
  A['rs-load'] = el => { const s = st(); if (s.shown) RS.load(s.shown, el.dataset.k); ED.app.renderPage('right'); };
  A['rs-retry'] = el => { const s = st(); if (!s.shown) return; delete s.res[ckey(s.shown, el.dataset.k)]; RS.load(s.shown, el.dataset.k); ED.app.renderPage('right'); };
  A['rs-again'] = () => { const i = document.getElementById('rs-q'); RS.search(i ? i.value : st().q, true); };
  F['rs-search'] = f => { const i = f.querySelector('#rs-q'); RS.search(i ? i.value : ''); };
  A['rs-save'] = el => {
    const c = st().res[el.dataset.k], i = String(el.dataset.i), x = c && (i[0] === 'o' ? (c.other || [])[+i.slice(1)] : c.items && c.items[+i]);
    if (!x || RS.saved(x)) return;
    ED.store.checkpoint('Save paper');
    const s = st();
    R().papers.push({ id: U.uid('rp'), topicId: s.sub || s.topic || null, title: x.title, authors: x.authors || '', year: x.year || null, date: x.date || '', venue: x.venue || '', doi: x.doi || '', link: x.link || '', pdf: x.pdf || '', abstract: x.abstract || '', summary: '', status: 'toread', cites: x.cites, src: el.dataset.k.split('|')[0], addedAt: Date.now(), updatedAt: Date.now() });
    keepQ(); ED.store.commit(); ED.ui.toast('Saved to ' + saveTo() + ' — add your summary any time');
  };
  A['rs-status'] = el => {
    const p = R().papers.find(x => x.id === el.dataset.id); if (!p) return;
    ED.ui.menu(el, STATUS.map(x => ({ label: x[1], checked: (p.status || 'toread') === x[0], onClick: () => { ED.store.checkpoint('Paper status'); p.status = x[0]; p.updatedAt = Date.now(); keepQ(); ED.store.commit(); } })));
  };
  A['rs-settings'] = () => {
    const r = R();
    FX().form({
      title: 'Research search settings',
      intro: 'Crossref, DataCite (arXiv) and Wikipedia need no key. OpenAlex (the <b>Most cited</b> and <b>From India</b> tabs) gives each internet connection a small free allowance a day — about 100 searches. A free key from <a href="https://openalex.org" target="_blank" rel="noopener noreferrer">openalex.org</a> (Settings → API key after signing up) gives ten times more. The key is kept in this diary.',
      data: { key: r.key || '' },
      fields: [{ k: 'key', label: 'OpenAlex API key', ph: 'Optional' }],
      save(v, api) { ED.store.checkpoint('Research settings'); r.key = v.key || ''; Object.keys(st().res).forEach(k => { if (/^(cited|india)\|/.test(k)) delete st().res[k]; }); ED.store.commit(); api.close(); },
    });
  };
  A['rs-csv'] = () => {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Topic', 'Subtopic', 'Title', 'Authors', 'Journal / conference', 'Year', 'DOI', 'Link', 'PDF', 'Status', 'My summary', 'Abstract']];
    R().papers.forEach(p => { const t = RS.topic(p.topicId), par = t && t.parentId ? RS.topic(t.parentId) : null; rows.push([par ? par.name : t ? t.name : '', par ? t.name : '', p.title, p.authors, p.venue, p.year, p.doi, urlOf(p), p.pdf, stLabel(p.status), p.summary, p.abstract]); });
    const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'research-papers-' + U.today() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
