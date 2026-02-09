/* =====================================================
   CARD TOUCH SWIPE - Swipe gesture support for slider
   Simulates pagination arrow clicks on swipe
   Mobile only (≤767px), no pagination logic changes
   ===================================================== */

(() => {
  'use strict';

  // Check if mobile
  const mq = window.matchMedia('(max-width: 767px)');
  if (!mq.matches) return;

  const viewport = document.querySelector('.card__viewport');
  if (!viewport) return;

  const nextBtn = document.querySelector('.pagination__arrow[aria-label="Next"]');
  const prevBtn = document.querySelector('.pagination__arrow[aria-label="Previous"]');

  if (!nextBtn || !prevBtn) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let endX = 0;
  let endY = 0;
  let endTime = 0;
  let isSwiping = false;
  let lastSwipeTime = 0;
  const DISTANCE_THRESHOLD = 30; // pixels
  const VELOCITY_THRESHOLD = 0.35; // px/ms
  const DEBOUNCE_TIME = 300; // milliseconds
  const MAX_VERTICAL_DELTA = 30; // prevent accidental swipes during scroll

  /**
   * Handles touch start
   */
  function handleTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
    isSwiping = true;
  }

  /**
   * Handles touch move
   */
  function handleTouchMove(e) {
    if (!isSwiping) return;

    const touch = e.touches[0];
    endX = touch.clientX;
    endY = touch.clientY;
  }

  /**
   * Handles touch end and triggers swipe action based on velocity
   */
  function handleTouchEnd(e) {
    if (!isSwiping) return;

    isSwiping = false;
    endTime = Date.now();

    const deltaX = endX - startX;
    const deltaY = Math.abs(endY - startY);
    const absDeltaX = Math.abs(deltaX);
    const deltaTime = endTime - startTime;

    // Prevent accidental swipes during vertical scroll
    if (deltaY > MAX_VERTICAL_DELTA) {
      return;
    }

    // Check debounce
    const now = Date.now();
    if (now - lastSwipeTime < DEBOUNCE_TIME) {
      return;
    }

    // Calculate velocity (px/ms)
    const velocity = deltaTime > 0 ? absDeltaX / deltaTime : 0;

    // Check if swipe meets threshold (distance OR velocity)
    const meetsDistanceThreshold = absDeltaX >= DISTANCE_THRESHOLD;
    const meetsVelocityThreshold = velocity >= VELOCITY_THRESHOLD;

    if (!meetsDistanceThreshold && !meetsVelocityThreshold) {
      return;
    }

    // Trigger pagination click
    if (deltaX > 0) {
      // Swipe right → Previous
      prevBtn.click();
      lastSwipeTime = now;
    } else {
      // Swipe left → Next
      nextBtn.click();
      lastSwipeTime = now;
    }
  }

  /**
   * Initializes swipe handlers
   */
  function init() {
    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: true });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', () => {
      isSwiping = false;
    }, { passive: true });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
