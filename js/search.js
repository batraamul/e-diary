/* E-Diary — search everything */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;

  const TYPE = {
    task: ['checkSq', 'Task'], event: ['calendar', 'Event'], goal: ['target', 'Goal'], role: ['compass', 'Role'],
    value: ['starO', 'Value'], note: ['doc', 'Note'], day: ['book', 'Diary'], mission: ['flag', 'Mission'],
    study: ['book', 'Study'], money: ['wallet', 'Finance'], site: ['globe', 'Website'], plangoal: ['target', 'Money goal'], habit: ['repeat', 'Habit'], interview: ['user', 'Interview'], ivq: ['help', 'Interview question'], med: ['clock', 'Medicine'], treat: ['shield', 'Treatment'], visit: ['calendar', 'Appointment'], mnote: ['users', 'Meeting'], book: ['book', 'Book / lecture'],
  };

  ED.search = {
    open() {
      let results = [], active = 0, q = '';
      const api = ED.ui.modal({
        cls: 'search-modal', plain: true, label: 'Search',
        body: '<div class="search"><div class="search-bar">' + ED.icon('search') +
          '<input id="search-in" class="search-in" type="search" placeholder="Search tasks, notes, goals, diary pages…" autocomplete="off" aria-label="Search" aria-controls="search-res">' +
          '<kbd>Esc</kbd></div><ul class="search-res" id="search-res" role="listbox"></ul></div>',
        onMount(el) {
          const inp = el.querySelector('#search-in');
          const list = el.querySelector('#search-res');
          const paint = () => {
            if (!q || q.length < 2) { list.innerHTML = '<li class="search-hint hint">Type at least two letters. Tip: press <kbd>/</kbd> anywhere to search.</li>'; return; }
            if (!results.length) { list.innerHTML = '<li class="search-hint hint">Nothing found for “' + e(q) + '”.</li>'; return; }
            list.innerHTML = results.map((r, i) => {
              const t = TYPE[r.type];
              const { title, sub } = describe(r, q);
              return '<li role="option" class="sr' + (i === active ? ' on' : '') + '" data-i="' + i + '" aria-selected="' + (i === active) + '">' +
                '<span class="sr-ic">' + ED.icon(t[0]) + '</span><span class="sr-main"><span class="sr-title">' + title + '</span><span class="sr-sub hint">' + t[1] + (sub ? ' · ' + sub : '') + '</span></span></li>';
            }).join('');
            const on = list.querySelector('.sr.on'); if (on) on.scrollIntoView({ block: 'nearest' });
          };
          const run = U.debounce(() => { q = inp.value.trim(); results = M.search(q); active = 0; paint(); }, 120);
          inp.addEventListener('input', run);
          inp.addEventListener('keydown', ev => {
            if (ev.key === 'ArrowDown') { ev.preventDefault(); active = Math.min(results.length - 1, active + 1); paint(); }
            else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = Math.max(0, active - 1); paint(); }
            else if (ev.key === 'Enter') { ev.preventDefault(); run.flush(); if (results[active]) go(results[active]); }
          });
          list.addEventListener('click', ev => { const li = ev.target.closest('[data-i]'); if (li) go(results[+li.dataset.i]); });
          paint();
          setTimeout(() => inp.focus(), 20);
        },
      });
      const go = r => {
        api.close();
        const it = r.item;
        switch (r.type) {
          case 'task':
            if (it.date && !it.repeat) { ED.state.tab = 'daily'; ED.go.date(it.date); }
            else if (!it.date) ED.go.tab('monthly');
            ED.editors.task({ id: it.id, k: it.repeat ? U.today() : it.date });
            break;
          case 'event': ED.state.tab = 'daily'; ED.go.date(it.date > U.today() || !it.repeat ? it.date : U.today()); ED.editors.event({ id: it.id }); break;
          case 'goal': ED.go.tab('goals'); ED.editors.goal(it.id); break;
          case 'role': ED.go.tab('roles'); ED.editors.role(it.id); break;
          case 'value': ED.go.tab('mission'); ED.editors.value(it.id); break;
          case 'note': ED.state.career.noteId = it.id; ED.state.career.mode = 'notes'; ED.state.career.nb = 'all'; ED.go.tab('career'); break;
          case 'day': ED.state.tab = 'daily'; ED.go.date(it.k); break;
          case 'mission': ED.go.tab('mission'); break;
          case 'study': ED.state.study = Object.assign(ED.state.study || {}, { day: it.date, month: U.firstOfMonth(it.date) }); ED.go.tab('studyWeek'); break;
          case 'money': ED.state.fin = Object.assign(ED.state.fin || {}, { month: U.firstOfMonth(it.date) }); ED.go.tab('finance'); ED.finance.editRecord(it.id); break;
          case 'site': ED.go.tab('vault'); break;
          case 'plangoal': ED.go.tab('finplan'); ED.finplan.editGoal(it.id); break;
          case 'habit': ED.actions['hb-tracker'](); ED.habits.edit(it.id); break;
          case 'interview': ED.go.tab('interview'); ED.interview.edit(it.id); break;
          case 'ivq': ED.go.tab('interview'); ED.interview.editQ(it.id); break;
          case 'med': ED.go.tab('health'); ED.health.editMed(it.id); break;
          case 'treat': ED.go.tab('health'); ED.health.editTreat(it.id); break;
          case 'visit': ED.state.hl = Object.assign(ED.state.hl || {}, { tab: 'visits' }); ED.go.tab('health'); ED.health.editVisit(it.id); break;
          case 'mnote': { const s = ED.meetings.st(); s.sel = it.date || null; s.m = U.firstOfMonth(it.date || U.today()); ED.go.tab('events'); break; }
          case 'book': ED.state.study = Object.assign(ED.state.study || {}, { ytab: 'sources' }); ED.go.tab('studyYear'); if (it.kind === 'book' || it.kind === 'lecture') ED.study.editSource(it.id); else ED.study.editItem(it.id); break;
        }
      };
    },
  };

  function snippet(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return e(text.slice(0, 90));
    const a = Math.max(0, i - 40), b = Math.min(text.length, i + q.length + 60);
    return (a > 0 ? '…' : '') + U.mark(text.slice(a, b), q) + (b < text.length ? '…' : '');
  }

  function describe(r, q) {
    const it = r.item;
    switch (r.type) {
      case 'task': return { title: U.mark(M.code(it) + ' ' + it.title, q), sub: it.repeat ? M.repeatText(it.repeat) : it.date ? U.fmtShort(it.date) : 'Master Tasks' };
      case 'event': return { title: U.mark(it.title, q), sub: U.fmtShort(it.date) + (it.allDay ? '' : ' · ' + U.fmtTime(it.start, ED.store.data.settings.h12)) };
      case 'goal': return { title: U.mark(it.title, q), sub: it.done ? 'Achieved ' + U.fmtShort(it.doneAt) : it.due ? 'Due ' + U.fmtShort(it.due) : '' };
      case 'role': return { title: U.mark(it.name, q), sub: '' };
      case 'value': return { title: U.mark(it.title, q), sub: '' };
      case 'note': return { title: U.mark(it.title || 'Untitled note', q), sub: snippet(U.stripHtml(it.html), q) };
      case 'day': return { title: e(U.fmtLong(it.k)), sub: snippet(it.text, q) };
      case 'mission': return { title: 'Mission statement', sub: snippet(U.stripHtml(ED.store.data.mission.html), q) };
      case 'study': { const tr = ED.study.track(it.trackId); return { title: U.mark(it.topic || 'Session', q), sub: U.fmtShort(it.date) + ' · ' + (tr ? tr.name : '') + (it.done ? ' · done' : '') }; }
      case 'money': return { title: U.mark(it.desc || 'Record', q), sub: U.fmtShort(it.date) + ' · ' + ED.finance.money(it.amount) };
      case 'site': return { title: U.mark(it.name, q), sub: e(it.url) };
      case 'habit': { const x = ED.habits.month(U.today()).habits.find(r => r.h.id === it.id); return { title: U.mark((it.icon ? it.icon + ' ' : '') + it.name, q), sub: 'Habit · ' + (it.days && it.days.length ? it.days.map(d => U.DAY3[d]).join(', ') : 'every day') + (x && x.due ? ' · ' + Math.round(x.score * 100) + '% this month' : '') }; }
      case 'interview': return { title: U.mark(it.role || 'Interview', q), sub: [it.org, it.date ? U.fmtShort(it.date) : '', it.stage].filter(Boolean).map(e).join(' · ') };
      case 'ivq': return { title: U.mark(it.q, q), sub: e(it.cat) + (it.a ? ' · ' + snippet(it.a, q) : '') };
      case 'med': return { title: U.mark(it.name, q), sub: e([it.dose, (it.times || []).join(', '), it.purpose].filter(Boolean).join(' · ')) };
      case 'treat': return { title: U.mark(it.name, q), sub: e([it.doctor, it.status].filter(Boolean).join(' · ')) };
      case 'visit': return { title: U.mark(it.doctor || 'Appointment', q), sub: e([it.date ? U.fmtShort(it.date) : '', it.purpose].filter(Boolean).join(' · ')) };
      case 'mnote': return { title: U.mark(it.title || 'Meeting', q), sub: (it.date ? U.fmtShort(it.date) + ' · ' : '') + snippet([it.agenda, it.notes, it.decisions].filter(Boolean).join(' '), q) };
      case 'plangoal': return { title: U.mark(it.name, q), sub: 'Financial plan · ' + (it.year || '') + ' · ' + ED.finance.money(it.cost) + ' today' };
      case 'book': return { title: U.mark(it.title, q), sub: ED.study.srcKindName(it) + (it.status ? ' · ' + e(it.status) : '') + (it.use ? ' · ' + e(it.use) : '') };
    }
    return { title: '', sub: '' };
  }
})();
