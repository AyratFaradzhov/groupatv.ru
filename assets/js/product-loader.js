/* =====================================================
   PRODUCT LOADER — IMPROVED VERSION
===================================================== */

/* -------------------- CONFIG -------------------- */

const CONFIG = {
  brandsLimit: 9,
  hoverToActiveMs: 5000,
  clickDelayMs: 500,
};

/* -------------------- STATE -------------------- */

const state = {
  products: [],
  categories: {},
  brands: [],
  filteredProducts: [],
  currentLanguage: "ru",
  currentBrand: null,
  currentCategory: null,
  activeBrandCard: null,
  // Фильтры подкатегорий
  currentWeight: null,
  currentFlavor: null,
  currentForm: null,
  // Сортировка: null = порядок из JSON, "popularity" = по popularityIndex, "alphabet" = по названию
  currentSortOrder: null,
};

// Map для хранения таймеров по карточкам
const brandCardTimers = new Map();

/* -------------------- HELPERS -------------------- */

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Строгая нормализация бренда: trim, uppercase, убрать пробелы и дефисы
 * PANDA LEE === panda-lee === PandaLee === PANDA-LEE → PANDALEE
 * Tayaş → TAYAS (убираем турецкие символы)
 */
function normalizeBrand(value = "") {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "") // Убираем пробелы
    .replace(/-/g, "") // Убираем дефисы
    .replace(/Ş/g, "S") // Турецкая Ş → S
    .replace(/ş/g, "S")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "G")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "O")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "U");
}

function getProductName(product) {
  return state.currentLanguage === "ru"
    ? product.nameRu || product.name
    : product.nameEn || product.name;
}

function getCategoryName(categoryId) {
  const category = state.categories[categoryId];
  if (!category) return categoryId;
  return state.currentLanguage === "ru" ? category.nameRu : category.nameEn;
}

/* -------------------- DATA LOADING -------------------- */

async function loadProductsData() {
  try {
    const res = await fetch("data/products.json");
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();

    state.products = data.products || [];
    state.categories = data.categories || {};
    state.brands = data.brands || [];

    return true;
  } catch (err) {
    console.error("Ошибка загрузки данных:", err);
    showFallbackError();
    return false;
  }
}

/**
 * Показывает fallback сообщение об ошибке в DOM
 */
function showFallbackError() {
  const productsGrid = qs("#productsGrid");
  const brandsGrid = qs("#brandsGrid");

  const errorMessage = state.currentLanguage === "ru"
    ? "Не удалось загрузить данные. Пожалуйста, обновите страницу."
    : "Failed to load data. Please refresh the page.";

  if (productsGrid) {
    productsGrid.innerHTML = `
      <div class="product__no-results">
        <p>${errorMessage}</p>
      </div>
    `;
  }

  if (brandsGrid) {
    brandsGrid.innerHTML = `
      <div class="product__no-results">
        <p>${errorMessage}</p>
      </div>
    `;
  }
}

/* -------------------- PRODUCTS -------------------- */

/**
 * Сокращает длинное название товара для карточки
 */
function shortenProductName(name, maxLength = 60) {
  if (!name || name.length <= maxLength) return name;
  // Пытаемся обрезать по словам
  const words = name.split(" ");
  let shortened = "";
  for (const word of words) {
    if ((shortened + " " + word).length > maxLength) break;
    shortened += (shortened ? " " : "") + word;
  }
  return shortened ? shortened + "..." : name.substring(0, maxLength - 3) + "...";
}

function createProductCard(product) {
  const name = getProductName(product);
  const shortName = shortenProductName(name, 50); // Максимум 50 символов для карточки
  const detailsText = state.currentLanguage === "ru" ? "Подробнее" : "More details";
  const isRu = state.currentLanguage === "ru";
  
  // Получаем название формы товара
  let formName = "";
  if (product.type) {
    const typeNames = {
      // Бисквитное пирожное
      "biscuits": isRu ? "Бисквитные палочки" : "Biscuit sticks",
      "donuts": isRu ? "Пончики" : "Donuts",
      "bars": isRu ? "Батончики" : "Bars",
      "sticks": isRu ? "Палочки" : "Sticks",
      "cupcake": isRu ? "Кекс" : "Cupcake",
      // Карамель
      "caramel": isRu ? "Карамель" : "Caramel",
      "lollipops": isRu ? "Леденцы" : "Lollipops",
      "lokum": isRu ? "Лукум" : "Lokum",
      // Конфеты
      "candies": isRu ? "Жевательные конфеты" : "Chewy candies",
      "marshmallow": isRu ? "Сбивные конфеты" : "Marshmallow candies",
      "dragee": isRu ? "Драже" : "Dragee",
      "chocolate_candies": isRu ? "Шоколадные конфеты" : "Chocolate candies",
      // Мармелад
      "belts": isRu ? "Ремешки" : "Belts",
      "pencils": isRu ? "Карандаши" : "Pencils",
      "bears": isRu ? "Мишки" : "Bears",
      "figurative": isRu ? "Фигурные" : "Figurative",
      "marmalade": isRu ? "Мармелад (общее)" : "Marmalade (general)",
      // Маршмеллоу
      "marshmallows": isRu ? "Маршмеллоу (общее)" : "Marshmallows (general)",
      "tubes": isRu ? "Трубочки" : "Tubes",
      // Шоколад
      "chocolate": isRu ? "Молочный шоколад" : "Milk chocolate",
      "white-chocolate": isRu ? "Белый шоколад" : "White chocolate",
      "dark-chocolate": isRu ? "Темный шоколад" : "Dark chocolate",
      "dubai-chocolate": isRu ? "Дубайский шоколад" : "Dubai chocolate",
      // Вафли
      "wafer_sticks": isRu ? "Вафельные палочки" : "Wafer sticks",
      "waffles": isRu ? "Вафли (общее)" : "Waffles (general)",
      // Желе
      "jelly-desserts": isRu ? "Желейные десерты" : "Jelly desserts",
      "jelly_pudding": isRu ? "Желе-пудинг" : "Jelly pudding",
      "drinkable_jelly": isRu ? "Питьевое желе" : "Drinkable jelly",
      "jelly_sticks": isRu ? "Желе в стиках" : "Jelly sticks",
      "jelly_cups": isRu ? "Желе в стаканчиках" : "Jelly cups",
      "jelly_cans": isRu ? "Желе в банках" : "Jelly cans",
      "jelly_pieces": isRu ? "Желе кусочками" : "Jelly pieces",
      "jelly_figures": isRu ? "Фигурное желе" : "Figurative jelly",
    };
    formName = typeNames[product.type] || product.type;
  }
  
  return `
    <div class="product__item"
         data-id="${product.id}"
         data-brand="${normalizeBrand(product.brand)}"
         data-category="${product.category}"
         data-weight="${product.weight || ''}"
         data-flavor="${product.flavors ? product.flavors.join(',') : ''}"
         data-form="${product.type || ''}">
      <div class="product__item-image-wrapper">
        <img src="${product.image}" alt="${name}" loading="lazy" />
      </div>
      <h3 class="product__item-title" title="${name}">${shortName}</h3>
      ${formName ? `<div class="product__item-form">${formName}</div>` : ''}
      <button class="product__item-button" data-product-id="${product.id}">
        <span>${detailsText}</span>
        <span class="product__item-button-icon">
          <img src="images/arrow.svg" alt="стрелка вправо" class="product__button-img">
        </span>
      </button>
    </div>
  `;
}

