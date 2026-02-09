/* =====================================================
   HERO CAROUSEL - Автоматическая прокрутка изображений
   ===================================================== */

(function() {
  'use strict';

  const carouselProducts = document.querySelector('.product__hero-carousel--products');
  const carouselBrands = document.querySelector('.product__hero-carousel--brands');
  const tabs = document.querySelectorAll('.product__tab');
  
  let currentSlideProducts = 0;
  let currentSlideBrands = 0;
  let intervalProducts = null;
  let intervalBrands = null;
  const slideDuration = 4000; // 4 секунды на слайд
  const transitionDuration = 800; // Длительность анимации в мс

  // Количество слайдов (без дубликатов)
  const totalSlidesProducts = 4;
  const totalSlidesBrands = 2;

  // Сохраняем исходный HTML трека брендов для восстановления после showBrand
  let brandsTrackDefaultHTML = null;
  function getBrandsTrackDefaultHTML() {
    if (brandsTrackDefaultHTML != null) return brandsTrackDefaultHTML;
    const track = carouselBrands && carouselBrands.querySelector('.product__hero-carousel-track');
    if (track) brandsTrackDefaultHTML = track.innerHTML;
    return brandsTrackDefaultHTML;
  }

  /**
   * Инициализирует карусель для продукции
   */
  function initProductsCarousel() {
    if (!carouselProducts) return;
    
    const track = carouselProducts.querySelector('.product__hero-carousel-track');
    if (!track) return;

    // Сбрасываем позицию
    currentSlideProducts = 0;
    updateCarouselPosition(track, currentSlideProducts, totalSlidesProducts);

    // Очищаем предыдущий интервал
    if (intervalProducts) {
      clearInterval(intervalProducts);
    }

    // Запускаем автоматическую прокрутку
    intervalProducts = setInterval(() => {
      currentSlideProducts++;
      
      // Плавно переходим к следующему слайду
      updateCarouselPosition(track, currentSlideProducts, totalSlidesProducts);
      
      // Если дошли до дубликата первого слайда, мгновенно переходим к реальному первому
      if (currentSlideProducts >= totalSlidesProducts) {
        setTimeout(() => {
          track.style.transition = 'none';
          currentSlideProducts = 0;
          updateCarouselPosition(track, currentSlideProducts, totalSlidesProducts);
          
          // Возвращаем переход для следующей анимации
          setTimeout(() => {
            track.style.transition = `transform ${transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          }, 50);
        }, transitionDuration);
      }
    }, slideDuration);
  }

  /**
   * Инициализирует карусель для брендов
   */
  function initBrandsCarousel() {
    if (!carouselBrands) return;
    
    const track = carouselBrands.querySelector('.product__hero-carousel-track');
    if (!track) return;

    // Сохраняем исходный HTML трека при первом запуске
    getBrandsTrackDefaultHTML();

    // Сбрасываем позицию
    currentSlideBrands = 0;
    updateCarouselPosition(track, currentSlideBrands, totalSlidesBrands);

    // Очищаем предыдущий интервал
    if (intervalBrands) {
      clearInterval(intervalBrands);
      intervalBrands = null;
    }

    // Запускаем автоматическую прокрутку
    intervalBrands = setInterval(() => {
      currentSlideBrands++;
      
      // Плавно переходим к следующему слайду
      updateCarouselPosition(track, currentSlideBrands, totalSlidesBrands);
      
      // Если дошли до дубликата первого слайда, мгновенно переходим к реальному первому
      if (currentSlideBrands >= totalSlidesBrands) {
        setTimeout(() => {
          track.style.transition = 'none';
          currentSlideBrands = 0;
          updateCarouselPosition(track, currentSlideBrands, totalSlidesBrands);
          
          // Возвращаем переход для следующей анимации
          setTimeout(() => {
            track.style.transition = `transform ${transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          }, 50);
        }, transitionDuration);
      }
    }, slideDuration);
  }

  /**
   * Показывает в hero-карусели брендов одно изображение выбранного бренда (центр, ширина ~474px)
   */
  function showBrandInCarousel(imgUrl, alt) {
    if (!carouselBrands) return;
    const track = carouselBrands.querySelector('.product__hero-carousel-track');
    if (!track) return;

    if (intervalBrands) {
      clearInterval(intervalBrands);
      intervalBrands = null;
    }

    var safeAlt = (alt || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var safeUrl = (imgUrl || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    carouselBrands.classList.add('product__hero-carousel--brand-selected');
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    track.innerHTML = '<div class="product__hero-carousel-slide product__hero-carousel-slide--brand-single">' +
      '<img src="' + safeUrl + '" alt="' + safeAlt + '" class="product__hero-img product__hero-img--brand-single" loading="eager" />' +
      '</div>';
  }

  /**
   * Восстанавливает hero-карусель брендов к дефолтным слайдам (brand_cover_one, brand_cover_two)
   */
  function resetBrandsCarousel() {
    if (!carouselBrands) return;
    const track = carouselBrands.querySelector('.product__hero-carousel-track');
    if (!track || !getBrandsTrackDefaultHTML()) return;

    carouselBrands.classList.remove('product__hero-carousel--brand-selected');
    track.innerHTML = brandsTrackDefaultHTML;
    track.style.transition = `transform ${transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    currentSlideBrands = 0;
    updateCarouselPosition(track, currentSlideBrands, totalSlidesBrands);

    const activeTab = document.querySelector('.product__tab--active');
    if (activeTab && activeTab.dataset.tab === 'brands') {
      initBrandsCarousel();
    }
  }

  /**
   * Обновляет позицию карусели
   */
  function updateCarouselPosition(track, slideIndex, totalSlides) {
    if (!track) return;
    const translateX = -slideIndex * 100;
    track.style.transform = `translateX(${translateX}%)`;
  }

  /**
   * Останавливает все карусели
   */
  function stopAllCarousels() {
    if (intervalProducts) {
      clearInterval(intervalProducts);
      intervalProducts = null;
    }
    if (intervalBrands) {
      clearInterval(intervalBrands);
      intervalBrands = null;
    }
  }

  /**
   * Переключает карусель в зависимости от активной вкладки
   */
  function switchCarousel(activeTab) {
    stopAllCarousels();

    if (activeTab === 'products') {
      // Показываем карусель продукции, скрываем брендов
      if (carouselProducts) {
        carouselProducts.style.display = 'block';
      }
      if (carouselBrands) {
        carouselBrands.style.display = 'none';
      }
      // Запускаем карусель продукции
      setTimeout(() => {
        initProductsCarousel();
      }, 100);
    } else if (activeTab === 'brands') {
      // Показываем карусель брендов, скрываем продукции
      if (carouselProducts) {
        carouselProducts.style.display = 'none';
      }
      if (carouselBrands) {
        carouselBrands.style.display = 'block';
      }
      // Запускаем карусель брендов
      setTimeout(() => {
        initBrandsCarousel();
      }, 100);
    }
  }

  /**
   * Инициализация при загрузке страницы
   */
  function init() {
    // Сохраняем исходный HTML трека брендов для восстановления при сбросе выбора бренда
    getBrandsTrackDefaultHTML();
    // Инициализируем карусель продукции по умолчанию
    initProductsCarousel();

    // Слушаем переключение вкладок
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabType = tab.dataset.tab;
        // Небольшая задержка для синхронизации с переключением панелей
        setTimeout(() => {
          switchCarousel(tabType);
        }, 100);
      });
    });

    // Слушаем изменения активной панели (на случай если переключение происходит через другой скрипт)
    const observer = new MutationObserver(() => {
      const activePanel = document.querySelector('.product__panel--active');
      if (activePanel) {
        const panelType = activePanel.dataset.panel;
        switchCarousel(panelType);
      }
    });

    const panelsContainer = document.querySelector('.product__panels');
    if (panelsContainer) {
      observer.observe(panelsContainer, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
      });
    }

    // Останавливаем карусели при уходе со страницы
    window.addEventListener('beforeunload', () => {
      stopAllCarousels();
    });

    // Останавливаем карусели при скрытии вкладки браузера
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAllCarousels();
      } else {
        // Возобновляем карусель активной вкладки
        const activeTab = document.querySelector('.product__tab--active');
        if (activeTab) {
          switchCarousel(activeTab.dataset.tab);
        }
      }
    });
  }

  // Запускаем при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.heroCarouselBrands = {
    showBrand: showBrandInCarousel,
    reset: resetBrandsCarousel,
    stop: stopAllCarousels
  };
})();

