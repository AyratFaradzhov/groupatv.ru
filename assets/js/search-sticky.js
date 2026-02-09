/* =====================================================
   SEARCH STICKY - Закрепленный поиск с Liquid Glass эффектом
   ===================================================== */

(function() {
  'use strict';

  const searchContainer = document.querySelector('.product__search-container');
  const searchWrapper = document.querySelector('.product__search-wrapper');
  
  if (!searchContainer || !searchWrapper) return;

  let lastScrollTop = 0;
  let ticking = false;
  let initialOffsetTop = 0;
  let initialOffsetLeft = 0;
  let initialWidth = 0;
  let isFixed = false;

  /**
   * Проверяет, является ли устройство мобильным
   */
  function isMobile() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  /**
   * Получает начальную позицию элемента
   */
  function getInitialPosition() {
    const rect = searchContainer.getBoundingClientRect();
    initialOffsetTop = rect.top + window.pageYOffset;
    initialOffsetLeft = rect.left + window.pageXOffset;
    initialWidth = rect.width;
  }

  /**
   * Применяет стили для desktop
   */
  function applyDesktopStyles() {
    const windowWidth = window.innerWidth;
    const containerWidth = Math.min(1440, windowWidth - 40);
    
    searchContainer.style.position = 'fixed';
    searchContainer.style.top = '0';
    searchContainer.style.left = '50%';
    searchContainer.style.transform = 'translateX(-50%)';
    searchContainer.style.width = `${containerWidth}px`;
    searchContainer.style.maxWidth = '1440px';
    searchContainer.style.margin = '0';
    searchContainer.style.zIndex = '1000';
  }

  /**
   * Применяет стили для mobile
   */
  function applyMobileStyles() {
    searchContainer.style.position = 'fixed';
    searchContainer.style.top = '8px';
    searchContainer.style.left = '16px';
    searchContainer.style.right = '16px';
    searchContainer.style.transform = 'none';
    searchContainer.style.width = 'auto';
    searchContainer.style.maxWidth = 'none';
    searchContainer.style.margin = '0';
    searchContainer.style.zIndex = '2000';
  }

  /**
   * Очищает inline стили при возврате в нормальный поток
   */
  function clearInlineStyles() {
    searchContainer.style.position = 'sticky';
    searchContainer.style.top = '0';
    searchContainer.style.left = '';
    searchContainer.style.right = '';
    searchContainer.style.transform = '';
    searchContainer.style.width = '';
    searchContainer.style.maxWidth = '';
    searchContainer.style.margin = '';
    searchContainer.style.zIndex = '';
  }

  /**
   * Обновляет стили при скролле
   */
  function updateOnScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Если еще не получили начальную позицию, получаем её
    if (initialOffsetTop === 0) {
      getInitialPosition();
      return;
    }
    
    // Переключаем на fixed при скролле вниз
    if (scrollTop > initialOffsetTop - 20) {
      if (!isFixed) {
        isFixed = true;
        
        // Применяем стили в зависимости от устройства
        if (isMobile()) {
          applyMobileStyles();
        } else {
          applyDesktopStyles();
        }
        
        searchContainer.classList.add('is-scrolled');
      } else {
        // Обновляем стили если уже fixed (например, при resize)
        if (isMobile()) {
          applyMobileStyles();
        } else {
          applyDesktopStyles();
        }
      }
    } else {
      if (isFixed) {
        isFixed = false;
        clearInlineStyles();
        searchContainer.classList.remove('is-scrolled');
      }
    }

    // Плавное изменение blur в зависимости от скролла
    const scrollProgress = Math.min((scrollTop - initialOffsetTop + 20) / 200, 1); // От 0 до 1
    
    // Применяем динамические стили для более интенсивного эффекта при скролле
    if (scrollProgress > 0 && isFixed) {
      const blurValue = 30 + (scrollProgress * 10); // От 30px до 40px
      searchContainer.style.setProperty('--scroll-blur', `${blurValue}px`);
      searchContainer.style.backdropFilter = `blur(${blurValue}px) saturate(220%)`;
      searchContainer.style.webkitBackdropFilter = `blur(${blurValue}px) saturate(220%)`;
    } else {
      searchContainer.style.removeProperty('--scroll-blur');
      if (!isFixed) {
        searchContainer.style.backdropFilter = '';
        searchContainer.style.webkitBackdropFilter = '';
      }
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    ticking = false;
  }

  /**
   * Оптимизированный обработчик скролла
   */
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateOnScroll);
      ticking = true;
    }
  }

  // Получаем начальную позицию при загрузке
  window.addEventListener('load', () => {
    setTimeout(() => {
      getInitialPosition();
    }, 100);
  });

  // Слушаем событие скролла
  window.addEventListener('scroll', onScroll, { passive: true });

  // Инициализация при загрузке
  setTimeout(() => {
    getInitialPosition();
    updateOnScroll();
  }, 200);

  // Обновляем при изменении размера окна
  window.addEventListener('resize', () => {
    if (!isFixed) {
      getInitialPosition();
    } else {
      // Если fixed, обновляем стили в зависимости от устройства
      if (isMobile()) {
        applyMobileStyles();
      } else {
        applyDesktopStyles();
      }
    }
    updateOnScroll();
  }, { passive: true });

  // Обновляем при изменении ориентации (важно для mobile)
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (!isFixed) {
        getInitialPosition();
      } else {
        if (isMobile()) {
          applyMobileStyles();
        } else {
          applyDesktopStyles();
        }
      }
      updateOnScroll();
    }, 100);
  });
})();

// Mobile hero brand background (uses *-hover-bg)
(function() {
  if (window.innerWidth > 767) return;
  const hero = document.getElementById('productHeroBrandLogo');
  if (!hero) return;

  const setHeroBg = (url) => {
    hero.style.backgroundImage = url ? `url(${url})` : '';
  };

  const deriveHoverBg = (imgDefault) => {
    if (!imgDefault) return '';
    return imgDefault
      .replace('/products/brand_logo/', '/brand_logo/')
      .replace('.webp', '-hover-bg.webp');
  };

  const applyActiveBg = () => {
    const activeCard = document.querySelector('.product__brand-card.is-active');
    if (!activeCard) return;
    const bgHover = activeCard.dataset.bgHover || deriveHoverBg(activeCard.dataset.imgDefault);
    if (bgHover) {
      setHeroBg(bgHover);
    }
  };

  const applyFromActiveCard = () => {
    const activeCard = document.querySelector('.product__brand-card.is-active');
    if (!activeCard) {
      setHeroBg('');
      return;
    }
    const bgHover = activeCard.dataset.bgHover || deriveHoverBg(activeCard.dataset.imgDefault);
    if (bgHover) {
      setHeroBg(bgHover);
    }
  };

  document.addEventListener('click', (event) => {
    const card = event.target.closest('.product__brand-card');
    if (card) {
      const bgHover = card.dataset.bgHover || deriveHoverBg(card.dataset.imgDefault);
      if (bgHover) {
        setHeroBg(bgHover);
        return;
      }
      return;
    }
    if (
      event.target.closest('#clearBrandFilter') ||
      event.target.closest('#clearSelectedBrandBanner')
    ) {
      setHeroBg('');
    }
  }, true);

  const brandsGrid = document.getElementById('brandsGrid');
  if (brandsGrid) {
    const observer = new MutationObserver(applyFromActiveCard);
    observer.observe(brandsGrid, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  window.addEventListener('load', () => {
    applyActiveBg();
    applyFromActiveCard();
  });
})();

