// Search Autocomplete and Suggestions
let searchSuggestions = [];
let selectedSuggestionIndex = -1;

// Получаем данные о товарах из productLoader
function getProductsData() {
  if (window.productLoader && typeof window.productLoader.productsData === 'function') {
    return window.productLoader.productsData();
  }
  return null;
}

/**
 * Генерирует список предложений для автодополнения
 */
function generateSuggestions(query) {
  if (!query || query.length < 2) {
    return [];
  }

  // Получаем данные из глобальной переменной productLoader
  let productsData = null;
  let categoriesData = null;
  let brandsData = null;
  
  if (window.productLoader) {
    productsData = window.productLoader.productsData ? window.productLoader.productsData() : null;
  }
  
  // Пытаемся получить данные из загрузчика
  if (!productsData && window.productLoader && window.productLoader.productsData) {
    productsData = window.productLoader.productsData();
  }

  const queryLower = query.toLowerCase();
  const suggestions = new Set();
  const maxSuggestions = 8;

  // Собираем предложения из товаров
  if (productsData && Array.isArray(productsData)) {
    productsData.forEach(product => {
    // По названию
    const nameRu = (product.nameRu || product.name || '').toLowerCase();
    const nameEn = (product.nameEn || product.name || '').toLowerCase();
    
    if (nameRu.includes(queryLower) && nameRu !== queryLower) {
      suggestions.add(product.nameRu || product.name);
    }
    if (nameEn.includes(queryLower) && nameEn !== queryLower) {
      suggestions.add(product.nameEn || product.name);
    }
    
    // По бренду
    const brand = (product.brand || '').toLowerCase();
    if (brand.includes(queryLower)) {
      suggestions.add(product.brand);
    }
    
    // По тегам
    if (product.tags) {
      product.tags.forEach(tag => {
        if (tag.toLowerCase().includes(queryLower) && tag.length > 2) {
          suggestions.add(tag);
        }
      });
    }
  });

    });
  }

  // Получаем данные категорий и брендов
  if (window.productLoader) {
    categoriesData = window.productLoader.categoriesData ? window.productLoader.categoriesData() : null;
    brandsData = window.productLoader.brandsData ? window.productLoader.brandsData() : null;
  }

  // Собираем предложения из категорий
  if (categoriesData) {
    Object.values(categoriesData).forEach(category => {
      const categoryNameRu = (category.nameRu || '').toLowerCase();
      const categoryNameEn = (category.nameEn || '').toLowerCase();
      
      if (categoryNameRu.includes(queryLower)) {
        suggestions.add(category.nameRu);
      }
      if (categoryNameEn.includes(queryLower)) {
        suggestions.add(category.nameEn);
      }
    });
  }

  // Собираем предложения из брендов
  if (brandsData && Array.isArray(brandsData)) {
    brandsData.forEach(brand => {
      const brandName = (brand.name || '').toLowerCase();
      const brandDisplay = (brand.displayName || '').toLowerCase();
      
      if (brandName.includes(queryLower) || brandDisplay.includes(queryLower)) {
        suggestions.add(brand.displayName || brand.name);
      }
    });
  }
  
  return Array.from(suggestions).slice(0, maxSuggestions);
}

/**
 * Выделяет совпадающую часть текста в предложении
 */
