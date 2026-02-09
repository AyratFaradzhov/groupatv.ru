/* =====================================================
   CATEGORIES ANIMATION
   Плавная автоматическая прокрутка списка категорий.
   На мобильной (≤767px): автоскролл и волновая анимация отключены,
   остаётся только ручная прокрутка пальцем.
===================================================== */

(function() {
  'use strict';

  const categoriesList = document.querySelector('.categories__list');
  if (!categoriesList) return;

  const MOBILE_BREAKPOINT = '(max-width: 767px)';
  const isMobile = () => window.matchMedia(MOBILE_BREAKPOINT).matches;

  // Состояние анимации
  let scrollPosition = 0;
  let targetPosition = 0;
  let direction = 1; // 1 = вправо, -1 = влево
  let isPaused = false;
  let animationFrameId = null;
  let lastTime = performance.now();
  
  // Параметры анимации
  const scrollSpeed = 0.5; // Скорость прокрутки (пикселей за миллисекунду)
  const easingFactor = 0.1; // Фактор плавности (0-1, чем меньше - тем плавнее)
  const pauseOnHover = true;
  const autoScrollDelay = 1000; // Задержка перед началом автоскролла
  
  // Получаем все карточки для параллакс эффекта
  let cards = [];
  
  function updateCards() {
    cards = Array.from(document.querySelectorAll('.categories__list-item'));
  }
  
  updateCards();
  
  // Функция для плавного easing (ease-in-out)
  function easeInOut(t) {
    return t < 0.5 
      ? 2 * t * t 
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Функция для синусоидального движения
  function sineWave(t, frequency = 1, amplitude = 1) {
    return Math.sin(t * frequency) * amplitude;
  }

  // Анимация карточек (параллакс эффект)
  let cardAnimationTime = 0;
  const cardAnimationSpeed = 0.005;
  
  function animateCards(currentTime) {
    if (isMobile()) return;
    const deltaTime = currentTime - lastTime;
    cardAnimationTime += deltaTime * cardAnimationSpeed;
    
    if (cards.length === 0) {
      updateCards();
    }
    
    // Применяем плавные движения к каждой карточке
    cards.forEach((card, index) => {
      if (!card) return;
      
      // Разные фазы для каждой карточки
      const phase = cardAnimationTime + (index * 0.3);
      
      // Плавные волновые движения
      const waveY = sineWave(phase, 1.0, 3); // Вертикальное покачивание
      const waveX = sineWave(phase * 0.7, 0.8, 2); // Горизонтальное покачивание
      
      // Легкий наклон
      const rotateZ = sineWave(phase * 0.6, 0.7, 1);
      
      // Легкое масштабирование (дыхание)
      const scale = 1 + sineWave(phase * 0.4, 0.5, 0.01);
      
      // Проверяем, не на hover ли родительский элемент
      const listItem = card.closest('.categories__list-item');
      const isHovered = listItem && (listItem.matches(':hover') || listItem.querySelector(':hover'));
      
      if (!isHovered) {
        card.style.transform = `translateY(${waveY.toFixed(2)}px) translateX(${waveX.toFixed(2)}px) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      }
    });
  }

  function resetCardsTransform() {
    updateCards();
    cards.forEach(function (card) {
      if (card && card.style) card.style.transform = '';
    });
  }

  // Основная функция анимации прокрутки
  function animateScroll(currentTime = performance.now()) {
    if (isMobile()) {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      resetCardsTransform();
      return;
    }

    if (isPaused) {
      animationFrameId = requestAnimationFrame(animateScroll);
      return;
    }

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    const normalizedDelta = Math.min(deltaTime, 50);
    const maxScroll = categoriesList.scrollWidth - categoriesList.clientWidth;
    
    if (maxScroll <= 0) {
      animateCards(currentTime);
      animationFrameId = requestAnimationFrame(animateScroll);
      return;
    }
    
    targetPosition += scrollSpeed * direction * normalizedDelta;
    
    if (targetPosition >= maxScroll - 5) {
      targetPosition = maxScroll;
      direction = -1;
    } else if (targetPosition <= 5) {
      targetPosition = 0;
      direction = 1;
    }
    
    const diff = targetPosition - scrollPosition;
    scrollPosition += diff * easingFactor;
    scrollPosition = Math.max(0, Math.min(maxScroll, scrollPosition));
    
    categoriesList.scrollTo({
      left: scrollPosition,
      behavior: 'auto'
    });
    
    animateCards(currentTime);
    animationFrameId = requestAnimationFrame(animateScroll);
  }

  if (pauseOnHover) {
    categoriesList.addEventListener('mouseenter', () => {
      if (!isMobile()) isPaused = true;
    });
    categoriesList.addEventListener('mouseleave', () => {
      if (!isMobile()) {
        isPaused = false;
        lastTime = performance.now();
        animateScroll();
      }
    });
  }

  // Пауза при взаимодействии пользователя
  let userInteracting = false;
  let interactionTimeout = null;

  const pauseInteraction = () => {
    if (isMobile()) return;
    userInteracting = true;
    isPaused = true;
    if (interactionTimeout) clearTimeout(interactionTimeout);
  };

  const resumeInteraction = () => {
    if (isMobile()) return;
    userInteracting = false;
    interactionTimeout = setTimeout(() => {
      isPaused = false;
      lastTime = performance.now();
      animateScroll();
    }, 2000);
  };

  categoriesList.addEventListener('mousedown', pauseInteraction);
  categoriesList.addEventListener('mouseup', resumeInteraction);
  categoriesList.addEventListener('touchstart', pauseInteraction);
  categoriesList.addEventListener('touchend', resumeInteraction);

  let initTimeoutId = null;

  function init() {
    if (isMobile()) {
      resetCardsTransform();
      if (initTimeoutId) clearTimeout(initTimeoutId);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      return;
    }
    if (initTimeoutId) clearTimeout(initTimeoutId);
    scrollPosition = 0;
    targetPosition = 0;
    direction = 1;
    cardAnimationTime = 0;
    lastTime = performance.now();
    initTimeoutId = setTimeout(() => {
      initTimeoutId = null;
      if (isMobile()) return;
      animateScroll();
    }, autoScrollDelay);
  }

  window.addEventListener('beforeunload', () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (initTimeoutId) clearTimeout(initTimeoutId);
    if (interactionTimeout) clearTimeout(interactionTimeout);
  });

  window.addEventListener('resize', () => {
    if (isMobile()) {
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
        initTimeoutId = null;
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      resetCardsTransform();
    } else {
      init();
    }
  });

  init();
})();
