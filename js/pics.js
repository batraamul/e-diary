/* E-Diary — 1.22: pictures for Dreams, medical cards and the watch list.
   Photos chosen on the device are made small (about 900 px, JPEG) so the diary stays light enough to save and sync;
   an image address (https://…) can be used instead.
     PI.editor(host, list, o)  thumbnails with Remove, "Add photo" (several at once) and "or an image address";
                               o.max (how many), o.slots (['Front', 'Back'] — one picture per named slot). → { get() }
     PI.view(list, i, title)   a picture large, with previous / next */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const PI = (ED.pics = {});
  PI.ok = s => /^(data:image\/(png|jpe?g|gif|webp);base64,|https:\/\/\S+$)/i.test(String(s || ''));
  PI.shrink = f => U.imageToDataURL(f, 900, 0.8);

  PI.editor = (host, list, o) => {
    o = o || {};
    const slots = o.slots || null, max = slots ? slots.length : (o.max || 6);
    let pics = slots ? slots.map((s, i) => (list || [])[i] || '') : (list || []).filter(PI.ok).slice(0, max);
    const draw = () => {
      const cell = (src, i, label) => '<div class="pi-cell' + (src ? '' : ' empty') + '">' + (label ? '<span class="pi-lab">' + e(label) + '</span>' : '') +
        (src ? '<img src="' + e(src) + '" alt="' + e(label || 'Picture ' + (i + 1)) + '"><button type="button" class="pi-rm" data-pi="rm" data-i="' + i + '" aria-label="Remove ' + e(label || 'picture ' + (i + 1)) + '" title="Remove">' + ED.icon('x') + '</button>'
          : '<label class="pi-add"><input type="file" accept="image/*"' + (slots ? '' : ' multiple') + ' hidden data-pi="file" data-i="' + i + '">' + ED.icon('image') + '<span>' + (slots ? 'Add ' + e(label.toLowerCase()) : 'Add photo') + '</span></label>') + '</div>';
      const cells = slots ? slots.map((s, i) => cell(pics[i], i, s)) : pics.map((p, i) => cell(p, i)).concat(pics.length < max ? [cell('', pics.length)] : []);
      host.innerHTML = '<div class="pi-grid">' + cells.join('') + '</div>' +
        '<div class="pi-url"><input class="field" type="url" placeholder="…or paste an image address (https://…)" aria-label="Image address"><button type="button" class="btn small" data-pi="url">Add</button></div>';
    };
    host.addEventListener('change', async ev => {
      const inp = ev.target.closest('[data-pi="file"]'); if (!inp || !inp.files || !inp.files.length) return;
      const files = Array.from(inp.files);
      for (const f of files) {
        try {
          const d = await PI.shrink(f);
          if (slots) { const at = pics[+inp.dataset.i] ? pics.findIndex(x => !x) : +inp.dataset.i; if (at >= 0) pics[at] = d; }
          else if (pics.length < max) pics.push(d);
        } catch (err) { ED.ui.toast('Could not read ' + f.name); }
      }
      draw();
    });
    host.addEventListener('click', ev => {
      const b = ev.target.closest('[data-pi]'); if (!b || b.dataset.pi === 'file') return;
      if (b.dataset.pi === 'rm') { if (slots) pics[+b.dataset.i] = ''; else pics.splice(+b.dataset.i, 1); draw(); }
      if (b.dataset.pi === 'url') {
        const inp = host.querySelector('.pi-url input'), v = inp.value.trim();
        if (!/^https:\/\/\S+$/i.test(v)) { ED.ui.toast('Paste an address starting with https://'); return; }
        if (slots) { const at = pics.findIndex(x => !x); if (at < 0) { ED.ui.toast('Remove a picture first'); return; } pics[at] = v; }
        else { if (pics.length >= max) { ED.ui.toast('At most ' + max + ' pictures'); return; } pics.push(v); }
        draw();
      }
    });
    draw();
    return { get: () => slots ? pics.slice() : pics.filter(Boolean) };
  };

  PI.view = (list, i, title) => {
    const l = (list || []).filter(Boolean); if (!l.length) return;
    let at = Math.max(0, Math.min(l.length - 1, i || 0));
    ED.ui.modal({
      title: title || 'Picture', cls: 'st-modal wide pi-modal',
      body: '<div class="pi-big"><img alt=""><div class="pi-nav"' + (l.length > 1 ? '' : ' hidden') + '><button type="button" class="icon-btn" data-pv="-1" aria-label="Previous picture">' + ED.icon('chevL') + '</button><span class="num"></span><button type="button" class="icon-btn" data-pv="1" aria-label="Next picture">' + ED.icon('chevR') + '</button></div></div>',
      onMount(el) {
        const img = el.querySelector('img'), n = el.querySelector('.pi-nav .num');
        const show = () => { img.src = l[at]; img.alt = (title || 'Picture') + ' ' + (at + 1); n.textContent = (at + 1) + ' / ' + l.length; };
        el.addEventListener('click', ev => { const b = ev.target.closest('[data-pv]'); if (!b) return; at = (at + +b.dataset.pv + l.length) % l.length; show(); });
        el.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { at = (at + (ev.key === 'ArrowRight' ? 1 : -1) + l.length) % l.length; show(); } });
        show();
      },
    });
  };
})();
