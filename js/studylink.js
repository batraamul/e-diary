/* E-Diary — Exam and Interview preparation ↔ Study planner and Daily planner (added in 1.16).
   • Automatic (switch on the Exam / Interview pages): the topics of your exams (by subject) and the categories of
     your interview questions are kept in the Study planner's topic lists, for subjects that are in the study plan.
     Topics added, renamed or deleted in Exam preparation follow; your own study topics are never touched.
   • "Add to my plans…" (one click for an exam or an interview): the exam / interview day as a task, its key dates
     (last date to apply, admit card, result), a daily preparation task until the day, and all its subjects and
     topics into the Study plan (missing subjects are added).
   Tasks have fixed ids (tk-xe-…, tk-xp-…, tk-xi-…, tk-xq-…) so two synced devices never make two; they follow when
   the dates change. Data: settings.studyLink = { exam: true, iv: true } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const CH = (ED.changes = ED.changes || {});
  const SL = (ED.studyLink = {});
  const cfg = () => { const s = D().settings; if (!s.studyLink || typeof s.studyLink !== 'object') s.studyLink = { exam: true, iv: true }; return s.studyLink; };
  const ST = () => ED.study;
  const low = s => String(s || '').trim().toLowerCase();
  const IVSUBJ = 'Interview preparation';
  const examTopics = id => ((D().exam && D().exam.topics) || []).filter(t => !id || t.examId === id);
  const examOf = id => ((D().exam && D().exam.list) || []).find(x => x.id === id) || null;
  const subjOf = t => (t.subj || '').trim() || ((examOf(t.examId) || {}).name || 'Exam');

  /* ---------------- topics kept in step ---------------- */
  let busy = false;
  SL.reconcile = () => {
    if (busy || !D() || !ST() || !ST().plan()) return false;
    busy = true; let ch = false;
    try {
      const p = ST().plan(), c = cfg();
      if (!Array.isArray(p.topics)) p.topics = [];
      const track = name => p.tracks.find(t => low(t.name) === low(name)) || null;
      /* 1.25: a subject that is not in the study plan yet is added (once) — before, its topics were left out. A subject
         you delete yourself is not added again (settings.studyLink.made remembers it). */
      if (!c.made || typeof c.made !== 'object') c.made = {};
      const pk = 'p:' + (p.id || p.title || 'plan');                 // each study plan keeps its own list
      const made = c.made[pk] && typeof c.made[pk] === 'object' ? c.made[pk] : (c.made[pk] = {});
      const used = new Set();
      const isId = v => v && v !== 'gone' && v !== 'deleted';
      // a subject the link made and you deleted: remember, so it is not made again
      Object.keys(made).forEach(k => { if (isId(made[k]) && !p.tracks.some(t => t.id === made[k]) && !track(k)) { made[k] = 'deleted'; ch = true; } });
      const ensure = name => {
        const k = low(name); if (!k) return null; used.add(k);
        let tr = track(name) || (isId(made[k]) ? p.tracks.find(t => t.id === made[k]) : null);   // also when you renamed it
        if (tr) { if (!isId(made[k])) made[k] = tr.id; used.add(low(tr.name)); return tr; }
        if (made[k] === 'deleted') return null;                     // you removed it: leave it out
        tr = ST().addTrack(name); tr.auto = 'link'; made[k] = tr.id; ch = true; return tr;
      };
      const want = new Map();
      if (c.exam) examTopics().forEach(t => { if (!t.name) return; const tr = ensure(subjOf(t)); if (tr) want.set('tp-ex-' + t.id, { trackId: tr.id, name: t.name }); });
      if (c.iv && D().interview && (D().interview.qs || []).some(q => q.cat)) {
        const tr = ensure(IVSUBJ);
        if (tr) Array.from(new Set((D().interview.qs || []).map(q => q.cat).filter(Boolean))).forEach(cat => want.set('tp-iv-' + low(cat).replace(/[^a-z0-9]+/g, '-'), { trackId: tr.id, name: cat }));
      }
      want.forEach((v, id) => {
        const old = p.topics.find(x => x.id === id);
        if (!old) { if (!p.topics.some(x => x.trackId === v.trackId && low(x.name) === low(v.name))) { p.topics.push({ id, trackId: v.trackId, name: v.name, auto: true }); ch = true; } }
        else if (old.name !== v.name || old.trackId !== v.trackId) { old.name = v.name; old.trackId = v.trackId; ch = true; }
      });
      const n = p.topics.length;
      p.topics = p.topics.filter(x => !/^tp-(ex|iv)-/.test(x.id || '') || want.has(x.id));
      if (p.topics.length !== n) ch = true;
      // remove subjects this link added that are no longer needed and hold nothing of yours
      p.tracks.slice().forEach(tr => {
        if (tr.auto !== 'link' || used.has(low(tr.name))) return;
        const sess = (D().study && D().study.sessions) || [];
        const busy = sess.some(x => x.trackId === tr.id) || (p.topics || []).some(x => x.trackId === tr.id) || [].concat(p.books || [], p.lectures || [], p.items || []).some(x => x.trackId === tr.id);
        if (busy) return;
        p.tracks = p.tracks.filter(t => t !== tr); made[low(tr.name)] = 'gone'; ch = true;
      });

      if (SL.dedupe(p)) ch = true;
      // tasks added with "Add to my plans…" follow the exam / interview
      const d = D();
      d.tasks.forEach(t => {
        if (!t.link || (t.link.k !== 'exam' && t.link.k !== 'iv')) return;
        if (!t.slPlaced) { SL.place(t); ch = true; }
        const key = t.link.part || 'day';
        if (t.link.k === 'exam') {
          const x = examOf(t.link.id); if (!x) { t.gone = true; return; }
          const date = key === 'day' ? x.date : key === 'apply' ? x.apply : key === 'admit' ? x.admit : key === 'result' ? x.result : null;
          if (key === 'prep') { if (x.date && t.repeat && t.repeat.until !== U.addDays(x.date, -1)) { t.repeat = Object.assign({}, t.repeat, { until: U.addDays(x.date, -1) }); ch = true; } return; }
          if (U.isKey(date) && t.date !== date && !M.isClosed(t.status)) { t.date = date; ch = true; }
          if (key === 'day' && (x.time || null) !== (t.time || null) && !M.isClosed(t.status)) { t.time = x.time || null; ch = true; }
        } else {
          const x = ((d.interview && d.interview.list) || []).find(y => y.id === t.link.id); if (!x) { t.gone = true; return; }
          if (key === 'prep') { if (x.date && t.repeat && t.repeat.until !== U.addDays(x.date, -1)) { t.repeat = Object.assign({}, t.repeat, { until: U.addDays(x.date, -1) }); ch = true; } return; }
          if (U.isKey(x.date) && t.date !== x.date && !M.isClosed(t.status)) { t.date = x.date; ch = true; }
          if ((x.time || null) !== (t.time || null) && !M.isClosed(t.status)) { t.time = x.time || null; ch = true; }
        }
      });
      if (d.tasks.some(t => t.gone)) { d.tasks = d.tasks.filter(t => !t.gone || M.isClosed(t.status)); d.tasks.forEach(t => { delete t.gone; }); ch = true; }
    } catch (err) { console.warn('[e-diary] study link', err); }
    finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => { if (type !== 'change' || (detail && detail.reason === 'studylink')) return; if (SL.reconcile()) ED.store.commit({ reason: 'studylink' }); });
  setTimeout(() => { try { if (SL.reconcile()) ED.store.commit({ reason: 'studylink' }); } catch (err) { /* not loaded yet */ } }, 300);   // 1.24: clean up duplicates once on opening
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    if (o && o.t.link && o.t.link.k === 'exam' && examOf(o.t.link.id)) { (ED.state.ex = ED.state.ex || {}).sel = o.t.link.id; ED.go.tab('exam'); return; }
    if (o && o.t.link && o.t.link.k === 'iv') { ED.go.tab('interview'); return; }
    return open0 && open0(el, ev);
  };

  /* 1.24: no duplicates — two devices (or an older version) could each add the same exam topic or subject under a
     different id; after a sync both were kept. Topics with the same subject and name (case and spaces ignored) become one
     (your own topic wins over an automatic one); subjects with the same name become one, and their sessions, topics,
     week themes and books follow — nothing is lost, no tick is changed. */
  const key = s => low(s).replace(/\s+/g, ' ');
  SL.dedupe = p => {
    let ch = false;
    if (!p || !Array.isArray(p.tracks)) return false;
    // subjects with the same name
    const byName = new Map();
    p.tracks.slice().forEach(tr => {
      const k = key(tr.name) + '|' + (tr.part || ''); if (!k.replace('|', '')) return;
      const keep = byName.get(k);
      if (!keep) { byName.set(k, tr); return; }
      const sess = (D().study && D().study.sessions) || [];
      sess.forEach(x => { if (x.trackId === tr.id) { x.trackId = keep.id; x.updatedAt = Date.now(); } });
      (p.topics || []).forEach(x => { if (x.trackId === tr.id) x.trackId = keep.id; });
      (p.weeks || []).forEach(w => { if (w.themes && w.themes[tr.id]) { if (!w.themes[keep.id]) w.themes[keep.id] = w.themes[tr.id]; delete w.themes[tr.id]; } });
      [].concat(p.books || [], p.lectures || [], p.items || []).forEach(x => { if (x.trackId === tr.id) x.trackId = keep.id; });
      p.tracks = p.tracks.filter(t => t !== tr); ch = true;
    });
    // topics with the same subject and name
    if (Array.isArray(p.topics)) {
      const seen = new Map(), out = [];
      p.topics.forEach(x => {
        const k = x.trackId + '|' + (x.parent || '') + '|' + key(x.name); if (!key(x.name)) { out.push(x); return; }
        const prev = seen.get(k);
        if (!prev) { seen.set(k, x); out.push(x); return; }
        if (prev.auto && !x.auto) { out[out.indexOf(prev)] = x; seen.set(k, x); }
        ch = true;
      });
      if (ch || out.length !== p.topics.length) p.topics = out;
    }
    if (ch) p.updatedAt = Date.now();
    return ch;
  };

  /* ---------------- subjects and topics into the study plan (one click) ---------------- */
  SL.toStudy = (subjects) => {      // subjects: [{ name, topics: [{ id, name }] }]
    const p = ST().plan(); if (!p) return null;
    if (!Array.isArray(p.topics)) p.topics = [];
    let ns = 0, nt = 0;
    subjects.forEach(sb => {
      let tr = p.tracks.find(t => low(t.name) === low(sb.name));
      if (!tr) { tr = ST().addTrack(sb.name); ns++; }
      sb.topics.forEach(t => {
        if (p.topics.some(x => x.trackId === tr.id && low(x.name) === low(t.name))) return;
        p.topics.push({ id: t.id ? (/^tp-(ex|iv)-/.test(t.id) ? t.id : 'tp-ex-' + t.id) : U.uid('tp'), trackId: tr.id, name: t.name, auto: !!t.id }); nt++;
      });
    });
    p.updatedAt = Date.now();
    return { ns, nt };
  };

  /* ---------------- "Add to my plans…" ---------------- */
  /* 1.16.2: exams and interviews go under the FROG heading (the day's most important task) with the category Career */
  const role = () => { const r = D().roles; return ((r.find(x => x.id === 'role-frog') || r.find(x => /^frog|frog: to be tamed/i.test(x.name)) || r.find(x => /frog/i.test(x.name))) || {}).id || null; };
  const category = () => {
    const c = D().categories; let x = c.find(y => /^car(ee|rie)r/i.test(y.name || ''));
    if (!x) { x = { id: U.uid('cat'), name: 'Career', color: '#7b3fb8', icon: '🎯' }; c.push(x); }
    return x.id;
  };
  SL.place = t => { t.roleId = role() || t.roleId; t.categoryId = category(); t.slPlaced = 1; };
  const add = (id, o) => { const d = D(); if (d.tasks.some(t => t.id === id)) return 0; const t = M.newTask(Object.assign({ id, prio: 'A' }, o)); SL.place(t); if (!t.repeat) t.num = M.nextNum(t.prio, t.date); d.tasks.push(t); return 1; };
  const dialog = (title, rows, onGo, plan) => {
    const body = '<form class="st-form sl-form"><p class="hint">Choose what to add. Nothing is added twice — click again later to add what is new.</p>' +
      rows.map(r => '<label class="switch sl-row"><input type="checkbox" data-sl="' + r[0] + '"' + (r[2] === false ? '' : ' checked') + (r[3] ? ' disabled' : '') + '><span class="track"></span><span>' + r[1] + '</span></label>').join('') +
      '<label class="sl-time">Daily preparation at <input type="time" class="field" id="sl-time" value="18:30"></label>' +
      (plan ? '' : '<p class="notice warn">' + ED.icon('info') + '<span>No study plan yet: make one in <b>Study → Plan ▾ → Make a new plan</b>, then come back to add the subjects and topics.</span></p>') + '</form>';
    ED.ui.modal({ title, cls: 'st-modal', body, footer: '<button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="go">Add</button>', onMount(el, api) {
      el.querySelector('[data-x="go"]').addEventListener('click', () => {
        const on = {}; U.$$('[data-sl]', el).forEach(c => { on[c.dataset.sl] = c.checked && !c.disabled; });
        const time = el.querySelector('#sl-time').value || null;
        ED.store.checkpoint('Add to my plans');
        const msg = onGo(on, time);
        ED.store.commit(); api.close(); ED.ui.undoToast(msg || 'Nothing new to add');
      });
    } });
  };
  SL.exam = id => {
    const x = examOf(id); if (!x) return;
    const tops = examTopics(id), today = U.today(), plan = ST() && ST().plan();
    const subs = {}; tops.forEach(t => { const n = subjOf(t); (subs[n] = subs[n] || []).push({ id: 'tp-ex-' + t.id, name: t.name }); });
    const keyd = [['apply', x.apply, 'Last date to apply'], ['admit', x.admit, 'Admit card'], ['result', x.result, 'Result']].filter(k => U.isKey(k[1]) && k[1] >= today);
    dialog('Add “' + (x.name || 'exam') + '” to my plans', [
      ['day', 'The exam day as a task' + (x.date ? ' (' + e(U.fmtShort(x.date)) + (x.time ? ', ' + e(ED.fx.time(x.time)) : '') + ')' : ' — add the exam date first'), !!x.date, !x.date],
      ['keys', keyd.length ? 'Key dates as tasks: ' + keyd.map(k => e(k[2]) + ' ' + e(U.fmtDM(k[1]))).join(', ') : 'Key dates as tasks — none ahead', !!keyd.length, !keyd.length],
      ['prep', 'A daily preparation task until the exam', !!(x.date && x.date > today), !(x.date && x.date > today)],
      ['study', 'All its subjects and topics into the Study plan (' + U.plural(Object.keys(subs).length, 'subject') + ', ' + U.plural(tops.length, 'topic') + ')', !!(plan && tops.length), !(plan && tops.length)],
    ], (on, time) => {
      const out = [];
      if (on.day && x.date) out.push(add('tk-xe-' + x.id, { title: '📝 Exam: ' + (x.name || 'exam') + (x.centre ? ' — ' + x.centre : ''), date: x.date, time: x.time || null, link: { k: 'exam', id: x.id, part: 'day' } }) ? 'exam day' : '');
      if (on.keys) keyd.forEach(k => { if (add('tk-xe-' + x.id + '-' + k[0], { title: '📝 ' + k[2] + ': ' + (x.name || 'exam'), date: k[1], link: { k: 'exam', id: x.id, part: k[0] } })) out.push(k[2].toLowerCase()); });
      if (on.prep) {
        const left = tops.filter(t => (t.st || 0) < 2).length, n = Math.max(1, U.diffDays(today, x.date));
        if (add('tk-xp-' + x.id, { title: '📚 Prepare: ' + (x.name || 'exam') + (left ? ' — about ' + Math.max(1, Math.ceil(left / n)) + ' topic(s) a day' : ''), date: today, time, dur: 60, repeat: { freq: 'daily', interval: 1, until: U.addDays(x.date, -1) }, link: { k: 'exam', id: x.id, part: 'prep' } })) out.push('daily preparation');
      }
      if (on.study && plan) { const r = SL.toStudy(Object.keys(subs).map(n => ({ name: n, topics: subs[n] }))); if (r && (r.ns || r.nt)) out.push(U.plural(r.ns, 'subject') + ' and ' + U.plural(r.nt, 'topic') + ' in the Study plan'); }
      const o = out.filter(Boolean);
      return o.length ? 'Added: ' + o.join(', ') : '';
    }, plan);
  };
  SL.interview = id => {
    const d = D(), x = ((d.interview && d.interview.list) || []).find(y => y.id === id); if (!x) return;
    const today = U.today(), plan = ST() && ST().plan();
    const cats = Array.from(new Set((d.interview.qs || []).filter(q => !q.forId || q.forId === id).map(q => q.cat).filter(Boolean)));
    dialog('Add the interview to my plans', [
      ['day', 'The interview as a task' + (x.date ? ' (' + e(U.fmtShort(x.date)) + (x.time ? ', ' + e(ED.fx.time(x.time)) : '') + ')' : ' — add its date first'), !!x.date, !x.date],
      ['prep', 'A daily practice task until the interview', !!(x.date && x.date > today), !(x.date && x.date > today)],
      ['study', 'The question categories as topics of “' + IVSUBJ + '” in the Study plan (' + U.plural(cats.length, 'category', 'categories') + ')', !!(plan && cats.length), !(plan && cats.length)],
    ], (on, time) => {
      const out = [], name = [x.role, x.org].filter(Boolean).join(', ') || 'interview';
      if (on.day && x.date && add('tk-xi-' + x.id, { title: '🎤 Interview: ' + name + (x.venue ? ' — ' + x.venue : ''), date: x.date, time: x.time || null, link: { k: 'iv', id: x.id, part: 'day' } })) out.push('interview day');
      if (on.prep && add('tk-xq-' + x.id, { title: '🎤 Practise for the interview: ' + name + ' (Interview → Practise)', date: today, time, dur: 45, repeat: { freq: 'daily', interval: 1, until: U.addDays(x.date, -1) }, link: { k: 'iv', id: x.id, part: 'prep' } })) out.push('daily practice');
      if (on.study && plan) { const r = SL.toStudy([{ name: IVSUBJ, topics: cats.map(c => ({ id: 'tp-iv-' + low(c).replace(/[^a-z0-9]+/g, '-'), name: c })) }]); if (r && (r.ns || r.nt)) out.push(U.plural(r.nt, 'topic') + ' in the Study plan'); }
      return out.length ? 'Added: ' + out.join(', ') : '';
    }, plan);
  };
  /* the switch shown on the Exam / Interview pages */
  SL.switchHtml = kind => '<label class="switch sl-auto"><input type="checkbox" data-change="sl-auto" data-k="' + kind + '"' + (cfg()[kind] ? ' checked' : '') + '><span class="track"></span><span>' +
    (kind === 'exam' ? 'Keep exam topics in the Study planner’s topic lists (for subjects in the study plan)' : 'Keep question categories as topics of “' + IVSUBJ + '” in the Study planner') + '</span></label>';
  A['sl-exam'] = el => SL.exam(el.dataset.id);
  A['sl-go'] = el => { if (el.dataset.k === 'exam') { (ED.state.ex = ED.state.ex || {}).sel = el.dataset.id; ED.go.tab('exam'); } else ED.go.tab('interview'); };
  A['sl-iv'] = el => SL.interview(el.dataset.id);
  CH['sl-auto'] = el => { cfg()[el.dataset.k] = el.checked; ED.store.commit(); ED.ui.toast(el.checked ? 'Topics are kept in the Study planner' : 'Topics are no longer copied (the ones there are removed)'); };
})();
