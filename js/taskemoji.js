/* E-Diary — 1.26.6: an emoji for any task (optional). The task editor's emoji button and the task ⋯ menu open this
   picker: categories (travel, transport, birthdays and celebrations, work, study, health, food, family, home, money,
   faith, nature, sport, tech, time, symbols), a search box, “No emoji” and any emoji you type or paste.
   Stored as task.emoji ('' = none); shown before the title everywhere a task is listed — task lists, every calendar,
   the Eisenhower matrix, Weekly / Yearly, Google Calendar, .ics and shared text (ED.model.ttl). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, e = U.esc;
  // [emoji, search words]
  const C = [
    ['Travel & places', '✈️ air flight plane travel trip|🛫 departure take off flight|🛬 arrival landing flight|🧳 luggage suitcase packing trip|🗺️ map tour route|🧭 compass direction trek|🏖️ beach holiday vacation|🏝️ island holiday|🏔️ mountain hills trek|⛰️ mountain|🏕️ camping|🗻 mount|🌋 volcano|🏜️ desert|🏞️ park national|🏛️ monument museum heritage|🕌 mosque|🛕 temple mandir|⛪ church|🕍 synagogue|🏰 fort castle|🗼 tower|🗽 statue|🎡 fair ferris|🎢 amusement park|🏨 hotel stay|🏩 hotel|🛂 passport visa immigration|🛃 customs|🎫 ticket booking|🎟️ ticket admission|📸 photos camera trip|🌍 world abroad|🌏 asia world|🌐 international globe|🧾 booking receipt'],
    ['Transport', '🚌 bus|🚍 bus coach|🚎 trolley bus|🚐 minibus van|🚆 train railway|🚄 fast train vande bharat|🚅 bullet train|🚇 metro subway|🚉 railway station|🚊 tram|🚝 monorail|🚞 hill train|🚂 steam train|🚃 coach railway|🚕 taxi cab ola uber|🚖 taxi|🛺 auto rickshaw|🚗 car drive|🚙 suv car|🛻 pickup truck|🚚 truck shifting delivery|🚛 lorry|🏍️ motorbike bike|🛵 scooter|🚲 bicycle cycle|🛴 kick scooter|🚑 ambulance|🚒 fire engine|🚓 police car|🚁 helicopter|🛩️ small plane|🚀 rocket launch|🛰️ satellite|🚢 ship cruise|⛴️ ferry|🛥️ boat|⛵ sailing|🚤 speed boat|⛽ fuel petrol|🅿️ parking|🛣️ highway road trip|🚦 traffic|🔧 car service repair'],
    ['Celebrations', '🎂 birthday cake happy birthday|🥳 party celebrate birthday|🎉 celebration party congrats|🎊 confetti celebration|🎈 balloon birthday|🎁 gift present|💐 bouquet flowers wishes|🌹 rose|💍 ring engagement|💒 wedding|👰 bride wedding|🤵 groom wedding|💑 couple anniversary|💞 anniversary love|❤️ love heart|💌 love letter card|🪔 diya diwali deepawali|🎆 fireworks|🎇 sparkler diwali|🧨 crackers|🪅 piñata|🎄 christmas|🎃 halloween|🏮 lantern|🎀 ribbon|🍰 cake|🧁 cupcake|🍾 champagne|🥂 cheers toast|🎶 music sangeet|💃 dance|🕺 dance|🙌 congratulations|👏 applause|🏆 award trophy|🥇 first gold medal|🎓 graduation convocation'],
    ['Work & office', '💼 work office briefcase|🏢 office building|🗂️ file files|📁 folder file|📂 open file|📋 clipboard checklist|📝 note write memo|✍️ sign signature write|📄 document letter|📑 papers|🧾 bill invoice|📊 chart report presentation|📈 growth chart|📉 decline chart|📅 calendar date|🗓️ planner schedule|📆 calendar|📌 pin important|📍 location|📎 attach clip|🖇️ paper clips|✂️ cut|🗃️ records|🗄️ cabinet records|🖊️ pen|🖋️ fountain pen|📧 email mail|📨 incoming mail|📤 send outbox|📥 inbox|📞 phone call|☎️ telephone|📠 fax|🤝 meeting deal handshake|👔 formal tie interview|🧑‍💼 officer manager|👨‍💼 officer|⚖️ legal court law|🏛️ government ministry|🪪 id card|📮 post|📦 parcel package|🔏 confidential|🔐 secure|🗳️ election vote'],
    ['Study & learning', '📚 books study|📖 reading book|📘 book|📗 book|📙 book|📕 book|📓 notebook|📔 notebook|🎓 graduation degree|🏫 school|🎒 school bag|✏️ pencil|📐 geometry|📏 ruler|🧮 maths abacus|🔬 microscope science lab|🧪 chemistry experiment|🧫 biology|🧬 dna genetics|🔭 telescope astronomy|🌡️ temperature|💡 idea|🧠 brain think|❓ question|❗ important|✅ done check|☑️ check|🧑‍🏫 teacher class|🧑‍🎓 student|📜 certificate|🗒️ notes|🖍️ crayon|🧾 exam result|🏅 medal|🥈 second|🥉 third|📝 exam test|⏳ deadline'],
    ['Health & fitness', '💊 medicine tablet|💉 injection vaccine|🩺 doctor checkup|🩹 bandage|🏥 hospital|🦷 dentist teeth|👁️ eye|👓 glasses spectacles|🧘 yoga meditation|🏃 run running jog|🚶 walk|🏋️ gym weights|🤸 exercise|🚴 cycling|🏊 swimming|🧗 climbing|⛹️ basketball|🥗 salad diet|🍎 apple healthy|💧 water drink|😴 sleep|🛌 rest bed|❤️‍🩹 recovery|🩸 blood test|🫀 heart|🫁 lungs|🧴 lotion|🦴 bone|🤒 sick fever|🤧 cold|😷 mask|🧑‍⚕️ doctor|🌿 ayurveda herbal'],
    ['Food & drink', '🍳 cooking breakfast|🥞 pancakes|🍞 bread|🥐 croissant|🥪 sandwich|🍲 meal curry|🍛 rice curry|🍜 noodles|🍝 pasta|🍕 pizza|🍔 burger|🌮 taco|🥘 dinner|🍱 tiffin lunch box|🥡 takeaway|🍽️ dinner meal|🥗 salad|🍲 soup|🍚 rice|🫓 roti chapati|🧆 snacks|🍿 popcorn movie|🍫 chocolate|🍬 sweets|🍭 candy|🍩 donut|🍪 cookie|🍦 ice cream|🍎 fruit|🍌 banana|🥭 mango|🍇 grapes|🍉 watermelon|🥕 vegetables|🧅 onion|🥛 milk|☕ coffee tea|🍵 tea chai|🧃 juice|🥤 drink|🍺 beer|🍷 wine|🛒 grocery shopping|🧂 salt spices'],
    ['Family & people', '👪 family|👨‍👩‍👦 family son|👨‍👩‍👧 family daughter|👶 baby|🧒 child kid|👦 boy son|👧 girl daughter|👨 man husband|👩 woman wife|👴 grandfather elder|👵 grandmother elder|🧓 elder parent|👫 friends|👬 friends|👭 friends|🤗 hug|🙋 volunteer|🧑‍🤝‍🧑 meet people|💬 chat talk|🗣️ speak|👥 group team|🫂 support|🙏 thanks pray namaste|👋 hello visit|🤝 meet|🧑‍🍼 parenting|🐶 dog pet|🐱 cat pet|🐦 bird|🐟 fish|🐄 cow'],
    ['Home & chores', '🏠 home house|🏡 home garden|🧹 cleaning sweep|🧺 laundry washing|🧼 soap wash|🧽 sponge dishes|🪣 bucket|🧻 tissue|🛏️ bed|🛋️ sofa|🪑 chair|🚪 door|🪟 window|🔑 key|🔒 lock|🔨 hammer repair|🪛 screwdriver|🔧 wrench fix|⚙️ settings maintenance|🔌 plug electric|💡 bulb light|🪴 plant|🌱 garden plant|🗑️ trash garbage|♻️ recycle|🔥 gas stove|🚿 shower|🛁 bath|🚰 water tap|❄️ ac fridge|📺 tv|🧯 fire safety|🪜 ladder|🏗️ construction renovation'],
    ['Money & shopping', '💰 money|💵 cash|💸 spend payment|💳 card payment|🏦 bank|🪙 coin|💹 stocks market|📈 investment growth|🧾 bill receipt|🛒 shopping cart grocery|🛍️ shopping bags|🏷️ price tag sale|💲 price|🧮 accounts tax|📑 tax return itr|🏧 atm|🪪 kyc|🔁 renewal subscription|📆 emi due date|🏠 rent|⚡ electricity bill|📱 mobile recharge|🌐 internet bill|🚰 water bill|🔥 gas bill|🎁 gift'],
    ['Faith & spiritual', '🙏 prayer pooja|🕉️ om|🪔 diya aarti|🛕 temple mandir|📿 mala jaap|🔱 trishul shiva|🌺 flowers offering|🌼 marigold|🥥 coconut|🍚 prasad bhog|🔔 bell|🐚 shankh|🌙 moon chaturthi|🌕 purnima full moon|🌑 amavasya|☀️ surya sunrise|🔥 havan yagya|🧘 meditation dhyan|📖 path gita ramayan|🕯️ candle|✨ blessing|🐘 ganesh|🐒 hanuman|🦚 krishna peacock|🪷 lotus lakshmi|🐍 naag|☸️ dharma wheel|☪️ islam|✝️ christian|🕎 menorah|☬ khanda sikh|🛐 worship'],
    ['Nature & weather', '☀️ sunny sun|🌤️ partly sunny|⛅ cloudy|🌥️ cloud|☁️ cloud|🌦️ rain sun|🌧️ rain|⛈️ thunderstorm|🌩️ lightning|🌨️ snow|❄️ cold winter|🌬️ wind|🌪️ tornado cyclone|🌫️ fog mist|🌈 rainbow|🌂 umbrella|☔ rain umbrella|🌡️ temperature heat|💨 wind|🌊 sea waves|🌸 spring blossom|🍂 autumn|🍁 leaf|🌳 tree|🌲 forest|🌴 palm|🌵 cactus|🌻 sunflower|🌾 crop harvest|🌙 night|⭐ star|🌌 sky|🌏 earth|🛰️ satellite|🎈 radiosonde balloon'],
    ['Sport & hobbies', '⚽ football|🏏 cricket|🏸 badminton|🎾 tennis|🏓 table tennis|🏐 volleyball|🏀 basketball|🏑 hockey|♟️ chess|🎲 board game|🎮 video game|🧩 puzzle|🎯 target goal|🎳 bowling|🎣 fishing|🏹 archery|🥋 martial arts|🥊 boxing|⛳ golf|🎨 painting art|🖌️ brush|🎭 theatre drama|🎬 movie film|🎥 video|📷 photography|🎵 music|🎸 guitar|🎹 piano|🥁 drums|🎤 singing|🎧 podcast listening|📻 radio|📺 series tv|🪁 kite|🧶 knitting|🪡 sewing|🌱 gardening|✈️ flying drone'],
    ['Tech & devices', '💻 laptop computer|🖥️ desktop|⌨️ keyboard|🖱️ mouse|🖨️ printer|📱 phone mobile|📲 call|☎️ landline|🔋 battery charge|🔌 charger|💾 save backup|💿 disc|📀 dvd|🗜️ compress|🧑‍💻 coding programming|👨‍💻 developer|🤖 ai robot|🛰️ satellite|📡 antenna radar|🔭 telescope|🔬 lab|⚙️ settings|🛠️ tools fix|🔧 repair|🔩 nut bolt|🧰 toolbox|🔐 password security|🛡️ security protect|🕵️ intelligence investigate|🌐 website internet|☁️ cloud|📶 wifi signal|🖧 network|🚁 drone uav|✈️ aircraft avionics'],
    ['Time & reminders', '⏰ alarm reminder|⏱️ stopwatch timer|⏲️ timer|🕐 time clock|⌛ hourglass|⏳ deadline waiting|📅 date|🗓️ schedule|🔔 notification reminder|🔕 silent|📣 announcement|📢 notice|🚨 urgent alert|⚠️ warning caution|❗ important|‼️ very important|❓ question|🔁 repeat|🔂 repeat once|🔄 update renew|▶️ start|⏸️ pause|⏹️ stop|⏭️ next|🆕 new|🆓 free|🔜 soon|🔚 end|🏁 finish|🚩 flag milestone'],
    ['Symbols & feelings', '⭐ star favourite|🌟 shining|✨ sparkle|🔥 hot fire priority|💯 hundred perfect|✅ done|❌ cancel no|⭕ circle|🔴 red|🟠 orange|🟡 yellow|🟢 green|🔵 blue|🟣 purple|⚫ black|⚪ white|🟥 red square|🟩 green square|🟦 blue square|❤️ red heart love|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|😊 happy smile|😃 joy|😂 laugh|😍 love|🤩 excited|😎 cool|🤔 think|😴 sleepy|😢 sad|😡 angry|😇 blessed|🤞 hope luck|👍 good ok|👎 bad|💪 strong strength|🐸 frog eat the frog|🎯 focus target|🧿 nazar protection|🍀 luck clover|☮️ peace|🇮🇳 india flag|🏳️ flag'],
  ].map(([name, s]) => [name, s.split('|').map(x => { const i = x.indexOf(' '); return [x.slice(0, i), x.slice(i + 1)]; })]);
  const TE = (ED.taskEmoji = { cats: C });
  const LS = 'ed-emoji-recent';
  const recent = () => { try { return (JSON.parse(localStorage.getItem(LS) || '[]') || []).slice(0, 16); } catch (err) { return []; } };
  const remember = x => { if (!x) return; try { localStorage.setItem(LS, JSON.stringify([x].concat(recent().filter(y => y !== x)).slice(0, 16))); } catch (err) { /* private window */ } };
  TE.count = () => C.reduce((a, c) => a + c[1].length, 0);

  /* the picker: TE.pick(anchor, current, onPick(emoji | '')) */
  TE.pick = (anchor, cur, onPick) => {
    const btn = (x, w) => '<button type="button" class="emoji-btn' + (x === cur ? ' on' : '') + '" data-emo="' + e(x) + '" title="' + e(w || x) + '" aria-label="' + e((w || x).split(' ')[0] || x) + '">' + x + '</button>';
    const r = recent();
    const html = '<div class="te-emo">' +
      '<div class="te-emo-top"><label class="pw-search">' + ED.icon('search') + '<span class="sr-only">Search emoji</span><input class="te-emo-q" type="search" placeholder="Search: bus, train, birthday, exam, temple…" autocomplete="off"></label>' +
      '<button type="button" class="btn small' + (!cur ? ' primary' : '') + '" data-none>' + ED.icon('x') + 'No emoji</button></div>' +
      '<div class="te-emo-tabs" role="tablist">' + (r.length ? '<button type="button" class="chip" data-jump="recent">Recent</button>' : '') + C.map((c, i) => '<button type="button" class="chip" data-jump="' + i + '">' + c[1][0][0] + ' ' + e(c[0]) + '</button>').join('') + '</div>' +
      '<div class="te-emo-list">' +
      (r.length ? '<h4 data-sec="recent">Recent</h4><div class="emoji-grid">' + r.map(x => btn(x)).join('') + '</div>' : '') +
      C.map((c, i) => '<h4 data-sec="' + i + '">' + e(c[0]) + '</h4><div class="emoji-grid">' + c[1].map(x => btn(x[0], x[1])).join('') + '</div>').join('') +
      '<p class="hint te-emo-none" hidden>No emoji matches — try another word, or type / paste one below.</p></div>' +
      '<div class="emoji-own"><input class="field" maxlength="12" placeholder="Or type / paste any emoji" aria-label="Your own emoji"><button type="button" class="btn small" data-own>Use</button></div></div>';
    ED.ui.popover(anchor, html, {
      cls: 'emoji-pop te-emo-pop',
      onMount(el, p) {
        const q = el.querySelector('.te-emo-q'), list = el.querySelector('.te-emo-list');
        setTimeout(() => q.focus(), 30);
        const done = v => { p.close(true); remember(v); onPick(v); };
        q.addEventListener('input', () => {
          const s = q.value.trim().toLowerCase(); let any = false;
          list.querySelectorAll('.emoji-btn').forEach(b => { const hit = !s || (b.title || '').toLowerCase().indexOf(s) >= 0 || b.dataset.emo === s; b.hidden = !hit; if (hit) any = true; });
          list.querySelectorAll('h4').forEach(h => { const g = h.nextElementSibling; h.hidden = !!s && !g.querySelector('.emoji-btn:not([hidden])'); g.hidden = h.hidden; });
          const rh = list.querySelector('h4[data-sec="recent"]'); if (rh && s) { rh.hidden = true; rh.nextElementSibling.hidden = true; }
          list.querySelector('.te-emo-none').hidden = any;
        });
        q.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); const b = list.querySelector('.emoji-btn:not([hidden])'); if (b && q.value.trim()) done(b.dataset.emo); } });
        el.addEventListener('click', ev => {
          const j = ev.target.closest('[data-jump]'); if (j) { const h = list.querySelector('h4[data-sec="' + j.dataset.jump + '"]'); if (h) list.scrollTop = h.offsetTop - list.offsetTop; return; }
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
