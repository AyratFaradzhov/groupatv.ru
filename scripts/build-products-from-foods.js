/**
 * BUILD PRODUCTS FROM FOODS
 * 
 * Единый согласованный pipeline для обработки товаров из папки ./foods
 * Генерирует:
 * - data/products.json (основной каталог для сайта)
 * - out/products/<id>.json (опционально, 1 файл = 1 товар)
 * - out/products.json (склейка всех товаров)
 * - out/issues.json (проблемные товары)
 * - out/report.json (статистика)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Опциональные зависимости
let fastGlob, imageSize, blockhash, mammoth, pdfParse, textract, wordExtractor;

try {
  fastGlob = require('fast-glob');
} catch (e) {
  console.warn('⚠️  fast-glob не установлен, используется fs recursion');
}

try {
  imageSize = require('image-size');
} catch (e) {
  console.warn('⚠️  image-size не установлен, детекция плейсхолдеров отключена');
}

try {
  blockhash = require('blockhash-core');
} catch (e) {
  console.warn('⚠️  blockhash-core не установлен, используется упрощенный hash');
}

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
const FOODS_DIR = path.join(PROJECT_ROOT, 'foods');
const OUT_DIR = path.join(PROJECT_ROOT, 'out');
const OUT_PRODUCTS_DIR = path.join(OUT_DIR, 'products');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const OUT_PRODUCTS_JSON = path.join(OUT_DIR, 'products.json');
const ISSUES_JSON = path.join(OUT_DIR, 'issues.json');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

// Расширения файлов
const IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg'];
const DOC_EXTENSIONS = ['.docx', '.pdf', '.doc'];

// Плейсхолдеры: размер 478×58
const PLACEHOLDER_SIZE = { width: 478, height: 58 };
const PLACEHOLDER_TOLERANCE = 5; // допуск в пикселях

// Маппинг брендов из папок
const BRAND_MAP = {
  '01 tayas': 'TAYAS',
  '01 Tayas': 'TAYAS',
  '02 pakel': 'PAKEL',
  '02 Pakel': 'PAKEL',
  '03 alikhan ata': 'ALIKHAN ATA',
  '03 Alikhan Ata': 'ALIKHAN ATA',
  '04 puffico': 'PUFFI',
  '04 Puffico': 'PUFFI',
  '05 oslo': 'OSLO',
  '05 Oslo': 'OSLO',
  '06 love me tm': 'LOVE ME',
  '06 Love Me TM': 'LOVE ME',
  '07 panda lee tm': 'PANDA LEE',
  '07 Panda Lee TM': 'PANDA LEE',
  '08 navroz': 'NAVROZ',
  '08 Navroz': 'NAVROZ',
  '09 crafers': 'CRAFERS',
  '09 Crafers': 'CRAFERS'
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
  totalFiles: 0,
  imagesFound: 0,
  docsFound: 0,
  placeholdersRemoved: 0,
  productsCreated: 0,
  issuesFound: 0,
  missingText: 0,
  missingImages: 0,
  noSku: 0,
  noSkuGroups: 0,
  longPaths: 0,
  docParseFailed: 0
};

const issues = [];
const products = [];

/**
 * Поддержка длинных путей Windows
 */
