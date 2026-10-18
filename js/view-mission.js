/* E-Diary — Mission Statement & Values, Career Graph (notes + progress graph) */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const S = () => ED.store.data.settings;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  ED.views = ED.views || {};
  let missionCtl = null, noteCtl = null;

  /* ======================= Mission & Values ======================= */
  ED.views.mission = {
    id: 'mission', label: 'Mission',
    left() {
      const editing = !!ED.state.missionEdit;
      const empty = !U.stripHtml(D().mission.html).trim() && !/<img/i.test(D().mission.html || '');
      return '<div class="mission' + (editing ? ' editing' : '') + '">' +
        '<div class="pg-head"><h2 class="pg-title">Mission Statement ' +
        '<button type="button" class="add-btn sm" data-act="mission-add" aria-label="Add a picture to the mission" title="Add a picture">' + ED.icon('plus') + '</button></h2>' +
        (editing ? '<button type="button" class="btn primary small" data-act="mission-done">Done</button>'
          : '<button type="button" class="icon-btn" data-act="mission-menu" aria-label="Mission options" title="Mission options">' + ED.icon('gear') + '</button>') +
        '</div>' +
        '<div class="mission-scroll scroll" data-keep-scroll="mission">' +
        (empty && !editing
          ? '<button type="button" class="empty mission-empty" data-act="mission-edit">' + ED.icon('compass') + '<span><b>Write your personal mission.</b><br>Who do you want to be, and what do you want to do? Begin with the end in mind. Add a photo that inspires you.</span></button>'
          : '<div id="mission-editor" class="mission-body size-' + e(D().mission.size || 'm') + '"></div>') +
        '</div></div>';
    },
    right() {
      const vals = M.valuesSorted();
      const cards = vals.map(v => {
        const st = M.valueStats(v.id);
        return '<article class="card vcard" data-id="' + e(v.id) + '" draggable="true" data-drag="value">' +
          '<div class="vc-top"><h3 class="vc-title tinted" style="--c:' + e(v.color) + '"><button type="button" class="plain-btn" data-act="value-edit" data-id="' + e(v.id) + '">' + e(v.title) + '</button></h3>' +
          '<span class="vc-stats num">Goals ' + st.done + '/' + st.total + ' <b>' + st.pct + '%</b></span></div>' +
          '<div class="vc-body"><p class="vc-desc">' + e(v.desc || '') + '</p>' +
          '<div class="vc-tools">' +
          '<button type="button" class="icon-btn sm" data-act="value-goals" data-id="' + e(v.id) + '" aria-label="Show goals for this value" title="Show goals for this value">' + ED.icon('hand') + '</button>' +
          '<button type="button" class="icon-btn sm" data-act="value-edit" data-id="' + e(v.id) + '" aria-label="Edit value" title="Edit">' + ED.icon('pencil') + '</button>' +
          '<button type="button" class="icon-btn sm" data-act="value-del" data-id="' + e(v.id) + '" aria-label="Delete value" title="Delete">' + ED.icon('trash') + '</button>' +
          '</div></div></article>';
      }).join('');
      return '<div class="values">' +
        '<div class="pg-head"><h2 class="pg-title">Values <button type="button" class="add-btn sm" data-act="value-new" aria-label="Add a value" title="Add a value">' + ED.icon('plus') + '</button></h2></div>' +
        '<div class="cards scroll" data-keep-scroll="values" data-sort="values">' +
        (cards || '<div class="empty">' + ED.icon('starO') + '<div><b>What do you stand for?</b><br>Add the values that guide your choices, then link each goal to a value.</div></div>') +
        '</div></div>';
    },
    mount(left) {
      const host = left.querySelector('#mission-editor');
      missionCtl = null;
      if (!host) return;
      const editing = !!ED.state.missionEdit;
      missionCtl = ED.rich.mount(host, {
        html: D().mission.html, toolbar: 'full', readOnly: !editing, cls: 'mission-rt' + (editing ? '' : ' readonly'),
        label: 'Mission statement', placeholder: 'Write your mission…', imageMax: 1200,
        onChange(h) { D().mission.html = h; D().meta.sampleMission = false; ED.store.commit({ silent: true }); },
      });
      if (editing) missionCtl.focus(true);
    },
    unmount() { if (missionCtl) { missionCtl.flush(); missionCtl = null; } },
  };

  A['mission-edit'] = () => { ED.state.missionEdit = true; ED.app.render(); };
  A['mission-done'] = () => { if (missionCtl) missionCtl.flush(); ED.state.missionEdit = false; ED.store.commit(); };
  A['mission-add'] = async () => {
    const f = await U.pickFile('image/*');
    if (!f) return;
    try {
      const url = await U.imageToDataURL(f, 1200);
      D().mission.html = (D().mission.html || '') + '<p style="text-align: center"><img src="' + url + '" alt="" style="width: 60%; max-width: 100%"></p>';
      D().meta.sampleMission = false;
      ED.state.missionEdit = true;
      ED.store.commit();
    } catch (err) { ED.ui.toast('Could not add that picture.'); }
  };
  A['mission-menu'] = el => {
    const m = D().mission;
    ED.ui.menu(el, [
      { label: 'Edit mission', icon: 'pencil', onClick: () => A['mission-edit']() },
      { label: 'Add a picture', icon: 'image', onClick: () => A['mission-add']() },
      { sep: true },
      { label: 'Text size: normal', checked: (m.size || 'm') === 'm', onClick: () => { m.size = 'm'; ED.store.commit(); } },
      { label: 'Text size: large', checked: m.size === 'l', onClick: () => { m.size = 'l'; ED.store.commit(); } },
      { sep: true },
      { label: 'Clear mission…', icon: 'trash', danger: true, onClick: async () => {
        const ok = await ED.ui.confirm({ title: 'Clear mission', message: 'Remove the whole mission statement, including pictures?', ok: 'Clear', danger: true });
        if (!ok) return;
        ED.store.checkpoint('Clear mission'); m.html = ''; D().meta.sampleMission = false; ED.store.commit(); ED.ui.undoToast('Mission cleared');
      } },
    ], { placement: 'right-align' });
  };
  A['value-new'] = () => ED.editors.value(null);
  A['value-edit'] = el => ED.editors.value(el.dataset.id);
  A['value-del'] = async el => {
    const v = M.value(el.dataset.id); if (!v) return;
    const ok = await ED.ui.confirm({ title: 'Delete value', message: 'Delete “' + v.title + '”? Goals linked to it stay.', ok: 'Delete', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Delete value');
    D().values = D().values.filter(x => x.id !== v.id);
    D().goals.forEach(g => { if (g.valueId === v.id) g.valueId = null; });
    ED.store.commit(); ED.ui.undoToast('Value deleted');
  };
  A['value-goals'] = el => { ED.state.goalValue = el.dataset.id; ED.go.tab('goals'); };

  /* ======================= Career Graph ======================= */
  const C = () => ED.state.career;
  const SORTS = { oldest: 'Oldest', newest: 'Newest', edited: 'Recently edited', az: 'A–Z' };
  const notesShown = () => {
    const c = C();
    let list = D().notes.filter(n => c.nb === 'all' || n.notebookId === c.nb);
    if (c.filter === 'checked') list = list.filter(n => n.done);
    if (c.filter === 'open') list = list.filter(n => !n.done);
    const by = {
      oldest: (a, b) => a.createdAt - b.createdAt,
      newest: (a, b) => b.createdAt - a.createdAt,
      edited: (a, b) => b.updatedAt - a.updatedAt,
      az: (a, b) => String(a.title || '').localeCompare(String(b.title || '')),
    }[c.sort] || ((a, b) => a.createdAt - b.createdAt);
    return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || by(a, b));
  };
  const preview = n => {
    const html = n.html || '';
    const hm = html.match(/^\s*<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
    const head = hm ? U.stripHtml(hm[1]) : '';
    const rest = U.stripHtml(hm ? html.slice(hm[0].length) : html).replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();
    return (head ? '<span class="np-head">' + e(head) + '</span>' : '') + '<span class="np-text">' + e(rest.slice(0, 220)) + '</span>';
  };

  ED.views.career = {
    id: 'career', label: 'Notes & Life',
    left() {
      const c = C();
      const nb = c.nb === 'all' ? null : M.notebook(c.nb);
      const head = '<div class="pg-head"><h2 class="pg-title">Notes &amp; Life Planner</h2>' +
        '<div class="seg" role="group" aria-label="View"><button type="button" data-act="career-mode" data-mode="notes" aria-pressed="' + (['graph', 'travel', 'grocery', 'meals', 'wardrobe'].indexOf(c.mode) < 0) + '">' + ED.icon('doc') + ' Notes</button>' +
        '<button type="button" data-act="career-mode" data-mode="graph" aria-pressed="' + (c.mode === 'graph') + '">' + ED.icon('chart') + ' Progress</button>' +
        '<button type="button" data-act="career-mode" data-mode="travel" aria-pressed="' + (c.mode === 'travel') + '">' + ED.icon('compass') + ' Travel &amp; Tour</button>' +
        '<button type="button" data-act="career-mode" data-mode="grocery" aria-pressed="' + (c.mode === 'grocery') + '">' + ED.icon('list') + ' Grocery</button>' +
        '<button type="button" data-act="career-mode" data-mode="meals" aria-pressed="' + (c.mode === 'meals') + '">' + ED.icon('calendar') + ' Weekly meals</button>' +
        (ED.wardrobe ? '<button type="button" data-act="career-mode" data-mode="wardrobe" aria-pressed="' + (c.mode === 'wardrobe') + '">' + ED.icon('user') + ' Wardrobe</button>' : '') + '</div></div>';
      if (c.mode === 'meals' && ED.lists) return ED.lists.mealMonthLeft(head);
      if (c.mode === 'wardrobe' && ED.wardrobe) return ED.wardrobe.left(head);
      if (c.mode === 'travel' && ED.lists) return ED.lists.travelLeft(head);
      if (c.mode === 'grocery' && ED.lists) return ED.lists.grocLeft(head);
      if (c.mode === 'graph') return '<div class="career">' + head + '<div class="graph scroll" data-keep-scroll="graph">' + graphHtml() + '</div></div>';
      const list = notesShown();
      const cards = list.map(n => {
        const book = M.notebook(n.notebookId);
        return '<article class="ncard' + (n.id === c.noteId ? ' sel' : '') + '" data-act="note-open" data-id="' + e(n.id) + '" tabindex="0">' +
          '<h3 class="nc-title">' + (n.pinned ? ED.icon('pin') : '') + e(n.title || 'Untitled note') + '</h3>' +
          '<p class="nc-prev">' + preview(n) + '</p>' +
          '<div class="nc-foot"><span class="hint num">' + e(U.fmtShort(U.key(new Date(n.createdAt)))) + (c.nb === 'all' && book ? ' · ' + e(book.icon || '') + ' ' + e(book.name) : '') + '</span>' +
          '<button type="button" class="nc-check' + (n.done ? ' on' : '') + '" data-act="note-check" data-id="' + e(n.id) + '" aria-pressed="' + !!n.done + '" aria-label="' + (n.done ? 'Checked' : 'Not checked') + '" title="Mark as done / achieved">' + ED.icon(n.done ? 'checkSq' : 'square') + '</button></div></article>';
      }).join('');
      const filterLabel = { all: 'All Notes', checked: 'Checked', open: 'Not checked' }[c.filter || 'all'];
      return '<div class="career">' + head +
        '<div class="crumbs">' +
        '<button type="button" class="crumb" data-act="nb-menu">' + (nb ? '<span class="emo">' + e(nb.icon || '📒') + '</span>' + e(nb.name) : '<span class="emo">📚</span>All notebooks') + ' ' + ED.icon('chevD') + '</button>' +
        '<span class="crumb-sep">' + ED.icon('chevR') + '</span>' +
        '<button type="button" class="crumb" data-act="note-filter">' + filterLabel + ' ' + ED.icon('chevD') + '</button></div>' +
        '<div class="note-tools">' +
        '<button type="button" class="tool-chip" data-act="note-sort">' + ED.icon('sort') + e(SORTS[c.sort] || 'Oldest') + '</button>' +
        '<button type="button" class="tool-chip" data-act="note-view">' + ED.icon(c.view === 'list' ? 'list' : 'grid') + 'View</button>' +
        '<span class="grow"></span><button type="button" class="btn small primary" data-act="note-new">' + ED.icon('plus') + 'New note</button></div>' +
        '<div class="notes-list ' + (c.view === 'list' ? 'as-list' : 'as-grid') + ' scroll" data-keep-scroll="notes">' +
        (cards || '<div class="empty">' + ED.icon('notebook') + '<div><b>No notes here yet.</b><br>Keep career plans, milestones and ideas here.</div></div>') + '</div>' +
        '</div>';
    },
    right() {
      const c = C();
      if (c.mode === 'graph') return analysisHtml();
      if (c.mode === 'travel' && ED.lists) return ED.lists.travelRight();
      if (c.mode === 'grocery' && ED.lists) return ED.lists.grocRight();
      if (c.mode === 'meals' && ED.lists) return ED.lists.mealMonthRight();
      if (c.mode === 'wardrobe' && ED.wardrobe) return ED.wardrobe.right();
      const n = c.noteId && M.note(c.noteId);
      if (!n) {
        return '<div class="note-empty-wrap"><button type="button" class="note-empty" data-act="note-new">' +
          '<svg viewBox="0 0 64 64" aria-hidden="true" class="big-doc"><path d="M16 6h22l12 12v38a2 2 0 01-2 2H16a2 2 0 01-2-2V8a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M38 6v12h12" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>' +
          '<span>Create a new note.</span></button></div>';
      }
      return '<div class="note-ed">' +
        '<div class="ne-head"><input id="ne-title" class="ne-title" value="' + e(n.title) + '" placeholder="Title" aria-label="Note title" autocomplete="off">' +
        '<div class="ne-tools">' +
        '<label class="sr-only" for="ne-nb">Notebook</label><select id="ne-nb" class="field">' + D().notebooks.map(b => '<option value="' + e(b.id) + '"' + (b.id === n.notebookId ? ' selected' : '') + '>' + e((b.icon ? b.icon + ' ' : '') + b.name) + '</option>').join('') + '</select>' +
        '<button type="button" class="icon-btn' + (n.pinned ? ' active' : '') + '" data-act="note-pin" aria-pressed="' + !!n.pinned + '" aria-label="Pin to top" title="Pin to top">' + ED.icon('pin') + '</button>' +
        '<button type="button" class="icon-btn" data-act="note-del" aria-label="Delete note" title="Delete note">' + ED.icon('trash') + '</button>' +
        '<button type="button" class="icon-btn" data-act="note-close" aria-label="Close note" title="Close">' + ED.icon('x') + '</button>' +
        '</div></div>' +
        '<div class="ne-meta hint num">Created ' + e(U.fmtStamp(n.createdAt)) + ' · Edited ' + e(U.fmtStamp(n.updatedAt)) + '</div>' +
        '<div id="note-body" class="ne-body"></div></div>';
    },
    mount(left, right) {
      noteCtl = null;
      bindChart(left); bindChart(right);
      const c = C();
      if (c.mode === 'graph' || c.mode === 'travel' || c.mode === 'grocery' || c.mode === 'meals' || c.mode === 'wardrobe') return;
      const n = c.noteId && M.note(c.noteId);
      if (!n) return;
      const title = right.querySelector('#ne-title');
      const touch = () => { n.updatedAt = Date.now(); ED.store.commit({ silent: true }); refreshCard(n); };
      title.addEventListener('input', U.debounce(() => { n.title = title.value.trim(); touch(); }, 300));
      right.querySelector('#ne-nb').addEventListener('change', ev => { n.notebookId = ev.target.value; n.updatedAt = Date.now(); ED.store.commit(); });
      noteCtl = ED.rich.mount(right.querySelector('#note-body'), {
        html: n.html, toolbar: 'full', label: 'Note', placeholder: 'Start writing…',
        onChange(h) { n.html = h; delete n.sample; touch(); },
      });
      if (ED.state.focusNoteTitle) { ED.state.focusNoteTitle = false; setTimeout(() => title.focus(), 30); }
    },
    unmount() { if (noteCtl) { noteCtl.flush(); noteCtl = null; } },
  };
  ED.views.career.mountGraph = bindChart;

  function refreshCard(n) {
    const card = document.querySelector('.ncard[data-id="' + n.id + '"]');
    if (!card) return;
    const t = card.querySelector('.nc-title'); if (t) t.textContent = n.title || 'Untitled note';
    const p = card.querySelector('.nc-prev'); if (p) p.innerHTML = preview(n);
  }

  /* ---------- progress (graph mode) ---------- */
  const CH = ED.charts;
  const r0 = v => Math.round(v);
  function graphHtml() {
    const today = U.today();
    const nW = C().weeks || 12;
    const weeks = M.weeklyStats(nW);
    const month = M.monthStats(U.firstOfMonth(today));
    const yearAch = M.achievements().filter(g => (g.doneAt || '').slice(0, 4) === today.slice(0, 4)).length;
    const tot = weeks.reduce((a, w) => a + w.total, 0), dn = weeks.reduce((a, w) => a + w.done, 0);
    const streak = M.diaryStreak();
    const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null, cur = weeks[weeks.length - 1];
    const trend = prev && prev.total && cur.total ? cur.pct - prev.pct : null;
    const tiles =
      '<div class="tiles">' +
      tile('Tasks done this month', month.done, 'of ' + month.total + ' planned') +
      tile('Completion, last ' + nW + ' weeks', tot ? r0(dn / tot * 100) + '%' : '—', dn + ' of ' + tot + ' tasks') +
      tile('This week', cur && cur.total ? cur.pct + '%' : '—', trend == null ? (cur ? cur.done + ' of ' + cur.total : '') : (trend >= 0 ? '▲ ' : '▼ ') + Math.abs(trend) + ' points vs last week') +
      tile('Diary streak', streak, (streak === 1 ? 'day' : 'days') + ' · ' + yearAch + ' goals achieved in ' + today.slice(0, 4)) +
      '</div>';
    const periodSeg = '<div class="seg pg-period" role="group" aria-label="Period">' + [4, 12, 26].map(n => '<button type="button" data-act="career-weeks" data-weeks="' + n + '" aria-pressed="' + (nW === n) + '">' + n + ' weeks</button>').join('') + '</div>';
    const cols = CH.columns({
      title: 'Tasks done per week', cur: weeks.length - 1, capCur: d => d.value + '/' + d.total, maxLabels: 8,
      data: weeks.map(w => ({ label: U.fmtMD(w.start), long: 'Week of ' + U.fmtMD(w.start), value: w.done, total: w.total, tip: w.done + ' done of ' + w.total + (w.total ? ' (' + w.pct + '%)' : '') })),
      legend: CH.legend([{ kind: 'done', color: 'var(--accent)', label: 'Done' }, { kind: 'total', color: 'var(--chart-track)', label: 'Planned' }]),
      table: CH.table(['Week of', 'Done', 'Planned', '%'], weeks.map(w => [U.fmtShort(w.start), w.done, w.total, w.total ? w.pct + '%' : '—'])),
    });
    const rate = CH.lines({
      title: 'Share of planned tasks completed', labels: weeks.map(w => U.fmtMD(w.start)), long: weeks.map(w => 'Week of ' + U.fmtMD(w.start)),
      series: [{ name: 'Completed', color: 'var(--s1)', points: weeks.map(w => w.total ? w.pct : null), area: true }],
      fmt: v => r0(v) + '%', tipFmt: v => v + '%', h: 190, sub: 'Weeks with nothing planned are left as gaps.',
      table: CH.table(['Week of', 'Completed %'], weeks.map(w => [U.fmtShort(w.start), w.total ? w.pct + '%' : '—'])),
    });
    // study hours per week, when a study plan exists
    let study = '';
    if (ED.study && ED.study.plan()) {
      // the same calendar weeks as the task charts: hours studied in each (the day you studied), against hours planned for it
      const ST = ED.study;
      const sws = weeks.map(w => { const b = U.addDays(w.start, 6); return { start: w.start, studied: ST.studiedBetween(w.start, b), planned: ST.plannedBetween(w.start, b) }; });
      const hh = m => Math.round(m / 6) / 10;
      if (sws.some(x => x.studied || x.planned)) study = CH.columns({
        title: 'Study hours per week', cur: sws.length - 1, maxLabels: 8, fmt: v => r0(v) + '',
        data: sws.map(x => ({ label: U.fmtMD(x.start), long: 'Week of ' + U.fmtMD(x.start), value: hh(x.studied), total: hh(x.planned), tip: hh(x.studied) + ' h studied of ' + hh(x.planned) + ' h planned' })),
        legend: CH.legend([{ kind: 'done', color: 'var(--accent)', label: 'Studied' }, { kind: 'total', color: 'var(--chart-track)', label: 'Planned' }]),
        table: CH.table(['Week of', 'Studied (h)', 'Planned (h)'], sws.map(x => [U.fmtShort(x.start), hh(x.studied), hh(x.planned)])),
      });
    }
    const ach = M.achievements();
    const timeline = '<section class="ach-line"><h3 class="gh">Achievements</h3>' + (ach.length ? '<ol>' + ach.map(g =>
      '<li><span class="al-date num">' + e(U.fmtShort(g.doneAt)) + '</span><span class="al-dot" aria-hidden="true"></span><span class="al-text"><button type="button" class="plain-btn" data-act="goal-edit" data-id="' + e(g.id) + '">' + e(g.title) + '</button>' +
      '<span class="hint">' + M.goalDays(g) + ' days' + (M.value(g.valueId) ? ' · ' + e(M.value(g.valueId).title) : '') + '</span></span></li>').join('') + '</ol>'
      : '<p class="hint">Achieved goals will appear here as milestones of your career.</p>') + '</section>';
    return '<div class="pg-period-row">' + periodSeg + '</div>' + tiles + cols + rate + study + timeline;
  }
  function tile(label, value, sub) {
    return '<div class="tile"><span class="tile-l">' + e(label) + '</span><span class="tile-v">' + e(String(value)) + '</span><span class="tile-s hint">' + e(sub) + '</span></div>';
  }
  /* right page in progress mode: where the work went */
  function analysisHtml() {
    const today = U.today();
    const nW = C().weeks || 12;
    const from = U.addDays(U.startOfWeek(today, S().weekStart), -7 * (nW - 1));
    const P = M.periodStats(from, today);
    const pctL = x => x.total ? r0(x.done / x.total * 100) + '%' : '—';
    const rowsFrom = (map, label, swatch) => Array.from(map.entries()).map(([k, x]) => ({ k, x })).sort((a, b) => b.x.total - a.x.total)
      .map(({ k, x }) => ({ label: label(k), swatch: swatch ? swatch(k) : null, value: x.done, total: x.total, valueLabel: x.done + '/' + x.total + ' · ' + pctL(x), tip: pctL(x) + ' of planned tasks done' }));
    const legend = CH.legend([{ kind: 'done', color: 'var(--accent)', label: 'Done' }, { kind: 'total', color: 'var(--chart-track)', label: 'Planned' }]);
    const tbl = rows => CH.table(['', 'Done', 'Planned', '%'], rows.map(r => [r.label, r.value, r.total, r.total ? r0(r.value / r.total * 100) + '%' : '—']));
    const roleRows = rowsFrom(P.byRole, k => { const r = M.role(k); return r ? r.name : 'No role'; }, k => { const r = M.role(k); return r ? r.color : 'var(--ink-3)'; });
    const prioRows = ['A', 'B', 'C', 'D'].filter(p => P.byPrio.has(p)).map(p => { const x = P.byPrio.get(p); return { label: p + ' — ' + M.PRIO_HELP[p], value: x.done, total: x.total, valueLabel: x.done + '/' + x.total + ' · ' + pctL(x), tip: pctL(x) + ' done' }; });
    const catRows = rowsFrom(P.byCat, k => { const c = M.category(k); return c ? (c.icon ? c.icon + ' ' : '') + c.name : 'No category'; }, k => { const c = M.category(k); return c ? c.color : 'var(--ink-3)'; });
    const order = [1, 2, 3, 4, 5, 6, 0];
    const dow = CH.columns({
      title: 'Which days get things done', maxLabels: 7, fmt: v => r0(v) + '%',
      data: order.map(d => { const x = P.byDow[d]; const p = x.total ? r0(x.done / x.total * 100) : 0; return { label: U.DAY3[d], long: U.DAYS[d] + 's', value: p, tip: x.total ? p + '% done (' + x.done + ' of ' + x.total + ')' : 'Nothing planned' }; }),
      sub: 'Share of planned tasks completed on each weekday.',
      table: CH.table(['Day', 'Done', 'Planned', '%'], order.map(d => { const x = P.byDow[d]; return [U.DAYS[d], x.done, x.total, x.total ? r0(x.done / x.total * 100) + '%' : '—']; })),
    });
    const st = P.status;
    const stRows = [['done', 'Completed'], ['delegated', 'Delegated'], ['open', 'Still open'], ['forwarded', 'Forwarded'], ['cancelled', 'Cancelled']].filter(x => st[x[0]]).map(x => ({ label: x[1], value: st[x[0]], valueLabel: String(st[x[0]]), tip: st[x[0]] + ' task days' }));
    const goals = M.activeGoals().map(g => { const gs = M.goalStats(g.id); return { label: g.title, swatch: g.color, value: gs.pct, total: 100, valueLabel: gs.pct + '%' + (g.due ? ' · due ' + U.fmtDM(g.due) : ''), tip: gs.done + ' of ' + gs.total + ' linked tasks done' }; });
    const blocks = [
      roleRows.length ? CH.meters({ title: 'By role', legend, rows: roleRows, table: tbl(roleRows) }) : '',
      prioRows.length ? CH.meters({ title: 'By priority', legend, rows: prioRows, table: tbl(prioRows), sub: 'Are the A tasks — the frogs — getting done first?' }) : '',
      dow,
      catRows.length ? CH.meters({ title: 'By category', legend, rows: catRows, table: tbl(catRows) }) : '',
      goals.length ? CH.meters({ title: 'Goals in progress', rows: goals, max: 100, table: CH.table(['Goal', 'Progress'], goals.map(g => [g.label, g.valueLabel])) }) : '',
      stRows.length ? CH.meters({ title: 'How planned tasks ended', rows: stRows, table: CH.table(['Status', 'Count'], stRows.map(r => [r.label, r.value])), sub: 'Every day a task was on your list counts once.' }) : '',
    ].join('');
    return '<div class="career career-r"><div class="pg-head"><h2 class="pg-title">Progress analysis</h2><span class="hint">' + e(U.fmtShort(from)) + ' – ' + e(U.fmtShort(today)) + '</span></div>' +
      '<div class="graph scroll" data-keep-scroll="analysis">' + (P.total ? blocks : '<div class="empty">' + ED.icon('chart') + '<div><b>No tasks in this period yet.</b><br>Plan tasks on the Daily page and tick them off — this page shows where the work went.</div></div>') + '</div></div>';
  }
  function bindChart(root) { CH.bind(root); }

  /* ---------- career actions ---------- */
  A['career-mode'] = el => { C().mode = el.dataset.mode; ED.app.render(); };
  A['career-weeks'] = el => { C().weeks = +el.dataset.weeks; ED.app.render(); };
  A['note-open'] = (el, ev) => {
    if (ev && ev.target.closest('[data-act="note-check"]')) return;
    C().noteId = el.dataset.id;
    ED.app.render();
  };
  A['note-check'] = (el, ev) => {
    if (ev) ev.stopPropagation();
    const n = M.note(el.dataset.id); if (!n) return;
    n.done = !n.done; n.updatedAt = Date.now(); ED.store.commit();
  };
  A['note-new'] = () => {
    const c = C();
    let nbId = c.nb !== 'all' ? c.nb : (D().notebooks[0] && D().notebooks[0].id);
    if (!nbId) { const nb = { id: U.uid('nb'), name: 'Career', icon: '📚' }; D().notebooks.push(nb); nbId = nb.id; }
    const n = { id: U.uid('n'), notebookId: nbId, title: '', html: '', done: false, pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
    D().notes.push(n);
    c.noteId = n.id; c.mode = 'notes';
    ED.state.focusNoteTitle = true;
    ED.store.commit();
  };
  A['note-close'] = () => { C().noteId = null; ED.app.render(); };
  A['note-pin'] = () => { const n = M.note(C().noteId); if (!n) return; n.pinned = !n.pinned; ED.store.commit(); };
  A['note-del'] = async () => {
    const n = M.note(C().noteId); if (!n) return;
    const ok = await ED.ui.confirm({ title: 'Delete note', message: 'Delete “' + (n.title || 'Untitled note') + '”?', ok: 'Delete', danger: true });
    if (!ok) return;
    ED.store.checkpoint('Delete note');
    D().notes = D().notes.filter(x => x.id !== n.id);
    C().noteId = null;
    ED.store.commit(); ED.ui.undoToast('Note deleted');
  };
  A['note-sort'] = el => {
    const c = C();
    ED.ui.menu(el, Object.keys(SORTS).map(k => ({ label: SORTS[k], checked: c.sort === k, onClick: () => { c.sort = k; ED.app.renderPage('left'); } })));
  };
  A['note-view'] = () => { const c = C(); c.view = c.view === 'list' ? 'grid' : 'list'; ED.app.renderPage('left'); };
  A['note-filter'] = el => {
    const c = C();
    ED.ui.menu(el, [['all', 'All Notes'], ['checked', 'Checked'], ['open', 'Not checked']].map(x => ({ label: x[1], checked: (c.filter || 'all') === x[0], onClick: () => { c.filter = x[0]; ED.app.renderPage('left'); } })));
  };
  A['nb-menu'] = el => {
    const c = C();
    const items = [{ label: 'All notebooks', html: '<span class="emo">📚</span>', checked: c.nb === 'all', onClick: () => { c.nb = 'all'; ED.app.renderPage('left'); } }]
      .concat(D().notebooks.map(nb => ({ label: nb.name, html: '<span class="emo">' + e(nb.icon || '📒') + '</span>', checked: c.nb === nb.id, onClick: () => { c.nb = nb.id; ED.app.renderPage('left'); } })));
    items.push({ sep: true }, { label: 'New notebook…', icon: 'plus', onClick: () => ED.editors.notebook(null) });
    if (c.nb !== 'all') items.push({ label: 'Rename or delete this notebook…', icon: 'pencil', onClick: () => ED.editors.notebook(c.nb) });
    ED.ui.menu(el, items);
  };
})();
