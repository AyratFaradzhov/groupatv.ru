/**
 * SMART PRODUCT DISCOVERY ENGINE
 * 
 * Интеллектуальная система поиска и импорта продуктов из неструктурированной
 * файловой системы на основе множественных сигналов и визуального анализа.
 * 
 * АРХИТЕКТУРА: 4-этапный pipeline
 * 1. DISCOVERY - сканирование и сбор метаданных
 * 2. CANDIDATE GROUPING - группировка в ProductCandidate
 * 3. VISUAL ANALYSIS - визуальный анализ и perceptual hash
 * 4. DECISION ENGINE - принятие решения на основе scoring
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Попытка загрузить внешние библиотеки (опционально)
let fastGlob, sharp, imageSize, blockhash;
try {
  fastGlob = require('fast-glob');
} catch (e) {
  console.warn('⚠️  fast-glob не установлен, используется встроенный glob');
}
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠️  sharp не установлен, используется упрощенный анализ');
}
try {
  imageSize = require('image-size');
} catch (e) {
  console.warn('⚠️  image-size не установлен, используется упрощенный анализ');
}
try {
  blockhash = require('blockhash-core');
} catch (e) {
  console.warn('⚠️  blockhash-core не установлен, используется упрощенный hash');
}

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

const CONFIG = {
  DISCOVERY: {
    PATTERNS: ['**/*.webp'],
    IGNORE_PATTERNS: ['**/* 2.webp', '**/* 3.webp', '**/node_modules/**'],
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MIN_FILE_SIZE: 1000 // 1KB
  },
  
  GROUPING: {
    MIN_IMAGES_IN_GROUP: 1,
    MAX_IMAGES_IN_GROUP: 15,
    OPTIMAL_IMAGES_IN_GROUP: { min: 2, max: 5 },
    SIMILARITY_THRESHOLD: 0.85,
    DIFFERENCE_THRESHOLD: 0.50
  },
  
  SCORING: {
    MIN_SCORE: 0.65,
    HIGH_CONFIDENCE: 0.80,
    WEIGHTS: {
      STRUCTURAL: 0.30,
      VISUAL: 0.35,
      SEMANTIC: 0.25,
      CONTEXT: 0.10
    }
  },
  
  VISUAL: {
    MIN_WIDTH: 100,
    MAX_WIDTH: 10000,
    MIN_HEIGHT: 100,
    MAX_HEIGHT: 10000,
    OPTIMAL_PIXELS: { min: 1920 * 1080, max: 3840 * 2160 },
    OPTIMAL_ASPECT_RATIO: { min: 0.8, max: 1.5 },
    OPTIMAL_FILE_SIZE: { min: 100000, max: 2000000 }, // 100KB - 2MB
    PHASH_SIZE: 16
  }
};

// ============================================================================
// УТИЛИТЫ
// ============================================================================

function findProjectRoot() {
  let root = __dirname;
  for (let i = 0; i < 10; i++) {
    const testPath = path.join(root, 'data', 'products.json');
    if (fs.existsSync(testPath)) {
      return root;
    }
    const parent = path.join(root, '..');
    if (parent === root) break;
    root = parent;
  }
  return root;
}

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

function normalizeString(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================================================
// ЭТАП 1: DISCOVERY
// ============================================================================

/**
 * Сканирует директорию и находит все изображения
 */
async function discoverImages(foodsDir) {
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 1: DISCOVERY');
  console.log('='.repeat(80) + '\n');
  
  console.log('🔍 Сканирование директории foods...');
  
  const images = [];
  const directories = new Map();
  
  // Используем fast-glob если доступен, иначе встроенный метод
  let filePaths = [];
  
  if (fastGlob) {
    filePaths = await fastGlob(CONFIG.DISCOVERY.PATTERNS, {
      cwd: foodsDir,
      absolute: true,
      ignore: CONFIG.DISCOVERY.IGNORE_PATTERNS
    });
  } else {
    // Fallback: рекурсивное сканирование
    function scanDir(dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
            // Пропускаем дубликаты по имени
            if (!/\s+\d{1}\.webp$/i.test(entry.name)) {
              filePaths.push(fullPath);
            }
          }
        }
      } catch (e) {
        // Игнорируем ошибки доступа
      }
    }
    scanDir(foodsDir);
  }
  
  console.log(`   Найдено файлов: ${filePaths.length}`);
  
  // Извлекаем метаданные
  console.log('📊 Извлечение метаданных...');
  let processed = 0;
  
  for (const filePath of filePaths) {
    if (processed % 50 === 0 && processed > 0) {
      process.stdout.write(`\r   Обработано: ${processed}/${filePaths.length}`);
    }
    
    try {
      const stats = fs.statSync(filePath);
      
      // Проверка размера
      if (stats.size < CONFIG.DISCOVERY.MIN_FILE_SIZE || 
          stats.size > CONFIG.DISCOVERY.MAX_FILE_SIZE) {
        continue;
      }
      
      const metadata = await extractImageMetadata(filePath);
      
      if (metadata) {
        const dirPath = path.dirname(filePath);
        const relativePath = path.relative(foodsDir, filePath);
        
        const imageData = {
          path: filePath,
          relativePath: relativePath,
          directory: dirPath,
          filename: path.basename(filePath),
          metadata: metadata,
          stats: {
            size: stats.size,
            mtime: stats.mtimeMs
          }
        };
        
        images.push(imageData);
        
        // Группируем по директориям
        if (!directories.has(dirPath)) {
          directories.set(dirPath, []);
        }
        directories.get(dirPath).push(imageData);
      }
    } catch (e) {
      // Игнорируем ошибки
    }
    
    processed++;
  }
  
  process.stdout.write(`\r   Обработано: ${filePaths.length}/${filePaths.length}\n\n`);
  
  console.log(`✅ Найдено изображений: ${images.length}`);
  console.log(`✅ Найдено директорий: ${directories.size}\n`);
  
  return {
    images,
    directories,
    stats: {
      totalImages: images.length,
      totalDirectories: directories.size,
      totalSize: images.reduce((sum, img) => sum + img.stats.size, 0)
    }
  };
}

