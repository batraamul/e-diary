/* E-Diary — 1.22: Watch list (Notes & Life → Watch list).
   Web series, TV serials, films, documentaries, shows, sport, podcasts, YouTube, plays and concerts, books and games —
   what to watch, what you are watching (season and episode, one click for the next episode), what you finished and
   how you liked it. A serial that airs at a fixed time can go into the Daily tasks on its days (task tk-wl-<id>).
   Left page:  quick add, filters, the list as poster cards.
   Right page: watching now, airing times, figures (hours watched, by kind, by platform), favourites, who recommended what.
   Data: ED.store.data.lists.watch = [ { id, title, kind, platform, genre, lang, status: want|watching|paused|done|dropped,
          season, seasons, ep, eps, mins, cnt (episodes watched in all), rating 1–5, by, pic, link, notes,
          days: [0..6], time, inPlan, addedAt, startedOn, doneOn, updatedAt } ] */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const FX = () => ED.fx;
  const A = (ED.actions = ED.actions || {}), CH = (ED.changes = ED.changes || {}), F = (ED.forms = ED.forms || {});
  const WL = (ED.watch = {});
  const KINDS = [['series', 'Web series', '📺', 45], ['serial', 'TV serial', '📡', 22], ['movie', 'Film', '🎬', 130], ['docu', 'Documentary', '🎞️', 60], ['show', 'Show / talk / reality', '🎤', 45],
    ['sports', 'Sport', '🏏', 180], ['podcast', 'Podcast', '🎧', 45], ['youtube', 'YouTube / video', '▶️', 20], ['event', 'Play / concert / event', '🎭', 150], ['book', 'Book / audiobook', '📚', 0], ['game', 'Game', '🎮', 0]];
  const PLATFORMS = ['Netflix', 'Prime Video', 'JioHotstar', 'SonyLIV', 'ZEE5', 'YouTube', 'Apple TV+', 'MX Player', 'Doordarshan / TV', 'TV channel', 'Cinema', 'Spotify', 'Audible', 'Kindle', 'Theatre / venue'];
  const STATUS = [['watching', 'Watching', '▶️'], ['want', 'To watch', '🔖'], ['paused', 'Paused', '⏸️'], ['done', 'Finished', '✅'], ['dropped', 'Dropped', '🚫']];
  WL.KINDS = KINDS;
  const kind = id => KINDS.find(k => k[0] === id) || KINDS[0];
  const stat = id => STATUS.find(s => s[0] === id) || STATUS[1];
  const eps = k => ['series', 'serial', 'show', 'docu', 'podcast', 'youtube', 'anime'].indexOf(k) >= 0;
  const LW = () => { const d = ED.store.data; if (!d.lists || typeof d.lists !== 'object') d.lists = {}; if (!Array.isArray(d.lists.watch)) d.lists.watch = []; return d.lists.watch; };
  const st = () => ED.state.wl || (ED.state.wl = { f: 'active', kind: 'all', sel: null });
  const verb = k => k === 'book' ? 'read' : k === 'game' ? 'play' : k === 'podcast' ? 'listen' : 'watch';
  const prog = x => {
    if (!eps(x.kind)) return '';
    const s = x.season || 1, n = x.ep || 0;
    return (x.seasons > 1 || s > 1 ? 'S' + s + ' ' : '') + 'E' + n + (x.eps ? ' / ' + x.eps : '');
  };
  const mins = x => +x.mins || kind(x.kind)[3];
  WL.hours = x => eps(x.kind) ? (x.cnt || 0) * mins(x) / 60 : x.status === 'done' ? mins(x) / 60 : 0;
  const stars = (x, act) => '<span class="wl-stars" role="group" aria-label="Rating">' + [1, 2, 3, 4, 5].map(n => '<button type="button" class="wl-star' + ((x.rating || 0) >= n ? ' on' : '') + '"' + (act ? ' data-act="wl-rate" data-id="' + e(x.id) + '" data-n="' + n + '"' : ' tabindex="-1"') + ' aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '">★</button>').join('') + '</span>';
  const order = (a, b) => STATUS.findIndex(s => s[0] === a.status) - STATUS.findIndex(s => s[0] === b.status) || (b.updatedAt || 0) - (a.updatedAt || 0);

  /* ---------------- left page ---------------- */
  WL.left = head => {
    const s = st(), all = LW();
    const n = id => all.filter(x => (x.status || 'want') === id).length;
    const segs = [['active', '▶️ Watching ' + n('watching')], ['want', '🔖 To watch ' + n('want')], ['done', '✅ Finished ' + n('done')], ['all', 'All ' + all.length]];
    const list = all.filter(x => (s.f === 'all' || (s.f === 'active' ? x.status === 'watching' || x.status === 'paused' : x.status === s.f)) && (s.kind === 'all' || x.kind === s.kind)).sort(order);
    const usedK = KINDS.filter(k => all.some(x => x.kind === k[0]));
    const add = '<form class="wl-add" data-form="wl-add"><input name="title" class="field" placeholder="Add something to watch — a series, serial, film, match…" autocomplete="off" aria-label="Title" required>' +
      '<select name="kind" class="field" aria-label="Kind">' + KINDS.map(k => FX().opt(k[0], k[2] + ' ' + k[1], k[0] === 'series')).join('') + '</select>' +
      '<input name="platform" class="field" list="wl-plats" placeholder="Where" aria-label="Where to watch"><datalist id="wl-plats">' + PLATFORMS.map(p => '<option value="' + e(p) + '">').join('') + '</datalist>' +
      '<button type="submit" class="btn small primary">' + ED.icon('plus') + 'Add</button></form>';
    const cards = list.map(x => {
      const k = kind(x.kind), pr = prog(x);
      return '<div class="wl-card s-' + (x.status || 'want') + (s.sel === x.id ? ' sel' : '') + '"><button type="button" class="wl-poster" data-act="wl-edit" data-id="' + e(x.id) + '" aria-label="Open ' + e(x.title) + '"' + (x.pic ? ' style="background-image:url(&quot;' + e(x.pic) + '&quot;)"' : '') + '>' + (x.pic ? '' : '<span aria-hidden="true">' + k[2] + '</span>') + '</button>' +
        '<div class="wl-body"><button type="button" class="plain-btn wl-t" data-act="wl-edit" data-id="' + e(x.id) + '"><b>' + e(x.title) + '</b></button>' +
        '<span class="wl-meta"><span class="wl-chip">' + k[2] + ' ' + e(k[1]) + '</span>' + (x.platform ? '<span class="wl-chip p">' + e(x.platform) + '</span>' : '') + (x.lang ? '<span class="hint">' + e(x.lang) + '</span>' : '') + '</span>' +
        (pr ? '<span class="wl-prog"><span class="num">' + e(pr) + '</span>' + (x.eps ? '<i class="wl-pbar"><i style="width:' + Math.min(100, Math.round((x.ep || 0) / x.eps * 100)) + '%"></i></i>' : '') + '</span>' : '') +
        (x.status === 'done' || x.rating ? stars(x, true) : x.by ? '<span class="hint">suggested by ' + e(x.by) + '</span>' : '') +
        (x.days && x.days.length && x.time ? '<span class="hint wl-airs">📡 ' + e(x.days.length === 7 ? 'Daily' : x.days.map(d => U.DAY3[d]).join(' ')) + ' ' + e(FX().time(x.time)) + (x.inPlan ? ' · in Daily tasks' : '') + '</span>' : '') + '</div>' +
        '<div class="wl-acts">' + (eps(x.kind) && x.status !== 'done' && x.status !== 'dropped' ? '<button type="button" class="btn small wl-next" data-act="wl-next" data-id="' + e(x.id) + '" title="I ' + verb(x.kind) + 'ed the next episode">+1 ep</button>' : '') +
        (x.status === 'want' ? '<button type="button" class="btn small ghost" data-act="wl-st" data-id="' + e(x.id) + '" data-k="watching">Start</button>' : x.status === 'watching' || x.status === 'paused' ? '<button type="button" class="btn small ghost" data-act="wl-st" data-id="' + e(x.id) + '" data-k="done">' + ED.icon('check') + 'Finished</button>' : '') +
        (x.link ? '<a class="icon-btn sm" href="' + e(x.link) + '" target="_blank" rel="noopener noreferrer" aria-label="Open the link" title="Open">' + ED.icon('external') + '</a>' : '') + '</div></div>';
    }).join('');
    const body = add + '<div class="wl-filt">' + '<div class="seg wl-seg" role="group" aria-label="Show">' + segs.map(x => '<button type="button" data-act="wl-f" data-k="' + x[0] + '" aria-pressed="' + (s.f === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>' +
      (usedK.length > 1 ? '<select class="field wl-ksel" data-change="wl-kind" aria-label="Kind"><option value="all">Every kind</option>' + usedK.map(k => FX().opt(k[0], k[2] + ' ' + k[1], s.kind === k[0])).join('') + '</select>' : '') + '</div>' +
      (cards ? '<div class="wl-list">' + cards + '</div>' : all.length ? '<p class="hint">Nothing here — try another filter.</p>' : '<div class="empty">🍿<div><b>Your watch list is empty.</b><br>Add the series a friend suggested, the serial at 9 pm, a film for the weekend or a match to catch.</div></div>');
    return '<div class="career ls wl">' + head + '<div class="ls-scroll scroll" data-keep-scroll="wl-l">' + body + '</div></div>';
  };

  /* ---------------- right page ---------------- */
  WL.right = () => {
    const all = LW(), C = ED.charts, y = U.today().slice(0, 4);
    if (!all.length) return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">Watch summary</h2></div><p class="hint">Your figures appear here: what you are watching, hours watched, favourite platforms and the best of the year.</p></div>';
    const watching = all.filter(x => x.status === 'watching').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const doneY = all.filter(x => x.status === 'done' && String(x.doneOn || '').slice(0, 4) === y);
    const hrs = all.reduce((a, x) => a + WL.hours(x), 0);
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('Watching', String(watching.length), all.filter(x => x.status === 'paused').length + ' paused') + FX().tile('To watch', String(all.filter(x => x.status === 'want').length), 'on the list') +
      FX().tile('Finished in ' + y, String(doneY.length), doneY.length ? 'avg ' + (Math.round(doneY.filter(x => x.rating).reduce((a, x) => a + x.rating, 0) / Math.max(1, doneY.filter(x => x.rating).length) * 10) / 10 || '—') + ' ★' : '') +
      FX().tile('Time watched', Math.round(hrs) + ' h', 'about, from episodes and films') + '</div>';
    const now = watching.length ? '<h3 class="gh fin-gap">Watching now</h3><ul class="wl-now">' + watching.slice(0, 8).map(x => '<li><span aria-hidden="true">' + kind(x.kind)[2] + '</span><b>' + e(x.title) + '</b><span class="num hint">' + e(prog(x)) + '</span>' + (eps(x.kind) ? '<button type="button" class="btn small" data-act="wl-next" data-id="' + e(x.id) + '">+1 ep</button>' : '') + '</li>').join('') + '</ul>' : '';
    const air = all.filter(x => x.days && x.days.length && x.time && x.status !== 'done' && x.status !== 'dropped').sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const airs = air.length ? '<h3 class="gh fin-gap">On air</h3><ul class="wl-air">' + air.map(x => '<li><span class="num">' + e(FX().time(x.time)) + '</span><b>' + e(x.title) + '</b><span class="hint">' + e((x.days.length === 7 ? 'Daily' : x.days.map(d => U.DAY3[d]).join(' ')) + (x.platform ? ' · ' + x.platform : '')) + '</span>' +
      '<label class="switch sm" title="Put it in the Daily tasks on these days"><input type="checkbox" data-change="wl-plan" data-id="' + e(x.id) + '"' + (x.inPlan ? ' checked' : '') + '><span class="track"></span><span>Daily tasks</span></label></li>').join('') + '</ul>' : '';
    const byK = KINDS.map(k => ({ k, n: all.filter(x => x.kind === k[0]).length, h: all.filter(x => x.kind === k[0]).reduce((a, x) => a + WL.hours(x), 0) })).filter(r => r.n);
    const kinds = C.meters({ title: 'By kind', rows: byK.map(r => ({ label: r.k[2] + ' ' + r.k[1], value: r.n, color: 'var(--s5)', valueLabel: r.n + (r.h >= 1 ? ' · ' + Math.round(r.h) + ' h' : ''), tip: U.plural(r.n, 'title') })), max: Math.max(...byK.map(r => r.n)) });
    const pl = {}; all.forEach(x => { if (x.platform) pl[x.platform] = (pl[x.platform] || 0) + 1; });
    const plats = Object.keys(pl).length ? C.meters({ title: 'Where you watch', rows: Object.keys(pl).sort((a, b) => pl[b] - pl[a]).slice(0, 8).map(p => ({ label: p, value: pl[p], color: 'var(--s1)', valueLabel: String(pl[p]), tip: U.plural(pl[p], 'title') })) }) : '';
    const fav = all.filter(x => x.rating >= 4).sort((a, b) => b.rating - a.rating || String(b.doneOn || '').localeCompare(String(a.doneOn || ''))).slice(0, 8);
    const favs = fav.length ? '<h3 class="gh fin-gap">Favourites</h3><ul class="wl-fav">' + fav.map(x => '<li>' + stars(x) + '<b>' + e(x.title) + '</b><span class="hint">' + e(kind(x.kind)[1] + (x.doneOn ? ' · ' + U.fmtShort(x.doneOn) : '')) + '</span></li>').join('') + '</ul>' : '';
    const by = {}; all.forEach(x => { if (x.by) (by[x.by] = by[x.by] || []).push(x); });
    const recs = Object.keys(by).length ? '<h3 class="gh fin-gap">Suggested by</h3><ul class="wl-by">' + Object.keys(by).sort((a, b) => by[b].length - by[a].length).map(p => '<li><b>' + e(p) + '</b><span class="hint">' + e(by[p].map(x => x.title).join(', ')) + '</span></li>').join('') + '</ul>' : '';
    return '<div class="career ls"><div class="pg-head"><h2 class="pg-title">Watch summary</h2></div><div class="ls-scroll scroll" data-keep-scroll="wl-r">' + tiles + now + airs + '<div class="wl-two">' + kinds + plats + '</div>' + favs + recs + '</div></div>';
  };

  /* ---------------- editing ---------------- */
  WL.edit = id => {
    const x = id ? LW().find(w => w.id === id) : null; let pe = null;
    FX().form({
      title: x ? x.title : 'Add to the watch list', wide: true,
      data: x || { kind: 'series', status: 'want' },
      fields: [{ k: 'title', label: 'Title', req: true }, { k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(k => [k[0], k[2] + ' ' + k[1]]) },
        { k: 'status', label: 'Status', type: 'select', options: STATUS.map(s => [s[0], s[2] + ' ' + s[1]]) }, { k: 'platform', label: 'Where', list: PLATFORMS },
        { k: 'genre', label: 'Genre', list: ['Drama', 'Comedy', 'Thriller', 'Crime', 'Sci-fi', 'History', 'Family', 'Mythology', 'Documentary', 'Science', 'Cricket', 'Music', 'Kids'] }, { k: 'lang', label: 'Language', list: ['Hindi', 'English', 'Punjabi', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Marathi', 'Korean', 'Spanish'] },
        { k: 'season', label: 'Season now', type: 'number', min: 1 }, { k: 'seasons', label: 'Seasons in all', type: 'number', min: 1 },
        { k: 'ep', label: 'Episode watched', type: 'number', min: 0 }, { k: 'eps', label: 'Episodes this season', type: 'number', min: 1 },
        { k: 'mins', label: 'Minutes (an episode / the film)', type: 'number', min: 1, hint: 'For the hours watched; left empty, a usual length is used.' }, { k: 'rating', label: 'My rating', type: 'select', options: [['', '—'], [1, '★'], [2, '★★'], [3, '★★★'], [4, '★★★★'], [5, '★★★★★']] },
        { k: 'by', label: 'Suggested by' }, { k: 'link', label: 'Link', ph: 'Where to watch, trailer, review' },
        { k: 'days', label: 'Airs on (for TV serials)', type: 'days' }, { k: 'time', label: 'At', type: 'time' },
        { k: 'inPlan', label: 'Put it in the Daily tasks when it airs', type: 'check' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 }, { k: 'pic', label: 'Poster', type: 'head' }],
      mount(el) { const h = document.createElement('div'); h.className = 'pi-host'; el.querySelector('.st-form').appendChild(h); pe = ED.pics.editor(h, x && x.pic ? [x.pic] : [], { max: 1 }); },
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Remove', message: 'Remove “' + x.title + '” from the watch list?', ok: 'Remove', danger: true })) return false; ED.store.checkpoint('Watch list'); ED.store.data.lists.watch = LW().filter(w => w !== x); ED.store.commit(); ED.ui.undoToast('Removed: ' + x.title); } : null, delLabel: 'Remove',
      save(v, api) {
        ED.store.checkpoint('Watch list');
        const pics = pe ? pe.get() : [];
        const o = Object.assign({}, v, { pic: pics[0] || '', rating: v.rating ? +v.rating : null, days: v.days && v.days.length ? v.days : (v.time ? [0, 1, 2, 3, 4, 5, 6] : null), updatedAt: Date.now() });
        if (o.inPlan && !o.time) { ED.ui.toast('Add the time it airs to put it in the Daily tasks'); return; }
        if (o.status === 'done' && !(x && x.doneOn)) o.doneOn = U.today();
        if (o.status === 'watching' && !(x && x.startedOn)) o.startedOn = U.today();
        if (x) Object.assign(x, o); else LW().push(Object.assign({ id: U.uid('wl'), addedAt: Date.now(), cnt: o.ep || 0 }, o));
        ED.store.commit(); api.close();
      },
    });
  };
  const item = id => LW().find(w => w.id === id);
  F['wl-add'] = f => {
    const t = f.elements.title.value.trim(); if (!t) return;
    ED.store.checkpoint('Watch list');
    LW().push({ id: U.uid('wl'), title: t, kind: f.elements.kind.value, platform: f.elements.platform.value.trim(), status: 'want', season: 1, ep: 0, cnt: 0, addedAt: Date.now(), updatedAt: Date.now() });
    if (st().f === 'active' || st().f === 'done') st().f = 'want';
    ED.store.commit(); ED.ui.toast('Added: ' + t);
    setTimeout(() => { const i = document.querySelector('form[data-form="wl-add"] [name="title"]'); if (i) i.focus(); }, 30);
  };
  A['wl-edit'] = el => { st().sel = el.dataset.id; WL.edit(el.dataset.id); };
  A['wl-f'] = el => { st().f = el.dataset.k; ED.app.render(); };
  CH['wl-kind'] = el => { st().kind = el.value; ED.app.render(); };
  A['wl-next'] = el => {
    const x = item(el.dataset.id); if (!x) return;
    ED.store.checkpoint('Episode');
    let msg;
    if (x.eps && (x.ep || 0) >= x.eps) {
      if (x.seasons && (x.season || 1) >= x.seasons) { x.status = 'done'; x.doneOn = U.today(); msg = '✅ Finished ' + x.title + ' — rate it?'; }
      else { x.season = (x.season || 1) + 1; x.ep = 1; x.cnt = (x.cnt || 0) + 1; msg = 'Season ' + x.season + ', episode 1'; }
    } else { x.ep = (x.ep || 0) + 1; x.cnt = (x.cnt || 0) + 1; msg = prog(x) + (x.eps && x.ep >= x.eps ? ' — season done 🎉' : ''); }
    if (x.status === 'want' || x.status === 'paused') { x.status = 'watching'; x.startedOn = x.startedOn || U.today(); }
    x.updatedAt = Date.now(); ED.store.commit(); ED.ui.undoToast(x.title + ': ' + msg);
  };
  A['wl-st'] = el => { const x = item(el.dataset.id); if (!x) return; ED.store.checkpoint('Watch list'); x.status = el.dataset.k; if (x.status === 'done') x.doneOn = U.today(); if (x.status === 'watching') x.startedOn = x.startedOn || U.today(); x.updatedAt = Date.now(); ED.store.commit(); if (x.status === 'done') ED.ui.toast('✅ ' + x.title + ' — click the stars to rate it'); };
  A['wl-rate'] = el => { const x = item(el.dataset.id); if (!x) return; const n = +el.dataset.n; x.rating = x.rating === n ? null : n; x.updatedAt = Date.now(); ED.store.commit(); };
  CH['wl-plan'] = el => { const x = item(el.dataset.id); if (!x) return; x.inPlan = el.checked; x.updatedAt = Date.now(); ED.store.commit(); ED.ui.toast(el.checked ? 'In the Daily tasks when it airs' : 'Taken out of the Daily tasks'); };

  /* ---------------- airing serials in the Daily tasks ---------------- */
  const TID = id => 'tk-wl-' + id;
  let busy = false;
  WL.reconcile = () => {
    const d = ED.store.data; if (busy || !d || !Array.isArray(d.tasks) || !d.lists || !Array.isArray(d.lists.watch)) return false;
    busy = true; let ch = false;
    try {
      const keep = new Set();
      d.lists.watch.forEach(x => {
        if (!x.inPlan || !x.time || x.status === 'done' || x.status === 'dropped') return;
        const id = TID(x.id), days = (x.days && x.days.length ? x.days : [0, 1, 2, 3, 4, 5, 6]).slice().sort(), title = kind(x.kind)[2] + ' ' + x.title;
        keep.add(id);
        const rep = { freq: 'weekly', interval: 1, days };
        let t = d.tasks.find(y => y.id === id);
        if (!t) { t = M.newTask({ id, title, date: U.today(), time: x.time, dur: mins(x) || 30, prio: 'C', repeat: rep, link: { k: 'watch', id: x.id }, linkTitle: title, notes: x.platform ? '<p>' + U.esc(x.platform) + '</p>' : '' }); t.num = M.nextNum(t.prio, t.date); d.tasks.push(t); ch = true; return; }
        if (!t.link || (t.repeat && t.repeat.until)) { t.link = { k: 'watch', id: x.id }; if (t.repeat) delete t.repeat.until; ch = true; }   // switched on again
        if (t.time !== x.time) { t.time = x.time; ch = true; }
        if (JSON.stringify((t.repeat || {}).days || []) !== JSON.stringify(days)) { t.repeat = Object.assign({}, t.repeat || {}, rep); ch = true; }
        if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
      });
      const drop = d.tasks.filter(t => t.link && t.link.k === 'watch' && !keep.has(t.id));
      if (drop.length) {
        drop.forEach(t => { if (t.repeat) t.repeat.until = U.addDays(U.today(), -1); });   // stops from today; the days already passed keep their ticks
        d.tasks = d.tasks.filter(t => !(drop.indexOf(t) >= 0 && !Object.keys(t.occ || {}).length));
        drop.forEach(t => { delete t.link; }); ch = true;
      }
    } finally { busy = false; }
    return ch;
  };
  ED.store.on((type, dt) => { if (type !== 'change' || (dt && dt.reason === 'watch')) return; if (WL.reconcile()) ED.store.commit({ reason: 'watch' }); });
  const del0 = M.deleteTask;
  M.deleteTask = id => { const t = M.task(id); if (t && t.link && t.link.k === 'watch') { const x = item(t.link.id); if (x) { x.inPlan = false; x.updatedAt = Date.now(); } } return del0(id); };
  const LINKS_OPEN = A['task-open'];
  A['task-open'] = (el, ev) => {
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    if (o && o.t.link && o.t.link.k === 'watch' && ev && ev.target.closest('.tlink')) { (ED.state.career = ED.state.career || {}).mode = 'watch'; ED.go.tab('career'); return; }
    return LINKS_OPEN(el, ev);
  };
})();
