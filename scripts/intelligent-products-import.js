/**
 * INTELLIGENT PRODUCTS IMPORT SYSTEM
 * 
 * Двухэтапная система:
 * 1. САНАЦИЯ - удаление некорректных продуктов
 * 2. INTELLIGENT INGESTION - умный импорт с scoring-моделью
 * 
 * КРИТИЧЕСКИЕ ПРИНЦИПЫ:
 * - НЕ трогаем brands, categories, структуру JSON
 * - Работаем ТОЛЬКО с массивом products
 * - Идемпотентность и immutable slug
 * - Продукт создается ТОЛЬКО при прохождении критериев
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

const CONFIG = {
  // Пороги для scoring-модели
  SCORING: {
    MIN_SCORE: 0.65,           // Минимальный score для создания продукта
    STRUCTURAL_WEIGHT: 0.30,    // Вес структурного анализа
    SEMANTIC_WEIGHT: 0.25,      // Вес семантического анализа
    VISUAL_WEIGHT: 0.35,        // Вес визуального анализа
    CONTEXT_WEIGHT: 0.10        // Вес контекстного анализа
  },
  
  // Критерии санации
  SANITATION: {
    REMOVE_SUFFIX_IDS: true,           // Удалять ID с суффиксами (-1, -2, -3)
    REMOVE_DUPLICATE_IMAGES: true,     // Удалять дубликаты по изображениям
    REMOVE_MISSING_IMAGES: true,       // Удалять продукты без изображений
    REMOVE_UNVERIFIED: true,           // Удалять неподтвержденные в foods
    MIN_IMAGE_SIZE: 5000,              // Минимальный размер изображения (байт)
    MAX_IMAGE_SIZE: 10 * 1024 * 1024   // Максимальный размер изображения (10MB)
  },
  
  // Визуальный анализ
  VISUAL: {
    PHASH_SIZE: 16,                    // Размер perceptual hash
    SIMILARITY_THRESHOLD: 0.85,        // Порог схожести изображений
    MIN_ASPECT_RATIO: 0.5,             // Минимальное соотношение сторон
    MAX_ASPECT_RATIO: 2.0              // Максимальное соотношение сторон
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
// ВИЗУАЛЬНЫЙ АНАЛИЗ
// ============================================================================

/**
 * Простой perceptual hash на основе размеров и метаданных
 * Для полноценного phash нужна библиотека, но для начала используем упрощенный вариант
 */
function calculateImageHash(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) return null;
    
    const stats = fs.statSync(imagePath);
    const buffer = fs.readFileSync(imagePath);
    
    // Используем первые байты + размер + модификация времени
    const hash = crypto.createHash('md5');
    hash.update(buffer.slice(0, Math.min(1024, buffer.length)));
    hash.update(stats.size.toString());
    hash.update(stats.mtimeMs.toString());
    
    return hash.digest('hex');
  } catch (e) {
    return null;
  }
}

function getImageMetadata(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) return null;
    
    const stats = fs.statSync(imagePath);
    const buffer = fs.readFileSync(imagePath);
    
    // Простой анализ WebP (упрощенный)
    let width = null, height = null;
    
    // Пытаемся извлечь размеры из WebP (упрощенный парсинг)
    if (buffer.length > 12) {
      // WebP имеет структуру: RIFF...WEBPVP8
      const view = new Uint8Array(buffer);
      if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
        // Это RIFF файл, пробуем найти размеры
        // В реальности нужен полноценный парсер WebP
      }
    }
    
    return {
      size: stats.size,
      width: width,
      height: height,
      aspectRatio: width && height ? width / height : null,
      hash: calculateImageHash(imagePath),
      exists: true
    };
  } catch (e) {
    return { exists: false };
  }
}

function compareImages(img1Path, img2Path) {
  const meta1 = getImageMetadata(img1Path);
  const meta2 = getImageMetadata(img2Path);
  
  if (!meta1 || !meta2 || !meta1.exists || !meta2.exists) {
    return { similar: false, score: 0 };
  }
  
  let score = 0;
  let factors = 0;
  
  // Сравнение размера файла
  if (meta1.size && meta2.size) {
    const sizeDiff = Math.abs(meta1.size - meta2.size) / Math.max(meta1.size, meta2.size);
    score += (1 - sizeDiff) * 0.3;
    factors += 0.3;
  }
  
  // Сравнение hash
  if (meta1.hash && meta2.hash) {
    if (meta1.hash === meta2.hash) {
      score += 0.7;
    } else {
      // Hamming distance для hex hash
      let distance = 0;
      for (let i = 0; i < Math.min(meta1.hash.length, meta2.hash.length); i++) {
        if (meta1.hash[i] !== meta2.hash[i]) distance++;
      }
      const similarity = 1 - (distance / Math.max(meta1.hash.length, meta2.hash.length));
      score += similarity * 0.7;
    }
    factors += 0.7;
  }
  
  const finalScore = factors > 0 ? score / factors : 0;
  
  return {
    similar: finalScore >= CONFIG.VISUAL.SIMILARITY_THRESHOLD,
    score: finalScore
  };
}

