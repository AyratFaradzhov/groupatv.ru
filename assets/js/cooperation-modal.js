/**
 * Модальное окно сотрудничества для about.html
 * Открывается при клике на кнопку "Начать сотрудничество"
 */

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('cooperationModal');
  const openButton = document.querySelector('.btn-about__cooperation');
  const overlay = document.querySelector('.cooperation-modal__overlay');
  const closeButton = document.querySelector('.cooperation-modal__close');

  if (!modal || !openButton) return;

  /**
   * Открывает модальное окно
   */
  function openModal() {
    modal.classList.add('cooperation-modal--active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Инициализируем табы после открытия модального окна
    if (window.initCooperationTabs) {
      window.initCooperationTabs();
    }
    
    // Инициализируем обработчики форм после открытия модального окна
    if (window.initFormsHandlers) {
      window.initFormsHandlers();
    }
    
    // Фокус на первую кнопку таба для доступности
    const firstTab = modal.querySelector('.cooperation__tab');
    if (firstTab) {
      firstTab.focus();
    }
  }

  /**
   * Закрывает модальное окно
   */
  function closeModal() {
    modal.classList.remove('cooperation-modal--active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    // Возвращаем фокус на кнопку открытия
    if (openButton) {
      openButton.focus();
    }
  }

  // Открытие модального окна
  openButton.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });

  // Закрытие по клику на overlay
  if (overlay) {
    overlay.addEventListener('click', closeModal);
  }

  // Закрытие по клику на кнопку закрытия
  if (closeButton) {
    closeButton.addEventListener('click', closeModal);
  }

  // Закрытие по клавише Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('cooperation-modal--active')) {
      closeModal();
    }
  });

  // Предотвращаем закрытие при клике внутри контента модального окна
  const modalContent = document.querySelector('.cooperation-modal__content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
});

