/* RSS module — fetch latest comics from napirajz.hu and telex.hu */
window.Napirajz = window.Napirajz || {};

window.Napirajz.RSS = (function () {
  const NAPIRAJZ_FEED = 'https://napirajz.hu/feed/';
  const TELEX_FEED = 'https://telex.hu/rss/archivum?filters=%7B%22superTagSlugs%22%3A%5B%22napirajz%22%5D%2C%22parentId%22%3A%5B%22null%22%5D%7D&perPage=10';

  function extractImageFromHtml(htmlString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const img = doc.querySelector('img[src]');
      return img ? img.getAttribute('src') : null;
    } catch (_) {
      return null;
    }
  }

  function parsePubDate(item) {
    const el = item.querySelector('pubDate');
    if (!el) return 0;
    const d = new Date(el.textContent.trim());
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function parseNapirajzFeed(xml) {
    const items = Array.from(xml.querySelectorAll('item'));
    return items.map((item) => {
      const title = item.querySelector('title')
        ? item.querySelector('title').textContent.trim()
        : '';
      const pageUrl = item.querySelector('link')
        ? item.querySelector('link').textContent.trim()
        : '';

      let imageUrl = null;
      const encoded = item.getElementsByTagNameNS('*', 'encoded')[0];
      if (encoded) imageUrl = extractImageFromHtml(encoded.textContent);
      if (!imageUrl) {
        const media = item.getElementsByTagNameNS('*', 'content')[0];
        if (media) imageUrl = media.getAttribute('url');
      }
      if (!imageUrl) {
        const enclosure = item.querySelector('enclosure');
        if (enclosure) imageUrl = enclosure.getAttribute('url');
      }

      if (!imageUrl) return null;

      return { url: imageUrl, pageUrl, title, pubDate: parsePubDate(item), source: 'napirajz' };
    }).filter(Boolean);
  }

  function parseTelexFeed(xml) {
    const items = Array.from(xml.querySelectorAll('item'));
    return items.map((item) => {
      const title = item.querySelector('title')
        ? item.querySelector('title').textContent.trim()
        : '';
      const pageUrl = item.querySelector('link')
        ? item.querySelector('link').textContent.trim()
        : '';

      let imageUrl = null;
      const media = item.getElementsByTagNameNS('*', 'content')[0];
      if (media) imageUrl = media.getAttribute('url');
      if (!imageUrl) {
        const enclosure = item.querySelector('enclosure');
        if (enclosure) imageUrl = enclosure.getAttribute('url');
      }
      if (!imageUrl) {
        const encoded = item.getElementsByTagNameNS('*', 'encoded')[0];
        if (encoded) imageUrl = extractImageFromHtml(encoded.textContent);
      }

      if (!imageUrl) return null;

      return { url: imageUrl, pageUrl, title, pubDate: parsePubDate(item), source: 'telex' };
    }).filter(Boolean);
  }

  async function fetchFeed(url, parseFn) {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      return parseFn(xml);
    } catch (_) {
      return [];
    }
  }

  async function fetchLatestComics() {
    const [napirajz, telex] = await Promise.all([
      fetchFeed(NAPIRAJZ_FEED, parseNapirajzFeed),
      fetchFeed(TELEX_FEED, parseTelexFeed),
    ]);

    // Merge, deduplicate by title, sort newest first
    const all = [...napirajz, ...telex];
    const seen = new Set();
    const unique = all.filter((c) => {
      const key = c.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => b.pubDate - a.pubDate);
    return unique;
  }

  async function fetchLatestComic() {
    const comics = await fetchLatestComics();
    return comics[0] || null;
  }

  return { fetchLatestComic, fetchLatestComics };
})();
