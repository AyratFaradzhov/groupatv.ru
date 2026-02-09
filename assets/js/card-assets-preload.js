/* =====================================================
   CARD ASSETS PRELOAD - Image & Background Preloading
   Preloads all card images and background assets
   Mobile only (≤767px), runs immediately on DOM ready
   ===================================================== */

(() => {
  'use strict';

  // Check if mobile
  const mq = window.matchMedia('(max-width: 767px)');
  if (!mq.matches) return;

  const cardSection = document.getElementById('cardSection');
  if (!cardSection) return;

  const images = document.querySelectorAll('.card__image');
  const items = document.querySelectorAll('.card__candy-item');

  /**
   * Extracts background image URL from CSS
   * Uses cardSection element to get computed style
   */
  function getBackgroundUrl(bgClass) {
    // Use existing cardSection element
    const originalClasses = cardSection.className;
    cardSection.className = `card ${bgClass}`;

    const computedStyle = window.getComputedStyle(cardSection);
    const bgImage = computedStyle.backgroundImage;

    // Restore original classes
    cardSection.className = originalClasses;

    // Extract URL from url("...") or url(...)
    const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
    return match ? match[1] : null;
  }

  /**
   * Preloads a single image
   */
  function preloadImage(url) {
    if (!url) return;

    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) {
      img.fetchPriority = 'high';
    }
    img.src = url;
  }

  /**
   * Preloads all card images
   */
  function preloadCardImages() {
    images.forEach((img) => {
      if (img.tagName === 'IMG') {
        // Force eager loading
        img.loading = 'eager';
        img.decoding = 'async';
        if ('fetchPriority' in img) {
          img.fetchPriority = 'high';
        }

        // Preload via Image object
        const src = img.src || img.getAttribute('src');
        if (src) {
          preloadImage(src);
        }

        // Handle srcset if present
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const sources = srcset.split(',').map(s => s.trim().split(' ')[0]);
          sources.forEach(preloadImage);
        }
      }
    });
  }

  /**
   * Preloads all background images
   */
  function preloadBackgroundImages() {
    // Collect unique bg classes from data-bg attributes
    const bgClasses = new Set();
    items.forEach((item) => {
      const bgClass = item.getAttribute('data-bg');
      if (bgClass) {
        bgClasses.add(bgClass);
      }
    });

    // Also check cardSection class
    const sectionBg = cardSection.className.match(/bg-\d+/);
    if (sectionBg) {
      bgClasses.add(sectionBg[0]);
    }

    // Preload each background
    bgClasses.forEach((bgClass) => {
      const bgUrl = getBackgroundUrl(bgClass);
      if (bgUrl) {
        preloadImage(bgUrl);
      }
    });
  }

  /**
   * Initializes preloading
   */
  function init() {
    // Preload card images
    preloadCardImages();

    // Preload background images
    preloadBackgroundImages();
  }

  // Initialize immediately on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready, run immediately
    init();
  }
})();
