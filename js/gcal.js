/* E-Diary — Google Calendar link.
   Keeps a copy of your dated items in one Google calendar: tasks with a time or marked all-day, diary events, and
   study sessions that have a time. Each copy remembers its Google event id (data.gcal.map), so later edits update it
   and deletions remove it. Example entries are never copied.
   Two ways to reach Google:
     • Inside Claude — through your Google Calendar connector (claude.ai Settings → Connectors). No setup here.
     • Anywhere else — Google sign-in in the browser (Google Identity Services, no server). Needs your own OAuth
       Client ID (Settings → Google Calendar has the steps) and a web address (http://localhost… from the
       "Host on this computer" launcher, or your GitHub Pages site) — not a file:// page. Google gives browser-only
       apps a one-hour pass; after that one click on "Reconnect" (or your next drag) renews it.
   Without either, dragging an item to a time offers a one-click "Add to Google Calendar" link. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const D = () => ED.store.data;
  const S = () => ED.store.data.settings;
  const G = () => S().gcal;
  const API = 'https://www.googleapis.com/calendar/v3';
  const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly openid email';
  const TK = 'e-diary-gcal-token';
  const CX = 'Google Calendar';            // the connector's display name in claude.ai
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (err) { return 'UTC'; } })();

  const GC = (ED.gcal = { token: null, exp: 0, state: 'off', busy: false, pending: 0, done: 0, total: 0, error: '', lastSync: 0, calendars: null,
    mcp: null, mcpState: ED.env.claude ? 'waiting' : 'none', cxCode: '' });

  GC.via = () => ED.env.claude ? 'connector' : 'api';
  GC.blocked = () => {
    if (ED.env.claude) return GC.mcpState === 'none' ? 'This copy of the diary cannot reach your Claude connectors, so it cannot write to Google Calendar. Open the diary from your Claude artifacts (or use the downloaded copy with your own Client ID).' : '';
    if (ED.env.file) return 'Google sign-in does not work when the diary is opened as a file (' + (location.pathname.split('/').pop() || 'index.html') + '). Open E-Diary with its desktop shortcut or “Start E-Diary (Windows)” instead — they start it at http://localhost:47812, where Google sign-in works. (Run “Create Desktop Shortcut (Windows)” once to update the shortcut.)';
    return '';
  };
  GC.connected = () => GC.via() === 'connector' ? GC.mcpState === 'ready' && !/^(reauth|missing|denied)$/.test(GC.cxCode) : !!(GC.token && Date.now() < GC.exp - 60000);

  /* ---------------- sign-in (Google Identity Services, outside Claude) ---------------- */
  let gisLoading = null, tokenClient = null;
  function loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => resolve(); s.onerror = () => { gisLoading = null; reject(new Error('Could not reach Google. Check the internet connection.')); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }
  GC.connect = async (interactive, opts) => {
    const only = !!(opts && opts.only);          // just get a pass from Google for a one-off copy; do not link everything
    const why = GC.blocked(); if (why) { ED.ui.toast(why, { timeout: 9000 }); return false; }
    if (GC.via() === 'connector') return connectCx();
    const id = (G().clientId || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(id)) { ED.settings.open('gcal'); ED.ui.toast('Paste your OAuth Client ID first (it ends in .apps.googleusercontent.com).', { timeout: 7000 }); return false; }
    try { await loadGIS(); } catch (err) { ED.ui.toast(err.message, { kind: 'err' }); return false; }
    return new Promise(resolve => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: id, scope: SCOPE + (ED.gdrive && ED.gdrive.on() ? ' https://www.googleapis.com/auth/drive.file' : ''), include_granted_scopes: true, hint: G().email || undefined,
        callback: async resp => {
          if (resp.error) { GC.error = resp.error_description || resp.error; GC.state = 'error'; refresh(); resolve(false); return; }
          GC.token = resp.access_token; GC.exp = Date.now() + (resp.expires_in || 3600) * 1000;
          try { sessionStorage.setItem(TK, JSON.stringify({ t: GC.token, x: GC.exp, c: id })); } catch (err) { /* private mode */ }
          if (ED.gdrive && /drive\.file/.test(resp.scope || '')) ED.gdrive.takeToken(resp);   // one pass for Calendar and Drive (js/gdrive.js)
          GC.error = '';
          if (only && !G().on) { refresh(); resolve(true); return; }
          GC.state = 'on';
          const firstTime = !G().on;
          G().on = true;
          try { const me = await api('GET', 'https://openidconnect.googleapis.com/v1/userinfo'); if (me && me.email) G().email = me.email; } catch (err) { /* optional */ }
          ED.store.commit();
          if (firstTime) ED.ui.toast('Linked to Google Calendar' + (G().email ? ' as ' + G().email : '') + '. Copying your dated items…');
          resolve(true);
          GC.sync();
        },
        error_callback: err => { GC.error = err && err.type === 'popup_closed' ? 'The Google window was closed before finishing.' : err && err.type === 'popup_failed_to_open' ? 'The browser blocked the Google window. Allow pop-ups for this site and try again.' : (err && err.message) || 'Sign-in failed'; GC.state = G().on ? 'expired' : 'error'; refresh(); resolve(false); },
      });
      tokenClient.requestAccessToken({ prompt: interactive === 'consent' ? 'consent' : '' });
    });
  };

  /* a pass that Google Drive sync got (it asks for Calendar too when Calendar is linked) — js/gdrive.js */
  GC.takeToken = resp => {
    if (!resp || !resp.access_token || GC.via() !== 'api') return;
    GC.token = resp.access_token; GC.exp = Date.now() + (+resp.expires_in || 3600) * 1000;
    try { sessionStorage.setItem(TK, JSON.stringify({ t: GC.token, x: GC.exp, c: (G().clientId || '').trim() })); } catch (err) { /* private mode */ }
    if (G().on && GC.state !== 'on' && GC.state !== 'syncing') { GC.state = 'on'; GC.error = ''; setTimeout(() => GC.sync(), 50); }
  };

  /* inside Claude: the connector is the link; the first call asks you to allow it for this page */
  async function connectCx() {
    if (GC.mcpState !== 'ready') { ED.ui.toast('Waiting for Claude’s connectors — try again in a moment.'); return false; }
    const n = GC.plan().filter(o => o.op !== 'delete').length;
    const ok = await ED.ui.confirm({ title: 'Link Google Calendar',
      message: 'The diary will use your Google Calendar connector to copy ' + U.plural(n, 'item') + ' now (timed and all-day tasks' + (G().events ? ', events' : '') + (G().study ? ', study sessions with a time' : '') + '), and keep them up to date when you drag, edit or tick them. Example entries are never copied. Claude may ask you once to allow the connector for this page.',
      ok: 'Link and copy' });
    if (!ok) return false;
    G().on = true; GC.cxCode = ''; GC.error = ''; GC.state = 'on';
    ED.store.commit();
    GC.sync(true);
    return true;
  }

  GC.disconnect = async (removeEvents) => {
    if (removeEvents) {
      if (!GC.connected() && !(await GC.connect())) return;
      const keys = Object.keys(D().gcal.map);
      GC.state = 'syncing'; GC.total = keys.length; GC.done = 0; refresh();
      const errors = await pool(keys.map(k => async () => { const m = D().gcal.map[k]; if (m && m.id) await remove(m.cal, m.id); delete D().gcal.map[k]; GC.done++; refresh(); }), GC.via() === 'connector' ? 1 : 3);
      if (errors.length) {
        // keep the link and the copies we could not remove, so "Unlink and remove" can be tried again
        const left = Object.keys(D().gcal.map).length;
        GC.state = 'error'; GC.error = errors[0].cx ? cxExplain(errors[0]).text : (errors[0].message || 'Google Calendar did not answer');
        ED.store.commit({ silent: true, reason: 'gcal' }); refresh();
        ED.ui.toast('Could not remove ' + U.plural(left, 'copy', 'copies') + ' from Google Calendar: ' + GC.error + ' Nothing was unlinked — try again.', { kind: 'err', timeout: 12000 });
        return;
      }
      D().gcal.map = {};
    }
    try { if (GC.token && window.google && google.accounts) google.accounts.oauth2.revoke(GC.token, () => {}); } catch (err) { /* ignore */ }
    GC.token = null; GC.exp = 0; GC.state = 'off';
    try { sessionStorage.removeItem(TK); } catch (err) { /* ignore */ }
    G().on = false;
    ED.store.commit();
    ED.ui.toast(removeEvents ? 'Unlinked, and the diary’s copies were removed from Google Calendar' : 'Unlinked from Google Calendar. Events already copied stay there.');
  };

  /* ---------------- REST helpers (browser sign-in) ---------------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function api(method, url, body, tries) {
    tries = tries || 0;
    const res = await fetch(url.indexOf('http') === 0 ? url : API + url, {
      method, headers: Object.assign({ Authorization: 'Bearer ' + GC.token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { GC.token = null; GC.exp = 0; const er = new Error('expired'); er.code = 401; throw er; }
    if ((res.status === 403 || res.status === 429 || res.status >= 500) && tries < 4) {
      const txt = await res.text().catch(() => '');
      if (res.status !== 403 || /rate|quota|limit/i.test(txt)) { await sleep(800 * Math.pow(2, tries) + Math.random() * 300); return api(method, url, body, tries + 1); }
      const er = new Error(parseErr(txt) || 'Google refused the request (' + res.status + ')'); er.code = res.status; throw er;
    }
    if (res.status === 204) return null;
    const txt = await res.text();
    if (!res.ok) { const er = new Error(parseErr(txt) || 'Google Calendar error ' + res.status); er.code = res.status; throw er; }
    return txt ? JSON.parse(txt) : null;
  }
  const parseErr = t => { try { const j = JSON.parse(t); return (j.error && (j.error.message || j.error.status)) || ''; } catch (err) { return ''; } };
  const calPath = c => '/calendars/' + encodeURIComponent(c || 'primary') + '/events';
  async function pool(jobs, n) {
    let i = 0; const errors = [];
    const run = async () => { while (i < jobs.length) { const j = jobs[i++]; try { await j(); } catch (err) { if (err.code === 401 || err.stop) { i = jobs.length; errors.unshift(err); return; } errors.push(err); } } };
    await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, run));
    return errors;
  }

  /* ---------------- connector calls (inside Claude) ---------------- */
  const clean = o => { Object.keys(o).forEach(k => { if (o[k] === undefined || o[k] === null) delete o[k]; }); return o; };
  function cxInput(body, cal, forUpdate) {
    const allDay = !!(body.start && body.start.date);
    const ov = body.reminders && body.reminders.overrides;
    const inp = {
      summary: body.summary, description: body.description || '', location: body.location || undefined,
      calendarId: cal && cal !== 'primary' ? cal : undefined, notificationLevel: 'NONE', timeZone: TZ,
      startTime: allDay ? body.start.date + 'T00:00:00' : body.start.dateTime,
      endTime: allDay ? body.end.date + 'T00:00:00' : body.end.dateTime,
      allDay: allDay || undefined, colorId: body.colorId || undefined,
    };
    if (ov && ov.length) inp.overrideReminders = ov; else inp.useDefaultReminders = false;
    if (!forUpdate && body.recurrence) inp.recurrenceData = body.recurrence;
    return clean(inp);
  }
  /* things the connector's update cannot change in place: all-day ↔ timed, repeat rule, clearing the colour */
  const shape = body => (body.start && body.start.date ? 'A' : 'T') + '|' + JSON.stringify(body.recurrence || '') + '|' + (body.colorId || '');
  /* the Google event id in a create result (the Event resource, or text around it) */
  function eventId(p) {
    if (!p) return null;
    if (typeof p === 'object') {
      if (typeof p.id === 'string' && p.id) return p.id;
      if (typeof p.eventId === 'string' && p.eventId) return p.eventId;
      for (const k of ['event', 'result', 'data', 'item']) { const x = eventId(p[k]); if (x) return x; }
      if (typeof p.htmlLink === 'string') return fromLink(p.htmlLink);
      return null;
    }
    const s = String(p);
    try { return eventId(JSON.parse(s)); } catch (err) { /* text */ }
    const m = /"?(?:event_?id|id)"?\s*[:=]\s*"?([A-Za-z0-9_]{5,})/i.exec(s);
    if (m) return m[1];
    const l = /https:\/\/www\.google\.com\/calendar\/event\?eid=[\w%=-]+/.exec(s);
    return l ? fromLink(l[0]) : null;
  }
  function fromLink(link) {
    const m = /[?&]eid=([^&]+)/.exec(link); if (!m) return null;
    try { const b = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/'); return atob(b + '==='.slice((b.length + 3) % 4)).split(' ')[0] || null; } catch (err) { return null; }
  }
  const cxError = err => {
    const code = (err && err.code) || 'upstream_error';
    const msg = (err && err.message) || '';
    const x = new Error(msg || code); x.cx = code; x.stop = /^(needs_reauth|server_not_connected|selection_required|not_in_manifest|blocked_by_policy|approval_required|not_granted|capability_disabled|capability_removed)$/.test(code) || /insufficient.*scope|permission/i.test(msg);
    return x;
  };
  async function cx(tool, input) {
    try { const r = await GC.mcp.callTool(CX, tool, input, { cache: false }); return r ? (r.payload !== undefined ? r.payload : r) : null; }
    catch (err) { throw cxError(err); }
  }
  function cxExplain(err) {
    const c = err.cx, m = err.message || '';
    if (/insufficient.*scope|insufficient permission|access_token_scope/i.test(m)) return { code: 'scope', text: 'your Google Calendar connector has no permission to add events. In claude.ai open Settings → Connectors → Google Calendar, choose Disconnect, then Connect again — and on Google’s screen tick the boxes that let it see and edit your calendar events (Google leaves them unticked). Then click Try again.' };
    if (c === 'needs_reauth') return { code: 'reauth', text: 'Your Google Calendar connector needs signing in again: claude.ai Settings → Connectors → Google Calendar.' };
    if (c === 'server_not_connected' || c === 'server_not_found') return { code: 'missing', text: 'Add the Google Calendar connector in claude.ai Settings → Connectors, then click Try again.' };
    if (c === 'selection_required') return { code: 'missing', text: 'You have more than one Google Calendar connector — choose one when Claude asks, then click Try again.' };
    if (c === 'not_in_manifest') return { code: 'denied', text: 'Google Calendar is not allowed for this page. Allow it when Claude asks (or in the page’s permissions), then click Try again.' };
    if (c === 'blocked_by_policy' || c === 'approval_required') return { code: 'denied', text: 'Your organisation’s settings do not let this page use the Google Calendar connector.' };
    if (c === 'not_granted' || c === 'capability_disabled' || c === 'capability_removed') return { code: 'denied', text: 'Connectors are not available in this view of the diary.' };
    if (c === 'server_unavailable' || c === 'upstream_error' || c === 'rate_limited') return { code: 'busy', text: 'Google Calendar did not answer just now. Your changes are waiting — click Try again.' };
    return { code: 'error', text: m || 'Google Calendar reported a problem.' };
  }

  /* one write, either way */
  async function insert(cal, body) {
    if (GC.via() === 'connector') {
      const dup = await findCx(cal, body).catch(() => null); if (dup) return dup;
      const p = await cx('create_event', cxInput(body, cal)); return eventId(p);
    }
    const dup = await findApi(cal, body).catch(() => null);
    if (dup) { try { await api('PUT', calPath(cal) + '/' + encodeURIComponent(dup), body); } catch (err) { /* keep it as it is */ } return dup; }
    const r = await api('POST', calPath(cal), body); return r.id;
  }
  /* never twice: an event already in Google for this item (its E-Diary tag), or with the same title at the same time */
  const bare = t => String(t || '').replace(/^(✓|📚)\s*/u, '').replace(/^✓\s*/u, '').trim().toLowerCase();
  const startOf = b => b.start ? (b.start.dateTime || b.start.date || '') : '';
  const sameStart = (a, b) => { const x = startOf(a), y = (b.start && (b.start.dateTime || b.start.date || (typeof b.start === 'string' ? b.start : ''))) || b.startTime || ''; if (!x || !y) return false; return x.length <= 10 || y.length <= 10 ? x.slice(0, 10) === y.slice(0, 10) : Math.abs(new Date(x) - new Date(y)) < 60000; };
  async function findApi(cal, body) {
    const key = body.extendedProperties && body.extendedProperties.private && body.extendedProperties.private.ediary;
    if (key) { const r = await api('GET', calPath(cal) + '?maxResults=5&showDeleted=false&privateExtendedProperty=' + encodeURIComponent('ediary=' + key)); const hit = ((r && r.items) || []).find(x => x.status !== 'cancelled'); if (hit) return hit.id; }
    const st = startOf(body); if (!st) return null;
    const a = st.length <= 10 ? st + 'T00:00:00Z' : st, from = new Date(new Date(a) - 60000).toISOString(), to = new Date(+new Date(a) + 86400000).toISOString();
    const r = await api('GET', calPath(cal) + '?singleEvents=false&maxResults=50&timeMin=' + encodeURIComponent(from) + '&timeMax=' + encodeURIComponent(to) + '&q=' + encodeURIComponent(bare(body.summary).slice(0, 60)));
    const hit = ((r && r.items) || []).find(x => x.status !== 'cancelled' && bare(x.summary) === bare(body.summary) && sameStart(body, x));
    return hit ? hit.id : null;
  }
  async function findCx(cal, body) {
    const st = startOf(body); if (!st) return null;
    const a = st.length <= 10 ? st + 'T00:00:00Z' : st;
    const input = { startTime: new Date(new Date(a) - 60000).toISOString(), endTime: new Date(+new Date(a) + 86400000).toISOString(), pageSize: 50, timeZone: TZ };
    if (cal && cal !== 'primary') input.calendarId = cal;
    const p = await cx('list_events', input);
    const items = Array.isArray(p) ? p : (p && (p.events || p.items || p.results)) || [];
    const hit = items.find(x => x && bare(x.summary || x.title) === bare(body.summary) && sameStart(body, x));
    return hit ? (hit.id || hit.eventId || null) : null;
  }

  /* clean up: events this diary put into Google more than once (same title, same start) — keep one, delete the rest */
  GC.removeDuplicates = async () => {
    const cal = G().calendarId || 'primary', mine = new Set(Object.values(D().gcal.map).map(m => m.id).filter(Boolean));
    const from = U.addDays(U.today(), -120), to = U.addDays(U.today(), 400), seen = new Map(), extra = [];
    let token = null, pages = 0, items = [];
    do {
      let list, next = null;
      if (GC.via() === 'connector') {
        const input = { startTime: U.parse(from).toISOString(), endTime: U.parse(to).toISOString(), pageSize: 250, timeZone: TZ };
        if (cal !== 'primary') input.calendarId = cal; if (token) input.pageToken = token;
        const p = await cx('list_events', input);
        list = Array.isArray(p) ? p : (p && (p.events || p.items || p.results)) || []; if (p && !Array.isArray(p)) next = p.nextPageToken || p.next_page_token || null;
      } else {
        const r = await api('GET', calPath(cal) + '?singleEvents=false&maxResults=250&timeMin=' + encodeURIComponent(U.parse(from).toISOString()) + '&timeMax=' + encodeURIComponent(U.parse(to).toISOString()) + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
        list = (r && r.items) || []; next = (r && r.nextPageToken) || null;
      }
      items = items.concat(list); token = next; pages++;
    } while (token && pages < 20);
    items.filter(x => x && x.status !== 'cancelled' && /From E-Diary/.test(x.description || '')).forEach(x => {
      const k = bare(x.summary || x.title) + '|' + ((x.start && (x.start.dateTime || x.start.date)) || x.startTime || '');
      const id = x.id || x.eventId; if (!id) return;
      if (!seen.has(k)) { seen.set(k, id); return; }
      // keep the one the diary knows about
      if (mine.has(id) && !mine.has(seen.get(k))) { extra.push(seen.get(k)); seen.set(k, id); } else extra.push(id);
    });
    for (const id of extra) await remove(cal, id);
    return extra.length;
  };

  /* your choice, item by item */
  GC.inGoogle = key => { const m = D().gcal.map[key]; return !!(m && (m.id || m.one) && !(D().gcal.no || {})[key]); };
  GC.setPick = (key, on) => {
    const gc = D().gcal; gc.no = gc.no || {};
    if (on) { delete gc.no[key]; gc.map[key] = gc.map[key] || { id: null, h: '', cal: G().calendarId || 'primary' }; gc.map[key].one = true; }
    else { gc.no[key] = 1; if (gc.map[key]) delete gc.map[key].one; }
    ED.store.commit({ silent: true, reason: 'gcal' });
    if (G().on) GC.sync(true); else if (on) pushOne(false);
    ED.ui.toast(on ? 'Will be in Google Calendar' : 'Taken out of Google Calendar (stays in the diary)', { icon: 'calendar' });
  };
  GC.pickBtn = key => {
    const g = G(); if (!g.on && !g.clientId && GC.via() !== 'connector') return '';
    const on = GC.inGoogle(key) || (!g.pick && GC.wants(key) && !!GC.bodyFor(key));
    return '<button type="button" class="btn ghost gc-pick' + (on ? ' on' : '') + '" data-act="gc-pick" data-key="' + e(key) + '" data-on="' + on + '" title="' + (on ? 'This is copied to Google Calendar. Click to take it out (it stays in the diary).' : 'Copy this to Google Calendar') + '">' + ED.icon('calendar') + (on ? 'In Google Calendar ✓' : 'Add to Google Calendar') + '</button>';
  };
  (ED.actions = ED.actions || {})['gc-pick'] = el => { const on = el.dataset.on === 'true'; GC.setPick(el.dataset.key, !on); el.dataset.on = String(!on); el.classList.toggle('on', !on); el.innerHTML = ED.icon('calendar') + (!on ? 'In Google Calendar ✓' : 'Add to Google Calendar'); };
  async function change(cal, id, body, m) {
    if (GC.via() === 'connector') {
      if (m.s && m.s !== shape(body)) { await remove(cal, id); return insert(cal, body); }
      await cx('update_event', Object.assign({ eventId: id }, cxInput(body, cal, true)));
      return id;
    }
    try { await api('PUT', calPath(cal) + '/' + encodeURIComponent(id), body); return id; }
    catch (err) { if (err.code !== 404 && err.code !== 410) throw err; return insert(cal, body); }
  }
  async function remove(cal, id) {
    if (GC.via() === 'connector') {
      try { await cx('delete_event', clean({ eventId: id, calendarId: cal && cal !== 'primary' ? cal : undefined, notificationLevel: 'NONE' })); }
      catch (err) { if (!(err.cx === 'tool_error' && /not ?found|deleted|404|410/i.test(err.message))) throw err; }
      return;
    }
    try { await api('DELETE', calPath(cal) + '/' + encodeURIComponent(id)); } catch (err) { if (err.code !== 404 && err.code !== 410) throw err; }
  }

  /* ---------------- what the calendar should contain ---------------- */
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const ymd = k => k.replace(/-/g, '');
  const untilUTC = k => { const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), 23, 59, 59); return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''); };
  function recurrence(r, exdates, time, startKey) {
    if (!r || !r.freq) return undefined;
    let s = r.freq === 'weekdays' ? 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' : 'RRULE:FREQ=' + ({ daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' })[r.freq] + ';INTERVAL=' + Math.max(1, r.interval || 1);
    if (r.freq === 'weekly' && r.days && r.days.length) s += ';BYDAY=' + r.days.map(d => DAYS[d]).join(',');
    if (r.freq === 'weekly' && !(r.days && r.days.length)) s += ';BYDAY=' + DAYS[U.dow(startKey)];
    if (r.until) s += ';UNTIL=' + (time ? untilUTC(r.until) : ymd(r.until));
    const out = [s];
    const ex = (exdates || []).filter(k => k >= startKey);
    if (ex.length) out.push(time ? 'EXDATE;TZID=' + TZ + ':' + ex.map(k => ymd(k) + 'T' + time.replace(':', '') + '00').join(',') : 'EXDATE;VALUE=DATE:' + ex.map(ymd).join(','));
    return out;
  }
  const when = (k, time, minutes) => {
    if (!time) return { start: { date: k }, end: { date: U.addDays(k, 1) } };
    const a = U.toMin(time), b = a + Math.max(5, minutes || 30);
    const endK = b >= 1440 ? U.addDays(k, 1) : k;
    return { start: { dateTime: k + 'T' + time + ':00', timeZone: TZ }, end: { dateTime: endK + 'T' + U.fromMin(b % 1440) + ':00', timeZone: TZ } };
  };
  const tag = key => ({ private: { ediary: key } });

  /* one item as a Google event (null when it has no place in a calendar) */
  function taskBody(t, untimed) {
    if (!t || t.sample || !t.date || (!t.time && !t.allDay && !untimed)) return null;
    const st = t.repeat ? 'open' : (t.status || 'open');
    if (st === 'cancelled' || st === 'forwarded') return null;
    const done = !t.repeat && M.isClosed(st);
    const notes = U.stripHtml(t.notes || '').trim();
    const body = Object.assign({
      summary: (done ? '✓ ' : '') + '[' + M.code(t) + '] ' + (t.title || 'Task'),
      description: (notes ? notes + '\n\n' : '') + (t.checklist && t.checklist.length ? t.checklist.map(c => (c.done ? '☑ ' : '☐ ') + c.text).join('\n') + '\n\n' : '') + 'From E-Diary',
      extendedProperties: tag('t:' + t.id),
      reminders: t.alarm && t.time ? { useDefault: false, overrides: [{ method: 'popup', minutes: t.alarmBefore || 0 }] } : { useDefault: false },
    }, when(t.date, t.time, t.dur));
    if (done) body.colorId = '8';
    const rr = recurrence(t.repeat, t.exdates, t.time, t.date); if (rr) body.recurrence = rr;
    return body;
  }
  function eventBody(ev) {
    if (!ev || ev.sample || !ev.date) return null;
    const len = ev.allDay ? 0 : Math.max(15, (ev.end ? U.toMin(ev.end) : U.toMin(ev.start) + 60) - U.toMin(ev.start));
    const body = Object.assign({ summary: ev.title || 'Event', description: (ev.notes ? ev.notes + '\n\n' : '') + 'From E-Diary', location: ev.location || undefined, extendedProperties: tag('e:' + ev.id),
      reminders: ev.reminder != null && !ev.allDay ? { useDefault: false, overrides: [{ method: 'popup', minutes: ev.reminder }] } : { useDefault: false } }, when(ev.date, ev.allDay ? null : ev.start, len));
    const rr = recurrence(ev.repeat, ev.exdates, ev.allDay ? null : ev.start, ev.date); if (rr) body.recurrence = rr;
    return body;
  }
  function studyBody(s) {
    if (!s || !ED.study || !ED.study.plan() || ED.study.plan().sample) return null;
    const time = ED.study.timeOf(s); if (!time) return null;
    const tr = ED.study.track(s.trackId);
    const src = ED.study.sourceText ? ED.study.sourceText(s) : s.source;
    const body = Object.assign({ summary: (s.done ? '✓ ' : '📚 ') + ED.study.short(tr) + (s.kind ? ' (' + s.kind + ')' : '') + ': ' + (s.topic || 'Study'), description: (src ? src + '\n\n' : '') + (s.slot ? s.slot + ' · ' : '') + s.min + ' min · From E-Diary study plan', extendedProperties: tag('s:' + s.id), reminders: { useDefault: false } }, when(s.date, time, s.min));
    if (s.done) body.colorId = '8';
    return body;
  }
  GC.bodyFor = key => {
    const id = key.slice(2);
    if (key[0] === 't') return taskBody(M.task(id), G().untimed);
    if (key[0] === 'e') return eventBody(M.event(id));
    if (key[0] === 's') return studyBody(ED.study && ED.study.session(id));
    return null;
  };
  /* does the automatic copy include this kind of item? */
  GC.wants = key => {
    const g = G();
    if (g.pick || (D().gcal.no || {})[key]) return false;
    if (key[0] === 't') return !!g.tasks;
    if (key[0] === 'e') { const ev = M.event(key.slice(2)); return !!g.events && !(ev && ev.holiday && !g.holidays); }
    if (key[0] === 's') return !!g.study;
    return false;
  };

  GC.desired = () => {
    const g = G(), out = new Map(), pick = !!g.pick, no = D().gcal.no || {};
    if (!pick && g.tasks) D().tasks.forEach(t => { const b = taskBody(t, g.untimed); if (b) out.set('t:' + t.id, b); });
    if (!pick && g.events) D().events.forEach(ev => { if (ev.holiday && !g.holidays) return; const b = eventBody(ev); if (b) out.set('e:' + ev.id, b); });
    if (!pick && g.study && ED.study && ED.study.plan()) ED.study.sessions().forEach(s => { const b = studyBody(s); if (b) out.set('s:' + s.id, b); });
    // items copied by hand ("Add to Google Calendar" after a drag) stay in step too
    Object.keys(D().gcal.map).forEach(k => { if (!out.has(k) && D().gcal.map[k].one) { const b = GC.bodyFor(k); if (b) out.set(k, b); } });
    Object.keys(no).forEach(k => out.delete(k));          // items you took out of Google Calendar by hand
    return out;
  };

  /* ---------------- sync ---------------- */
  GC.sync = async (manual) => {
    if (!G().on || GC.blocked()) return;
    if (GC.busy) { GC.againSync = manual ? 'manual' : (GC.againSync || 'auto'); return; }
    if (GC.via() === 'connector' && GC.mcpState !== 'ready') return;
    if (!GC.connected()) {
      if (GC.via() === 'connector' && !manual) { GC.pending = GC.plan().length; refresh(); return; }
      if (GC.via() === 'connector') GC.cxCode = '';
      else { GC.state = 'expired'; GC.pending = GC.plan().length; refresh(); if (manual) GC.connect(); return; }
    }
    GC.busy = true; GC.againSync = null;
    const cal = G().calendarId || 'primary';
    const map = () => D().gcal.map;       // read afresh after each write (undo may swap the data meanwhile)
    const ops = GC.plan();
    GC.state = ops.length ? 'syncing' : 'on'; GC.total = ops.length; GC.done = 0; GC.pending = ops.length; refresh();
    let changed = false;
    const jobs = ops.map(op => async () => {
      if (op.op === 'insert') {
        const id = await insert(cal, op.body);
        map()[op.key] = Object.assign({ id, h: op.h, cal, s: shape(op.body) }, id ? {} : { lost: true });
      } else if (op.op === 'update') {
        const m = map()[op.key] || {};
        let id;
        if (!m.id) id = await insert(cal, op.body);
        else if (m.cal !== cal) { await remove(m.cal, m.id); id = await insert(cal, op.body); }
        else id = await change(cal, m.id, op.body, m);
        map()[op.key] = Object.assign({ id, h: op.h, cal, s: shape(op.body) }, m.one ? { one: true } : {}, id ? {} : { lost: true });
      } else {
        const m = map()[op.key]; if (m && m.id) await remove(m.cal, m.id); delete map()[op.key];
      }
      changed = true; GC.done++; GC.pending = Math.max(0, GC.pending - 1);
      if (GC.done % 10 === 0) refresh();
      if (GC.watch && GC.watch.has(op.key)) { GC.watch.delete(op.key); GC.sent = (GC.sent || 0) + 1; }
    });
    const errors = await pool(jobs, GC.via() === 'connector' ? 1 : 3);
    GC.busy = false;
    if (changed) ED.store.commit({ silent: true, reason: 'gcal' });
    if (errors.length && errors[0].code === 401) { GC.state = 'expired'; GC.pending = GC.plan().length; }
    else if (errors.length && errors[0].cx) { const x = cxExplain(errors[0]); GC.state = 'error'; GC.cxCode = x.code; GC.error = x.text; GC.pending = GC.plan().length; }
    else if (errors.length) { GC.state = 'error'; GC.error = errors[0].message + (errors.length > 1 ? ' (and ' + (errors.length - 1) + ' more)' : ''); }
    else {
      GC.state = 'on'; GC.error = ''; GC.cxCode = ''; GC.lastSync = Date.now();
      if (manual) ED.ui.toast(ops.length ? 'Google Calendar updated (' + U.plural(ops.length, 'change') + ')' : 'Google Calendar is up to date');
      else if (GC.sent) ED.ui.toast('Sent to Google Calendar ✓', { icon: 'calendar' });
    }
    GC.sent = 0;
    refresh();
    GC.rerun();
  };
  /* something asked to send while another send was running: do it now */
  GC.rerun = () => {
    if (GC.busy) return;
    if (GC.againSync) { const m = GC.againSync === 'manual'; GC.againSync = null; GC.sync(m); return; }
    if (GC.againOne) { const q = GC.againOne === 'quiet'; GC.againOne = null; pushOne(q); }
  };
  /* list of changes needed; also used to count what is waiting */
  GC.plan = () => {
    const want = GC.desired(), map = D().gcal.map, cal = G().calendarId || 'primary', ops = [];
    // an entry whose Google id could not be read ("lost") is only sent again when the item changes
    want.forEach((body, key) => { const h = fnv(JSON.stringify(body)); const m = map[key]; if (!m) ops.push({ op: 'insert', key, body, h }); else if (m.h !== h || m.cal !== cal || (!m.id && !m.lost)) ops.push({ op: 'update', key, body, h }); });
    Object.keys(map).forEach(key => { if (!want.has(key)) ops.push({ op: 'delete', key }); });
    return ops;
  };
  /* a harmless test: list the calendars (read only) and say what is wrong, if anything */
  GC.check = async () => {
    if (GC.via() !== 'connector') { if (!GC.connected()) { ED.ui.toast('Not signed in to Google yet — click Link Google Calendar.'); return; } }
    else if (GC.mcpState !== 'ready') { ED.ui.toast(GC.mcpState === 'waiting' ? 'Still waiting for Claude’s connectors…' : GC.blocked()); return; }
    const busy = ED.ui.busy('Checking Google Calendar…');
    if (GC.via() === 'connector') GC.cxCode = '';          // ask again even after an earlier refusal
    try {
      const cals = await GC.calendarsList();
      if (cals == null) throw new Error('Google Calendar could not be reached.');
      GC.cxCode = ''; if (GC.state === 'error') { GC.state = G().on ? 'on' : 'off'; GC.error = ''; }
      ED.ui.toast('Google Calendar works ✓' + (cals && cals.length ? ' — ' + U.plural(cals.length, 'calendar') + ' found' : ''), { icon: 'calendar' });
      if (GC.waiting()) pushOne(true);
    } catch (err) {
      const x = err.cx ? cxExplain(err) : { code: 'error', text: err.message || String(err) };
      GC.state = 'error'; GC.cxCode = x.code; GC.error = x.text; GC.pending = GC.waiting();
      ED.ui.toast('Google Calendar: ' + x.text, { kind: 'err', timeout: 15000 });
    } finally { busy.close(); refresh(); }
  };
  GC.calendarsList = async () => {
    if (!GC.connected()) return null;
    if (GC.via() === 'connector') {
      const p = await cx('list_calendars', {});
      const arr = Array.isArray(p) ? p : (p && (p.calendars || p.items || p.calendarList)) || [];
      GC.calendars = arr.map(c => ({ id: c.id || c.calendarId, name: c.summaryOverride || c.summary || c.name || c.id, primary: !!c.primary })).filter(c => c.id);
      return GC.calendars;
    }
    const r = await api('GET', '/users/me/calendarList?minAccessRole=writer');
    GC.calendars = (r.items || []).map(c => ({ id: c.id, name: c.summaryOverride || c.summary, primary: !!c.primary }));
    return GC.calendars;
  };

  /* ---------------- reading Google events (the Events & Meetings page) ---------------- */
  /* every calendar you can see, with Google's colour when it gives one */
  GC.readCalendars = async () => {
    if (GC.via() === 'connector') {
      const p = await cx('list_calendars', {});
      const arr = Array.isArray(p) ? p : (p && (p.calendars || p.items || p.calendarList)) || [];
      return arr.map(c => ({ id: c.id || c.calendarId, name: c.summaryOverride || c.summary || c.name || c.id, primary: !!c.primary, color: c.backgroundColor || c.color || '' })).filter(c => c.id);
    }
    const r = await api('GET', '/users/me/calendarList');
    return ((r && r.items) || []).map(c => ({ id: c.id, name: c.summaryOverride || c.summary, primary: !!c.primary, color: c.backgroundColor || '' }));
  };
  const localOf = x => { const d = new Date(x); return isNaN(d) ? null : { k: U.key(d), t: U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) }; };
  /* one Google event in a common shape (the connector and the REST API word things differently) */
  GC.normEvent = (ev, calId) => {
    if (!ev || typeof ev !== 'object' || ev.status === 'cancelled') return null;
    const side = (o, flat, flat2) => o && typeof o === 'object' ? (o.dateTime || o.date || null) : typeof o === 'string' ? o : (flat || flat2 || null);
    const s = side(ev.start, ev.startTime, ev.start_time), f = side(ev.end, ev.endTime, ev.end_time);
    if (!s) return null;
    const dayOnly = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x));
    const allDay = ev.allDay === true || ev.all_day === true || !!(ev.start && ev.start.date && !ev.start.dateTime) || dayOnly(s);
    let date, time = null, endDate, endTime = null;
    if (allDay) {
      date = String(s).slice(0, 10);
      endDate = f ? U.addDays(String(f).slice(0, 10), -1) : date;      // Google's all-day end is the day after
      if (endDate < date) endDate = date;
    } else {
      const a = localOf(s), b = f ? localOf(f) : null; if (!a) return null;
      date = a.k; time = a.t; endDate = b ? b.k : date; endTime = b ? b.t : null;
      if (b && b.t === '00:00' && b.k > a.k) { endDate = U.addDays(b.k, -1); endTime = '23:59'; }
    }
    const conf = ev.conferenceData && ev.conferenceData.entryPoints ? (ev.conferenceData.entryPoints.find(p => p.entryPointType === 'video') || {}).uri : '';
    const desc = ev.description ? (/<[a-z][\s\S]*>/i.test(ev.description) ? U.stripHtml(ev.description) : ev.description) : '';
    return {
      gid: String(ev.id || ev.eventId || ev.event_id || ''), cal: calId || 'primary', title: ev.summary || ev.title || '(no title)',
      date, time, endDate, endTime, allDay, location: ev.location || '', desc: String(desc).trim(),
      link: ev.htmlLink || ev.html_link || '', meet: ev.hangoutLink || ev.meetUrl || ev.googleMeetUrl || conf || '',
      attendees: (ev.attendees || []).map(x => typeof x === 'string' ? x : (x.displayName || x.email || '')).filter(Boolean),
      organizer: ev.organizer ? (ev.organizer.displayName || ev.organizer.email || '') : '', recurring: !!(ev.recurringEventId || ev.recurrence), rid: String(ev.recurringEventId || ev.recurring_event_id || ''), colorId: ev.colorId || '',
    };
  };
  /* a read that never answers must not leave the page waiting for ever */
  const timed = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Google Calendar did not answer in time. Click Refresh to try again.'), { code: 'timeout' })), ms || 30000))]);
  /* events from one calendar between two day keys (the second not included) */
  GC.readEvents = async (calId, from, to) => {
    const tMin = U.parse(from).toISOString(), tMax = U.parse(to).toISOString();
    const out = [], seen = new Set();
    let token = null, pages = 0;
    do {
      let items, next = null;
      if (GC.via() === 'connector') {
        const input = { startTime: tMin, endTime: tMax, orderBy: 'startTime', pageSize: 250, timeZone: TZ };
        if (calId && calId !== 'primary') input.calendarId = calId;
        if (token) input.pageToken = token;
        const p = await timed(cx('list_events', input));
        items = Array.isArray(p) ? p : (p && (p.events || p.items || p.results)) || [];
        if (p && !Array.isArray(p)) next = p.nextPageToken || p.next_page_token || null;
      } else {
        const q = '?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=' + encodeURIComponent(tMin) + '&timeMax=' + encodeURIComponent(tMax) + (token ? '&pageToken=' + encodeURIComponent(token) : '');
        const r = await timed(api('GET', '/calendars/' + encodeURIComponent(calId || 'primary') + '/events' + q));
        items = (r && r.items) || []; next = (r && r.nextPageToken) || null;
      }
      items.forEach(ev => { const n = GC.normEvent(ev, calId); if (n && !seen.has(n.gid + n.date + (n.time || ''))) { seen.add(n.gid + n.date + (n.time || '')); out.push(n); } });
      token = next; pages++;
    } while (token && pages < 8);
    return out;
  };
  /* can the diary read Google right now? ('' = yes, otherwise why not) */
  GC.readable = () => {
    const why = GC.blocked(); if (why) return why;
    if (GC.via() === 'connector') return GC.mcpState === 'ready' ? '' : GC.mcpState === 'waiting' ? 'Waiting for Claude’s connectors…' : 'The Google Calendar connector is not available here.';
    if (!/\.apps\.googleusercontent\.com$/.test((G().clientId || '').trim())) return 'To show your Google events here, add your Google Client ID in Settings → Google Calendar (steps are shown there).';
    return GC.connected() ? '' : 'signin';
  };
  GC.explain = err => err && err.cx ? cxExplain(err) : { code: err && err.code === 401 ? 'expired' : 'error', text: (err && err.message) || String(err) };

  /* ---------------- after a drag: send it now, or offer a one-click copy ---------------- */
  const soon = U.debounce(() => GC.sync(), 700);
  GC.afterDrop = key => {
    try {
      // an example entry you drag becomes your own (examples are otherwise never copied)
      const own = key[0] === 't' ? M.task(key.slice(2)) : key[0] === 'e' ? M.event(key.slice(2)) : null;
      if (own && own.sample) { delete own.sample; ED.store.commit({ silent: true }); }
      const body = GC.bodyFor(key);
      const g = G();
      if (!body) {                                         // no time and not all-day: nothing to put in a calendar
        const was = D().gcal.map[key];                     // …but a copy sent earlier by hand is taken out again
        if (was && was.one && !g.on && GC.via() === 'connector' && GC.mcpState === 'ready') pushOne(true);
        return;
      }
      if (g.on && !GC.blocked() && (GC.wants(key) || (D().gcal.map[key] || {}).one)) {
        GC.watch = GC.watch || new Set(); GC.watch.add(key);
        if (GC.via() === 'api' && !GC.connected()) { GC.connect(); return; }   // the drag is a click: Google may renew the pass at once
        soon();
        return;
      }
      const mine = D().gcal.map[key];
      if (mine && mine.one && GC.via() === 'connector' && GC.mcpState === 'ready') { pushOne(); return; }   // copied before: keep it in step
      const cx = GC.via() === 'connector' && GC.mcpState === 'ready';
      const mark = () => { D().gcal.map[key] = D().gcal.map[key] || { id: null, h: '', cal: g.calendarId || 'primary', one: true }; D().gcal.map[key].one = true; GC.watch = GC.watch || new Set(); GC.watch.add(key); };
      // inside Claude: what you drop on a time or on "All day events" goes to Google Calendar straight away
      if (cx && g.auto !== false) { mark(); ED.store.commit({ silent: true, reason: 'gcal' }); pushOne(); return; }
      // elsewhere: a Client ID is set but not linked yet — the drag is a click, so sign in now
      if (GC.via() === 'api' && g.clientId && !GC.blocked() && g.auto !== false) {
        mark(); ED.store.commit({ silent: true, reason: 'gcal' });
        if (GC.connected()) pushOne(); else GC.connect(false, { only: true }).then(ok => { if (ok) pushOne(); });
        return;
      }
      if (g.offer === false) return;
      const title = body.summary.replace(/^✓ /, '');
      const one = () => {
        if (cx) { mark(); pushOne(); return; }
        const a = body.start.dateTime ? body.start.dateTime.slice(11, 16) : null;
        const k = (body.start.date || body.start.dateTime).slice(0, 10);
        const len = a ? (U.toMin(body.end.dateTime.slice(11, 16)) - U.toMin(a) + 1440) % 1440 || 30 : 0;
        window.open(GC.templateUrl(title, k, a, len, body.description), '_blank', 'noopener');
      };
      ED.ui.toast('Put “' + title + '” in Google Calendar?', { icon: 'calendar', action: 'Add to Google Calendar', onAction: one, timeout: 9000 });
    } catch (err) { console.warn('[e-diary] calendar offer', err); }
  };
  /* copy the hand-picked items only (Google Calendar not linked for everything) */
  async function pushOne(quiet) {
    if (GC.busy) { GC.againOne = GC.againOne === 'loud' || !quiet ? 'loud' : 'quiet'; return; }   // another drop while sending: go round again after
    const before = GC.cxCode;
    const was = G().on;
    // temporarily treat only hand-picked items as wanted
    const map = D().gcal.map, cal = G().calendarId || 'primary';
    const keys = Object.keys(map).filter(k => map[k].one);
    GC.busy = true;
    const errors = [];
    let sent = 0, changed = 0, touched = false;
    for (const key of keys) {
      const body = GC.bodyFor(key); const m = map[key];
      try {
        if (!body) { if (m.id) await remove(m.cal, m.id); delete map[key]; touched = true; continue; }
        const h = fnv(JSON.stringify(body));
        if ((m.id || m.lost) && m.h === h && (m.cal || cal) === cal) continue;
        let id;
        if (m.id && m.cal && m.cal !== cal) { await remove(m.cal, m.id); id = await insert(cal, body); }   // calendar changed in Settings
        else id = m.id ? await change(cal, m.id, body, m) : await insert(cal, body);
        touched = true;
        D().gcal.map[key] = Object.assign({ id, h, cal, s: shape(body), one: true }, id ? {} : { lost: true });
        if (!m.id) sent++; else changed++;
      } catch (err) { errors.push(err); if (err.stop) break; }
    }
    GC.busy = false;
    if (touched) ED.store.commit({ silent: true, reason: 'gcal' });
    if (errors.length) {
      const x = errors[0].cx ? cxExplain(errors[0]) : { code: 'error', text: errors[0].message };
      GC.state = 'error'; GC.cxCode = x.code; GC.error = x.text; GC.pending = GC.waiting();
      if (!quiet) ED.ui.toast(before === x.code && x.code === 'scope' ? 'Saved in the diary, not in Google Calendar yet — the connector still has no calendar permission (see the note at the top).' : 'Not in Google Calendar yet — ' + x.text, { kind: 'err', timeout: 14000 });
    } else {
      if (!G().on && GC.state === 'error') { GC.state = 'off'; GC.cxCode = ''; GC.error = ''; }
      GC.pending = 0;
      if (!quiet && (sent || changed)) ED.ui.toast(sent ? 'Added to Google Calendar ✓' : 'Updated in Google Calendar ✓', { icon: 'calendar' });
      else if (sent) ED.ui.toast('Sent to Google Calendar ✓ (' + U.plural(sent, 'item') + ' waiting from before)', { icon: 'calendar' });
    }
    refresh();
    if (was !== G().on) refresh();
    if (errors.length) GC.againOne = null;
    GC.rerun();
  }
  /* items dragged while Google could not be reached: sent on the next try */
  GC.waiting = () => { const map = D().gcal.map; return Object.keys(map).filter(k => map[k].one && !map[k].id && !map[k].lost).length; };
  GC.pushOne = pushOne;

  /* ---------------- status in the top bar and a notice when something needs you ---------------- */
  function refresh() {
    if (ED.settings && ED.settings.tab === 'gcal') ED.settings.refresh();
    const n = document.getElementById('notices');
    if (n && ED.app && ED.app.els && ED.app.els.notices) ED.app.els.notices.innerHTML = ED.app.notices();
  }
  GC.notice = () => {
    if (GC.blocked()) return '';
    if (!G().on && !(GC.state === 'error' && GC.cxCode && GC.waiting())) return '';
    if (GC.state === 'expired' && GC.pending) return '<div class="notice info">' + ED.icon('calendar') + '<span class="grow"><b>Google Calendar:</b> ' + U.plural(GC.pending, 'change') + ' waiting. Google asks browser apps to confirm the link about once an hour.</span><button type="button" class="btn small primary" data-act="gcal-connect">Reconnect</button></div>';
    if (GC.state === 'error') return '<div class="notice' + (GC.cxCode === 'scope' ? ' err' : '') + '">' + ED.icon('calendar') + '<span class="grow"><b>Google Calendar:</b> ' + e(GC.error) + (GC.pending ? ' <b>(' + U.plural(GC.pending, 'item') + ' waiting — they are sent as soon as this is fixed)</b>' : '') + '</span><button type="button" class="btn small" data-act="open-settings" data-tab="gcal">Details</button><button type="button" class="btn small primary" data-act="gcal-sync">Try again</button></div>';
    return '';
  };

  const hasOnes = () => Object.keys(D().gcal.map).some(k => D().gcal.map[k].one);
  const auto = U.debounce(() => {
    if (GC.cxCode === 'scope' || /^(reauth|missing|denied)$/.test(GC.cxCode) || GC.blocked()) return;
    if (G().on) GC.sync();
    else if (GC.via() === 'connector' && GC.mcpState === 'ready' && hasOnes()) pushOne(true);
  }, 4000);
  GC.init = () => {
    ED.store.on((type, d) => { if (type === 'change' && !(d && d.reason === 'gcal')) auto(); });
    if (ED.env.claude) {
      let settled = false;
      const done = m => {
        if (settled) return; settled = true;
        GC.mcp = m || null; GC.mcpState = m ? 'ready' : 'none';
        if (ED.state.tab === 'events' && ED.app && ED.app.render) setTimeout(() => { ED.app.render(); if (ED.meetings && m) ED.meetings.fetch(false); }, 0);
        if (m && G().on) { GC.state = 'on'; GC.sync(); }
        else if (m && GC.waiting()) pushOne(true);
        refresh();
        if (m && ED.meetings && ED.state.tab === 'events') ED.meetings.fetch(false);
      };
      try { window.claude.use('mcp').then(done, () => done(null)); } catch (err) { done(null); }
      setTimeout(() => done(null), 15000);
      return;
    }
    if (!G().on || GC.blocked()) return;
    try { const s = JSON.parse(sessionStorage.getItem(TK) || 'null'); if (s && s.x > Date.now() + 60000 && s.c === G().clientId) { GC.token = s.t; GC.exp = s.x; } } catch (err) { /* ignore */ }
    GC.state = GC.connected() ? 'on' : 'expired';
    GC.pending = GC.plan().length;
    if (GC.connected()) GC.sync(); else refresh();
  };

  const A = (ED.actions = ED.actions || {});
  A['gcal-connect'] = () => GC.connect();
  A['gcal-sync'] = () => { GC.cxCode = ''; if (G().on) GC.sync(true); else pushOne(false); };
  A['gcal-check'] = () => GC.check();

  /* "Add to Google Calendar" link for one item (works everywhere, no sign-in) */
  GC.templateUrl = (title, k, time, minutes, details, location) => {
    const d = ymd(k);
    let dates;
    if (time) { const a = U.toMin(time), b = a + (minutes || 30); dates = d + 'T' + time.replace(':', '') + '00/' + ymd(b >= 1440 ? U.addDays(k, 1) : k) + 'T' + U.fromMin(b % 1440).replace(':', '') + '00'; }
    else dates = d + '/' + ymd(U.addDays(k, 1));
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + dates + (time ? '&ctz=' + encodeURIComponent(TZ) : '') + (details ? '&details=' + encodeURIComponent(details) : '') + (location ? '&location=' + encodeURIComponent(location) : '');
  };

  /* ---------------- the Settings page ---------------- */
  GC.settingsHtml = () => {
    const g = G();
    const why = GC.blocked();
    const inClaude = GC.via() === 'connector';
    const origin = ED.env.http ? location.origin : '';
    const statusLine = !g.on ? 'Not linked' : GC.state === 'syncing' ? 'Copying… ' + GC.done + ' of ' + GC.total : GC.state === 'expired' ? 'Linked' + (g.email ? ' as ' + e(g.email) : '') + ' — reconnect to continue' + (GC.pending ? ' (' + U.plural(GC.pending, 'change') + ' waiting)' : '') : GC.state === 'error' ? 'Problem: ' + e(GC.error) : 'Linked' + (inClaude ? ' through your Google Calendar connector' : g.email ? ' as <b>' + e(g.email) + '</b>' : '') + (GC.lastSync ? ' · up to date ' + e(U.fmtStamp(GC.lastSync)) : '');
    const count = Object.keys(D().gcal.map).length;
    const cals = GC.calendars || [];
    const calField = cals.length
      ? '<select id="gc-cal" class="field">' + cals.map(c => '<option value="' + e(c.primary ? 'primary' : c.id) + '"' + ((g.calendarId || 'primary') === (c.primary ? 'primary' : c.id) ? ' selected' : '') + '>' + e(c.name + (c.primary ? ' (main)' : '')) + '</option>').join('') + '</select>'
      : '<input id="gc-cal" class="field" value="' + e(g.calendarId || 'primary') + '" placeholder="primary">';
    const sw = (id, on, label, hint) => '<div class="set-row"><label class="switch" for="' + id + '"><input id="' + id + '" type="checkbox"' + (on ? ' checked' : '') + '><span class="track"></span><span>' + e(label) + '</span></label>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
    const waiting = inClaude && GC.mcpState === 'waiting';
    return '<h3 class="set-h">Google Calendar</h3>' +
      '<p class="hint">Link Google Calendar and the diary keeps a copy of your dated plans there — on your phone, with Google’s reminders. Dragging a task to a time or to “All day”, ticking it done, or deleting it updates Google within a few seconds. Changes made in Google are not copied back. Example entries are never copied.</p>' +
      (inClaude ? '<p class="hint">Here in Claude the diary writes through your <b>Google Calendar connector</b> (claude.ai Settings → Connectors) — no Client ID needed. Claude asks you once to allow it for this page.</p>' : '') +
      (why ? '<div class="notice">' + ED.icon('info') + '<span class="grow">' + e(why) + '</span></div>' : '') +
      '<div class="gc-status ' + (g.on ? GC.state : 'off') + '">' + ED.icon('calendar') + '<span class="grow">' + (waiting ? 'Checking Claude’s connectors…' : statusLine) + (count ? '<span class="hint"> · ' + count + ' items in Google</span>' : '') + '</span>' +
      (why || waiting ? '' : (inClaude ? '<button type="button" class="btn small" data-gc="check">Check connection</button>' : '') + (!g.on ? '<button type="button" class="btn primary small" data-gc="connect">Link Google Calendar</button>' : '<button type="button" class="btn small" data-gc="sync">' + (GC.connected() || inClaude ? 'Sync now' : 'Reconnect') + '</button>')) + '</div>' +
      (GC.state === 'error' && GC.error ? '<div class="notice err">' + ED.icon('info') + '<span class="grow">' + e(GC.error) + '</span></div>' : '') +
      '<div class="set-grid">' +
      (inClaude ? '' : '<div class="set-row"><label class="lbl" for="gc-id">OAuth Client ID</label><input id="gc-id" class="field" value="' + e(g.clientId || '') + '" placeholder="123456-abc.apps.googleusercontent.com" spellcheck="false" autocomplete="off"></div>') +
      '<div class="set-row"><label class="lbl" for="gc-cal">Calendar</label>' + calField + (GC.connected() && g.on && !cals.length ? '<button type="button" class="link-btn" data-gc="cals">Choose from my calendars</button>' : '') + '</div>' +
      '</div>' +
      (!inClaude && origin ? '<p class="hint">This diary is open at <code>' + e(origin) + '</code>. That exact address must be listed under <b>Authorized JavaScript origins</b> of your Client ID in Google Cloud Console — otherwise Google shows “Error 400: origin_mismatch”. It can take a few minutes to start working after you add it.</p>' : '') +
      '<h3 class="set-h">What to copy</h3>' +
      sw('gc-pick', !!g.pick, 'Only the items I choose', 'Nothing goes to Google Calendar by itself: open a task, event or study session and click “Add to Google Calendar” (or use a task’s ⋯ menu). Turning this on takes the automatic copies out of Google; the ones you chose stay.') +
      (g.pick ? '' : '') +
      (g.pick ? '<div class="gc-auto-off">' : '<div>') + sw('gc-tasks', g.tasks, 'Tasks that have a time or are all-day', 'Drag a task onto the timeline or the “All day” strip and it goes to Google. Tasks only in the list (no time) stay in the diary.') +
      sw('gc-untimed', g.untimed, 'Also tasks without a time (as all-day)', '') +
      sw('gc-events', g.events, 'Diary events', '') +
      sw('gc-holidays', g.holidays, 'Holidays added from the holiday list', 'Google Calendar has its own holiday calendars, so this is off unless you want them twice.') +
      sw('gc-study', g.study, 'Study sessions that have a start time', 'Give the slots a time in Study → Plan → Plan settings.') +
      '</div>' +
      sw('gc-auto', g.auto !== false, 'Send a task to Google Calendar as soon as I drop it on a time or on “All day events”', inClaude ? 'Works through your Google Calendar connector, even before you link everything above.' : 'Needs the Client ID below; the first drag asks Google to sign you in.') +
      sw('gc-offer', g.offer !== false, 'Otherwise, offer “Add to Google Calendar” after a drag', '') +
      (g.on ? '<div class="row-btns"><button type="button" class="btn small" data-gc="dupes">' + ED.icon('copy') + 'Remove duplicates from Google Calendar</button></div><p class="hint">The diary never adds the same item twice: before adding, it looks for the same item (or the same title at the same time) already in Google. Copies made before this check, or by other copies of the diary, are removed with the button above.</p>' : '') +
      (g.on ? '<div class="row-btns"><button type="button" class="btn small" data-gc="off">Unlink</button><button type="button" class="btn small danger" data-gc="offdel">Unlink and remove the copies from Google</button></div>' : '') +
      (inClaude ? '' : '<details class="gc-help"' + (g.clientId ? '' : ' open') + '><summary>How to get a Client ID (once, about 5 minutes)</summary><ol>' +
      '<li>Open <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">console.cloud.google.com</a> with your Google account and create a project (for example “E-Diary”).</li>' +
      '<li><b>APIs &amp; Services → Library</b>: search <b>Google Calendar API</b> and click <b>Enable</b>.</li>' +
      '<li><b>Google Auth Platform → Branding</b> (older consoles: <i>OAuth consent screen</i>): click <b>Get started</b>, give the app a name and your e-mail, choose <b>External</b>, and finish.</li>' +
      '<li><b>Audience → Test users → Add users</b>: add your own Gmail address.</li>' +
      '<li><b>Clients → Create client</b>: type <b>Web application</b>. Under <b>Authorized JavaScript origins</b> add the address you open the diary from' + (origin ? ' — this one is <code>' + e(origin) + '</code>' : ' — for example <code>http://localhost:8080</code> and <code>https://YOUR-NAME.github.io</code>') + '. Click <b>Create</b>.</li>' +
      '<li>Copy the <b>Client ID</b> into the box above and click <b>Link Google Calendar</b>. Google will say the app is unverified because you made it yourself — choose <b>Continue</b>.</li>' +
      '</ol><p class="hint">The Client ID is not a secret. Your Google password never touches the diary; Google shows its own sign-in window.</p></details>');
  };
  GC.bindSettings = b => {
    const g = G();
    const on = (sel, ev, fn) => { const x = b.querySelector(sel); if (x) x.addEventListener(ev, fn); };
    on('#gc-id', 'change', ev => { g.clientId = ev.target.value.trim(); ED.store.commit(); });
    on('#gc-cal', 'change', ev => { g.calendarId = ev.target.value.trim() || 'primary'; ED.store.commit(); });
    [['#gc-pick', 'pick'], ['#gc-tasks', 'tasks'], ['#gc-untimed', 'untimed'], ['#gc-events', 'events'], ['#gc-holidays', 'holidays'], ['#gc-study', 'study'], ['#gc-offer', 'offer'], ['#gc-auto', 'auto']].forEach(x => on(x[0], 'change', ev => { g[x[1]] = ev.target.checked; ED.store.commit(); if (x[1] === 'pick') { if (g.on) GC.sync(true); ED.settings.refresh(); } }));
    b.addEventListener('click', async ev => {
      const x = ev.target.closest('[data-gc]'); if (!x) return;
      const idf = b.querySelector('#gc-id'); if (idf && idf.value.trim() !== g.clientId) { g.clientId = idf.value.trim(); ED.store.commit(); }
      const k = x.dataset.gc;
      if (k === 'connect') { if (await GC.connect('consent')) { await GC.calendarsList().catch(() => null); ED.settings.refresh(); } }
      else if (k === 'sync') { GC.cxCode = ''; GC.sync(true); }
      else if (k === 'dupes') {
        if (GC.via() === 'api' && !GC.connected()) { if (!(await GC.connect())) return; }
        const busy = ED.ui.busy('Looking for duplicates in Google Calendar…');
        try { const n = await GC.removeDuplicates(); ED.ui.toast(n ? 'Removed ' + U.plural(n, 'duplicate') + ' from Google Calendar' : 'No duplicates found'); }
        catch (err) { ED.ui.toast('Could not clean up: ' + (err.cx ? cxExplain(err).text : err.message), { kind: 'err' }); }
        finally { busy.close(); }
      }
      else if (k === 'check') GC.check();
      else if (k === 'cals') { try { await GC.calendarsList(); ED.settings.refresh(); } catch (err) { ED.ui.toast(err.cx ? cxExplain(err).text : err.message); } }
      else if (k === 'off') GC.disconnect(false);
      else if (k === 'offdel') { const ok = await ED.ui.confirm({ title: 'Remove from Google Calendar', message: 'Delete the ' + Object.keys(D().gcal.map).length + ' events this diary put into Google Calendar and unlink? Nothing in the diary is deleted.', ok: 'Remove and unlink', danger: true }); if (ok) GC.disconnect(true); }
    });
  };
})();
