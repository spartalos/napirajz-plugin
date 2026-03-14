/* API module — fetch wrappers for kereso.napirajz.hu */
window.Napirajz = window.Napirajz || {};

window.Napirajz.API = (function () {
  const BASE = 'https://kereso.napirajz.hu/abort.php';

  function normalizeComic(raw) {
    if (!raw) return null;
    // API returns an object; grab first entry
    const keys = Object.keys(raw);
    if (keys.length === 0) return null;
    const entry = raw[keys[0]];
    return {
      url: entry.URL || '',
      pageUrl: entry.LapURL || entry.URL || '',
      title: entry.Cim || '',
    };
  }

  async function fetchRandomComic() {
    try {
      const res = await fetch(`${BASE}?guppi&json`);
      if (!res.ok) return null;
      const data = await res.json();
      return normalizeComic(data);
    } catch (_) {
      return null;
    }
  }

  async function searchComics(query) {
    if (!query) return [];
    try {
      const url = `${BASE}?q=${encodeURIComponent(query)}&hely=st&json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || typeof data !== 'object') return [];
      return Object.values(data).map((entry) => ({
        url: entry.URL || '',
        pageUrl: entry.LapURL || entry.URL || '',
        title: entry.Cim || '',
      }));
    } catch (_) {
      return [];
    }
  }

  return { fetchRandomComic, searchComics };
})();
