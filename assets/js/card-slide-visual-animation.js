/* =====================================================
   CARD SLIDE VISUAL ANIMATION - Mobile UX Enhancement
   Visual animation for product slider based on pagination
   Mobile only (≤767px), no pagination logic changes
   ===================================================== */

(() => {
  'use strict';

  // Check if mobile
  const mq = window.matchMedia('(max-width: 767px)');
  if (!mq.matches) return;

  const track = document.querySelector('.card__candy');
  const items = document.querySelectorAll('.card__candy-item');
  const images = document.querySelectorAll('.card__image');

  if (!track || !items.length || !images.length) return;

  /**
   * Preloads all images for instant display
   */
  function preloadImages() {
    images.forEach((img) => {
      if (img.tagName === 'IMG') {
        // Force eager loading
        img.loading = 'eager';
        img.decoding = 'async';
        if ('fetchPriority' in img) {
          img.fetchPriority = 'high';
        }

        // Pre-create Image object for preloading
        const preloadImg = new Image();
        const src = img.src || img.getAttribute('src');
        if (src) {
          preloadImg.src = src;
          // Also handle srcset if present
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            preloadImg.srcset = srcset;
          }
        }
      }
    });
  }

  /**
   * Parses translateX value from transform string
   * Example: "translateX(-100%)" -> 100
   */
  function parseTranslateX(transform) {
    if (!transform) return 0;
    const match = transform.match(/translateX\((-?\d+(?:\.\d+)?)%\)/);
    return match ? Math.abs(parseFloat(match[1])) : 0;
  }

  /**
   * Calculates active slide index from translateX percentage.
   * Track width = 100% viewport, each slide = 100% → translateX(-0%), -100%, -200%...
   */
  function getActiveIndex() {
    const transform = track.style.transform || '';
    const percent = parseTranslateX(transform);
    return Math.min(Math.round(percent / 100), items.length - 1);
  }

  /**
   * Updates active class on items based on current transform
   */
  function updateActiveClass() {
    const activeIndex = getActiveIndex();

    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add('is-active');
      } else {
        item.classList.remove('is-active');
      }
    });
  }

  /**
   * Initializes animation
   */
  function init() {
    // Preload images
    preloadImages();

    // Set initial active state
    updateActiveClass();

    // Observe track transform changes
    const observer = new MutationObserver(() => {
      updateActiveClass();
    });

    observer.observe(track, {
      attributes: true,
      attributeFilter: ['style'],
    });

    // Also listen to transition end for immediate update
    track.addEventListener('transitionend', updateActiveClass, { passive: true });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
