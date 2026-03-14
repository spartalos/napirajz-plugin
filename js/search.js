/* Search module — dual search bar: Google + Napirajz archive */
window.Napirajz = window.Napirajz || {};

window.Napirajz.Search = (function () {
  let currentEngine = 'google'; // 'google' | 'napirajz'
  let onComicSelect = null;
  let searchTimeout = null;

  const LABELS = {
    google: 'G',
    napirajz: 'N',
  };
  const TITLES = {
    google: 'Google keresés',
    napirajz: 'Napirajz archívum keresés',
  };

  function init(comicSelectCallback) {
    onComicSelect = comicSelectCallback;

    const toggle = document.getElementById('search-engine-toggle');
    const input = document.getElementById('search-input');
    const submit = document.getElementById('search-submit');
    const results = document.getElementById('search-results');

    // Restore saved engine preference
    window.Napirajz.Storage.getSearchEngine().then((engine) => {
      setEngine(engine);
    });

    toggle.addEventListener('click', () => {
      const next = currentEngine === 'google' ? 'napirajz' : 'google';
      setEngine(next);
      window.Napirajz.Storage.setSearchEngine(next);
    });

    submit.addEventListener('click', () => doSearch(input.value.trim(), results));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        doSearch(input.value.trim(), results);
      } else if (e.key === 'Escape') {
        hideResults(results);
      }
    });

    input.addEventListener('input', () => {
      if (currentEngine !== 'napirajz') return;
      clearTimeout(searchTimeout);
      const q = input.value.trim();
      if (q.length < 2) {
        hideResults(results);
        return;
      }
      searchTimeout = setTimeout(() => liveSearch(q, results), 350);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#site-header')) {
        hideResults(results);
      }
    });
  }

  function setEngine(engine) {
    currentEngine = engine;
    const toggle = document.getElementById('search-engine-toggle');
    if (toggle) {
      toggle.textContent = LABELS[engine] || engine;
      toggle.setAttribute('title', TITLES[engine] || '');
      toggle.setAttribute('aria-label', TITLES[engine] || '');
    }
    const input = document.getElementById('search-input');
    if (input) {
      input.placeholder = engine === 'google' ? 'Google keresés...' : 'Napirajz keresés...';
    }
  }

  function doSearch(query, resultsEl) {
    if (!query) return;

    if (currentEngine === 'google') {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener');
      return;
    }

    // Napirajz archive search
    liveSearch(query, resultsEl);
  }

  async function liveSearch(query, resultsEl) {
    const results = await window.Napirajz.API.searchComics(query);
    renderResults(results, resultsEl);
  }

  function renderResults(results, resultsEl) {
    resultsEl.innerHTML = '';

    if (!results || results.length === 0) {
      resultsEl.hidden = true;
      return;
    }

    results.slice(0, 10).forEach((comic) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '0');

      if (comic.url) {
        const img = document.createElement('img');
        img.src = comic.url;
        img.alt = '';
        img.className = 'search-result-thumb';
        img.loading = 'lazy';
        item.appendChild(img);
      }

      const title = document.createElement('span');
      title.className = 'search-result-title';
      title.textContent = comic.title || comic.pageUrl || '';
      item.appendChild(title);

      const select = () => {
        if (onComicSelect) onComicSelect(comic);
        resultsEl.hidden = true;
        document.getElementById('search-input').value = '';
      };

      item.addEventListener('click', select);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });

      resultsEl.appendChild(item);
    });

    resultsEl.hidden = false;
  }

  function hideResults(resultsEl) {
    resultsEl.hidden = true;
  }

  return { init };
})();
