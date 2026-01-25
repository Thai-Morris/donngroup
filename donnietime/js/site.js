(function () {
  const SELECTOR_CONTAINER = '#pjax-container';

  function sameOrigin(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function isHtmlNavigation(a) {
    if (!a) return false;
    const href = a.getAttribute('href');
    if (!href) return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;
    if (a.hasAttribute('download')) return false;
    if (a.target && a.target !== '_self') return false;
    // ignore pure hash links here; handled separately
    if (href.startsWith('#')) return false;
    const url = new URL(href, window.location.href);
    // ignore non-html resources
    if (url.pathname.match(/\.(pdf|zip|mp4|mp3|png|jpg|jpeg|webp|svg)$/i)) return false;
    return sameOrigin(url.href);
  }

  function setLoading(isLoading) {
    document.documentElement.classList.toggle('dt-loading', !!isLoading);
  }

  function updateActiveNav(url) {
    const u = new URL(url, window.location.href);
    const path = u.pathname.replace(/\/index\.html$/i, '/');
    document.querySelectorAll('.dt-navbar a.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (!href) return;
      let lp;
      try {
        const lu = new URL(href, window.location.href);
        lp = lu.pathname.replace(/\/index\.html$/i, '/');
      } catch { return; }
      const isActive = (lp === path) || (lp === '/' && path === '/');
      link.classList.toggle('active', isActive && !href.includes('#'));
    });
  }

  function swapMeta(doc) {
    // title
    const titleEl = doc.querySelector('title');
    if (titleEl) document.title = titleEl.textContent;

    // description
    const newDesc = doc.querySelector('meta[name="description"]');
    const curDesc = document.querySelector('meta[name="description"]');
    if (newDesc) {
      if (curDesc) curDesc.setAttribute('content', newDesc.getAttribute('content') || '');
      else document.head.appendChild(newDesc.cloneNode(true));
    }

    // canonical (if present)
    const newCanon = doc.querySelector('link[rel="canonical"]');
    const curCanon = document.querySelector('link[rel="canonical"]');
    if (newCanon) {
      if (curCanon) curCanon.setAttribute('href', newCanon.getAttribute('href') || '');
      else document.head.appendChild(newCanon.cloneNode(true));
    }
  }

  function scrollToHash(hash, behavior) {
    if (!hash) return;
    const id = hash.startsWith('#') ? hash : '#' + hash;
    const el = document.querySelector(id);
    if (!el) return;
    el.scrollIntoView({ behavior: behavior || 'smooth', block: 'start' });
  }

  function initEnhancements() {
    // lazy images
    if (window.initLazyLoad) window.initLazyLoad(document);

    // AOS
    if (window.AOS && typeof window.AOS.init === 'function') {
      // AOS watches DOM mutations, but PJAX swaps can benefit from a refresh.
      try { window.AOS.refreshHard(); } catch {}
    }

    // Masonry gallery
    if (window.Masonry) {
      const grid = document.querySelector('.grid');
      if (grid) {
        // Destroy previous instance if any
        if (grid.__dtMasonry && typeof grid.__dtMasonry.destroy === 'function') {
          grid.__dtMasonry.destroy();
        }
        grid.__dtMasonry = new window.Masonry(grid, {
          itemSelector: '.grid-item',
          percentPosition: true,
          columnWidth: '.grid-sizer'
        });
      }
    }

    // Index hero scroll blur
    const cover = document.querySelector('.parallax');
    if (cover) {
      let ticking = false;
      const update = () => {
        const h = Math.max(cover.clientHeight, 1);
        let offset = window.scrollY / h;
        if (offset < 0) offset = 0;
        if (offset > 1) offset = 1;
        document.body.style.setProperty('--scrollY', String(offset));
        ticking = false;
      };
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
      };
      window.removeEventListener('scroll', window.__dtOnScroll || (()=>{}));
      window.__dtOnScroll = onScroll;
      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    }
  }

  async function fetchAndSwap(url, { push = true } = {}) {
    const container = document.querySelector(SELECTOR_CONTAINER);
    if (!container) return;

    setLoading(true);
    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } });
      if (!res.ok) throw new Error('Fetch failed');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const next = doc.querySelector(SELECTOR_CONTAINER);
      if (!next) throw new Error('Missing container');

      // swap body data-page
      if (doc.body && doc.body.dataset && doc.body.dataset.page) {
        document.body.dataset.page = doc.body.dataset.page;
      }

      swapMeta(doc);
      container.replaceWith(next);
      updateActiveNav(url);

      if (push) {
        history.pushState({ url }, '', url);
      }

      // handle hash
      const u = new URL(url, window.location.href);
      if (u.hash) {
        // allow layout to settle
        setTimeout(() => scrollToHash(u.hash, 'auto'), 0);
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      initEnhancements();
    } catch (e) {
      // graceful fallback
      window.location.href = url;
      return;
    } finally {
      setLoading(false);
    }
  }

  function onClick(e) {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) {
      e.preventDefault();
      scrollToHash(href, 'smooth');
      return;
    }

    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isHtmlNavigation(a)) return;

    e.preventDefault();
    const url = new URL(href, window.location.href).href;
    fetchAndSwap(url, { push: true });
  }

  function onPopState(e) {
    const stateUrl = (e.state && e.state.url) ? e.state.url : window.location.href;
    fetchAndSwap(stateUrl, { push: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPopState);
    updateActiveNav(window.location.href);

    // Initialize AOS once
    if (window.AOS && typeof window.AOS.init === 'function') {
      try { window.AOS.init(); } catch {}
    }

    initEnhancements();
  });
})();
