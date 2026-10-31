/* E-Diary — Science bits (added in 1.18; Study → Year at a glance → Science bits).
   The latest news on a topic you type (or pick from your research topics and projects), looked up only when you press
   "Get latest bits" — never by itself — so the diary stays quick:
     • Top stories, ScienceDaily & science sites, World universities, Newspapers · science, India (gov.in, IITs, CSIR…)
       — Google News search limited to those sites, read through a public relay (the browser cannot read Google News
       directly): your own reader if you set one up (⚙ — a Google Apps Script under your account), and api.allorigins.win,
       api.rss2json.com and api.codetabs.com together, once more if all fail
     • Tech talk — Hacker News (hn.algolia.com, read directly)
     • Space — Spaceflight News API (read directly)
     • Open on the site — ScienceDaily, EurekAlert!, Nature News, university news pages, newspapers, already searched
   Bits you save are kept with a note (research.bits). Results are kept for the session only. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const A = (ED.actions = ED.actions || {});
  const F = (ED.forms = ED.forms || {});
  const D = () => ED.store.data;
  const SB = (ED.scibits = {});
  const st = () => ED.state.sb || (ED.state.sb = { q: '', tab: 'top', span: 30, res: {} });
  const R = () => { const d = D(); if (!d.research || typeof d.research !== 'object') d.research = { topics: [], papers: [] }; if (!Array.isArray(d.research.bits)) d.research.bits = []; return d.research; };
  const enc = encodeURIComponent;

  const SITES = {
    sci: ['sciencedaily.com', 'phys.org', 'eurekalert.org', 'newscientist.com', 'scientificamerican.com', 'livescience.com', 'nature.com', 'science.org', 'quantamagazine.org', 'spectrum.ieee.org'],
    uni: ['mit.edu', 'stanford.edu', 'harvard.edu', 'caltech.edu', 'berkeley.edu', 'ox.ac.uk', 'cam.ac.uk', 'imperial.ac.uk', 'ethz.ch', 'cornell.edu', 'princeton.edu', 'nus.edu.sg'],
    news: ['nytimes.com', 'theguardian.com', 'bbc.com', 'reuters.com', 'washingtonpost.com', 'economist.com', 'thehindu.com', 'indianexpress.com', 'hindustantimes.com', 'timesofindia.indiatimes.com'],
    india: ['gov.in', 'nic.in', 'ac.in', 'res.in', 'indiascience.in', 'downtoearth.org.in', 'thehindu.com', 'iisc.ac.in'],
  };
  /* the sources of each tab, by name (used when the site search is busy and Top stories is sifted instead) */
  const NAMES = {
    sci: /sciencedaily|science daily|phys\.org|eurekalert|new scientist|scientific american|live ?science|nature|science\.org|\bscience\b|quanta|ieee spectrum/i,
    uni: /\bmit\b|massachusetts institute|stanford|harvard|caltech|berkeley|oxford|cambridge|imperial college|eth z|cornell|princeton|\bnus\b|universit|\biit\b|iisc/i,
    news: /new york times|nytimes|guardian|\bbbc\b|reuters|washington post|economist|the hindu|indian express|hindustan times|times of india/i,
    india: /\bpib\b|press information|gov\.in|\bisro\b|\bdrdo\b|\bcsir\b|\biit\b|iisc|the hindu|down to earth|india science|vigyan|ministry|\bdst\b/i,
  };
  const TABS = [
    ['top', 'Top stories', 'The newest coverage from news sites around the world (Google News).'],
    ['sci', 'ScienceDaily & science', 'ScienceDaily, Phys.org, EurekAlert!, New Scientist, Scientific American, Nature, Science, Quanta, IEEE Spectrum.'],
    ['uni', 'World universities', 'News from MIT, Stanford, Harvard, Caltech, Berkeley, Oxford, Cambridge, Imperial, ETH Zürich, Cornell, Princeton and NUS.'],
    ['news', 'Newspapers · science', 'The New York Times, The Guardian, BBC, Reuters, The Washington Post, The Economist, The Hindu, Indian Express, Hindustan Times, Times of India.'],
    ['india', 'India', 'Government of India sites (gov.in, nic.in), IITs and universities (ac.in), CSIR and research labs (res.in), India Science, Down To Earth.'],
    ['tech', 'Tech talk', 'Stories and discussion on Hacker News, the newest first.'],
    ['space', 'Space', 'Spaceflight News: NASA, ESA, ISRO and space-industry news.'],
    ['sites', 'Open on the site', ''],
  ];
  SB.TABS = TABS;
  const SPANS = [[7, 'Last 7 days'], [30, 'Last 30 days'], [365, 'Last year']];

  /* ---------------- fetching (only from a click) ---------------- */
  const timed = (url, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 15000); return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t)); };
  /* 1.18.2: the relays are asked all at once and the first good answer is used (one after another, a slow or broken
     relay kept you waiting up to 45 s). A relay that is down simply loses the race. */
  const feedText = t => { if (!/<rss|<feed|<item/i.test(t)) throw new Error('not a feed'); return parseRss(t); };
  const RELAYS = [
    ['allorigins', async u => { const r = await timed('https://api.allorigins.win/raw?url=' + enc(u), 14000); if (!r.ok) throw new Error('relay ' + r.status); return feedText(await r.text()); }],
    ['allorigins-json', async u => { const r = await timed('https://api.allorigins.win/get?url=' + enc(u), 14000); if (!r.ok) throw new Error('relay ' + r.status); return feedText((await r.json()).contents || ''); }],
    ['rss2json', async u => {
      const r = await timed('https://api.rss2json.com/v1/api.json?rss_url=' + enc(u), 14000); if (!r.ok) throw new Error('relay ' + r.status);
      const d = await r.json(); if (d.status !== 'ok' || !Array.isArray(d.items)) throw new Error('relay ' + (d.message || 'error'));
      return d.items.map(i => { let title = strip(i.title || ''), source = (i.author || '').trim(); const m = !source && title.match(/^(.*) - ([^-]{2,60})$/); if (m) { title = m[1]; source = m[2]; } const at = Date.parse(String(i.pubDate || '').replace(' ', 'T') + 'Z'); return { title, url: i.link || '', source, site: '', at: isNaN(at) ? 0 : at, text: '' }; });
    }],
    ['codetabs', async u => { const r = await timed('https://api.codetabs.com/v1/proxy/?quest=' + enc(u), 14000); if (!r.ok) throw new Error('relay ' + r.status); return feedText(await r.text()); }],
  ];
  SB.RELAYS = RELAYS;
  /* 1.18.3: your own news reader — a small Google Apps Script under your Google account (free, used only by you, so it
     is not busy or blocked like the shared relays). When it is set it is asked first, with the public relays as backup;
     its answer — even "nothing found" — is trusted. */
  SB.SCRIPT = [
    '// E-Diary news reader — paste into a new Google Apps Script project, then Deploy → New deployment → Web app',
    '// (Execute as: Me · Who has access: Anyone). It only reads Google News search feeds.',
    'function doGet(e) {',
    '  var u = (e && e.parameter && e.parameter.url) || "";',
    '  if (!/^https:\\/\\/news\\.google\\.com\\/rss\\/search\\?/.test(u)) {',
    '    return ContentService.createTextOutput("E-Diary news reader: give ?url= a Google News search feed").setMimeType(ContentService.MimeType.TEXT);',
    '  }',
    '  var r = UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: true });',
    '  return ContentService.createTextOutput(r.getContentText()).setMimeType(ContentService.MimeType.XML);',
    '}',
  ].join('\n');
  const myUrl = () => { const v = String(R().relay || '').trim(); return /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(v) ? v : ''; };
  const MINE = async u => { const r = await timed(myUrl() + (myUrl().indexOf('?') >= 0 ? '&' : '?') + 'url=' + enc(u), 20000); if (!r.ok) throw new Error('my reader ' + r.status); return feedText(await r.text()); };
  /* one round: every relay at once; the first answer with bits wins; an empty answer counts only when no relay has
     anything better; all failing → a second round (these free relays fail now and then and work on the next try) */
  const round = u => new Promise((ok, bad) => {
    const list = (myUrl() ? [['my reader', MINE]] : []).concat(RELAYS);
    let left = list.length, done = false, empty = null, last = null;
    const settle = () => { if (--left > 0 || done) return; done = true; if (empty) ok(empty); else bad(last || new Error('no relay')); };
    list.forEach(([name, f]) => f(u).then(items => {
      if (done) return;
      if (items.length || name === 'my reader') { done = true; SB.lastRelay = name; ok(items); return; }
      if (!empty) { empty = items; SB.lastRelay = name; }
      settle();
    }, err => { last = err; settle(); }));
  });
  const viaRelay = async (u, once) => {
    try { return await round(u); } catch (err) { if (once) throw err; await new Promise(r => setTimeout(r, 1200)); return round(u); }
  };
  const txt = (el, sel) => { const x = el.querySelector(sel); return x ? x.textContent.trim() : ''; };
  const strip = s => { try { return new DOMParser().parseFromString(String(s || ''), 'text/html').body.textContent.replace(/\s+/g, ' ').trim(); } catch (err) { return String(s || '').replace(/<[^>]+>/g, ''); } };
  const parseRss = xml => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return Array.from(doc.querySelectorAll('item')).map(it => {
      const srcEl = it.querySelector('source'), source = srcEl ? srcEl.textContent.trim() : '';
      let title = txt(it, 'title');
      if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
      const d = new Date(txt(it, 'pubDate'));
      return { title, url: txt(it, 'link'), source, site: srcEl ? (srcEl.getAttribute('url') || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '', at: isNaN(d) ? 0 : d.getTime(), text: '' };
    }).filter(x => x.title);
  };
  /* 1.18.1: several words are searched as one phrase ("software defined radio"), not as separate words */
  const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'with', 'by', 'at', 'from', 'is', 'are', 'about']);
  SB.words = q => String(q || '').toLowerCase().replace(/["()]/g, ' ').split(/[\s\-_/]+/).map(w => w.replace(/[^a-z0-9.+#]/g, '')).filter(w => w && !STOP.has(w));
  const phrase = q => /["()]|\b(OR|AND)\b|site:/.test(q) || SB.words(q).length < 2 ? q : '"' + q.replace(/\s+/g, ' ').trim() + '"';
  /* how well a bit matches: all the words in its title (or summary); with three words or more, all but one */
  SB.match = (x, q) => {
    const ws = SB.words(q); if (!ws.length) return true;
    const t = ((x.title || '') + ' ' + (x.text || '')).toLowerCase().replace(/[-_/]+/g, ' ');
    const n = ws.filter(w => new RegExp('(^|[^a-z0-9])' + w.replace(/[.+#]/g, '\\$&') + '(s|es)?([^a-z0-9]|$)').test(t)).length;
    return n >= ws.length;
  };
  const gnews = (q, sites, span) => 'https://news.google.com/rss/search?q=' + enc(phrase(q) + (sites ? ' (' + sites.map(s => 'site:' + s).join(' OR ') + ')' : '') + ' when:' + (span >= 365 ? '1y' : span + 'd')) + '&hl=en-IN&gl=IN&ceid=IN:en';
  SB.gnews = gnews;
  const getJSON = async u => { const r = await timed(u); if (!r.ok) { const er = new Error('HTTP ' + r.status); er.status = r.status; throw er; } return r.json(); };
  const LOAD = {
    rss: async (q, tab, span) => viaRelay(gnews(q, tab === 'top' ? null : SITES[tab], span), tab !== 'top'),   // a site tab falls back to Top stories after one round
    tech: async (q, tab, span) => (await getJSON('https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=30&query=' + enc(q) + '&numericFilters=created_at_i>' + Math.floor((Date.now() - span * 864e5) / 1000))).hits
      .map(h => ({ title: h.title || h.story_title || '', url: h.url || 'https://news.ycombinator.com/item?id=' + h.objectID, source: 'Hacker News' + (h.points ? ' · ' + h.points + ' points' : ''), site: h.url ? String(h.url).replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : 'news.ycombinator.com', at: (h.created_at_i || 0) * 1000, text: '', talk: 'https://news.ycombinator.com/item?id=' + h.objectID })),
    space: async (q, tab, span) => (await getJSON('https://api.spaceflightnewsapi.net/v4/articles/?limit=25&ordering=-published_at&search=' + enc(q) + '&published_at_gte=' + new Date(Date.now() - span * 864e5).toISOString().slice(0, 10))).results
      .map(a => ({ title: a.title, url: a.url, source: a.news_site || '', site: String(a.url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''), at: Date.parse(a.published_at) || 0, text: strip(a.summary || '') })),
  };
  const ck = (q, tab, span) => tab + '|' + span + '|' + q.toLowerCase();
  const why = (err, tab) => {
    if (!navigator.onLine) return 'You are offline. Connect to the internet and press Get latest bits again.';
    if (tab === 'tech' || tab === 'space') return 'Could not reach ' + (tab === 'tech' ? 'Hacker News' : 'Spaceflight News') + (err && err.status ? ' (' + err.status + ')' : '') + '. Try again in a minute.';
    return 'The news relay did not answer just now (these free relays are sometimes busy). Press Try again in a minute — or use “Open on the site”.';
  };
  const redraw = () => { if (document.querySelector('.sb')) ED.app.renderPage('right'); };
  SB.load = async (q, tab, span) => {
    const s = st(), k = ck(q, tab, span);
    if (!q || tab === 'sites' || (s.res[k] && (s.res[k].busy || s.res[k].items))) return;
    s.res[k] = { busy: true };
    try {
      let l, via = '';
      // a site tab also asks for Top stories at the same time (unless already here): if the site search does not get
      // through, the bits from this tab's sources among Top stories are shown at once instead of after another wait
      const tk = ck(q, 'top', span), tc = s.res[tk];
      const topP = NAMES[tab] ? (tc && tc.items ? Promise.resolve(tc.items.concat(tc.other || [])) : LOAD.rss(q, 'top', span)) : null;
      if (topP) topP.catch(() => {});
      try { l = await (tab === 'tech' ? LOAD.tech : tab === 'space' ? LOAD.space : LOAD.rss)(q, tab, span); }
      catch (err) {
        if (!topP) throw err;
        const top = await topP;
        l = top.filter(x => NAMES[tab].test((x.source || '') + ' ' + (x.site || ''))); via = 'top';
      }
      const seen = new Set();
      const from = Date.now() - span * 864e5 - 36e5;     // the period you chose (the news service does not always keep to it)
      const all = l.filter(x => { const t = x.title.toLowerCase(); if (!x.title || seen.has(t)) return false; seen.add(t); return !x.at || x.at >= from; });
      const good = all.filter(x => SB.match(x, q)), other = all.filter(x => !SB.match(x, q));
      s.res[k] = { items: good.sort((a, b) => b.at - a.at).slice(0, 40), other: other.sort((a, b) => b.at - a.at).slice(0, 20), old: l.length - all.length, via, at: Date.now() };
    } catch (err) { console.warn('[e-diary] science bits', tab, err); s.res[k] = { err: why(err, tab) }; }
    redraw();
  };
  SB.search = (q, again) => {
    const s = st(); q = String(q || '').replace(/\s+/g, ' ').trim();
    if (!q) { ED.ui.toast('Type a topic first'); return; }
    s.q = q; s.shown = q;
    if (!TABS.some(x => x[0] === s.tab) || s.tab === 'sites') s.tab = 'top';
    if (again) delete s.res[ck(q, s.tab, s.span)];
    SB.load(q, s.tab, s.span);
    redraw();
  };

  /* ---------------- the page ---------------- */
  const ago = ms => { if (!ms) return ''; const m = Math.round((Date.now() - ms) / 6e4); return m < 60 ? Math.max(1, m) + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : m < 2 * 1440 ? 'yesterday' : Math.round(m / 1440) + ' days ago'; };
  const ext = (href, html, cls) => '<a class="' + (cls || '') + '" href="' + e(href) + '" target="_blank" rel="noopener noreferrer">' + html + '</a>';
  const savedOf = x => R().bits.find(b => b.url === x.url || b.title.toLowerCase() === x.title.toLowerCase());
  const card = (x, i, k) => {
    const sv = savedOf(x);
    return '<article class="sb-bit"><div class="sb-src"><span class="sb-fav" aria-hidden="true">' + e((x.source || x.site || '?').trim().charAt(0).toUpperCase()) + '</span><span class="grow"><b>' + e(x.source || x.site) + '</b>' + (x.site && x.source && x.source.indexOf(x.site) < 0 ? ' <span class="hint">' + e(x.site) + '</span>' : '') + '</span><span class="hint num">' + e(ago(x.at)) + '</span></div>' +
      '<h4 class="sb-t">' + ext(x.url, e(x.title) + ED.icon('external')) + '</h4>' + (x.text ? '<p class="sb-x">' + e(x.text.slice(0, 260)) + (x.text.length > 260 ? '…' : '') + '</p>' : '') +
      '<div class="sb-act">' + (x.talk && x.talk !== x.url ? ext(x.talk, ED.icon('chat') + 'Discussion', 'btn small ghost') : '') +
      (sv ? '<span class="hint">' + ED.icon('check') + ' Saved</span>' : '<button type="button" class="btn small" data-act="sb-save" data-k="' + e(k) + '" data-i="' + i + '">' + ED.icon('plus') + 'Save</button>') + '</div></article>';
  };
  SB.sites = q => {
    const Q = enc(q), G = s => 'https://www.google.com/search?tbm=nws&q=' + enc(q + ' ' + s);
    return [['ScienceDaily', 'https://www.sciencedaily.com/search/?keyword=' + Q], ['EurekAlert! (university press releases)', 'https://www.eurekalert.org/news-releases/browse?keywords=' + Q], ['Phys.org', 'https://phys.org/search/?search=' + Q], ['Nature News', 'https://www.nature.com/search?q=' + Q + '&article_type=news&order=date_desc'], ['Science (AAAS) News', G('site:science.org')], ['New Scientist', 'https://www.newscientist.com/search/?q=' + Q], ['Scientific American', G('site:scientificamerican.com')],
      ['MIT News', G('site:news.mit.edu')], ['Stanford News', G('site:news.stanford.edu')], ['Harvard Gazette', G('site:news.harvard.edu')], ['Oxford', G('site:ox.ac.uk')], ['Cambridge', G('site:cam.ac.uk')], ['ETH Zürich', G('site:ethz.ch')], ['IISc & IITs', G('site:iisc.ac.in OR site:iitb.ac.in OR site:iitd.ac.in OR site:iitm.ac.in OR site:iitk.ac.in')],
      ['The Hindu · Sci-Tech', G('site:thehindu.com')], ['Indian Express · Science', G('site:indianexpress.com')], ['NYT Science', G('site:nytimes.com')], ['The Guardian · Science', 'https://www.theguardian.com/science'], ['BBC Science', G('site:bbc.com')], ['Reuters Science', G('site:reuters.com')],
      ['PIB (Government of India)', G('site:pib.gov.in')], ['India Science Wire', G('site:indiascience.in OR site:vigyanprasar.gov.in')], ['Science Reporter (CSIR-NIScPR)', G('site:niscpr.res.in')], ['Google News', 'https://news.google.com/search?q=' + Q + '&hl=en-IN&gl=IN&ceid=IN:en'], ['YouTube', 'https://www.youtube.com/results?search_query=' + Q + '&sp=CAI%253D']];
  };

  SB.html = () => {
    const s = st(), r = R();
    const tab = TABS.some(x => x[0] === s.tab) ? s.tab : 'top';
    const q = s.q || '';
    const picks = [];
    (r.topics || []).filter(t => !t.parentId).forEach(t => picks.push([(t.q || t.name), t.name, '🔬']));
    ((D().projects && D().projects.list) || []).filter(p => p.status !== 'dropped' && p.status !== 'done').forEach(p => picks.push([(p.keywords || p.name), p.name, '🧪']));
    const chips = picks.length ? '<div class="sb-picks"><span class="hint">Your topics</span>' + picks.map(x => '<button type="button" class="rs-chip sm' + (q.toLowerCase() === x[0].toLowerCase() ? ' on' : '') + '" data-act="sb-pick" data-q="' + e(x[0]) + '">' + x[2] + ' ' + e(x[1]) + '</button>').join('') + '</div>' : '';
    const shown = s.shown && s.shown.toLowerCase() === q.toLowerCase() ? s.shown : null;
    let results = '';
    if (shown) {
      const bar = '<div class="rs-tabs" role="tablist">' + TABS.map(x => { const c = s.res[ck(shown, x[0], s.span)]; return '<button type="button" role="tab" data-act="sb-tab" data-k="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + e(x[1]) + (c && c.items ? '<span class="num">' + c.items.length + '</span>' : c && c.busy ? '<span class="rs-dot"></span>' : '') + '</button>'; }).join('') + '</div>';
      const c = s.res[ck(shown, tab, s.span)];
      let body;
      if (tab === 'sites') body = '<p class="hint">Each opens the site, or Google News limited to it, already searched for <b>' + e(shown) + '</b>.</p><div class="rs-sl">' + SB.sites(shown).map(x => ext(x[1], e(x[0]) + ED.icon('external'), 'rs-site')).join('') + '</div>';
      else if (!c) body = '<div class="rs-empty"><p>Not looked up yet.</p><button type="button" class="btn small primary" data-act="sb-load" data-k="' + tab + '">' + ED.icon('sparkle') + 'Get ' + e(TABS.find(x => x[0] === tab)[1]) + '</button></div>';
      else if (c.busy) body = '<div class="rs-empty rs-busy"><span class="rs-spin" aria-hidden="true"></span><p>Gathering the latest…</p><p class="hint">Usually a few seconds. If a relay is busy the diary asks again by itself.</p></div>';
      else if (c.err) body = '<div class="rs-empty rs-err"><p>' + e(c.err) + '</p><button type="button" class="btn small" data-act="sb-retry" data-k="' + tab + '">Try again</button> <button type="button" class="btn small ghost" data-act="sb-tab" data-k="sites">Open on the site</button>' + (myUrl() ? '' : '<p class="hint sb-tip">' + ED.icon('info') + ' The shared free relays are often busy. <button type="button" class="link-btn" data-act="sb-settings">Set up your own news reader</button> — free, about 3 minutes, and it makes these searches dependable.</p>') + '</div>';
      else {
        const k = ck(shown, tab, s.span), oth = c.other || [];
        body = (c.items.length ? '<div class="sb-grid">' + c.items.map((x, i) => card(x, i, k)).join('') + '</div>' : '<p class="hint">Nothing on <b>' + e(shown) + '</b> in ' + e((SPANS.find(x => x[0] === +s.span) || SPANS[1])[1].toLowerCase()) + '. Try a longer period, or another tab.</p>') +
          (oth.length ? '<details class="sb-other"' + (s.showOther ? ' open' : '') + '><summary data-act="sb-other">' + U.plural(oth.length, 'less closely related bit') + ' (not every word of “' + e(shown) + '” in the title)</summary><div class="sb-grid">' + oth.map((x, i) => card(x, 'o' + i, k)).join('') + '</div></details>' : '');
      }
      const info = ((TABS.find(x => x[0] === tab) || [])[2] || '') + (c && c.via === 'top' ? ' The site search was busy, so these are the bits from these sources among Top stories — press ↻ to try the full site search again.' : '');
      results = bar + (info ? '<p class="hint rs-what">' + e(info) + (c && c.at ? ' Looked up ' + e(ago(c.at)) + '.' : '') + '</p>' : '') + body;
    }
    const form = '<section class="rs-search sb-search"><form class="rs-form" data-form="sb-search" role="search"><span class="rs-sic" aria-hidden="true">' + ED.icon('sparkle') + '</span>' +
      '<input class="field" id="sb-q" type="search" value="' + e(q) + '" placeholder="A topic — e.g. stratospheric balloons, quantum sensing" aria-label="Topic">' +
      '<select class="field sb-span" id="sb-span" data-change="sb-span" aria-label="Period">' + SPANS.map(x => '<option value="' + x[0] + '"' + (+s.span === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select>' +
      '<button type="submit" class="btn primary">' + ED.icon('sparkle') + 'Get latest bits</button>' + (shown ? '<button type="button" class="icon-btn sm" data-act="sb-again" title="Look again" aria-label="Look again">' + ED.icon('sync') + '</button>' : '') + '<button type="button" class="icon-btn sm" data-act="sb-settings" title="News reader settings' + (myUrl() ? ' (your own reader is on)' : '') + '" aria-label="News reader settings">' + ED.icon('gear') + '</button></form>' + chips +
      (shown ? '' : '<p class="hint rs-how">Fresh news and short reads on your topic from ScienceDaily and other science sites, the world’s top universities, the science pages of leading newspapers, Indian government and institute sites, Hacker News and space news. Nothing is fetched until you click.</p>') + results + '</section>';
    const saved = r.bits.slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    const mine = '<section><h3 class="gh rs-h">Saved bits <span class="hint num">· ' + saved.length + '</span></h3>' + (saved.length ? '<ul class="sb-saved">' + saved.map(b => '<li><span class="grow">' + ext(b.url, e(b.title)) + '<span class="hint">' + e([b.source, b.date ? U.fmtShort(b.date) : '', b.q ? 'on “' + b.q + '”' : ''].filter(Boolean).join(' · ')) + '</span>' + (b.note ? '<span class="sb-note">' + e(b.note) + '</span>' : '') + '</span>' +
      '<button type="button" class="icon-btn sm" data-act="sb-note" data-id="' + e(b.id) + '" title="Add a note" aria-label="Note">' + ED.icon('pencil') + '</button><button type="button" class="icon-btn sm" data-act="sb-del" data-id="' + e(b.id) + '" title="Remove" aria-label="Remove">' + ED.icon('x') + '</button></li>').join('') + '</ul>' : '<p class="hint">Save a bit to keep it here with your note.</p>') + '</section>';
    return '<div class="rs sb">' + form + mine + '</div>';
  };

  /* ---------------- actions ---------------- */
  const keep = () => { const i = document.getElementById('sb-q'); if (i) st().q = i.value; const sp = document.getElementById('sb-span'); if (sp) st().span = +sp.value; };
  F['sb-search'] = f => { keep(); SB.search(f.querySelector('#sb-q').value); };
  A['sb-other'] = () => { st().showOther = !st().showOther; };
  // changing the period looks again at once (results are kept per period, so going back is instant)
  (ED.changes = ED.changes || {})['sb-span'] = el => { keep(); const s = st(); s.span = +el.value; if (s.shown && s.tab !== 'sites') SB.load(s.shown, s.tab, s.span); ED.app.renderPage('right'); };
  A['sb-again'] = () => { keep(); SB.search(st().q, true); };
  A['sb-pick'] = el => { keep(); st().q = el.dataset.q; ED.app.renderPage('right'); const i = document.getElementById('sb-q'); if (i) i.focus(); };
  A['sb-tab'] = el => { keep(); const s = st(); s.tab = el.dataset.k; if (s.shown) SB.load(s.shown, s.tab, s.span); ED.app.renderPage('right'); };
  A['sb-load'] = el => { keep(); const s = st(); if (s.shown) SB.load(s.shown, el.dataset.k, s.span); ED.app.renderPage('right'); };
  A['sb-retry'] = el => { keep(); const s = st(); if (!s.shown) return; delete s.res[ck(s.shown, el.dataset.k, s.span)]; SB.load(s.shown, el.dataset.k, s.span); ED.app.renderPage('right'); };
  A['sb-save'] = el => {
    const c = st().res[el.dataset.k], i = String(el.dataset.i), x = c && (i[0] === 'o' ? (c.other || [])[+i.slice(1)] : c.items && c.items[+i]); if (!x || savedOf(x)) return;
    keep(); ED.store.checkpoint('Save bit');
    R().bits.push({ id: U.uid('sb'), title: x.title, url: x.url, source: x.source || x.site, date: x.at ? U.key(new Date(x.at)) : '', q: st().shown || '', note: '', savedAt: Date.now(), updatedAt: Date.now() });
    ED.store.commit(); ED.ui.toast('Saved — add a note with ✎ under Saved bits');
  };
  A['sb-note'] = async el => {
    const b = R().bits.find(x => x.id === el.dataset.id); if (!b) return;
    const v = await ED.ui.prompt({ title: 'Note', label: b.title, multiline: true, value: b.note || '', ok: 'Save' }); if (v == null) return;
    keep(); ED.store.checkpoint('Bit note'); b.note = v.trim(); b.updatedAt = Date.now(); ED.store.commit();
  };
  A['sb-settings'] = () => {
    const r = R();
    ED.ui.modal({
      title: 'Your own news reader', cls: 'st-modal wide',
      body: '<div class="sb-set"><p>Web pages are not allowed to read Google News directly, so Science bits goes through a reader. The free shared ones are often busy or blocked. Your own reader runs under your Google account — free, private to you, and dependable. It takes about 3 minutes once; the address is kept in the diary and works on all your devices.</p>' +
        '<ol class="sb-steps"><li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">script.google.com → New project</a> (signed in to your Google account).</li>' +
        '<li>Delete what is in the editor and paste the script below (<b>Copy the script</b>). Click 💾 Save.</li>' +
        '<li><b>Deploy → New deployment</b> → ⚙ Select type: <b>Web app</b>. Execute as: <b>Me</b>. Who has access: <b>Anyone</b>. Click <b>Deploy</b>, then <b>Authorize access</b> and allow it (Google shows “unverified app” for your own scripts: Advanced → Go to … (unsafe) — it is your own script).</li>' +
        '<li>Copy the <b>Web app URL</b> (it ends in <code>/exec</code>), paste it below and press <b>Test and save</b>.</li></ol>' +
        '<pre class="sb-code">' + e(SB.SCRIPT) + '</pre><div class="row-btns"><button type="button" class="btn small" data-x="copy">' + ED.icon('copy') + 'Copy the script</button></div>' +
        '<label class="lbl" for="sb-relay">Web app URL</label><input class="field" id="sb-relay" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + e(r.relay || '') + '">' +
        '<p class="hint sb-test" id="sb-test">' + (myUrl() ? 'Your own reader is on.' : 'Not set — the shared relays are used.') + '</p></div>',
      footer: (r.relay ? '<button type="button" class="btn danger" data-x="off">Stop using it</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-mclose>Close</button><button type="button" class="btn primary" data-x="save">Test and save</button>',
      onMount(el, api) {
        el.querySelector('[data-x="copy"]').addEventListener('click', async () => { ED.ui.toast(await U.copy(SB.SCRIPT) ? 'Script copied — paste it into the Apps Script editor' : 'Could not copy — select the text and copy it'); });
        const off = el.querySelector('[data-x="off"]');
        if (off) off.addEventListener('click', () => { ED.store.checkpoint('News reader'); delete r.relay; ED.store.commit(); api.close(); ED.ui.toast('Back to the shared relays'); });
        el.querySelector('[data-x="save"]').addEventListener('click', async () => {
          const v = el.querySelector('#sb-relay').value.trim(), out = el.querySelector('#sb-test');
          if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(v)) { out.textContent = 'That is not an Apps Script web app address — it starts with https://script.google.com/macros/s/ and ends in /exec.'; return; }
          out.textContent = 'Testing…';
          try {
            const res = await timed(v + (v.indexOf('?') >= 0 ? '&' : '?') + 'url=' + enc(gnews('ISRO', null, 30)), 25000);
            const items = feedText(await res.text());
            ED.store.checkpoint('News reader'); r.relay = v; ED.store.commit();
            Object.keys(st().res).forEach(k => { if (st().res[k].err) delete st().res[k]; });
            out.textContent = 'Works — ' + U.plural(items.length, 'news item') + ' on ISRO in the last 30 days. Saved; Science bits now uses your own reader.';
            setTimeout(() => api.close(), 1800);
          } catch (err) { out.textContent = 'Did not work yet (' + (err.message || err) + '). Check that “Who has access” is Anyone and that you copied the /exec address of the deployment, then try again.'; }
        });
      },
    });
  };
  A['sb-del'] = el => { keep(); ED.store.checkpoint('Remove bit'); R().bits = R().bits.filter(x => x.id !== el.dataset.id); ED.store.commit(); ED.ui.undoToast('Removed'); };
})();
