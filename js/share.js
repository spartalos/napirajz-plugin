/* Share module — social sharing buttons */
window.Napirajz = window.Napirajz || {};

window.Napirajz.Share = (function () {
  function createShareButton(label, ariaLabel, svgPath, clickHandler) {
    const btn = document.createElement('button');
    btn.className = 'sketchy-button share-button';
    btn.setAttribute('aria-label', ariaLabel);
    btn.setAttribute('title', ariaLabel);

    const img = document.createElement('img');
    img.src = svgPath;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.width = 18;
    img.height = 18;

    const text = document.createElement('span');
    text.textContent = label;

    btn.appendChild(img);
    btn.appendChild(text);
    btn.addEventListener('click', clickHandler);
    return btn;
  }

  function render(container, comic) {
    if (!comic) return;
    container.innerHTML = '';

    const encodedUrl = encodeURIComponent(comic.pageUrl || comic.url);
    const encodedTitle = encodeURIComponent(comic.title || 'Napirajz');

    // X (Twitter)
    container.appendChild(createShareButton(
      'X',
      'Megosztás X-en',
      'icons/share-x.svg',
      () => window.open(
        `https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
        '_blank', 'noopener'
      )
    ));

    // Facebook
    container.appendChild(createShareButton(
      'Facebook',
      'Megosztás Facebookon',
      'icons/share-fb.svg',
      () => window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        '_blank', 'noopener'
      )
    ));

    // Email
    container.appendChild(createShareButton(
      'Email',
      'Küldés emailben',
      'icons/share-email.svg',
      () => {
        window.location.href =
          `mailto:?subject=${encodedTitle}&body=${encodedUrl}`;
      }
    ));

    // Copy link
    container.appendChild(createShareButton(
      'Link',
      'Link másolása',
      'icons/share-link.svg',
      async (e) => {
        try {
          await navigator.clipboard.writeText(comic.pageUrl || comic.url);
          const btn = e.currentTarget;
          const span = btn.querySelector('span');
          const original = span.textContent;
          span.textContent = 'Másolva!';
          setTimeout(() => { span.textContent = original; }, 1500);
        } catch (_) {
          // Clipboard API not available — silently fail
        }
      }
    ));
  }

  return { render };
})();
