const fs = require('fs');
const path = require('path');

// Маппинг брендов из отчета в названия в products.json
const BRAND_NAME_MAP = {
  'TAYAS': 'TAYAS',
  'PAKEL': 'PAKEL',
  'ALIKHAN-ATA': 'ALIKHAN ATA',
  'PUFFICO': 'PUFFI',
  'OSLO': 'OSLO',
  'LOVE-ME': 'LOVE ME',
  'PANDA-LEE': 'PANDA LEE',
  'NAVROZ': 'NAVROZ',
  'CRAFERS': 'CRAFERS',
  'DAMLA': 'DAMLA',
  'JIMMY': 'JIMMY',
  'KIDZI': 'KIDZI',
  'MISKETS': 'MISKETS',
  'BONJUKS': 'BONJUKS',
  'MINIYUM': 'MINIYUM'
};

// Маппинг категорий из отчета в ключи categories
const CATEGORY_MAP = {
  'мармелад': 'marmalade',
  'мармелады': 'marmalade',
  'конфет': 'candy',
  'конфеты': 'candy',
  'жевательные конфеты': 'candy',
  'шоколад': 'chocolate',
  'шоколады': 'chocolate',
  'карамель': 'caramel',
  'драже': 'candy',
  'лукум': 'candy',
  'пирожное': 'cookies',
  'бисквитное пирожное': 'cookies',
  'десерт': 'jelly',
  'желейный десерт': 'jelly',
  'печенье': 'cookies',
  'вафли': 'cookies'
};

// Маппинг типов продуктов
const TYPE_MAP = {
  'ремешки': 'belts',
  'ремни': 'belts',
  'карандаши': 'pencils',
  'мишки': 'bears',
  'трубочки': 'tubes',
  'вафли': 'wafers',
  'печенье': 'cookies',
  'конфеты': 'candies',
  'мармелад': 'marmalade',
  'шоколад': 'chocolate',
  'драже': 'dragee',
  'лукум': 'lokum',
  'паста': 'paste',
  'пирожное': 'cakes',
  'бисквит': 'cakes'
};

// Маппинг вкусов RU -> EN
const FLAVOR_MAP = {
  'арбуз': 'watermelon',
  'клубника': 'strawberry',
  'яблоко': 'apple',
  'апельсин': 'orange',
  'виноград': 'grape',
  'вишня': 'cherry',
  'малина': 'raspberry',
  'ежевика': 'blackberry',
  'кола': 'cola',
  'ананас': 'pineapple',
  'кокос': 'coconut',
  'ваниль': 'vanilla',
  'шоколад': 'chocolate',
  'кофе': 'coffee',
  'радуга': 'rainbow',
  'ассорти': 'assortment',
  'тропик': 'tropical',
  'голубика': 'blueberry',
  'пона-колада': 'pina-colada',
  'малина-ежевика': 'raspberry-blackberry',
  'ананас-кокос': 'pineapple-coconut'
};

// Строгая нормализация бренда: trim + uppercase + no spaces
function normalizeBrand(brand) {
  if (!brand) return '';
  return brand.toString().trim().toUpperCase().replace(/\s+/g, '');
}

// Функция для определения категории
function mapCategory(categoryGuess) {
  if (!categoryGuess) return 'candy'; // default
  
  // Убираем префиксы типа "01 "
  const cleanCategory = categoryGuess.replace(/^\d+\s+/, '').trim().toLowerCase();
  
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (cleanCategory.includes(key)) {
      return value;
    }
  }
  
  return 'candy'; // default
}

