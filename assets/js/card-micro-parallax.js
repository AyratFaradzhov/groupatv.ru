/* =====================================================
   CARD MICRO-PARALLAX - Subtle image movement on swipe
   Creates depth effect without affecting text or layout
   Mobile only (≤767px), no pagination logic changes
   ===================================================== */

(() => {
  'use strict';

  // Check if mobile
  const mq = window.matchMedia('(max-width: 767px)');
  if (!mq.matches) return;

  const viewport = document.querySelector('.card__viewport');
  const items = document.querySelectorAll('.card__candy-item');
  if (!viewport || !items.length) return;

  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  const PARALLAX_FACTOR = 0.04; // 4% movement
  const SCALE_FACTOR = 1.04; // Slight scale on drag

  /**
   * Gets active slide image
   */
  function getActiveImage() {
    const activeItem = document.querySelector('.card__candy-item.is-active');
    return activeItem ? activeItem.querySelector('.card__image') : null;
  }

  /**
   * Resets image transform to default
   */
  function resetImageTransform() {
    const image = getActiveImage();
    if (image) {
      // Reset to default (will be overridden by CSS animation)
      image.style.transform = '';
    }
  }

  /**
   * Handles touch start
   */
  function handleTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    currentX = startX;
    isDragging = true;
  }

  /**
   * Handles touch move - applies parallax
   */
  function handleTouchMove(e) {
    if (!isDragging) return;

    const touch = e.touches[0];
    currentX = touch.clientX;
    const deltaX = currentX - startX;

    const image = getActiveImage();
    if (image) {
      // Apply parallax movement (4% of swipe distance)
      const parallaxX = deltaX * PARALLAX_FACTOR;
      // Slight scale for depth
      image.style.transform = `translateX(calc(-50% + ${parallaxX}px)) translateZ(0) scale(${SCALE_FACTOR})`;
    }
  }

  /**
   * Handles touch end - resets transform
   */
  function handleTouchEnd(e) {
    if (!isDragging) return;

    isDragging = false;
    resetImageTransform();
  }

  /**
   * Handles touch cancel
   */
  function handleTouchCancel(e) {
    isDragging = false;
    resetImageTransform();
  }

  /**
   * Initializes parallax handlers
   */
  function init() {
    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: true });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', handleTouchCancel, { passive: true });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
