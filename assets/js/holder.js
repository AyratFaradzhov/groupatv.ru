// Хранилище для отслеживания инициализированных секций
const initializedSections = new WeakSet();

const MOBILE_QUERY = "(max-width: 767px)";
const MOBILE_SUBTITLES = {
  partner: "Оставьте заявку, и мы свяжемся с вами.",
  manufacturer: "Оставьте заявку для производителя, и мы свяжемся с вами.",
};

const setMobileSubtitles = (section) => {
  if (!window.matchMedia(MOBILE_QUERY).matches) return;
  if (!section.closest(".page-collaboration")) return;

  const subtitles = section.querySelectorAll(".cooperation__subtitle");
  subtitles.forEach((subtitle) => {
    if (subtitle.dataset.i18n === "cooperation_subtitle_partner") {
      subtitle.textContent = MOBILE_SUBTITLES.partner;
    }
    if (subtitle.dataset.i18n === "cooperation_subtitle_manufacturer") {
      subtitle.textContent = MOBILE_SUBTITLES.manufacturer;
    }
  });
};

const setMobileDefaultTab = (section, tabs, panels) => {
  if (!window.matchMedia(MOBILE_QUERY).matches) return;
  if (!section.closest(".page-collaboration")) return;

  const manufacturerIndex = tabs.findIndex(
    (tab) => tab.dataset.i18n === "cooperation_tab_manufacturer"
  );
  const activeIndex = tabs.findIndex((t) =>
    t.classList.contains("cooperation__tab--active")
  );

  if (manufacturerIndex === -1 || manufacturerIndex === activeIndex) return;

  tabs[activeIndex].classList.remove("cooperation__tab--active");
  panels[activeIndex].classList.remove("cooperation__panel--active");
  tabs[manufacturerIndex].classList.add("cooperation__tab--active");
  panels[manufacturerIndex].classList.add("cooperation__panel--active");
};

/**
 * Инициализирует переключение табов в секции сотрудничества
 * Работает как на странице collaboration.html, так и в модальном окне на about.html
 */
function initCooperationTabs() {
  // Ищем все секции с табами (может быть на странице и в модалке)
  const sections = document.querySelectorAll(".cooperation__panels");
  if (!sections.length) return;
  
  sections.forEach((section) => {
    // Если секция уже инициализирована, пропускаем
    if (initializedSections.has(section)) return;

    const tabs = Array.from(section.querySelectorAll(".cooperation__tab"));
    const panels = Array.from(section.querySelectorAll(".cooperation__panel"));

    setMobileDefaultTab(section, tabs, panels);
    setMobileSubtitles(section);

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        const activeIndex = tabs.findIndex((t) =>
          t.classList.contains("cooperation__tab--active")
        );
        if (activeIndex === index) return;

        // 1) снять активные классы (старт анимации закрытия)
        tabs[activeIndex].classList.remove("cooperation__tab--active");
        panels[activeIndex].classList.remove("cooperation__panel--active");

        // 2) на следующем кадре включить новую панель (старт анимации открытия)
        requestAnimationFrame(() => {
          tab.classList.add("cooperation__tab--active");
          panels[index].classList.add("cooperation__panel--active");
          setMobileSubtitles(section);
        });
      });
    });
    
    // Помечаем секцию как инициализированную
    initializedSections.add(section);
  });
}

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  initCooperationTabs();
});

// Экспорт функции для использования в других скриптах
window.initCooperationTabs = initCooperationTabs;
