const fs = require('fs');
const path = require('path');

// Импортируем функции из display-products-by-categories.js
const { scanDirectory, cleanProductName, removeProductCode } = require('./display-products-by-categories');

// Маппинг брендов из папок в бренды products.json
const BRAND_MAP = {
  'TAYAS': 'TAYAS',
  'PAKEL': 'PAKEL',
  'ALIKHAN-ATA': 'SULIFA', // Alikhan Ata использует SULIFA
  'PUFFICO': 'PUFFI',
  'OSLO': 'OSLO',
  'LOVE-ME': 'LOVE ME',
  'PANDA-LEE': 'PANDA LEE',
  'NAVROZ': 'NAVROZ',
  'CRAFERS': 'CRAFERS'
};

// Маппинг категорий из foods в категории products.json
const CATEGORY_MAP = {
  'Мармелады': 'marmalade',
  'Жевательные конфеты': 'candy',
  'Конфеты': 'candy',
  'Шоколады': 'chocolate',
  'Драже': 'candy',
  'Лукум': 'candy',
  'Желейные десерты': 'jelly',
  'Бисквитные пирожные': 'cookies',
  'Хрустящие трубочки': 'cookies',
  'Другое': 'candy'
};

// Функция для создания slug из строки
function createSlug(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => {
      const map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Функция для извлечения веса из названия
function extractWeight(text) {
  if (!text) return null;
  
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|gram|grams)/gi,
    /(\d+(?:[.,]\d+)?)\s*кг/gi
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const match = matches[0];
      let weight = match.replace(/[^\d.,]/g, '').replace(',', '.');
      const isKg = /кг/i.test(match);
      if (isKg) {
        const numWeight = parseFloat(weight);
        if (isNaN(numWeight)) continue;
        weight = (numWeight * 1000).toString();
      } else {
        const numWeight = parseFloat(weight);
        if (isNaN(numWeight)) continue;
        weight = numWeight.toString();
      }
      weight = weight.replace(/\.0+$/, '').replace(/^0+/, '');
      if (weight === '' || weight === '0') return null;
      return weight + 'gr';
    }
  }
  
  return null;
}

// Функция для извлечения вкусов и типов из названия
function extractTagsFromName(name, category) {
  const tags = [];
  const nameLower = name.toLowerCase();
  
  // Вкусы
  const flavors = {
    'арбуз': ['арбуз', 'watermelon'],
    'клубника': ['клубника', 'strawberry'],
    'яблоко': ['яблоко', 'apple'],
    'апельсин': ['апельсин', 'orange'],
    'виноград': ['виноград', 'grape'],
    'вишня': ['вишня', 'cherry'],
    'малина': ['малина', 'raspberry'],
    'ежевика': ['ежевика', 'blackberry'],
    'кола': ['кола', 'cola'],
    'ананас': ['ананас', 'pineapple'],
    'кокос': ['кокос', 'coconut'],
    'ваниль': ['ваниль', 'vanilla'],
    'шоколад': ['шоколад', 'chocolate'],
    'кофе': ['кофе', 'coffee'],
    'радуга': ['радуга', 'rainbow'],
    'ассорти': ['ассорти', 'assortment'],
    'тропик': ['тропик', 'tropical'],
    'голубика': ['голубика', 'blueberry'],
    'пона-колада': ['пина колада', 'pina colada']
  };
  
  for (const [key, tagPair] of Object.entries(flavors)) {
    if (nameLower.includes(key)) {
      tags.push(...tagPair);
    }
  }
  
  // Типы продуктов
  const types = {
    'ремешки': ['ремешки', 'belts', 'ремни'],
    'карандаши': ['карандаши', 'pencils'],
    'мишки': ['мишки', 'bears', 'gummy'],
    'трубочки': ['трубочки', 'tubes'],
    'вафли': ['вафли', 'wafers'],
    'печенье': ['печенье', 'cookies'],
    'конфеты': ['конфеты', 'candy'],
    'мармелад': ['мармелад', 'marmalade'],
    'шоколад': ['шоколад', 'chocolate'],
    'драже': ['драже', 'dragee'],
    'лукум': ['лукум', 'lokum'],
    'паста': ['паста', 'paste']
  };
  
  for (const [key, tagPair] of Object.entries(types)) {
    if (nameLower.includes(key)) {
      tags.push(...tagPair);
    }
  }
  
  // Специальные характеристики
  if (nameLower.includes('кисл')) {
    tags.push('кислые', 'sour');
  }
  if (nameLower.includes('жевательн')) {
    tags.push('жевательные', 'chewy');
  }
  if (nameLower.includes('хрустящ')) {
    tags.push('хрустящие', 'crispy');
  }
  if (nameLower.includes('молочн')) {
    tags.push('молочный', 'milk');
  }
  
  // Категорийные теги
  if (category === 'marmalade') {
    if (!tags.some(t => t.includes('мармелад') || t.includes('marmalade'))) {
      tags.push('мармелад', 'marmalade');
    }
  } else if (category === 'candy') {
    if (!tags.some(t => t.includes('конфет') || t.includes('candy'))) {
      tags.push('конфеты', 'candy');
    }
  } else if (category === 'chocolate') {
    if (!tags.some(t => t.includes('шоколад') || t.includes('chocolate'))) {
      tags.push('шоколад', 'chocolate');
    }
  } else if (category === 'cookies') {
    if (!tags.some(t => t.includes('печенье') || t.includes('cookies'))) {
      tags.push('печенье', 'cookies');
    }
  } else if (category === 'jelly') {
    if (!tags.some(t => t.includes('желейн') || t.includes('jelly'))) {
      tags.push('желейные', 'jelly');
    }
  }
  
  // Удаляем дубликаты
  return [...new Set(tags)];
}

