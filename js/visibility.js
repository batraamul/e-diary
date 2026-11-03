/* E-Diary — 1.22: Settings → Pages & parts: hide a page, or a part of a page, for the time being.
   Nothing is deleted: hidden pages leave the tabs and the top bar, hidden parts leave their page; switch them on again
   and everything is there as before. Reminders and Daily tasks that come from a hidden page keep working.
   Data: settings.hidden = { <viewId>: 1, 'part:<page>.<part>': 1 }   (the Daily page cannot be hidden)
   ED.part('life.watch') → false when that part is hidden. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const VS = (ED.visibility = {});
  const S = () => ED.store.data.settings;
  ED.part = k => !((S() && S().hidden) || {})['part:' + k];
  /* the parts that can be hidden, by page */
  const PARTS = {
    daily: [['daily.study', 'Study sessions of the day'], ['daily.habits', 'Habits (and the mood card)'], ['mood', 'Mood card — “How is your day?”'], ['daily.quote', 'Quote of the day']],
    career: [['life.graph', 'Progress'], ['life.travel', 'Travel & Tour'], ['life.grocery', 'Grocery & home stock'], ['life.meals', 'Weekly meals'], ['life.wardrobe', 'Wardrobe'], ['life.watch', 'Watch list']],
    studyYear: [['study.insights', 'Insights tab'], ['study.matrix', 'Track matrix tab'], ['study.sources', 'Books & lectures tab'], ['study.topics', 'Topics tab'], ['study.research', 'Research papers tab'], ['study.bits', 'Science bits tab'], ['study.compass', 'Today’s study card at the top of each Study page']],
    health: [['health.vitals', 'Readings tab'], ['health.reports', 'Reports tab'], ['health.card', 'Medical cards tab']],
    exercise: [['exercise.insights', 'Activity insights (day / week / month / year)']],
  };
  VS.PARTS = PARTS;
  const names = () => { const m = {}; (ED.SECTIONS || []).forEach(s => { m[s.id] = s.label.replace(/­/g, ''); }); (ED.ALLGROUPS || []).forEach(g => (g.views || []).forEach((v, i) => { if (g.names && g.names[i]) m[v] = g.names[i]; })); return m; };

  VS.settingsHtml = () => {
    const h = S().hidden || {}, nm = names();
    const nHid = Object.keys(h).filter(k => h[k]).length + (S().moodStrip === false ? 1 : 0);
    const sw = (key, on, label, locked, part) => '<label class="switch vs-sw' + (part ? ' part' : '') + '"><input type="checkbox" data-vs="' + e(key) + '"' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '><span class="track"></span><span>' + e(label) + (locked ? ' <span class="hint">(always shown)</span>' : '') + '</span></label>';
    const groups = (ED.ALLGROUPS || []).map(g => '<fieldset class="vs-g"><legend>' + e(g.label.replace(/­/g, '')) + '</legend>' + g.views.map(v => {
      const parts = PARTS[v] || [];
      return '<div class="vs-page">' + sw(v, v === 'daily' || !h[v], nm[v] || v, v === 'daily') +
        (parts.length ? '<div class="vs-parts">' + parts.map(p => sw(p[0] === 'mood' ? 'mood' : 'part:' + p[0], p[0] === 'mood' ? S().moodStrip !== false : !h['part:' + p[0]], p[1], false, true)).join('') + '</div>' : '') + '</div>';
    }).join('') + '</fieldset>').join('');
    return '<h3 class="set-h">Pages &amp; parts to show</h3>' +
      '<p class="hint">Switch off a page or a part you do not use for now. <b>Nothing is deleted</b> — switch it on again and it is all there. Tasks, reminders and calendar entries that come from a hidden page carry on.</p>' +
      '<div class="row-btns"><button type="button" class="btn small" data-vs-all="1"' + (nHid ? '' : ' disabled') + '>' + ED.icon('eye') + 'Show everything' + (nHid ? ' (' + nHid + ' hidden)' : '') + '</button></div>' +
      '<div class="vs-wrap">' + groups + '</div>';
  };
  const count = b => { const h = S().hidden || {}, n = Object.keys(h).filter(k => h[k]).length + (S().moodStrip === false ? 1 : 0), x = b.querySelector('[data-vs-all]'); if (x) { x.disabled = !n; x.innerHTML = ED.icon('eye') + 'Show everything' + (n ? ' (' + n + ' hidden)' : ''); } };
  VS.bindSettings = b => {
    b.addEventListener('change', ev => {
      const x = ev.target.closest('[data-vs]'); if (!x) return;
      const k = x.dataset.vs, s = S();
      ED.store.checkpoint('Pages shown');
      if (k === 'mood') s.moodStrip = x.checked;
      else { const h = Object.assign({}, s.hidden || {}); if (x.checked) delete h[k]; else h[k] = 1; s.hidden = h; }
      ED.store.commit(); ED.ui.toast(x.checked ? 'Shown again' : 'Hidden — nothing deleted; switch it on any time', { icon: x.checked ? 'eye' : 'eyeOff' });
      count(b);
    });
    b.addEventListener('click', ev => {
      if (!ev.target.closest('[data-vs-all]')) return;
      ED.store.checkpoint('Pages shown'); S().hidden = {}; S().moodStrip = true; ED.store.commit(); ED.ui.toast('Every page and part is shown', { icon: 'eye' });
      U.$$('[data-vs]', b).forEach(i => { i.checked = true; }); count(b);
    });
  };
})();
