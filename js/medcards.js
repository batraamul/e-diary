/* E-Diary — 1.22: medical cards (Health → Medical cards).
   Any number of cards — health insurance, CGHS, Ayushman Bharat / PM-JAY, ABHA health ID, a hospital card, an employer
   or a family floater policy — each with the person it is for, the number, the insurer or hospital, the helpline,
   the validity, and photos of the front and back. Cards near their end date are flagged (and show on the Health page).
   Shown under the emergency card on the Medical cards tab.
   Data: ED.store.data.health.cards = [ { id, kind, name, holder, number, issuer, phone, validFrom, validTo, sum, members,
          tpa, notes, pics: [front, back], updatedAt } ] */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const FX = () => ED.fx;
  const A = (ED.actions = ED.actions || {});
  const MC = (ED.medCards = {});
  const KINDS = [['insurance', 'Health insurance', '🛡️', '#2563eb'], ['cghs', 'CGHS card', '🏛️', '#0d9488'], ['pmjay', 'Ayushman Bharat / PM-JAY', '🇮🇳', '#ea580c'], ['abha', 'ABHA health ID', '🆔', '#7c3aed'],
    ['hospital', 'Hospital / clinic card', '🏥', '#db2777'], ['employer', 'Employer / ECHS / ESIC', '💼', '#ca8a04'], ['other', 'Other card', '💳', '#64748b']];
  MC.KINDS = KINDS;
  const kind = id => KINDS.find(k => k[0] === id) || KINDS[KINDS.length - 1];
  const H = () => { const d = ED.store.data; if (!d.health || typeof d.health !== 'object') d.health = {}; if (!Array.isArray(d.health.cards)) d.health.cards = []; return d.health; };
  MC.list = () => H().cards.slice().sort((a, b) => String(a.holder || '').localeCompare(String(b.holder || '')) || kind(a.kind)[1].localeCompare(kind(b.kind)[1]));
  const left = c => c.validTo ? U.diffDays(U.today(), c.validTo) : null;
  MC.expiring = () => H().cards.filter(c => { const d = left(c); return d != null && d <= 30; });
  const mask = n => { const s = String(n || ''); return s.length > 6 ? s.slice(0, 2) + '•'.repeat(Math.max(2, s.length - 6)) + s.slice(-4) : s; };

  MC.html = () => {
    const l = MC.list(), st = ED.state.mc2 || (ED.state.mc2 = { show: {} });
    const cards = l.map(c => {
      const k = kind(c.kind), d = left(c), pics = (c.pics || []).filter(Boolean);
      const val = d == null ? '' : d < 0 ? '<span class="hc-v bad">expired ' + e(U.fmtShort(c.validTo)) + '</span>' : d <= 30 ? '<span class="hc-v warn">renew — ends in ' + U.plural(d, 'day') + '</span>' : '<span class="hc-v ok">valid till ' + e(U.fmtShort(c.validTo)) + '</span>';
      const shown = !!st.show[c.id];
      return '<article class="hc-card" style="--c:' + k[3] + '"><div class="hc-face">' +
        '<div class="hc-top"><span class="hc-k">' + k[2] + ' ' + e(k[1]) + '</span>' + val + '</div>' +
        '<b class="hc-name">' + e(c.name || k[1]) + '</b>' +
        (c.number ? '<button type="button" class="hc-num num" data-act="mc-show" data-id="' + e(c.id) + '" title="' + (shown ? 'Hide' : 'Show') + ' the number">' + e(shown ? c.number : mask(c.number)) + '</button>' : '') +
        '<div class="hc-row"><span><i>For</i>' + e(c.holder || '—') + '</span>' + (c.issuer ? '<span><i>' + (c.kind === 'hospital' ? 'Hospital' : 'Insurer / issued by') + '</i>' + e(c.issuer) + '</span>' : '') + '</div>' +
        (pics.length ? '<div class="hc-pics">' + pics.map((p, i) => '<button type="button" class="hc-pic" data-act="mc-pic" data-id="' + e(c.id) + '" data-i="' + i + '" aria-label="See the ' + (i ? 'back' : 'front') + ' of the card"><img src="' + e(p) + '" alt="' + (i ? 'Back' : 'Front') + ' of ' + e(c.name || k[1]) + '"><span>' + (i ? 'Back' : 'Front') + '</span></button>').join('') + '</div>' : '') +
        '</div><dl class="hc-dl">' + [['Helpline', c.phone ? '<a href="tel:' + e(String(c.phone).replace(/[^\d+]/g, '')) + '">' + e(c.phone) + '</a>' : ''], ['Cover', c.sum ? '₹' + e(Number(c.sum).toLocaleString('en-IN')) : ''], ['Members', e(c.members || '')], ['TPA', e(c.tpa || '')], ['Valid', c.validFrom || c.validTo ? e([c.validFrom ? U.fmtShort(c.validFrom) : '', c.validTo ? U.fmtShort(c.validTo) : ''].filter(Boolean).join(' → ')) : ''], ['Notes', e(c.notes || '').replace(/\n/g, '<br>')]]
          .filter(x => x[1]).map(x => '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>').join('') + '</dl>' +
        '<div class="hc-acts"><button type="button" class="btn small ghost" data-act="mc-edit" data-id="' + e(c.id) + '">' + ED.icon('pencil') + 'Edit</button><button type="button" class="btn small ghost" data-act="mc-copy" data-id="' + e(c.id) + '">' + ED.icon('copy') + 'Copy</button></div></article>';
    }).join('');
    const exp = MC.expiring();
    return '<h3 class="gh fin-gap hc-h">My medical cards <span class="hint">· insurance, CGHS, ABHA, hospital cards</span><button type="button" class="btn small primary" data-act="mc-edit">' + ED.icon('plus') + 'Add a card</button></h3>' +
      (exp.length ? '<div class="notice warn">' + ED.icon('info') + '<span class="grow">' + e(exp.map(c => (c.name || kind(c.kind)[1]) + (left(c) < 0 ? ' has expired' : ' ends in ' + U.plural(left(c), 'day'))).join(' · ')) + '.</span></div>' : '') +
      (cards ? '<div class="hc-grid">' + cards + '</div>' : '<p class="hint hc-empty">Keep every family member’s cards here with photos of both sides — handy at the hospital desk. Numbers are hidden until you click them.</p>');
  };

  MC.edit = id => {
    const x = id ? H().cards.find(c => c.id === id) : null; let pe = null;
    FX().form({
      title: x ? 'Medical card' : 'Add a medical card', wide: true,
      data: x || { kind: 'insurance', holder: (ED.store.data.settings.ownerName || '') },
      fields: [{ k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(k => [k[0], k[2] + ' ' + k[1]]) }, { k: 'name', label: 'Card / policy name', ph: 'e.g. Star Family Health Optima, CGHS Delhi, ABHA' },
        { k: 'holder', label: 'For (whose card)', ph: 'Name of the person', list: [ED.store.data.settings.ownerName].filter(Boolean) }, { k: 'number', label: 'Card / policy / ID number' },
        { k: 'issuer', label: 'Insurer, issuer or hospital' }, { k: 'phone', label: 'Helpline / cashless desk', ph: '1800…' },
        { k: 'validFrom', label: 'Valid from', type: 'date' }, { k: 'validTo', label: 'Valid till', type: 'date', hint: 'Flagged 30 days before it ends.' },
        { k: 'sum', label: 'Cover (₹)', type: 'number', min: 0 }, { k: 'members', label: 'Members covered' }, { k: 'tpa', label: 'TPA (if any)' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, ph: 'Network hospitals, documents to carry, claim steps…' }, { k: 'pics', label: 'Photos of the card', type: 'head' }],
      mount(el) { const h = document.createElement('div'); h.className = 'pi-host'; el.querySelector('.st-form').appendChild(h); pe = ED.pics.editor(h, x ? x.pics : [], { slots: ['Front', 'Back'] }); },
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Delete card', message: 'Delete “' + (x.name || kind(x.kind)[1]) + '” and its photos?', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Delete card'); H().cards = H().cards.filter(c => c !== x); ED.store.commit(); ED.ui.undoToast('Card deleted'); } : null,
      save(v, api) {
        ED.store.checkpoint(x ? 'Medical card' : 'New medical card');
        const o = Object.assign({}, v, { pics: pe ? pe.get() : (x ? x.pics : []), updatedAt: Date.now() }); delete o.pics_;
        if (x) Object.assign(x, o); else H().cards.push(Object.assign({ id: U.uid('mc'), createdAt: Date.now() }, o));
        ED.store.commit(); api.close();
      },
    });
  };
  A['mc-edit'] = el => MC.edit(el && el.dataset && el.dataset.id);
  A['mc-show'] = el => { const s = ED.state.mc2 || (ED.state.mc2 = { show: {} }); s.show[el.dataset.id] = !s.show[el.dataset.id]; ED.app.renderPage('right'); };
  A['mc-pic'] = el => { const c = H().cards.find(x => x.id === el.dataset.id); if (c) ED.pics.view((c.pics || []).filter(Boolean), +el.dataset.i, c.name || kind(c.kind)[1]); };
  A['mc-copy'] = async el => {
    const c = H().cards.find(x => x.id === el.dataset.id); if (!c) return;
    const t = [c.name || kind(c.kind)[1], kind(c.kind)[1], c.holder ? 'For: ' + c.holder : '', c.number ? 'No.: ' + c.number : '', c.issuer ? 'Issued by: ' + c.issuer : '', c.phone ? 'Helpline: ' + c.phone : '', c.validTo ? 'Valid till: ' + U.fmtShort(c.validTo) : ''].filter(Boolean).join('\n');
    ED.ui.toast(await U.copy(t) ? 'Card details copied' : 'Could not copy');
  };
})();
