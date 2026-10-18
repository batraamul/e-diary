/* E-Diary — small shared helpers for the Interview, Health and Events pages:
     FX.form(o)       a dialog built from a list of fields (text, textarea, date, time, number, select, switch,
                      weekdays, a list of times) — returns the values to o.save(values, api)
     FX.linkEvent()   keeps a diary calendar event in step with an interview or a doctor's appointment
                      (so it shows on the calendars, can ring a reminder, and goes to Google Calendar when linked)
     FX.page()        the usual page frame: title, tools, a scrolling body */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc, M = ED.model;
  const FX = (ED.fx = {});
  const opt = (v, label, sel) => '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';
  FX.opt = opt;

  FX.page = (cls, title, tools, body, keep) =>
    '<div class="xp ' + cls + '"><div class="pg-head st-head"><h2 class="pg-title">' + title + '</h2>' + (tools ? '<div class="xp-tools">' + tools + '</div>' : '') + '</div>' +
    '<div class="st-scroll scroll" data-keep-scroll="' + e(keep || cls) + '">' + body + '</div></div>';

  FX.seg = (act, cur, items, label) => '<div class="seg st-seg" role="group" aria-label="' + e(label || 'Show') + '">' +
    items.map(x => '<button type="button" data-act="' + act + '" data-k="' + e(x[0]) + '" aria-pressed="' + (cur === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div>';

  FX.tile = (label, value, sub, cls) => '<div class="tile' + (cls ? ' ' + cls : '') + '"><span class="tile-l">' + e(label) + '</span><span class="tile-v">' + value + '</span><span class="tile-s hint">' + (sub || '') + '</span></div>';

  /* "today", "tomorrow", "in 5 days", "3 days ago" */
  FX.when = k => {
    if (!k) return '';
    const n = U.diffDays(U.today(), k);
    return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? 'in ' + n + ' days' : -n + ' days ago';
  };
  FX.dm = k => k ? U.fmtDM(k) : '';
  FX.time = t => t ? U.fmtTime(t, ED.store.data.settings.h12) : '';
  FX.link = w => {
    if (!w) return '';
    const url = /^https?:\/\//i.test(w) ? w : /^[\w-]+(\.[\w-]+)+/.test(w) ? 'https://' + w : null;
    return url ? '<a href="' + e(url) + '" target="_blank" rel="noopener noreferrer">' + e(w.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 48)) + ED.icon('external') + '</a>' : e(w);
  };

  /* ---------------- a dialog from a list of fields ---------------- */
  FX.form = o => {
    const d = o.data || {};
    const id = 'fx' + Math.random().toString(36).slice(2, 7);
    const days0 = [1, 2, 3, 4, 5, 6, 0];
    const field = f => {
      const fid = id + '-' + f.k, v = d[f.k];
      const lab = '<label class="lbl" for="' + fid + '">' + e(f.label) + '</label>';
      const hint = f.hint ? '<span class="hint fx-hint">' + e(f.hint) + '</span>' : '';
      if (f.type === 'head') return '<h4 class="fx-head">' + e(f.label) + '</h4>';
      if (f.type === 'textarea') return lab + '<div><textarea id="' + fid + '" class="field" rows="' + (f.rows || 3) + '" placeholder="' + e(f.ph || '') + '">' + e(v || '') + '</textarea>' + hint + '</div>';
      if (f.type === 'select') {
        const opts = (typeof f.options === 'function' ? f.options() : f.options);
        const has = opts.some(x => String(x[0]) === String(v == null ? '' : v));
        return lab + '<div><select id="' + fid + '" class="field">' + (!has && v ? opt(v, v, true) : '') + opts.map(x => opt(x[0], x[1], String(x[0]) === String(v == null ? (f.def != null ? f.def : '') : v))).join('') + '</select>' + hint + '</div>';
      }
      if (f.type === 'check') return '<span class="lbl"></span><label class="switch"><input id="' + fid + '" type="checkbox"' + (v ? ' checked' : '') + '><span class="track"></span><span>' + e(f.label) + '</span></label>';
      if (f.type === 'days') {
        const on = Array.isArray(v) && v.length ? v : days0;
        return '<span class="lbl">' + e(f.label) + '</span><div class="hb-days" id="' + fid + '" role="group" aria-label="' + e(f.label) + '">' + days0.map(i => '<label class="chip-check"><input type="checkbox" value="' + i + '"' + (on.indexOf(i) >= 0 ? ' checked' : '') + '><span>' + U.DAY3[i] + '</span></label>').join('') + '</div>';
      }
      if (f.type === 'times') {
        const list = Array.isArray(v) && v.length ? v : (f.def || ['08:00']);
        return '<span class="lbl">' + e(f.label) + '</span><div class="fx-times" id="' + fid + '">' + list.map(t => '<span class="fx-t"><input type="time" class="field" value="' + e(t) + '"><button type="button" class="icon-btn sm" data-fx="rm" aria-label="Remove this time">' + ED.icon('x') + '</button></span>').join('') +
          '<button type="button" class="btn small ghost" data-fx="addt">' + ED.icon('plus') + 'Time</button></div>';
      }
      const type = f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : f.type === 'number' ? 'number' : 'text';
      return lab + '<div><input id="' + fid + '" class="field' + (type === 'number' ? ' num' : '') + '" type="' + type + '"' + (f.step ? ' step="' + f.step + '"' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
        (f.list ? ' list="' + fid + '-l"' : '') + ' value="' + e(v == null ? '' : v) + '" placeholder="' + e(f.ph || '') + '"' + (f.max && type === 'text' ? ' maxlength="' + f.max + '"' : '') + '>' +
        (f.list ? '<datalist id="' + fid + '-l">' + f.list.map(x => '<option value="' + e(x) + '">').join('') + '</datalist>' : '') + hint + '</div>';
    };
    const body = (o.intro ? '<p class="hint fx-intro">' + o.intro + '</p>' : '') + '<form class="st-form fx-form"><div class="st-grid">' + o.fields.map(field).join('') + '</div></form>';
    return ED.ui.modal({
      title: o.title, cls: 'st-modal' + (o.wide ? ' wide' : ''), body,
      footer: (o.del ? '<button type="button" class="btn danger" data-x="del">' + ED.icon('trash') + (o.delLabel || 'Delete') + '</button>' : '') + (o.extra || '') +
        '<span class="grow"></span><button type="button" class="btn" data-mclose>Cancel</button><button type="button" class="btn primary" data-x="save">' + e(o.ok || 'Save') + '</button>',
      onMount(el, api) {
        const get = f => {
          const x = el.querySelector('#' + id + '-' + f.k);
          if (!x) return undefined;
          if (f.type === 'check') return x.checked;
          if (f.type === 'days') { const on = U.$$('input', x).filter(c => c.checked).map(c => +c.value).sort(); return on.length === 7 ? null : on; }
          if (f.type === 'times') return U.$$('input', x).map(i => i.value).filter(t => /^\d\d:\d\d$/.test(t)).sort().filter((t, i, a) => a.indexOf(t) === i);
          if (f.type === 'number') return x.value === '' ? null : +x.value;
          if (f.type === 'date') return U.isKey(x.value) ? x.value : '';
          return x.value.trim();
        };
        el.addEventListener('click', ev => {
          const b = ev.target.closest('[data-fx]'); if (!b) return;
          if (b.dataset.fx === 'rm') { const box = b.closest('.fx-times'); if (box.querySelectorAll('.fx-t').length > 1) b.closest('.fx-t').remove(); }
          if (b.dataset.fx === 'addt') {
            const s = document.createElement('span'); s.className = 'fx-t';
            s.innerHTML = '<input type="time" class="field" value="20:00"><button type="button" class="icon-btn sm" data-fx="rm" aria-label="Remove this time">' + ED.icon('x') + '</button>';
            b.before(s); s.querySelector('input').focus();
          }
        });
        const save = () => {
          const v = {};
          o.fields.forEach(f => { if (f.type !== 'head') v[f.k] = get(f); });
          const miss = o.fields.find(f => f.req && (v[f.k] == null || v[f.k] === '' || (Array.isArray(v[f.k]) && !v[f.k].length)));
          if (miss) { ED.ui.toast('Fill in: ' + miss.label); const x = el.querySelector('#' + id + '-' + miss.k); if (x && x.focus) x.focus(); return; }
          if (o.check) { const why = o.check(v); if (why) { ED.ui.toast(why); return; } }
          o.save(v, api);
        };
        el.querySelector('[data-x="save"]').addEventListener('click', save);
        el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); save(); });
        const del = el.querySelector('[data-x="del"]');
        if (del) del.addEventListener('click', async () => { const ok = await o.del(); if (ok !== false) api.close(); });
        if (o.mount) o.mount(el, api, get);
      },
    });
  };

  /* ---------------- a diary event that follows an interview or an appointment ----------------
     spec: { on, title, date, time, mins, location, notes, reminder (minutes before), color } */
  FX.linkEvent = (obj, spec) => {
    const D = ED.store.data;
    let ev = obj.eventId ? D.events.find(x => x.id === obj.eventId) : null;
    if (!spec.on || !spec.date) {
      if (ev) { D.events = D.events.filter(x => x.id !== ev.id); }
      delete obj.eventId;
      return null;
    }
    const start = spec.time || null;
    const end = start ? U.fromMin(Math.min(24 * 60 - 1, U.toMin(start) + (spec.mins || 60))) : null;
    const f = { title: spec.title, date: spec.date, allDay: !start, start, end, location: spec.location || '', notes: spec.notes || '', color: spec.color || M.EVENT_COLORS[0], reminder: start ? (spec.reminder != null ? spec.reminder : 60) : null, updatedAt: Date.now() };
    if (ev) Object.assign(ev, f);
    else { ev = M.newEvent(f); D.events.push(ev); obj.eventId = ev.id; }
    return ev;
  };
  FX.dropEvent = obj => { if (!obj || !obj.eventId) return; const D = ED.store.data; D.events = D.events.filter(x => x.id !== obj.eventId); };

  /* a text list, one item per line → array; and back */
  FX.lines = s => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
})();