// Функция для извлечения типа из названия
function extractType(productName) {
  if (!productName) return null;
  
  const lower = productName.toLowerCase();
  for (const [key, value] of Object.entries(TYPE_MAP)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  
  return null;
}

// Функция для извлечения вкусов из названия
function extractFlavors(productName) {
  if (!productName) return [];
  
  const flavors = [];
  const lower = productName.toLowerCase();
  
  // Сначала проверяем составные вкусы
  const compoundFlavors = [
    { ru: 'малина-ежевика', en: 'raspberry-blackberry' },
    { ru: 'пона-колада', en: 'pina-colada' },
    { ru: 'ананас-кокос', en: 'pineapple-coconut' },
    { ru: 'пина колада', en: 'pina-colada' }
  ];
  
  for (const compound of compoundFlavors) {
    if (lower.includes(compound.ru)) {
      flavors.push(compound.ru);
      flavors.push(compound.en);
      return flavors; // Составной вкус - возвращаем сразу
    }
  }
  
  // Затем проверяем простые вкусы
  for (const [ru, en] of Object.entries(FLAVOR_MAP)) {
    if (lower.includes(ru) && !flavors.includes(ru)) {
      flavors.push(ru);
      flavors.push(en);
    }
  }
  
  return flavors;
}

// Функция для создания тегов
function createTags(category, brand, productName, weight, flavors, type) {
  const tags = [];
  
  // Категория
  const catTags = {
    'marmalade': ['мармелад', 'marmalade'],
    'candy': ['конфеты', 'candy'],
    'caramel': ['карамель', 'caramel'],
    'chocolate': ['шоколад', 'chocolate'],
    'cookies': ['печенье', 'cookies'],
    'jelly': ['желе', 'jelly']
  };
  if (catTags[category]) {
    tags.push(...catTags[category]);
  }
  
  // Бренд (в нижнем регистре)
  const brandLower = normalizeBrand(brand).toLowerCase();
  tags.push(brandLower);
  
  // Вкусы
  tags.push(...flavors);
  
  // Тип
  if (type) {
    const typeTags = {
      'belts': ['ремешки', 'belts'],
      'pencils': ['карандаши', 'pencils'],
      'bears': ['мишки', 'bears'],
      'tubes': ['трубочки', 'tubes'],
      'wafers': ['вафли', 'wafers'],
      'cookies': ['печенье', 'cookies'],
      'cakes': ['пирожное', 'cakes'],
      'candies': ['конфеты', 'candies']
    };
    if (typeTags[type]) {
      tags.push(...typeTags[type]);
    }
  }
  
  // Вес (если есть)
  if (weight) {
    tags.push(weight);
  }
  
  // Убираем дубликаты
  return [...new Set(tags)];
}

// Функция для создания названия продукта
function createProductName(productNameGuess, brand) {
  if (!productNameGuess) return 'Product';
  
  // Первая буква заглавная для каждого слова
  const words = productNameGuess.split(' ').filter(w => w.length > 0);
  const capitalized = words.map(w => {
    if (w.length === 0) return w;
    // Если слово уже в верхнем регистре (например, DAMLA) - оставляем как есть
    if (w === w.toUpperCase() && w.length > 1) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
  
  // Добавляем бренд в начало, если его нет в названии
  const brandLower = normalizeBrand(brand).toLowerCase();
  const nameLower = capitalized.toLowerCase();
  if (!nameLower.includes(brandLower) && brand !== 'UNKNOWN') {
    return `${brand} ${capitalized}`;
  }
  
  return capitalized;
}

// Функция для проверки похожести ID
function isSimilarId(newId, existingIds) {
  // Убираем вес и сравниваем основу
  const newBase = newId.replace(/-\d+gr$/, '').replace(/-\d+\.\d+gr$/, '');
  for (const existingId of existingIds) {
    const existingBase = existingId.replace(/-\d+gr$/, '').replace(/-\d+\.\d+gr$/, '');
    if (newBase === existingBase) {
      return existingId;
    }
  }
  return null;
}

// Функция для сопоставления товара с отчетом
function findMatchingReportItem(product, reportItems) {
  const productBrand = normalizeBrand(product.brand || '');
  
  // 1. По ID (точное совпадение)
  for (const item of reportItems) {
    if (item.suggestedId === product.id) {
      return item;
    }
  }
  
  // 2. По brand + name + weight (логическое совпадение)
  const productNameLower = (product.name || product.nameRu || '').toLowerCase();
  const productWeight = product.weight;
  
  for (const item of reportItems) {
    const itemBrand = normalizeBrand(item.brandGuess || '');
    const itemNameLower = (item.productNameGuess || '').toLowerCase();
    
    if (itemBrand === productBrand) {
      // Проверяем совпадение ключевых слов
      const productKeywords = productNameLower.split(/\s+/).filter(w => w.length > 2);
      const itemKeywords = itemNameLower.split(/\s+/).filter(w => w.length > 2);
      const commonKeywords = productKeywords.filter(k => itemKeywords.includes(k));
      
      if (commonKeywords.length >= 2) {
        // Если вес совпадает - это точно тот же товар
        if (productWeight && item.weightGuess === productWeight) {
          return item;
        }
        // Если вес не указан, но ключевые слова совпадают - вероятно тот же товар
        if (!productWeight || !item.weightGuess) {
          return item;
        }
      }
    }
  }
  
  // 3. По brand + weight (если вес уникален)
  if (productWeight) {
    for (const item of reportItems) {
      const itemBrand = normalizeBrand(item.brandGuess || '');
      if (itemBrand === productBrand && item.weightGuess === productWeight) {
        // Проверяем, что это не другой товар с тем же весом
        const itemNameLower = (item.productNameGuess || '').toLowerCase();
        if (productNameLower.includes(itemNameLower) || itemNameLower.includes(productNameLower)) {
          return item;
        }
      }
    }
  }
  
  return null;
}

// Основная функция
function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const productsJsonPath = path.join(projectRoot, 'data', 'products.json');
  const reportPath = path.join(__dirname, 'foods-scan-report.json');
  const backupPath = path.join(projectRoot, 'data', 'products.backup.json');
  
  console.log('Начинаю синхронизацию products.json...\n');
  
  // Читаем существующий products.json
  let productsData;
  try {
    const content = fs.readFileSync(productsJsonPath, 'utf8');
    productsData = JSON.parse(content);
  } catch (error) {
    console.error('Ошибка при чтении products.json:', error.message);
    process.exit(1);
  }
  
  // Создаем backup
  try {
    fs.copyFileSync(productsJsonPath, backupPath);
    console.log(`✓ Backup создан: ${backupPath}`);
  } catch (error) {
    console.error('Ошибка при создании backup:', error.message);
    process.exit(1);
  }
  
  // Читаем отчет
  let reportItems = [];
  try {
    if (fs.existsSync(reportPath)) {
      const reportContent = fs.readFileSync(reportPath, 'utf8');
      reportItems = JSON.parse(reportContent);
      console.log(`✓ Отчет прочитан: ${reportItems.length} товаров\n`);
    } else {
      console.warn(`⚠ Отчет не найден: ${reportPath}`);
      console.warn('  Запустите сначала scripts/scan-foods.js\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('Ошибка при чтении отчета:', error.message);
    process.exit(1);
  }
  
  // Статистика
  let fixedPaths = 0;
  let updatedProducts = 0;
  let addedProducts = 0;
  let missingFiles = 0;
  const addedProductsList = [];
  const updatedProductsList = [];
  const missingFilesList = [];
  const existingIds = new Set(productsData.products.map(p => p.id));
  
  // Обрабатываем существующие товары
  console.log('Проверяю существующие товары...');
  for (const product of productsData.products) {
    // Нормализуем бренд
    product.brand = normalizeBrand(product.brand);
    
    // Проверяем существование файла изображения
    const imagePath = path.join(projectRoot, product.image);
    let matchingItem = null;
    
    if (!fs.existsSync(imagePath)) {
      missingFiles++;
      missingFilesList.push({
        id: product.id,
        image: product.image
      });
      
      // Пытаемся найти в отчете
      matchingItem = findMatchingReportItem(product, reportItems);
      if (matchingItem) {
        const relativePath = path.relative(projectRoot, matchingItem.suggestedTargetImage).replace(/\\/g, '/');
        product.image = relativePath;
        fixedPaths++;
        updatedProducts++;
        updatedProductsList.push({
          id: product.id,
          action: 'fixed_image',
          oldImage: product.image,
          newImage: relativePath
        });
      }
    } else {
      // Даже если файл существует, пытаемся найти в отчете для обновления полей
      matchingItem = findMatchingReportItem(product, reportItems);
    }
    
    // Обновляем поля, если нашли соответствие
    if (matchingItem) {
      let wasUpdated = false;
      
      // Обновляем weight
      if (matchingItem.weightGuess && product.weight !== matchingItem.weightGuess) {
        product.weight = matchingItem.weightGuess;
        wasUpdated = true;
      }
      
      // Обновляем flavors
      const flavors = extractFlavors(matchingItem.productNameGuess);
      if (flavors.length > 0 && (!product.flavors || product.flavors.length === 0)) {
        product.flavors = flavors;
        wasUpdated = true;
      }
      
      // Обновляем type
      const type = extractType(matchingItem.productNameGuess);
      if (type && product.type !== type) {
        product.type = type;
        wasUpdated = true;
      }
      
      // Обновляем tags
      const newTags = createTags(
        product.category,
        product.brand,
        matchingItem.productNameGuess,
        product.weight || matchingItem.weightGuess,
        product.flavors || flavors,
        product.type || type
      );
      if (JSON.stringify(product.tags) !== JSON.stringify(newTags)) {
        product.tags = newTags;
        wasUpdated = true;
      }
      
      if (wasUpdated && !updatedProductsList.find(p => p.id === product.id)) {
        updatedProducts++;
        updatedProductsList.push({
          id: product.id,
          action: 'updated_fields'
        });
      }
      
      // Удаляем из отчета, чтобы не добавлять повторно
      const index = reportItems.indexOf(matchingItem);
      if (index > -1) {
        reportItems.splice(index, 1);
      }
    }
  }
  
  // Добавляем новые товары из отчета
  console.log('\nДобавляю новые товары из отчета...');
  
  for (const item of reportItems) {
    // Определяем категорию
    const category = mapCategory(item.categoryGuess);
    
    // Проверяем, существует ли категория
    if (!productsData.categories[category]) {
      // Создаем новую категорию
      const categoryName = item.categoryGuess.replace(/^\d+\s+/, '').trim() || 'Конфеты';
      productsData.categories[category] = {
        id: category,
        nameRu: categoryName,
        nameEn: categoryName,
        icon: `assets/images/categories/${category}.webp`
      };
      console.log(`  + Создана категория: ${category}`);
    }
    
    // Нормализуем бренд
    const brand = normalizeBrand(BRAND_NAME_MAP[item.brandGuess] || item.brandGuess);
    
    // Извлекаем информацию
    const flavors = extractFlavors(item.productNameGuess);
    const type = extractType(item.productNameGuess);
    
    // Создаем название
    const productName = createProductName(item.productNameGuess, brand);
    
    // Проверяем похожесть ID
    let finalId = item.suggestedId;
    const similarId = isSimilarId(finalId, Array.from(existingIds));
    if (similarId && similarId !== finalId) {
      // Используем существующий ID, но добавляем legacyId
      finalId = similarId;
    }
    
    // Преобразуем абсолютный путь в относительный
    const relativeImagePath = path.relative(projectRoot, item.suggestedTargetImage).replace(/\\/g, '/');
    
    // Проверяем, не существует ли уже товар с таким ID
    if (existingIds.has(finalId)) {
      continue; // Пропускаем, если уже есть
    }
    
    // Создаем новый товар
    const newProduct = {
      id: finalId,
      name: productName,
      nameRu: productName,
      nameEn: productName,
      category: category,
      brand: brand,
      image: relativeImagePath,
      descriptionKey: finalId.replace(/-/g, '_'),
      descriptionTextKey: finalId.replace(/-/g, '_') + '_filling_text',
      titleKey: 'card__popular-item',
      tags: createTags(category, brand, item.productNameGuess, item.weightGuess, flavors, type)
    };
    
    // Добавляем новые поля
    if (item.weightGuess) {
      newProduct.weight = item.weightGuess;
    }
    if (flavors.length > 0) {
      newProduct.flavors = flavors;
    }
    if (type) {
      newProduct.type = type;
    }
    
    // Если использовали существующий ID, добавляем legacyId
    if (similarId && similarId !== item.suggestedId) {
      newProduct.legacyId = item.suggestedId;
    }
    
    productsData.products.push(newProduct);
    existingIds.add(finalId);
    addedProducts++;
    addedProductsList.push(newProduct);
  }
  
  // Проверяем бренды
  console.log('\nПроверяю бренды...');
  const brandNames = new Set(productsData.products.map(p => normalizeBrand(p.brand)));
  const existingBrandIds = new Set(productsData.brands.map(b => b.id));
  const addedBrands = [];
  
  for (const brandName of brandNames) {
    const brandId = brandName.toLowerCase().replace(/\s+/g, '-');
    
    if (!existingBrandIds.has(brandId)) {
      // Создаем новый бренд
      const newBrand = {
        id: brandId,
        name: brandName,
        logo: `assets/images/products/brand_logo/${brandId}.webp`,
        logoHover: `assets/images/products/brand_logo/${brandId}-hover.webp`,
        logoActive: `assets/images/products/brand_logo/${brandId}-active.webp`
      };
      productsData.brands.push(newBrand);
      existingBrandIds.add(brandId);
      addedBrands.push(brandName);
      console.log(`  + Добавлен бренд: ${brandName} (${brandId})`);
    }
  }
  
  // Проверяем логотипы брендов
  const missingLogos = [];
  for (const brand of productsData.brands) {
    const logoPath = path.join(projectRoot, brand.logo);
    if (!fs.existsSync(logoPath)) {
      missingLogos.push(brand.logo);
    }
    if (brand.logoHover && !fs.existsSync(path.join(projectRoot, brand.logoHover))) {
      missingLogos.push(brand.logoHover);
    }
    if (brand.logoActive && !fs.existsSync(path.join(projectRoot, brand.logoActive))) {
      missingLogos.push(brand.logoActive);
    }
  }
  
  if (missingLogos.length > 0) {
    console.warn(`\n⚠ Найдено ${missingLogos.length} отсутствующих логотипов брендов`);
  }
  
  // Сохраняем обновленный JSON
  try {
    fs.writeFileSync(productsJsonPath, JSON.stringify(productsData, null, 2), 'utf8');
    console.log(`\n✓ products.json обновлен`);
  } catch (error) {
    console.error('Ошибка при сохранении products.json:', error.message);
    process.exit(1);
  }
  
  // Валидация
  console.log('\nВалидация...');
  try {
    const validationContent = fs.readFileSync(productsJsonPath, 'utf8');
    const validated = JSON.parse(validationContent);
    console.log('✓ JSON валиден');
    
    // Проверяем существование всех изображений
    let missingImages = 0;
    for (const product of validated.products) {
      const imagePath = path.join(projectRoot, product.image);
      if (!fs.existsSync(imagePath)) {
        missingImages++;
      }
    }
    
    if (missingImages > 0) {
      console.warn(`⚠ Найдено ${missingImages} товаров с отсутствующими изображениями`);
    } else {
      console.log('✓ Все изображения существуют');
    }
  } catch (error) {
    console.error('Ошибка валидации:', error.message);
    process.exit(1);
  }
  
  // Выводим итоги
  console.log('\n' + '='.repeat(80));
  console.log('=== ИТОГОВЫЙ ОТЧЕТ ===');
  console.log('='.repeat(80));
  console.log(`Всего товаров: ${productsData.products.length}`);
  console.log(`Добавлено новых товаров: ${addedProducts}`);
  console.log(`Обновлено существующих товаров: ${updatedProducts}`);
  console.log(`Исправлено путей изображений: ${fixedPaths}`);
  console.log(`Отсутствующих файлов (до исправления): ${missingFiles}`);
  
  if (addedBrands.length > 0) {
    console.log(`\nДобавлено брендов: ${addedBrands.length}`);
    console.log('Бренды:', addedBrands.join(', '));
  }
  
  const newCategories = Object.keys(productsData.categories).filter(cat => {
    const original = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    return !original.categories[cat];
  });
  if (newCategories.length > 0) {
    console.log(`\nДобавлено категорий: ${newCategories.length}`);
    console.log('Категории:', newCategories.join(', '));
  }
  
  // Показываем примеры
  if (addedProductsList.length > 0) {
    console.log('\nПримеры добавленных товаров:');
    addedProductsList.slice(0, 5).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name} (${p.id})`);
      console.log(`   Бренд: ${p.brand}, Категория: ${p.category}`);
      console.log(`   Изображение: ${p.image}`);
      if (p.weight) console.log(`   Вес: ${p.weight}`);
      if (p.flavors && p.flavors.length > 0) console.log(`   Вкусы: ${p.flavors.join(', ')}`);
      if (p.type) console.log(`   Тип: ${p.type}`);
    });
  }
  
  if (updatedProductsList.length > 0) {
    console.log('\nПримеры обновленных товаров:');
    updatedProductsList.slice(0, 5).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.id}`);
      if (p.oldImage) console.log(`   Исправлен путь: ${p.oldImage} → ${p.newImage}`);
      if (p.action === 'updated_fields') console.log(`   Обновлены поля: weight, flavors, type, tags`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✓ Синхронизация завершена!');
}

// Запуск
main();
