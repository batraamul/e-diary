/* E-Diary — UI kit: modals, confirm/prompt, toasts, menus, popovers, pickers */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const UI = (ED.ui = {});
  const stack = [];
  let seq = 0;

  /* ---------------- modal ---------------- */
  UI.modal = opts => {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    const id = 'm' + (++seq);
    const layer = document.createElement('div');
    layer.className = 'mlayer' + (opts.layerCls ? ' ' + opts.layerCls : '');
    layer.innerHTML =
      '<div class="mbackdrop"></div>' +
      '<div class="mframe' + (opts.plain ? ' plain' : '') + (opts.cls ? ' ' + opts.cls : '') + '" role="dialog" aria-modal="true"' +
      (opts.title ? ' aria-labelledby="' + id + '-t"' : ' aria-label="' + e(opts.label || 'Dialog') + '"') + '>' +
      '<div class="mpaper">' +
      (opts.noClose ? '' : '<button type="button" class="mclose icon-btn" data-mclose aria-label="Close">' + ED.icon('x') + '</button>') +
      (opts.title ? '<h2 class="mtitle" id="' + id + '-t">' + e(opts.title) + '</h2>' : '') +
      '<div class="mbody">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div class="mfoot">' + opts.footer + '</div>' : '') +
      '</div></div>';
    root.appendChild(layer);
    const frame = layer.querySelector('.mframe');
    const prevFocus = document.activeElement;
    let closed = false;
    const api = {
      el: frame, layer, id,
      close(result) {
        if (closed) return;
        closed = true;
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        layer.classList.add('closing');
        setTimeout(() => layer.remove(), 140);
        if (opts.onClose) { try { opts.onClose(result); } catch (err) { console.error(err); } }
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
      },
      requestClose() {
        if (opts.beforeClose) { const r = opts.beforeClose(); if (r === false) return; }
        api.close();
      },
    };
    stack.push(api);
    layer.querySelector('.mbackdrop').addEventListener('mousedown', () => { if (!opts.sticky) api.requestClose(); });
    layer.addEventListener('click', ev => { if (ev.target.closest('[data-mclose]')) api.requestClose(); });
    if (opts.onMount) opts.onMount(frame, api);
    requestAnimationFrame(() => {
      layer.classList.add('open');
      const f = frame.querySelector('[autofocus]') || frame.querySelector('input:not([type=hidden]):not([disabled]), textarea, select, [contenteditable="true"]') || frame.querySelector('button:not([data-mclose])');
      if (f && !opts.noAutoFocus) { try { f.focus({ preventScroll: true }); if (f.select && f.dataset.selectall != null) f.select(); } catch (err) { /* ignore */ } }
    });
    return api;
  };
  UI.top = () => stack[stack.length - 1] || null;
  UI.anyOpen = () => stack.length > 0;

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (UI.closePopovers()) { ev.preventDefault(); return; }
      const t = UI.top();
      if (t) { ev.preventDefault(); t.requestClose(); }
    } else if (ev.key === 'Tab') {
      const t = UI.top(); if (!t) return;
      const f = U.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]', t.el)
        .filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  }, true);

  /* ---------------- confirm / prompt ---------------- */
  UI.confirm = o => new Promise(resolve => {
    o = o || {};
    let result = false;
    const choices = o.choices || [{ id: true, label: o.ok || 'OK', danger: !!o.danger, primary: !o.danger }];
    const foot = '<button type="button" class="btn" data-mclose>' + e(o.cancel || 'Cancel') + '</button>' +
      choices.map((c, i) => '<button type="button" class="btn ' + (c.danger ? 'danger solid' : c.primary !== false ? 'primary' : '') + '" data-choice="' + i + '">' + e(c.label) + '</button>').join('');
    UI.modal({
      title: o.title || 'Are you sure?',
      cls: 'small',
      body: '<p class="confirm-msg">' + e(o.message || '') + '</p>',
      footer: foot,
      onMount(el, api) {
        el.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => { result = choices[+b.dataset.choice].id; api.close(); }));
        setTimeout(() => { const b = el.querySelector('[data-choice]:last-child'); if (b) b.focus(); }, 30);
      },
      noAutoFocus: true,
      onClose() { resolve(result); },
    });
  });

  UI.prompt = o => new Promise(resolve => {
    o = o || {};
    let result = null;
    UI.modal({
      title: o.title || 'Enter a value',
      cls: 'small',
      body: '<form class="prompt-form">' + (o.label ? '<label class="lbl" for="ed-prompt-in">' + e(o.label) + '</label>' : '') +
        (o.multiline
          ? '<textarea id="ed-prompt-in" class="field" rows="4" placeholder="' + e(o.placeholder || '') + '">' + e(o.value || '') + '</textarea>'
          : '<input id="ed-prompt-in" class="field" type="' + (o.type || 'text') + '" value="' + e(o.value || '') + '" placeholder="' + e(o.placeholder || '') + '" data-selectall autocomplete="off">') +
        (o.hint ? '<p class="hint" style="margin-top:6px">' + o.hint + '</p>' : '') + '</form>',
      footer: '<button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-ok>' + e(o.ok || 'Save') + '</button>',
      onMount(el, api) {
        const inp = el.querySelector('#ed-prompt-in');
        const ok = () => { result = inp.value; api.close(); };
        el.querySelector('[data-ok]').addEventListener('click', ok);
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); ok(); });
        if (o.multiline) inp.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) ok(); });
      },
      onClose() { resolve(result); },
    });
  });

  /* ---------------- toasts ---------------- */
  UI.toast = (msg, o) => {
    o = o || {};
    const root = document.getElementById('toast-root');
    if (!root) return;
    const t = document.createElement('div');
    t.className = 'toast' + (o.kind ? ' ' + o.kind : '');
    t.setAttribute('role', o.kind === 'err' ? 'alert' : 'status');
    t.innerHTML = (o.icon ? ED.icon(o.icon) : '') + '<span class="toast-msg">' + e(msg) + '</span>' +
      (o.action ? '<button type="button" class="toast-act">' + e(o.action) + '</button>' : '') +
      '<button type="button" class="toast-x" aria-label="Dismiss">' + ED.icon('x') + '</button>';
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    const kill = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 220); };
    const timer = o.timeout === 0 ? null : setTimeout(kill, o.timeout || (o.action ? 6500 : 3200));
    t.querySelector('.toast-x').addEventListener('click', () => { clearTimeout(timer); kill(); });
    if (o.action) t.querySelector('.toast-act').addEventListener('click', () => { clearTimeout(timer); kill(); if (o.onAction) o.onAction(); });
    while (root.children.length > 4) root.firstElementChild.remove();
    return { close: kill };
  };

  UI.undoToast = (msg) => UI.toast(msg, {
    action: 'Undo', onAction() {
      const label = ED.store.undo();
      if (label) UI.toast('Restored');
    },
  });

  /* ---------------- positioning ---------------- */
  UI.place = (el, anchor, placement) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    el.style.left = '0px'; el.style.top = '0px';
    const r = el.getBoundingClientRect();
    let x, y;
    if (anchor && anchor.getBoundingClientRect) {
      const a = anchor.getBoundingClientRect();
      x = placement === 'right-align' ? a.right - r.width : a.left;
      y = a.bottom + 6;
      if (y + r.height > vh - 8 && a.top - r.height - 6 > 8) y = a.top - r.height - 6;
    } else if (anchor && anchor.x != null) { x = anchor.x; y = anchor.y; if (y + r.height > vh - 8) y = Math.max(8, anchor.y - r.height); }
    else { x = (vw - r.width) / 2; y = (vh - r.height) / 3; }
    x = U.clamp(x, 8, Math.max(8, vw - r.width - 8));
    y = U.clamp(y, 8, Math.max(8, vh - r.height - 8));
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
  };

  /* ---------------- popovers & menus ---------------- */
  const pops = [];
  UI.closePopovers = () => {
    if (!pops.length) return false;
    pops.splice(0).forEach(p => p.close(true));
    return true;
  };
  document.addEventListener('mousedown', ev => {
    if (!pops.length) return;
    const inside = pops.some(p => p.el.contains(ev.target) || (p.anchor && p.anchor.contains && p.anchor.contains(ev.target)));
    if (!inside) UI.closePopovers();
  }, true);
  window.addEventListener('resize', () => UI.closePopovers());

  UI.popover = (anchor, html, o) => {
    o = o || {};
    UI.closePopovers();
    const el = document.createElement('div');
    el.className = 'popover' + (o.cls ? ' ' + o.cls : '');
    el.setAttribute('role', o.role || 'dialog');
    el.innerHTML = html;
    document.body.appendChild(el);
    const p = {
      el, anchor,
      close() {
        const i = pops.indexOf(p); if (i >= 0) pops.splice(i, 1);
        el.remove();
        if (o.onClose) o.onClose();
      },
    };
    pops.push(p);
    UI.place(el, anchor, o.placement);
    if (o.onMount) o.onMount(el, p);
    return p;
  };

  UI.menu = (anchor, items, o) => {
    o = o || {};
    const html = '<div class="menu-list" role="menu">' + items.map((it, i) => {
      if (it.sep) return '<div class="menu-sep" role="separator"></div>';
      if (it.header) return '<div class="menu-head">' + e(it.header) + '</div>';
      return '<button type="button" role="menuitem" class="menu-item' + (it.danger ? ' danger' : '') + (it.checked ? ' checked' : '') + '" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' +
        '<span class="mi-icon">' + (it.checked ? ED.icon('check') : it.icon ? ED.icon(it.icon) : it.html || '') + '</span>' +
        '<span class="mi-label">' + e(it.label) + '</span>' + (it.hint ? '<span class="mi-hint">' + e(it.hint) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    return UI.popover(anchor, html, {
      cls: 'menu' + (o.cls ? ' ' + o.cls : ''), role: 'presentation', placement: o.placement,
      onMount(el, p) {
        el.addEventListener('click', ev => {
          const b = ev.target.closest('[data-i]'); if (!b) return;
          const it = items[+b.dataset.i];
          p.close(true);
          if (it && it.onClick) it.onClick();
        });
        const first = el.querySelector('.menu-item:not([disabled])');
        if (first) first.focus({ preventScroll: true });
        el.addEventListener('keydown', ev => {
          const list = U.$$('.menu-item:not([disabled])', el);
          const i = list.indexOf(document.activeElement);
          if (ev.key === 'ArrowDown') { ev.preventDefault(); (list[i + 1] || list[0]).focus(); }
          if (ev.key === 'ArrowUp') { ev.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
        });
      },
    });
  };

  /* ---------------- pickers ---------------- */
  UI.swatches = (name, value, list) => {
    list = list || ED.model.SWATCHES;
    const custom = value && list.indexOf(value) < 0;
    return '<div class="swatches" role="radiogroup" aria-label="Colour">' + list.map(c =>
      '<label class="sw" style="--sw:' + c + '"><input type="radio" name="' + e(name) + '" value="' + c + '"' + (c === value ? ' checked' : '') + '><span></span><i class="sr-only">' + c + '</i></label>'
    ).join('') +
      '<label class="sw sw-custom" title="Custom colour"><input type="radio" name="' + e(name) + '" value="custom"' + (custom ? ' checked' : '') + '><span style="--sw:' + (custom ? value : '#ffffff') + '"></span>' +
      '<input type="color" class="sw-color" value="' + (custom ? value : '#888888') + '" aria-label="Custom colour"></label></div>';
  };
  UI.readSwatch = (root, name) => {
    const r = root.querySelector('input[name="' + name + '"]:checked');
    if (!r) return null;
    if (r.value === 'custom') return root.querySelector('.sw-custom .sw-color').value;
    return r.value;
  };
  UI.bindSwatches = root => {
    U.$$('.sw-custom', root).forEach(l => {
      const col = l.querySelector('.sw-color');
      col.addEventListener('input', () => { l.querySelector('input[type=radio]').checked = true; l.querySelector('span').style.setProperty('--sw', col.value); });
    });
  };

  UI.emojiPicker = (anchor, onPick) => {
    const html = '<div class="emoji-grid">' + ED.model.EMOJI.map(x => '<button type="button" class="emoji-btn" data-emo="' + e(x) + '">' + x + '</button>').join('') + '</div>' +
      '<div class="emoji-own"><input class="field" maxlength="8" placeholder="Or type / paste any emoji" aria-label="Custom emoji"><button type="button" class="btn small" data-own>Use</button><button type="button" class="btn small ghost" data-none>None</button></div>';
    UI.popover(anchor, html, {
      cls: 'emoji-pop',
      onMount(el, p) {
        el.addEventListener('click', ev => {
          const b = ev.target.closest('[data-emo]');
          if (b) { p.close(true); onPick(b.dataset.emo); return; }
          if (ev.target.closest('[data-own]')) { const v = el.querySelector('input').value.trim(); if (v) { p.close(true); onPick(v); } }
          if (ev.target.closest('[data-none]')) { p.close(true); onPick(''); }
        });
      },
    });
  };

  /* a small "busy" overlay for long operations */
  UI.busy = msg => {
    const el = document.createElement('div');
    el.className = 'busy';
    el.innerHTML = '<div class="busy-box"><span class="spinner"></span>' + e(msg || 'Working…') + '</div>';
    document.body.appendChild(el);
    return { close() { el.remove(); } };
  };
})();