function renderProducts(products) {
  const grid = qs("#productsGrid");
  const categoriesGrid = qs("#categoriesGrid");
  
  if (!grid) {
    console.warn("⚠ #productsGrid не найден в DOM");
    return;
  }
  
  // Показываем грид товаров
  grid.style.display = "grid";
  
  // Если выбрана категория, скрываем сетку категорий
  if (categoriesGrid) {
    if (state.currentCategory) {
      categoriesGrid.style.display = "none";
    } else {
      categoriesGrid.style.display = "grid";
    }
  }

  updateResultsCount(products.length);

  if (!products.length) {
    grid.innerHTML = `
      <div class="product__no-results">
        <p>${
          state.currentLanguage === "ru"
            ? "Товары не найдены"
            : "No products found"
        }</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(createProductCard).join("");
  animateItems(grid, ".product__item");
  
  // Показываем фильтр подкатегорий если выбрана категория
  renderSubcategories();
  
  // Инициализируем обработчики для кнопок "Подробнее"
  initProductModalHandlers();
}

/* -------------------- MODAL -------------------- */

function initProductModalHandlers() {
  // Обработчики для кнопок "Подробнее"
  qsa(".product__item-button").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const productId = button.getAttribute("data-product-id");
      if (productId) {
        openProductModal(productId);
      }
    });
  });

  // Обработчик для закрытия модального окна
  const closeBtn = qs("#productModalClose");
  const modal = qs("#productModal");
  const overlay = qs(".product-modal__overlay");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeProductModal);
  }

  if (overlay) {
    overlay.addEventListener("click", closeProductModal);
  }

  // Закрытие по Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeProductModal();
    }
  });
}

/**
 * Сокращает длинные пути к изображениям для отображения
 */
function shortenImagePath(imagePath) {
  if (!imagePath) return "";
  // Если путь содержит foods_normalized_v2, оставляем только последнюю часть
  if (imagePath.includes("foods_normalized_v2")) {
    const parts = imagePath.split("/");
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    // Возвращаем последние 2 части пути
    return secondLastPart ? `${secondLastPart}/${lastPart}` : lastPart;
  }
  // Если путь короче 50 символов, возвращаем как есть
  if (imagePath.length <= 50) return imagePath;
  // Иначе берем последние 50 символов
  return "..." + imagePath.slice(-50);
}

function openProductModal(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  const modal = qs("#productModal");
  const content = qs("#productModalContent");
  if (!modal || !content) return;

  const name = getProductName(product);
  const categoryName = getCategoryName(product.category);
  const isRu = state.currentLanguage === "ru";

  // Формируем контент модального окна
  let modalHTML = `
    <div class="product-modal__header">
      <div class="product-modal__image-wrapper">
        <img src="${product.image}" alt="${name}" class="product-modal__image" />
      </div>
      <div class="product-modal__header-info">
        <h2 class="product-modal__title">${name}</h2>
        <div class="product-modal__basic-info">
  `;

  // SKU
  if (product.sku) {
    modalHTML += `
      <div class="product-modal__info-item">
        <span class="product-modal__info-label">${isRu ? "Артикул" : "SKU"}</span>
        <span class="product-modal__info-value">${product.sku}</span>
      </div>
    `;
  }

  // Бренд
  if (product.brand) {
    modalHTML += `
      <div class="product-modal__info-item">
        <span class="product-modal__info-label">${isRu ? "Бренд" : "Brand"}</span>
        <span class="product-modal__info-value">${product.brand}</span>
      </div>
    `;
  }

  // Категория
  if (categoryName) {
    modalHTML += `
      <div class="product-modal__info-item">
        <span class="product-modal__info-label">${isRu ? "Категория" : "Category"}</span>
        <span class="product-modal__info-value">${categoryName}</span>
      </div>
    `;
  }

  // Вес
  if (product.weight) {
    modalHTML += `
      <div class="product-modal__info-item">
        <span class="product-modal__info-label">${isRu ? "Вес" : "Weight"}</span>
        <span class="product-modal__info-value">${product.weight}</span>
      </div>
    `;
  }

  // Тип/Форма
  if (product.type) {
    const typeNames = {
      // Бисквитное пирожное
      "biscuits": isRu ? "Бисквитные палочки" : "Biscuit sticks",
      "donuts": isRu ? "Пончики" : "Donuts",
      "bars": isRu ? "Батончики" : "Bars",
      "sticks": isRu ? "Палочки" : "Sticks",
      "cupcake": isRu ? "Кекс" : "Cupcake",
      // Карамель
      "caramel": isRu ? "Карамель" : "Caramel",
      "lollipops": isRu ? "Леденцы" : "Lollipops",
      "lokum": isRu ? "Лукум" : "Lokum",
      // Конфеты
      "candies": isRu ? "Жевательные конфеты" : "Chewy candies",
      "marshmallow": isRu ? "Сбивные конфеты" : "Marshmallow candies",
      "dragee": isRu ? "Драже" : "Dragee",
      "chocolate_candies": isRu ? "Шоколадные конфеты" : "Chocolate candies",
      // Мармелад
      "belts": isRu ? "Ремешки" : "Belts",
      "pencils": isRu ? "Карандаши" : "Pencils",
      "bears": isRu ? "Мишки" : "Bears",
      "figurative": isRu ? "Фигурные" : "Figurative",
      "marmalade": isRu ? "Мармелад (общее)" : "Marmalade (general)",
      // Маршмеллоу
      "marshmallows": isRu ? "Маршмеллоу (общее)" : "Marshmallows (general)",
      "tubes": isRu ? "Трубочки" : "Tubes",
      // Шоколад
      "chocolate": isRu ? "Молочный шоколад" : "Milk chocolate",
      "white-chocolate": isRu ? "Белый шоколад" : "White chocolate",
      "dark-chocolate": isRu ? "Темный шоколад" : "Dark chocolate",
      "dubai-chocolate": isRu ? "Дубайский шоколад" : "Dubai chocolate",
      // Вафли
      "wafer_sticks": isRu ? "Вафельные палочки" : "Wafer sticks",
      "waffles": isRu ? "Вафли (общее)" : "Waffles (general)",
      // Желе
      "jelly-desserts": isRu ? "Желейные десерты" : "Jelly desserts",
      "jelly_pudding": isRu ? "Желе-пудинг" : "Jelly pudding",
      "drinkable_jelly": isRu ? "Питьевое желе" : "Drinkable jelly",
      "jelly_sticks": isRu ? "Желе в стиках" : "Jelly sticks",
      "jelly_cups": isRu ? "Желе в стаканчиках" : "Jelly cups",
      "jelly_cans": isRu ? "Желе в банках" : "Jelly cans",
      "jelly_pieces": isRu ? "Желе кусочками" : "Jelly pieces",
      "jelly_figures": isRu ? "Фигурное желе" : "Figurative jelly",
    };
    modalHTML += `
      <div class="product-modal__info-item">
        <span class="product-modal__info-label">${isRu ? "Форма" : "Shape"}</span>
        <span class="product-modal__info-value">${typeNames[product.type] || product.type}</span>
      </div>
    `;
  }

  // Вкусы
  if (product.flavors && product.flavors.length > 0) {
    modalHTML += `
      <div class="product-modal__info-item">
        <span class="product-modal__info-label">${isRu ? "Вкус" : "Flavor"}</span>
        <span class="product-modal__info-value">${product.flavors.join(", ")}</span>
      </div>
    `;
  }

  modalHTML += `
        </div>
      </div>
    </div>
  `;

  // Описание
  if (product.description) {
    modalHTML += `
      <div class="product-modal__section">
        <h3 class="product-modal__section-title">${isRu ? "Описание" : "Description"}</h3>
        <div class="product-modal__section-content">
          <p class="product-modal__text">${product.description}</p>
        </div>
      </div>
    `;
  }

  // Состав
  if (product.composition) {
    modalHTML += `
      <div class="product-modal__section">
        <h3 class="product-modal__section-title">${isRu ? "Состав" : "Composition"}</h3>
        <div class="product-modal__section-content">
          <p class="product-modal__text">${product.composition}</p>
        </div>
      </div>
    `;
  }

  // Пищевая ценность
  if (product.nutrition && (product.nutrition.kcal || product.nutrition.protein || product.nutrition.fat || product.nutrition.carb)) {
    modalHTML += `
      <div class="product-modal__section">
        <h3 class="product-modal__section-title">${isRu ? "Пищевая ценность" : "Nutrition"}</h3>
        <div class="product-modal__section-content">
          <div class="product-modal__nutrition">
    `;
    
    if (product.nutrition.kcal) {
      modalHTML += `
        <div class="product-modal__nutrition-item">
          <span class="product-modal__nutrition-label">${isRu ? "Калории" : "Calories"}</span>
          <span class="product-modal__nutrition-value">${product.nutrition.kcal}</span>
        </div>
      `;
    }
    
    if (product.nutrition.protein) {
      modalHTML += `
        <div class="product-modal__nutrition-item">
          <span class="product-modal__nutrition-label">${isRu ? "Белки" : "Protein"}</span>
          <span class="product-modal__nutrition-value">${product.nutrition.protein}</span>
        </div>
      `;
    }
    
    if (product.nutrition.fat) {
      modalHTML += `
        <div class="product-modal__nutrition-item">
          <span class="product-modal__nutrition-label">${isRu ? "Жиры" : "Fat"}</span>
          <span class="product-modal__nutrition-value">${product.nutrition.fat}</span>
        </div>
      `;
    }
    
    if (product.nutrition.carb) {
      modalHTML += `
        <div class="product-modal__nutrition-item">
          <span class="product-modal__nutrition-label">${isRu ? "Углеводы" : "Carbs"}</span>
          <span class="product-modal__nutrition-value">${product.nutrition.carb}</span>
        </div>
      `;
    }
    
    modalHTML += `
          </div>
        </div>
      </div>
    `;
  }

  // Теги
  if (product.tags && product.tags.length > 0) {
    modalHTML += `
      <div class="product-modal__section">
        <h3 class="product-modal__section-title">${isRu ? "Теги" : "Tags"}</h3>
        <div class="product-modal__tags">
          ${product.tags.slice(0, 15).map(tag => `<span class="product-modal__tag">${tag}</span>`).join("")}
        </div>
      </div>
    `;
  }

  content.innerHTML = modalHTML;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  const modal = qs("#productModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

function animateItems(container, selector) {
  qsa(selector, container).forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    setTimeout(() => {
      el.style.transition = "0.3s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, i * 50);
  });
}

/* -------------------- FILTERING -------------------- */

/**
 * Улучшенная фильтрация товаров с учетом всех новых полей
 */
function filterProducts() {
  const searchInput = qs("#productSearchInput");
  const search = searchInput?.value.toLowerCase().trim() || "";

  state.filteredProducts = state.products.filter((p) => {
    // 1. Фильтр по бренду (строгая нормализация)
    const productBrand = normalizeBrand(p.brand);
    const matchesBrand =
      !state.currentBrand || productBrand === state.currentBrand;

    // 2. Фильтр по категории
    const matchesCategory =
      !state.currentCategory || p.category === state.currentCategory;

    // 3. Фильтр по весу
    const matchesWeight =
      !state.currentWeight || p.weight === state.currentWeight;

    // 4. Фильтр по вкусу
    const matchesFlavor =
      !state.currentFlavor || 
      (p.flavors && p.flavors.some(flavor => 
        flavor.toLowerCase().includes(state.currentFlavor.toLowerCase())
      ));

    // 5. Фильтр по форме (type)
    const matchesForm =
      !state.currentForm || p.type === state.currentForm;

    // 6. Поиск по тексту (расширенный)
    let matchesSearch = true;
    if (search) {
      // Собираем все текстовые данные для поиска
      const searchText = [
        // Названия
        p.nameRu || "",
        p.nameEn || "",
        p.name || "",
        // Бренд (нормализованный и оригинальный)
        productBrand,
        productBrand.toLowerCase(),
        p.brand || "",
        // Категория
        getCategoryName(p.category),
        p.category || "",
        // Новые поля
        p.type || "",
        p.weight || "",
        p.sku || "",
        // Описание и состав
        p.description || "",
        p.composition || "",
        // Вкусы (RU + EN)
        ...(p.flavors || []),
        // Теги (уже включают много информации)
        ...(p.tags || []),
      ]
        .filter(Boolean) // Убираем пустые значения
        .join(" ")
        .toLowerCase();

      // Поиск в тексте
      matchesSearch = searchText.includes(search);
    }

    return matchesBrand && matchesCategory && matchesWeight && matchesFlavor && matchesForm && matchesSearch;
  });

  // Сортировка: по популярности (невидимое поле popularityIndex) или по алфавиту
  if (state.currentSortOrder === "popularity") {
    state.filteredProducts = [...state.filteredProducts].sort((a, b) => {
      const ia = a.popularityIndex != null ? Number(a.popularityIndex) : 1e9;
      const ib = b.popularityIndex != null ? Number(b.popularityIndex) : 1e9;
      return ia - ib;
    });
  } else if (state.currentSortOrder === "alphabet") {
    const locale = state.currentLanguage === "ru" ? "ru" : "en";
    const getName = (p) => (p.nameRu || p.name || p.nameEn || "").trim().toLowerCase();
    state.filteredProducts = [...state.filteredProducts].sort((a, b) =>
      getName(a).localeCompare(getName(b), locale)
    );
  }

  // Всегда показываем товары (все товары если категория не выбрана)
  renderProducts(state.filteredProducts);
  
  // Обновляем визуальное выделение активной категории в сетке
  updateActiveCategoryInGrid();
  
  updateBrandInfo();
}

/**
 * Обновляет визуальное выделение активной категории в сетке
 */
function updateActiveCategoryInGrid() {
  const categoriesGrid = qs("#categoriesGrid");
  if (!categoriesGrid) return;
  
  // Убираем активный класс со всех карточек
  qsa(".product__category-card", categoriesGrid).forEach(card => {
    card.classList.remove("is-active");
  });
  
  // Добавляем активный класс на выбранную категорию
  if (state.currentCategory) {
    const activeCard = qs(`[data-category-id="${state.currentCategory}"]`, categoriesGrid);
    if (activeCard) {
      activeCard.classList.add("is-active");
    }
  }
}

function updateResultsCount(count) {
  const el = qs("#resultsCount");
  if (!el) return;

  if (!count) {
    el.style.display = "none";
    return;
  }

  el.style.display = "block";
  el.textContent =
    state.currentLanguage === "ru" ? `Найдено: ${count}` : `Found: ${count}`;
}

/* -------------------- BRANDS -------------------- */

/**
 * Создание карточки бренда.
 * Hover: контент — *-hover, фон — *-hover-bg (по макету).
 */
function createBrandCard(brand) {
  const bgDefault = brand.logoBg || brand.logo;
  const bgHover = brand.logoHoverBg || brand.logoHover || brand.logo;
  const bgActive = brand.logoActive || brand.logoHover || brand.logo;
  const imgDefault = brand.logo;
  const imgHover = brand.logoHover || brand.logo;

  return `
    <div class="product__brand-card"
         data-brand="${normalizeBrand(brand.name)}"
         data-bg-default="${bgDefault}"
         data-bg-hover="${bgHover}"
         data-bg-active="${bgActive}"
         data-img-default="${imgDefault}"
         data-img-hover="${imgHover}">

      <div class="product__brand-bg"></div>

      <img
        class="product__brand-img"
        src="${imgDefault}"
        alt="${brand.name}"
        loading="lazy"
        draggable="false"
      />
    </div>
  `;
}

/**
 * Рендер брендов (максимум CONFIG.brandsLimit)
 */
function renderBrands() {
  const grid = qs("#brandsGrid");
  if (!grid) {
    console.warn("⚠ #brandsGrid не найден в DOM");
    return;
  }

  // Очищаем все таймеры перед перерендером
  brandCardTimers.forEach((timer) => clearTimeout(timer));
  brandCardTimers.clear();

  const brands = state.brands.slice(0, CONFIG.brandsLimit);

  if (!brands.length) {
    grid.innerHTML = `
      <div class="product__no-results">
        <p>${
          state.currentLanguage === "ru"
            ? "Бренды не найдены"
            : "No brands found"
        }</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = brands.map(createBrandCard).join("");
  initBrandInteractions();
}

/**
 * Инициализация взаимодействий с карточками брендов
 */
function initBrandInteractions() {
  qsa(".product__brand-card").forEach((card) => {
    const bg = qs(".product__brand-bg", card);
    const img = qs(".product__brand-img", card);

    if (!bg || !img) {
      console.warn("⚠ Не найдены .product__brand-bg или .product__brand-img в карточке бренда");
      return;
    }

    const bgDefault = card.dataset.bgDefault;
    const bgHover = card.dataset.bgHover;
    const bgActive = card.dataset.bgActive;
    const imgDefault = card.dataset.imgDefault;
    const imgHover = card.dataset.imgHover;

    // Начальное состояние: дефолтный фон и логотип
    bg.style.backgroundImage = `url(${bgDefault})`;
    if (img && imgDefault) img.src = imgDefault;
    card.classList.remove("is-hover", "is-active", "is-hover-active");

    // Очищаем предыдущий таймер для этой карточки, если есть
    const existingTimer = brandCardTimers.get(card);
    if (existingTimer) {
      clearTimeout(existingTimer);
      brandCardTimers.delete(card);
    }

    /* ---------- HOVER: контент — *-hover, фон — *-hover-bg ---------- */
    card.addEventListener("mouseenter", () => {
      if (state.activeBrandCard === card) return;

      bg.style.backgroundImage = `url(${bgHover})`;
      if (img && imgHover) img.src = imgHover;
      card.classList.add("is-hover");
      card.classList.remove("is-hover-active");

      const timer = setTimeout(() => {
        if (state.activeBrandCard !== card && card.classList.contains("is-hover")) {
          bg.style.backgroundImage = `url(${bgActive})`;
          card.classList.add("is-hover-active");
        }
      }, CONFIG.hoverToActiveMs);
      brandCardTimers.set(card, timer);
    });

    /* ---------- LEAVE: возврат к дефолту ---------- */
    card.addEventListener("mouseleave", () => {
      if (state.activeBrandCard === card) return;

      const timer = brandCardTimers.get(card);
      if (timer) {
        clearTimeout(timer);
        brandCardTimers.delete(card);
      }

      bg.style.backgroundImage = `url(${bgDefault})`;
      if (img && imgDefault) img.src = imgDefault;
      card.classList.remove("is-hover", "is-hover-active");
    });

    /* ---------- CLICK / ACTIVE ---------- */
    card.addEventListener("click", () => {
      // Если карточка уже активна, ничего не делаем
      if (state.activeBrandCard === card) return;

      // Очищаем таймер
      const timer = brandCardTimers.get(card);
      if (timer) {
        clearTimeout(timer);
        brandCardTimers.delete(card);
      }

      // Сброс предыдущего активного (фон и контент — дефолт)
      if (state.activeBrandCard) {
        const prev = state.activeBrandCard;
        const prevBg = qs(".product__brand-bg", prev);
        const prevImg = qs(".product__brand-img", prev);
        const prevTimer = brandCardTimers.get(prev);
        if (prevTimer) {
          clearTimeout(prevTimer);
          brandCardTimers.delete(prev);
        }

        prev.classList.remove("is-active", "is-hover", "is-hover-active");
        if (prevBg && prev.dataset.bgDefault) prevBg.style.backgroundImage = `url(${prev.dataset.bgDefault})`;
        if (prevImg && prev.dataset.imgDefault) prevImg.src = prev.dataset.imgDefault;
      }

      // Устанавливаем новый активный: фон — active, контент — hover-изображение
      state.activeBrandCard = card;
      state.currentBrand = card.dataset.brand;

      card.classList.add("is-active");
      card.classList.remove("is-hover", "is-hover-active");
      bg.style.backgroundImage = `url(${bgActive})`;
      if (img && imgHover) img.src = imgHover;

      // Hero: карусели выключены, показывается только логотип бренда (Figma)
      updateBrandInfo();

      // Задержка перед переключением на вкладку products и фильтрацией
      setTimeout(() => {
        switchToProductsTab();
        filterProducts();
      }, CONFIG.clickDelayMs);
    });
  });
}

/* -------------------- CATEGORY FILTERS -------------------- */

/**
 * Рендерит категории в виде грид сетки по макетам Figma
 * Карточки разных размеров: большие (668px) и маленькие (322px)
 */
function renderCategoriesGrid() {
  const categoriesGrid = qs("#categoriesGrid");
  const productsGrid = qs("#productsGrid");
  
  if (!categoriesGrid) {
    console.warn("⚠ #categoriesGrid не найден в DOM");
    return;
  }
  
  // Показываем грид категорий, скрываем грид товаров
  categoriesGrid.style.display = "grid";
  if (productsGrid) {
    productsGrid.style.display = "none";
  }
  
  const isRu = state.currentLanguage === "ru";
  
  // Определяем порядок категорий согласно макетам Figma
  const categoryOrder = [
    "marshmallows",  // 1. Маршмеллоу
    "marmalade",     // 2. Мармелад
    "candy",         // 3. Конфеты
    "caramel",       // 4. Карамель
    "sponge cake",   // 5. Бисквитное пирожное
    "waffles",       // 6. Вафли
    "jelly",         // 7. Желе
    "chocolate"      // 8. Шоколад
  ];
  
  // Получаем категории в правильном порядке
  const categories = categoryOrder
    .map(id => state.categories[id])
    .filter(category => category !== undefined);
  
  if (categories.length === 0) {
    categoriesGrid.innerHTML = `
      <div class="product__no-results">
        <p>${isRu ? "Категории не найдены" : "No categories found"}</p>
      </div>
    `;
    return;
  }
  
  // Подсчитываем количество товаров в каждой категории
  const categoryCounts = {};
  state.products.forEach(product => {
    if (product.category) {
      categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    }
  });
  
  // Маппинг категорий к их размерам и изображениям согласно Figma
  const categoryConfig = {
    "marmalade": {
      size: "large-tall", // 668x564px
      bgImage: "assets/images/categories/background/marmalade-bg.webp",
      titleImage: "assets/images/categories/background/marmalade-title.webp"
    },
    "marshmallows": {
      size: "large-wide", // 668x270px
      bgImage: "assets/images/categories/background/marshmallows-bg.webp",
      titleImage: "assets/images/categories/background/marshmallows-title.webp"
    },
    "caramel": {
      size: "small", // 322x270px
      bgImage: "assets/images/categories/background/caramel-bg.webp",
      titleImage: "assets/images/categories/background/caramel-title.webp"
    },
    "candy": {
      size: "small", // 322x270px
      bgImage: "assets/images/categories/background/candy-bg.webp",
      titleImage: "assets/images/categories/background/candy-title.webp"
    },
    "sponge cake": {
      size: "large-tall", // 668x564px
      bgImage: "assets/images/categories/background/sponge-cake-bg.webp",
      titleImage: "assets/images/categories/background/sponge-cake-title.webp"
    },
    "waffles": {
      size: "large-wide", // 668x270px
      bgImage: "assets/images/categories/background/waffles-bg.webp",
      titleImage: "assets/images/categories/background/waffles-title.webp"
    },
    "jelly": {
      size: "small", // 322x270px
      bgImage: "assets/images/categories/background/jelly-bg.webp",
      titleImage: "assets/images/categories/background/jelly-title.webp"
    },
    "chocolate": {
      size: "small", // 322x270px
      bgImage: "assets/images/categories/background/chocolate-bg.webp",
      titleImage: "assets/images/categories/background/chocolate-title.webp"
    }
  };
  
  categoriesGrid.innerHTML = categories.map(category => {
    const count = categoryCounts[category.id] || 0;
    const name = isRu ? category.nameRu : category.nameEn;
    const config = categoryConfig[category.id] || {
      size: "small",
      bgImage: "assets/images/categories/background-categories.png",
      titleImage: null
    };
    
    // Определяем класс размера
    const sizeClass = `product__category-card--${config.size}`;
    
    // Определяем стили для titleImage с точными размерами из макетов
    let titleStyle = '';
    if (config.titleImage) {
      // Точные размеры titleImage для каждой категории
      const titleSizes = {
        "marshmallows": { width: "520px", height: "160px" },
        "marmalade": { width: "484px", height: "159px" },
        "candy": { width: "265px", height: "96px" },
        "caramel": { width: "288px", height: "72px" },
        "sponge cake": { width: "499px", height: "190px" },
        "waffles": { width: "420px", height: "147px" },
        "jelly": { width: "265px", height: "75px" },
        "chocolate": { width: "269px", height: "78px" }
      };
      
      const titlePos = titleSizes[category.id] || { width: "218px", height: "86px" };
      // Центрирование по горизонтали и вертикали уже в CSS, задаем только размеры
      titleStyle = `style="width: ${titlePos.width}; height: ${titlePos.height};"`;
    }
    
    return `
      <div class="product__category-card ${sizeClass}" data-category-id="${category.id}">
        <div class="product__category-card-bg">
          <img src="${config.bgImage}" alt="${name}" class="product__category-card-bg-image" />
        </div>
        ${config.titleImage ? `
        <div class="product__category-card-title-img" ${titleStyle}>
          <img src="${config.titleImage}" alt="${name}" class="product__category-card-title-image" />
        </div>
        ` : ''}
      </div>
    `;
  }).join("");
  
      // Добавляем обработчики кликов
      qsa(".product__category-card", categoriesGrid).forEach(card => {
        card.addEventListener("click", () => {
          const categoryId = card.dataset.categoryId;
          state.currentCategory = categoryId;
          // Сбрасываем фильтры подкатегорий при смене категории
          state.currentWeight = null;
          state.currentFlavor = null;
          state.currentForm = null;
          renderCategories(); // Обновляем выпадающий список категорий
          renderCatalogDropdown(); // Обновляем выпадающий список каталога
          filterProducts(); // Фильтруем и показываем товары
          
          // Плавная прокрутка к товарам
          setTimeout(() => {
            const productsGrid = qs("#productsGrid");
            if (productsGrid && productsGrid.style.display !== "none") {
              productsGrid.scrollIntoView({ 
                behavior: "smooth", 
                block: "start" 
              });
            }
          }, 100);
        });
      });
  
  animateItems(categoriesGrid, ".product__category-card");
  
  // Обновляем визуальное выделение активной категории
  updateActiveCategoryInGrid();
}

/**
 * Рендерит фильтр подкатегорий (вес, вкус, форма) для выбранной категории
 */
function renderSubcategories() {
  const filterContainer = qs("#subcategoriesFilterContainer");
  if (!filterContainer) return;
  
  // Если категория не выбрана, скрываем фильтр
  if (!state.currentCategory) {
    filterContainer.style.display = "none";
    return;
  }
  
  // Получаем все товары в выбранной категории
  const categoryProducts = state.products.filter(p => p.category === state.currentCategory);
  
  // Собираем уникальные значения для фильтров
  const weights = new Set();
  const flavors = new Set();
  const forms = new Set();
  
  categoryProducts.forEach(p => {
    if (p.weight) weights.add(p.weight);
    if (p.flavors && Array.isArray(p.flavors)) {
      p.flavors.forEach(flavor => flavors.add(flavor));
    }
    if (p.type) forms.add(p.type);
  });
  
  // Если есть данные для фильтров, показываем фильтр
  if (weights.size > 0 || flavors.size > 0 || forms.size > 0) {
    filterContainer.style.display = "block";
    renderFilterOptions("weightFilterOptions", weights, "weight", state.currentWeight);
    renderFilterOptions("flavorFilterOptions", flavors, "flavor", state.currentFlavor);
    renderFilterOptions("formFilterOptions", forms, "form", state.currentForm);
  } else {
    filterContainer.style.display = "none";
  }
}

/**
 * Рендерит опции для фильтра (вес, вкус, форма)
 */
function renderFilterOptions(containerId, values, filterType, currentValue) {
  const container = qs(`#${containerId}`);
  if (!container) return;
  
  const isRu = state.currentLanguage === "ru";
  const typeNames = {
    weight: { label: isRu ? "Вес" : "Weight", all: isRu ? "Все веса" : "All weights" },
    flavor: { label: isRu ? "Вкус" : "Flavor", all: isRu ? "Все вкусы" : "All flavors" },
    form: { label: isRu ? "Форма" : "Form", all: isRu ? "Все формы" : "All forms" }
  };
  
  const typeLabels = {
    form: {
      // Бисквитное пирожное
      "biscuits": isRu ? "Бисквитные палочки" : "Biscuit sticks",
      "donuts": isRu ? "Пончики" : "Donuts",
      "bars": isRu ? "Батончики" : "Bars",
      "sticks": isRu ? "Палочки" : "Sticks",
      "cupcake": isRu ? "Кекс" : "Cupcake",
      // Карамель
      "caramel": isRu ? "Карамель" : "Caramel",
      "lollipops": isRu ? "Леденцы" : "Lollipops",
      "lokum": isRu ? "Лукум" : "Lokum",
      // Конфеты
      "candies": isRu ? "Жевательные конфеты" : "Chewy candies",
      "marshmallow": isRu ? "Сбивные конфеты" : "Marshmallow candies",
      "dragee": isRu ? "Драже" : "Dragee",
      "chocolate_candies": isRu ? "Шоколадные конфеты" : "Chocolate candies",
      // Мармелад
      "belts": isRu ? "Ремешки" : "Belts",
      "pencils": isRu ? "Карандаши" : "Pencils",
      "bears": isRu ? "Мишки" : "Bears",
      "figurative": isRu ? "Фигурные" : "Figurative",
      "marmalade": isRu ? "Мармелад (общее)" : "Marmalade (general)",
      // Маршмеллоу
      "marshmallows": isRu ? "Маршмеллоу (общее)" : "Marshmallows (general)",
      "tubes": isRu ? "Трубочки" : "Tubes",
      // Шоколад
      "chocolate": isRu ? "Молочный шоколад" : "Milk chocolate",
      "white-chocolate": isRu ? "Белый шоколад" : "White chocolate",
      "dark-chocolate": isRu ? "Темный шоколад" : "Dark chocolate",
      "dubai-chocolate": isRu ? "Дубайский шоколад" : "Dubai chocolate",
      // Вафли
      "wafer_sticks": isRu ? "Вафельные палочки" : "Wafer sticks",
      "waffles": isRu ? "Вафли (общее)" : "Waffles (general)",
      // Желе
      "jelly-desserts": isRu ? "Желейные десерты" : "Jelly desserts",
      "jelly_pudding": isRu ? "Желе-пудинг" : "Jelly pudding",
      "drinkable_jelly": isRu ? "Питьевое желе" : "Drinkable jelly",
      "jelly_sticks": isRu ? "Желе в стиках" : "Jelly sticks",
      "jelly_cups": isRu ? "Желе в стаканчиках" : "Jelly cups",
      "jelly_cans": isRu ? "Желе в банках" : "Jelly cans",
      "jelly_pieces": isRu ? "Желе кусочками" : "Jelly pieces",
      "jelly_figures": isRu ? "Фигурное желе" : "Figurative jelly",
    }
  };
  
  if (values.size === 0) {
    container.innerHTML = "";
    return;
  }

  // Фильтр «вес»: сортировка по числовому значению (15, 70, 75, 80, 700, 1000 грамм и т.д.)
  let sortedValues;
  if (filterType === "weight") {
    sortedValues = Array.from(values).sort((a, b) => {
      const numA = parseInt(String(a).replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b).replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  } else {
    sortedValues = Array.from(values).sort();
  }
  
  container.innerHTML = `
    <button class="product__filter-option ${!currentValue ? 'active' : ''}" data-filter-type="${filterType}" data-filter-value="">
      <span>${typeNames[filterType].all}</span>
    </button>
    ${sortedValues.map(value => {
      const displayValue = filterType === "form" && typeLabels.form[value] 
        ? typeLabels.form[value] 
        : value;
      return `
        <button class="product__filter-option ${currentValue === value ? 'active' : ''}" 
                data-filter-type="${filterType}" 
                data-filter-value="${value}">
          <span>${displayValue}</span>
        </button>
      `;
    }).join("")}
  `;
  
  // Добавляем обработчики кликов
  qsa(".product__filter-option", container).forEach(btn => {
    btn.addEventListener("click", () => {
      const filterType = btn.dataset.filterType;
      const filterValue = btn.dataset.filterValue || null;
      
      // Убираем активный класс со всех кнопок этого фильтра
      qsa(`[data-filter-type="${filterType}"]`, container).forEach(b => b.classList.remove("active"));
      // Добавляем активный класс на выбранную кнопку
      btn.classList.add("active");
      
      // Обновляем состояние фильтра
      if (filterType === "weight") {
        state.currentWeight = filterValue;
      } else if (filterType === "flavor") {
        state.currentFlavor = filterValue;
      } else if (filterType === "form") {
        state.currentForm = filterValue;
      }
      
      // Применяем фильтры
      filterProducts();
    });
  });
}

function renderCategories() {
  const dropdownMenu = qs("#categoryDropdownMenu");
  const dropdownBtn = qs("#categoryDropdownBtn");
  const dropdown = qs("#categoryDropdown");
  
  if (!dropdownMenu || !dropdownBtn || !dropdown) {
    console.warn("⚠ Элементы выпадающего меню категорий не найдены в DOM");
    return;
  }

  // Обновляем текст кнопки
  const categoryText = qs(".product__category-dropdown-text", dropdownBtn);
  if (categoryText) {
    if (state.currentCategory) {
      const category = state.categories[state.currentCategory];
      categoryText.textContent = category
        ? state.currentLanguage === "ru" ? category.nameRu : category.nameEn
        : "Вся продукция";
    } else {
      categoryText.textContent = "Вся продукция";
    }
  }

  // Рендерим элементы меню
  dropdownMenu.innerHTML = `
    <div class="product__category-dropdown-item ${
      !state.currentCategory ? "is-active" : ""
    }" data-id="">
      Вся продукция
    </div>
    ${Object.values(state.categories)
      .map(
        (c) => `
      <div class="product__category-dropdown-item ${
        state.currentCategory === c.id ? "is-active" : ""
      }" data-id="${c.id}">
        ${state.currentLanguage === "ru" ? c.nameRu : c.nameEn}
      </div>
    `,
      )
      .join("")}
  `;

  // Обработчики для элементов меню
  qsa(".product__category-dropdown-item", dropdownMenu).forEach((item) => {
    item.addEventListener("click", () => {
      const categoryId = item.dataset.id || null;
      state.currentCategory = categoryId;
      renderCategories();
      renderCatalogDropdown(); // Обновляем выпадающий список каталога
      filterProducts();
      closeCategoryDropdown();
    });
  });
}

function initCategoryDropdown() {
  const dropdownBtn = qs("#categoryDropdownBtn");
  const dropdown = qs("#categoryDropdown");
  
  if (!dropdownBtn || !dropdown) return;

  // Переключение выпадающего меню
  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCategoryDropdown();
  });

  // Закрытие при клике вне меню
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) {
      closeCategoryDropdown();
    }
  });
}