// ============================================================================
// ЭТАП 1: САНАЦИЯ
// ============================================================================

function sanitizeProducts(products, projectRoot, foodsDir) {
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 1: САНАЦИЯ PRODUCTS');
  console.log('='.repeat(80) + '\n');
  
  const toRemove = new Set();
  const reasons = new Map();
  const stats = {
    total: products.length,
    removed: 0,
    byReason: {}
  };
  
  // 1. Удаляем ID с суффиксами (-1, -2, -3)
  if (CONFIG.SANITATION.REMOVE_SUFFIX_IDS) {
    console.log('🔍 Проверка ID с суффиксами...');
    let count = 0;
    products.forEach((p, idx) => {
      if (/-\d+$/.test(p.id)) {
        // Проверяем, есть ли версия без суффикса
        const baseId = p.id.replace(/-\d+$/, '');
        const hasBase = products.some(prod => prod.id === baseId && prod !== p);
        
        if (hasBase) {
          toRemove.add(idx);
          reasons.set(idx, 'ID с суффиксом, есть базовая версия');
          count++;
        } else {
          // Нет базовой версии, но суффикс подозрителен - помечаем для проверки
          reasons.set(idx, 'ID с суффиксом, нет базовой версии (подозрительно)');
        }
      }
    });
    stats.byReason['suffix_ids'] = count;
    console.log(`   Найдено: ${count} продуктов с суффиксами\n`);
  }
  
  // 2. Удаляем дубликаты по изображениям
  if (CONFIG.SANITATION.REMOVE_DUPLICATE_IMAGES) {
    console.log('🔍 Проверка дубликатов по изображениям...');
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
    imageMap.forEach((prods, img) => {
      if (prods.length > 1) {
        // Оставляем первый, остальные удаляем
        const sorted = prods.sort((a, b) => {
          // Приоритет: существующий файл > более короткий ID > первый в списке
          const aExists = fs.existsSync(path.join(projectRoot, a.product.image));
          const bExists = fs.existsSync(path.join(projectRoot, b.product.image));
          if (aExists && !bExists) return -1;
          if (!aExists && bExists) return 1;
          return a.product.id.length - b.product.id.length;
        });
        
        for (let i = 1; i < sorted.length; i++) {
          toRemove.add(sorted[i].idx);
          reasons.set(sorted[i].idx, `Дубликат изображения: ${img}`);
          duplicateCount++;
        }
      }
    });
    stats.byReason['duplicate_images'] = duplicateCount;
    console.log(`   Найдено: ${duplicateCount} дубликатов\n`);
  }
  
  // 3. Удаляем продукты с несуществующими изображениями
  if (CONFIG.SANITATION.REMOVE_MISSING_IMAGES) {
    console.log('🔍 Проверка существования изображений...');
    let missingCount = 0;
    
    products.forEach((p, idx) => {
      if (!toRemove.has(idx) && p.image) {
        const fullPath = path.join(projectRoot, p.image);
        if (!fs.existsSync(fullPath)) {
          toRemove.add(idx);
          reasons.set(idx, 'Изображение не существует');
          missingCount++;
        }
      }
    });
    stats.byReason['missing_images'] = missingCount;
    console.log(`   Найдено: ${missingCount} продуктов без изображений\n`);
  }
  
  // 4. Проверка на соответствие структуре foods (упрощенная)
  if (CONFIG.SANITATION.REMOVE_UNVERIFIED) {
    console.log('🔍 Проверка соответствия структуре foods...');
    // Это будет сделано более детально в следующей итерации
    // Пока пропускаем сложную проверку
    console.log('   Пропущено (будет в следующей итерации)\n');
  }
  
  // Удаляем помеченные продукты
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
    removed: Array.from(toRemove).map(idx => ({
      index: idx,
      product: products[idx],
      reason: reasons.get(idx)
    })),
    stats
  };
}

