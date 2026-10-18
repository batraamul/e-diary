/* E-Diary — small rich-text editor (contenteditable + toolbar) used for notes, the diary page and the mission */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;

  const TOOLS = {
    bold: ['bold', 'Bold (Ctrl+B)'], italic: ['italic', 'Italic (Ctrl+I)'], underline: ['underline', 'Underline (Ctrl+U)'],
    strike: ['strike', 'Strikethrough'], heading: ['heading', 'Heading'], ul: ['ul', 'Bulleted list'], ol: ['ol', 'Numbered list'],
    quote: ['quote', 'Quote'], color: ['color', 'Text colour'], alignL: ['alignL', 'Align left'], alignC: ['alignC', 'Align centre'],
    link: ['link', 'Insert link'], image: ['image', 'Insert picture'], hr: ['hr', 'Divider line'], clear: ['clear', 'Clear formatting'],
  };
  const SETS = {
    full: ['bold', 'italic', 'underline', 'strike', '|', 'heading', 'ul', 'ol', 'quote', '|', 'color', 'alignL', 'alignC', '|', 'link', 'image', 'hr', 'clear'],
    mini: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'color', 'link', 'image'],
  };
  const COLORS = ['#16181c', '#b3261e', '#d9542b', '#ef6c00', '#2e7d32', '#1f6fe0', '#7b3fb8', '#c2185b', '#8a8f97'];

  ED.rich = {
    mount(host, opts) {
      opts = opts || {};
      const set = opts.toolbar === 'none' ? [] : SETS[opts.toolbar || 'mini'];
      host.innerHTML =
        '<div class="rt' + (opts.lined ? ' lined' : '') + (opts.cls ? ' ' + opts.cls : '') + '">' +
        (set.length ? '<div class="rt-bar" role="toolbar" aria-label="Formatting">' + set.map(k => k === '|' ? '<span class="rt-sep"></span>' :
          '<button type="button" class="rt-btn" data-rt="' + k + '" title="' + e(TOOLS[k][1]) + '" aria-label="' + e(TOOLS[k][1]) + '">' + ED.icon(TOOLS[k][0]) + '</button>').join('') + '</div>' : '') +
        '<div class="rt-body" contenteditable="' + (opts.readOnly ? 'false' : 'true') + '" role="textbox" aria-multiline="true" spellcheck="true"' +
        ' aria-label="' + e(opts.label || 'Text') + '" data-placeholder="' + e(opts.placeholder || '') + '"></div></div>';
      const wrap = host.firstElementChild;
      const bar = wrap.querySelector('.rt-bar');
      const body = wrap.querySelector('.rt-body');
      body.innerHTML = U.sanitize(opts.html || '');
      let last = body.innerHTML;

      const empty = () => { const t = (body.textContent || '').trim(); const hasImg = !!body.querySelector('img,hr'); wrap.classList.toggle('is-empty', !t && !hasImg); };
      empty();

      const emit = () => {
        empty();
        const html = body.innerHTML;
        if (html === last) return;
        last = html;
        if (opts.onChange) opts.onChange(U.sanitize(html));
      };
      const deb = U.debounce(emit, opts.delay || 450);
      body.addEventListener('input', () => { empty(); deb(); });
      body.addEventListener('blur', () => deb.flush());

      const exec = (cmd, val) => {
        body.focus();
        try { document.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor'); } catch (err) { /* ignore */ }
        document.execCommand(cmd, false, val);
        deb();
      };
      const blockIs = tag => {
        const sel = window.getSelection(); if (!sel.rangeCount) return false;
        let n = sel.anchorNode; while (n && n !== body) { if (n.nodeType === 1 && n.tagName === tag) return true; n = n.parentNode; }
        return false;
      };
      const insertImage = async file => {
        try {
          const url = await U.imageToDataURL(file, opts.imageMax || 1100);
          body.focus();
          document.execCommand('insertHTML', false, '<img src="' + url + '" alt="" style="max-width: 100%">');
          deb();
        } catch (err) { ED.ui.toast('Could not add that picture.'); }
      };

      if (bar) {
        bar.addEventListener('mousedown', ev => { if (ev.target.closest('.rt-btn')) ev.preventDefault(); });
        bar.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-rt]'); if (!b) return;
          const k = b.dataset.rt;
          switch (k) {
            case 'bold': exec('bold'); break;
            case 'italic': exec('italic'); break;
            case 'underline': exec('underline'); break;
            case 'strike': exec('strikeThrough'); break;
            case 'heading': exec('formatBlock', blockIs('H3') ? '<p>' : '<h3>'); break;
            case 'ul': exec('insertUnorderedList'); break;
            case 'ol': exec('insertOrderedList'); break;
            case 'quote': exec('formatBlock', blockIs('BLOCKQUOTE') ? '<p>' : '<blockquote>'); break;
            case 'alignL': exec('justifyLeft'); break;
            case 'alignC': exec('justifyCenter'); break;
            case 'hr': exec('insertHorizontalRule'); break;
            case 'clear': exec('removeFormat'); exec('formatBlock', '<p>'); break;
            case 'color': {
              const sel = window.getSelection();
              const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
              ED.ui.popover(b, '<div class="rt-colors">' + COLORS.map(c => '<button type="button" style="--sw:' + c + '" data-c="' + c + '" aria-label="' + c + '"></button>').join('') + '</div>', {
                onMount(el, p) {
                  el.addEventListener('mousedown', x => x.preventDefault());
                  el.addEventListener('click', x => {
                    const cb = x.target.closest('[data-c]'); if (!cb) return;
                    p.close(true);
                    body.focus();
                    if (range) { sel.removeAllRanges(); sel.addRange(range); }
                    exec('foreColor', cb.dataset.c);
                  });
                },
              });
              break;
            }
            case 'link': {
              const sel = window.getSelection();
              const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
              const url = await ED.ui.prompt({ title: 'Insert link', label: 'Web address', placeholder: 'https://', ok: 'Insert' });
              if (!url) break;
              const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : 'https://' + url.trim();
              body.focus();
              if (range) { sel.removeAllRanges(); sel.addRange(range); }
              if (range && !range.collapsed) exec('createLink', href);
              else exec('insertHTML', '<a href="' + e(href) + '">' + e(url.trim()) + '</a>&nbsp;');
              break;
            }
            case 'image': {
              const sel = window.getSelection();
              const range = sel.rangeCount && body.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
              const f = await U.pickFile('image/*');
              if (!f) break;
              body.focus();
              if (range) { sel.removeAllRanges(); sel.addRange(range); }
              else { const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
              await insertImage(f);
              break;
            }
          }
        });
      }

      body.addEventListener('paste', ev => {
        const cd = ev.clipboardData; if (!cd) return;
        const files = Array.from(cd.files || []).filter(f => /^image\//.test(f.type));
        if (files.length) { ev.preventDefault(); files.forEach(insertImage); return; }
        const html = cd.getData('text/html');
        if (html) {
          ev.preventDefault();
          let clean = U.sanitize(html.replace(/<!--[\s\S]*?-->/g, ''));
          clean = clean.replace(/\s(style)="[^"]*font-family[^"]*"/gi, '');
          document.execCommand('insertHTML', false, clean);
          deb();
          return;
        }
        const text = cd.getData('text/plain');
        if (text) { ev.preventDefault(); document.execCommand('insertText', false, text); }
      });
      body.addEventListener('dragover', ev => { if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).indexOf('Files') >= 0) ev.preventDefault(); });
      body.addEventListener('drop', ev => {
        const files = Array.from((ev.dataTransfer && ev.dataTransfer.files) || []).filter(f => /^image\//.test(f.type));
        if (!files.length) return;
        ev.preventDefault();
        if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(ev.clientX, ev.clientY); if (r) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } }
        files.forEach(insertImage);
      });

      // picture sizing
      body.addEventListener('click', ev => {
        const img = ev.target.closest('img');
        if (img && body.isContentEditable) {
          const set = (w, fl) => { img.style.width = w || ''; img.style.maxWidth = '100%'; img.style.float = fl || ''; img.style.marginLeft = fl === 'right' ? '12px' : ''; img.style.marginRight = fl === 'left' ? '12px' : ''; deb(); };
          ED.ui.menu(img, [
            { label: 'Small', onClick: () => set('30%') },
            { label: 'Medium', onClick: () => set('50%') },
            { label: 'Large', onClick: () => set('75%') },
            { label: 'Full width', onClick: () => set('100%') },
            { sep: true },
            { label: 'Float left', onClick: () => set(img.style.width || '45%', 'left') },
            { label: 'Float right', onClick: () => set(img.style.width || '45%', 'right') },
            { label: 'No float', onClick: () => set(img.style.width, '') },
            { sep: true },
            { label: 'Remove picture', danger: true, icon: 'trash', onClick: () => { img.remove(); deb(); } },
          ]);
          return;
        }
        const a = ev.target.closest('a');
        if (a && (ev.metaKey || ev.ctrlKey || !body.isContentEditable)) { ev.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
      });

      const ctrl = {
        el: wrap, body,
        getHTML() { deb.flush(); return U.sanitize(body.innerHTML); },
        setHTML(h) { body.innerHTML = U.sanitize(h || ''); last = body.innerHTML; empty(); },
        focus(end) {
          body.focus();
          if (end) { const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        },
        setEditable(on) { body.contentEditable = on ? 'true' : 'false'; wrap.classList.toggle('readonly', !on); },
        flush() { deb.flush(); },
        destroy() { deb.flush(); },
      };
      if (opts.autofocus) setTimeout(() => ctrl.focus(true), 30);
      return ctrl;
    },
  };
})();