function initSortButtons() {
  const popularityBtn = qs("#popularityFilter");
  const alphabetBtn = qs("#alphabetFilter");
  if (!popularityBtn && !alphabetBtn) return;

  function setSortOrder(order) {
    state.currentSortOrder = order;
    [popularityBtn, alphabetBtn].forEach((btn) => {
      if (!btn) return;
      const isActive = (btn === popularityBtn && order === "popularity") || (btn === alphabetBtn && order === "alphabet");
      btn.classList.toggle("active", !!isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    filterProducts();
  }

  if (popularityBtn) {
    popularityBtn.addEventListener("click", () => {
      setSortOrder(state.currentSortOrder === "popularity" ? null : "popularity");
    });
  }
  if (alphabetBtn) {
    alphabetBtn.addEventListener("click", () => {
      setSortOrder(state.currentSortOrder === "alphabet" ? null : "alphabet");
    });
  }
}

function toggleCategoryDropdown() {
  const dropdown = qs("#categoryDropdown");
  if (dropdown) {
    dropdown.classList.toggle("is-open");
  }
}

function closeCategoryDropdown() {
  const dropdown = qs("#categoryDropdown");
  if (dropdown) {
    dropdown.classList.remove("is-open");
  }
}

/* -------------------- UI HELPERS -------------------- */

function updateBrandInfo() {
  const info = qs("#brandFilterInfo");
  const banner = qs("#productSelectedBrandBanner");
  const bannerName = qs("#productSelectedBrandName");
  const main = qs("#productPageMain") || qs(".product-page");
  const isProductsTab = main && main.classList.contains("product-page--tab-products");
  const heroBrandLogo = qs("#productHeroBrandLogo");
  const heroBrandLogoImg = qs("#productHeroBrandLogoImg");

  const brandObj = state.currentBrand
    ? state.brands.find((b) => normalizeBrand(b.name) === state.currentBrand)
    : null;
  const displayBrand = brandObj ? brandObj.name : state.currentBrand;

  const resolveHeroBg = (brand, activeCard) => {
    if (activeCard && activeCard.dataset && activeCard.dataset.bgHover) {
      return activeCard.dataset.bgHover;
    }
    if (brand && brand.logoHoverBg) {
      return brand.logoHoverBg;
    }
    const base =
      (activeCard && activeCard.dataset && activeCard.dataset.imgDefault) ||
      (brand && brand.logo) ||
      "";
    if (!base) return "";
    return base
      .replace("/products/brand_logo/", "/brand_logo/")
      .replace(".webp", "-hover-bg.webp");
  };

  /* Hero: при выборе бренда карусели выключены, показывается только логотип бренда (Figma) */
  if (main) {
    if (state.currentBrand && brandObj) {
      main.classList.add("product-page--brand-selected");
      if (heroBrandLogo) {
        heroBrandLogo.setAttribute("aria-hidden", "false");
        const bgUrl = resolveHeroBg(brandObj, state.activeBrandCard);
        heroBrandLogo.style.backgroundImage = bgUrl ? `url(${bgUrl})` : "";
      }
      if (heroBrandLogoImg) {
        // Для hero используем обычный логотип бренда (default), не hover
        const activeCard = state.activeBrandCard;
        const defaultImg = activeCard && activeCard.dataset.imgDefault;
        heroBrandLogoImg.src = defaultImg || brandObj.logo || "";
        heroBrandLogoImg.alt = brandObj.name || state.currentBrand || "";
      }
      if (window.heroCarouselBrands && typeof window.heroCarouselBrands.stop === "function") {
        window.heroCarouselBrands.stop();
      }
    } else {
      main.classList.remove("product-page--brand-selected");
      if (heroBrandLogo) {
        heroBrandLogo.setAttribute("aria-hidden", "true");
        heroBrandLogo.style.backgroundImage = "";
      }
      if (heroBrandLogoImg) {
        heroBrandLogoImg.src = "";
        heroBrandLogoImg.alt = "";
      }
      if (window.heroCarouselBrands && typeof window.heroCarouselBrands.reset === "function") {
        window.heroCarouselBrands.reset();
      }
    }
  }

  /* Блок фильтра под результатами (Бренд: X / Показать все) */
  if (info) {
    if (!state.currentBrand) {
      info.style.display = "none";
    } else {
      info.style.display = "flex";
      const textEl = qs(".product__filter-text", info);
      if (textEl) {
        textEl.textContent =
          state.currentLanguage === "ru"
            ? `Бренд: ${displayBrand}`
            : `Brand: ${displayBrand}`;
      }
    }
  }

  /* Баннер сверху (див при выборе бренда): показываем только во вкладке «Продукция» */
  if (banner && bannerName) {
    if (!state.currentBrand || !isProductsTab) {
      banner.classList.remove("is-visible");
      banner.setAttribute("aria-hidden", "true");
    } else {
      bannerName.textContent = displayBrand;
      banner.classList.add("is-visible");
      banner.setAttribute("aria-hidden", "false");
    }
  }
}

function switchToProductsTab() {
  qs('[data-tab="brands"]')?.classList.remove("product__tab--active");
  qs('[data-tab="products"]')?.classList.add("product__tab--active");
  qs('[data-panel="brands"]')?.classList.remove("product__panel--active");
  qs('[data-panel="products"]')?.classList.add("product__panel--active");
}

/* -------------------- SEARCH -------------------- */

function initSearch() {
  const input = qs("#productSearchInput");
  const clear = qs("#searchClearBtn");

  if (!input) {
    console.warn("⚠ #productSearchInput не найден в DOM");
    return;
  }

  if (!clear) {
    console.warn("⚠ #searchClearBtn не найден в DOM");
    return;
  }

  input.addEventListener("input", () => {
    clear.style.display = input.value ? "flex" : "none";
    filterProducts();
  });

  clear.addEventListener("click", () => {
    input.value = "";
    clear.style.display = "none";
    filterProducts();
  });
}

/* -------------------- INIT -------------------- */

function clearBrandFilter() {
  state.currentBrand = null;
  if (state.activeBrandCard) {
    const prev = state.activeBrandCard;
    const prevBg = qs(".product__brand-bg", prev);
    const prevImg = qs(".product__brand-img", prev);
    prev.classList.remove("is-active", "is-hover", "is-hover-active");
    if (prevBg && prev.dataset.bgDefault) prevBg.style.backgroundImage = `url(${prev.dataset.bgDefault})`;
    if (prevImg && prev.dataset.imgDefault) prevImg.src = prev.dataset.imgDefault;
    state.activeBrandCard = null;
  }
  updateBrandInfo();
  filterProducts();
}

function initBrandFilterClear() {
  const clearBtn = qs("#clearBrandFilter");
  const bannerClearBtn = qs("#clearSelectedBrandBanner");

  if (clearBtn) {
    clearBtn.addEventListener("click", clearBrandFilter);
  }
  if (bannerClearBtn) {
    bannerClearBtn.addEventListener("click", clearBrandFilter);
  }
}

async function init() {
  // Не выполнять на страницах без контейнера продукта (избегаем ошибок в Console)
  if (!document.querySelector(".product-page") && !document.querySelector("#productsGrid")) {
    return;
  }

  const loaded = await loadProductsData();
  if (!loaded) {
    return;
  }

  // Проверяем, что товары загружены
  if (!state.products || state.products.length === 0) {
    const grid = qs("#productsGrid");
    if (grid) {
      grid.innerHTML = `
        <div class="product__no-results">
          <p>${
            state.currentLanguage === "ru"
              ? "Товары не найдены"
              : "No products found"
          }</p>
        </div>
      `;
    }
    return;
  }

  renderBrands();
  renderCategories();
  initCategoryDropdown();
  initCatalogDropdown(); // Инициализируем выпадающий список каталога
  initSortButtons();
  initSearch();
  initBrandFilterClear();

  // Инициализируем обработчик для кнопки "Продукция" в меню
  initProductsNavHandler();

  // При загрузке показываем все товары и сетку категорий
  renderCategoriesGrid();
  
  // Читаем параметр категории из URL после рендеринга категорий
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category');
  
  if (categoryParam) {
    // Декодируем параметр (на случай пробелов и спецсимволов)
    const decodedCategory = decodeURIComponent(categoryParam);
    // Проверяем, существует ли категория
    if (state.categories[decodedCategory]) {
      // Устанавливаем категорию из URL
      state.currentCategory = decodedCategory;
      // Сбрасываем фильтры подкатегорий
      state.currentWeight = null;
      state.currentFlavor = null;
      state.currentForm = null;
      
      // Обновляем UI категорий
      renderCategories();
      renderCatalogDropdown();
      updateActiveCategoryInGrid();
      
      // Скрываем сетку категорий и показываем товары
      const categoriesGrid = qs("#categoriesGrid");
      const productsGrid = qs("#productsGrid");
      if (categoriesGrid) {
        categoriesGrid.style.display = "none";
      }
      if (productsGrid) {
        productsGrid.style.display = "grid";
      }
      
      // Применяем фильтрацию товаров
      state.filteredProducts = state.products;
      filterProducts();
      
      // Показываем фильтры подкатегорий
      renderSubcategories();
      
      // Автоскролл к товарам после небольшой задержки для завершения рендеринга
      setTimeout(() => {
        if (productsGrid && productsGrid.style.display !== "none") {
          // Прокручиваем к блоку с товарами
          productsGrid.scrollIntoView({ 
            behavior: "smooth", 
            block: "start",
            inline: "nearest"
          });
        }
      }, 400);
    } else {
      // Если категория не найдена, показываем все товары
      state.filteredProducts = state.products;
      filterProducts();
    }
  } else {
    // Если параметра нет, показываем все товары
    state.filteredProducts = state.products;
    filterProducts();
  }
}

/**
 * Рендерит выпадающий список категорий в кнопке каталога
 */
function renderCatalogDropdown() {
  const dropdownList = qs(".product__catalog-list");
  if (!dropdownList) return;

  const isRu = state.currentLanguage === "ru";
  
  // Определяем порядок категорий согласно макетам Figma
  const categoryOrder = [
    "marshmallows",  // 1. Маршмеллоу
    "marmalade",     // 2. Мармелад
    "candy",         // 3. Конфеты
    "caramel",       // 4. Карамель
    "sponge cake",   // 5. Бисквитное пирожное
    "waffles",       // 6. Вафли
    "jelly",         // 7. Желе
    "chocolate"      // 8. Шоколад
  ];
  
  // Получаем категории в правильном порядке
  const categories = categoryOrder
    .map(id => state.categories[id])
    .filter(category => category !== undefined);
  
  // Подсчитываем количество товаров в каждой категории
  const categoryCounts = {};
  state.products.forEach(product => {
    if (product.category) {
      categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    }
  });
  
  if (categories.length === 0) {
    dropdownList.innerHTML = `
      <li class="product__catalog-item">
        <span class="product__catalog-link" style="cursor: default; opacity: 0.6;">
          ${isRu ? "Категории не найдены" : "No categories found"}
        </span>
      </li>
    `;
    return;
  }
  
  dropdownList.innerHTML = categories.map(category => {
    const count = categoryCounts[category.id] || 0;
    const name = isRu ? category.nameRu : category.nameEn;
    const isActive = state.currentCategory === category.id;
    
    return `
      <li class="product__catalog-item">
        <button 
          class="product__catalog-link ${isActive ? 'is-active' : ''}" 
          data-category-id="${category.id}"
          type="button"
        >
          <span>${name}</span>
          ${count > 0 ? `<span class="product__catalog-link-count">(${count})</span>` : ''}
        </button>
      </li>
    `;
  }).join("");
  
  // Добавляем обработчики кликов на категории
  qsa(".product__catalog-link[data-category-id]", dropdownList).forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const categoryId = link.dataset.categoryId;
      state.currentCategory = categoryId;
      
      // Сбрасываем фильтры подкатегорий при смене категории
      state.currentWeight = null;
      state.currentFlavor = null;
      state.currentForm = null;
      
      // Обновляем UI
      renderCatalogDropdown(); // Обновляем выпадающий список
      renderCategories(); // Обновляем другой выпадающий список категорий (если есть)
      renderCategoriesGrid(); // Обновляем сетку категорий
      filterProducts(); // Фильтруем и показываем товары
      
      // Закрываем выпадающее меню
      closeCatalogDropdown();
      
      // Плавная прокрутка к товарам
      setTimeout(() => {
        const productsGrid = qs("#productsGrid");
        if (productsGrid && productsGrid.style.display !== "none") {
          productsGrid.scrollIntoView({ 
            behavior: "smooth", 
            block: "start" 
          });
        }
      }, 100);
    });
  });
}

