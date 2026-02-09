const fs = require('fs');
const path = require('path');

// Пытаемся использовать fast-glob, если доступен
let glob;
try {
  glob = require('fast-glob').glob;
} catch (e) {
  // Fallback на рекурсивное сканирование через fs
  glob = null;
}

// Настройки
const PROJECT_ROOT = path.resolve(__dirname, '..');
const FOODS_DIR = path.join(PROJECT_ROOT, 'foods');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const REPORT_PATH = path.join(__dirname, 'aggressive-scan-report.json');
const BACKUP_PATH = path.join(PROJECT_ROOT, 'data', 'products.backup-aggressive.json');

// Поддержка изображений
const IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg'];

// Маппинги для нормализации
const BRAND_MAP = {
  'tayas': 'TAYAS',
  'pakel': 'PAKEL',
  'damla': 'DAMLA',
  'jimmy': 'JIMMY',
  'kidzi': 'KIDZI',
  'miskets': 'MISKETS',
  'love-me': 'LOVE ME',
  'love me': 'LOVE ME',
  'panda-lee': 'PANDA LEE',
  'panda lee': 'PANDA LEE',
  'navroz': 'NAVROZ',
  'crafers': 'CRAFERS',
  'oslo': 'OSLO',
  'alikhan-ata': 'ALIKHAN ATA',
  'alikhan ata': 'ALIKHAN ATA',
  'puffico': 'PUFFI',
  'puffi': 'PUFFI',
  'bonjuks': 'BONJUKS',
  'miniyum': 'MINIYUM',
  'sulifa': 'SULIFA'
};

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
  'lokum': 'candy',
  'пирожное': 'cookies',
  'бисквитное пирожное': 'cookies',
  'десерт': 'jelly',
  'желейный десерт': 'jelly',
  'печенье': 'cookies',
  'вафли': 'cookies',
  'wafers': 'cookies'
};

const TYPE_MAP = {
  'ремешки': 'belts',
  'ремни': 'belts',
  'belts': 'belts',
  'карандаши': 'pencils',
  'pencils': 'pencils',
  'мишки': 'bears',
  'bears': 'bears',
  'mishki': 'bears',
  'трубочки': 'tubes',
  'tubes': 'tubes',
  'вафли': 'wafers',
  'wafers': 'wafers',
  'печенье': 'cookies',
  'cookies': 'cookies',
  'конфеты': 'candies',
  'candies': 'candies',
  'мармелад': 'marmalade',
  'marmalade': 'marmalade',
  'шоколад': 'chocolate',
  'chocolate': 'chocolate',
  'драже': 'dragee',
  'dragee': 'dragee',
  'лукум': 'lokum',
  'lokum': 'lokum',
  'паста': 'paste',
  'paste': 'paste',
  'кубики': 'cubes',
  'cubes': 'cubes',
  'кубы': 'cubes'
};

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
  'пина колада': 'pina-colada',
  'малина-ежевика': 'raspberry-blackberry',
  'ананас-кокос': 'pineapple-coconut',
  'кислый': 'sour',
  'sour': 'sour',
  'кислые': 'sour'
};

// Функции извлечения данных
function extractBrand(filePath, fileName) {
  const parts = filePath.split(path.sep);
  const allText = [...parts, fileName].join(' ').toLowerCase();
  
  for (const [key, value] of Object.entries(BRAND_MAP)) {
    if (allText.includes(key)) {
      return { brand: value, confidence: 0.9 };
    }
  }
  
  // Попытка найти бренд в верхних уровнях папок
  for (let i = 0; i < Math.min(3, parts.length); i++) {
    const part = parts[i].toLowerCase().replace(/^\d+\s*/, '').trim();
    if (part && part.length > 2) {
      // Проверяем, не является ли это брендом
      const normalized = part.replace(/[^a-zа-я]/g, '');
      if (normalized.length >= 3) {
        return { brand: normalized.toUpperCase(), confidence: 0.6 };
      }
    }
  }
  
  return { brand: 'UNKNOWN', confidence: 0.3 };
}

function extractCategory(filePath, fileName) {
  const allText = [...filePath.split(path.sep), fileName].join(' ').toLowerCase();
  
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (allText.includes(key)) {
      return { category: value, confidence: 0.9 };
    }
  }
  
  return { category: 'candy', confidence: 0.5 };
}

function extractType(filePath, fileName) {
  const allText = [...filePath.split(path.sep), fileName].join(' ').toLowerCase();
  
  for (const [key, value] of Object.entries(TYPE_MAP)) {
    if (allText.includes(key)) {
      return { type: value, confidence: 0.9 };
    }
  }
  
  return { type: null, confidence: 0 };
}