// Функция для создания ID продукта
function createProductId(brand, name, weight) {
  const brandSlug = createSlug(brand);
  const nameSlug = createSlug(name);
  const weightSlug = weight ? createSlug(weight) : '';
  
  const parts = [brandSlug, nameSlug];
  if (weightSlug) {
    parts.push(weightSlug);
  }
  
  return parts.filter(p => p).join('-');
}

// Функция для копирования изображения из foods в assets/images/products
function copyImageToProducts(imagePath, foodsDir, projectRoot, productId) {
  const imageName = path.basename(imagePath);
  const baseName = path.basename(imagePath, '.webp');
  
  // Определяем целевую папку на основе productId
  const targetFolder = createSlug(productId) || createSlug(baseName);
  const targetDir = path.join(projectRoot, 'assets', 'images', 'products', targetFolder);
  const targetImage = path.join(targetDir, targetFolder + '.webp');
  
  // Создаем директорию, если её нет
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Проверяем, существует ли уже файл
  if (fs.existsSync(targetImage)) {
    // Файл уже существует, возвращаем путь к нему
    return path.relative(projectRoot, targetImage).replace(/\\/g, '/');
  }
  
  // Копируем файл
  try {
    fs.copyFileSync(imagePath, targetImage);
    return path.relative(projectRoot, targetImage).replace(/\\/g, '/');
  } catch (error) {
    console.error(`   ❌ Ошибка при копировании ${imagePath}:`, error.message);
    // В случае ошибки возвращаем путь, который должен быть
    return 'assets/images/products/' + targetFolder + '/' + targetFolder + '.webp';
  }
}

// Функция для определения пути к изображению
function getImagePath(imagePath, foodsDir, projectRoot, productName, productId) {
  const imageName = path.basename(imagePath);
  const baseName = path.basename(imagePath, '.webp');
  const cleanBaseName = cleanProductName(baseName);
  
  // Пробуем разные варианты названия папки
  const folderVariants = [
    createSlug(productId),
    createSlug(cleanBaseName),
    createSlug(productName),
    createSlug(baseName)
  ];
  
  // Ищем существующий файл в assets/images/products
  for (const folderName of folderVariants) {
    if (!folderName) continue;
    
    const possiblePaths = [
      path.join(projectRoot, 'assets', 'images', 'products', folderName, imageName),
      path.join(projectRoot, 'assets', 'images', 'products', folderName, folderName + '.webp'),
      path.join(projectRoot, 'assets', 'images', 'products', folderName, baseName + '.webp')
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return path.relative(projectRoot, possiblePath).replace(/\\/g, '/');
      }
    }
  }
  
  // Проверяем старую структуру assets/images
  const oldPaths = [
    path.join(projectRoot, 'assets', 'images', cleanBaseName, imageName),
    path.join(projectRoot, 'assets', 'images', baseName, imageName)
  ];
  
  for (const oldPath of oldPaths) {
    if (fs.existsSync(oldPath)) {
      return path.relative(projectRoot, oldPath).replace(/\\/g, '/');
    }
  }
  
  // Если не нашли, копируем изображение из foods
  return copyImageToProducts(imagePath, foodsDir, projectRoot, productId);
}

