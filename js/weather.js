/* E-Diary — weather from Open-Meteo (free, no key). Cached for 30 minutes; works offline from cache. */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util;
  const CACHE_KEY = 'e-diary-weather-v1';
  const TTL = 30 * 60 * 1000;

  const CODES = {
    0: ['Clear', 'wSun'], 1: ['Mainly Clear', 'wSun'], 2: ['Partly Cloudy', 'wPartly'], 3: ['Overcast', 'wCloud'],
    45: ['Fog', 'wFog'], 48: ['Rime Fog', 'wFog'],
    51: ['Light Drizzle', 'wDrizzle'], 53: ['Drizzle', 'wDrizzle'], 55: ['Heavy Drizzle', 'wDrizzle'],
    56: ['Freezing Drizzle', 'wDrizzle'], 57: ['Freezing Drizzle', 'wDrizzle'],
    61: ['Light Rain', 'wRain'], 63: ['Rain', 'wRain'], 65: ['Heavy Rain', 'wRain'],
    66: ['Freezing Rain', 'wRain'], 67: ['Freezing Rain', 'wRain'],
    71: ['Light Snow', 'wSnow'], 73: ['Snow', 'wSnow'], 75: ['Heavy Snow', 'wSnow'], 77: ['Snow Grains', 'wSnow'],
    80: ['Rain Showers', 'wRain'], 81: ['Rain Showers', 'wRain'], 82: ['Violent Showers', 'wRain'],
    85: ['Snow Showers', 'wSnow'], 86: ['Snow Showers', 'wSnow'],
    95: ['Thunderstorm', 'wStorm'], 96: ['Thunderstorm, Hail', 'wStorm'], 99: ['Thunderstorm, Hail', 'wStorm'],
  };

  const W = (ED.weather = {
    data: U.lsGet(CACHE_KEY, null),
    loading: null,
    error: null,

    cfg() { return ED.store.data.settings.weather; },
    sig(c) { return [c.lat, c.lon, c.unit].join(','); },

    describe(code, isDay) {
      const d = CODES[code] || ['—', 'wCloud'];
      let icon = d[1];
      if (isDay === 0 && icon === 'wSun') icon = 'wMoon';
      return { text: d[0], icon };
    },

    fresh() {
      const c = this.cfg();
      return this.data && this.data.sig === this.sig(c) && Date.now() - this.data.at < TTL;
    },

    async refresh(force) {
      const c = this.cfg();
      if (!c || !c.on || c.lat == null) return null;
      if (!force && this.fresh()) return this.data;
      if (this.loading) return this.loading;
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon +
        '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min' +
        '&timezone=auto&past_days=7&forecast_days=16' + (c.unit === 'F' ? '&temperature_unit=fahrenheit' : '');
      this.loading = (async () => {
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 9000);
          const r = await fetch(url, { signal: ctl.signal });
          clearTimeout(timer);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const j = await r.json();
          const days = {};
          (j.daily && j.daily.time || []).forEach((t, i) => {
            days[t] = { max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], code: j.daily.weather_code[i] };
          });
          this.data = {
            sig: this.sig(c), at: Date.now(), place: c.name,
            current: j.current ? { temp: j.current.temperature_2m, code: j.current.weather_code, isDay: j.current.is_day } : null,
            days,
          };
          this.error = null;
          U.lsSet(CACHE_KEY, this.data);
          return this.data;
        } catch (e) {
          this.error = e;
          return null;
        } finally {
          this.loading = null;
        }
      })();
      return this.loading;
    },

    /* what to show for one diary date */
    forDate(k) {
      const c = this.cfg();
      const d = this.data;
      if (!d || d.sig !== this.sig(c)) return null;
      const day = d.days && d.days[k];
      const isToday = k === U.today();
      if (!day && !isToday) return null;
      const code = isToday && d.current ? d.current.code : day ? day.code : null;
      const desc = this.describe(code, isToday && d.current ? d.current.isDay : 1);
      return {
        today: isToday,
        temp: isToday && d.current ? Math.round(d.current.temp) : null,
        max: day ? Math.round(day.max) : null,
        min: day ? Math.round(day.min) : null,
        text: desc.text, icon: desc.icon,
        unit: c.unit === 'F' ? '°F' : '°C',
        stale: Date.now() - d.at > TTL * 4,
        at: d.at,
      };
    },

    async searchCity(q) {
      const url = 'https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=' + encodeURIComponent(q);
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      return (j.results || []).map(x => ({ name: x.name, admin: x.admin1 || '', country: x.country || '', lat: +x.latitude.toFixed(4), lon: +x.longitude.toFixed(4) }));
    },
  });
})();