/**
 * Инициализирует выпадающий список каталога
 */
function initCatalogDropdown() {
  const catalogBtn = qs("#catalogBtn");
  const catalogDropdown = qs("#catalogDropdown");
  
  if (!catalogBtn || !catalogDropdown) return;
  
  // Рендерим список категорий
  renderCatalogDropdown();
  
  // Обработчик клика на кнопку каталога
  catalogBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = catalogBtn.getAttribute("aria-expanded") === "true";
    
    if (isOpen) {
      closeCatalogDropdown();
    } else {
      openCatalogDropdown();
    }
  });
  
  // Закрываем меню при клике вне его
  document.addEventListener("click", (e) => {
    if (!catalogBtn.contains(e.target) && !catalogDropdown.contains(e.target)) {
      closeCatalogDropdown();
    }
  });
  
  // Закрываем меню при нажатии Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCatalogDropdown();
    }
  });
}

/**
 * Открывает выпадающее меню каталога
 */
function openCatalogDropdown() {
  const catalogBtn = qs("#catalogBtn");
  const catalogDropdown = qs("#catalogDropdown");
  
  if (!catalogBtn || !catalogDropdown) return;
  
  catalogBtn.setAttribute("aria-expanded", "true");
  catalogDropdown.classList.add("is-open");
}