// Функция для перевода названия на английский
function translateToEnglish(name) {
  // Простые переводы
  const translations = {
    'клубника': 'Strawberry',
    'арбуз': 'Watermelon',
    'яблоко': 'Apple',
    'апельсин': 'Orange',
    'виноград': 'Grape',
    'вишня': 'Cherry',
    'малина': 'Raspberry',
    'ежевика': 'Blackberry',
    'кола': 'Cola',
    'ананас': 'Pineapple',
    'кокос': 'Coconut',
    'ваниль': 'Vanilla',
    'шоколад': 'Chocolate',
    'кофе': 'Coffee',
    'радуга': 'Rainbow',
    'ассорти': 'Assortment',
    'ремешки': 'Belts',
    'карандаши': 'Pencils',
    'мишки': 'Bears',
    'трубочки': 'Tubes'
  };
  
  let translated = name;
  for (const [ru, en] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(ru, 'gi'), en);
  }
  
  return translated || name;
}

// Основная функция
function main() {
  // Определяем корень проекта
  let projectRoot = __dirname;
  for (let i = 0; i < 10; i++) {
    const testPath = path.join(projectRoot, 'data', 'products.json');
    if (fs.existsSync(testPath)) {
      break;
    }
    const parent = path.join(projectRoot, '..');
    if (parent === projectRoot) break;
    projectRoot = parent;
  }
  
  const foodsDir = path.join(projectRoot, 'foods');
  const productsFile = path.join(projectRoot, 'data', 'products.json');
  
  if (!fs.existsSync(foodsDir)) {
    console.error('❌ Директория foods не найдена!');
    process.exit(1);
  }
  
  if (!fs.existsSync(productsFile)) {
    console.error('❌ Файл products.json не найден!');
    process.exit(1);
  }
  
  console.log('🔍 Начинаю сканирование директории foods...');
  console.log(`📂 Путь: ${foodsDir}\n`);
  
  // Сканируем директорию
  const scannedProducts = scanDirectory(foodsDir, foodsDir);
  console.log(`✅ Найдено продуктов: ${scannedProducts.length}\n`);
  
  // Загружаем существующие продукты
  console.log('📖 Загружаю существующие продукты...');
  const productsData = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
  const existingProducts = productsData.products || [];
  const existingIds = new Set(existingProducts.map(p => p.id));
  const existingImagePaths = new Set(existingProducts.map(p => p.image));
  
  console.log(`✅ Загружено существующих продуктов: ${existingProducts.length}\n`);
  
  // Обрабатываем найденные продукты
  const newProducts = [];
  const skippedProducts = [];
  let copiedImages = 0;
  
  console.log('🔄 Обрабатываю найденные продукты...\n');
  
  for (const scannedProduct of scannedProducts) {
    // Маппим категорию
    const categoryId = CATEGORY_MAP[scannedProduct.category] || 'candy';
    
    // Маппим бренд
    const brand = BRAND_MAP[scannedProduct.brand] || scannedProduct.brand;
    
    // Очищаем название
    let productName = scannedProduct.name;
    productName = cleanProductName(productName);
    
    // Извлекаем вес
    const weight = extractWeight(productName + ' ' + scannedProduct.path);
    
    // Создаем ID
    let productId = createProductId(brand, productName, weight);
    
    // Проверяем, не существует ли уже такой продукт
    if (existingIds.has(productId)) {
      // Пробуем добавить суффикс
      let counter = 1;
      let newId = productId;
      while (existingIds.has(newId) || newProducts.some(p => p.id === newId)) {
        newId = productId + '-' + counter;
        counter++;
      }
      productId = newId;
    }
    
    // Определяем путь к изображению (автоматически копирует, если нужно)
    const mainImage = scannedProduct.images[0];
    let imagePath = getImagePath(mainImage.path, foodsDir, projectRoot, productName, productId);
    
    // Проверяем, существует ли файл по этому пути
    const fullImagePath = path.join(projectRoot, imagePath);
    if (!fs.existsSync(fullImagePath)) {
      // Если файл все еще не найден, пробуем скопировать напрямую
      const originalPath = imagePath;
      imagePath = copyImageToProducts(mainImage.path, foodsDir, projectRoot, productId);
      if (imagePath !== originalPath) {
        copiedImages++;
      }
    }
    
    // Проверяем, не используется ли уже это изображение
    if (existingImagePaths.has(imagePath)) {
      skippedProducts.push({
        name: productName,
        reason: 'Изображение уже используется другим продуктом'
      });
      continue;
    }
    
    // Создаем теги
    const tags = extractTagsFromName(productName, categoryId);
    
    // Создаем новый продукт
    const newProduct = {
      id: productId,
      name: productName,
      nameRu: productName,
      nameEn: translateToEnglish(productName),
      category: categoryId,
      brand: brand,
      image: imagePath,
      descriptionKey: productId.replace(/-/g, '_'),
      descriptionTextKey: productId.replace(/-/g, '_') + '_filling_text',
      titleKey: 'card__popular-item',
      tags: tags
    };
    
    // Добавляем вес, если есть
    if (weight) {
      newProduct.weight = weight;
    }
    
    newProducts.push(newProduct);
    existingIds.add(productId);
    existingImagePaths.add(imagePath);
  }
  
  // Добавляем новые продукты
  productsData.products = [...existingProducts, ...newProducts];
  
  // Обновляем бренды, если нужно
  const brandNames = new Set(productsData.products.map(p => p.brand));
  const existingBrandIds = new Set((productsData.brands || []).map(b => b.id));
  
  for (const brandName of brandNames) {
    const brandSlug = createSlug(brandName);
    if (!existingBrandIds.has(brandSlug)) {
      if (!productsData.brands) {
        productsData.brands = [];
      }
      productsData.brands.push({
        id: brandSlug,
        name: brandName,
        logo: `assets/images/products/brand_logo/${brandSlug}.webp`,
        logoHover: `assets/images/products/brand_logo/${brandSlug}-hover.webp`,
        logoActive: `assets/images/products/brand_logo/${brandSlug}-active.webp`
      });
      existingBrandIds.add(brandSlug);
    }
  }
  
  // Сохраняем обновленный файл
  console.log(`\n💾 Сохраняю обновленный products.json...`);
  fs.writeFileSync(productsFile, JSON.stringify(productsData, null, 2), 'utf8');
  
  // Выводим статистику
  console.log('\n' + '='.repeat(80));
  console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА');
  console.log('='.repeat(80));
  console.log(`\n📊 Статистика:`);
  console.log(`   • Всего найдено продуктов: ${scannedProducts.length}`);
  console.log(`   • Добавлено новых продуктов: ${newProducts.length}`);
  console.log(`   • Пропущено продуктов: ${skippedProducts.length}`);
  console.log(`   • Скопировано изображений: ${copiedImages}`);
  console.log(`   • Всего продуктов в файле: ${productsData.products.length}`);
  console.log(`   • Всего брендов: ${productsData.brands.length}`);
  
  if (skippedProducts.length > 0) {
    console.log(`\n⚠️  Пропущенные продукты:`);
    for (const skipped of skippedProducts.slice(0, 10)) {
      console.log(`   • ${skipped.name} - ${skipped.reason}`);
    }
    if (skippedProducts.length > 10) {
      console.log(`   ... и еще ${skippedProducts.length - 10} продуктов`);
    }
  }
  
  if (newProducts.length > 0) {
    console.log(`\n✨ Примеры добавленных продуктов:`);
    for (const product of newProducts.slice(0, 5)) {
      console.log(`   • ${product.name} (${product.id})`);
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = { main };