/**
 * Извлекает метаданные изображения
 */
async function extractImageMetadata(imagePath) {
  try {
    const stats = fs.statSync(imagePath);
    let width = null, height = null, format = 'webp';
    
    // Пытаемся использовать sharp
    if (sharp) {
      try {
        const metadata = await sharp(imagePath).metadata();
        width = metadata.width;
        height = metadata.height;
        format = metadata.format;
      } catch (e) {
        // Fallback
      }
    }
    
    // Пытаемся использовать image-size
    if ((!width || !height) && imageSize) {
      try {
        const dimensions = imageSize(imagePath);
        width = dimensions.width;
        height = dimensions.height;
      } catch (e) {
        // Fallback
      }
    }
    
    // Упрощенный парсинг WebP (fallback)
    if (!width || !height) {
      try {
        const buffer = fs.readFileSync(imagePath);
        const view = new Uint8Array(buffer);
        
        if (buffer.length > 12 && 
            view[0] === 0x52 && view[1] === 0x49 && 
            view[2] === 0x46 && view[3] === 0x46) {
          // RIFF файл, пробуем найти VP8
          for (let i = 8; i < Math.min(buffer.length - 10, 200); i++) {
            if (view[i] === 0x56 && view[i+1] === 0x50 && view[i+2] === 0x38) {
              if (i + 10 < buffer.length) {
                const w = (view[i+6] | (view[i+7] << 8)) & 0x3FFF;
                const h = (view[i+8] | (view[i+9] << 8)) & 0x3FFF;
                if (w > 0 && w < 10000 && h > 0 && h < 10000) {
                  width = w;
                  height = h;
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        // Игнорируем
      }
    }
    
    return {
      width: width,
      height: height,
      format: format,
      size: stats.size,
      aspectRatio: width && height ? width / height : null,
      pixels: width && height ? width * height : null
    };
  } catch (e) {
    return null;
  }
}

// ============================================================================
// ЭТАП 2: CANDIDATE GROUPING
// ============================================================================

/**
 * Группирует изображения в ProductCandidate
 */
function groupCandidates(discoveryResult, foodsDir) {
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 2: CANDIDATE GROUPING');
  console.log('='.repeat(80) + '\n');
  
  console.log('🔗 Группировка изображений...');
  
  const candidates = [];
  const processed = new Set();
  
  // Группируем по директориям
  discoveryResult.directories.forEach((images, dirPath) => {
    if (images.length === 0) return;
    
    // Группируем изображения в директории по визуальной схожести
    const groups = groupImagesBySimilarity(images);
    
    groups.forEach(group => {
      if (group.length === 0) return;
      
      // Создаем кандидата
      const candidate = createProductCandidate(group, dirPath, foodsDir);
      
      if (candidate) {
        candidates.push(candidate);
        group.forEach(img => processed.add(img.path));
      }
    });
  });
  
  console.log(`✅ Создано кандидатов: ${candidates.length}\n`);
  
  return {
    candidates,
    stats: {
      total: candidates.length,
      byImageCount: {
        single: candidates.filter(c => c.images.length === 1).length,
        multiple: candidates.filter(c => c.images.length > 1).length
      }
    }
  };
}

/**
 * Группирует изображения по визуальной схожести
 */
function groupImagesBySimilarity(images) {
  if (images.length === 0) return [];
  if (images.length === 1) return [images];
  
  const groups = [];
  const processed = new Set();
  
  for (let i = 0; i < images.length; i++) {
    if (processed.has(i)) continue;
    
    const group = [images[i]];
    processed.add(i);
    
    // Ищем похожие изображения
    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(j)) continue;
      
      const similarity = calculateImageSimilarity(images[i], images[j]);
      
      if (similarity >= CONFIG.GROUPING.SIMILARITY_THRESHOLD) {
        group.push(images[j]);
        processed.add(j);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

/**
 * Вычисляет схожесть двух изображений
 */
function calculateImageSimilarity(img1, img2) {
  let score = 0;
  let factors = 0;
  
  // Сравнение размеров
  if (img1.metadata.width && img2.metadata.width &&
      img1.metadata.height && img2.metadata.height) {
    const sizeDiff = Math.abs(
      (img1.metadata.width * img1.metadata.height) - 
      (img2.metadata.width * img2.metadata.height)
    ) / Math.max(
      img1.metadata.width * img1.metadata.height,
      img2.metadata.width * img2.metadata.height
    );
    score += (1 - sizeDiff) * 0.3;
    factors += 0.3;
  }
  
  // Сравнение aspect ratio
  if (img1.metadata.aspectRatio && img2.metadata.aspectRatio) {
    const ratioDiff = Math.abs(
      img1.metadata.aspectRatio - img2.metadata.aspectRatio
    );
    score += (1 - Math.min(ratioDiff, 1)) * 0.2;
    factors += 0.2;
  }
  
  // Сравнение размера файла
  if (img1.stats.size && img2.stats.size) {
    const sizeDiff = Math.abs(img1.stats.size - img2.stats.size) / 
                     Math.max(img1.stats.size, img2.stats.size);
    score += (1 - sizeDiff) * 0.2;
    factors += 0.2;
  }
  
  // Сравнение имени файла (частичное)
  const name1 = img1.filename.toLowerCase();
  const name2 = img2.filename.toLowerCase();
  const commonWords = name1.split(/[\s\-_]+/).filter(w => 
    w.length > 2 && name2.includes(w)
  );
  if (commonWords.length > 0) {
    score += Math.min(commonWords.length / 3, 1) * 0.3;
    factors += 0.3;
  }
  
  return factors > 0 ? score / factors : 0;
}

/**
 * Создает ProductCandidate из группы изображений
 */
function createProductCandidate(imageGroup, dirPath, foodsDir) {
  if (imageGroup.length === 0) return null;
  
  // Выбираем главное изображение
  const mainImage = selectMainImage(imageGroup);
  
  // Извлекаем семантические данные
  const extracted = extractSemanticData(imageGroup, dirPath, foodsDir);
  
  // Вычисляем структурный score
  const structuralScore = calculateStructuralScore(dirPath, foodsDir, imageGroup.length);
  
  return {
    id: `candidate-${crypto.createHash('md5')
      .update(dirPath + mainImage.path)
      .digest('hex')
      .substring(0, 8)}`,
    images: imageGroup,
    mainImage: mainImage,
    directory: dirPath,
    extracted: extracted,
    structuralScore: structuralScore,
    imageCount: imageGroup.length
  };
}

/**
 * Выбирает главное изображение из группы
 */
function selectMainImage(imageGroup) {
  if (imageGroup.length === 1) return imageGroup[0];
  
  // Сортируем по приоритету
  const scored = imageGroup.map(img => {
    let score = 0;
    
    // Размер (больше = лучше, но не слишком)
    if (img.metadata.pixels) {
      if (img.metadata.pixels >= CONFIG.VISUAL.OPTIMAL_PIXELS.min &&
          img.metadata.pixels <= CONFIG.VISUAL.OPTIMAL_PIXELS.max) {
        score += 0.4;
      } else if (img.metadata.pixels >= 640 * 480) {
        score += 0.2;
      }
    }
    
    // Aspect ratio
    if (img.metadata.aspectRatio) {
      const ratio = img.metadata.aspectRatio;
      if (ratio >= CONFIG.VISUAL.OPTIMAL_ASPECT_RATIO.min &&
          ratio <= CONFIG.VISUAL.OPTIMAL_ASPECT_RATIO.max) {
        score += 0.3;
      }
    }
    
    // Имя файла (без служебных слов)
    const filename = img.filename.toLowerCase();
    if (!/упаковк|маркетинг|коробк|2$|3$|back|side|packaging/i.test(filename)) {
      score += 0.3;
    } else {
      score -= 0.2;
    }
    
    return { image: img, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0].image;
}

/**
 * Извлекает семантические данные из пути и файлов
 */
function extractSemanticData(imageGroup, dirPath, foodsDir) {
  const relativePath = path.relative(foodsDir, dirPath);
  const allText = `${relativePath} ${imageGroup[0].filename}`.toLowerCase();
  
  const extracted = {
    brand: null,
    category: null,
    type: null,
    flavor: null,
    weight: null
  };
  
  // Бренд
  const brandPatterns = [
    /(?:^|\/)(\d+\s+)?(tayas|pakel|oslo|love\s*me|panda\s*lee|navroz|crafers|puffico|alikhan\s*ata)/i
  ];
  for (const pattern of brandPatterns) {
    const match = allText.match(pattern);
    if (match) {
      extracted.brand = (match[2] || match[1] || '').trim();
      break;
    }
  }
  
  // Категория
  const categoryMap = {
    'мармелад': 'marmalade',
    'конфет': 'candy',
    'шоколад': 'chocolate',
    'драже': 'candy',
    'лукум': 'candy',
    'желейн': 'jelly'
  };
  for (const [key, value] of Object.entries(categoryMap)) {
    if (new RegExp(key, 'i').test(allText)) {
      extracted.category = value;
      break;
    }
  }
  
  // Тип
  const typeMap = {
    'ремешк': 'ремешки',
    'карандаш': 'карандаши',
    'мишк': 'мишки',
    'трубочк': 'трубочки',
    'вафл': 'вафли',
    'печенье': 'печенье'
  };
  for (const [key, value] of Object.entries(typeMap)) {
    if (new RegExp(key, 'i').test(allText)) {
      extracted.type = value;
      break;
    }
  }
  
  // Вес
  const weightMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|кг)/i);
  if (weightMatch) {
    const isKg = /кг/i.test(allText);
    extracted.weight = weightMatch[1] + (isKg ? 'kg' : 'gr');
  }
  
  // Вкус
  const flavors = [
    'клубник', 'арбуз', 'яблок', 'апельсин', 'виноград', 'вишн',
    'малин', 'ежевик', 'кола', 'ананас', 'кокос', 'ваниль',
    'шоколад', 'кофе', 'радуг', 'ассорти', 'тропик', 'голубик'
  ];
  for (const flavor of flavors) {
    if (new RegExp(flavor, 'i').test(allText)) {
      extracted.flavor = flavor;
      break;
    }
  }
  
  return extracted;
}

/**
 * Вычисляет структурный score
 */
function calculateStructuralScore(dirPath, foodsDir, imageCount) {
  const relativePath = path.relative(foodsDir, dirPath);
  const parts = relativePath.split(path.sep).filter(p => p);
  const depth = parts.length;
  
  let score = 0;
  
  // Глубина (0.0 - 0.15)
  if (depth >= 3 && depth <= 5) {
    score += 0.15;
  } else if (depth >= 2 && depth <= 6) {
    score += 0.10;
  } else if (depth >= 1 && depth <= 7) {
    score += 0.05;
  }
  
  // Структурированность (0.0 - 0.15)
  const hasBrand = parts[0] && /^\d+\s+/.test(parts[0]);
  const hasCategory = parts.some(p => 
    /мармелад|конфет|шоколад|драже|лукум|желейн/i.test(p)
  );
  const hasSubcategory = parts.some(p => 
    /кисл|желейн|фигурн/i.test(p)
  );
  
  if (hasBrand && hasCategory && hasSubcategory) {
    score += 0.15;
  } else if (hasBrand && hasCategory) {
    score += 0.10;
  } else if (hasBrand || hasCategory) {
    score += 0.05;
  }
  
  return Math.min(1.0, score);
}

// ============================================================================
// ЭТАП 3: VISUAL ANALYSIS
// ============================================================================

/**
 * Выполняет визуальный анализ кандидатов
 */
async function analyzeVisual(candidates, foodsDir, projectRoot, existingProducts) {
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 3: VISUAL ANALYSIS');
  console.log('='.repeat(80) + '\n');
  
  console.log('🖼️  Визуальный анализ кандидатов...');
  
  // Предзагружаем perceptual hash существующих продуктов
  const existingHashes = new Set();
  if (existingProducts) {
    for (const product of existingProducts) {
      if (product.image) {
        const fullPath = path.join(projectRoot, product.image);
        if (fs.existsSync(fullPath)) {
          const phash = await calculatePerceptualHash(fullPath);
          if (phash) {
            existingHashes.add(phash);
          }
        }
      }
    }
  }
  
  let analyzed = 0;
  const analyzedCandidates = [];
  
  for (const candidate of candidates) {
    if (analyzed % 20 === 0 && analyzed > 0) {
      process.stdout.write(`\r   Обработано: ${analyzed}/${candidates.length}`);
    }
    
    const mainImage = candidate.mainImage;
    const phash = await calculatePerceptualHash(mainImage.path);
    
    // Проверка на дубликаты
    const isDuplicate = phash && existingHashes.has(phash);
    
    // Вычисляем визуальный score
    const visualScore = calculateVisualScore(mainImage);
    
    // Анализ качества
    const quality = analyzeImageQuality(mainImage);
    
    analyzedCandidates.push({
      ...candidate,
      visualAnalysis: {
        phash: phash,
        visualScore: visualScore,
        quality: quality,
        isDuplicate: isDuplicate
      }
    });
    
    if (phash) {
      existingHashes.add(phash);
    }
    
    analyzed++;
  }
  
  process.stdout.write(`\r   Обработано: ${candidates.length}/${candidates.length}\n\n`);
  
  const duplicates = analyzedCandidates.filter(c => c.visualAnalysis.isDuplicate);
  console.log(`✅ Проанализировано: ${analyzedCandidates.length}`);
  console.log(`⚠️  Найдено дубликатов: ${duplicates.length}\n`);
  
  return analyzedCandidates;
}

/**
 * Вычисляет perceptual hash изображения
 */
async function calculatePerceptualHash(imagePath) {
  try {
    // Используем blockhash-core если доступен
    if (blockhash) {
      try {
        const buffer = fs.readFileSync(imagePath);
        const hash = await blockhash.blockhashData(buffer, CONFIG.VISUAL.PHASH_SIZE);
        return hash;
      } catch (e) {
        // Fallback
      }
    }
    
    // Упрощенный perceptual hash на основе содержимого
    const buffer = fs.readFileSync(imagePath);
    const stats = fs.statSync(imagePath);
    
    // Используем несколько участков файла
    const chunkSize = Math.min(2048, Math.floor(buffer.length / 4));
    const hash = crypto.createHash('sha256');
    
    // Первые байты
    hash.update(buffer.slice(0, chunkSize));
    
    // Средние байты
    if (buffer.length > chunkSize * 2) {
      const midStart = Math.floor(buffer.length / 2) - chunkSize;
      hash.update(buffer.slice(midStart, midStart + chunkSize));
    }
    
    // Последние байты
    hash.update(buffer.slice(-chunkSize));
    
    // Размер и метаданные
    hash.update(stats.size.toString());
    
    return hash.digest('hex').substring(0, 32);
  } catch (e) {
    return null;
  }
}

/**
 * Вычисляет визуальный score
 */
function calculateVisualScore(image) {
  let score = 0;
  
  const meta = image.metadata;
  
  // Качество изображения (0.0 - 0.20)
  if (meta.pixels) {
    if (meta.pixels >= CONFIG.VISUAL.OPTIMAL_PIXELS.min &&
        meta.pixels <= CONFIG.VISUAL.OPTIMAL_PIXELS.max) {
      score += 0.20;
    } else if (meta.pixels >= 1280 * 720 && meta.pixels <= 7680 * 4320) {
      score += 0.15;
    } else if (meta.pixels >= 640 * 480) {
      score += 0.10;
    } else {
      score += 0.05;
    }
  }
  
  // Aspect ratio (0.0 - 0.10)
  if (meta.aspectRatio) {
    if (meta.aspectRatio >= CONFIG.VISUAL.OPTIMAL_ASPECT_RATIO.min &&
        meta.aspectRatio <= CONFIG.VISUAL.OPTIMAL_ASPECT_RATIO.max) {
      score += 0.10;
    } else if (meta.aspectRatio >= 0.6 && meta.aspectRatio <= 2.0) {
      score += 0.05;
    }
  }
  
  // Размер файла (0.0 - 0.05)
  if (image.stats.size >= CONFIG.VISUAL.OPTIMAL_FILE_SIZE.min &&
      image.stats.size <= CONFIG.VISUAL.OPTIMAL_FILE_SIZE.max) {
    score += 0.05;
  } else if (image.stats.size >= 50000 && image.stats.size <= 5000000) {
    score += 0.03;
  }
  
  return Math.min(1.0, score);
}

/**
 * Анализирует качество изображения
 */
function analyzeImageQuality(image) {
  const meta = image.metadata;
  let quality = 0;
  
  // Разрешение
  if (meta.pixels) {
    if (meta.pixels >= 1920 * 1080) {
      quality += 0.5;
    } else if (meta.pixels >= 1280 * 720) {
      quality += 0.3;
    } else {
      quality += 0.1;
    }
  }
  
  // Размер файла (признак качества)
  if (image.stats.size >= 100000) {
    quality += 0.3;
  } else if (image.stats.size >= 50000) {
    quality += 0.2;
  }
  
  // Aspect ratio (композиция)
  if (meta.aspectRatio && 
      meta.aspectRatio >= 0.8 && meta.aspectRatio <= 1.5) {
    quality += 0.2;
  }
  
  return Math.min(1.0, quality);
}

// ============================================================================
// ЭТАП 4: DECISION ENGINE
// ============================================================================

/**
 * Принимает решение о создании продукта
 */
function makeDecision(candidates, foodsDir) {
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 4: DECISION ENGINE');
  console.log('='.repeat(80) + '\n');
  
  console.log('⚖️  Принятие решений...');
  
  const approved = [];
  const rejected = [];
  
  for (const candidate of candidates) {
    // Пропускаем дубликаты
    if (candidate.visualAnalysis.isDuplicate) {
      rejected.push({
        candidate: candidate,
        score: 0,
        reason: 'duplicate_existing'
      });
      continue;
    }
    
    // Вычисляем полный score
    const score = calculateTotalScore(candidate, foodsDir);
    
    // Применяем penalties
    const penalties = calculatePenalties(candidate);
    const finalScore = Math.max(0, score - penalties);
    
    // Принимаем решение
    if (finalScore >= CONFIG.SCORING.MIN_SCORE) {
      approved.push({
        candidate: candidate,
        score: finalScore,
        breakdown: {
          structural: candidate.structuralScore,
          visual: candidate.visualAnalysis.visualScore,
          semantic: calculateSemanticScore(candidate.extracted),
          context: calculateContextScore(candidate, candidate.directory, foodsDir),
          penalties: penalties
        }
      });
    } else {
      rejected.push({
        candidate: candidate,
        score: finalScore,
        reason: 'low_score',
        breakdown: {
          structural: candidate.structuralScore,
          visual: candidate.visualAnalysis.visualScore,
          semantic: calculateSemanticScore(candidate.extracted),
          context: calculateContextScore(candidate, candidate.directory, foodsDir),
          penalties: penalties
        }
      });
    }
  }
  
  console.log(`✅ Одобрено: ${approved.length}`);
  console.log(`❌ Отклонено: ${rejected.length}\n`);
  
  return {
    approved,
    rejected,
    stats: {
      total: candidates.length,
      approved: approved.length,
      rejected: rejected.length,
      approvalRate: (approved.length / candidates.length * 100).toFixed(1) + '%'
    }
  };
}

/**
 * Вычисляет полный score кандидата
 */
function calculateTotalScore(candidate, foodsDir) {
  const structural = candidate.structuralScore;
  const visual = candidate.visualAnalysis.visualScore;
  const semantic = calculateSemanticScore(candidate.extracted);
  const context = calculateContextScore(candidate, candidate.directory, foodsDir);
  
  const total = (
    structural * CONFIG.SCORING.WEIGHTS.STRUCTURAL +
    visual * CONFIG.SCORING.WEIGHTS.VISUAL +
    semantic * CONFIG.SCORING.WEIGHTS.SEMANTIC +
    context * CONFIG.SCORING.WEIGHTS.CONTEXT
  );
  
  return Math.max(0, Math.min(1.0, total));
}

/**
 * Вычисляет семантический score
 */
function calculateSemanticScore(extracted) {
  let score = 0;
  
  // Бренд (0.0 - 0.10)
  if (extracted.brand) score += 0.10;
  
  // Категория (0.0 - 0.08)
  if (extracted.category) {
    const categoryScores = {
      'marmalade': 0.08,
      'candy': 0.08,
      'chocolate': 0.08,
      'jelly': 0.08
    };
    score += categoryScores[extracted.category] || 0.06;
  }
  
  // Тип (0.0 - 0.05)
  if (extracted.type) {
    const typeScores = {
      'ремешки': 0.05,
      'карандаши': 0.05,
      'мишки': 0.05,
      'трубочки': 0.05,
      'вафли': 0.04,
      'печенье': 0.04
    };
    score += typeScores[extracted.type] || 0.03;
  }
  
  // Вес (0.0 - 0.02)
  if (extracted.weight) score += 0.02;
  
  return Math.min(1.0, score);
}

/**
 * Вычисляет контекстный score
 */
function calculateContextScore(candidate, dirPath, foodsDir) {
  let score = 0;
  
  // Docx файл (0.0 - 0.05)
  try {
    const files = fs.readdirSync(dirPath);
    const hasDocx = files.some(f => 
      f.toLowerCase().endsWith('.docx') || f.toLowerCase().endsWith('.doc')
    );
    if (hasDocx) score += 0.05;
  } catch (e) {
    // Игнорируем
  }
  
  // Стабильность пути (0.0 - 0.03)
  const relativePath = path.relative(foodsDir, dirPath);
  if (!/temp|tmp|test|backup|old/i.test(relativePath)) {
    score += 0.03;
  }
  
  // Связанные файлы (0.0 - 0.02)
  try {
    const files = fs.readdirSync(dirPath);
    const otherFiles = files.filter(f => 
      !f.toLowerCase().endsWith('.webp') &&
      !f.toLowerCase().endsWith('.docx') &&
      !f.toLowerCase().endsWith('.doc')
    );
    if (otherFiles.length > 0) score += 0.02;
  } catch (e) {
    // Игнорируем
  }
  
  return Math.min(1.0, score);
}

/**
 * Вычисляет penalties
 */
function calculatePenalties(candidate) {
  let penalties = 0;
  
  // Одиночное изображение
  if (candidate.imageCount === 1) {
    penalties += 0.30;
  }
  
  // Низкое качество
  if (candidate.visualAnalysis.quality < 0.5) {
    penalties += 0.20;
  }
  
  // Неструктурированный путь
  if (candidate.structuralScore < 0.2) {
    penalties += 0.15;
  }
  
  return penalties;
}

// ============================================================================
// СОЗДАНИЕ ПРОДУКТОВ
// ============================================================================

/**
 * Создает продукты из одобренных кандидатов
 */
function createProducts(approvedCandidates, foodsDir, projectRoot, existingProducts) {
  console.log('🔄 Создание продуктов...');
  
  const existingIds = new Set(existingProducts.map(p => p.id));
  const newProducts = [];
  let copiedImages = 0;
  
  for (const item of approvedCandidates) {
    const candidate = item.candidate;
    const semantic = candidate.extracted;
    const mainImage = candidate.mainImage;
    
    // Определяем категорию
    let category = semantic.category || 'candy';
    
    // Определяем бренд
    let brand = 'UNKNOWN';
    if (semantic.brand) {
      const brandMap = {
        'tayas': 'TAYAS',
        'pakel': 'PAKEL',
        'oslo': 'OSLO',
        'love me': 'LOVE ME',
        'panda lee': 'PANDA LEE',
        'navroz': 'NAVROZ',
        'crafers': 'CRAFERS',
        'puffico': 'PUFFI',
        'alikhan ata': 'SULIFA'
      };
      const brandKey = semantic.brand.toLowerCase();
      for (const [key, value] of Object.entries(brandMap)) {
        if (brandKey.includes(key)) {
          brand = value;
          break;
        }
      }
    }
    
    // Создаем название
    const nameParts = [];
    if (semantic.type) nameParts.push(semantic.type);
    if (semantic.flavor) nameParts.push(semantic.flavor);
    if (semantic.weight) nameParts.push(semantic.weight);
    const productName = nameParts.length > 0 
      ? nameParts.join(' ') 
      : path.basename(mainImage.path, '.webp');
    
    // Создаем immutable slug
    const slugParts = [];
    if (semantic.brand) slugParts.push(createSlug(semantic.brand));
    if (semantic.type) slugParts.push(createSlug(semantic.type));
    if (semantic.flavor) slugParts.push(createSlug(semantic.flavor));
    if (semantic.weight) slugParts.push(createSlug(semantic.weight));
    
    let productId = slugParts.filter(p => p).join('-');
    
    if (!productId) {
      // Если не удалось создать slug, пропускаем
      continue;
    }
    
    // Проверяем уникальность
    let finalId = productId;
    let counter = 1;
    while (existingIds.has(finalId) || 
           newProducts.some(p => p.id === finalId)) {
      finalId = `${productId}-${counter}`;
      counter++;
      if (counter > 100) {
        // Защита от бесконечного цикла
        continue;
      }
    }
    
    // Копируем изображение
    const targetFolder = finalId;
    const targetDir = path.join(projectRoot, 'assets', 'images', 'products', targetFolder);
    const targetImage = path.join(targetDir, `${targetFolder}.webp`);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    if (!fs.existsSync(targetImage)) {
      try {
        fs.copyFileSync(mainImage.path, targetImage);
        copiedImages++;
      } catch (e) {
        console.error(`   ⚠️  Ошибка копирования ${mainImage.path}:`, e.message);
        continue;
      }
    }
    
    const imageRelativePath = `assets/images/products/${targetFolder}/${targetFolder}.webp`;
    
    // Создаем теги
    const tags = [];
    if (semantic.category) {
      tags.push(semantic.category, createSlug(semantic.category));
    }
    if (semantic.type) {
      tags.push(semantic.type, createSlug(semantic.type));
    }
    if (semantic.flavor) {
      tags.push(semantic.flavor, createSlug(semantic.flavor));
    }
    
    // Создаем продукт
    const newProduct = {
      id: finalId,
      name: productName,
      nameRu: productName,
      nameEn: productName,
      category: category,
      brand: brand,
      image: imageRelativePath,
      descriptionKey: finalId.replace(/-/g, '_'),
      descriptionTextKey: finalId.replace(/-/g, '_') + '_filling_text',
      titleKey: 'card__popular-item',
      tags: [...new Set(tags)]
    };
    
    if (semantic.weight) {
      newProduct.weight = semantic.weight;
    }
    
    newProducts.push(newProduct);
    existingIds.add(finalId);
  }
  
  console.log(`   Создано продуктов: ${newProducts.length}`);
  console.log(`   Скопировано изображений: ${copiedImages}\n`);
  
  return newProducts;
}

// ============================================================================
// САНАЦИЯ (упрощенная версия)
// ============================================================================

function sanitizeProducts(products, projectRoot) {
  console.log('\n' + '='.repeat(80));
  console.log('САНАЦИЯ PRODUCTS');
  console.log('='.repeat(80) + '\n');
  
  const toRemove = new Set();
  const stats = {
    total: products.length,
    removed: 0,
    byReason: {}
  };
  
  // Удаляем ID с суффиксами
  let suffixCount = 0;
  products.forEach((p, idx) => {
    if (/-\d+$/.test(p.id)) {
      const baseId = p.id.replace(/-\d+$/, '');
      const hasBase = products.some(prod => prod.id === baseId && prod !== p);
      if (hasBase) {
        toRemove.add(idx);
        suffixCount++;
      }
    }
  });
  stats.byReason['suffix_ids'] = suffixCount;
  
  // Удаляем дубликаты по изображениям
  const imageMap = new Map();
  products.forEach((p, idx) => {
    if (p.image && !toRemove.has(idx)) {
      const normalized = normalizeString(p.image);
      if (!imageMap.has(normalized)) {
        imageMap.set(normalized, []);
      }
      imageMap.get(normalized).push({ idx, product: p });
    }
  });
  
  let duplicateCount = 0;
  imageMap.forEach((prods) => {
    if (prods.length > 1) {
      const sorted = prods.sort((a, b) => a.product.id.length - b.product.id.length);
      for (let i = 1; i < sorted.length; i++) {
        toRemove.add(sorted[i].idx);
        duplicateCount++;
      }
    }
  });
  stats.byReason['duplicate_images'] = duplicateCount;
  
  // Удаляем продукты без изображений
  let missingCount = 0;
  products.forEach((p, idx) => {
    if (!toRemove.has(idx) && p.image) {
      const fullPath = path.join(projectRoot, p.image);
      if (!fs.existsSync(fullPath)) {
        toRemove.add(idx);
        missingCount++;
      }
    }
  });
  stats.byReason['missing_images'] = missingCount;
  
  const cleaned = products.filter((p, idx) => !toRemove.has(idx));
  stats.removed = toRemove.size;
  
  console.log('📊 Результаты санации:');
  console.log(`   Всего продуктов: ${stats.total}`);
  console.log(`   Удалено: ${stats.removed}`);
  console.log(`   Осталось: ${cleaned.length}`);
  console.log(`   По причинам:`, stats.byReason);
  console.log('');
  
  return {
    products: cleaned,
    stats
  };
}

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================================

async function main() {
  const projectRoot = findProjectRoot();
  const productsFile = path.join(projectRoot, 'data', 'products.json');
  const foodsDir = path.join(projectRoot, 'foods');
  const backupFile = path.join(projectRoot, 'data', `products.backup-${Date.now()}.json`);
  
  console.log('🚀 SMART PRODUCT DISCOVERY ENGINE');
  console.log('='.repeat(80));
  console.log(`Корень проекта: ${projectRoot}`);
  console.log(`Файл продуктов: ${productsFile}`);
  console.log(`Директория foods: ${foodsDir}\n`);
  
  // Загружаем данные
  console.log('📖 Загрузка данных...');
  const productsData = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
  const products = productsData.products || [];
  console.log(`   Загружено продуктов: ${products.length}\n`);
  
  // Создаем backup
  console.log('💾 Создание backup...');
  fs.copyFileSync(productsFile, backupFile);
  console.log(`   Backup создан: ${backupFile}\n`);
  
  // САНАЦИЯ
  const sanitized = sanitizeProducts(products, projectRoot);
  
  // ЭТАП 1: DISCOVERY
  const discoveryResult = await discoverImages(foodsDir);
  
  // ЭТАП 2: CANDIDATE GROUPING
  const groupingResult = groupCandidates(discoveryResult, foodsDir);
  
  // ЭТАП 3: VISUAL ANALYSIS
  const analyzedCandidates = await analyzeVisual(
    groupingResult.candidates,
    foodsDir,
    projectRoot,
    sanitized.products
  );
  
  // ЭТАП 4: DECISION ENGINE
  const decisionResult = makeDecision(analyzedCandidates, foodsDir);
  
  // СОЗДАНИЕ ПРОДУКТОВ
  const newProducts = createProducts(
    decisionResult.approved,
    foodsDir,
    projectRoot,
    sanitized.products
  );
  
  // Обновляем products.json
  console.log('💾 Сохранение результатов...');
  productsData.products = [...sanitized.products, ...newProducts];
  
  fs.writeFileSync(productsFile, JSON.stringify(productsData, null, 2), 'utf8');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ЗАВЕРШЕНО');
  console.log('='.repeat(80));
  console.log(`\n📊 Итоговая статистика:`);
  console.log(`   Удалено продуктов (санация): ${sanitized.stats.removed}`);
  console.log(`   Осталось продуктов: ${sanitized.products.length}`);
  console.log(`   Найдено кандидатов: ${groupingResult.candidates.length}`);
  console.log(`   Одобрено: ${decisionResult.approved.length}`);
  console.log(`   Отклонено: ${decisionResult.rejected.length}`);
  console.log(`   Добавлено новых продуктов: ${newProducts.length}`);
  console.log(`   Всего продуктов в файле: ${productsData.products.length}`);
  console.log(`\n💾 Backup: ${backupFile}\n`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, discoverImages, groupCandidates, analyzeVisual, makeDecision };