// ============================================================================
// ЭТАП 2: INTELLIGENT INGESTION
// ============================================================================

/**
 * Структурный анализ пути к файлу
 */
function structuralAnalysis(filePath, foodsDir) {
  const relativePath = path.relative(foodsDir, filePath);
  const parts = path.dirname(relativePath).split(path.sep).filter(p => p);
  
  let score = 0;
  const factors = [];
  
  // Глубина расположения (оптимально 3-5 уровней)
  const depth = parts.length;
  if (depth >= 3 && depth <= 5) {
    score += 0.3;
    factors.push('optimal_depth');
  } else if (depth >= 2 && depth <= 6) {
    score += 0.15;
    factors.push('acceptable_depth');
  }
  
  // Наличие структурированных папок (бренд -> категория -> подкатегория)
  const hasBrand = parts[0] && /^\d+\s+/.test(parts[0]);
  const hasCategory = parts.some(p => 
    /мармелад|конфет|шоколад|драже|лукум|желейн/i.test(p)
  );
  
  if (hasBrand && hasCategory) {
    score += 0.4;
    factors.push('structured_path');
  } else if (hasBrand || hasCategory) {
    score += 0.2;
    factors.push('partial_structure');
  }
  
  // Наличие нескольких файлов в директории (признак продукта)
  try {
    const dir = path.dirname(filePath);
    const files = fs.readdirSync(dir);
    const webpFiles = files.filter(f => f.toLowerCase().endsWith('.webp'));
    if (webpFiles.length >= 2 && webpFiles.length <= 5) {
      score += 0.3;
      factors.push('multiple_images');
    }
  } catch (e) {
    // Игнорируем ошибки
  }
  
  return {
    score: Math.min(1.0, score),
    factors,
    depth,
    parts
  };
}

/**
 * Семантический анализ - извлечение устойчивых признаков
 */
function semanticAnalysis(filePath, filename, foodsDir) {
  const relativePath = path.relative(foodsDir, filePath);
  const dirPath = path.dirname(relativePath);
  const allText = `${dirPath} ${filename}`.toLowerCase();
  
  let score = 0;
  const factors = [];
  const extracted = {
    brand: null,
    category: null,
    type: null,
    flavor: null,
    weight: null
  };
  
  // Извлечение бренда
  const brandPatterns = [
    /(?:^|\/)(\d+\s+)?(tayas|pakel|oslo|love\s*me|panda\s*lee|navroz|crafers|puffico|alikhan\s*ata)/i
  ];
  for (const pattern of brandPatterns) {
    const match = allText.match(pattern);
    if (match) {
      extracted.brand = match[2] || match[1];
      score += 0.2;
      factors.push('brand_found');
      break;
    }
  }
  
  // Извлечение категории
  const categoryPatterns = [
    /мармелад/i, /конфет/i, /шоколад/i, /драже/i, /лукум/i, /желейн/i
  ];
  for (const pattern of categoryPatterns) {
    if (pattern.test(allText)) {
      extracted.category = pattern.source.replace(/[\/i]/g, '');
      score += 0.2;
      factors.push('category_found');
      break;
    }
  }
  
  // Извлечение типа продукта
  const typePatterns = [
    /(ремешк|карандаш|мишк|трубочк|вафл|печенье)/i
  ];
  for (const pattern of typePatterns) {
    const match = allText.match(pattern);
    if (match) {
      extracted.type = match[1];
      score += 0.15;
      factors.push('type_found');
      break;
    }
  }
  
  // Извлечение веса
  const weightMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|кг)/i);
  if (weightMatch) {
    extracted.weight = weightMatch[1] + (allText.includes('кг') ? 'kg' : 'gr');
    score += 0.15;
    factors.push('weight_found');
  }
  
  // Извлечение вкуса
  const flavorPatterns = [
    /(клубник|арбуз|яблок|апельсин|виноград|вишн|малин|ежевик|кола|ананас|кокос|ваниль|шоколад|кофе|радуг|ассорти|тропик)/i
  ];
  for (const pattern of flavorPatterns) {
    const match = allText.match(pattern);
    if (match) {
      extracted.flavor = match[1];
      score += 0.1;
      factors.push('flavor_found');
      break;
    }
  }
  
  // Штраф за использование числовых кодов в slug
  const hasNumericCode = /\d{4,}/.test(filename);
  if (hasNumericCode && !extracted.weight) {
    score -= 0.1;
    factors.push('penalty_numeric_code');
  }
  
  return {
    score: Math.max(0, Math.min(1.0, score)),
    factors,
    extracted
  };
}