function extractWeight(text) {
  if (!text) return { weight: null, confidence: 0 };
  
  // Паттерны для веса
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|gram|grams)/gi,
    /(\d+(?:[.,]\d+)?)\s*кг/gi,
    /(\d+)\s*(?:g|G)/g
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const match = matches[0];
      let weight = match.replace(/[^\d.,]/g, '').replace(',', '.');
      const isKg = /кг/i.test(match);
      
      if (isKg) {
        const numWeight = parseFloat(weight);
        if (!isNaN(numWeight)) {
          weight = (numWeight * 1000).toString();
        }
      } else {
        const numWeight = parseFloat(weight);
        if (!isNaN(numWeight)) {
          weight = numWeight.toString();
        }
      }
      
      weight = weight.replace(/\.0+$/, '').replace(/^0+/, '');
      if (weight && weight !== '0') {
        return { weight: weight + 'gr', confidence: 0.9 };
      }
    }
  }
  
  return { weight: null, confidence: 0 };
}

function extractFlavors(filePath, fileName) {
  const allText = [...filePath.split(path.sep), fileName].join(' ').toLowerCase();
  const flavors = [];
  
  // Сначала составные вкусы
  const compoundFlavors = [
    { ru: 'малина-ежевика', en: 'raspberry-blackberry' },
    { ru: 'пона-колада', en: 'pina-colada' },
    { ru: 'пина колада', en: 'pina-colada' },
    { ru: 'ананас-кокос', en: 'pineapple-coconut' }
  ];
  
  for (const compound of compoundFlavors) {
    if (allText.includes(compound.ru)) {
      flavors.push(compound.ru);
      flavors.push(compound.en);
      return { flavors, confidence: 0.9 };
    }
  }
  
  // Простые вкусы
  for (const [ru, en] of Object.entries(FLAVOR_MAP)) {
    if (allText.includes(ru) && !flavors.includes(ru)) {
      flavors.push(ru);
      flavors.push(en);
    }
  }
  
  return { flavors, confidence: flavors.length > 0 ? 0.8 : 0 };
}

function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

function generateProductId(brand, fileName, weight, type) {
  const parts = [];
  
  if (brand && brand !== 'UNKNOWN') {
    parts.push(brand.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  }
  
  const nameSlug = createSlug(fileName.replace(/\.[^.]+$/, ''));
  if (nameSlug) {
    parts.push(nameSlug);
  }
  
  if (type) {
    parts.push(type);
  }
  
  if (weight) {
    parts.push(weight.replace(/[^0-9]/g, '') + 'gr');
  }
  
  return parts.join('-').substring(0, 150);
}

function calculateConfidence(detected) {
  let score = 0;
  let factors = 0;
  
  if (detected.brand && detected.brand !== 'UNKNOWN') {
    score += 0.3;
    factors++;
  }
  
  if (detected.category) {
    score += 0.2;
    factors++;
  }
  
  if (detected.type) {
    score += 0.2;
    factors++;
  }
  
  if (detected.weight) {
    score += 0.15;
    factors++;
  }
  
  if (detected.flavors && detected.flavors.length > 0) {
    score += 0.15;
    factors++;
  }
  
  return factors > 0 ? score / factors : 0.3;
}

// Рекурсивное сканирование через fs (fallback)
function scanDirectoryRecursive(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectoryRecursive(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  
  return fileList;
}

// Основная функция сканирования
async function scanAllFiles() {
  console.log('🔍 Начинаю агрессивное сканирование всех файлов...\n');
  
  let files;
  
  if (glob) {
    // Используем fast-glob
    const patterns = IMAGE_EXTENSIONS.map(ext => `**/*${ext}`);
    files = await glob(patterns, {
      cwd: FOODS_DIR,
      absolute: true,
      caseSensitiveMatch: false
    });
  } else {
    // Используем рекурсивное сканирование
    console.log('⚠ Используется fallback-метод сканирования (fast-glob не найден)\n');
    files = scanDirectoryRecursive(FOODS_DIR);
  }
  
  console.log(`📁 Найдено файлов: ${files.length}\n`);
  
  const results = [];
  
  for (const filePath of files) {
    const relativePath = path.relative(FOODS_DIR, filePath);
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);
    const dirName = path.basename(dirPath);
    
    // Извлекаем данные
    const brandData = extractBrand(relativePath, fileName);
    const categoryData = extractCategory(relativePath, fileName);
    const typeData = extractType(relativePath, fileName);
    const weightData = extractWeight(relativePath + ' ' + fileName);
    const flavorsData = extractFlavors(relativePath, fileName);
    
    const detected = {
      brand: brandData.brand,
      category: categoryData.category,
      type: typeData.type,
      weight: weightData.weight,
      flavors: flavorsData.flavors
    };
    
    const confidence = calculateConfidence(detected);
    
    const productId = generateProductId(
      detected.brand,
      fileName,
      detected.weight,
      detected.type
    );
    
    // Создаем путь для изображения
    const imageDir = path.join(
      PROJECT_ROOT,
      'assets',
      'images',
      'products',
      productId
    );
    const imagePath = path.join(imageDir, fileName);
    
    results.push({
      sourcePath: filePath,
      relativePath: relativePath,
      fileName: fileName,
      productId: productId,
      detected: detected,
      confidence: confidence,
      targetImagePath: imagePath,
      targetImageDir: imageDir
    });
  }
  
  // Сохраняем отчет
  fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`✅ Отчет сохранен: ${REPORT_PATH}\n`);
  
  return results;
}

