/**
 * Lazy-load images that use data-lazy="path.jpg"
 * Usage: <img data-lazy="image.jpg" alt="...">
 * Re-run after PJAX swaps via window.initLazyLoad().
 */
(function () {
  function loadImg(img) {
    const src = img.getAttribute('data-lazy');
    if (!src) return;
    img.setAttribute('src', src);
    img.removeAttribute('data-lazy');
  }

  window.initLazyLoad = function initLazyLoad(scope) {
    const root = scope || document;
    const imgs = Array.from(root.querySelectorAll('img[data-lazy]'));
    if (!imgs.length) return;

    if (!('IntersectionObserver' in window)) {
      imgs.forEach(loadImg);
      return;
    }

    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        loadImg(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '200px 0px' });

    imgs.forEach(img => io.observe(img));
  };
})();
