/**
 * ИМПОРТ ПРОДУКЦИИ ИЗ foods_normalized_v2
 * 
 * Импортирует товары из нормализованной структуры:
 * foods_normalized_v2/foods_normalized_v2/foods_normalized/{BRAND}/{SKU} - {NAME}/
 * 
 * Формат папки товара: "АРТИКУЛ - НАЗВАНИЕ" (например: "1420 - 1420 JIMMY SOUR BELT...")
 * 
 * Правила:
 * - Артикул извлекается из начала названия папки (до " - ")
 * - Грамовка извлекается из названия папки
 * - Название товара формируется: БРЕНД + название (без артикула и грамовки)
 * - Файлы "name.*" игнорируются (мусор)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Опциональные зависимости
let mammoth, pdfParse, textract, wordExtractor;

try {
  mammoth = require('mammoth');
} catch (e) {
  console.warn('⚠️  mammoth не установлен, парсинг DOCX отключен');
}

try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('⚠️  pdf-parse не установлен, парсинг PDF отключен');
}

try {
  textract = require('textract');
} catch (e) {
  // textract опционален
}

try {
  wordExtractor = require('word-extractor');
} catch (e) {
  // word-extractor опционален
}

// Конфигурация
const PROJECT_ROOT = path.resolve(__dirname, '..');
const NORMALIZED_DIR = path.join(PROJECT_ROOT, 'foods_normalized_v2', 'foods_normalized_v2', 'foods_normalized');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const OUT_DIR = path.join(PROJECT_ROOT, 'out');
const OUT_PRODUCTS_DIR = path.join(OUT_DIR, 'products');
const OUT_PRODUCTS_JSON = path.join(OUT_DIR, 'products.json');
const ISSUES_JSON = path.join(OUT_DIR, 'issues.json');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

// Маппинг брендов
const BRAND_MAP = {
  'tayas': 'TAYAS',
  'alikhan ata': 'ALIKHAN ATA',
  'crafers': 'CRAFERS',
  'love me tm': 'LOVE ME',
  'navroz': 'NAVROZ',
  'oslo': 'OSLO',
  'pakel': 'PAKEL',
  'panda lee tm': 'PANDA LEE',
  'puffico': 'PUFFI'
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

// Статистика
const stats = {
  totalFolders: 0,
  productsImported: 0,
  productsSkipped: 0,
  issuesFound: 0,
  missingMeta: 0,
  missingImages: 0,
  missingText: 0
};

const issues = [];
const products = [];

/**
 * Извлечение артикула из названия папки
 * Формат: "АРТИКУЛ - НАЗВАНИЕ"
 */
function extractSku(folderName) {
  const match = folderName.match(/^([A-Z0-9]+)\s*-\s*/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Извлечение грамовки из текста
 */
function extractWeight(text) {
  if (!text) return null;
  
  // Паттерны: "15 г", "90gr", "1000 г", "20гр", "75gr", "49,3 г", "49.3 г", "1 кг"
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|gram|grams|G|Г)/gi,
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
        return weight + 'gr';
      }
    }
  }
  
  return null;
}

/**
 * Нормализация имени товара
 */
