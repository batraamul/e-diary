/* E-Diary — optional holiday lists (all-day events). Source: DoPT, Government of India —
   compulsory holidays for central government offices in Delhi/New Delhi
   (2026: OM F.No.12/2/2023-JCA dated 03.07.2025; 2027: OM F.No.12/2/2023-JCA dated 16.07.2026). */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;

  const SETS = {
    'in-cg-2026': {
      label: 'India — central government offices, Delhi (2026)',
      items: [
        ['2026-01-26', 'Republic Day'], ['2026-03-04', 'Holi'], ['2026-03-21', 'Id-ul-Fitr'], ['2026-03-26', 'Ram Navami'],
        ['2026-03-31', 'Mahavir Jayanti'], ['2026-04-03', 'Good Friday'], ['2026-05-01', 'Buddha Purnima'], ['2026-05-27', 'Id-ul-Zuha (Bakrid)'],
        ['2026-06-26', 'Muharram'], ['2026-08-15', 'Independence Day'], ['2026-08-26', 'Milad-un-Nabi (Id-e-Milad)'], ['2026-09-04', 'Janmashtami (Vaishnava)'],
        ['2026-10-02', 'Mahatma Gandhi’s Birthday'], ['2026-10-20', 'Dussehra'], ['2026-11-08', 'Diwali (Deepavali)'], ['2026-11-24', 'Guru Nanak’s Birthday'],
        ['2026-12-25', 'Christmas Day'],
      ],
    },
    'in-cg-2027': {
      label: 'India — central government offices, Delhi (2027)',
      items: [
        ['2027-01-26', 'Republic Day'], ['2027-03-10', 'Id-ul-Fitr'], ['2027-03-23', 'Holi'], ['2027-03-26', 'Good Friday'],
        ['2027-04-15', 'Ram Navami'], ['2027-04-19', 'Mahavir Jayanti'], ['2027-05-17', 'Id-ul-Zuha (Bakrid)'], ['2027-05-20', 'Buddha Purnima'],
        ['2027-06-16', 'Muharram'], ['2027-08-15', 'Independence Day'], ['2027-08-15', 'Milad-un-Nabi (Id-e-Milad)'], ['2027-08-25', 'Janmashtami (Vaishnava)'],
        ['2027-10-02', 'Mahatma Gandhi’s Birthday'], ['2027-10-09', 'Dussehra (Vijaya Dashmi)'], ['2027-10-29', 'Diwali (Deepavali)'], ['2027-11-14', 'Guru Nanak’s Birthday'],
        ['2027-12-25', 'Christmas Day'],
      ],
    },
  };

  ED.holidays = {
    SETS,
    add(setId) {
      const set = SETS[setId]; if (!set) return 0;
      const d = ED.store.data;
      let n = 0;
      set.items.forEach(([date, title]) => {
        const dup = M.eventsOn(date).some(ev => ev.allDay && ev.title.toLowerCase() === title.toLowerCase());
        if (dup) return;
        d.events.push(M.newEvent({ title, date, allDay: true, start: null, end: null, color: '#c2185b', notes: 'Gazetted holiday', holiday: setId }));
        n++;
      });
      return n;
    },
    remove(setId) {
      const d = ED.store.data;
      const before = d.events.length;
      d.events = d.events.filter(ev => ev.holiday !== setId);
      return before - d.events.length;
    },
    offer() {
      const has = id => ED.store.data.events.some(ev => ev.holiday === id);
      ED.ui.modal({
        title: 'Add holidays', cls: 'small',
        body: '<p class="hint">Compulsory (gazetted) holidays from the Department of Personnel &amp; Training for central government offices in Delhi/New Delhi. Other states and organisations may differ.</p>' +
          '<ul class="set-list">' + Object.keys(SETS).map(id => '<li><span class="grow">' + e(SETS[id].label) + ' <span class="hint">· ' + SETS[id].items.length + ' days</span></span>' +
            (has(id) ? '<button type="button" class="btn small" data-h="rm" data-id="' + id + '">Remove</button>' : '<button type="button" class="btn small primary" data-h="add" data-id="' + id + '">Add</button>') + '</li>').join('') + '</ul>',
        footer: '<button type="button" class="btn" data-mclose>Close</button>',
        onMount(el, api) {
          el.addEventListener('click', x => {
            const b = x.target.closest('[data-h]'); if (!b) return;
            if (b.dataset.h === 'add') { const n = ED.holidays.add(b.dataset.id); ED.store.commit(); ED.ui.toast(U.plural(n, 'holiday') + ' added'); }
            else { const n = ED.holidays.remove(b.dataset.id); ED.store.commit(); ED.ui.toast(U.plural(n, 'holiday') + ' removed'); }
            api.close();
          });
        },
      });
    },
  };
})();