/**
 * Визуальный анализ изображения
 */
function visualAnalysis(imagePath, projectRoot) {
  const fullPath = path.join(projectRoot, imagePath);
  const metadata = getImageMetadata(fullPath);
  
  if (!metadata || !metadata.exists) {
    return { score: 0, factors: ['image_not_found'] };
  }
  
  let score = 0;
  const factors = [];
  
  // Размер файла (оптимально 50KB - 2MB)
  if (metadata.size >= 50000 && metadata.size <= 2 * 1024 * 1024) {
    score += 0.3;
    factors.push('optimal_size');
  } else if (metadata.size >= CONFIG.SANITATION.MIN_IMAGE_SIZE && 
             metadata.size <= CONFIG.SANITATION.MAX_IMAGE_SIZE) {
    score += 0.15;
    factors.push('acceptable_size');
  } else {
    factors.push('penalty_size');
  }
  
  // Aspect ratio (оптимально 0.8 - 1.5 для продуктов)
  if (metadata.aspectRatio) {
    if (metadata.aspectRatio >= 0.8 && metadata.aspectRatio <= 1.5) {
      score += 0.2;
      factors.push('optimal_aspect');
    } else if (metadata.aspectRatio >= CONFIG.VISUAL.MIN_ASPECT_RATIO &&
               metadata.aspectRatio <= CONFIG.VISUAL.MAX_ASPECT_RATIO) {
      score += 0.1;
      factors.push('acceptable_aspect');
    }
  }
  
  // Наличие hash (признак валидного изображения)
  if (metadata.hash) {
    score += 0.3;
    factors.push('valid_image');
  }
  
  // Проверка на дубликаты (сравнение с другими изображениями)
  // Это будет сделано на уровне выше
  
  return {
    score: Math.min(1.0, score),
    factors,
    metadata
  };
}

/**
 * Контекстный анализ - проверка окружения файла
 */
function contextAnalysis(filePath, foodsDir) {
  let score = 0;
  const factors = [];
  
  // Наличие docx файла рядом (признак продукта)
  try {
    const dir = path.dirname(filePath);
    const files = fs.readdirSync(dir);
    const hasDocx = files.some(f => f.toLowerCase().endsWith('.docx') || 
                                    f.toLowerCase().endsWith('.doc'));
    if (hasDocx) {
      score += 0.3;
      factors.push('has_description_file');
    }
  } catch (e) {
    // Игнорируем
  }
  
  // Наличие других изображений в папке (признак продукта)
  try {
    const dir = path.dirname(filePath);
    const files = fs.readdirSync(dir);
    const webpFiles = files.filter(f => 
      f.toLowerCase().endsWith('.webp') && 
      path.basename(filePath) !== f
    );
    if (webpFiles.length > 0) {
      score += 0.2;
      factors.push('has_related_images');
    }
  } catch (e) {
    // Игнорируем
  }
  
  // Стабильность пути (нет временных или служебных папок)
  const relativePath = path.relative(foodsDir, filePath);
  if (!/temp|tmp|test|backup|old/i.test(relativePath)) {
    score += 0.2;
    factors.push('stable_path');
  }
  
  return {
    score: Math.min(1.0, score),
    factors
  };
}

/**
 * Scoring-модель для принятия решения о создании продукта
 */
function calculateProductScore(filePath, filename, foodsDir, projectRoot, existingImages) {
  const structural = structuralAnalysis(filePath, foodsDir);
  const semantic = semanticAnalysis(filePath, filename, foodsDir);
  const visual = visualAnalysis(filePath, projectRoot);
  const context = contextAnalysis(filePath, foodsDir);
  
  // Проверка на дубликаты изображений
  let duplicatePenalty = 0;
  if (visual.metadata && visual.metadata.hash && visual.metadata.exists) {
    const isDuplicate = existingImages.some(existing => {
      if (existing.hash && existing.hash === visual.metadata.hash) {
        return true;
      }
      // Сравнение файлов (если путь существует)
      if (existing.path && fs.existsSync(existing.path)) {
        const comparison = compareImages(filePath, existing.path);
        return comparison.similar;
      }
      return false;
    });
    
    if (isDuplicate) {
      duplicatePenalty = -0.5;
      visual.factors.push('duplicate_image');
    }
  }
  
  // Взвешенная сумма
  const totalScore = 
    structural.score * CONFIG.SCORING.STRUCTURAL_WEIGHT +
    semantic.score * CONFIG.SCORING.SEMANTIC_WEIGHT +
    visual.score * CONFIG.SCORING.VISUAL_WEIGHT +
    context.score * CONFIG.SCORING.CONTEXT_WEIGHT +
    duplicatePenalty;
  
  return {
    total: Math.max(0, Math.min(1.0, totalScore)),
    structural,
    semantic,
    visual,
    context,
    duplicatePenalty,
    shouldImport: totalScore >= CONFIG.SCORING.MIN_SCORE
  };
}

