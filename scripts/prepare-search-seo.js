const fs = require('fs');
const path = require('path');

// Настройки
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const BACKUP_JSON = path.join(PROJECT_ROOT, 'data', 'products.backup-prepare-search-seo.json');
const REPORT_PATH = path.join(__dirname, 'prepare-search-seo-report.json');

// Функция нормализации строки для searchText
function normalizeForSearch(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-я0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

// Функция транслитерации кириллицы
function transliterate(text) {
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    'İ': 'I', 'ı': 'i', 'Ş': 'S', 'ş': 's', 'Ç': 'C', 'ç': 'c',
    'Ğ': 'G', 'ğ': 'g', 'Ö': 'O', 'ö': 'o', 'Ü': 'U', 'ü': 'u'
  };
  
  return text.split('').map(char => map[char] || char).join('');
}

// Генерация searchText
function generateSearchText(product) {
  const parts = [];
  
  // nameRu
  if (product.nameRu) {
    parts.push(normalizeForSearch(product.nameRu));
    parts.push(transliterate(normalizeForSearch(product.nameRu)));
  }
  
  // nameEn
  if (product.nameEn) {
    parts.push(normalizeForSearch(product.nameEn));
  }
  
  // name
  if (product.name) {
    parts.push(normalizeForSearch(product.name));
  }
  
  // brand
  if (product.brand) {
    parts.push(normalizeForSearch(product.brand));
    parts.push(transliterate(normalizeForSearch(product.brand)));
  }
  
  // category
  if (product.category) {
    parts.push(normalizeForSearch(product.category));
  }
  
  // tags
  if (product.tags && Array.isArray(product.tags)) {
    product.tags.forEach(tag => {
      if (tag) {
        parts.push(normalizeForSearch(tag));
        parts.push(transliterate(normalizeForSearch(tag)));
      }
    });
  }
  
  // Объединяем и убираем дубликаты
  const uniqueParts = [...new Set(parts.filter(p => p && p.length > 0))];
  return uniqueParts.join(' ').substring(0, 2000); // Ограничение длины
}

// Генерация SEO title
function generateSEOTitle(product, categoryName) {
  const parts = [];
  
  // Название продукта
  if (product.nameRu) {
    parts.push(product.nameRu);
  } else if (product.nameEn) {
    parts.push(product.nameEn);
  } else if (product.name) {
    parts.push(product.name);
  }
  
  // Бренд
  if (product.brand) {
    parts.push(product.brand);
  }
  
  // Категория
  if (categoryName) {
    parts.push(categoryName);
  }
  
  let title = parts.join(' - ');
  
  // Ограничение до 50-60 символов
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }
  
  return title || 'Product';
}

// Генерация SEO description
function generateSEODescription(product, categoryName) {
  const parts = [];
  
  // Начало с названия
  if (product.nameRu) {
    parts.push(product.nameRu);
  } else if (product.nameEn) {
    parts.push(product.nameEn);
  }
  
  // Тип/форма
  if (product.type) {
    const typeNames = {
      'bears': 'мишки',
      'cubes': 'кубики',
      'belts': 'ремешки',
      'tubes': 'трубочки',
      'wafers': 'вафли',
      'sticks': 'палочки',
      'pencils': 'карандаши'
    };
    parts.push(typeNames[product.type] || product.type);
  }
  
  // Вкус
  if (product.flavors && product.flavors.length > 0) {
    parts.push(`со вкусом ${product.flavors[0]}`);
  }
  
  // Вес
  if (product.weight) {
    parts.push(`вес ${product.weight}`);
  }
  
  // Категория
  if (categoryName) {
    parts.push(`категория ${categoryName}`);
  }
  
  // Бренд
  if (product.brand) {
    parts.push(`бренд ${product.brand}`);
  }
  
  let description = parts.join(', ');
  
  // Ограничение до 140-160 символов
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  } else if (description.length < 140) {
    // Дополняем, если слишком короткое
    description += '. Высокое качество, натуральные ингредиенты.';
    if (description.length > 160) {
      description = description.substring(0, 157) + '...';
    }
  }
  
  return description || 'Качественный продукт от проверенного производителя.';
}

