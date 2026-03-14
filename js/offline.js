/* Offline module — network detection + view switching */
window.Napirajz = window.Napirajz || {};

window.Napirajz.Offline = (function () {
  let isOffline = false;
  let onOfflineCallback = null;
  let onOnlineCallback = null;

  function init(onOffline, onOnline) {
    onOfflineCallback = onOffline;
    onOnlineCallback = onOnline;

    isOffline = !navigator.onLine;
    if (isOffline) {
      triggerOffline();
    }

    window.addEventListener('offline', () => {
      if (!isOffline) {
        isOffline = true;
        triggerOffline();
      }
    });

    window.addEventListener('online', () => {
      if (isOffline) {
        isOffline = false;
        triggerOnline();
      }
    });
  }

  function triggerOffline() {
    if (onOfflineCallback) onOfflineCallback();
  }

  function triggerOnline() {
    if (onOnlineCallback) onOnlineCallback();
  }

  // Call this when a fetch fails to signal offline state
  function reportFetchFailure() {
    if (!navigator.onLine && !isOffline) {
      isOffline = true;
      triggerOffline();
    }
  }

  function checkIsOffline() {
    return isOffline;
  }

  return { init, reportFetchFailure, checkIsOffline };
})();