/**
 * Создание immutable slug на основе устойчивых признаков
 */
function createImmutableSlug(semanticData, structuralData) {
  const parts = [];
  
  // Бренд
  if (semanticData.extracted.brand) {
    parts.push(createSlug(semanticData.extracted.brand));
  }
  
  // Тип
  if (semanticData.extracted.type) {
    parts.push(createSlug(semanticData.extracted.type));
  }
  
  // Вкус
  if (semanticData.extracted.flavor) {
    parts.push(createSlug(semanticData.extracted.flavor));
  }
  
  // Вес
  if (semanticData.extracted.weight) {
    parts.push(createSlug(semanticData.extracted.weight));
  }
  
  // Если недостаточно частей, используем структуру пути
  if (parts.length < 2 && structuralData.parts.length > 0) {
    const relevantParts = structuralData.parts
      .filter(p => !/^\d+\s+/.test(p))
      .slice(-2);
    relevantParts.forEach(p => {
      const slug = createSlug(p);
      if (slug && !parts.includes(slug)) {
        parts.push(slug);
      }
    });
  }
  
  return parts.filter(p => p).join('-') || 'unknown-product';
}

/**
 * Интеллектуальный импорт продуктов из foods
 */
function intelligentIngestion(foodsDir, projectRoot, existingProducts) {
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 2: INTELLIGENT INGESTION');
  console.log('='.repeat(80) + '\n');
  
  const existingIds = new Set(existingProducts.map(p => p.id));
  const existingImages = existingProducts
    .filter(p => p.image)
    .map(p => {
      const fullPath = path.join(projectRoot, p.image);
      const meta = getImageMetadata(fullPath);
      return {
        path: fullPath,
        hash: meta ? meta.hash : null,
        productId: p.id
      };
    });
  
  // Сканируем foods
  console.log('🔍 Сканирование директории foods...');
  const candidates = [];
  
  function scanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
          // Пропускаем дубликаты (файлы с цифрой в конце)
          if (!/^\d+\.webp$/i.test(entry.name) && !/\s+\d{1}\.webp$/i.test(entry.name)) {
            candidates.push({
              path: fullPath,
              filename: entry.name,
              dir: dir
            });
          }
        }
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  }
  
  scanDirectory(foodsDir);
  console.log(`   Найдено кандидатов: ${candidates.length}\n`);
  
  // Оцениваем каждый кандидат
  console.log('📊 Оценка кандидатов...');
  const scoredCandidates = [];
  
  candidates.forEach((candidate, idx) => {
    if (idx % 50 === 0 && idx > 0) {
      process.stdout.write(`\r   Обработано: ${idx}/${candidates.length}`);
    }
    
    const score = calculateProductScore(
      candidate.path,
      candidate.filename,
      foodsDir,
      projectRoot,
      existingImages
    );
    
    if (score.shouldImport) {
      const semantic = score.semantic;
      const structural = score.structural;
      
      // Создаем immutable slug
      let productId = createImmutableSlug(semantic, structural);
      
      // Проверяем уникальность
      let finalId = productId;
      let counter = 1;
      while (existingIds.has(finalId) || 
             scoredCandidates.some(c => c.id === finalId)) {
        finalId = `${productId}-${counter}`;
        counter++;
      }
      
      scoredCandidates.push({
        id: finalId,
        path: candidate.path,
        filename: candidate.filename,
        score: score,
        semantic: semantic.extracted
      });
      
      existingIds.add(finalId);
    }
  });
  
  process.stdout.write(`\r   Обработано: ${candidates.length}/${candidates.length}\n\n`);
  
  console.log(`📊 Результаты оценки:`);
  console.log(`   Всего кандидатов: ${candidates.length}`);
  console.log(`   Прошли порог (${CONFIG.SCORING.MIN_SCORE}): ${scoredCandidates.length}`);
  console.log(`   Отклонено: ${candidates.length - scoredCandidates.length}\n`);
  
  return scoredCandidates;
}

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================================

