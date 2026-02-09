/* =====================================================
   PARTNERS PAGINATION - Изолированная логика для Partners
   НЕ влияет на Popular Products pagination
   ===================================================== */

(function() {
  'use strict';

  const partnersSection = document.querySelector('.partners');
  if (!partnersSection) return;

  const viewport = partnersSection.querySelector('.partners__viewport');
  const track = partnersSection.querySelector('.partners__track');
  const items = partnersSection.querySelectorAll('.partners-item');

  const prevBtn = partnersSection.querySelector('.partners-pagination__arrow--prev');
  const nextBtn = partnersSection.querySelector('.partners-pagination__arrow--next');
  const counter = partnersSection.querySelector('.partners-pagination__counter');

  if (!viewport || !track || !items.length) return;
  if (!prevBtn || !nextBtn || !counter) return;

  const total = items.length;
  const MOBILE_BREAKPOINT = 768;
  let currentIndex = 0;

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  /**
   * Set CSS variable for viewport content width
   * This allows CSS to use exact viewport content width for card sizing
   */
  function setViewportContentWidth() {
    if (!isMobile() || !viewport) return;
    const viewportRect = viewport.getBoundingClientRect();
    const viewportStyles = window.getComputedStyle(viewport);
    const paddingLeft = parseFloat(viewportStyles.paddingLeft) || 0;
    const paddingRight = parseFloat(viewportStyles.paddingRight) || 0;
    const contentWidth = viewportRect.width - paddingLeft - paddingRight;
    viewport.style.setProperty('--viewport-content-width', contentWidth + 'px');
  }

  /**
   * Layout is now controlled by CSS flex-basis and gap.
   * This function only handles transform for animation.
   */
  function setSlidesWidthPx() {
    if (!isMobile()) {
      // Desktop: remove any inline styles
      track.style.transform = '';
      return;
    }
    // Mobile: CSS handles layout, we only need transform for animation
    // No inline width/flex styles needed
  }

  function updateCounter() {
    if (!counter) return;
    counter.textContent = String(currentIndex + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
  }

  function updateCarouselPosition() {
    if (!track || !viewport || !isMobile()) {
      track.style.transform = '';
      return;
    }
    // Calculate slide width: viewport content width (accounting for padding) + gap
    const viewportStyles = window.getComputedStyle(viewport);
    const paddingLeft = parseFloat(viewportStyles.paddingLeft) || 0;
    const paddingRight = parseFloat(viewportStyles.paddingRight) || 0;
    const contentWidth = viewport.clientWidth - paddingLeft - paddingRight;
    
    // Get gap from CSS
    const trackStyles = window.getComputedStyle(track);
    const gap = parseFloat(trackStyles.gap) || 0;
    
    // Each slide takes: contentWidth + gap
    const slideWidth = contentWidth + gap;
    const translateX = -currentIndex * slideWidth;
    track.style.transform = 'translateX(' + translateX + 'px)';
  }

  function goToPrev() {
    currentIndex = (currentIndex - 1 + total) % total;
    updateCarouselPosition();
    updateCounter();
  }

  function goToNext() {
    currentIndex = (currentIndex + 1) % total;
    updateCarouselPosition();
    updateCounter();
  }

  prevBtn.addEventListener('click', goToPrev);
  nextBtn.addEventListener('click', goToNext);

  function init() {
    setViewportContentWidth();
    setSlidesWidthPx();
    updateCarouselPosition();
    updateCounter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);
  window.addEventListener('resize', function() {
    setViewportContentWidth();
    updateCarouselPosition();
  });
})();

