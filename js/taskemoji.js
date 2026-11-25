/* E-Diary — an emoji for any task (optional). 1.26.6 added it; 1.26.7 widened the list (js/taskemoji-data.js:
   44 groups — AI & computing, edge AI, networking, cyber security, space & satellites, drones, defence, research
   papers & journals, patents, road / rail / air / sea, and every everyday area) and redrew the picker:
   a header with the current pick, a search box, icon tabs that follow the scroll, a hover preview and a box for
   any emoji you type or paste. Stored as task.emoji ('' = none); shown before the title everywhere a task is listed
   (ED.model.ttl). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const C = (ED.TASK_EMOJI || []).map(([name, s]) => [name, s.split('|').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf(' '); return i < 0 ? [x, ''] : [x.slice(0, i), x.slice(i + 1).trim()];
  })]);
  const TE = (ED.taskEmoji = { cats: C });
  const LS = 'ed-emoji-recent';
  const recent = () => { try { return (JSON.parse(localStorage.getItem(LS) || '[]') || []).slice(0, 18); } catch (err) { return []; } };
  const remember = x => { if (!x) return; try { localStorage.setItem(LS, JSON.stringify([x].concat(recent().filter(y => y !== x)).slice(0, 18))); } catch (err) { /* private window */ } };
  /* words for an emoji (first group that has it) — for the preview and titles */
  let words = null;
  const wordsOf = x => {
    if (!words) { words = {}; C.forEach(c => c[1].forEach(([k, w]) => { if (!(k in words)) words[k] = w; })); }
    return words[x] || '';
  };
  TE.count = () => C.reduce((a, c) => a + c[1].length, 0);
  TE.unique = () => new Set([].concat(...C.map(c => c[1].map(x => x[0])))).size;
  const label = w => { const s = (w || '').split(' ').slice(0, 3).join(' '); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };

  /* the picker: TE.pick(anchor, current, onPick(emoji | '')) */
  TE.pick = (anchor, cur, onPick) => {
    const btn = (x, w) => '<button type="button" class="emoji-btn' + (x === cur ? ' on' : '') + '" data-emo="' + e(x) + '" title="' + e(w || x) + '" aria-label="' + e(label(w) || x) + '">' + x + '</button>';
    const r = recent();
    const tab = (k, icon, name) => '<button type="button" class="te-etab" data-jump="' + k + '" title="' + e(name) + '" aria-label="' + e(name) + '">' + icon + '</button>';
    const sec = (k, icon, name, items) => '<section class="te-sec" data-sec="' + k + '" data-name="' + e(name.toLowerCase()) + '"><h4><span class="te-sec-ic">' + icon + '</span>' + e(name) + '<em>' + items.length + '</em></h4>' +
      '<div class="emoji-grid te-grid">' + items.map(x => btn(x[0], x[1])).join('') + '</div></section>';
    const html = '<div class="te-emo">' +
      '<div class="te-emo-head"><div class="te-emo-cur"><span class="te-emo-big' + (cur ? '' : ' none') + '">' + (cur || '🙂') + '</span>' +
        '<div class="te-emo-who"><b>Task emoji</b><small>' + (cur ? e(label(wordsOf(cur)) || 'Chosen') : 'None chosen — optional') + '</small></div></div>' +
        '<button type="button" class="te-none' + (!cur ? ' on' : '') + '" data-none>' + ED.icon('x') + 'No emoji</button></div>' +
      '<label class="te-emo-search">' + ED.icon('search') + '<span class="sr-only">Search emoji</span><input class="te-emo-q" type="search" placeholder="Search ' + TE.unique() + ' emojis: bus, satellite, IEEE, patent, birthday…" autocomplete="off" spellcheck="false"><span class="te-emo-n" aria-live="polite"></span></label>' +
      '<div class="te-emo-tabs" role="tablist">' + (r.length ? tab('recent', '🕘', 'Recent') : '') + C.map((c, i) => tab(i, c[1][0][0], c[0])).join('') + '</div>' +
      '<div class="te-emo-list">' +
        (r.length ? sec('recent', '🕘', 'Recently used', r.map(x => [x, wordsOf(x)])) : '') +
        C.map((c, i) => sec(i, c[1][0][0], c[0], c[1])).join('') +
        '<p class="te-emo-none" hidden>No emoji matches — try another word, or type / paste one below.</p></div>' +
      '<div class="te-emo-foot"><div class="te-emo-prev"><span class="te-prev-big"></span><span class="te-prev-txt">Hover an emoji to see its name</span></div>' +
        '<div class="emoji-own"><input class="field" maxlength="12" placeholder="Paste an emoji" aria-label="Your own emoji"><button type="button" class="btn small" data-own>Use</button></div></div></div>';
    ED.ui.popover(anchor, html, {
      cls: 'emoji-pop te-emo-pop',
      onMount(el, p) {
        const q = el.querySelector('.te-emo-q'), list = el.querySelector('.te-emo-list'), tabs = el.querySelector('.te-emo-tabs');
        const pb = el.querySelector('.te-prev-big'), pt = el.querySelector('.te-prev-txt'), n = el.querySelector('.te-emo-n');
        if (window.matchMedia && !window.matchMedia('(pointer: coarse)').matches) setTimeout(() => q.focus(), 30);
        const done = v => { p.close(true); remember(v); onPick(v); };
        /* active tab follows the scroll */
        let raf = 0;
        const mark = () => {
          raf = 0; const top = list.scrollTop + 8; let k = null;
          list.querySelectorAll('.te-sec:not([hidden])').forEach(s => { if (s.offsetTop <= top || k === null) k = s.dataset.sec; });
          tabs.querySelectorAll('.te-etab').forEach(t => {
            const on = t.dataset.jump === k; t.classList.toggle('on', on);
            if (on && (t.offsetLeft < tabs.scrollLeft || t.offsetLeft + t.offsetWidth > tabs.scrollLeft + tabs.clientWidth)) tabs.scrollLeft = t.offsetLeft - tabs.clientWidth / 2;
          });
        };
        list.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(mark); }, { passive: true });
        mark();
        /* search: every word must match; an emoji shown once */
        q.addEventListener('input', () => {
          const parts = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean); const seen = new Set(); let hits = 0;
          list.querySelectorAll('.te-sec').forEach(s => {
            let any = false;
            s.querySelectorAll('.emoji-btn').forEach(b => {
              const t = ' ' + (b.title + ' ' + s.dataset.name).toLowerCase().replace(/[&,]/g, ' ') + ' ';
              const ok = !parts.length || (parts.every(w => t.indexOf(' ' + w + (w.length <= 2 ? ' ' : '')) >= 0) || b.dataset.emo === q.value.trim());
              const show = ok && (!parts.length || !seen.has(b.dataset.emo));
              if (show && parts.length) { seen.add(b.dataset.emo); hits++; }
              b.hidden = !show; if (show) any = true;
            });
            s.hidden = !any || (!!parts.length && s.dataset.sec === 'recent');
          });
          el.classList.toggle('searching', !!parts.length);
          n.textContent = parts.length ? hits + ' found' : '';
          list.querySelector('.te-emo-none').hidden = !parts.length || hits > 0;
          list.scrollTop = 0; mark();
        });
        q.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); const b = list.querySelector('.te-sec:not([hidden]) .emoji-btn:not([hidden])'); if (b && q.value.trim()) done(b.dataset.emo); } });
        const show = b => { pb.textContent = b.dataset.emo; pt.textContent = label(b.title === b.dataset.emo ? '' : b.title) || 'Emoji'; };
        list.addEventListener('pointerover', ev => { const b = ev.target.closest('.emoji-btn'); if (b) show(b); });
        list.addEventListener('focusin', ev => { const b = ev.target.closest('.emoji-btn'); if (b) show(b); });
        el.addEventListener('click', ev => {
          const j = ev.target.closest('[data-jump]');
          if (j) { const s = list.querySelector('.te-sec[data-sec="' + j.dataset.jump + '"]'); if (s) { if (q.value) { q.value = ''; q.dispatchEvent(new Event('input')); } list.scrollTo({ top: s.offsetTop, behavior: 'smooth' }); } return; }
          const b = ev.target.closest('[data-emo]'); if (b) { done(b.dataset.emo); return; }
          if (ev.target.closest('[data-none]')) { p.close(true); onPick(''); return; }
          if (ev.target.closest('[data-own]')) { const v = el.querySelector('.emoji-own input').value.trim(); if (v) done(v); }
        });
        el.querySelector('.emoji-own input').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); const v = ev.target.value.trim(); if (v) done(v); } });
      },
    });
  };
  /* set the emoji of a saved task (task ⋯ menu) */
  TE.forTask = (anchor, t) => TE.pick(anchor, t.emoji || '', v => {
    ED.store.checkpoint('Emoji'); if (v) t.emoji = v; else delete t.emoji; t.updatedAt = Date.now(); ED.store.commit();
    ED.ui.toast(v ? 'Emoji ' + v + ' added' : 'Emoji removed');
  });
})();
