/* RSS module — fetch latest comic from napirajz.hu RSS feed */
window.Napirajz = window.Napirajz || {};

window.Napirajz.RSS = (function () {
  const RSS_URL = 'https://napirajz.hu/?feed=rss2';

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

  async function fetchLatestComic() {
    try {
      const res = await fetch(RSS_URL);
      if (!res.ok) return null;
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');

      const item = xml.querySelector('item');
      if (!item) return null;

      const title = item.querySelector('title')
        ? item.querySelector('title').textContent.trim()
        : '';
      const pageUrl = item.querySelector('link')
        ? item.querySelector('link').textContent.trim()
        : '';

      // Try content:encoded for image
      const encoded = item.getElementsByTagNameNS('*', 'encoded')[0];
      let imageUrl = null;
      if (encoded) {
        imageUrl = extractImageFromHtml(encoded.textContent);
      }

      // Fallback: try media:content or enclosure
      if (!imageUrl) {
        const media = item.getElementsByTagNameNS('*', 'content')[0];
        if (media) imageUrl = media.getAttribute('url');
      }
      if (!imageUrl) {
        const enclosure = item.querySelector('enclosure');
        if (enclosure) imageUrl = enclosure.getAttribute('url');
      }

      if (!imageUrl) return null;

      return { url: imageUrl, pageUrl, title };
    } catch (_) {
      return null;
    }
  }

  return { fetchLatestComic };
})();
