/* E-Diary — 1.24: Study → Roadmap — the broader, long-term plan.
   Subjects you mean to learn over months or years, each with the topics to cover (and rough hours), why, and a target
   date. When you are ready, "Put into the plan…" takes chosen topics into the study plan: as the topics of a subject's
   next open sessions, or as new sessions on chosen days. A topic then shows "in the plan"; when its session is ticked
   it becomes done by itself (and goes back to "to do" if that session is deleted). Topics are checked for duplicates.
   Data: ED.store.data.roadmap = { subjects: [ { id, name, why, target, color, topics: [ { id, name, hrs, st: 'todo' |
          'plan' | 'done', sid, trackId } ], createdAt, updatedAt } ] } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const ST = ED.study;
  const FX = () => ED.fx;
  const A = (ED.actions = ED.actions || {}), CH = (ED.changes = ED.changes || {}), F = (ED.forms = ED.forms || {});
  const RM = (ED.roadmap = {});
  const D = () => ED.store.data;
  const PAL = ['#2563eb', '#7c3aed', '#16a34a', '#ea580c', '#db2777', '#0891b2', '#ca8a04', '#64748b'];
  const RD = () => { const d = D(); if (!d.roadmap || typeof d.roadmap !== 'object') d.roadmap = {}; if (!Array.isArray(d.roadmap.subjects)) d.roadmap.subjects = []; return d.roadmap; };
  const st = () => ED.state.rm || (ED.state.rm = { sel: null, pick: new Set() });
  const low = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cur = () => { const l = RD().subjects; let x = l.find(s => s.id === st().sel); if (!x) { x = l[0] || null; st().sel = x ? x.id : null; } return x; };
  const count = x => { const t = x.topics || []; return { n: t.length, done: t.filter(y => y.st === 'done').length, plan: t.filter(y => y.st === 'plan').length, hrs: t.reduce((a, y) => a + (+y.hrs || 0), 0), hdone: t.filter(y => y.st === 'done').reduce((a, y) => a + (+y.hrs || 0), 0) }; };
  const touch = x => { x.updatedAt = Date.now(); };

  /* ---------------- left page: the subjects ---------------- */
  const left = () => {
    const l = RD().subjects, x = cur(), today = U.today();
    const cards = l.map((s, i) => { const c = count(s), col = s.color || PAL[i % PAL.length], left = s.target ? U.diffDays(today, s.target) : null;
      return '<button type="button" class="rm-card' + (x && x.id === s.id ? ' sel' : '') + '" style="--c:' + col + '" data-act="rm-sel" data-id="' + e(s.id) + '" aria-pressed="' + !!(x && x.id === s.id) + '">' +
        '<span class="rm-ch"><b>' + e(s.name) + '</b>' + (s.target ? '<span class="hint">' + (left < 0 ? 'target passed' : 'by ' + e(U.fmtShort(s.target))) + '</span>' : '') + '</span>' +
        '<span class="rm-bar" title="' + c.done + ' done, ' + c.plan + ' in the plan, of ' + c.n + '"><i class="d" style="width:' + (c.n ? c.done / c.n * 100 : 0) + '%"></i><i class="p" style="width:' + (c.n ? c.plan / c.n * 100 : 0) + '%"></i></span>' +
        '<span class="hint num">' + c.done + '/' + c.n + ' topics done' + (c.plan ? ' · ' + c.plan + ' in the plan' : '') + (c.hrs ? ' · ' + Math.round(c.hdone) + '/' + Math.round(c.hrs) + ' h' : '') + '</span></button>'; }).join('');
    const tot = l.reduce((a, s) => { const c = count(s); a.n += c.n; a.d += c.done; a.p += c.plan; return a; }, { n: 0, d: 0, p: 0 });
    const body = (l.length ? '<div class="tiles xp-tiles">' + FX().tile('Subjects', String(l.length), 'long-term') + FX().tile('Topics', String(tot.n), tot.d + ' done') + FX().tile('In the plan', String(tot.p), 'waiting in sessions') + '</div>' : '') +
      '<form class="rm-add" data-form="rm-add"><input name="name" class="field" placeholder="A long-term subject — e.g. Quantum computing, Sanskrit, Public speaking" aria-label="New subject" required><button type="submit" class="btn small primary">' + ED.icon('plus') + 'Add</button></form>' +
      (cards ? '<div class="rm-cards">' + cards + '</div>' : '<div class="empty">🧭<div><b>Your long-term roadmap</b><br>Keep the subjects you want to learn over the coming months and years, with the topics to cover. Move topics into your study plan when you are ready.</div></div>');
    return FX().page('rm', 'Roadmap', '', body, 'rm-l');
  };

  /* ---------------- right page: one subject's topics ---------------- */
  const SC = { todo: ['To do', ''], plan: ['In the plan', 'p'], done: ['Done', 'd'] };
  const right = () => {
    const x = cur();
    if (!x) return FX().page('rm rm-r', 'Topics', '', '<p class="hint">Add a long-term subject on the left, then its topics here.</p>', 'rm-r');
    const s = st(), c = count(x), t = x.topics || [];
    const rows = t.map(y => { const ses = y.sid && ST.session(y.sid);
      return '<li class="rm-t s-' + (y.st || 'todo') + '"><input type="checkbox" class="rm-pk" data-change="rm-pick" data-id="' + e(y.id) + '"' + (s.pick.has(y.id) ? ' checked' : '') + (y.st !== 'todo' ? ' disabled' : '') + ' aria-label="Choose ' + e(y.name) + '">' +
        '<input class="field rm-tn" data-change="rm-tedit" data-f="name" data-id="' + e(y.id) + '" value="' + e(y.name) + '" aria-label="Topic">' +
        '<input class="field num rm-th" type="number" min="0" step="0.5" data-change="rm-tedit" data-f="hrs" data-id="' + e(y.id) + '" value="' + e(y.hrs || '') + '" placeholder="h" aria-label="Hours">' +
        '<button type="button" class="rm-st ' + SC[y.st || 'todo'][1] + '" data-act="rm-st" data-id="' + e(y.id) + '" title="' + (y.st === 'plan' ? 'In the plan' + (ses ? ' on ' + U.fmtShort(ses.date) : '') + ' — ticked there makes it done' : 'Click to change') + '">' + SC[y.st || 'todo'][0] + (ses && y.st === 'plan' ? ' · ' + e(U.fmtDM(ses.date)) : '') + '</button>' +
        '<button type="button" class="icon-btn sm" data-act="rm-tdel" data-id="' + e(y.id) + '" aria-label="Remove ' + e(y.name) + '" title="Remove">' + ED.icon('x') + '</button></li>'; }).join('');
    const body = '<div class="rm-head"><div><span class="hint">' + (x.why ? e(x.why) : 'Why this matters — add it with Edit') + '</span></div><button type="button" class="btn small ghost" data-act="rm-edit">' + ED.icon('pencil') + 'Edit</button></div>' +
      '<div class="tiles xp-tiles">' + FX().tile('Topics', String(c.n), c.done + ' done · ' + c.plan + ' in the plan') + FX().tile('Hours', c.hrs ? Math.round(c.hrs) + ' h' : '—', c.hrs ? Math.round(c.hdone) + ' h done' : 'add hours to topics') + FX().tile('Target', x.target ? U.fmtShort(x.target) : '—', x.target ? (U.diffDays(U.today(), x.target) >= 0 ? U.plural(U.diffDays(U.today(), x.target), 'day') + ' left' : 'passed') : 'set one with Edit') + '</div>' +
      '<form class="rm-tadd" data-form="rm-tadd"><textarea name="t" class="field" rows="3" placeholder="Topics to cover, one a line — add hours after a | if you like:&#10;Basics of qubits | 6&#10;Quantum gates | 8"></textarea><button type="submit" class="btn small primary">' + ED.icon('plus') + 'Add topics</button></form>' +
      (t.length ? '<div class="rm-bulk"><button type="button" class="btn small primary" data-act="rm-toplan"' + (s.pick.size ? '' : ' disabled') + '>' + ED.icon('calendar') + 'Put into the plan' + (s.pick.size ? ' (' + s.pick.size + ')' : '') + '…</button><button type="button" class="link-btn" data-act="rm-pickall">Choose all “to do”</button></div><ul class="rm-tl">' + rows + '</ul>' : '<p class="hint">No topics yet.</p>');
    return FX().page('rm rm-r', e(x.name), '', body, 'rm-r');
  };

  /* ---------------- into the study plan ---------------- */
  RM.toPlan = (x, ids, v) => {
    const p = ST.plan(); if (!p) return { n: 0, msg: 'Make or import a study plan first.' };
    const topics = (x.topics || []).filter(y => ids.indexOf(y.id) >= 0 && (y.st || 'todo') === 'todo');
    let tr = v.track ? ST.track(v.track) : p.tracks.find(t => low(t.name) === low(x.name)) || null;
    if (!tr) tr = ST.addTrack(x.name);
    let n = 0;
    if (v.how === 'fill') {
      const open = ST.sessions().filter(s => s.trackId === tr.id && !s.done && !s.topic && s.date >= (v.from || U.today()));
      topics.forEach((y, i) => { const s = open[i]; if (!s) return; s.topic = y.name; s.updatedAt = Date.now(); y.st = 'plan'; y.sid = s.id; y.trackId = tr.id; n++; });
      return { n, tr, msg: n < topics.length ? U.plural(topics.length - n, 'topic') + ' did not fit — not enough empty sessions; add sessions or choose “new sessions”.' : '' };
    }
    let k = v.from || U.today(), guard = 0;
    topics.forEach(y => {
      while (v.days.indexOf(U.dow(k)) < 0 && guard++ < 800) k = U.addDays(k, 1);
      const s = { id: U.uid('ss'), week: 0, date: k, slotNo: 1, kind: '', slot: ST.slotText(1, ''), trackId: tr.id, min: Math.max(5, Math.round(+v.min || ((+y.hrs || 0) * 60) || 60)), topic: y.name, sourceId: '', source: '', done: false, doneAt: null, doneOn: null, spent: null, time: v.time || null, note: '', own: true, updatedAt: Date.now() };
      D().study.sessions.push(s); y.st = 'plan'; y.sid = s.id; y.trackId = tr.id; n++; k = U.addDays(k, 1);
    });
    if (ED.studyEdit) ED.studyEdit.after();
    return { n, tr, msg: '' };
  };
  /* a planned topic follows its session: ticked → done; deleted → back to do */
  RM.reconcile = () => {
    const d = D(); if (!d || !d.roadmap || !Array.isArray(d.roadmap.subjects) || !ST || !ST.plan()) return false;
    let ch = false;
    d.roadmap.subjects.forEach(x => (x.topics || []).forEach(y => {
      if (!y.sid || y.st === 'todo') return;
      const s = ST.session(y.sid);
      if (!s) { if (y.st === 'plan') { y.st = 'todo'; delete y.sid; ch = true; } return; }
      if (s.done && y.st !== 'done') { y.st = 'done'; ch = true; } else if (!s.done && y.st === 'done' && y.auto !== false) { y.st = 'plan'; ch = true; }
    }));
    return ch;
  };
  ED.store.on((type, dt) => { if (type !== 'change' || (dt && dt.reason === 'roadmap')) return; if (RM.reconcile()) ED.store.commit({ reason: 'roadmap' }); });

  RM.planDialog = () => {
    const x = cur(), ids = Array.from(st().pick); if (!x || !ids.length) return;
    const p = ST.plan(); if (!p) { ED.ui.toast('Make or import a study plan first (Study → Year → Plan)'); return; }
    const match = p.tracks.find(t => low(t.name) === low(x.name));
    const t = U.today(), o = (v, l, s) => '<option value="' + e(v) + '"' + (s ? ' selected' : '') + '>' + e(l) + '</option>';
    ED.ui.modal({
      title: 'Put ' + U.plural(ids.length, 'topic') + ' into the study plan', cls: 'st-modal wide',
      body: '<div class="st-form"><div class="sa-row"><label class="sa-f"><span>Subject in the plan</span><select id="rp-tr" class="field">' + o('', '➕ New: ' + x.name, !match) + p.tracks.map(tr => o(tr.id, tr.name, match && tr.id === match.id)).join('') + '</select></label>' +
        '<label class="sa-f"><span>From</span><input id="rp-from" type="date" class="field" value="' + t + '"></label></div>' +
        '<div class="sa-radio"><label class="sa-r"><input type="radio" name="rp-how" value="fill"' + (match ? ' checked' : '') + '><span><b>As the topics of its next sessions</b><small>Fills sessions of that subject that have no topic yet, one topic each, in order</small></span></label>' +
        '<label class="sa-r"><input type="radio" name="rp-how" value="new"' + (match ? '' : ' checked') + '><span><b>As new sessions</b><small>One session a topic, on the days you choose</small></span></label></div>' +
        '<div class="rp-new"><div class="sa-days">' + [1, 2, 3, 4, 5, 6, 0].map(d => '<label class="chip-check"><input type="checkbox" data-d="' + d + '"' + (d === 6 || d === 0 ? ' checked' : '') + '><span>' + U.DAY3[d] + '</span></label>').join('') + '</div>' +
        '<div class="sa-row"><label class="sa-f"><span>Time</span><input id="rp-time" type="time" class="field"></label><label class="sa-f"><span>Minutes (empty = the topic’s hours)</span><input id="rp-min" type="number" class="field num" min="5" step="5" placeholder="60"></label></div></div>' +
        '<p class="hint">Times already used that day are marked ⚠ on the study pages so you can move one.</p></div>',
      footer: '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="ok">' + ED.icon('check') + 'Put into the plan</button>',
      onMount(el, api) {
        const how = () => (el.querySelector('input[name="rp-how"]:checked') || {}).value;
        const sync = () => { el.querySelector('.rp-new').hidden = how() !== 'new'; };
        el.addEventListener('change', sync); sync();
        el.querySelector('[data-x="ok"]').addEventListener('click', () => {
          const v = { track: el.querySelector('#rp-tr').value, from: el.querySelector('#rp-from').value, how: how(), days: U.$$('.rp-new [data-d]', el).filter(i => i.checked).map(i => +i.dataset.d), time: el.querySelector('#rp-time').value, min: +el.querySelector('#rp-min').value || 0 };
          if (v.how === 'new' && !v.days.length) { ED.ui.toast('Tick at least one day'); return; }
          ED.store.checkpoint('Roadmap → plan');
          const r = RM.toPlan(x, ids, v); touch(x); st().pick.clear();
          ED.store.commit(); api.close();
          ED.ui.undoToast(r.n ? U.plural(r.n, 'topic') + ' now in the plan under “' + r.tr.name + '”' + (r.msg ? ' — ' + r.msg : '') : (r.msg || 'Nothing was added'));
        });
      },
    });
  };
  RM.edit = id => {
    const x = id ? RD().subjects.find(s => s.id === id) : null; if (!x) return;
    FX().form({ title: x.name, data: x, fields: [{ k: 'name', label: 'Subject', req: true }, { k: 'why', label: 'Why it matters', type: 'textarea', rows: 2 }, { k: 'target', label: 'Target date', type: 'date' }, { k: 'color', label: 'Colour', type: 'select', options: [['', 'Automatic']].concat(PAL.map((c, i) => [c, ['Blue', 'Violet', 'Green', 'Orange', 'Pink', 'Teal', 'Gold', 'Slate'][i]])) }],
      del: async () => { if (!await ED.ui.confirm({ title: 'Delete “' + x.name + '”', message: 'Delete this subject and its ' + U.plural((x.topics || []).length, 'topic') + '? Sessions already in the study plan stay.', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Roadmap'); RD().subjects = RD().subjects.filter(s => s !== x); st().sel = null; ED.store.commit(); ED.ui.undoToast('Deleted: ' + x.name); },
      save(v, api) { ED.store.checkpoint('Roadmap'); Object.assign(x, v); touch(x); ED.store.commit(); api.close(); } });
  };

  /* ---------------- actions ---------------- */
  F['rm-add'] = f => {
    const n = f.elements.name.value.trim(); if (!n) return;
    if (RD().subjects.some(s => low(s.name) === low(n))) { ED.ui.toast('“' + n + '” is already on your roadmap'); return; }
    ED.store.checkpoint('Roadmap'); const x = { id: U.uid('rm'), name: n, why: '', target: '', topics: [], createdAt: Date.now(), updatedAt: Date.now() };
    RD().subjects.push(x); st().sel = x.id; ED.store.commit();
  };
  F['rm-tadd'] = f => {
    const x = cur(); if (!x) return;
    const lines = f.elements.t.value.split(/\n+/).map(l => l.replace(/^[\s•\-–*\d.)]+/, '').trim()).filter(Boolean);
    if (!lines.length) return;
    x.topics = x.topics || [];
    const have = new Set(x.topics.map(y => low(y.name))); let added = 0, dup = 0;
    ED.store.checkpoint('Roadmap topics');
    lines.forEach(l => { const m = l.split('|'), name = m[0].trim(), hrs = parseFloat(m[1]); if (!name) return; if (have.has(low(name))) { dup++; return; } have.add(low(name)); x.topics.push({ id: U.uid('rt'), name, hrs: hrs > 0 ? hrs : null, st: 'todo' }); added++; });
    touch(x); ED.store.commit();
    ED.ui.undoToast(U.plural(added, 'topic') + ' added' + (dup ? ' · ' + dup + ' already there (skipped)' : ''));
  };
  const topic = id => { const x = cur(); return x && (x.topics || []).find(y => y.id === id); };
  A['rm-sel'] = el => { st().sel = el.dataset.id; st().pick.clear(); ED.app.render(); };
  A['rm-edit'] = () => { const x = cur(); if (x) RM.edit(x.id); };
  A['rm-toplan'] = () => RM.planDialog();
  A['rm-pickall'] = () => { const x = cur(); if (!x) return; (x.topics || []).forEach(y => { if ((y.st || 'todo') === 'todo') st().pick.add(y.id); }); ED.app.renderPage ? ED.app.renderPage('right') : ED.app.render(); };
  A['rm-st'] = el => { const y = topic(el.dataset.id); if (!y) return; const ord = ['todo', 'done']; if (y.st === 'plan') { ED.ui.toast('It is in the study plan — tick its session there, or delete the session to take it back'); return; } ED.store.checkpoint('Roadmap'); y.st = y.st === 'done' ? 'todo' : 'done'; y.auto = false; touch(cur()); ED.store.commit(); void ord; };
  A['rm-tdel'] = el => { const x = cur(), y = topic(el.dataset.id); if (!y) return; ED.store.checkpoint('Roadmap'); x.topics = x.topics.filter(z => z !== y); st().pick.delete(y.id); touch(x); ED.store.commit(); ED.ui.undoToast('Removed: ' + y.name); };
  CH['rm-pick'] = el => { if (el.checked) st().pick.add(el.dataset.id); else st().pick.delete(el.dataset.id); const b = document.querySelector('[data-act="rm-toplan"]'); if (b) { b.disabled = !st().pick.size; b.innerHTML = ED.icon('calendar') + 'Put into the plan' + (st().pick.size ? ' (' + st().pick.size + ')' : '') + '…'; } };
  CH['rm-tedit'] = el => {
    const x = cur(), y = topic(el.dataset.id); if (!y) return;
    const v = el.value.trim();
    if (el.dataset.f === 'name') { if (!v) { el.value = y.name; return; } if (x.topics.some(z => z !== y && low(z.name) === low(v))) { ED.ui.toast('That topic is already in the list'); el.value = y.name; return; } y.name = v; }
    else y.hrs = parseFloat(v) > 0 ? parseFloat(v) : null;
    touch(x); ED.store.commit({ silent: true });
  };

  ED.views = ED.views || {};
  ED.views.studyRoad = { id: 'studyRoad', label: 'Roadmap', left, right };
})();
