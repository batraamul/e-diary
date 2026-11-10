/* E-Diary — 1.23: Pooja & Vrat → Aartis & Mantras.
   Write your aartis, mantras, chalisas, stotras and bhajans — in Hindi (Devanagari), in English letters
   (transliteration) and their meaning — and read them in a large, calm reading view that suits a phone held in the
   hand during pooja as well as a computer screen:
     • Hindi, English, Both (verse by verse — side by side on a wide screen, one under the other on a phone) or Meaning;
     • text size A− / A+ and the theme (light, sepia, dark) remembered on each device;
     • the screen kept awake while reading (where the browser allows it);
     • for a mantra, a jaap counter (tap, or press Space) with malas of 108, kept for the day.
   A few well-known texts can be added to start with (edit them to match your own book — versions differ a little).
   Data: ED.store.data.pooja.texts = [ { id, title, titleHi, kind, deity, hi, en, meaning, notes, link, when, fav,
          updatedAt } ];  pooja.japa = { 'YYYY-MM-DD': { <textId>: count } } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  const A = (ED.actions = ED.actions || {}), CH = (ED.changes = ED.changes || {});
  const FX = () => ED.fx;
  const AR = (ED.aarti = {});
  const KINDS = [['aarti', 'Aarti', '🪔'], ['mantra', 'Mantra', '🕉️'], ['chalisa', 'Chalisa', '📿'], ['stotra', 'Stotra / Stuti', '🙏'], ['bhajan', 'Bhajan', '🎵'], ['shloka', 'Shloka', '📜'], ['other', 'Other', '✨']];
  const DEITIES = ['Ganesh', 'Shiv', 'Vishnu', 'Krishna', 'Ram', 'Hanuman', 'Durga', 'Lakshmi', 'Saraswati', 'Surya', 'Shani', 'Guru', 'Sai Baba', 'General'];
  AR.KINDS = KINDS;
  const kind = id => KINDS.find(k => k[0] === id) || KINDS[KINDS.length - 1];
  const PD = () => { const d = ED.store.data; if (!d.pooja || typeof d.pooja !== 'object') d.pooja = {}; const p = d.pooja; if (!Array.isArray(p.texts)) p.texts = []; if (!p.japa || typeof p.japa !== 'object') p.japa = {}; return p; };
  const st = () => ED.state.ar || (ED.state.ar = { q: '', kind: 'all' });
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('e-diary-aarti-' + k); localStorage.setItem('e-diary-aarti-' + k, String(v)); } catch (err) { /* ignore */ } return null; };
  const verses = s => String(s || '').replace(/\r/g, '').split(/\n\s*\n/).map(x => x.replace(/^\n+|\n+$/g, '')).filter(x => x.trim());
  const first = s => String(s || '').split('\n').map(x => x.trim()).find(Boolean) || '';

  /* ---------------- starter texts (well known; versions differ a little — edit to match your own) ---------------- */
  const STARTERS = [
    { title: 'Gayatri Mantra', titleHi: 'गायत्री मंत्र', kind: 'mantra', deity: 'Surya', when: 'Morning and evening · 108 times',
      hi: 'ॐ भूर्भुवः स्वः ।\nतत्सवितुर्वरेण्यं ।\nभर्गो देवस्य धीमहि ।\nधियो यो नः प्रचोदयात् ॥',
      en: 'Om Bhur Bhuvah Svah\nTat Savitur Varenyam\nBhargo Devasya Dhimahi\nDhiyo Yo Nah Prachodayat',
      meaning: 'We meditate on the glorious light of the divine Sun (Savitr), most worthy of worship. May it awaken and guide our minds.' },
    { title: 'Mahamrityunjaya Mantra', titleHi: 'महामृत्युंजय मंत्र', kind: 'mantra', deity: 'Shiv', when: 'Mondays, and for health · 108 times',
      hi: 'ॐ त्र्यम्बकं यजामहे\nसुगन्धिं पुष्टिवर्धनम् ।\nउर्वारुकमिव बन्धनान्\nमृत्योर्मुक्षीय माऽमृतात् ॥',
      en: 'Om Tryambakam Yajamahe\nSugandhim Pushtivardhanam\nUrvarukamiva Bandhanan\nMrityor Mukshiya Maamritat',
      meaning: 'We worship the three-eyed One (Shiva), fragrant, who nourishes all beings. As a ripe cucumber is freed from its vine, may He free us from death — and not from immortality.' },
    { title: 'Om Namah Shivaya', titleHi: 'ॐ नमः शिवाय', kind: 'mantra', deity: 'Shiv', when: 'Jaap · 108 times',
      hi: 'ॐ नमः शिवाय', en: 'Om Namah Shivaya', meaning: 'I bow to Shiva — the auspicious one, the inner Self.' },
    { title: 'Vakratunda Mahakaya', titleHi: 'वक्रतुण्ड महाकाय', kind: 'shloka', deity: 'Ganesh', when: 'Before starting any work',
      hi: 'वक्रतुण्ड महाकाय\nसूर्यकोटि समप्रभ ।\nनिर्विघ्नं कुरु मे देव\nसर्वकार्येषु सर्वदा ॥',
      en: 'Vakratunda Mahakaya\nSuryakoti Samaprabha\nNirvighnam Kuru Me Deva\nSarvakaryeshu Sarvada',
      meaning: 'O Lord with the curved trunk and the mighty body, shining like a crore suns — remove the obstacles from all my work, always.' },
    { title: 'Guru Mantra', titleHi: 'गुरु मंत्र', kind: 'shloka', deity: 'Guru', when: 'Before study',
      hi: 'गुरुर्ब्रह्मा गुरुर्विष्णुः\nगुरुर्देवो महेश्वरः ।\nगुरुः साक्षात् परब्रह्म\nतस्मै श्री गुरवे नमः ॥',
      en: 'Gurur Brahma Gurur Vishnuh\nGurur Devo Maheshvarah\nGuruh Sakshat Parabrahma\nTasmai Shri Gurave Namah',
      meaning: 'The Guru is Brahma, the Guru is Vishnu, the Guru is Shiva; the Guru is the supreme Brahman itself. Salutations to that revered Guru.' },
    { title: 'Shanti Mantra — Sarve Bhavantu Sukhinah', titleHi: 'सर्वे भवन्तु सुखिनः', kind: 'mantra', deity: 'General', when: 'At the end of pooja',
      hi: 'ॐ सर्वे भवन्तु सुखिनः ।\nसर्वे सन्तु निरामयाः ।\nसर्वे भद्राणि पश्यन्तु ।\nमा कश्चिद् दुःखभाग्भवेत् ॥\nॐ शान्तिः शान्तिः शान्तिः ॥',
      en: 'Om Sarve Bhavantu Sukhinah\nSarve Santu Niramayah\nSarve Bhadrani Pashyantu\nMa Kashchid Duhkha Bhag Bhavet\nOm Shantih Shantih Shantih',
      meaning: 'May all be happy. May all be free from illness. May all see what is good. May no one suffer. Om peace, peace, peace.' },
    { title: 'Om Jai Jagdish Hare', titleHi: 'ॐ जय जगदीश हरे', kind: 'aarti', deity: 'Vishnu', when: 'Evening aarti',
      notes: 'Written by Pt. Shardha Ram Phillauri (19th century). Families sing it with small differences — edit the lines to match yours.',
      hi: 'ॐ जय जगदीश हरे, स्वामी जय जगदीश हरे ।\nभक्त जनों के संकट, दास जनों के संकट,\nक्षण में दूर करे ॥ ॐ जय जगदीश हरे ॥\n\n' +
        'जो ध्यावे फल पावे, दुःख बिनसे मन का, स्वामी दुःख बिनसे मन का ।\nसुख सम्पत्ति घर आवे, सुख सम्पत्ति घर आवे,\nकष्ट मिटे तन का ॥ ॐ जय जगदीश हरे ॥\n\n' +
        'मात पिता तुम मेरे, शरण गहूँ किसकी, स्वामी शरण गहूँ मैं किसकी ।\nतुम बिन और न दूजा, तुम बिन और न दूजा,\nआस करूँ मैं जिसकी ॥ ॐ जय जगदीश हरे ॥\n\n' +
        'तुम पूरण परमात्मा, तुम अन्तर्यामी, स्वामी तुम अन्तर्यामी ।\nपारब्रह्म परमेश्वर, पारब्रह्म परमेश्वर,\nतुम सब के स्वामी ॥ ॐ जय जगदीश हरे ॥\n\n' +
        'तुम करुणा के सागर, तुम पालनकर्ता, स्वामी तुम पालनकर्ता ।\nमैं मूरख फलकामी, मैं सेवक तुम स्वामी,\nकृपा करो भर्ता ॥ ॐ जय जगदीश हरे ॥\n\n' +
        'तुम हो एक अगोचर, सबके प्राणपति, स्वामी सबके प्राणपति ।\nकिस विधि मिलूँ दयामय, किस विधि मिलूँ दयामय,\nतुमको मैं कुमति ॥ ॐ जय जगदीश हरे ॥\n\n' +
        'दीन-बन्धु दुःख-हर्ता, ठाकुर तुम मेरे, स्वामी रक्षक तुम मेरे ।\nअपने हाथ उठाओ, अपने शरण लगाओ,\nद्वार पड़ा तेरे ॥ ॐ जय जगदीश हरे ॥\n\n' +
        'विषय-विकार मिटाओ, पाप हरो देवा, स्वामी पाप हरो देवा ।\nश्रद्धा भक्ति बढ़ाओ, श्रद्धा भक्ति बढ़ाओ,\nसन्तन की सेवा ॥ ॐ जय जगदीश हरे ॥',
      en: 'Om Jai Jagdish Hare, Swami Jai Jagdish Hare\nBhakt Janon Ke Sankat, Daas Janon Ke Sankat,\nKshan Mein Door Kare. Om Jai Jagdish Hare\n\n' +
        'Jo Dhyave Phal Pave, Dukh Binse Man Ka, Swami Dukh Binse Man Ka\nSukh Sampatti Ghar Aave, Sukh Sampatti Ghar Aave,\nKasht Mite Tan Ka. Om Jai Jagdish Hare\n\n' +
        'Maat Pita Tum Mere, Sharan Gahoon Kiski, Swami Sharan Gahoon Main Kiski\nTum Bin Aur Na Dooja, Tum Bin Aur Na Dooja,\nAas Karoon Main Jiski. Om Jai Jagdish Hare\n\n' +
        'Tum Pooran Paramatma, Tum Antaryami, Swami Tum Antaryami\nParabrahm Parameshwar, Parabrahm Parameshwar,\nTum Sab Ke Swami. Om Jai Jagdish Hare\n\n' +
        'Tum Karuna Ke Sagar, Tum Palankarta, Swami Tum Palankarta\nMain Moorakh Phalkami, Main Sevak Tum Swami,\nKripa Karo Bharta. Om Jai Jagdish Hare\n\n' +
        'Tum Ho Ek Agochar, Sabke Pranpati, Swami Sabke Pranpati\nKis Vidhi Miloon Dayamay, Kis Vidhi Miloon Dayamay,\nTumko Main Kumati. Om Jai Jagdish Hare\n\n' +
        'Deen-Bandhu Dukh-Harta, Thakur Tum Mere, Swami Rakshak Tum Mere\nApne Haath Uthao, Apni Sharan Lagao,\nDwaar Pada Tere. Om Jai Jagdish Hare\n\n' +
        'Vishay-Vikaar Mitao, Paap Haro Deva, Swami Paap Haro Deva\nShraddha Bhakti Badhao, Shraddha Bhakti Badhao,\nSantan Ki Seva. Om Jai Jagdish Hare',
      meaning: 'Victory to You, Lord of the universe, who removes in a moment the troubles of Your devotees. Whoever meditates on You is rewarded: the sorrow of the mind goes, happiness and plenty come home and the body’s pain ends. You are my mother and father — whose shelter could I seek but Yours? You are the perfect Supreme Self, who knows every heart, the master of all. Ocean of compassion and protector — I am foolish and want rewards; I am Your servant, be kind to me. You are the One beyond the senses, the life of all — how may I, of little understanding, reach You? Friend of the humble, remover of sorrow, my protector — lift Your hand and take me in; I lie at Your door. Wipe away my cravings and faults, take away my sins; increase my faith and devotion and my service to the saintly.' },
  ];
  AR.STARTERS = STARTERS;

  /* ---------------- the tab on the Pooja page ---------------- */
  AR.html = () => {
    const l = PD().texts, s = st(), q = s.q.trim().toLowerCase();
    const list = l.filter(x => (s.kind === 'all' || (s.kind === 'fav' ? x.fav : x.kind === s.kind)) && (!q || [x.title, x.titleHi, x.deity, x.hi, x.en].join(' ').toLowerCase().indexOf(q) >= 0))
      .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || String(a.deity || '').localeCompare(String(b.deity || '')) || String(a.title).localeCompare(String(b.title)));
    const used = KINDS.filter(k => l.some(x => x.kind === k[0]));
    const today = U.today(), jp = PD().japa[today] || {};
    const tools = '<div class="ar-tools"><button type="button" class="btn small primary" data-act="ar-edit">' + ED.icon('plus') + 'Write an aarti or mantra</button>' +
      (STARTERS.some(x => !l.some(y => y.title === x.title)) ? '<button type="button" class="btn small" data-act="ar-starters">' + ED.icon('sparkle') + 'Add well-known ones</button>' : '') + '</div>' +
      (l.length ? '<div class="ar-filt"><input class="field ar-q" type="search" placeholder="Search — name, deity or a word" value="' + e(s.q) + '" data-change="ar-q" aria-label="Search">' +
        '<div class="seg ar-seg" role="group" aria-label="Show">' + [['all', 'All'], ['fav', '★ Favourites']].concat(used.map(k => [k[0], k[2] + ' ' + k[1]])).map(x => '<button type="button" data-act="ar-kind" data-k="' + x[0] + '" aria-pressed="' + (s.kind === x[0]) + '">' + e(x[1]) + '</button>').join('') + '</div></div>' : '');
    const cards = list.map(x => {
      const k = kind(x.kind);
      return '<article class="ar-card k-' + e(x.kind || 'other') + '"><button type="button" class="ar-open" data-act="ar-read" data-id="' + e(x.id) + '" aria-label="Read ' + e(x.title) + '">' +
        '<span class="ar-ic" aria-hidden="true">' + k[2] + '</span><span class="ar-ct">' + (x.titleHi ? '<b class="ar-thi" lang="hi">' + e(x.titleHi) + '</b>' : '') + '<b class="ar-ten">' + e(x.title) + '</b>' +
        '<span class="hint">' + e([k[1], x.deity, x.when].filter(Boolean).join(' · ')) + (jp[x.id] ? ' · 📿 ' + jp[x.id] + ' today' : '') + '</span>' +
        (x.hi || x.en ? '<span class="ar-peek"' + (x.hi ? ' lang="hi"' : '') + '>' + e(first(x.hi || x.en)) + '</span>' : '') + '</span></button>' +
        '<div class="ar-acts"><button type="button" class="icon-btn sm ar-fav' + (x.fav ? ' on' : '') + '" data-act="ar-fav" data-id="' + e(x.id) + '" aria-pressed="' + !!x.fav + '" aria-label="Favourite" title="Favourite">' + (x.fav ? '★' : '☆') + '</button>' +
        '<button type="button" class="icon-btn sm" data-act="ar-edit" data-id="' + e(x.id) + '" aria-label="Edit ' + e(x.title) + '" title="Edit">' + ED.icon('pencil') + '</button></div></article>';
    }).join('');
    return tools + (cards ? '<div class="ar-list">' + cards + '</div>' : l.length ? '<p class="hint">Nothing matches.</p>' :
      '<div class="ar-empty"><span aria-hidden="true">🪔</span><b>Your aartis and mantras, always at hand</b><p class="hint">Write them in Hindi and in English letters, with the meaning if you like — then open one to read it large during pooja, on the phone or the computer. Start with a few well-known ones, or write your own.</p></div>');
  };

  /* ---------------- the reading view ---------------- */
  let wake = null;
  const keepAwake = async on => { try { if (on && 'wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); else if (wake) { await wake.release(); wake = null; } } catch (err) { wake = null; } };
  AR.read = id => {
    const x = PD().texts.find(t => t.id === id); if (!x) return;
    const hasHi = !!String(x.hi || '').trim(), hasEn = !!String(x.en || '').trim(), hasM = !!String(x.meaning || '').trim();
    const hasFull = hasHi && hasM && verses(x.meaning).length > 1;   // a meaning written verse by verse (blank line between), lined up with the Hindi verses
    let mode = pref('mode') || 'both'; if (mode === 'full' && !hasFull) mode = 'both'; if (mode === 'both' && !(hasHi && hasEn)) mode = hasHi ? 'hi' : 'en'; if (mode === 'hi' && !hasHi) mode = 'en'; if (mode === 'en' && !hasEn) mode = 'hi';
    let size = +pref('size') || 22, theme = pref('theme') || 'light';
    const isMantra = x.kind === 'mantra'; let keyH = null;
    const modes = [['hi', 'हिन्दी', hasHi], ['en', 'English', hasEn], ['both', 'Both', hasHi && hasEn], ['full', 'अर्थ सहित', hasFull], ['meaning', 'Meaning', hasM]].filter(m => m[2]);
    const draw = () => {
      const H = verses(x.hi), E = verses(x.en), n = Math.max(H.length, E.length);
      if (mode === 'full') { const M = verses(x.meaning); let o = ''; for (let i = 0; i < Math.max(H.length, M.length); i++) o += '<div class="ar-pair ar-full">' + (H[i] ? '<p class="ar-hi" lang="hi">' + e(H[i]) + '</p>' : '') + (E[i] ? '<p class="ar-en" lang="en">' + e(E[i]) + '</p>' : '') + (M[i] ? '<div class="ar-m">' + M[i].split('\n').map(l => '<p' + (/[\u0900-\u097F]/.test(l) ? ' lang="hi"' : ' lang="en"') + '>' + e(l) + '</p>').join('') + '</div>' : '') + '</div>'; return o; }
      if (mode === 'meaning') return '<div class="ar-meaning">' + e(x.meaning).replace(/\n/g, '<br>') + '</div>';
      if (mode === 'both') { let o = ''; for (let i = 0; i < n; i++) o += '<div class="ar-pair"><p class="ar-hi" lang="hi">' + e(H[i] || '') + '</p><p class="ar-en" lang="en">' + e(E[i] || '') + '</p></div>'; return o; }
      return (mode === 'hi' ? H : E).map(v => '<p class="ar-' + mode + '" lang="' + mode + '">' + e(v) + '</p>').join('');
    };
    const k = U.today(), J = () => (PD().japa[k] || {})[x.id] || 0;
    const counter = isMantra ? '<div class="ar-japa"><button type="button" class="ar-jb" data-ar="jp" aria-label="Count one (Space)"><b class="num" id="ar-jn">' + (J() % 108) + '</b><small>of 108</small></button><span class="hint" id="ar-jm">' + Math.floor(J() / 108) + ' mala' + (Math.floor(J() / 108) === 1 ? '' : 's') + ' today · ' + J() + ' in all</span><button type="button" class="btn small ghost" data-ar="jr">Reset today</button></div>' : '';
    ED.ui.modal({
      title: x.title, cls: 'ar-modal',
      body: '<div class="ar-reader t-' + theme + '" style="--ar-fs:' + size + 'px">' +
        '<div class="ar-bar"><div class="seg ar-mode" role="group" aria-label="Language">' + modes.map(m => '<button type="button" data-m="' + m[0] + '" aria-pressed="' + (m[0] === mode) + '"' + (m[0] === 'hi' ? ' lang="hi"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
        '<div class="ar-size" role="group" aria-label="Text size"><button type="button" class="icon-btn" data-ar="-" aria-label="Smaller text">A−</button><button type="button" class="icon-btn" data-ar="+" aria-label="Larger text">A+</button></div>' +
        '<div class="seg ar-theme" role="group" aria-label="Background">' + [['light', '☀️'], ['sepia', '📜'], ['dark', '🌙']].map(t => '<button type="button" data-t="' + t[0] + '" aria-pressed="' + (t[0] === theme) + '" title="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
        '<label class="switch ar-wake"><input type="checkbox" id="ar-wake"><span class="track"></span><span>Keep the screen on</span></label></div>' +
        '<header class="ar-head">' + (x.titleHi ? '<h2 lang="hi">' + e(x.titleHi) + '</h2>' : '') + '<p>' + e([x.title !== x.titleHi ? x.title : '', x.deity, x.when].filter(Boolean).join(' · ')) + '</p></header>' +
        counter + '<div class="ar-text" id="ar-text">' + draw() + '</div>' +
        (x.notes ? '<p class="ar-notes">' + e(x.notes) + '</p>' : '') + (x.link ? '<p class="ar-notes"><a href="' + e(x.link) + '" target="_blank" rel="noopener noreferrer">' + ED.icon('external') + ' Listen / watch</a></p>' : '') + '</div>',
      onClose() { keepAwake(false); if (keyH) document.removeEventListener('keydown', keyH, true); keyH = null; },
      onMount(el) {
        const R = el.querySelector('.ar-reader'), T = el.querySelector('#ar-text');
        const redraw = () => { T.innerHTML = draw(); };
        el.addEventListener('click', ev => {
          const m = ev.target.closest('[data-m]'), t = ev.target.closest('[data-t]'), b = ev.target.closest('[data-ar]');
          if (m) { mode = m.dataset.m; pref('mode', mode); U.$$('[data-m]', el).forEach(z => z.setAttribute('aria-pressed', String(z === m))); redraw(); }
          if (t) { theme = t.dataset.t; pref('theme', theme); R.className = 'ar-reader t-' + theme; U.$$('[data-t]', el).forEach(z => z.setAttribute('aria-pressed', String(z === t))); }
          if (b && (b.dataset.ar === '+' || b.dataset.ar === '-')) { size = Math.max(14, Math.min(48, size + (b.dataset.ar === '+' ? 2 : -2))); pref('size', size); R.style.setProperty('--ar-fs', size + 'px'); }
          if (b && b.dataset.ar === 'jp') count(1);
          if (b && b.dataset.ar === 'jr') { const j = PD().japa[k]; if (j) delete j[x.id]; ED.store.commit({ silent: true }); count(0); }
        });
        const count = d => {
          const j = PD().japa[k] = PD().japa[k] || {}; if (d) j[x.id] = (j[x.id] || 0) + d;
          const n = j[x.id] || 0, jn = el.querySelector('#ar-jn'), jm = el.querySelector('#ar-jm');
          if (jn) { jn.textContent = n % 108; jm.textContent = Math.floor(n / 108) + ' mala' + (Math.floor(n / 108) === 1 ? '' : 's') + ' today · ' + n + ' in all'; }
          if (d && n % 108 === 0) { ED.ui.toast('📿 A mala of 108 complete'); try { if (navigator.vibrate) navigator.vibrate(120); } catch (err) { /* ignore */ } }
          if (d) ED.store.commit({ silent: true });
        };
        // Space / Enter counts wherever the focus is while the reader is open (not while typing)
        keyH = ev => { if (isMantra && (ev.key === ' ' || ev.key === 'Enter') && !(ev.target.closest && ev.target.closest('input[type=text], input[type=search], input:not([type]), textarea, select, a, [contenteditable]'))) { ev.preventDefault(); ev.stopPropagation(); count(1); } };
        document.addEventListener('keydown', keyH, true);
        if (isMantra) setTimeout(() => { const jb = el.querySelector('.ar-jb'); if (jb) jb.focus(); }, 60);
        el.querySelector('#ar-wake').addEventListener('change', ev => keepAwake(ev.target.checked));
      },
    });
  };

  /* ---------------- writing one ---------------- */
  AR.edit = id => {
    const x = id ? PD().texts.find(t => t.id === id) : null;
    FX().form({
      title: x ? 'Aarti / mantra' : 'Write an aarti or mantra', wide: true,
      intro: 'Leave a blank line between verses: the reading view then shows the Hindi and the English verse by verse. To type Hindi, switch your phone’s keyboard to हिन्दी, or use Google Input Tools / Windows Hindi keyboard on the computer.',
      data: x || { kind: 'aarti', deity: '' },
      fields: [{ k: 'title', label: 'Name (English)', req: true, ph: 'e.g. Om Jai Jagdish Hare, Hanuman Chalisa' }, { k: 'titleHi', label: 'Name (Hindi)', ph: 'ॐ जय जगदीश हरे' },
        { k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(k => [k[0], k[2] + ' ' + k[1]]) }, { k: 'deity', label: 'Deity', list: DEITIES },
        { k: 'when', label: 'When', ph: 'e.g. Tuesday evening, 108 times, before study' },
        { k: 'hi', label: 'Text in Hindi (Devanagari)', type: 'textarea', rows: 9 }, { k: 'en', label: 'Text in English letters', type: 'textarea', rows: 7 },
        { k: 'meaning', label: 'Meaning', type: 'textarea', rows: 3 }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 }, { k: 'link', label: 'Audio / video link', ph: 'YouTube or any link' }],
      mount(el) { U.$$('textarea[id$="-hi"], input[id$="-titleHi"]', el).forEach(t => { t.setAttribute('lang', 'hi'); t.classList.add('ar-in-hi'); }); },
      check: v => !String(v.hi || '').trim() && !String(v.en || '').trim() ? 'Write the text in Hindi or in English letters' : '',
      del: x ? async () => { if (!await ED.ui.confirm({ title: 'Delete', message: 'Delete “' + x.title + '”?', ok: 'Delete', danger: true })) return false; ED.store.checkpoint('Aarti'); PD().texts = PD().texts.filter(t => t !== x); ED.store.commit(); ED.ui.undoToast('Deleted: ' + x.title); } : null,
      save(v, api) {
        if (v.link && !/^https?:\/\//i.test(v.link)) v.link = 'https://' + v.link;
        ED.store.checkpoint(x ? 'Aarti' : 'New aarti');
        if (x) Object.assign(x, v, { updatedAt: Date.now() }); else PD().texts.push(Object.assign({ id: U.uid('ar'), fav: false, createdAt: Date.now(), updatedAt: Date.now() }, v));
        ED.store.commit(); api.close();
      },
    });
  };
  AR.addStarters = () => {
    const have = new Set(PD().texts.map(t => t.title)), add = STARTERS.filter(s => !have.has(s.title));
    if (!add.length) { ED.ui.toast('They are all in your list already'); return; }
    ED.store.checkpoint('Aartis');
    add.forEach(s => PD().texts.push(Object.assign({ id: U.uid('ar'), fav: false, starter: true, createdAt: Date.now(), updatedAt: Date.now() }, s)));
    ED.store.commit(); ED.ui.undoToast(U.plural(add.length, 'text') + ' added — edit any of them to match your own book');
  };
  A['ar-edit'] = el => AR.edit(el && el.dataset && el.dataset.id);
  A['ar-read'] = el => AR.read(el.dataset.id);
  A['ar-starters'] = () => AR.addStarters();
  A['ar-kind'] = el => { st().kind = el.dataset.k; ED.app.render(); };
  A['ar-fav'] = el => { const x = PD().texts.find(t => t.id === el.dataset.id); if (!x) return; x.fav = !x.fav; x.updatedAt = Date.now(); ED.store.commit(); };
  CH['ar-q'] = el => { st().q = el.value; setTimeout(() => { ED.app.render(); const i = document.querySelector('.ar-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); };
})();
