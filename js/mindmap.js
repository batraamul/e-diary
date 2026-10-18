/* E-Diary — Study → Mind maps, to plan projects, papers and topics.
   Right page: the map. The central idea sits in the middle; main branches grow to the right and the left, each
   branch in its own colour, and sub-ideas grow outwards. Keys on the map: Tab = add a sub-idea, Enter = add an idea
   beside it, F2 or double-click = rename, Space = done, Delete = remove, arrows = move around, Ctrl+↑/↓ = reorder.
   Drag an idea onto another to move it there. Ideas with sub-ideas show how many of their end points are done.
   Left page: your maps (with templates for a project, a research paper or a study topic) and the selected idea:
   colour, due date, notes, done, and "Make it a task" (it goes to Daily/Monthly Tasks; ticking either ticks both).
   Data: ED.store.data.maps = { list: [{ id, title, nodes: [{ id, parent, text, side: 'r'|'l', color, done, due,
   notes, collapsed, taskId }], createdAt, updatedAt }] } — the node with parent null is the central idea. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const FX = () => ED.fx;
  const D = () => ED.store.data;
  const MAPS = () => { const d = D(); if (!d.maps || !Array.isArray(d.maps.list)) d.maps = { list: [] }; return d.maps; };
  const A = (ED.actions = ED.actions || {});
  const CHG = (ED.changes = ED.changes || {});
  const st = () => ED.state.mm || (ED.state.mm = { zoom: 1 });
  const MM = (ED.mindmap = {});
  const COLORS = ['#1f6fe0', '#d9542b', '#2e7d32', '#7b3fb8', '#00838f', '#c2185b', '#8a6d00', '#3949ab'];
  const GX = 46, GY = 12, PAD = 40;

  const TEMPLATES = {
    blank: { title: 'New mind map', root: 'Central idea', kids: [] },
    project: { title: 'Project plan', root: 'Project name', kids: [
      ['Goal & scope', ['Problem to solve', 'Objectives', 'Deliverables']], ['Work packages', ['WP 1', 'WP 2', 'WP 3']], ['Timeline', ['Start', 'Milestones', 'Reviews']],
      ['Resources', ['People', 'Equipment', 'Budget']], ['Risks', ['Technical', 'Schedule', 'Procurement']], ['Stakeholders', ['Sponsor', 'Users', 'Approvals']]] },
    paper: { title: 'Research paper', root: 'Paper title', kids: [
      ['Research question', ['Gap', 'Hypothesis']], ['Literature', ['Key papers', 'Baselines']], ['Method', ['Data', 'Model', 'Experiments']],
      ['Results', ['Figures', 'Tables', 'Ablations']], ['Writing', ['Abstract', 'Introduction', 'Discussion', 'References']], ['Submission', ['Journal', 'Cover letter', 'Reviewers']]] },
    study: { title: 'Study topic', root: 'Topic', kids: [['Basics', []], ['Key ideas', []], ['Examples', []], ['Practice questions', []], ['Resources', ['Books', 'Lectures', 'Notes']]] },
  };

  /* ---------------- the tree ---------------- */
  const map = () => { const l = MAPS().list; let m = l.find(x => x.id === st().map); if (!m) { m = l.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null; st().map = m ? m.id : null; } return m; };
  const root = m => m.nodes.find(n => !n.parent) || null;
  const kids = (m, id) => m.nodes.filter(n => n.parent === id);
  const node = (m, id) => m.nodes.find(n => n.id === id) || null;
  const isTaskDone = n => { const t = n.taskId && M.task(n.taskId); return !!(t && M.isClosed(t.status)); };
  const isDone = n => !!n.done || isTaskDone(n);
  const leaves = (m, id) => { const k = kids(m, id); if (!k.length) return [node(m, id)]; return k.reduce((a, c) => a.concat(leaves(m, c.id)), []); };
  const prog = (m, id) => { const l = leaves(m, id).filter(Boolean); return { done: l.filter(isDone).length, n: l.length }; };
  const depthOf = (m, n) => { let d = 0, x = n; while (x && x.parent && d < 50) { x = node(m, x.parent); d++; } return d; };
  const branchOf = (m, n) => { let x = n; while (x && x.parent && node(m, x.parent) && node(m, x.parent).parent) x = node(m, x.parent); return x; };
  const colorOf = (m, n) => {
    if (n.color) return n.color;
    if (!n.parent) return 'var(--ink)';
    const b = branchOf(m, n); if (b.color) return b.color;
    const firsts = kids(m, root(m).id); return COLORS[Math.max(0, firsts.indexOf(b)) % COLORS.length];
  };
  const descendant = (m, id, of) => { let x = node(m, id), g = 0; while (x && x.parent && g++ < 200) { if (x.parent === of) return true; x = node(m, x.parent); } return false; };
  const pathOf = (m, n) => { const p = []; let x = n, g = 0; while (x && g++ < 50) { p.unshift(x.text); x = x.parent ? node(m, x.parent) : null; } return p.join(' › '); };
  /* a new main branch goes to the side with fewer ideas */
  const sideFor = m => { const r = root(m); const f = kids(m, r.id); const w = s => f.filter(n => n.side === s).reduce((a, n) => a + leaves(m, n.id).length, 0); return w('r') <= w('l') ? 'r' : 'l'; };
  MM.newMap = (tpl, title) => {
    const t = TEMPLATES[tpl] || TEMPLATES.blank;
    const m = { id: U.uid('mm'), title: title || t.title, nodes: [], createdAt: Date.now(), updatedAt: Date.now() };
    const r = { id: U.uid('n'), parent: null, text: t.root };
    m.nodes.push(r);
    t.kids.forEach(([txt, sub]) => { const c = { id: U.uid('n'), parent: r.id, text: txt, side: sideFor(m) }; m.nodes.push(c); sub.forEach(s => m.nodes.push({ id: U.uid('n'), parent: c.id, text: s })); });
    return m;
  };

  /* ---------------- drawing ---------------- */
  const nodeHtml = (m, n, sel) => {
    const k = kids(m, n.id), p = k.length ? prog(m, n.id) : null, d = depthOf(m, n);
    const late = n.due && !isDone(n) && n.due < U.today();
    return '<div class="mm-node d' + Math.min(d, 3) + (n.id === sel ? ' sel' : '') + (isDone(n) ? ' done' : '') + '" data-mmn="' + e(n.id) + '" style="--c:' + e(colorOf(m, n)) + '"' + (n.parent ? ' draggable="true"' : '') + ' role="treeitem" aria-label="' + e(n.text) + '">' +
      '<span class="mm-tx">' + (isDone(n) ? '<span class="mm-ok" aria-hidden="true">✓</span>' : '') + e(n.text || '…') + '</span>' +
      ((n.due || n.notes || n.taskId || p) ? '<span class="mm-badges">' + (n.due ? '<span class="mm-b' + (late ? ' late' : '') + '">' + ED.icon('calendar') + e(U.fmtDM(n.due)) + '</span>' : '') +
        (n.notes ? '<span class="mm-b" title="Has notes">' + ED.icon('doc') + '</span>' : '') + (n.taskId ? '<span class="mm-b" title="Is a task in your planner">' + ED.icon('checkSq') + '</span>' : '') +
        (p ? '<span class="mm-b num" title="' + p.done + ' of ' + p.n + ' end points done">' + p.done + '/' + p.n + '</span>' : '') + '</span>' : '') +
      (p ? '<span class="mm-pb"><i style="width:' + Math.round(p.done / p.n * 100) + '%"></i></span>' : '') +
      (n.collapsed && k.length ? '<button type="button" class="mm-fold" data-act="mm-fold" data-id="' + e(n.id) + '" title="Show ' + U.plural(k.length, 'hidden idea') + '">+' + k.length + '</button>' : '') + '</div>';
  };
  const visible = m => { const out = [], walk = (id) => { const n = node(m, id); out.push(n); if (!n.collapsed) kids(m, id).forEach(c => walk(c.id)); }; const r = root(m); if (r) walk(r.id); return out; };

  /* place the nodes once the browser knows their sizes */
  function layout(wrap, m) {
    const stage = wrap.querySelector('.mm-stage'); if (!stage) return;
    stage.style.width = '6000px'; stage.style.height = '6000px';     // room to measure each idea at its natural width
    const els = {}; U.$$('[data-mmn]', stage).forEach(el => { els[el.dataset.mmn] = el; });
    const size = {}; Object.keys(els).forEach(id => { size[id] = { w: els[id].offsetWidth, h: els[id].offsetHeight }; });
    const pos = {};
    const shown = id => { const n = node(m, id); return n && !n.collapsed ? kids(m, id).filter(c => els[c.id]) : []; };
    const hOf = {}; const H = id => { if (hOf[id] != null) return hOf[id]; const k = shown(id); const own = size[id].h; const sum = k.reduce((a, c) => a + H(c.id), 0) + Math.max(0, k.length - 1) * GY; return (hOf[id] = Math.max(own, sum)); };
    const place = (id, x, cy, dir) => {
      const s = size[id]; pos[id] = { x: dir > 0 ? x : x - s.w, y: cy - s.h / 2, dir };
      const k = shown(id); if (!k.length) return;
      const total = k.reduce((a, c) => a + H(c.id), 0) + (k.length - 1) * GY;
      let y = cy - total / 2;
      const nx = dir > 0 ? pos[id].x + s.w + GX : pos[id].x - GX;
      k.forEach(c => { const h = H(c.id); place(c.id, nx, y + h / 2, dir); y += h + GY; });
    };
    const r = root(m); if (!r || !els[r.id]) return;
    const rs = size[r.id];
    pos[r.id] = { x: -rs.w / 2, y: -rs.h / 2, dir: 0 };
    ['r', 'l'].forEach(side => {
      const k = kids(m, r.id).filter(c => els[c.id] && (c.side || 'r') === side);
      if (r.collapsed || !k.length) return;
      const total = k.reduce((a, c) => a + H(c.id), 0) + (k.length - 1) * GY;
      let y = -total / 2;
      k.forEach(c => { const h = H(c.id); place(c.id, side === 'r' ? rs.w / 2 + GX * 1.4 : -rs.w / 2 - GX * 1.4, y + h / 2, side === 'r' ? 1 : -1); y += h + GY; });
    });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    Object.keys(pos).forEach(id => { const p = pos[id], s = size[id]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + s.w); y1 = Math.max(y1, p.y + s.h); });
    const W = Math.ceil(x1 - x0 + PAD * 2), Hh = Math.ceil(y1 - y0 + PAD * 2), ox = PAD - x0, oy = PAD - y0;
    Object.keys(pos).forEach(id => { const p = pos[id]; els[id].style.left = Math.round(p.x + ox) + 'px'; els[id].style.top = Math.round(p.y + oy) + 'px'; });
    // connectors: a smooth curve from the side of the parent to the side of the child
    let paths = '';
    Object.keys(pos).forEach(id => {
      const n = node(m, id); if (!n.parent || !pos[n.parent]) return;
      const p = pos[n.parent], ps = size[n.parent], c = pos[id], cs = size[id];
      const dir = c.dir;
      const sx = (dir > 0 ? p.x + ps.w : p.x) + ox, sy = p.y + ps.h / 2 + oy;
      const ex = (dir > 0 ? c.x : c.x + cs.w) + ox, ey = c.y + cs.h / 2 + oy;
      const mx = (sx + ex) / 2;
      paths += '<path d="M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + 'C' + mx.toFixed(1) + ' ' + sy.toFixed(1) + ' ' + mx.toFixed(1) + ' ' + ey.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '" style="stroke:' + colorOf(m, n) + '" class="' + (depthOf(m, n) === 1 ? 'mm-l1' : '') + '"/>';
    });
    const z = st().zoom || 1;
    stage.style.width = W + 'px'; stage.style.height = Hh + 'px';
    stage.querySelector('svg').setAttribute('width', W); stage.querySelector('svg').setAttribute('height', Hh);
    stage.querySelector('svg').innerHTML = paths;
    stage.style.transform = 'scale(' + z + ')';
    const sizer = wrap.querySelector('.mm-sizer'); sizer.style.width = Math.ceil(W * z) + 'px'; sizer.style.height = Math.ceil(Hh * z) + 'px';
    stage.classList.add('ready');
    MM.last = { W, Hh, ox, oy, pos, size };
  }
  /* keep the selected idea in view */
  const reveal = (wrap, id) => {
    const el = wrap.querySelector('[data-mmn="' + id + '"]'); if (!el) return;
    const sz = wrap.querySelector('.mm-sizer'), z = st().zoom || 1, x = sz.offsetLeft + el.offsetLeft * z, y = sz.offsetTop + el.offsetTop * z, w = el.offsetWidth * z, h = el.offsetHeight * z;
    if (x < wrap.scrollLeft + 10) wrap.scrollLeft = x - 30; else if (x + w > wrap.scrollLeft + wrap.clientWidth - 10) wrap.scrollLeft = x + w - wrap.clientWidth + 30;
    if (y < wrap.scrollTop + 10) wrap.scrollTop = y - 30; else if (y + h > wrap.scrollTop + wrap.clientHeight - 10) wrap.scrollTop = y + h - wrap.clientHeight + 30;
  };
  const centre = wrap => { const r = wrap.querySelector('.mm-node.d0'), sz = wrap.querySelector('.mm-sizer'); if (!r) return; const z = st().zoom || 1; wrap.scrollLeft = sz.offsetLeft + (r.offsetLeft + r.offsetWidth / 2) * z - wrap.clientWidth / 2; wrap.scrollTop = sz.offsetTop + (r.offsetTop + r.offsetHeight / 2) * z - wrap.clientHeight / 2; };

  /* ---------------- pages ---------------- */
  const view = {
    id: 'mindmap', label: 'Mind Maps',
    left() {
      const l = MAPS().list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), m = map();
      const cards = l.map(x => { const r = root(x), p = r ? prog(x, r.id) : { done: 0, n: 0 }; return '<button type="button" class="ls-card mm-card' + (m && x.id === m.id ? ' sel' : '') + '" data-act="mm-open" data-id="' + e(x.id) + '"><b>' + e(x.title || 'Mind map') + '</b>' +
        '<span class="hint">' + U.plural(x.nodes.length, 'idea') + ' · changed ' + e(U.fmtDM(U.key(new Date(x.updatedAt || x.createdAt || Date.now())))) + '</span><div class="ls-bar"><i style="width:' + (p.n ? Math.round(p.done / p.n * 100) : 0) + '%"></i></div><span class="hint num">' + p.done + '/' + p.n + ' done</span></button>'; }).join('');
      const tools = '<div class="ls-tools"><button type="button" class="btn small primary" data-act="mm-new" data-tpl="blank">' + ED.icon('plus') + 'New mind map</button>' +
        '<button type="button" class="btn small" data-act="mm-new" data-tpl="project">Project plan</button><button type="button" class="btn small" data-act="mm-new" data-tpl="paper">Research paper</button><button type="button" class="btn small" data-act="mm-new" data-tpl="study">Study topic</button>' + (m ? '<button type="button" class="btn small ghost danger-text" data-act="mm-delmap">' + ED.icon('trash') + 'Delete this map</button>' : '') + '</div>';
      let insp = '';
      const n = m && node(m, st().node);
      if (n) {
        const t = n.taskId && M.task(n.taskId), k = kids(m, n.id);
        const open = leaves(m, n.id).filter(x => x && x.id !== n.id && !isDone(x) && !x.taskId).length;
        insp = '<h3 class="gh fin-gap">Selected idea</h3><div class="mm-insp">' +
          '<label class="lbl" for="mm-in-text">Text</label><input id="mm-in-text" class="field" value="' + e(n.text) + '" data-change="mm-text" data-id="' + e(n.id) + '">' +
          '<span class="lbl">Colour</span><div class="mm-sw">' + COLORS.map(c => '<button type="button" class="mm-swb' + (n.color === c ? ' on' : '') + '" style="--c:' + c + '" data-act="mm-color" data-id="' + e(n.id) + '" data-c="' + c + '" aria-label="Colour ' + c + '"></button>').join('') +
          '<button type="button" class="btn small ghost" data-act="mm-color" data-id="' + e(n.id) + '" data-c="">Auto</button></div>' +
          '<label class="lbl" for="mm-in-due">Due</label><input id="mm-in-due" class="field" type="date" value="' + e(n.due || '') + '" data-change="mm-due" data-id="' + e(n.id) + '">' +
          '<span class="lbl"></span><label class="switch"><input type="checkbox" data-change="mm-done" data-id="' + e(n.id) + '"' + (isDone(n) ? ' checked' : '') + '><span class="track"></span><span>Done</span></label>' +
          '<label class="lbl" for="mm-in-notes">Notes</label><textarea id="mm-in-notes" class="field" rows="4" data-change="mm-notes" data-id="' + e(n.id) + '" placeholder="Details, links, what to do next…">' + e(n.notes || '') + '</textarea></div>' +
          '<div class="row-btns">' + (t ? '<button type="button" class="btn small" data-act="mm-task-open" data-id="' + e(n.id) + '">' + ED.icon('checkSq') + 'Open its task (' + e(M.code(t)) + ')</button>' : '<button type="button" class="btn small primary" data-act="mm-task" data-id="' + e(n.id) + '">' + ED.icon('checkSq') + 'Make it a task</button>') +
          (k.length && open ? '<button type="button" class="btn small" data-act="mm-tasks" data-id="' + e(n.id) + '">Make tasks of the ' + U.plural(open, 'open end point') + '</button>' : '') +
          (n.parent ? '<button type="button" class="btn small ghost danger-text" data-act="mm-del" data-id="' + e(n.id) + '">' + ED.icon('trash') + 'Delete</button>' : '') + '</div>' +
          '<p class="hint">Path: ' + e(pathOf(m, n)) + '</p>';
      }
      return '<div class="career ls mm-left"><div class="pg-head"><h2 class="pg-title">Mind maps</h2></div><div class="ls-scroll scroll" data-keep-scroll="mm-l">' + tools +
        (cards ? '<div class="ls-cards">' + cards + '</div>' : '<div class="empty">' + ED.icon('share') + '<div><b>No mind maps yet.</b><br>Start from a template — a project plan, a research paper, a study topic — or a blank map.</div></div>') +
        insp + '</div></div>';
    },
    right() {
      const m = map();
      if (!m) return '<div class="career ls mm-right"><div class="pg-head"><h2 class="pg-title">Map</h2></div><p class="hint">Make a mind map on the left. Put the project or topic in the middle, the main parts around it, and break each part down until every end point is something you can do.</p></div>';
      const sel = node(m, st().node) ? st().node : (root(m) || {}).id;
      const z = st().zoom || 1;
      const r = root(m), p = r ? prog(m, r.id) : { done: 0, n: 0 };
      const head = '<div class="pg-head mm-head"><h2 class="pg-title"><button type="button" class="plain-btn mm-title" data-act="mm-rename" title="Rename the map">' + e(m.title || 'Mind map') + '</button></h2>' +
        '<span class="hint num">' + p.done + '/' + p.n + ' done</span><span class="grow"></span>' +
        '<div class="mm-zoom" role="group" aria-label="Zoom"><button type="button" class="icon-btn sm" data-act="mm-zoom" data-z="-1" aria-label="Zoom out">−</button><span class="num">' + Math.round(z * 100) + '%</span><button type="button" class="icon-btn sm" data-act="mm-zoom" data-z="1" aria-label="Zoom in">+</button><button type="button" class="btn small ghost" data-act="mm-zoom" data-z="0">Fit</button></div>' +
        '<button type="button" class="icon-btn" data-act="mm-menu" aria-label="Map menu" title="More">' + ED.icon('more') + '</button></div>';
      const bar = '<div class="mm-bar" role="toolbar" aria-label="Selected idea">' +
        '<button type="button" class="btn small" data-act="mm-add" data-how="child" title="Add a sub-idea (Tab)">' + ED.icon('plus') + 'Sub-idea</button>' +
        '<button type="button" class="btn small" data-act="mm-add" data-how="sib" title="Add an idea beside it (Enter)">' + ED.icon('plus') + 'Beside</button>' +
        '<button type="button" class="btn small ghost" data-act="mm-edit" title="Rename (F2 or double-click)">' + ED.icon('pencil') + 'Rename</button>' +
        '<button type="button" class="btn small ghost" data-act="mm-donek" title="Done (Space)">' + ED.icon('check') + 'Done</button>' +
        '<button type="button" class="btn small ghost" data-act="mm-fold" title="Hide or show its sub-ideas">' + ED.icon('collapse') + 'Fold</button>' +
        '<button type="button" class="btn small ghost" data-act="mm-del" title="Delete (Del)">' + ED.icon('trash') + '</button></div>';
      return '<div class="career ls mm-right">' + head + bar +
        '<div class="mm-wrap" tabindex="0" role="tree" aria-label="Mind map ' + e(m.title || '') + '"><div class="mm-sizer"><div class="mm-stage" data-map="' + e(m.id) + '"><svg class="mm-links" aria-hidden="true"></svg>' +
        visible(m).map(n => nodeHtml(m, n, sel)).join('') + '</div></div></div>' +
        '<p class="hint mm-keys">Tab sub-idea · Enter beside · F2 rename · Space done · Del delete · arrows move · Ctrl+↑↓ reorder · drag an idea onto another to move it</p></div>';
    },
    mount(L, R) {
      const m = map(); const wrap = R.querySelector('.mm-wrap'); if (!m || !wrap) return;
      layout(wrap, m);
      const s = st(), last = MM.last, z = s.zoom || 1;
      if (s.fit) { s.fit = false; requestAnimationFrame(() => fit(wrap, 0.8)); }
      if (s.centre !== m.id) { s.centre = m.id; centre(wrap); }
      else if (last && s.sx != null) {
        // the map grows in every direction: keep the central idea where it was on the screen
        wrap.scrollLeft = s.sx + ((last.ox - (s.ox != null ? s.ox : last.ox)) * z);
        wrap.scrollTop = s.sy + ((last.oy - (s.oy != null ? s.oy : last.oy)) * z);
      }
      if (last) { s.ox = last.ox; s.oy = last.oy; }
      s.sx = wrap.scrollLeft; s.sy = wrap.scrollTop;
      wrap.addEventListener('scroll', () => { s.sx = wrap.scrollLeft; s.sy = wrap.scrollTop; }, { passive: true });
      if (s.node) reveal(wrap, s.node);
      if (s.editNew) { const id = s.editNew; s.editNew = null; startEdit(wrap, id); }
      else if (s.focus) { s.focus = false; const f = () => { if (wrap.isConnected && !wrap.contains(document.activeElement)) wrap.focus({ preventScroll: true }); }; f(); setTimeout(f, 0); setTimeout(f, 60); }
      bind(wrap, m);
    },
    // a redraw replaces the map: if you were working on it, it gets the keyboard back afterwards
    unmount() { const a = document.activeElement; if (a && a.closest && a.closest('.mm-wrap') && !a.classList.contains('mm-edit')) st().focus = true; },
    key(ev) {
      const wrap = document.querySelector('.mm-wrap');
      if (!wrap || !(wrap === document.activeElement || wrap.contains(document.activeElement))) return false;
      return keys(ev, wrap);
    },
  };
  ED.views = ED.views || {};
  ED.views.mindmap = view;

  function fit(wrap, min) {
    const L = MM.last; if (!L) return;
    const z = Math.max(min || 0.4, Math.min(1.2, Math.min((wrap.clientWidth - 20) / L.W, (wrap.clientHeight - 20) / L.Hh)));
    st().zoom = Math.floor(z * 10) / 10; st().centre = null; ED.app.render();
  }

  /* ---------------- editing on the map ---------------- */
  const select = (wrap, id, focus) => {
    st().node = id;
    U.$$('.mm-node.sel', wrap).forEach(x => x.classList.remove('sel'));
    const el = wrap.querySelector('[data-mmn="' + id + '"]'); if (el) el.classList.add('sel');
    reveal(wrap, id);
    ED.app.renderPage('left');
    if (focus !== false) { try { wrap.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  };
  function startEdit(wrap, id) {
    const m = map(), n = node(m, id); const el = wrap.querySelector('[data-mmn="' + id + '"]'); if (!n || !el) return;
    st().node = id;
    const tx = el.querySelector('.mm-tx');
    const inp = document.createElement('textarea'); inp.className = 'mm-edit'; inp.rows = 1; inp.value = n.text || ''; inp.setAttribute('aria-label', 'Idea text');
    tx.replaceWith(inp); el.classList.add('editing'); el.draggable = false;
    const fitH = () => { inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 'px'; };
    fitH();
    // focus after this frame: the browser resets focus once the old (re-drawn) map is gone, which would undo it now
    const grab = () => { if (inp.isConnected && document.activeElement !== inp) { inp.focus({ preventScroll: true }); inp.select(); } };
    grab(); setTimeout(grab, 0); setTimeout(grab, 60);
    let done = false;
    const finish = (save, then) => {
      if (done) return; done = true;
      const v = inp.value.replace(/\s+\n/g, '\n').trim();
      if (save && v && v !== n.text) { ED.store.checkpoint('Rename idea'); n.text = v; m.updatedAt = Date.now(); }
      else if (save && !v && n.fresh) { m.nodes = m.nodes.filter(x => x.id !== n.id); st().node = n.parent; }
      delete n.fresh;
      st().focus = true;
      ED.store.commit();
      if (then) then();
    };
    inp.addEventListener('input', fitH);
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Tab') { ev.preventDefault(); finish(true, () => add(n.id, 'child')); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(n.fresh ? true : false); }
      ev.stopPropagation();
    });
    inp.addEventListener('blur', () => finish(true));
  }
  /* add an idea under (child) or beside (sib) the selected one, then type its text */
  function add(id, how) {
    const m = map(); if (!m) return;
    const n = node(m, id) || root(m); if (!n) return;
    const parent = how === 'sib' && n.parent ? node(m, n.parent) : n;
    ED.store.checkpoint('Add idea');
    if (parent.collapsed) parent.collapsed = false;
    const c = { id: U.uid('n'), parent: parent.id, text: '', fresh: true };
    if (!parent.parent) c.side = how === 'sib' && n.side ? n.side : sideFor(m);
    if (how === 'sib') { const i = m.nodes.indexOf(n); m.nodes.splice(i + 1, 0, c); } else m.nodes.push(c);
    m.updatedAt = Date.now();
    st().node = c.id; st().editNew = c.id;
    ED.store.commit();
  }
  MM.add = add;
  async function remove(id) {
    const m = map(), n = node(m, id); if (!n || !n.parent) return;
    const all = m.nodes.filter(x => x.id === id || descendant(m, x.id, id));
    if (all.length > 1) { const ok = await ED.ui.confirm({ title: 'Delete idea', message: 'Delete “' + n.text + '” and the ' + U.plural(all.length - 1, 'idea') + ' under it?', ok: 'Delete', danger: true }); if (!ok) return; }
    ED.store.checkpoint('Delete idea');
    const ids = new Set(all.map(x => x.id));
    const sib = kids(m, n.parent).filter(x => !ids.has(x.id));
    m.nodes = m.nodes.filter(x => !ids.has(x.id));
    m.updatedAt = Date.now();
    st().node = (sib[0] || node(m, n.parent) || {}).id || null; st().focus = true;
    ED.store.commit(); ED.ui.undoToast('Deleted: ' + (n.text || 'idea'));
  }
  const setDone = (m, n, on) => {
    n.done = on;
    const t = n.taskId && M.task(n.taskId);
    if (t && !t.repeat && M.isClosed(t.status) !== on) M.setStatus(t, t.date || U.today(), on ? 'done' : 'open');
    m.updatedAt = Date.now();
  };
  function keys(ev, wrap) {
    const m = map(); if (!m) return false;
    const id = st().node && node(m, st().node) ? st().node : root(m).id, n = node(m, id);
    const k = ev.key;
    if (k === 'Tab') { add(id, 'child'); return true; }
    if (k === 'Enter') { add(id, n.parent ? 'sib' : 'child'); return true; }
    if (k === 'F2') { startEdit(wrap, id); return true; }
    if (k === 'Delete' || k === 'Backspace') { remove(id); return true; }
    if (k === ' ') { ED.store.checkpoint('Done'); setDone(m, n, !isDone(n)); st().focus = true; ED.store.commit(); return true; }
    if ((ev.ctrlKey || ev.metaKey) && (k === 'ArrowUp' || k === 'ArrowDown') && n.parent) {
      const sib = kids(m, n.parent).filter(x => !n.parent || node(m, n.parent).parent || (x.side || 'r') === (n.side || 'r'));
      const i = sib.indexOf(n), j = i + (k === 'ArrowUp' ? -1 : 1); if (j < 0 || j >= sib.length) return true;
      ED.store.checkpoint('Reorder'); const a = m.nodes.indexOf(n), b = m.nodes.indexOf(sib[j]); m.nodes[a] = sib[j]; m.nodes[b] = n; m.updatedAt = Date.now(); st().focus = true; ED.store.commit(); return true;
    }
    if (k.indexOf('Arrow') === 0) {
      const L = MM.last; if (!L || !L.pos[id]) return true;
      const here = L.pos[id], cx = here.x + L.size[id].w / 2, cy = here.y + L.size[id].h / 2;
      let best = null, bd = Infinity;
      Object.keys(L.pos).forEach(o => {
        if (o === id) return; const p = L.pos[o], ox = p.x + L.size[o].w / 2, oy = p.y + L.size[o].h / 2, dx = ox - cx, dy = oy - cy;
        const ok = k === 'ArrowRight' ? dx > 5 : k === 'ArrowLeft' ? dx < -5 : k === 'ArrowDown' ? dy > 5 : dy < -5;
        if (!ok) return;
        const d = (k === 'ArrowRight' || k === 'ArrowLeft') ? Math.abs(dx) + Math.abs(dy) * 3 : Math.abs(dy) + Math.abs(dx) * 3;
        if (d < bd) { bd = d; best = o; }
      });
      if (best) select(wrap, best);
      return true;
    }
    return false;
  }
  function bind(wrap, m) {
    if (wrap.dataset.bound) return; wrap.dataset.bound = '1';
    wrap.addEventListener('click', ev => {
      if (ev.target.closest('[data-act]')) return;
      const el = ev.target.closest('[data-mmn]'); if (el) select(wrap, el.dataset.mmn);
    });
    wrap.addEventListener('dblclick', ev => { const el = ev.target.closest('[data-mmn]'); if (el) startEdit(wrap, el.dataset.mmn); });
    let drag = null;
    wrap.addEventListener('dragstart', ev => { const el = ev.target.closest && ev.target.closest('[data-mmn]'); if (!el || el.classList.contains('editing')) return; drag = el.dataset.mmn; try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', drag); } catch (err) { /* ignore */ } el.classList.add('dragging'); });
    wrap.addEventListener('dragend', () => { drag = null; U.$$('.mm-node.dragging, .mm-node.drop-hover', wrap).forEach(x => x.classList.remove('dragging', 'drop-hover')); });
    wrap.addEventListener('dragover', ev => {
      if (!drag) return; const el = ev.target.closest('[data-mmn]'); U.$$('.mm-node.drop-hover', wrap).forEach(x => { if (x !== el) x.classList.remove('drop-hover'); });
      const mm = map(); if (!el || el.dataset.mmn === drag || descendant(mm, el.dataset.mmn, drag)) return;
      ev.preventDefault(); el.classList.add('drop-hover');
    });
    wrap.addEventListener('drop', ev => {
      if (!drag) return; const el = ev.target.closest('[data-mmn]'); const id = drag; drag = null;
      const mm = map(), n = node(mm, id); if (!el || !n || el.dataset.mmn === id || descendant(mm, el.dataset.mmn, id)) return;
      ev.preventDefault();
      const to = node(mm, el.dataset.mmn);
      if (n.parent === to.id) return;
      ED.store.checkpoint('Move idea');
      n.parent = to.id; to.collapsed = false;
      if (!to.parent) { delete n.side; n.side = sideFor(mm); } else delete n.side;
      mm.nodes.splice(mm.nodes.indexOf(n), 1); mm.nodes.push(n);
      mm.updatedAt = Date.now(); st().node = n.id;
      ED.store.commit(); ED.ui.undoToast('Moved under “' + to.text + '”');
    });
    wrap.addEventListener('wheel', ev => { if (!(ev.ctrlKey || ev.metaKey)) return; ev.preventDefault(); zoomBy(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
  }
  const zoomBy = d => { const s = st(); s.zoom = Math.max(0.4, Math.min(1.6, Math.round(((s.zoom || 1) + d * 0.1) * 10) / 10)); ED.app.render(); };

  /* ---------------- actions ---------------- */
  const sel = el => { const m = map(); return m && node(m, (el && el.dataset.id) || st().node || (root(m) || {}).id); };
  A['mm-new'] = async el => {
    const tpl = el.dataset.tpl || 'blank', t = TEMPLATES[tpl];
    const title = await ED.ui.prompt({ title: 'New mind map', label: 'Name', value: tpl === 'blank' ? '' : t.title, placeholder: 'e.g. GlideSonde paper, Radar project, Linux basics', ok: 'Create' });
    if (title == null) return;
    ED.store.checkpoint('New mind map');
    const m = MM.newMap(tpl, title.trim() || t.title);
    if (title.trim()) m.nodes[0].text = title.trim();
    MAPS().list.push(m);
    Object.assign(st(), { map: m.id, node: m.nodes[0].id, centre: null, zoom: 1, fit: m.nodes.length > 12, focus: true });
    ED.store.commit();
  };
  A['mm-open'] = el => { Object.assign(st(), { map: el.dataset.id, node: null, centre: null }); ED.app.render(); };
  A['mm-add'] = el => { const n = sel(); if (n) add(n.id, el.dataset.how); };
  A['mm-edit'] = () => { const n = sel(); const w = document.querySelector('.mm-wrap'); if (n && w) startEdit(w, n.id); };
  A['mm-del'] = el => { const n = sel(el); if (n) remove(n.id); };
  A['mm-donek'] = () => { const m = map(), n = sel(); if (!n) return; ED.store.checkpoint('Done'); setDone(m, n, !isDone(n)); st().focus = true; ED.store.commit(); };
  A['mm-fold'] = el => { const m = map(), n = sel(el); if (!n || !kids(m, n.id).length) return; n.collapsed = !n.collapsed; m.updatedAt = Date.now(); st().node = n.id; st().focus = true; ED.store.commit(); };
  A['mm-zoom'] = el => { const d = +el.dataset.z; if (!d) { const w = document.querySelector('.mm-wrap'); if (w) fit(w); } else zoomBy(d); };
  A['mm-rename'] = async () => {
    const m = map(); if (!m) return;
    const v = await ED.ui.prompt({ title: 'Rename mind map', label: 'Name', value: m.title || '', ok: 'Rename' });
    if (v == null || !v.trim()) return;
    ED.store.checkpoint('Rename map'); m.title = v.trim(); m.updatedAt = Date.now(); ED.store.commit();
  };
  MM.outline = m => { const out = []; const walk = (id, d) => { const n = node(m, id); out.push('  '.repeat(d) + (d ? '- ' : '') + (isDone(n) ? '[x] ' : d ? '[ ] ' : '') + n.text + (n.due ? ' (due ' + U.fmtDM(n.due) + ')' : '') + (n.notes ? ' — ' + n.notes.replace(/\s+/g, ' ') : '')); kids(m, id).forEach(c => walk(c.id, d + 1)); }; const r = root(m); if (r) walk(r.id, 0); return out.join('\n'); };
  A['mm-delmap'] = async () => { const m = map(); if (!m) return; const ok = await ED.ui.confirm({ title: 'Delete mind map', message: 'Delete “' + (m.title || 'this map') + '” with all its ideas? Tasks made from it stay in your planner.', ok: 'Delete', danger: true }); if (!ok) return; ED.store.checkpoint('Delete map'); MAPS().list = MAPS().list.filter(x => x.id !== m.id); st().map = null; st().node = null; ED.store.commit(); ED.ui.undoToast('Mind map deleted'); };
  A['mm-menu'] = el => {
    const m = map(); if (!m) return;
    ED.ui.menu(el, [
      { label: 'Rename the map', icon: 'pencil', onClick: () => A['mm-rename']() },
      { label: 'Copy as an outline', icon: 'copy', onClick: async () => ED.ui.toast(await U.copy(MM.outline(m)) ? 'Outline copied — paste it into a note, an email or Word' : 'Could not copy') },
      { label: 'Duplicate', icon: 'docPlus', onClick: () => { ED.store.checkpoint('Duplicate map'); const c = U.clone(m); const ids = {}; c.nodes.forEach(n => { ids[n.id] = U.uid('n'); }); c.nodes.forEach(n => { n.id = ids[n.id]; if (n.parent) n.parent = ids[n.parent]; delete n.taskId; }); c.id = U.uid('mm'); c.title = (m.title || 'Mind map') + ' (copy)'; c.createdAt = c.updatedAt = Date.now(); MAPS().list.push(c); Object.assign(st(), { map: c.id, node: null, centre: null }); ED.store.commit(); } },
      { label: 'Unfold everything', icon: 'expand', onClick: () => { m.nodes.forEach(n => { n.collapsed = false; }); ED.store.commit(); } },
      { sep: true },
      { label: 'Delete this map', icon: 'trash', danger: true, onClick: () => A['mm-delmap']() },
    ], { placement: 'right-align' });
  };
  CHG['mm-text'] = el => { const m = map(), n = m && node(m, el.dataset.id); const v = el.value.trim(); if (!n || !v || v === n.text) return; ED.store.checkpoint('Rename idea'); n.text = v; m.updatedAt = Date.now(); ED.store.commit(); };
  CHG['mm-due'] = el => { const m = map(), n = m && node(m, el.dataset.id); if (!n) return; n.due = U.isKey(el.value) ? el.value : null; const t = n.taskId && M.task(n.taskId); if (t && !t.repeat && n.due) { t.date = n.due; t.updatedAt = Date.now(); } m.updatedAt = Date.now(); ED.store.commit(); };
  CHG['mm-done'] = el => { const m = map(), n = m && node(m, el.dataset.id); if (!n) return; ED.store.checkpoint('Done'); setDone(m, n, el.checked); ED.store.commit(); };
  CHG['mm-notes'] = el => { const m = map(), n = m && node(m, el.dataset.id); if (!n || (n.notes || '') === el.value) return; n.notes = el.value; m.updatedAt = Date.now(); ED.store.commit(); };
  A['mm-color'] = el => { const m = map(), n = m && node(m, el.dataset.id); if (!n) return; if (el.dataset.c) n.color = el.dataset.c; else delete n.color; m.updatedAt = Date.now(); ED.store.commit(); };
  const toTask = (m, n) => {
    const t = M.addTask({ title: n.text, date: n.due || null, notes: 'From the mind map “' + (m.title || '') + '”: ' + pathOf(m, n) + (n.notes ? '\n\n' + n.notes : '') });
    if (n.done) M.setStatus(t, t.date || U.today(), 'done');
    n.taskId = t.id; return t;
  };
  A['mm-task'] = el => {
    const m = map(), n = m && node(m, el.dataset.id); if (!n) return;
    ED.store.checkpoint('Task from mind map'); const t = toTask(m, n); m.updatedAt = Date.now(); ED.store.commit();
    ED.ui.toast(M.code(t) + ' added ' + (t.date ? 'for ' + U.fmtDM(t.date) : 'to the master list (Monthly Tasks)'), { action: 'Open', onAction: () => ED.editors.task({ id: t.id, k: t.date || U.today() }) });
  };
  A['mm-tasks'] = el => {
    const m = map(), n = m && node(m, el.dataset.id); if (!n) return;
    const l = leaves(m, n.id).filter(x => x && x.id !== n.id && !isDone(x) && !x.taskId);
    if (!l.length) return;
    ED.store.checkpoint('Tasks from mind map'); l.forEach(x => toTask(m, x)); m.updatedAt = Date.now(); ED.store.commit();
    ED.ui.undoToast(U.plural(l.length, 'task') + ' added — dated ones on their day, the rest on the master list');
  };
  A['mm-task-open'] = el => { const m = map(), n = m && node(m, el.dataset.id); const t = n && n.taskId && M.task(n.taskId); if (t) ED.editors.task({ id: t.id, k: t.date || U.today() }); else if (n) { delete n.taskId; ED.store.commit(); } };
})();