function getLongPath(filePath) {
  if (process.platform === 'win32' && filePath.length > 240) {
    if (!filePath.startsWith('\\\\?\\')) {
      const longPath = path.isAbsolute(filePath) 
        ? '\\\\?\\' + filePath.replace(/\//g, '\\')
        : '\\\\?\\' + path.resolve(filePath).replace(/\//g, '\\');
      stats.longPaths++;
      if (stats.longPaths <= 5) {
        console.warn(`⚠️  Длинный путь (>240): ${filePath.substring(0, 80)}...`);
      }
      return longPath;
    }
  }
  return filePath;
}

/**
 * Проверка, является ли изображение плейсхолдером
 */
function isPlaceholder(imagePath) {
  if (!imageSize) return false;
  
  try {
    const longPath = getLongPath(imagePath);
    const dimensions = imageSize(longPath);
    
    const widthMatch = Math.abs(dimensions.width - PLACEHOLDER_SIZE.width) <= PLACEHOLDER_TOLERANCE;
    const heightMatch = Math.abs(dimensions.height - PLACEHOLDER_SIZE.height) <= PLACEHOLDER_TOLERANCE;
    
    if (widthMatch && heightMatch) {
      stats.placeholdersRemoved++;
      return true;
    }
  } catch (error) {
    // Игнорируем ошибки чтения
  }
  
  return false;
}

/**
 * Извлечение SKU из пути/имени файла/папки
 */
function extractSku(filePath, fileName, folderName = null) {
  // Собираем весь текст для поиска
  const parts = [filePath, fileName];
  if (folderName) {
    parts.push(folderName);
  }
  const text = parts.join(' ').toUpperCase();
  
  // Приоритет 1: буквенно-цифровые (A-Z{1,3} + цифры{3,6})
  // Примеры: PL1048, BS0001, AF0006, SL0002, PF0003, KA0006, KF0013, A00013
  const alphanumericMatch = text.match(/([A-Z]{1,3}\d{3,6})/);
  if (alphanumericMatch) {
    return alphanumericMatch[1];
  }
  
  // Приоритет 2: № + цифры
  const numberSignMatch = text.match(/№\s*(\d{3,6})/);
  if (numberSignMatch) {
    return numberSignMatch[1];
  }
  
  // Приоритет 3: отдельное число 3-6 цифр (но не вес/упаковка)
  // Исключаем числа рядом с единицами веса/объема/упаковки
  const weightUnits = /(г|гр|gr|kg|кг|ml|мл|шт|pcs|box|carton|упаковка|пакет)/i;
  const standaloneMatches = text.matchAll(/\b(\d{3,6})\b/g);
  
  for (const match of standaloneMatches) {
    const num = parseInt(match[1]);
    const before = text.substring(Math.max(0, match.index - 20), match.index);
    const after = text.substring(match.index + match[0].length, match.index + match[0].length + 20);
    
    // Исключаем если рядом единицы веса/упаковки
    if (weightUnits.test(before) || weightUnits.test(after)) {
      continue;
    }
    
    // Исключаем типичные веса (но не все подряд)
    const commonWeights = [15, 18, 20, 25, 30, 35, 40, 42, 52, 60, 70, 75, 80, 90, 100, 150, 250, 300, 500, 700, 1000];
    if (commonWeights.includes(num)) {
      continue;
    }
    
    // Если число 3-6 цифр и не похоже на вес - это SKU
    if (num >= 100 && num <= 999999) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Нормализация чисел (запятая -> точка)
 */
function normalizeNumbers(text) {
  return text.replace(/(\d+),(\d+)/g, '$1.$2');
}

/**
 * Нормализация пробелов
 */
function normalizeSpaces(text) {
  return text.replace(/\s+/g, ' ').trim();
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
  
  // Убрать служебные слова (регистронезависимо)
  const serviceWords = ['текстовка', 'маркировка', 'состав', 'описание', 'этикетка', 
                        'text', 'marking', 'composition', 'description', 'label'];
  for (const word of serviceWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    name = name.replace(regex, '');
  }
  
  // Обрезать пробелы
  name = name.trim();
  
  // Убрать множественные пробелы еще раз
  name = name.replace(/\s+/g, ' ');
  
  return name;
}

/**
 * Дедупликация абзацев
 */
function deduplicateParagraphs(paragraphs) {
  const seen = new Set();
  const unique = [];
  
  for (const para of paragraphs) {
    const normalized = normalizeSpaces(para).toLowerCase();
    if (!seen.has(normalized) && normalized.length > 10) {
      seen.add(normalized);
      unique.push(para);
    }
  }
  
  return unique;
}

/**
 * Парсинг DOCX
 */
async function parseDocx(filePath) {
  if (!mammoth) {
    throw new Error('mammoth не установлен');
  }
  
  const longPath = getLongPath(filePath);
  const buffer = fs.readFileSync(longPath);
  const result = await mammoth.extractRawText({ buffer });
  const text = normalizeNumbers(result.value);
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  
  return deduplicateParagraphs(paragraphs);
}

/**
 * Парсинг PDF
 */
async function parsePdf(filePath) {
  if (!pdfParse) {
    throw new Error('pdf-parse не установлен');
  }
  
  const longPath = getLongPath(filePath);
  const buffer = fs.readFileSync(longPath);
  const data = await pdfParse(buffer);
  const text = normalizeNumbers(data.text);
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  
  return deduplicateParagraphs(paragraphs);
}

/**
 * Парсинг DOC (старый Word) с fallback
 */
async function parseDoc(filePath) {
  const longPath = getLongPath(filePath);
  
  // Метод 1: textract (предпочтительно)
  if (textract) {
    try {
      return new Promise((resolve, reject) => {
        textract.fromFileWithPath(longPath, (error, text) => {
          if (error) {
            reject(error);
          } else {
            const normalized = normalizeNumbers(text);
            const paragraphs = normalized.split(/\n+/).filter(p => p.trim().length > 0);
            resolve(deduplicateParagraphs(paragraphs));
          }
        });
      });
    } catch (error) {
      // Продолжаем к следующему методу
    }
  }
  
  // Метод 2: word-extractor
  if (wordExtractor) {
    try {
      const extractor = new wordExtractor();
      const extracted = await extractor.extract(longPath);
      const text = normalizeNumbers(extracted.getBody());
      const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
      return deduplicateParagraphs(paragraphs);
    } catch (error) {
      // Продолжаем к следующему методу
    }
  }
  
  // Метод 3: LibreOffice (если установлен)
  try {
    const os = require('os');
    const tmpDir = os.tmpdir();
    
    // Пробуем найти soffice
    let sofficePath = 'soffice';
    if (process.platform === 'win32') {
      // Типичные пути LibreOffice на Windows
      const possiblePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          sofficePath = p;
          break;
        }
      }
    }
    
    // LibreOffice создает файл с тем же именем, но расширением .txt в указанной папке
    const baseName = path.basename(longPath, '.doc');
    const txtFile = path.join(tmpDir, baseName + '.txt');
    
    execSync(`"${sofficePath}" --headless --convert-to txt --outdir "${tmpDir}" "${longPath}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
      stdio: 'ignore'
    });
    
    if (fs.existsSync(txtFile)) {
      const text = normalizeNumbers(fs.readFileSync(txtFile, 'utf8'));
      fs.unlinkSync(txtFile); // Удаляем временный файл
      const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
      return deduplicateParagraphs(paragraphs);
    }
  } catch (error) {
    // Продолжаем к fallback
  }
  
  // Метод 4: antiword (последняя попытка)
  try {
    const output = execSync(`antiword "${longPath}"`, { 
      encoding: 'utf8', 
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
      stdio: 'pipe'
    });
    const text = normalizeNumbers(output);
    const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
    return deduplicateParagraphs(paragraphs);
  } catch (error) {
    // Все методы не сработали - возвращаем ошибку
    throw new Error('DOC parsing failed: все методы парсинга недоступны');
  }
}

/**
 * Парсинг документа
 */
async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    if (ext === '.docx') {
      return await parseDocx(filePath);
    } else if (ext === '.pdf') {
      return await parsePdf(filePath);
    } else if (ext === '.doc') {
      return await parseDoc(filePath);
    }
  } catch (error) {
    // Для .doc файлов помечаем как failed, но не падаем
    if (ext === '.doc') {
      stats.docParseFailed++;
      return null; // Возвращаем null чтобы пометить как failed
    }
    console.warn(`⚠️  Ошибка парсинга ${filePath}: ${error.message}`);
    return [];
  }
  
  return [];
}

/**
 * Извлечение информации из текста документа
 */
function extractDocumentInfo(paragraphs) {
  const text = paragraphs.join('\n').toLowerCase();
  
  const composition = [];
  const nutrition = [];
  const packaging = [];
  
  let inComposition = false;
  let inNutrition = false;
  let inPackaging = false;
  
  for (const para of paragraphs) {
    const lower = para.toLowerCase();
    
    if (lower.includes('состав') || lower.includes('ingredients')) {
      inComposition = true;
      inNutrition = false;
      inPackaging = false;
      continue;
    }
    
    if (lower.includes('пищевая ценность') || lower.includes('nutrition') || lower.includes('энергетическая')) {
      inComposition = false;
      inNutrition = true;
      inPackaging = false;
      continue;
    }
    
    if (lower.includes('упаковка') || lower.includes('packaging') || lower.includes('box') || lower.includes('carton')) {
      inComposition = false;
      inNutrition = false;
      inPackaging = true;
      continue;
    }
    
    if (inComposition && para.trim().length > 5) {
      composition.push(para.trim());
    } else if (inNutrition && para.trim().length > 5) {
      nutrition.push(para.trim());
    } else if (inPackaging && para.trim().length > 5) {
      packaging.push(para.trim());
    }
  }
  
  return {
    composition: composition.length > 0 ? composition : null,
    nutrition: nutrition.length > 0 ? nutrition : null,
    packaging: packaging.length > 0 ? packaging : null,
    fullText: paragraphs.join('\n')
  };
}

/**
 * Генерация безопасного имени файла
 */
function generateSafeFilename(relativePath, sku) {
  const hash = crypto.createHash('md5').update(relativePath).digest('hex').substring(0, 8);
  const slug = relativePath
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  
  return sku ? `${sku}-${hash}` : `no-sku-${hash}`;
}

/**
 * Определение папки товара (самая нижняя папка с файлами)
 */
function getProductFolder(relativePath) {
  // relativePath уже является папкой товара (dirname от файла)
  // Но нужно убедиться, что это действительно папка товара, а не категория
  const parts = relativePath.split(path.sep).filter(p => p);
  
  // Если в пути есть числовые префиксы (01, 02...) или категории - убираем их
  // Оставляем только папку товара (обычно последняя или предпоследняя)
  // Пример: "01 Tayas/01 Мармелады/1753 Кислые Ремешки ( Арбуз )" -> "1753 Кислые Ремешки ( Арбуз )"
  
  // Ищем папку, которая содержит SKU или выглядит как название товара
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // Пропускаем папки с числовыми префиксами категорий
    if (/^\d+\s+/.test(part)) {
      continue;
    }
    // Если папка содержит SKU или выглядит как название товара - это она
    if (extractSku('', '', part) || part.length > 10) {
      return parts.slice(0, i + 1).join(path.sep);
    }
  }
  
  // Fallback: возвращаем последнюю папку
  return relativePath;
}

/**
 * Сканирование файлов с правильной группировкой
 */
function scanFiles() {
  console.log('🔍 Сканирование файлов в foods/...\n');
  
  // Структура: groupKey -> { imagePaths: [], docPaths: [], productFolder: string }
  const productGroups = new Map();
  
  function scanDirectory(dirPath, relativePath = '') {
    try {
      const longPath = getLongPath(dirPath);
      const entries = fs.readdirSync(longPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelative = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          scanDirectory(entryPath, entryRelative);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (IMAGE_EXTENSIONS.includes(ext) || DOC_EXTENSIONS.includes(ext)) {
            stats.totalFiles++;
            
            // Определяем папку товара (dirname от файла)
            const fileDir = path.dirname(entryRelative);
            const productFolder = getProductFolder(fileDir);
            
            // Извлекаем SKU из имени файла и папки
            const fileName = entry.name;
            const folderName = path.basename(fileDir);
            const sku = extractSku(fileDir, fileName, folderName);
            
            // Определяем brand из пути
            const pathParts = productFolder.split(path.sep).filter(p => p);
            const brandFolder = pathParts[0] || '';
            const brandKey = brandFolder.toLowerCase();
            const brand = BRAND_MAP[brandKey] || BRAND_MAP[brandFolder] || 'UNKNOWN';
            
            // Генерируем groupKey
            let groupKey;
            if (sku) {
              groupKey = `${brand}|${sku}`;
            } else {
              // Для товаров без SKU используем hash папки товара
              const folderHash = crypto.createHash('md5').update(productFolder).digest('hex').substring(0, 8);
              groupKey = `${brand}|NO-SKU-${folderHash}`;
            }
            
            // Добавляем в группу
            if (!productGroups.has(groupKey)) {
              productGroups.set(groupKey, {
                imagePaths: [],
                docPaths: [],
                placeholderNameImages: [],
                productFolder: productFolder,
                brand: brand,
                sku: sku
              });
            }
            
            const group = productGroups.get(groupKey);
            if (IMAGE_EXTENSIONS.includes(ext)) {
              stats.imagesFound++;
              // Проверяем, является ли это плейсхолдером
              if (isPlaceholder(entryPath)) {
                group.placeholderNameImages.push(entryPath);
              } else {
                group.imagePaths.push(entryPath);
              }
            } else if (DOC_EXTENSIONS.includes(ext)) {
              stats.docsFound++;
              group.docPaths.push(entryPath);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Ошибка сканирования ${dirPath}: ${error.message}`);
    }
  }
  
  // Используем fast-glob если доступен
  if (fastGlob) {
    const imagePattern = '**/*.{webp,png,jpg,jpeg}';
    const docPattern = '**/*.{docx,pdf,doc}';
    
    const images = fastGlob.sync(imagePattern, { cwd: FOODS_DIR, absolute: true });
    const docs = fastGlob.sync(docPattern, { cwd: FOODS_DIR, absolute: true });
    
    for (const imgPath of images) {
      stats.imagesFound++;
      stats.totalFiles++;
      const relative = path.relative(FOODS_DIR, imgPath);
      const fileDir = path.dirname(relative);
      const productFolder = getProductFolder(fileDir);
      const fileName = path.basename(imgPath);
      const folderName = path.basename(fileDir);
      const sku = extractSku(fileDir, fileName, folderName);
      
      const pathParts = productFolder.split(path.sep).filter(p => p);
      const brandFolder = pathParts[0] || '';
      const brandKey = brandFolder.toLowerCase();
      const brand = BRAND_MAP[brandKey] || BRAND_MAP[brandFolder] || 'UNKNOWN';
      
      let groupKey;
      if (sku) {
        groupKey = `${brand}|${sku}`;
      } else {
        const folderHash = crypto.createHash('md5').update(productFolder).digest('hex').substring(0, 8);
        groupKey = `${brand}|NO-SKU-${folderHash}`;
      }
      
      if (!productGroups.has(groupKey)) {
        productGroups.set(groupKey, {
          imagePaths: [],
          docPaths: [],
          placeholderNameImages: [],
          productFolder: productFolder,
          brand: brand,
          sku: sku
        });
      }
      // Проверяем, является ли это плейсхолдером
      if (isPlaceholder(imgPath)) {
        productGroups.get(groupKey).placeholderNameImages.push(imgPath);
      } else {
        productGroups.get(groupKey).imagePaths.push(imgPath);
      }
    }
    
    for (const docPath of docs) {
      stats.docsFound++;
      stats.totalFiles++;
      const relative = path.relative(FOODS_DIR, docPath);
      const fileDir = path.dirname(relative);
      const productFolder = getProductFolder(fileDir);
      const fileName = path.basename(docPath);
      const folderName = path.basename(fileDir);
      const sku = extractSku(fileDir, fileName, folderName);
      
      const pathParts = productFolder.split(path.sep).filter(p => p);
      const brandFolder = pathParts[0] || '';
      const brandKey = brandFolder.toLowerCase();
      const brand = BRAND_MAP[brandKey] || BRAND_MAP[brandFolder] || 'UNKNOWN';
      
      let groupKey;
      if (sku) {
        groupKey = `${brand}|${sku}`;
      } else {
        const folderHash = crypto.createHash('md5').update(productFolder).digest('hex').substring(0, 8);
        groupKey = `${brand}|NO-SKU-${folderHash}`;
      }
      
      if (!productGroups.has(groupKey)) {
        productGroups.set(groupKey, {
          imagePaths: [],
          docPaths: [],
          placeholderNameImages: [],
          productFolder: productFolder,
          brand: brand,
          sku: sku
        });
      }
      productGroups.get(groupKey).docPaths.push(docPath);
    }
  } else {
    scanDirectory(FOODS_DIR);
  }
  
  return productGroups;
}

/**
 * Обработка товарной группы
 */
async function processProductGroup(groupData) {
  const { imagePaths, docPaths, placeholderNameImages, productFolder, brand, sku } = groupData;
  
  // Если нет SKU, увеличиваем счетчик групп без SKU
  if (!sku) {
    stats.noSkuGroups++;
  }
  
  // validImages уже не содержат плейсхолдеров (они отфильтрованы при сканировании)
  const validImages = imagePaths;
  
  // Генерация ID (нужно раньше для использования в fallback)
  let productId;
  if (sku) {
    productId = sku;
  } else {
    // Для товаров без SKU используем стабильный hash папки товара
    const folderHash = crypto.createHash('md5').update(productFolder).digest('hex').substring(0, 8);
    productId = `NO-SKU-${folderHash}`;
  }
  
  // Парсинг документов
  let docInfo = null;
  let docParseFailed = false;
  let productName = null;
  let placeholderUsedForName = false;
  
  if (docPaths.length > 0) {
    const allParagraphs = [];
    for (const docPath of docPaths) {
      const paragraphs = await parseDocument(docPath);
      if (paragraphs === null) {
        // .doc файл не удалось распарсить
        docParseFailed = true;
      } else {
        allParagraphs.push(...paragraphs);
      }
    }
    if (allParagraphs.length > 0) {
      docInfo = extractDocumentInfo(allParagraphs);
    } else if (docParseFailed) {
      // Помечаем как failed
      issues.push({
        productId: productId,
        issue: 'doc_parse_failed',
        path: productFolder,
        files: docPaths.map(p => path.basename(p))
      });
    }
    
    // Приоритет 1: name из имени документа
    if (docPaths.length > 0) {
      // Берем первый документ (можно улучшить логику выбора)
      const firstDoc = docPaths[0];
      const docName = path.basename(firstDoc, path.extname(firstDoc));
      productName = normalizeName(docName);
    }
  }
  
  // Приоритет 2: name из плейсхолдера
  if (!productName && placeholderNameImages.length > 0) {
    const firstPlaceholder = placeholderNameImages[0];
    const placeholderName = path.basename(firstPlaceholder, path.extname(firstPlaceholder));
    productName = normalizeName(placeholderName);
    placeholderUsedForName = true;
  }
  
  // Приоритет 3: name из папки товара
  if (!productName) {
    const folderName = path.basename(productFolder);
    productName = normalizeName(folderName);
  }
  
  // Fallback: если все еще нет имени
  if (!productName || productName.length === 0) {
    productName = sku || productId;
  }
  
  // Извлечение категории, типа, веса, вкуса из пути
  const pathText = productFolder.toLowerCase();
  let category = null;
  let type = null;
  let weight = null;
  const flavors = [];
  
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (pathText.includes(key)) {
      category = value;
      break;
    }
  }
  
  for (const [key, value] of Object.entries(TYPE_MAP)) {
    if (pathText.includes(key)) {
      type = value;
      break;
    }
  }
  
  const weightMatch = pathText.match(/(\d+)\s*г/i);
  if (weightMatch) {
    weight = weightMatch[1] + 'gr';
  }
  
  // Выбор главного изображения
  let mainImage = null;
  if (validImages.length > 0) {
    // Приоритет: короткое имя, содержит "main" или "1", в корне папки
    const sorted = validImages.sort((a, b) => {
      const aName = path.basename(a).toLowerCase();
      const bName = path.basename(b).toLowerCase();
      
      if (aName.includes('main') && !bName.includes('main')) return -1;
      if (!aName.includes('main') && bName.includes('main')) return 1;
      if (aName.includes('1') && !bName.includes('1')) return -1;
      if (!aName.includes('1') && bName.includes('1')) return 1;
      
      return aName.length - bName.length;
    });
    
    mainImage = sorted[0];
  }
  
  // Формирование продукта
  const product = {
    id: productId,
    name: productName,
    nameRu: productName,
    nameEn: productName,
    brand: brand,
    category: category || 'unknown',
    image: mainImage ? path.relative(PROJECT_ROOT, mainImage).replace(/\\/g, '/') : null,
    sku: sku,
    type: type,
    weight: weight,
    flavors: flavors,
    flags: {
      missing_text: !docInfo && !docParseFailed,
      missing_images: validImages.length === 0,
      placeholder_removed: placeholderNameImages.length > 0,
      placeholder_used_for_name: placeholderUsedForName,
      no_sku: !sku,
      doc_parse_failed: docParseFailed
    },
    sourcePath: productFolder
  };
  
  if (docInfo) {
    product.composition = docInfo.composition;
    product.nutrition = docInfo.nutrition;
    product.packaging = docInfo.packaging;
    product.description = docInfo.fullText.substring(0, 500);
  }
  
  // Проверка проблем
  if (product.flags.missing_text) {
    stats.missingText++;
    issues.push({
      productId: productId,
      issue: 'missing_text',
      path: productFolder
    });
  }
  
  if (product.flags.missing_images) {
    stats.missingImages++;
    issues.push({
      productId: productId,
      issue: 'missing_images',
      path: productFolder
    });
  }
  
  if (product.flags.no_sku) {
    stats.noSku++;
    issues.push({
      productId: productId,
      issue: 'no_sku',
      path: productFolder
    });
  }
  
  if (product.flags.placeholder_removed) {
    issues.push({
      productId: productId,
      issue: 'placeholder_images_removed',
      path: productFolder,
      removed: placeholderNameImages.length
    });
  }
  
  if (stats.longPaths > 0 && productFolder.length > 240) {
    issues.push({
      productId: productId,
      issue: 'long_path',
      path: productFolder,
      length: productFolder.length
    });
  }
  
  return product;
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 BUILD PRODUCTS FROM FOODS');
  console.log('='.repeat(80));
  console.log(`Корень проекта: ${PROJECT_ROOT}`);
  console.log(`Папка foods: ${FOODS_DIR}\n`);
  
  // Проверка существования папки foods
  if (!fs.existsSync(FOODS_DIR)) {
    console.error(`❌ Папка foods не найдена: ${FOODS_DIR}`);
    process.exit(1);
  }
  
  // Проверка наличия ожидаемых папок брендов
  const brandFolders = fs.readdirSync(FOODS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
  
  const expectedBrands = ['01 Tayas', '02 Pakel', '03 Alikhan Ata', '04 Puffico', 
                          '05 Oslo', '06 Love Me TM', '07 Panda Lee TM', '08 Navroz', '09 Crafers'];
  
  const foundBrands = expectedBrands.filter(b => brandFolders.some(f => f === b || f.toLowerCase() === b.toLowerCase()));
  
  if (foundBrands.length === 0) {
    console.error(`❌ Не найдены ожидаемые папки брендов в ${FOODS_DIR}`);
    console.error(`   Ожидалось: ${expectedBrands.join(', ')}`);
    console.error(`   Найдено: ${brandFolders.join(', ') || '(пусто)'}`);
    process.exit(1);
  }
  
  console.log(`✅ Найдено папок брендов: ${foundBrands.length}/${expectedBrands.length}\n`);
  
  // Сканирование файлов
  const productGroups = scanFiles();
  
  console.log(`📊 Найдено:`);
  console.log(`   Изображений: ${stats.imagesFound}`);
  console.log(`   Документов: ${stats.docsFound}`);
  console.log(`   Всего файлов: ${stats.totalFiles}`);
  console.log(`   Товарных групп: ${productGroups.size}\n`);
  
  // Обработка товарных групп
  console.log('📦 Обработка товарных групп...\n');
  
  let processed = 0;
  const groupKeys = Array.from(productGroups.keys());
  
  // Обрабатываем группы последовательно (чтобы не перегружать память)
  for (const groupKey of groupKeys) {
    processed++;
    if (processed % 10 === 0) {
      process.stdout.write(`\r   Обработано: ${processed}/${groupKeys.length}`);
    }
    
    const groupData = productGroups.get(groupKey);
    
    try {
      const product = await processProductGroup(groupData);
      products.push(product);
      stats.productsCreated++;
    } catch (error) {
      console.warn(`\n⚠️  Ошибка обработки ${groupKey}: ${error.message}`);
      issues.push({
        productId: 'ERROR',
        issue: 'processing_error',
        path: groupData.productFolder,
        error: error.message
      });
    }
  }
  
  process.stdout.write(`\r   Обработано: ${groupKeys.length}/${groupKeys.length}\n\n`);
  
  // Создание выходных директорий
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUT_PRODUCTS_DIR)) {
    fs.mkdirSync(OUT_PRODUCTS_DIR, { recursive: true });
  }
  
  // Сохранение per-item JSON (опционально)
  console.log('💾 Сохранение per-item JSON...');
  for (const product of products) {
    const productFile = path.join(OUT_PRODUCTS_DIR, `${product.id}.json`);
    fs.writeFileSync(productFile, JSON.stringify(product, null, 2), 'utf8');
  }
  console.log(`   ✅ Сохранено: ${products.length} файлов\n`);
  
  // Сохранение data/products.json (главный файл для сайта)
  console.log('💾 Сохранение data/products.json...');
  
  // Загружаем существующие brands и categories, если они есть
  let existingCategories = {};
  let existingBrands = [];
  
  try {
    if (fs.existsSync(PRODUCTS_JSON)) {
      const existingData = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
      if (existingData.categories && Object.keys(existingData.categories).length > 0) {
        existingCategories = existingData.categories;
        console.log(`   📋 Сохранены существующие категории: ${Object.keys(existingCategories).length}`);
      }
      if (existingData.brands && Array.isArray(existingData.brands) && existingData.brands.length > 0) {
        existingBrands = existingData.brands;
        console.log(`   🏷️  Сохранены существующие бренды: ${existingBrands.length}`);
      }
    }
  } catch (error) {
    console.warn(`   ⚠️  Не удалось загрузить существующие данные: ${error.message}`);
  }
  
  // Если brands и categories пустые, пробуем загрузить из бэкапа
  if (Object.keys(existingCategories).length === 0 || existingBrands.length === 0) {
    try {
      const backupFile = path.join(PROJECT_ROOT, 'data', 'products.backup-prepare-search-seo.json');
      if (fs.existsSync(backupFile)) {
        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        if (Object.keys(existingCategories).length === 0 && backupData.categories) {
          existingCategories = backupData.categories;
          console.log(`   📋 Загружены категории из бэкапа: ${Object.keys(existingCategories).length}`);
        }
        if (existingBrands.length === 0 && backupData.brands) {
          existingBrands = backupData.brands;
          console.log(`   🏷️  Загружены бренды из бэкапа: ${existingBrands.length}`);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Не удалось загрузить из бэкапа: ${error.message}`);
    }
  }
  
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
  console.log(`Товаров создано: ${stats.productsCreated}`);
  console.log(`Групп без SKU: ${stats.noSkuGroups}`);
  console.log(`Проблем найдено: ${stats.issuesFound}`);
  console.log(`  - Без текста: ${stats.missingText}`);
  console.log(`  - Без изображений: ${stats.missingImages}`);
  console.log(`  - Без SKU: ${stats.noSku}`);
  console.log(`  - DOC не прочитано: ${stats.docParseFailed}`);
  console.log(`Плейсхолдеров удалено: ${stats.placeholdersRemoved}`);
  console.log(`Длинных путей обработано: ${stats.longPaths}`);
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

