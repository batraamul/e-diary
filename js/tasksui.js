/* E-Diary — shared task rendering (rows, groups, status marks, badges) */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const TU = (ED.tasksUI = {});

  const STATUS_SVG = {
    open: '<svg class="ic st" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.3"/></svg>',
    progress: '<svg class="ic st" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.4" r="8"/><path d="M12 13.4V9.2M9.8 2.6h4.4M12 2.6v2.8M18.6 6.2l1.4-1.4"/></svg>',
    done: '<svg class="ic st" viewBox="0 0 24 24" aria-hidden="true"><circle class="fill-ok" cx="12" cy="12" r="10"/><path d="M7.2 12.4l3.2 3.2 6.4-6.6" stroke="#fff" stroke-width="2.3"/></svg>',
    forwarded: '<svg class="ic st" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.3"/><path d="M7 12h9.5M13 8.4l3.6 3.6-3.6 3.6"/></svg>',
    delegated: '<svg class="ic st" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.3"/><circle cx="12" cy="9.6" r="2.6"/><path d="M7.4 17.2a4.8 4.8 0 019.2 0"/></svg>',
    cancelled: '<svg class="ic st" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.3"/><path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8"/></svg>',
  };
  TU.statusIcon = st => STATUS_SVG[st] || STATUS_SVG.open;

  TU.badges = (t, max) => {
    const out = [];
    if (t.repeat) out.push('<span class="tb" title="' + e(M.repeatText(t.repeat)) + '">' + ED.letterIcon(M.repeatBadge(t.repeat)) + '</span>');
    if (t.goalId && M.goal(t.goalId)) out.push('<span class="tb" title="Goal: ' + e(M.goal(t.goalId).title) + '">' + ED.icon('target') + '</span>');
    else if (t.roleId && M.role(t.roleId)) out.push('<span class="tb" title="Role: ' + e(M.role(t.roleId).name) + '">' + ED.icon('compass') + '</span>');
    if (t.alarm && t.time) out.push('<span class="tb tb-bell" title="Alarm">' + ED.icon('bell') + '</span>');
    return out.slice(0, max || 3).join('');
  };

  TU.meta = (o) => {
    const t = o.t, bits = [];
    const h12 = ED.store.data.settings.h12;
    if (o.carried) bits.push('<span class="tm tm-late" title="Carried forward">' + ED.icon('undo') + 'since ' + e(U.fmtDM(t.date)) + '</span>');
    if (t.time) bits.push('<span class="tm num">' + ED.icon('clock') + e(U.fmtTime(t.time, h12)) + (t.dur && t.dur !== 30 ? ' · ' + (t.dur < 60 ? t.dur + ' min' : (t.dur / 60) + ' h') : '') + '</span>');
    else if (t.allDay && t.date) bits.push('<span class="tm">' + ED.icon('calendar') + 'All day</span>');
    if (t.fwdFrom && !o.carried && t.fwdFrom !== t.date) bits.push('<span class="tm" title="Moved from ' + e(U.fmtShort(t.fwdFrom)) + '">↪ ' + e(U.fmtDM(t.fwdFrom)) + '</span>');
    if (o.st === 'delegated' && t.delegatedTo) bits.push('<span class="tm">→ ' + e(t.delegatedTo) + '</span>');
    if (t.checklist && t.checklist.length) {
      const d = t.checklist.filter(c => c.done).length;
      bits.push('<span class="tm num' + (d === t.checklist.length ? ' tm-ok' : '') + '">' + ED.icon('checkSq') + d + '/' + t.checklist.length + '</span>');
    }
    const kids = M.children(t.id);
    if (kids.length && t.showSub !== 'indent') {
      const d = kids.filter(c => M.isClosed(M.statusOf(c, c.date || o.k))).length;
      bits.push('<span class="tm num" title="Subtasks">' + ED.icon('list') + d + '/' + kids.length + '</span>');
    }
    if (U.stripHtml(t.notes || '').trim()) bits.push('<span class="tm" title="Has notes">' + ED.icon('doc') + '</span>');
    return bits.length ? '<span class="tmeta">' + bits.join('') + '</span>' : '';
  };

  /* one task row */
  TU.row = (o, opts) => {
    opts = opts || {};
    const t = o.t, st = o.st;
    const cat = M.category(t.categoryId);
    const sel = ED.state && ED.state.sel === o.oid;
    const cls = ['trow', 'st-' + st, 'p-' + (t.prio || 'B')];
    if (sel) cls.push('sel');
    if (o.carried) cls.push('carried');
    if (opts.sub) cls.push('sub');
    const hide = !ED.store.data.settings.showCompleted && (st === 'done' || st === 'cancelled' || st === 'forwarded');
    if (hide) return '';
    return '<li class="' + cls.join(' ') + '" data-oid="' + e(o.oid) + '" data-tid="' + e(t.id) + '" data-k="' + e(o.k) + '"' +
      (o.carried ? ' data-carried="1"' : '') + ' draggable="true" data-drag="task" tabindex="0">' +
      '<button type="button" class="tstat" data-act="task-toggle" aria-label="' + e(M.statusLabel(st)) + ' — click to ' + (M.isClosed(st) ? 'reopen' : 'complete') + '" title="' + e(M.statusLabel(st)) + '">' + TU.statusIcon(st) + '</button>' +
      '<span class="tcode num">' + e(M.code(t)) + '</span>' +
      '<span class="tbody" data-act="task-open">' +
      '<span class="ttitle' + (cat ? ' tinted' : '') + '"' + (cat ? ' style="--c:' + e(cat.color) + '"' : '') + '>' + (t.link ? '<span class="tlink" title="' + (t.link.k === 'ward' ? 'Opens the Wardrobe “To buy” list' : 'Opens the grocery list') + '">' + ED.icon(t.link.k === 'ward' ? 'user' : 'cart') + '</span>' : '') + e(t.title || 'Untitled task') + '</span>' +
      TU.meta(o) + '</span>' +
      '<span class="tbadges">' + TU.badges(t, 2) + '</span>' +
      '<button type="button" class="tmore icon-btn sm" data-act="task-menu" aria-label="Task actions">' + ED.icon('more') + '</button>' +
      '</li>';
  };

  /* a list with subtasks tucked under their parent when the parent asks for it */
  TU.rows = (items, all) => {
    const inList = new Map(all.map(o => [o.t.id, o]));
    const tucked = o => { const p = o.t.parentId && inList.get(o.t.parentId); return !!(p && p.t.showSub === 'indent'); };
    let html = '';
    const emit = (o, depth) => {
      html += TU.row(o, { sub: depth > 0 });
      if (o.t.showSub === 'indent' && depth < 3) {
        const kids = all.filter(c => c.t.parentId === o.t.id);
        M.sortOccs(kids).forEach(c => emit(c, depth + 1));
      }
    };
    items.filter(o => !tucked(o)).forEach(o => emit(o, 0));
    return html;
  };

  TU.groups = (occs, opts) => {
    opts = opts || {};
    const groups = M.groupByRole(occs);
    if (!groups.length) return '';
    return groups.map(g => {
      const r = g.role;
      const body = TU.rows(g.items, occs);
      if (!body) return '';
      return '<section class="tgroup" data-role="' + e(g.key) + '">' +
        '<h3 class="tgroup-h' + (r ? ' tinted' : '') + '"' + (r ? ' style="--c:' + e(r.color) + '"' : '') + '>' +
        (r ? e(r.name) : 'Other tasks') + '</h3>' +
        '<ul class="tlist" data-drop="day" data-date="' + e(opts.date || '') + '">' + body + '</ul></section>';
    }).join('');
  };

  /* resolve an occurrence from a row element */
  TU.occFrom = el => {
    const row = el.closest('[data-tid]');
    if (!row) return null;
    const t = M.task(row.dataset.tid);
    if (!t) return null;
    const k = row.dataset.k || t.date || U.today();
    return M.occ(t, k, row.dataset.carried === '1');
  };

  /* context menu for a task */
  TU.menu = (anchor, o) => {
    const t = o.t;
    const today = U.today();
    const setSt = st => () => {
      if (st === 'delegated') {
        ED.ui.prompt({ title: 'Delegate task', label: 'Delegated to', value: t.delegatedTo || '', placeholder: 'Name', ok: 'Delegate' }).then(v => {
          if (v == null) return;
          t.delegatedTo = v.trim();
          M.setOccStatus(o, 'delegated'); ED.store.commit();
        });
        return;
      }
      M.setOccStatus(o, st); ED.store.commit();
    };
    const items = [
      { header: M.code(t) + ' · ' + (t.title || 'Untitled') },
      { label: 'Open…', icon: 'pencil', onClick: () => ED.editors.task({ id: t.id, k: o.k }) },
      { sep: true },
    ].concat(M.STATUSES.map(s => ({ label: s.label, html: TU.statusIcon(s.id), checked: s.id === o.st, onClick: setSt(s.id) })));
    items.push({ sep: true });
    if (o.k || t.date) {
      const from = o.k || t.date;
      items.push({ label: 'Forward to tomorrow', icon: 'forward', onClick: () => { ED.store.checkpoint('Forward'); const nt = M.moveOcc(o, U.addDays(from < today ? today : from, 1)); ED.store.commit(); ED.ui.toast('Moved to ' + U.relDay(nt.date)); } });
    }
    items.push({ label: 'Move to date…', icon: 'calendar', onClick: () => TU.pickDate(anchor, o) });
    if (t.date && ED.gcal && ED.gcal.inGoogle) { const k = 't:' + t.id, on = ED.gcal.inGoogle(k); items.push({ label: on ? 'Remove from Google Calendar' : 'Add to Google Calendar', icon: 'calendar', onClick: () => ED.gcal.setPick(k, !on) }); }
    if (!t.repeat && !t.date && !t.lvl && ED.horizons) items.push({ label: 'Schedule to a week…', icon: 'forward', onClick: () => ED.horizons.pickWeek(anchor, t) });   // Weekly Tasks (js/horizons.js)
    if (!t.repeat && t.date) items.push({ label: 'Move to Master Tasks', icon: 'list', onClick: () => { M.moveOcc(o, null); ED.store.commit(); ED.ui.toast('Moved to Master Tasks'); } });
    items.push({ label: 'Duplicate', icon: 'copy', onClick: () => { const c = M.cloneTask(t, { repeat: null, occ: {}, exdates: [], status: 'open', date: t.repeat ? o.k : t.date }); c.num = M.nextNum(c.prio, c.date); ED.store.data.tasks.push(c); ED.store.commit(); ED.ui.toast('Duplicated'); } });
    items.push({ sep: true });
    items.push({ label: t.repeat ? 'Delete…' : 'Delete', icon: 'trash', danger: true, onClick: () => TU.remove(o) });
    ED.ui.menu(anchor, items, { cls: 'task-menu' });
  };

  TU.pickDate = (anchor, o) => {
    const t = o.t;
    ED.ui.popover(anchor, '<form class="pick-date"><label class="lbl" for="pd-date">Move “' + e(t.title) + '” to</label>' +
      '<input id="pd-date" type="date" class="field" value="' + e(o.k || t.date || U.today()) + '">' +
      '<div class="row-end"><button type="submit" class="btn primary small">Move</button></div></form>', {
      onMount(el, p) {
        const inp = el.querySelector('input'); inp.focus();
        el.querySelector('form').addEventListener('submit', ev => {
          ev.preventDefault();
          if (!U.isKey(inp.value)) return;
          p.close(true);
          M.moveOcc(o, inp.value); ED.store.commit(); ED.ui.toast('Moved to ' + U.relDay(inp.value));
        });
      },
    });
  };

  TU.remove = async o => {
    const t = o.t;
    if (t.repeat) {
      const r = await ED.ui.confirm({
        title: 'Delete repeating task', message: '“' + t.title + '” repeats. Delete only ' + U.fmtShort(o.k) + ', or every occurrence?',
        choices: [{ id: 'one', label: 'Only this day', primary: false }, { id: 'all', label: 'All occurrences', danger: true }],
      });
      if (!r) return;
      ED.store.checkpoint('Delete');
      if (r === 'one') M.skipOccurrence(t, o.k); else M.deleteTask(t.id);
    } else {
      ED.store.checkpoint('Delete');
      M.deleteTask(t.id);
    }
    ED.store.commit();
    ED.ui.undoToast('Task deleted');
    return true;
  };

  /* toggle done / open from the status circle */
  TU.toggle = o => {
    const next = M.isClosed(o.st) || o.st === 'cancelled' || o.st === 'forwarded' ? 'open' : 'done';
    M.setOccStatus(o, next);
    ED.store.commit();
  };
})();
