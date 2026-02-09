/* =====================================================
   PRODUCT SEARCH AUTOSCROLL MOBILE - UX Enhancement
   Smoothly scrolls to products grid when user starts typing
   Only on mobile (≤767px), pure UX layer
   ===================================================== */

(() => {
  'use strict';

  // Check if mobile
  const mq = window.matchMedia('(max-width: 767px)');
  if (!mq.matches) return;

  // Get DOM elements
  const input = document.getElementById('productSearchInput');
  const grid = document.getElementById('productsGrid') || document.querySelector('.product__grid');

  if (!input || !grid) return;

  let hasScrolled = false;
  let timer = null;

  /**
   * Calculates scroll offset accounting for fixed search bar
   */
  const getOffset = () => {
    const fixed = document.querySelector('.product__search-container.is-scrolled');
    if (fixed) {
      return fixed.offsetHeight + 12; // height + small gap
    }
    return 80; // fallback if search is not fixed yet
  };

  /**
   * Smoothly scrolls to products grid
   */
  const scrollToGrid = () => {
    const rect = grid.getBoundingClientRect();
    const offset = getOffset();
    
    window.scrollTo({
      top: window.scrollY + rect.top - offset,
      behavior: 'smooth',
    });
  };

  /**
   * Handles input event - triggers auto-scroll once per session
   */
  const handleInput = () => {
    // If already scrolled in this session, skip
    if (hasScrolled) return;

    // If input is empty, skip
    if (!input.value.trim()) return;

    // Debounce scroll to avoid janky behavior
    clearTimeout(timer);
    timer = setTimeout(() => {
      scrollToGrid();
      hasScrolled = true;
    }, 120);
  };

  /**
   * Resets scroll state when input is cleared or blurred
   */
  const handleBlur = () => {
    if (!input.value.trim()) {
      hasScrolled = false;
    }
  };

  /**
   * Resets scroll state when input is cleared
   */
  const handleClear = () => {
    hasScrolled = false;
  };

  // Attach event listeners
  input.addEventListener('input', handleInput, { passive: true });
  input.addEventListener('blur', handleBlur, { passive: true });

  // Listen for clear button click (if exists)
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', handleClear, { passive: true });
  }
})();
