// Product Page Tabs Switching (по макетам Figma: выбор «Продукция» или «Бренды»)
// Переключение заголовка, hero-карусели и контента через класс на main
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".product__tab");
  const panels = document.querySelectorAll(".product__panel");
  const main = document.getElementById("productPageMain") || document.querySelector(".product-page");
  const selectedBrandBanner = document.getElementById("productSelectedBrandBanner");

  if (!tabs.length || !panels.length) return;

  function setActiveTab(targetTab) {
    if (!main) return;
    main.classList.remove("product-page--tab-products", "product-page--tab-brands");
    main.classList.add("product-page--tab-" + targetTab);

    // Баннер выбранного бренда: скрываем при вкладке «Бренды»; при «Продукция» видимость обновит product-loader.updateBrandInfo()
    if (selectedBrandBanner) {
      if (targetTab === "brands") {
        selectedBrandBanner.classList.remove("is-visible");
        selectedBrandBanner.setAttribute("aria-hidden", "true");
      } else if (window.productLoader && typeof window.productLoader.updateBrandInfo === "function") {
        window.productLoader.updateBrandInfo();
      }
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.getAttribute("data-tab");
      const activeTab = document.querySelector(".product__tab--active");
      const activePanel = document.querySelector(".product__panel--active");

      if (activeTab === tab) return;

      activeTab.classList.remove("product__tab--active");
      activePanel.classList.remove("product__panel--active");

      requestAnimationFrame(() => {
        tab.classList.add("product__tab--active");
        const targetPanel = document.querySelector(
          `.product__panel[data-panel="${targetTab}"]`
        );
        if (targetPanel) {
          targetPanel.classList.add("product__panel--active");
        }

        setActiveTab(targetTab);

        // Обновляем breadcrumb при переключении табов
        if (window.productLoader && typeof window.productLoader.updateBreadcrumb === "function") {
          window.productLoader.updateBreadcrumb();
        }

        if (targetTab === "products" && window.productLoader && typeof window.productLoader.init === "function") {
          setTimeout(() => {
            if (!window.productLoader.initialized) {
              window.productLoader.init();
              window.productLoader.initialized = true;
            }
          }, 100);
        }
      });
    });
  });

  // Изначально активна вкладка «Продукция»
  setActiveTab("products");
});