/**
 * Закрывает выпадающее меню каталога
 */
function closeCatalogDropdown() {
  const catalogBtn = qs("#catalogBtn");
  const catalogDropdown = qs("#catalogDropdown");
  
  if (!catalogBtn || !catalogDropdown) return;
  
  catalogBtn.setAttribute("aria-expanded", "false");
  catalogDropdown.classList.remove("is-open");
}

/**
 * Инициализирует обработчик для кнопки "Продукция" в меню
 * При клике сбрасывает все фильтры и показывает все товары
 */
function initProductsNavHandler() {
  // Обработчик для ссылок "Продукция" в header
  const productLinks = qsa('a[href="product.html"], a[href*="product.html"]');
  productLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      // Если мы уже на странице product.html, предотвращаем переход
      if (window.location.pathname.includes("product.html") || 
          window.location.href.includes("product.html")) {
        e.preventDefault();
        
        // Сбрасываем все фильтры
        state.currentCategory = null;
        state.currentBrand = null;
        state.currentWeight = null;
        state.currentFlavor = null;
        state.currentForm = null;
        state.activeBrandCard = null;
        
        // Сбрасываем поиск
        const searchInput = qs("#productSearchInput");
        if (searchInput) {
          searchInput.value = "";
          const clearBtn = qs("#searchClearBtn");
          if (clearBtn) {
            clearBtn.style.display = "none";
          }
        }
        
        // Сбрасываем активные классы на карточках брендов
        qsa(".product__brand-card").forEach(card => {
          card.classList.remove("is-active", "is-hover", "is-hover-active");
          const bg = qs(".product__brand-bg", card);
          const cardImg = qs(".product__brand-img", card);
          if (bg && card.dataset.bgDefault) bg.style.backgroundImage = `url(${card.dataset.bgDefault})`;
          if (cardImg && card.dataset.imgDefault) cardImg.src = card.dataset.imgDefault;
        });
        
        // Обновляем UI
        renderCategories();
        renderCategoriesGrid();
        filterProducts();
        updateBrandInfo();
        
        // Прокручиваем к началу страницы
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", init);

/* -------------------- EXPORT -------------------- */

window.productLoader = {
  updateLanguage(lang) {
    state.currentLanguage = lang;
    renderCategories();
    renderCatalogDropdown();
    filterProducts();
    updateBrandInfo();
  },
  updateBrandInfo,
  init,
};
