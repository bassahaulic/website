/**
 * SPA-style page transitions
 * Intercepts internal link clicks, fetches new page HTML,
 * and swaps only <main> content. Matrix rain, header, and
 * footer stay alive — no full page reload.
 */
(function () {
  'use strict';

  var mainEl = document.getElementById('main-content');
  if (!mainEl) return;

  // Track page-specific resources so we can clean them up
  var activePageScripts = [];
  var activePageStyles = [];

  // Global resources that should never be duplicated
  var globalScripts = [
    '/assets/js/matrix-rain.js',
    '/assets/js/nav.js',
    '/assets/js/page-transition.js'
  ];
  var globalStyles = [
    '/assets/css/variables.css',
    '/assets/css/reset.css',
    '/assets/css/global.css',
    '/assets/css/header.css',
    '/assets/css/footer.css',
    '/assets/css/components.css'
  ];

  function isInternalLink(a) {
    if (!a || !a.href) return false;
    if (a.target === '_blank') return false;
    if (a.hasAttribute('download')) return false;
    if (a.href.indexOf('mailto:') === 0) return false;
    if (a.href.indexOf('tel:') === 0) return false;
    return a.origin === location.origin;
  }

  function isGlobalResource(src, globalList) {
    return globalList.some(function (g) { return src.indexOf(g) !== -1; });
  }

  function loadPage(url, pushState) {
    mainEl.style.opacity = '0.4';
    mainEl.style.transition = 'opacity 150ms ease';

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        var newMain = doc.getElementById('main-content');
        if (!newMain) {
          location.href = url;
          return;
        }

        // Swap main content
        mainEl.innerHTML = newMain.innerHTML;

        // Update document title
        var newTitle = doc.querySelector('title');
        if (newTitle) {
          document.title = newTitle.textContent;
        }

        // Update meta description
        var newMeta = doc.querySelector('meta[name="description"]');
        var currentMeta = document.querySelector('meta[name="description"]');
        if (newMeta && currentMeta) {
          currentMeta.setAttribute('content', newMeta.getAttribute('content'));
        }

        // --- Handle page-specific CSS ---
        // Remove old page-specific styles
        activePageStyles.forEach(function (link) {
          link.parentNode.removeChild(link);
        });
        activePageStyles = [];

        // Load new page-specific styles
        var newStyles = doc.querySelectorAll('link[rel="stylesheet"]');
        newStyles.forEach(function (s) {
          var href = s.getAttribute('href');
          if (!href) return;
          if (isGlobalResource(href, globalStyles)) return;
          // Check if already loaded
          if (document.querySelector('link[href="' + href + '"]')) return;

          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          document.head.appendChild(link);
          activePageStyles.push(link);
        });

        // --- Handle page-specific JS ---
        // Remove old page-specific scripts
        activePageScripts.forEach(function (script) {
          script.parentNode.removeChild(script);
        });
        activePageScripts = [];

        // Load new page-specific scripts
        var newScripts = doc.querySelectorAll('script[src]');
        newScripts.forEach(function (s) {
          var src = s.getAttribute('src');
          if (!src) return;
          if (isGlobalResource(src, globalScripts)) return;
          if (src.indexOf('__reload') !== -1) return;

          var script = document.createElement('script');
          script.src = src;
          if (s.hasAttribute('defer')) script.defer = true;
          document.body.appendChild(script);
          activePageScripts.push(script);
        });

        // Push browser history
        if (pushState) {
          history.pushState({ spa: true }, '', url);
        }

        // Scroll to top
        window.scrollTo(0, 0);

        // Fade in
        requestAnimationFrame(function () {
          mainEl.style.opacity = '1';
        });

        // Update active nav link
        updateActiveNav(url);

        // Close mobile nav if open
        var mobileNav = document.getElementById('mobile-nav');
        var navToggle = document.querySelector('.nav-toggle');
        if (mobileNav && mobileNav.classList.contains('is-open')) {
          mobileNav.classList.remove('is-open');
          if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
      })
      .catch(function () {
        location.href = url;
      });
  }

  function updateActiveNav(url) {
    var pathname = new URL(url, location.origin).pathname;
    var links = document.querySelectorAll('.nav-desktop__link, .nav-mobile__link');
    links.forEach(function (link) {
      link.classList.remove('is-active');
      if (link.getAttribute('href') === pathname) {
        link.classList.add('is-active');
      }
    });
  }

  // Intercept clicks on internal links
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    if (!isInternalLink(a)) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    if (a.href === location.href) return;

    loadPage(a.href, true);
  });

  // Handle browser back/forward
  window.addEventListener('popstate', function () {
    loadPage(location.href, false);
  });

  // Set initial active nav
  updateActiveNav(location.href);
})();
