/**
 * Accordion toggle for Design Support page
 */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.accordion__btn');
    if (!btn) return;

    var isExpanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !isExpanded);
  });
})();
