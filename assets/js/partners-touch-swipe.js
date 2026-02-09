/* =====================================================
   PARTNERS TOUCH SWIPE - Swipe gesture support
   Simulates pagination arrow clicks on swipe
   Mobile only (≤767px), no pagination logic changes
   ===================================================== */

(() => {
  'use strict';

  // Check if mobile
  const mq = window.matchMedia('(max-width: 767px)');
  if (!mq.matches) return;

  const viewport = document.querySelector('.partners__viewport');
  const track = document.querySelector('.partners__track');
  if (!viewport || !track) return;

  const nextBtn = document.querySelector('.partners-pagination__arrow--next');
  const prevBtn = document.querySelector('.partners-pagination__arrow--prev');
  if (!nextBtn || !prevBtn) return;

  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let startTime = 0;
  let baseTranslateX = 0;

  const THRESHOLD = 30;      // px
  const VELOCITY = 0.3;      // px/ms

  /**
   * Gets current base translateX value from pagination
   * Returns numeric value in pixels
   */
  function getBaseTranslateX() {
    // Get transform from inline style (set by pagination)
    const inlineTransform = track.style.transform;
    if (inlineTransform) {
      const match = inlineTransform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    // Fallback: try to get from computed style
    const computed = window.getComputedStyle(track);
    const computedTransform = computed.transform;
    if (computedTransform && computedTransform !== 'none') {
      // Try to parse matrix or translateX
      const translateMatch = computedTransform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
      if (translateMatch) {
        return parseFloat(translateMatch[1]);
      }
      // If matrix, extract X translation (matrix(1, 0, 0, 1, tx, ty))
      const matrixMatch = computedTransform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
      if (matrixMatch) {
        return parseFloat(matrixMatch[1]);
      }
    }
    // Default: no translation
    return 0;
  }

  /**
   * Handles touch start
   */
  function handleTouchStart(e) {
    startX = e.touches[0].clientX;
    currentX = startX;
    startTime = performance.now();
    isDragging = true;

    // Save current translateX from pagination
    baseTranslateX = getBaseTranslateX();

    // Disable transition during drag
    track.style.transition = 'none';
  }

  /**
   * Handles touch move - applies temporary transform
   */
  function handleTouchMove(e) {
    if (!isDragging) return;

    currentX = e.touches[0].clientX;
    const delta = currentX - startX;

    // Apply temporary transform relative to base position
    track.style.transform = `translateX(${baseTranslateX + delta}px)`;
  }

  /**
   * Handles touch end - triggers pagination or resets
   */
  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const delta = currentX - startX;
    const time = performance.now() - startTime;
    const velocity = time > 0 ? Math.abs(delta) / time : 0;

    // Restore transition
    track.style.transition = 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)';

    // Reset transform (pagination will update it)
    track.style.transform = '';

    // Check if swipe meets threshold (distance OR velocity)
    const meetsDistanceThreshold = Math.abs(delta) >= THRESHOLD;
    const meetsVelocityThreshold = velocity >= VELOCITY;

    if (meetsDistanceThreshold || meetsVelocityThreshold) {
      // Trigger pagination click
      if (delta < 0) {
        // Swipe left → Next
        nextBtn.click();
      } else {
        // Swipe right → Previous
        prevBtn.click();
      }
    }
  }

  /**
   * Handles touch cancel
   */
  function handleTouchCancel() {
    if (!isDragging) return;
    isDragging = false;

    // Restore transition
    track.style.transition = 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)';
    // Reset transform
    track.style.transform = '';
  }

  /**
   * Initializes swipe handlers
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
