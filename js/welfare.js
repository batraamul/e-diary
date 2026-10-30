/* E-Diary — Notes & Life → Welfare & Help (added in 1.16): whom you helped, and how.
   Left page:  the record — date, person (and how you know them), the kind of help (money, food, medical,
               education, time, advice, job, things…), what you did, the amount, the status and a follow-up date.
   Right page: this year at a glance — people helped, times, money given; by kind of help and by person; the
               follow-ups due (each follow-up date is a task in the Daily planner), and regular help you give.
   Data: ED.store.data.welfare = { list: [{ id, date, person, rel, kind, how, amount, status, follow, toMoney, notes, updatedAt }] } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const CH = (ED.changes = ED.changes || {});
  const FX = () => ED.fx;
  const WF = (ED.welfare = {});
  const st = () => ED.state.wf || (ED.state.wf = { kind: '', q: '' });
  const W = () => { const d = D(); if (!d.welfare || typeof d.welfare !== 'object') d.welfare = { list: [] }; if (!Array.isArray(d.welfare.list)) d.welfare.list = []; return d.welfare; };
  const KINDS = [['money', '💰 Money / financial help'], ['food', '🍲 Food / ration'], ['medical', '🩺 Medical help'], ['education', '📚 Education / fees / books'], ['job', '💼 Job / career help'], ['time', '🤝 Time / physical help'], ['advice', '💬 Advice / guidance'], ['things', '🎁 Clothes / things'], ['blood', '🩸 Blood / organ donation'], ['charity', '🏛️ Donation to an organisation'], ['other', '✳️ Other']];
  const STATUS = [['done', 'Done'], ['ongoing', 'Ongoing'], ['follow', 'To follow up'], ['returned', 'Returned / repaid']];
  const kindLabel = k => (KINDS.find(x => x[0] === k) || KINDS[KINDS.length - 1])[1];
  const money = v => ED.finance ? ED.finance.money(v) : '₹' + Math.round(v).toLocaleString('en-IN');

  /* follow-up dates as tasks (fixed id per entry, like groceries) */
  let busy = false;
  WF.reconcile = () => {
    if (busy || !D() || !D().welfare || !D().tasks) return false;
    busy = true; let ch = false;
    try {
      const d = D(), live = new Set();
      W().list.forEach(x => {
        if (!U.isKey(x.follow) || x.status === 'done' || x.status === 'returned' || x.noPlan) return;
        const id = 'tk-wf-' + x.id; live.add(id);
        const title = '🤝 Follow up: ' + (x.person || 'help') + (x.how ? ' — ' + x.how.slice(0, 60) : '');
        let t = d.tasks.find(y => y.id === id);
        if (!t) { t = M.newTask({ id, title, date: x.follow, prio: 'B', link: { k: 'welfare', id: x.id }, linkTitle: title, linkDate: x.follow, roleId: (d.roles.find(r => /family|friend|social|community|seva|service/i.test(r.name)) || {}).id || null }); t.num = M.nextNum(t.prio, t.date); d.tasks.push(t); ch = true; return; }
        if (t.date !== t.linkDate) { if (x.follow !== t.date) { x.follow = t.date; ch = true; } } else if (t.date !== x.follow) { t.date = x.follow; ch = true; }
        if (t.linkDate !== t.date) { t.linkDate = t.date; ch = true; }
        if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
        if (M.isClosed(t.status) && x.status === 'follow') { x.status = 'done'; x.updatedAt = Date.now(); ch = true; }
      });
      const before = d.tasks.length;
      d.tasks = d.tasks.filter(t => !t.link || t.link.k !== 'welfare' || live.has(t.id) || M.isClosed(t.status));
      if (d.tasks.length !== before) ch = true;
    } catch (err) { console.warn('[e-diary] welfare', err); }
    finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => { if (type !== 'change' || (detail && detail.reason === 'welfare')) return; if (WF.reconcile()) ED.store.commit({ reason: 'welfare' }); });
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    if (o && o.t.link && o.t.link.k === 'welfare' && W().list.some(x => x.id === o.t.link.id)) { ED.go.tab('welfare'); setTimeout(() => WF.edit(o.t.link.id), 60); return; }
    return open0 && open0(el, ev);
  };
  const del0 = M.deleteTask;
  M.deleteTask = id => { const t = M.task(id); if (t && t.link && t.link.k === 'welfare') { const x = W().list.find(y => y.id === t.link.id); if (x) { x.noPlan = true; x.updatedAt = Date.now(); } } return del0(id); };

  /* ---------------- pages ---------------- */
  const shown = () => {
    const s = st(), q = (s.q || '').toLowerCase();
    return W().list.filter(x => (!s.kind || x.kind === s.kind) && (!q || [x.person, x.rel, x.how, x.notes].join(' ').toLowerCase().indexOf(q) >= 0))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  };
  const left = () => {
    const s = st(), list = shown();
    const rows = list.map(x => '<li class="wf-row s-' + e(x.status || 'done') + '"><button type="button" class="plain-btn xp-li" data-act="wf-edit" data-id="' + e(x.id) + '">' +
      '<span class="xp-date">' + (x.date ? '<b>' + +x.date.slice(8) + '</b><span>' + U.MON[+x.date.slice(5, 7) - 1] + ' ' + x.date.slice(2, 4) + '</span>' : '<b>—</b>') + '</span>' +
      '<span class="grow wf-m"><b>' + e(x.person || 'Someone') + '</b>' + (x.rel ? ' <span class="hint">· ' + e(x.rel) + '</span>' : '') + '<span class="wf-how">' + e(kindLabel(x.kind)) + (x.how ? ' — ' + e(x.how) : '') + '</span>' +
      (x.follow && x.status !== 'done' && x.status !== 'returned' ? '<span class="hint">' + ED.icon('calendar') + ' follow up ' + e(FX().when(x.follow)) + '</span>' : '') + '</span>' +
      (+x.amount ? '<span class="num wf-amt">' + e(money(+x.amount)) + '</span>' : '') + '<span class="chip wf-st">' + e((STATUS.find(y => y[0] === x.status) || STATUS[0])[1]) + '</span></button></li>').join('');
    const body = '<p class="hint">A quiet record of whom you helped and how — to follow up, to remember, and to see where your time and money went.</p>' +
      '<div class="xp-filters"><button type="button" class="btn small primary" data-act="wf-edit">' + ED.icon('plus') + 'Add help given</button>' +
      '<select class="field" data-change="wf-kind" aria-label="Kind of help"><option value="">All kinds</option>' + KINDS.map(k => FX().opt(k[0], k[1], s.kind === k[0])).join('') + '</select>' +
      '<input class="field" type="search" placeholder="Search name, what…" value="' + e(s.q || '') + '" data-change="wf-q" aria-label="Search"></div>' +
      (rows ? '<ul class="xp-list wf-list">' + rows + '</ul>' : '<div class="empty">' + ED.icon('user') + '<div><b>' + (W().list.length ? 'Nothing matches.' : 'Nothing recorded yet.') + '</b><br>Add whom you helped — a relative’s medical bill, a colleague’s child’s fees, ration for a family, time given at a camp.</div></div>');
    return FX().page('wf', 'Welfare &amp; Help', '', body, 'wf-l');
  };
  const right = () => {
    const l = W().list, y = String(new Date().getFullYear()), yl = l.filter(x => String(x.date || '').slice(0, 4) === y);
    const people = new Set(yl.map(x => (x.person || '').trim().toLowerCase()).filter(Boolean));
    const amt = yl.reduce((a, x) => a + (+x.amount || 0), 0), today = U.today();
    const due = l.filter(x => x.follow && x.status !== 'done' && x.status !== 'returned').sort((a, b) => a.follow.localeCompare(b.follow));
    const byKind = KINDS.map(k => ({ label: k[1], value: yl.filter(x => x.kind === k[0]).length, amt: yl.filter(x => x.kind === k[0]).reduce((a, x) => a + (+x.amount || 0), 0) })).filter(x => x.value);
    const per = {}; l.forEach(x => { const n = (x.person || 'Someone').trim(); per[n] = per[n] || { n, c: 0, a: 0, last: '' }; per[n].c++; per[n].a += +x.amount || 0; if ((x.date || '') > per[n].last) per[n].last = x.date || ''; });
    const top = Object.values(per).sort((a, b) => b.c - a.c || b.a - a.a).slice(0, 10);
    const maxK = Math.max(1, ...byKind.map(x => x.value));
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('People helped', String(people.size), 'in ' + y) + FX().tile('Times', String(yl.length), 'in ' + y) + FX().tile('Money given', money(amt), 'in ' + y) + FX().tile('To follow up', String(due.length), due.filter(x => x.follow < today).length ? due.filter(x => x.follow < today).length + ' overdue' : '', due.some(x => x.follow < today) ? 'warn' : '') + '</div>';
    const kinds = byKind.length ? '<div class="wf-bars">' + byKind.map(x => '<div class="wf-bar"><span class="wf-bl">' + e(x.label) + '</span><span class="wf-bt"><i style="width:' + Math.round(x.value / maxK * 100) + '%"></i></span><span class="num">' + x.value + (x.amt ? ' · ' + e(money(x.amt)) : '') + '</span></div>').join('') + '</div>' : '<p class="hint">Nothing this year yet.</p>';
    const dueHtml = due.length ? '<ul class="xp-list">' + due.map(x => '<li><button type="button" class="plain-btn xp-li" data-act="wf-edit" data-id="' + e(x.id) + '"><span class="num">' + e(U.fmtDM(x.follow)) + '</span><span class="grow"><b>' + e(x.person || 'Someone') + '</b> <span class="hint">' + e(x.how || kindLabel(x.kind)) + '</span></span><span class="hint' + (x.follow < today ? ' err-text' : '') + '">' + e(FX().when(x.follow)) + '</span></button></li>').join('') + '</ul>' : '<p class="hint">No follow-ups. Give an entry a follow-up date and it appears here and in the Daily planner.</p>';
    const ppl = top.length ? '<table class="mm-table wf-tab"><thead><tr><th>Person</th><th>Times</th><th>Money</th><th>Last</th></tr></thead><tbody>' + top.map(p => '<tr><td>' + e(p.n) + '</td><td class="num">' + p.c + '</td><td class="num">' + (p.a ? e(money(p.a)) : '—') + '</td><td class="num">' + e(p.last ? U.fmtDM(p.last) : '') + '</td></tr>').join('') + '</tbody></table>' : '';
    const body = tiles + '<h3 class="gh">Follow-ups</h3>' + dueHtml + '<h3 class="gh fin-gap">By kind of help · ' + y + '</h3>' + kinds + (ppl ? '<h3 class="gh fin-gap">People</h3>' + ppl : '') +
      '<div class="row-btns"><button type="button" class="btn small ghost" data-act="wf-csv">' + ED.icon('download') + 'Export (.csv for Excel)</button></div>';
    return '<div class="xp wf-r"><div class="pg-head st-head"><h2 class="pg-title">Help at a glance</h2></div><div class="st-scroll scroll" data-keep-scroll="wf-r">' + body + '</div></div>';
  };
  ED.views = ED.views || {};
  ED.views.welfare = { id: 'welfare', label: 'Welfare & Help', left, right };

  WF.edit = id => {
    const w = W(), x = id ? w.list.find(y => y.id === id) : null;
    const names = Array.from(new Set(w.list.map(y => y.person).filter(Boolean)));
    FX().form({
      title: x ? 'Help given' : 'Add help given', wide: true,
      data: x ? Object.assign({}, x) : { date: U.today(), person: '', rel: '', kind: 'money', how: '', amount: null, status: 'done', follow: '', toMoney: false, notes: '' },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: true },
        { k: 'person', label: 'Whom', req: true, ph: 'Name (or the organisation)', list: names },
        { k: 'rel', label: 'Who they are', ph: 'relative, colleague, neighbour, staff, NGO…' },
        { k: 'kind', label: 'Kind of help', type: 'select', options: KINDS },
        { k: 'how', label: 'How I helped', ph: 'Paid the hospital bill, school fees, guided for the interview…' },
        { k: 'amount', label: 'Amount (₹), if any', type: 'number', min: 0 },
        { k: 'status', label: 'Status', type: 'select', options: STATUS },
        { k: 'follow', label: 'Follow up on', type: 'date', hint: 'A task on this day in the Daily planner.' },
        { k: 'toMoney', label: 'Also record the amount in Money (spending)', type: 'check' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
      ],
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Delete', message: 'Delete this entry (and its follow-up task)?', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Delete help'); w.list = w.list.filter(y => y !== x); dropRec(x); D().tasks = D().tasks.filter(t => t.id !== 'tk-wf-' + x.id); ED.store.commit(); ED.ui.undoToast('Deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint(x ? 'Help given' : 'Add help given');
        const it = x || { id: U.uid('wf') };
        Object.assign(it, v, { updatedAt: Date.now() }); delete it.noPlan;
        if (v.follow && v.status === 'done') it.status = 'follow';
        if (!x) w.list.push(it);
        syncRec(it);
        ED.store.commit(); api.close(); ED.ui.toast(x ? 'Saved' : 'Added' + (it.follow ? ' — follow-up in the Daily planner' : ''));
      },
    });
  };
  /* the amount in Money records (one record per entry, never twice) */
  const RID = x => 'fr-wf-' + x.id;
  const dropRec = x => { const F = D().finance; if (F && Array.isArray(F.records)) F.records = F.records.filter(r => r.id !== RID(x)); };
  const syncRec = x => {
    const F = D().finance; if (!F || !Array.isArray(F.records) || !ED.finance) return;
    const r = F.records.find(y => y.id === RID(x));
    if (!x.toMoney || !(+x.amount > 0)) { if (r) dropRec(x); return; }
    const cat = (F.cats.find(c => /gift|donat|charit/i.test(c.name)) || {}).id || ED.finance.guess('gifts donation charity', 'expense') || 'fc-other';
    const desc = 'Help: ' + (x.person || '') + (x.how ? ' — ' + x.how : '');
    if (r) { r.amount = +x.amount; r.date = x.date; r.desc = desc; r.updatedAt = Date.now(); }
    else ED.finance.addRecord({ id: RID(x), date: x.date, type: 'expense', amount: +x.amount, categoryId: cat, accountId: null, desc, notes: 'From Notes & Life → Welfare & Help', src: 'welfare:' + x.id });
  };
  A['wf-edit'] = el => WF.edit(el.dataset.id || null);
  CH['wf-kind'] = el => { st().kind = el.value; ED.app.render(); };
  CH['wf-q'] = el => { st().q = el.value; ED.app.render(); };
  A['wf-csv'] = () => {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Date', 'Whom', 'Who they are', 'Kind', 'How', 'Amount', 'Status', 'Follow up', 'Notes']].concat(W().list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(x => [x.date, x.person, x.rel, kindLabel(x.kind).replace(/^\S+\s/, ''), x.how, x.amount || '', (STATUS.find(y => y[0] === x.status) || STATUS[0])[1], x.follow || '', x.notes || '']));
    U.download('welfare-and-help.csv', '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
  };
})();