function main() {
  const projectRoot = findProjectRoot();
  const productsFile = path.join(projectRoot, 'data', 'products.json');
  const foodsDir = path.join(projectRoot, 'foods');
  const backupFile = path.join(projectRoot, 'data', `products.backup-${Date.now()}.json`);
  
  console.log('🚀 INTELLIGENT PRODUCTS IMPORT SYSTEM');
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
  
  // ЭТАП 1: САНАЦИЯ
  const sanitized = sanitizeProducts(products, projectRoot, foodsDir);
  
  // ЭТАП 2: INTELLIGENT INGESTION
  const newCandidates = intelligentIngestion(foodsDir, projectRoot, sanitized.products);
  
  // Создаем новые продукты из кандидатов
  console.log('🔄 Создание новых продуктов...');
  const newProducts = [];
  let copiedImages = 0;
  
  newCandidates.forEach(candidate => {
    const semantic = candidate.semantic;
    const imagePath = candidate.path;
    const relativePath = path.relative(foodsDir, imagePath);
    
    // Определяем категорию
    let category = 'candy'; // default
    if (semantic.category) {
      const catMap = {
        'мармелад': 'marmalade',
        'конфет': 'candy',
        'шоколад': 'chocolate',
        'драже': 'candy',
        'лукум': 'candy',
        'желейн': 'jelly'
      };
      for (const [key, value] of Object.entries(catMap)) {
        if (semantic.category.toLowerCase().includes(key)) {
          category = value;
          break;
        }
      }
    }
    
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
      : path.basename(imagePath, '.webp');
    
    // Копируем изображение
    const targetFolder = candidate.id;
    const targetDir = path.join(projectRoot, 'assets', 'images', 'products', targetFolder);
    const targetImage = path.join(targetDir, `${targetFolder}.webp`);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    if (!fs.existsSync(targetImage)) {
      try {
        fs.copyFileSync(imagePath, targetImage);
        copiedImages++;
      } catch (e) {
        console.error(`   ⚠️  Ошибка копирования ${imagePath}:`, e.message);
      }
    }
    
    const imageRelativePath = `assets/images/products/${targetFolder}/${targetFolder}.webp`;
    
    // Создаем теги
    const tags = [];
    if (semantic.category) tags.push(semantic.category, semantic.category.toLowerCase());
    if (semantic.type) tags.push(semantic.type, createSlug(semantic.type));
    if (semantic.flavor) tags.push(semantic.flavor, createSlug(semantic.flavor));
    
    // Создаем продукт
    const newProduct = {
      id: candidate.id,
      name: productName,
      nameRu: productName,
      nameEn: productName, // TODO: перевод
      category: category,
      brand: brand,
      image: imageRelativePath,
      descriptionKey: candidate.id.replace(/-/g, '_'),
      descriptionTextKey: candidate.id.replace(/-/g, '_') + '_filling_text',
      titleKey: 'card__popular-item',
      tags: [...new Set(tags)]
    };
    
    if (semantic.weight) {
      newProduct.weight = semantic.weight;
    }
    
    newProducts.push(newProduct);
  });
  
  console.log(`   Создано новых продуктов: ${newProducts.length}`);
  console.log(`   Скопировано изображений: ${copiedImages}\n`);
  
  // Обновляем products.json
  console.log('💾 Сохранение результатов...');
  productsData.products = [...sanitized.products, ...newProducts];
  
  fs.writeFileSync(productsFile, JSON.stringify(productsData, null, 2), 'utf8');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ЗАВЕРШЕНО');
  console.log('='.repeat(80));
  console.log(`\n📊 Итоговая статистика:`);
  console.log(`   Удалено продуктов: ${sanitized.stats.removed}`);
  console.log(`   Осталось продуктов: ${sanitized.products.length}`);
  console.log(`   Найдено новых кандидатов: ${newCandidates.length}`);
  console.log(`   Добавлено новых продуктов: ${newProducts.length}`);
  console.log(`   Всего продуктов в файле: ${productsData.products.length}`);
  console.log(`\n💾 Backup: ${backupFile}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { main, sanitizeProducts, intelligentIngestion };

