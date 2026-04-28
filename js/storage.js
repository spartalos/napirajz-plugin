/* Storage module — chrome.storage.local wrappers */
window.Napirajz = window.Napirajz || {};

window.Napirajz.Storage = (function () {
  const KEYS = {
    MODE: 'mode',
    SEARCH_ENGINE: 'searchEngine',
    CACHED_COMIC: 'cachedComic',
    HIGH_SCORE: 'highScore',
    SEEN_KEYS: 'seenKeys',
  };

  function get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => resolve(result[key]));
    });
  }

  function set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  function keyOf(comic) {
    if (!comic) return null;
    if (comic.pageUrl) return comic.pageUrl;
    if (comic.url) return comic.url;
    if (comic.title) return 'title:' + comic.title.toLowerCase().trim();
    return null;
  }

  function getMode() {
    return get(KEYS.MODE).then((v) => v || 'random');
  }

  function setMode(mode) {
    return set(KEYS.MODE, mode);
  }

  function getSearchEngine() {
    return get(KEYS.SEARCH_ENGINE).then((v) => v || 'google');
  }

  function setSearchEngine(engine) {
    return set(KEYS.SEARCH_ENGINE, engine);
  }

  function cacheComic(comic) {
    return set(KEYS.CACHED_COMIC, comic);
  }

  function getCachedComic() {
    return get(KEYS.CACHED_COMIC);
  }

  function getHighScore() {
    return get(KEYS.HIGH_SCORE).then((v) => v || 0);
  }

  function setHighScore(score) {
    return set(KEYS.HIGH_SCORE, score);
  }

  async function isSeen(comic) {
    const k = keyOf(comic);
    if (!k) return false;
    const map = (await get(KEYS.SEEN_KEYS)) || {};
    return Boolean(map[k]);
  }

  async function markSeen(comic) {
    const k = keyOf(comic);
    if (!k) return;
    const map = (await get(KEYS.SEEN_KEYS)) || {};
    if (map[k]) return; // already marked, skip write
    map[k] = true;
    await set(KEYS.SEEN_KEYS, map);
  }

  return {
    getMode,
    setMode,
    getSearchEngine,
    setSearchEngine,
    cacheComic,
    getCachedComic,
    getHighScore,
    setHighScore,
    isSeen,
    markSeen,
  };
})();
