const API_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:5500' 
  : window.location.origin;

function showSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    // Закрываем модальное окно сотрудничества, если оно открыто
    const cooperationModal = document.getElementById('cooperationModal');
    if (cooperationModal && cooperationModal.classList.contains('cooperation-modal--active')) {
      cooperationModal.classList.remove('cooperation-modal--active');
      cooperationModal.setAttribute('aria-hidden', 'true');
    }
    
    // Показываем success-модалку
    modal.classList.add('success-modal--active');
    document.body.style.overflow = 'hidden';
  }
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.remove('success-modal--active');
    document.body.style.overflow = '';
  }
}

function t(key) {
  if (typeof i18next !== 'undefined' && i18next.t) {
    return i18next.t(key);
  }
  const fallback = {
    form_consent_required: 'Необходимо согласиться с политикой конфиденциальности и дать согласие на обработку персональных данных',
    form_error_submit: 'Произошла ошибка при отправке заявки. Попробуйте позже.',
    form_error_network: 'Произошла ошибка при отправке заявки. Проверьте подключение к серверу.',
  };
  return fallback[key] || key;
}

function handleFormSubmit(form, endpoint) {
  return async (e) => {
    e.preventDefault();

    const consentCheckbox = form.querySelector('input[name="consent"], input[type="checkbox"]');
    if (consentCheckbox && !consentCheckbox.checked) {
      alert(t('form_consent_required'));
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    submitButton.disabled = true;
    submitButton.textContent = 'Отправка...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        form.reset();
        showSuccessModal();
      } else {
        console.error('Ошибка отправки:', result.error);
        alert(t('form_error_submit'));
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert(t('form_error_network'));
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  };
}

// Хранилище для отслеживания инициализированных форм
const initializedForms = new WeakSet();

/**
 * Инициализирует обработчики форм
 * Может быть вызвана повторно для форм в модальном окне
 */
function initFormsHandlers() {
  // Ищем формы везде - и на странице, и в модалке
  const partnerForms = document.querySelectorAll('.partner-form');
  const manufacturerForms = document.querySelectorAll('.manufacturer-form');

  partnerForms.forEach((form) => {
    if (!initializedForms.has(form)) {
      form.addEventListener('submit', handleFormSubmit(form, '/partner'));
      initializedForms.add(form);
    }
  });

  manufacturerForms.forEach((form) => {
    if (!initializedForms.has(form)) {
      form.addEventListener('submit', handleFormSubmit(form, '/manufacturer'));
      initializedForms.add(form);
    }
  });
}

// Инициализация модального окна успешной отправки
function initSuccessModal() {
  const modal = document.getElementById('successModal');
  const modalOverlay = document.querySelector('.success-modal__overlay');
  const modalCloseBtn = document.querySelector('.success-modal__close');
  const modalOkBtn = document.querySelector('.success-modal__ok');

  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeSuccessModal);
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeSuccessModal);
  }

  if (modalOkBtn) {
    modalOkBtn.addEventListener('click', closeSuccessModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('success-modal--active')) {
      closeSuccessModal();
    }
  });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  initFormsHandlers();
  initSuccessModal();
});

// Экспорт функции для использования в других скриптах
window.initFormsHandlers = initFormsHandlers;