// Функция синхронизации с products.json
function syncWithProductsJson(scanResults) {
  console.log('📦 Синхронизация с products.json...\n');
  
  // Читаем текущий products.json
  let productsData;
  try {
    const content = fs.readFileSync(PRODUCTS_JSON, 'utf8');
    productsData = JSON.parse(content);
  } catch (error) {
    console.error('❌ Ошибка при чтении products.json:', error.message);
    process.exit(1);
  }
  
  // Создаем backup
  fs.copyFileSync(PRODUCTS_JSON, BACKUP_PATH);
  console.log(`💾 Backup создан: ${BACKUP_PATH}\n`);
  
  const beforeCount = productsData.products.length;
  const existingIds = new Set(productsData.products.map(p => p.id));
  const existingPaths = new Set(productsData.products.map(p => p.sourcePath || ''));
  
  let added = 0;
  let updated = 0;
  const newBrands = new Set();
  const newCategories = new Set();
  const lowConfidence = [];
  
  // Обрабатываем каждый найденный файл
  for (const result of scanResults) {
    const { detected, productId, sourcePath, fileName, confidence, targetImagePath, targetImageDir } = result;
    
    // Проверяем confidence
    if (confidence < 0.6) {
      lowConfidence.push({
        productId,
        fileName,
        confidence,
        detected
      });
    }
    
    // Проверяем, существует ли товар
    let existingProduct = productsData.products.find(p => 
      p.id === productId || 
      (p.sourcePath && p.sourcePath === sourcePath) ||
      (p.image && p.image.includes(fileName))
    );
    
    // Нормализуем бренд
    const normalizedBrand = detected.brand.toUpperCase().replace(/\s+/g, '');
    newBrands.add(normalizedBrand);
    
    // Добавляем категорию
    newCategories.add(detected.category);
    
    if (existingProduct) {
      // Обновляем существующий товар
      existingProduct.sourcePath = sourcePath;
      existingProduct.detectedMeta = detected;
      existingProduct.confidenceScore = confidence;
      existingProduct.importedBy = 'cursor-framework-mode';
      
      // Обновляем поля, если они отсутствуют
      if (!existingProduct.weight && detected.weight) {
        existingProduct.weight = detected.weight;
      }
      if (!existingProduct.type && detected.type) {
        existingProduct.type = detected.type;
      }
      if (!existingProduct.flavors && detected.flavors && detected.flavors.length > 0) {
        existingProduct.flavors = detected.flavors;
      }
      
      // Обновляем image путь
      const relativeImagePath = path.relative(PROJECT_ROOT, targetImagePath).replace(/\\/g, '/');
      if (!existingProduct.image || !fs.existsSync(path.join(PROJECT_ROOT, existingProduct.image))) {
        existingProduct.image = relativeImagePath;
      }
      
      updated++;
    } else {
      // Создаем новый товар
      const relativeImagePath = path.relative(PROJECT_ROOT, targetImagePath).replace(/\\/g, '/');
      
      const newProduct = {
        id: productId,
        name: fileName.replace(/\.[^.]+$/, ''),
        nameRu: fileName.replace(/\.[^.]+$/, ''),
        nameEn: fileName.replace(/\.[^.]+$/, ''),
        category: detected.category,
        brand: normalizedBrand,
        image: relativeImagePath,
        descriptionKey: productId.replace(/-/g, '_'),
        descriptionTextKey: productId.replace(/-/g, '_') + '_filling_text',
        titleKey: 'card__popular-item',
        tags: [
          detected.category,
          normalizedBrand.toLowerCase(),
          ...(detected.type ? [detected.type] : []),
          ...(detected.flavors || []),
          ...(detected.weight ? [detected.weight] : [])
        ].filter(Boolean),
        sourcePath: sourcePath,
        detectedMeta: detected,
        confidenceScore: confidence,
        importedBy: 'cursor-framework-mode'
      };
      
      if (detected.weight) {
        newProduct.weight = detected.weight;
      }
      if (detected.type) {
        newProduct.type = detected.type;
      }
      if (detected.flavors && detected.flavors.length > 0) {
        newProduct.flavors = detected.flavors;
      }
      
      productsData.products.push(newProduct);
      existingIds.add(productId);
      added++;
    }
  }
  
  // Обновляем бренды
  const existingBrandIds = new Set(productsData.brands.map(b => b.id));
  for (const brandName of newBrands) {
    const brandId = brandName.toLowerCase().replace(/\s+/g, '-');
    if (!existingBrandIds.has(brandId)) {
      productsData.brands.push({
        id: brandId,
        name: brandName,
        logo: `assets/images/products/brand_logo/${brandId}.webp`,
        logoHover: `assets/images/products/brand_logo/${brandId}-hover.webp`,
        logoActive: `assets/images/products/brand_logo/${brandId}-active.webp`
      });
      existingBrandIds.add(brandId);
    }
  }
  
  // Обновляем категории
  for (const categoryId of newCategories) {
    if (!productsData.categories[categoryId]) {
      productsData.categories[categoryId] = {
        id: categoryId,
        nameRu: categoryId,
        nameEn: categoryId,
        icon: `assets/images/categories/${categoryId}.webp`
      };
    }
  }
  
  // Сохраняем обновленный JSON
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');
  
  const afterCount = productsData.products.length;
  
  console.log('📊 СТАТИСТИКА:');
  console.log(`   Файлов найдено: ${scanResults.length}`);
  console.log(`   Товаров ДО: ${beforeCount}`);
  console.log(`   Товаров ПОСЛЕ: ${afterCount}`);
  console.log(`   Добавлено: ${added}`);
  console.log(`   Обновлено: ${updated}`);
  console.log(`   Новых брендов: ${newBrands.size}`);
  console.log(`   Новых категорий: ${newCategories.size}`);
  console.log(`   Товаров с низким confidence (<0.6): ${lowConfidence.length}\n`);
  
  return {
    filesFound: scanResults.length,
    beforeCount,
    afterCount,
    added,
    updated,
    newBrands: Array.from(newBrands),
    newCategories: Array.from(newCategories),
    lowConfidence
  };
}