function normalizeName(raw) {
  if (!raw) return '';
  
  let name = raw;
  
  // Заменить _ и множественные пробелы на один пробел
  name = name.replace(/[_\s]+/g, ' ');
  
  // Убрать кавычки «», лишние скобки по краям
  name = name.replace(/^[«»"']+|[«»"']+$/g, '');
  name = name.replace(/^[\(\)\[\]]+|[\(\)\[\]]+$/g, '');
  
  // Убрать служебные слова
  const serviceWords = ['текстовка', 'маркировка', 'состав', 'описание', 'этикетка', 
                        'text', 'marking', 'composition', 'description', 'label'];
  for (const word of serviceWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    name = name.replace(regex, '');
  }
  
  // Обрезать пробелы
  name = name.trim();
  name = name.replace(/\s+/g, ' ');
  
  return name;
}

/**
 * Извлечение названия товара из папки
 * Формат: "АРТИКУЛ - НАЗВАНИЕ"
 * Убираем артикул и грамовку, оставляем название
 */
function extractProductName(folderName, sku) {
  // Убираем артикул из начала (формат: "SKU - ...")
  let name = folderName.replace(/^[A-Z0-9]+\s*-\s*/, '');
  
  // Убираем повторяющийся артикул в начале названия
  if (sku && name.toUpperCase().startsWith(sku.toUpperCase())) {
    name = name.substring(sku.length).trim();
    // Убираем лишние пробелы, дефисы и запятые
    name = name.replace(/^[\s\-,]+/, '');
  }
  
  // Убираем служебную информацию (упаковка, шт, шб и т.д.) ПЕРЕД извлечением грамовки
  name = name.replace(/\s*(?:х|X|×)\s*\d+\s*(?:шт|шб|pcs|box|carton|бл|блок)/gi, ' ');
  name = name.replace(/\s*ТМ\s*[A-Z\s]+/gi, ' ');
  name = name.replace(/\s*№\s*[A-Z0-9]+/gi, ' ');
  name = name.replace(/\s*ок\s*(?:версия|версия)/gi, ' ');
  
  // Извлекаем грамовку для удаления
  const weight = extractWeight(name);
  if (weight) {
    // Убираем грамовку из названия (разные форматы)
    const weightValue = weight.replace('gr', '');
    // Паттерны: "18г", "18 г", "18г,", "18г,", "25GRX24", "42 гх"
    const weightPatterns = [
      new RegExp(`\\s*${weightValue}\\s*(?:г|gr|гр|Г|GR|кг|kg)[,хxXХ]*\\s*`, 'gi'),
      new RegExp(`\\s*${weightValue}\\s*(?:г|gr|гр|Г|GR|кг|kg)`, 'gi'),
      new RegExp(`\\s*,\\s*${weightValue}\\s*(?:г|gr|гр|Г|GR|кг|kg)`, 'gi')
    ];
    
    for (const pattern of weightPatterns) {
      name = name.replace(pattern, ' ');
    }
    
    // Также убираем паттерны типа "42 гх", "25GRX24", "1 кг"
    name = name.replace(/\d+(?:[.,]\d+)?\s*(?:г|gr|гр|Г|GR|кг|kg)[хxXХ\d]*/gi, ' ');
  }
  
  // Убираем лишние запятые и пробелы
  name = name.replace(/,\s*,/g, ',');
  name = name.replace(/\s+/g, ' ');
  
  // Нормализуем
  name = normalizeName(name);
  
  return name;
}

/**
 * Определение категории из текста
 */
function extractCategory(text) {
  if (!text) return null;
  
  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Определение типа из текста
 */
function extractType(text) {
  if (!text) return null;
  
  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(TYPE_MAP)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Парсинг документа
 */
async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    if (ext === '.docx' && mammoth) {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (ext === '.pdf' && pdfParse) {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } else if (ext === '.doc') {
      // Пробуем textract
      if (textract) {
        return new Promise((resolve, reject) => {
          textract.fromFileWithPath(filePath, (error, text) => {
            if (error) reject(error);
            else resolve(text);
          });
        });
      }
      // Пробуем word-extractor
      if (wordExtractor) {
        const extractor = new wordExtractor();
        const extracted = await extractor.extract(filePath);
        return extracted.getBody();
      }
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка парсинга ${filePath}: ${error.message}`);
    return null;
  }
  
  return null;
}

/**
 * Обработка папки товара
 */
async function processProductFolder(brandFolder, productFolderPath, productFolderName) {
  stats.totalFolders++;
  
  // Извлекаем артикул
  const sku = extractSku(productFolderName);
  if (!sku) {
    issues.push({
      productId: 'UNKNOWN',
      issue: 'no_sku',
      path: productFolderName
    });
    stats.productsSkipped++;
    return null;
  }
  
  // Определяем бренд
  const brandKey = brandFolder.toLowerCase();
  const brand = BRAND_MAP[brandKey] || brandFolder.toUpperCase();
  
  // Читаем meta.json
  const metaPath = path.join(productFolderPath, 'meta.json');
  let metaData = null;
  
  if (fs.existsSync(metaPath)) {
    try {
      metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (error) {
      console.warn(`⚠️  Ошибка чтения meta.json: ${metaPath}`);
      stats.missingMeta++;
    }
  } else {
    stats.missingMeta++;
    issues.push({
      productId: sku,
      issue: 'missing_meta',
      path: productFolderName
    });
  }
  
  // Извлекаем грамовку
  let weight = null;
  if (metaData && metaData.weight && metaData.weight.value) {
    weight = metaData.weight.value + (metaData.weight.unit || 'gr');
  } else {
    weight = extractWeight(productFolderName);
  }
  
  // Извлекаем название товара из папки
  let productName = extractProductName(productFolderName, sku);
  
  // Если в meta.json есть name, используем его (но убираем артикул и грамовку)
  if (metaData && metaData.name) {
    let metaName = metaData.name;
    // Убираем артикул из начала
    if (sku && metaName.toUpperCase().startsWith(sku.toUpperCase())) {
      metaName = metaName.substring(sku.length).trim();
      metaName = metaName.replace(/^[\s\-,]+/, '');
    }
    // Убираем грамовку
    const metaWeight = extractWeight(metaName);
    if (metaWeight) {
      const weightValue = metaWeight.replace('gr', '');
      const weightPatterns = [
        new RegExp(`\\s*${weightValue}\\s*(?:г|gr|гр|Г|GR|кг|kg)[,хxXХ]*\\s*`, 'gi'),
        new RegExp(`\\s*,\\s*${weightValue}\\s*(?:г|gr|гр|Г|GR|кг|kg)`, 'gi')
      ];
      for (const pattern of weightPatterns) {
        metaName = metaName.replace(pattern, ' ');
      }
    }
    // Убираем служебную информацию
    metaName = metaName.replace(/\s*(?:х|X|×)\s*\d+\s*(?:шт|шб|pcs|box|carton|бл|блок)/gi, ' ');
    metaName = metaName.replace(/\s*ТМ\s*[A-Z\s]+/gi, ' ');
    metaName = normalizeName(metaName);
    if (metaName && metaName.length > 5) {
      productName = metaName;
    }
  }
  
  // Формируем финальное название: БРЕНД + название (без дублирования бренда)
  let finalName = productName;
  const brandLower = brand.toLowerCase();
  const nameLower = productName.toLowerCase();
  
  // Если название уже содержит бренд, не дублируем
  if (!nameLower.includes(brandLower)) {
    finalName = `${brand} ${productName}`.trim();
  } else {
    finalName = productName;
  }
  
  // Ищем изображение (main.webp, игнорируем name.*)
  let imagePath = null;
  const mainImagePath = path.join(productFolderPath, 'main.webp');
  if (fs.existsSync(mainImagePath)) {
    imagePath = path.relative(PROJECT_ROOT, mainImagePath).replace(/\\/g, '/');
  } else {
    // Пробуем найти другие изображения (но не name.*)
    try {
      const files = fs.readdirSync(productFolderPath);
      const imageFiles = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        const baseName = path.basename(f, ext).toLowerCase();
        return ['.webp', '.png', '.jpg', '.jpeg'].includes(ext) && 
               baseName !== 'name' && 
               !baseName.startsWith('name.');
      });
      
      if (imageFiles.length > 0) {
        const firstImage = path.join(productFolderPath, imageFiles[0]);
        imagePath = path.relative(PROJECT_ROOT, firstImage).replace(/\\/g, '/');
      } else {
        stats.missingImages++;
        issues.push({
          productId: sku,
          issue: 'missing_image',
          path: productFolderName
        });
      }
    } catch (error) {
      stats.missingImages++;
      issues.push({
        productId: sku,
        issue: 'missing_image',
        path: productFolderName
      });
    }
  }
  
  // Ищем текстовку (text.docx, text.doc)
  let hasText = false;
  const textDocx = path.join(productFolderPath, 'text.docx');
  const textDoc = path.join(productFolderPath, 'text.doc');
  
  if (fs.existsSync(textDocx) || fs.existsSync(textDoc)) {
    hasText = true;
  } else {
    stats.missingText++;
    issues.push({
      productId: sku,
      issue: 'missing_text',
      path: productFolderName
    });
  }
  
  // Извлекаем категорию и тип
  const category = extractCategory(productFolderName) || (metaData && metaData.category) || null;
  const type = extractType(productFolderName) || (metaData && metaData.type) || null;
  
  // Генерируем ID
  const productId = sku.toLowerCase();
  
  // Формируем продукт
  const product = {
    id: productId,
    name: finalName,
    nameRu: finalName,
    nameEn: finalName,
    brand: brand,
    category: category || 'unknown',
    image: imagePath,
    sku: sku,
    type: type,
    weight: weight,
    flags: {
      missing_text: !hasText,
      missing_images: !imagePath
    },
    sourcePath: path.relative(PROJECT_ROOT, productFolderPath).replace(/\\/g, '/')
  };
  
  // Если есть meta.json, добавляем дополнительную информацию
  if (metaData) {
    if (metaData.description) {
      product.description = metaData.description.substring(0, 500);
    }
    if (metaData.composition) {
      product.composition = metaData.composition;
    }
    if (metaData.nutrition) {
      product.nutrition = metaData.nutrition;
    }
  }
  
  return product;
}

/**
 * Сканирование директории
 */
async function scanDirectory() {
  console.log('🔍 Сканирование foods_normalized_v2...\n');
  
  if (!fs.existsSync(NORMALIZED_DIR)) {
    console.error(`❌ Директория не найдена: ${NORMALIZED_DIR}`);
    process.exit(1);
  }
  
  const brandFolders = fs.readdirSync(NORMALIZED_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== '_unassigned')
    .map(e => e.name);
  
  console.log(`📁 Найдено брендов: ${brandFolders.length}\n`);
  
  for (const brandFolder of brandFolders) {
    const brandPath = path.join(NORMALIZED_DIR, brandFolder);
    const productFolders = fs.readdirSync(brandPath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    
    console.log(`📦 ${brandFolder}: ${productFolders.length} товаров`);
    
    for (const productFolderName of productFolders) {
      const productFolderPath = path.join(brandPath, productFolderName);
      
      try {
        const product = await processProductFolder(brandFolder, productFolderPath, productFolderName);
        if (product) {
          products.push(product);
          stats.productsImported++;
        }
      } catch (error) {
        console.warn(`⚠️  Ошибка обработки ${productFolderName}: ${error.message}`);
        issues.push({
          productId: 'ERROR',
          issue: 'processing_error',
          path: productFolderName,
          error: error.message
        });
      }
    }
  }
  
  console.log(`\n✅ Обработано папок: ${stats.totalFolders}`);
  console.log(`✅ Импортировано товаров: ${stats.productsImported}`);
  console.log(`⚠️  Пропущено: ${stats.productsSkipped}\n`);
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 ИМПОРТ ИЗ foods_normalized_v2');
  console.log('='.repeat(80));
  console.log(`Корень проекта: ${PROJECT_ROOT}`);
  console.log(`Директория: ${NORMALIZED_DIR}\n`);
  
  // Сканирование
  await scanDirectory();
  
  // Загружаем существующие brands и categories
  let existingCategories = {};
  let existingBrands = [];
  
  try {
    if (fs.existsSync(PRODUCTS_JSON)) {
      const existingData = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
      if (existingData.categories && Object.keys(existingData.categories).length > 0) {
        existingCategories = existingData.categories;
      }
      if (existingData.brands && Array.isArray(existingData.brands) && existingData.brands.length > 0) {
        existingBrands = existingData.brands;
      }
    }
  } catch (error) {
    console.warn(`⚠️  Не удалось загрузить существующие данные: ${error.message}`);
  }
  
  // Если brands и categories пустые, пробуем загрузить из бэкапа
  if (Object.keys(existingCategories).length === 0 || existingBrands.length === 0) {
    try {
      const backupFile = path.join(PROJECT_ROOT, 'data', 'products.backup-prepare-search-seo.json');
      if (fs.existsSync(backupFile)) {
        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        if (Object.keys(existingCategories).length === 0 && backupData.categories) {
          existingCategories = backupData.categories;
        }
        if (existingBrands.length === 0 && backupData.brands) {
          existingBrands = backupData.brands;
        }
      }
    } catch (error) {
      // Игнорируем
    }
  }
  
  // Создание выходных директорий
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUT_PRODUCTS_DIR)) {
    fs.mkdirSync(OUT_PRODUCTS_DIR, { recursive: true });
  }
  
  // Сохранение per-item JSON
  console.log('💾 Сохранение per-item JSON...');
  for (const product of products) {
    const productFile = path.join(OUT_PRODUCTS_DIR, `${product.id}.json`);
    fs.writeFileSync(productFile, JSON.stringify(product, null, 2), 'utf8');
  }
  console.log(`   ✅ Сохранено: ${products.length} файлов\n`);
  
  // Сохранение data/products.json
  console.log('💾 Сохранение data/products.json...');
  const productsData = {
    products: products,
    categories: existingCategories,
    brands: existingBrands
  };
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');
  console.log(`   ✅ Сохранено: ${products.length} товаров, ${Object.keys(existingCategories).length} категорий, ${existingBrands.length} брендов\n`);
  
  // Сохранение out/products.json
  console.log('💾 Сохранение out/products.json...');
  fs.writeFileSync(OUT_PRODUCTS_JSON, JSON.stringify(products, null, 2), 'utf8');
  console.log(`   ✅ Сохранено\n`);
  
  // Сохранение out/issues.json
  console.log('💾 Сохранение out/issues.json...');
  stats.issuesFound = issues.length;
  fs.writeFileSync(ISSUES_JSON, JSON.stringify(issues, null, 2), 'utf8');
  console.log(`   ✅ Сохранено: ${issues.length} проблем\n`);
  
  // Сохранение out/report.json
  console.log('💾 Сохранение out/report.json...');
  const report = {
    timestamp: new Date().toISOString(),
    stats: stats,
    summary: {
      totalProducts: products.length,
      totalIssues: issues.length,
      successRate: ((products.length - issues.length) / products.length * 100).toFixed(2) + '%'
    }
  };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
  console.log(`   ✅ Сохранено\n`);
  
  // Финальная статистика
  console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
  console.log('='.repeat(80));
  console.log(`Товаров импортировано: ${stats.productsImported}`);
  console.log(`Проблем найдено: ${stats.issuesFound}`);
  console.log(`  - Без meta.json: ${stats.missingMeta}`);
  console.log(`  - Без изображений: ${stats.missingImages}`);
  console.log(`  - Без текста: ${stats.missingText}`);
  console.log(`\n✅ Готово! Файлы сохранены в:`);
  console.log(`   - ${PRODUCTS_JSON}`);
  console.log(`   - ${OUT_PRODUCTS_JSON}`);
  console.log(`   - ${ISSUES_JSON}`);
  console.log(`   - ${REPORT_JSON}`);
  console.log(`   - ${OUT_PRODUCTS_DIR}/*.json (${products.length} файлов)\n`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { main };