// Генерация SEO keywords
function generateSEOKeywords(product, categoryName) {
  const keywords = new Set();
  
  // Название (RU + EN)
  if (product.nameRu) {
    keywords.add(product.nameRu.toLowerCase());
  }
  if (product.nameEn) {
    keywords.add(product.nameEn.toLowerCase());
  }
  
  // Бренд
  if (product.brand) {
    keywords.add(product.brand.toLowerCase());
  }
  
  // Категория
  if (categoryName) {
    keywords.add(categoryName.toLowerCase());
  }
  
  // Тип/форма
  if (product.type) {
    keywords.add(product.type.toLowerCase());
  }
  
  // Вкусы
  if (product.flavors && Array.isArray(product.flavors)) {
    product.flavors.slice(0, 3).forEach(flavor => {
      if (flavor) keywords.add(flavor.toLowerCase());
    });
  }
  
  // Вес
  if (product.weight) {
    keywords.add(product.weight.toLowerCase());
  }
  
  // Лучшие теги (первые 5)
  if (product.tags && Array.isArray(product.tags)) {
    product.tags.slice(0, 5).forEach(tag => {
      if (tag && tag.length > 2) {
        keywords.add(tag.toLowerCase());
      }
    });
  }
  
  // Ограничение до 8-12 ключевых слов
  const finalKeywords = Array.from(keywords).slice(0, 12);
  
  return finalKeywords;
}

// Нормализация ID
function normalizeProductId(product) {
  const parts = [];
  
  // Бренд
  if (product.brand) {
    const brandSlug = transliterate(product.brand)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (brandSlug) parts.push(brandSlug);
  }
  
  // Тип продукта (из type или category)
  if (product.type) {
    parts.push(product.type);
  } else if (product.category) {
    const categorySlug = product.category
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    parts.push(categorySlug);
  }
  
  // Название продукта (упрощенное)
  const nameSlug = transliterate(product.nameRu || product.nameEn || product.name || 'product')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);
  if (nameSlug && nameSlug !== 'product') {
    parts.push(nameSlug);
  }
  
  // Вес
  if (product.weight) {
    const weightNum = product.weight.replace(/[^0-9]/g, '');
    if (weightNum) {
      parts.push(weightNum + 'g');
    }
  }
  
  return parts.join('-').substring(0, 150);
}

// Проверка готовности для фильтров
function checkFilterReadiness(product, categories, brands) {
  const issues = [];
  
  // Проверка category
  if (!product.category) {
    issues.push('missing_category');
  } else if (categories && !categories[product.category]) {
    issues.push(`invalid_category: ${product.category}`);
  }
  
  // Проверка brand
  if (!product.brand) {
    issues.push('missing_brand');
  } else if (brands && !brands.some(b => {
    const brandName = normalizeBrand(b.name || b);
    const productBrand = normalizeBrand(product.brand);
    return brandName === productBrand;
  })) {
    issues.push(`invalid_brand: ${product.brand}`);
  }
  
  // Проверка tags
  if (!product.tags || !Array.isArray(product.tags) || product.tags.length === 0) {
    issues.push('missing_tags');
  } else {
    const tagText = product.tags.join(' ').toLowerCase();
    
    // Проверяем наличие вкуса
    const hasFlavor = /(strawberry|клубника|chocolate|шоколад|sour|кислый|fruit|фрукт|cola|кола|apple|яблоко|watermelon|арбуз)/i.test(tagText);
    if (!hasFlavor && !product.flavors) {
      issues.push('missing_flavor_in_tags');
    }
    
    // Проверяем наличие формы
    const hasShape = /(bears|мишка|cubes|кубик|belts|ремень|tubes|трубка|wafers|вафля|sticks|палочка)/i.test(tagText);
    if (!hasShape && !product.type) {
      issues.push('missing_shape_in_tags');
    }
    
    // Проверяем наличие веса
    const hasWeight = /\d+g|\d+gr|\d+kg/i.test(tagText);
    if (!hasWeight && !product.weight) {
      issues.push('missing_weight_in_tags');
    }
  }
  
  return issues;
}