// Генерация итогового отчета
function generateFinalReport(stats) {
  console.log('📋 ИТОГОВЫЙ ОТЧЕТ\n');
  console.log('='.repeat(80));
  console.log('СТАТИСТИКА ПО БРЕНДАМ, КАТЕГОРИЯМ, ТИПАМ И ВЕСУ:');
  console.log('='.repeat(80));
  
  // Загружаем обновленный products.json для анализа
  const productsData = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
  
  const statsMap = new Map();
  
  for (const product of productsData.products) {
    const key = `${product.brand || 'UNKNOWN'}|${product.category || 'unknown'}|${product.type || 'none'}|${product.weight || 'none'}`;
    statsMap.set(key, (statsMap.get(key) || 0) + 1);
  }
  
  console.log('\nБренд | Категория | Тип | Вес | Количество');
  console.log('-'.repeat(80));
  
  const sortedStats = Array.from(statsMap.entries()).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedStats) {
    const [brand, category, type, weight] = key.split('|');
    console.log(`${brand.padEnd(15)} | ${category.padEnd(12)} | ${type.padEnd(10)} | ${weight.padEnd(8)} | ${count}`);
  }
  
  if (stats.lowConfidence.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('ТОВАРЫ С НИЗКИМ CONFIDENCE SCORE (<0.6):');
    console.log('='.repeat(80));
    for (const item of stats.lowConfidence.slice(0, 20)) {
      console.log(`\nID: ${item.productId}`);
      console.log(`  Файл: ${item.fileName}`);
      console.log(`  Confidence: ${item.confidence.toFixed(2)}`);
      console.log(`  Detected:`, item.detected);
    }
    if (stats.lowConfidence.length > 20) {
      console.log(`\n... и еще ${stats.lowConfidence.length - 20} товаров`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ СКАНИРОВАНИЕ ЗАВЕРШЕНО');
  console.log('='.repeat(80));
}

// Главная функция
async function main() {
  try {
    const scanResults = await scanAllFiles();
    const stats = syncWithProductsJson(scanResults);
    generateFinalReport(stats);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

main();

