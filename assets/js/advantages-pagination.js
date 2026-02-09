/* =====================================================
   ADVANTAGES PAGINATION - Isolated slider logic for About page
   Reuses index carousel pattern but isolated to avoid conflicts
   ===================================================== */

(function() {
  'use strict';

  const advantagesSection = document.querySelector('.about-atv__advantages');
  if (!advantagesSection) return;

  const viewport = advantagesSection.querySelector('.about-atv__advantages-viewport');
  const track = advantagesSection.querySelector('.about-atv__advantages-track');
  const items = advantagesSection.querySelectorAll('.about-atv__advantage');
  const prevBtn = advantagesSection.querySelector('.advantages-pagination__arrow--prev');
  const nextBtn = advantagesSection.querySelector('.advantages-pagination__arrow--next');

  if (!viewport || !track || !items.length || !prevBtn || !nextBtn) return;

  const MOBILE_BREAKPOINT = 768;
  let currentIndex = 0;
  const total = items.length;

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  function updateCarouselPosition() {
    if (!isMobile() || !track || !viewport) {
      track.style.transform = '';
      return;
    }

    // Viewport width IS content width (no padding)
    const slideWidth = viewport.clientWidth;
    const translateX = -currentIndex * slideWidth;
    track.style.transform = 'translateX(' + translateX + 'px)';
  }

  function updateButtons() {
    if (!isMobile()) {
      prevBtn.disabled = false;
      nextBtn.disabled = false;
      return;
    }

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === total - 1;
  }

  function goToPrev() {
    if (!isMobile() || currentIndex === 0) return;
    currentIndex--;
    updateCarouselPosition();
    updateButtons();
  }

  function goToNext() {
    if (!isMobile() || currentIndex === total - 1) return;
    currentIndex++;
    updateCarouselPosition();
    updateButtons();
  }

  // Touch swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  function handleTouchStart(e) {
    if (!isMobile()) return;
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e) {
    if (!isMobile()) return;
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  }

  prevBtn.addEventListener('click', goToPrev);
  nextBtn.addEventListener('click', goToNext);

  if (track) {
    track.addEventListener('touchstart', handleTouchStart, { passive: true });
    track.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  function init() {
    updateCarouselPosition();
    updateButtons();
  }

  function handleResize() {
    updateCarouselPosition();
    updateButtons();
  }

  window.addEventListener('resize', handleResize);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