// Нормализация бренда для сравнения
function normalizeBrand(brand) {
  if (!brand) return '';
  return brand.toString().trim().toUpperCase().replace(/\s+/g, '');
}

// Основная функция подготовки
function prepareSearchSEO() {
  console.log('🚀 Начинаю подготовку данных для Search / Filter / SEO...\n');
  
  // Читаем products.json
  let productsData;
  try {
    const content = fs.readFileSync(PRODUCTS_JSON, 'utf8');
    productsData = JSON.parse(content);
  } catch (error) {
    console.error('❌ Ошибка при чтении products.json:', error.message);
    process.exit(1);
  }
  
  // Создаем backup
  fs.copyFileSync(PRODUCTS_JSON, BACKUP_JSON);
  console.log(`💾 Backup создан: ${BACKUP_JSON}\n`);
  
  const stats = {
    total: productsData.products.length,
    searchTextAdded: 0,
    seoAdded: 0,
    idNormalized: 0,
    issues: [],
    duplicates: [],
    missingImages: [],
    emptyFields: []
  };
  
  // Получаем категории и бренды
  const categories = productsData.categories || {};
  const brands = productsData.brands || [];
  
  // Получаем названия категорий
  const categoryNames = {};
  Object.keys(categories).forEach(key => {
    categoryNames[key] = categories[key].nameRu || categories[key].name || key;
  });
  
  console.log(`📊 Обработка ${stats.total} товаров...\n`);
  
  const existingIds = new Set();
  const idMap = new Map(); // Старый ID -> новый ID
  
  // Обрабатываем каждый продукт
  for (let i = 0; i < productsData.products.length; i++) {
    const product = productsData.products[i];
    
    if (i % 50 === 0 && i > 0) {
      process.stdout.write(`\rОбработано: ${i}/${stats.total}`);
    }
    
    // 1. Добавляем searchText
    if (!product.searchText) {
      product.searchText = generateSearchText(product);
      stats.searchTextAdded++;
    }
    
    // 2. Добавляем SEO
    if (!product.seo) {
      const categoryName = categoryNames[product.category] || product.category;
      product.seo = {
        title: generateSEOTitle(product, categoryName),
        description: generateSEODescription(product, categoryName),
        keywords: generateSEOKeywords(product, categoryName)
      };
      stats.seoAdded++;
    }
    
    // 3. Нормализуем ID
    const normalizedId = normalizeProductId(product);
    if (normalizedId && normalizedId !== product.id) {
      // Проверяем конфликты
      if (!existingIds.has(normalizedId)) {
        const oldId = product.id;
        product.legacyId = oldId;
        product.id = normalizedId;
        existingIds.add(normalizedId);
        idMap.set(oldId, normalizedId);
        stats.idNormalized++;
      } else {
        // Конфликт - оставляем старый ID
        stats.issues.push({
          productId: product.id,
          issue: `id_conflict: suggested ${normalizedId} already exists`
        });
      }
    } else {
      existingIds.add(product.id);
    }
    
    // 4. Проверка готовности для фильтров
    const filterIssues = checkFilterReadiness(product, categories, brands);
    if (filterIssues.length > 0) {
      stats.issues.push({
        productId: product.id,
        issues: filterIssues
      });
    }
    
    // 5. Проверка пустых полей
    const emptyFields = [];
    if (!product.name && !product.nameRu && !product.nameEn) emptyFields.push('name');
    if (!product.brand) emptyFields.push('brand');
    if (!product.category) emptyFields.push('category');
    if (!product.image) emptyFields.push('image');
    if (emptyFields.length > 0) {
      stats.emptyFields.push({
        productId: product.id,
        fields: emptyFields
      });
    }
    
    // 6. Проверка кириллицы в ID
    if (/[а-яё]/i.test(product.id)) {
      stats.issues.push({
        productId: product.id,
        issue: 'cyrillic_in_id'
      });
    }
    
    // 7. Проверка кириллицы в image
    if (product.image && /[а-яё]/i.test(product.image)) {
      stats.issues.push({
        productId: product.id,
        issue: 'cyrillic_in_image_path'
      });
    }
    
    // 8. Проверка существования image
    if (product.image) {
      const imagePath = path.join(PROJECT_ROOT, product.image);
      if (!fs.existsSync(imagePath)) {
        stats.missingImages.push({
          productId: product.id,
          image: product.image
        });
      }
    }
  }
  
  // Проверка дубликатов ID
  const idCounts = {};
  productsData.products.forEach(p => {
    idCounts[p.id] = (idCounts[p.id] || 0) + 1;
  });
  
  Object.keys(idCounts).forEach(id => {
    if (idCounts[id] > 1) {
      stats.duplicates.push({
        id: id,
        count: idCounts[id]
      });
    }
  });
  
  process.stdout.write(`\rОбработано: ${stats.total}/${stats.total}\n\n`);
  
  // Сохраняем обновленный JSON
  console.log('💾 Сохранение обновленного products.json...');
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');
  console.log('✅ products.json обновлен\n');
  
  // Сохраняем отчет
  const report = {
    timestamp: new Date().toISOString(),
    stats: stats
  };
  
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  
  // Выводим итоги
  console.log('\n' + '='.repeat(80));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ ПО ПОДГОТОВКЕ ДАННЫХ');
  console.log('='.repeat(80));
  console.log(`Всего товаров: ${stats.total}`);
  console.log(`Добавлено searchText: ${stats.searchTextAdded}`);
  console.log(`Добавлено SEO: ${stats.seoAdded}`);
  console.log(`Нормализовано ID: ${stats.idNormalized}`);
  console.log(`Проблем найдено: ${stats.issues.length}`);
  console.log(`Дубликатов ID: ${stats.duplicates.length}`);
  console.log(`Отсутствующих изображений: ${stats.missingImages.length}`);
  console.log(`Пустых полей: ${stats.emptyFields.length}`);
  
  if (stats.duplicates.length > 0) {
    console.log('\n⚠ ДУБЛИКАТЫ ID:');
    stats.duplicates.slice(0, 5).forEach(dup => {
      console.log(`  - ${dup.id}: ${dup.count} раз`);
    });
  }
  
  if (stats.missingImages.length > 0) {
    console.log('\n⚠ ОТСУТСТВУЮЩИЕ ИЗОБРАЖЕНИЯ:');
    stats.missingImages.slice(0, 5).forEach(item => {
      console.log(`  - ${item.productId}: ${item.image}`);
    });
  }
  
  if (stats.emptyFields.length > 0) {
    console.log('\n⚠ ПУСТЫЕ ПОЛЯ:');
    stats.emptyFields.slice(0, 5).forEach(item => {
      console.log(`  - ${item.productId}: ${item.fields.join(', ')}`);
    });
  }
  
  if (stats.issues.length > 0) {
    console.log('\n⚠ ПРОБЛЕМЫ:');
    stats.issues.slice(0, 10).forEach(issue => {
      console.log(`  - ${issue.productId}: ${issue.issue || issue.issues?.join(', ')}`);
    });
    if (stats.issues.length > 10) {
      console.log(`  ... и еще ${stats.issues.length - 10} проблем`);
    }
  }
  
  // Финальная проверка
  console.log('\n🔍 ФИНАЛЬНАЯ ПРОВЕРКА:');
  const allChecks = {
    searchText: stats.searchTextAdded === stats.total || productsData.products.every(p => p.searchText),
    seo: stats.seoAdded === stats.total || productsData.products.every(p => p.seo),
    noCyrillicInId: !productsData.products.some(p => /[а-яё]/i.test(p.id)),
    noCyrillicInImage: !productsData.products.some(p => p.image && /[а-яё]/i.test(p.image)),
    noDuplicates: stats.duplicates.length === 0,
    allImagesExist: stats.missingImages.length === 0
  };
  
  Object.keys(allChecks).forEach(check => {
    const status = allChecks[check] ? '✅' : '❌';
    console.log(`  ${status} ${check}`);
  });
  
  console.log(`\n📄 Детальный отчет сохранен: ${REPORT_PATH}`);
  console.log('='.repeat(80));
  console.log('✅ ПОДГОТОВКА ДАННЫХ ЗАВЕРШЕНА');
  console.log('='.repeat(80));
}

// Запуск
prepareSearchSEO();




