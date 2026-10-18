/* E-Diary — quote of the day */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util;

  const Q = [
    ['All birds find shelter during a rain. But eagle avoids rain by flying above the clouds. Problems are common, but attitude makes the difference.', 'Dr. A. P. J. Abdul Kalam'],
    ['The key is not to prioritize what’s on your schedule, but to schedule your priorities.', 'Stephen R. Covey'],
    ['If you have to eat two frogs, eat the ugliest one first.', 'Brian Tracy'],
    ['Arise, awake, and stop not till the goal is reached.', 'Swami Vivekananda'],
    ['Lost time is never found again.', 'Benjamin Franklin'],
    ['Dream, dream, dream. Dreams transform into thoughts and thoughts result in action.', 'Dr. A. P. J. Abdul Kalam'],
    ['Begin with the end in mind.', 'Stephen R. Covey'],
    ['Your right is to your work alone, never to its fruits.', 'Bhagavad Gita 2.47'],
    ['Strength does not come from physical capacity. It comes from an indomitable will.', 'Mahatma Gandhi'],
    ['Time is the scarcest resource, and unless it is managed nothing else can be managed.', 'Peter F. Drucker'],
    ['If you want to shine like a sun, first burn like a sun.', 'Dr. A. P. J. Abdul Kalam'],
    ['काल करे सो आज कर, आज करे सो अब।', 'Kabir'],
    ['Well done is better than well said.', 'Benjamin Franklin'],
    ['Life is like riding a bicycle. To keep your balance you must keep moving.', 'Albert Einstein'],
    ['Take up one idea. Make that one idea your life — think of it, dream of it, live on that idea.', 'Swami Vivekananda'],
    ['Excellence is a continuous process and not an accident.', 'Dr. A. P. J. Abdul Kalam'],
    ['The main thing is to keep the main thing the main thing.', 'Stephen R. Covey'],
    ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
    ['You can’t cross the sea merely by standing and staring at the water.', 'Rabindranath Tagore'],
    ['The journey of a thousand miles begins with one step.', 'Lao Tzu'],
    ['Genius is one percent inspiration and ninety-nine percent perspiration.', 'Thomas A. Edison'],
    ['Learning gives creativity, creativity leads to thinking, thinking provides knowledge, knowledge makes you great.', 'Dr. A. P. J. Abdul Kalam'],
    ['It always seems impossible until it’s done.', 'Nelson Mandela'],
    ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
    ['Discipline is the bridge between goals and accomplishment.', 'Jim Rohn'],
    ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius'],
    ['We are what our thoughts have made us; so take care about what you think.', 'Swami Vivekananda'],
    ['I don’t believe in taking right decisions. I take decisions and then make them right.', 'Ratan Tata'],
    ['Put first things first.', 'Stephen R. Covey'],
    ['Man needs difficulties in life because they are necessary to enjoy success.', 'Dr. A. P. J. Abdul Kalam'],
    ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
    ['Absorb what is useful, discard what is useless, add what is specifically your own.', 'Bruce Lee'],
    ['Thinking should become your capital asset, no matter whatever ups and downs you come across in your life.', 'Dr. A. P. J. Abdul Kalam'],
  ];

  ED.quotes = {
    builtIn: Q.map(([text, author]) => ({ text, author })),
    pool() {
      const d = ED.store.data;
      const own = (d.quotes || []).filter(q => q && q.text);
      const list = (d.settings.builtinQuotes !== false ? this.builtIn : []).concat(own);
      return list.length ? list : this.builtIn;
    },
    forDate(k, shift) {
      const list = this.pool();
      const [y, m, dd] = U.ymd(k);
      const doy = U.diffDays(y + '-01-01', k);
      const i = ((doy + y * 7 + (m + dd) * 0 + (shift || 0)) % list.length + list.length) % list.length;
      return list[i];
    },
  };
})();
