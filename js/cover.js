/* E-Diary — the book itself: a closed leather cover that opens, and page turns that flip like paper.
   - The cover shows while the diary loads and opens by itself (or on a click); "Close diary" in the top bar
     closes it again, which also locks the password log.
   - Moving to another day or section turns the page: the old page lifts off and lands on the other side.
   Both are skipped when the system asks for reduced motion. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const KEY = 'e-diary-cover';
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const CV = (ED.cover = { el: null, isOpen: true });
  const info = () => {
    const c = U.lsGet(KEY, null) || {};
    const s = ED.store && ED.store.data && ED.store.data.settings;
    return { title: (s && s.diaryTitle) || c.title || 'My E-Diary', owner: (s && s.ownerName) || c.owner || '', on: s ? s.cover !== false : c.on !== false };
  };
  CV.remember = () => { const s = ED.store.data.settings; U.lsSet(KEY, { title: s.diaryTitle, owner: s.ownerName, on: s.cover !== false }); };
  CV.enabled = () => info().on;

  function html() {
    const i = info();
    const year = new Date().getFullYear();
    return '<div class="book" aria-hidden="true">' +
      '<div class="book-back"></div><div class="book-block"></div>' +
      '<div class="book-cover"><div class="bc-face">' +
      '<div class="bc-stitch"></div>' +
      '<div class="bc-emboss"><span class="bc-year">' + year + '</span><span class="bc-rule"></span><span class="bc-title">' + e(i.title) + '</span>' +
      (i.owner ? '<span class="bc-owner">' + e(i.owner) + '</span>' : '') + '<span class="bc-rule"></span><span class="bc-sub">Planner · Journal · Records</span></div>' +
      '<i class="bc-corner tl"></i><i class="bc-corner tr"></i><i class="bc-corner bl"></i><i class="bc-corner br"></i>' +
      '</div><div class="bc-inside"></div></div>' +
      '<div class="book-strap"></div><div class="book-ribbon"></div>' +
      '</div>' +
      '<button type="button" class="cover-open" data-cover-open>' + ED.icon('book') + '<span>Open the diary</span></button>';
  }

  /* show the closed book (on start, or when you close the diary) */
  CV.show = (opts) => {
    opts = opts || {};
    if (CV.el) return;
    const w = document.createElement('div');
    w.className = 'cover-wrap' + (opts.start ? ' at-start' : '') + (reduced() ? ' still' : '');
    w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Diary cover');
    w.innerHTML = html();
    document.body.appendChild(w);
    document.documentElement.classList.add('book-closed');
    CV.el = w; CV.isOpen = false;
    w.addEventListener('click', () => CV.open());
    w.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') { ev.preventDefault(); CV.open(); } });
    requestAnimationFrame(() => { w.classList.add('shown'); const b = w.querySelector('[data-cover-open]'); if (b && !opts.start) b.focus(); });
    if (!opts.start && ED.vault) ED.vault.lock(true);
  };
  CV.refresh = () => { if (CV.el) { const b = CV.el.querySelector('.bc-title'); if (b) b.textContent = info().title; } };

  /* open with the cover swinging to the left */
  CV.open = () => {
    const w = CV.el; if (!w || w.classList.contains('opening')) return;
    w.classList.add('opening');
    document.documentElement.classList.remove('book-closed');
    const t = reduced() ? 180 : 900;
    setTimeout(() => { w.remove(); if (CV.el === w) CV.el = null; CV.isOpen = true; }, t);
  };
  CV.close = () => CV.show({});

  /* ---------------- page turns ---------------- */
  const canFlip = () => !reduced() && window.matchMedia && matchMedia('(min-width: 1181px) and (min-height: 601px)').matches && !(ED.state && ED.state.calFull);
  const snap = page => {
    const c = page.cloneNode(true);
    c.removeAttribute('aria-label');
    U.$$('[id]', c).forEach(x => x.removeAttribute('id'));
    c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', '');
    U.$$('*', c).forEach(x => {
      for (const a of Array.from(x.attributes)) if (a.name.indexOf('data-') === 0 && a.name !== 'data-keep-scroll') x.removeAttribute(a.name);
      x.removeAttribute('draggable'); x.removeAttribute('contenteditable');
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(x.tagName) || x.hasAttribute('tabindex')) x.setAttribute('tabindex', '-1');
    });
    // keep scroll positions of the snapshot the same as the live page
    const sel = '.scroll, [data-keep-scroll], .ed-body, .rt-body';
    const srcs = U.$$(sel, page), dsts = U.$$(sel, c);
    srcs.forEach((x, i) => { if (x.scrollTop && dsts[i]) dsts[i].setAttribute('data-st', x.scrollTop); });
    c.classList.add('snap');
    return c;
  };
  const place = (el, rect, base) => { el.style.left = (rect.left - base.left) + 'px'; el.style.top = (rect.top - base.top) + 'px'; el.style.width = rect.width + 'px'; el.style.height = rect.height + 'px'; };
  const restoreScroll = root => U.$$('[data-st]', root).forEach(x => { x.scrollTop = +x.dataset.st; });

  /* call before the pages are re-rendered; returns a function to call after */
  CV.beginTurn = (dir) => {
    if (!dir || !canFlip() || !CV.isOpen) return null;
    const spread = ED.app.els.spread;
    const Lp = spread.querySelector('.page-left'), Rp = spread.querySelector('.page-right');
    if (!Lp || !Rp) return null;
    U.$$('.leaf, .leaf-under', spread).forEach(x => x.remove());
    const base = spread.getBoundingClientRect();
    const fwd = dir === 'fwd';
    const turning = fwd ? Rp : Lp, staying = fwd ? Lp : Rp;
    const rT = turning.getBoundingClientRect(), rS = staying.getBoundingClientRect();
    const front = snap(turning), under = snap(staying);
    return () => {
      const back = snap(fwd ? Lp : Rp);   // the new page that the turning sheet shows on its other side
      const cover = document.createElement('div'); cover.className = 'leaf-under'; place(cover, rS, base); cover.appendChild(under);
      const leaf = document.createElement('div'); leaf.className = 'leaf leaf-' + dir; place(leaf, rT, base);
      const f = document.createElement('div'); f.className = 'lf lf-front'; f.appendChild(front);
      const b = document.createElement('div'); b.className = 'lf lf-rear'; b.appendChild(back);
      leaf.appendChild(f); leaf.appendChild(b);
      // turn around the middle of the spine so the sheet lands exactly on the other page
      const gap = fwd ? rT.left - rS.right : rS.left - rT.right;
      leaf.style.transformOrigin = fwd ? (-gap / 2) + 'px 50%' : 'calc(100% + ' + (gap / 2) + 'px) 50%';
      spread.appendChild(cover); spread.appendChild(leaf);
      restoreScroll(cover); restoreScroll(leaf);
      requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.add('go')));
      const done = () => { leaf.remove(); cover.remove(); };
      leaf.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 900);
    };
  };

  /* ---------------- start-up ---------------- */
  if (CV.enabled() && document.readyState !== 'complete') {
    const go = () => { if (!ED.store || !ED.store.data) CV.show({ start: true }); };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
  const A = (ED.actions = ED.actions || {});
  A['close-diary'] = () => { if (ED.lock && ED.lock.on) ED.lock.lockNow(); else CV.close(); };   // a locked diary closes by locking
})();
