const modal = document.getElementById("certificate-modal");

const modalTitle = modal.querySelector(".modal__title");
const modalText = modal.querySelector(".modal__text");
const modalImage = modal.querySelector(".modal__image");
const modalButton = modal.querySelector(".modal__button");

// Функция для обновления текста в модальном окне
function updateModalText() {
  const i18nKey = modalText.getAttribute("data-i18n");
  if (i18nKey && typeof i18next !== 'undefined') {
    modalText.textContent = i18next.t(i18nKey);
  }
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".about-atv__cert-card");
  const close = e.target.closest(".modal__close");
  const overlay = e.target.classList.contains("modal__overlay");

  if (card) {
    modalTitle.textContent = card.dataset.title;
    modalImage.src = card.dataset.image;
    modalImage.decoding = "async";
    modalButton.href = card.dataset.pdf;

    // Используем i18next для перевода текста
    const i18nKey = card.dataset.text;
    if (i18nKey && typeof i18next !== 'undefined') {
      modalText.setAttribute("data-i18n", i18nKey);
      modalText.textContent = i18next.t(i18nKey);
    } else {
      modalText.textContent = card.dataset.text || "";
    }

    modal.classList.add("is-open");
  }

  if (close || overlay) {
    modal.classList.remove("is-open");
  }
});

// Обновляем текст модального окна при смене языка
if (typeof i18next !== 'undefined') {
  i18next.on('languageChanged', () => {
    if (modal.classList.contains("is-open")) {
      updateModalText();
    }
  });
}

// закрытие по Esc
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    modal.classList.remove("is-open");
  }
});