function highlightMatch(text, query) {
  if (!query) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Отображает предложения автодополнения
 */
function renderSuggestions(suggestions, query) {
  const container = document.getElementById('searchSuggestions');
  if (!container) return;

  if (suggestions.length === 0 || !query || query.length < 2) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const suggestionsHTML = suggestions.map((suggestion, index) => {
    const highlighted = highlightMatch(suggestion, query);
    return `
      <div class="product__suggestion-item ${index === selectedSuggestionIndex ? 'product__suggestion-item--active' : ''}" 
           data-suggestion="${suggestion}" 
           data-index="${index}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="product__suggestion-text">${highlighted}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = suggestionsHTML;
  container.style.display = 'block';

  // Добавляем обработчики кликов
  const items = container.querySelectorAll('.product__suggestion-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      const suggestion = item.getAttribute('data-suggestion');
      selectSuggestion(suggestion);
    });
    
    item.addEventListener('mouseenter', () => {
      selectedSuggestionIndex = parseInt(item.getAttribute('data-index'));
      updateSuggestionSelection();
    });
  });
}

/**
 * Обновляет выделение предложений
 */
function updateSuggestionSelection() {
  const items = document.querySelectorAll('.product__suggestion-item');
  items.forEach((item, index) => {
    if (index === selectedSuggestionIndex) {
      item.classList.add('product__suggestion-item--active');
    } else {
      item.classList.remove('product__suggestion-item--active');
    }
  });
}

/**
 * Выбирает предложение и применяет поиск
 */
function selectSuggestion(suggestion) {
  const searchInput = document.getElementById('productSearchInput');
  if (searchInput) {
    searchInput.value = suggestion;
    hideSuggestions();
    
    // Сбрасываем категорию при выборе предложения из автодополнения
    if (window.productLoader && window.productLoader.state) {
      if (window.productLoader.state.currentCategory !== null) {
        window.productLoader.state.currentCategory = null;
        window.productLoader.state.currentWeight = null;
        window.productLoader.state.currentFlavor = null;
        window.productLoader.state.currentForm = null;
        // Обновляем UI категорий
        if (typeof window.productLoader.renderCategories === 'function') {
          window.productLoader.renderCategories();
        }
        if (typeof window.productLoader.renderCatalogDropdown === 'function') {
          window.productLoader.renderCatalogDropdown();
        }
        if (typeof window.productLoader.updateActiveCategoryInGrid === 'function') {
          window.productLoader.updateActiveCategoryInGrid();
        }
      }
    }
    
    // Применяем поиск
    if (window.productLoader && typeof window.productLoader.applyFilters === 'function') {
      window.productLoader.applyFilters();
    } else if (window.productLoader && typeof window.productLoader.filterProducts === 'function') {
      window.productLoader.filterProducts();
    }
  }
}

/**
 * Скрывает предложения
 */
function hideSuggestions() {
  const container = document.getElementById('searchSuggestions');
  if (container) {
    container.style.display = 'none';
    selectedSuggestionIndex = -1;
  }
}

/**
 * Инициализирует автодополнение
 */
function initAutocomplete() {
  const searchInput = document.getElementById('productSearchInput');
  if (!searchInput) return;

  let suggestionTimeout;

  // Обработка ввода
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(suggestionTimeout);
    
    if (query.length >= 2) {
      suggestionTimeout = setTimeout(() => {
        searchSuggestions = generateSuggestions(query);
        renderSuggestions(searchSuggestions, query);
      }, 200);
    } else {
      hideSuggestions();
    }
  });

  // Обработка фокуса
  searchInput.addEventListener('focus', () => {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
      searchSuggestions = generateSuggestions(query);
      renderSuggestions(searchSuggestions, query);
    }
  });

  // Скрытие при клике вне поля
  document.addEventListener('click', (e) => {
    const container = document.getElementById('searchSuggestions');
    const searchWrapper = document.querySelector('.product__search-wrapper');
    
    if (container && searchWrapper && !searchWrapper.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Навигация клавиатурой
  searchInput.addEventListener('keydown', (e) => {
    const container = document.getElementById('searchSuggestions');
    if (!container || container.style.display === 'none') return;

    const items = container.querySelectorAll('.product__suggestion-item');
    if (items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
        updateSuggestionSelection();
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
        updateSuggestionSelection();
        break;
      
      case 'Enter':
        if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
          e.preventDefault();
          const suggestion = items[selectedSuggestionIndex].getAttribute('data-suggestion');
          selectSuggestion(suggestion);
        }
        break;
      
      case 'Escape':
        hideSuggestions();
        break;
    }
  });
}

// Экспорт функций
window.searchAutocomplete = {
  init: initAutocomplete,
  hide: hideSuggestions
};

