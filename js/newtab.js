/* Main orchestrator — newtab.js */
(function () {
  const randomButtonTexts = [
    'STÉG', 'ZAPPA', 'STUNK', 'KONGLON', 'HRANULÁK', 'TADÜN',
    'GLÓTAH', 'SKALÜNT', 'KREDALÁN', 'AMAKUN', 'KANDÁN', 'FLOCSK',
    'FLASK', 'VROMPLON', 'VEGANÉZ', 'UDUN', 'FLOKSZON', 'SZLOPAKIKKI',
    'ROMMEL', 'RÖTÖPEM',
  ];

  function randomButtonText() {
    return randomButtonTexts[Math.floor(Math.random() * randomButtonTexts.length)];
  }

  // --- DOM helpers ---
  function showEl(el) { el.hidden = false; }
  function hideEl(el) { el.hidden = true; }

  function showSkeleton() {
    showEl(document.getElementById('skeleton'));
    hideEl(document.getElementById('comic-container'));
    hideEl(document.getElementById('error-container'));
  }

  function showComic(comic) {
    hideEl(document.getElementById('skeleton'));
    hideEl(document.getElementById('error-container'));

    const container = document.getElementById('comic-container');
    const img = document.getElementById('comic-image');
    const link = document.getElementById('comic-link');
    const title = document.getElementById('comic-title');

    // XSS-safe: use textContent, not innerHTML
    title.textContent = comic.title || '';
    link.href = comic.pageUrl || comic.url || '#';

    img.classList.add('loading');
    img.onload = () => {
      img.classList.remove('loading');
      img.classList.add('loaded');
    };
    img.src = comic.url || '';
    img.alt = comic.title || 'Napirajz';

    window.Napirajz.Share.render(document.getElementById('share-container'), comic);

    showEl(container);
  }

  function showError(message) {
    hideEl(document.getElementById('skeleton'));
    hideEl(document.getElementById('comic-container'));
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message || 'Valami elromlott...';
    showEl(document.getElementById('error-container'));
  }

  function showComicArea() {
    showEl(document.getElementById('comic-area'));
    hideEl(document.getElementById('game-area'));
  }

  function showGameArea() {
    hideEl(document.getElementById('comic-area'));
    showEl(document.getElementById('game-area'));
    window.Napirajz.Game.init();
  }

  // --- Comic loading ---
  async function loadComic(mode) {
    showSkeleton();

    let comic = null;
    if (mode === 'latest') {
      comic = await window.Napirajz.RSS.fetchLatestComic();
    }
    if (!comic) {
      comic = await window.Napirajz.API.fetchRandomComic();
    }

    if (!comic) {
      window.Napirajz.Offline.reportFetchFailure();
      showError('Valami elromlott... nincs rajz :(');
      return;
    }

    await window.Napirajz.Storage.cacheComic(comic);
    showComic(comic);
  }

  // --- Mode toggle ---
  function setMode(mode, persist) {
    const btnRandom = document.getElementById('btn-random');
    const btnLatest = document.getElementById('btn-latest');

    if (mode === 'random') {
      btnRandom.classList.add('active');
      btnRandom.setAttribute('aria-pressed', 'true');
      btnLatest.classList.remove('active');
      btnLatest.setAttribute('aria-pressed', 'false');
    } else {
      btnLatest.classList.add('active');
      btnLatest.setAttribute('aria-pressed', 'true');
      btnRandom.classList.remove('active');
      btnRandom.setAttribute('aria-pressed', 'false');
    }

    if (persist) {
      window.Napirajz.Storage.setMode(mode);
    }
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', async () => {
    const Storage = window.Napirajz.Storage;
    const Offline = window.Napirajz.Offline;

    // Offline detection
    Offline.init(
      () => { showGameArea(); },
      () => { showComicArea(); loadComic(currentMode); }
    );

    let currentMode = await Storage.getMode();

    // Show cached comic immediately while fetching fresh
    const cached = await Storage.getCachedComic();
    if (cached) {
      hideEl(document.getElementById('skeleton'));
      showComic(cached);
    }

    setMode(currentMode, false);

    // Mode toggle buttons
    document.getElementById('btn-random').addEventListener('click', async () => {
      currentMode = 'random';
      setMode('random', true);
      await loadComic('random');
    });

    document.getElementById('btn-latest').addEventListener('click', async () => {
      currentMode = 'latest';
      setMode('latest', true);
      await loadComic('latest');
    });

    // Random button
    const randomBtn = document.getElementById('random-button');
    randomBtn.textContent = randomButtonText();
    randomBtn.addEventListener('click', async () => {
      randomBtn.textContent = randomButtonText();
      await loadComic('random');
    });

    // Retry button
    document.getElementById('retry-button').addEventListener('click', async () => {
      await loadComic(currentMode);
    });

    // Search
    window.Napirajz.Search.init((comic) => {
      showComic(comic);
    });

    // Load initial comic if not offline
    if (!Offline.checkIsOffline()) {
      await loadComic(currentMode);
    }
  });
})();
