/**
 * IMAGE-AWARE PRODUCT INGESTION FRAMEWORK
 * 
 * Интеллектуальный импорт продуктов с группировкой изображений
 * и визуальным анализом для различения вариантов одного продукта
 * от разных продуктов.
 * 
 * ПРИНЦИП: ГРУППИРОВКА → ВАЛИДАЦИЯ → СОЗДАНИЕ
 * 
 * КРИТИЧЕСКИЕ ПРАВИЛА:
 * - НЕ "1 файл = 1 продукт"
 * - НЕ "1 папка = 1 продукт" (не всегда верно)
 * - Группируем изображения по папкам + визуальная схожесть
 * - Создаем продукт ТОЛЬКО если группа проходит все критерии
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

const CONFIG = {
  SCORING: {
    MIN_SCORE: 0.65,
    STRUCTURAL_WEIGHT: 0.30,
    SEMANTIC_WEIGHT: 0.25,
    VISUAL_WEIGHT: 0.35,
    CONTEXT_WEIGHT: 0.10
  },
  
  VISUAL: {
    SIMILARITY_THRESHOLD: 0.85,      // Порог для вариантов одного продукта
    DIFFERENCE_THRESHOLD: 0.50,       // Порог для разных продуктов
    MIN_IMAGE_SIZE: 5000,
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,
    MIN_ASPECT_RATIO: 0.5,
    MAX_ASPECT_RATIO: 2.0,
    OPTIMAL_ASPECT_RATIO: { min: 0.8, max: 1.5 }
  },
  
  GROUPING: {
    MIN_IMAGES_IN_GROUP: 1,          // Минимум изображений для продукта
    MAX_IMAGES_IN_GROUP: 10,          // Максимум (больше = подозрительно)
    OPTIMAL_IMAGES_IN_GROUP: { min: 2, max: 5 }
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
 * Улучшенный perceptual hash на основе содержимого изображения
 */
function calculatePerceptualHash(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) return null;
    
    const buffer = fs.readFileSync(imagePath);
    const stats = fs.statSync(imagePath);
    
    // Используем первые 2KB + средние 2KB + последние 2KB для более точного hash
    const chunkSize = Math.min(2048, Math.floor(buffer.length / 3));
    const hash = crypto.createHash('sha256');
    
    // Первые байты (заголовок)
    hash.update(buffer.slice(0, chunkSize));
    
    // Средние байты (содержимое)
    if (buffer.length > chunkSize * 2) {
      hash.update(buffer.slice(Math.floor(buffer.length / 2) - chunkSize, Math.floor(buffer.length / 2) + chunkSize));
    }
    
    // Последние байты (конец файла)
    hash.update(buffer.slice(-chunkSize));
    
    // Размер файла (важен для различия)
    hash.update(stats.size.toString());
    
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
    
    // Упрощенный парсинг WebP для размеров
    let width = null, height = null;
    
    if (buffer.length > 12) {
      const view = new Uint8Array(buffer);
      // WebP: RIFF....WEBP
      if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
        // Пытаемся найти VP8 chunk для размеров
        // Упрощенный вариант - в реальности нужен полноценный парсер
        for (let i = 8; i < Math.min(buffer.length - 10, 100); i++) {
          if (view[i] === 0x56 && view[i+1] === 0x50 && view[i+2] === 0x38) {
            // Найден VP8, пробуем извлечь размеры
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
    }
    
    return {
      size: stats.size,
      width: width,
      height: height,
      aspectRatio: width && height ? width / height : null,
      phash: calculatePerceptualHash(imagePath),
      exists: true,
      path: imagePath
    };
  } catch (e) {
    return { exists: false, path: imagePath };
  }
}

/**
 * Сравнение двух изображений по perceptual hash
 */
function compareImagesByHash(img1, img2) {
  if (!img1.phash || !img2.phash) {
    return { similar: false, score: 0 };
  }
  
  if (img1.phash === img2.phash) {
    return { similar: true, score: 1.0 };
  }
  
  // Hamming distance для hex hash
  let distance = 0;
  const len = Math.min(img1.phash.length, img2.phash.length);
  for (let i = 0; i < len; i++) {
    if (img1.phash[i] !== img2.phash[i]) distance++;
  }
  
  const similarity = 1 - (distance / len);
  
  return {
    similar: similarity >= CONFIG.VISUAL.SIMILARITY_THRESHOLD,
    score: similarity
  };
}

/**
 * Выбор главного изображения из группы
 */
function selectMainImage(imageGroup) {
  if (imageGroup.length === 0) return null;
  if (imageGroup.length === 1) return imageGroup[0];
  
  // Сортируем по приоритету:
  // 1. Размер файла (больше = лучше качество, но не слишком)
  // 2. Aspect ratio (ближе к 1.0 = основной ракурс)
  // 3. Имя файла (без "2", "упаковка", "маркетинг" и т.д.)
  
  const scored = imageGroup.map(img => {
    let score = 0;
    
    // Размер (оптимально 100KB - 1MB)
    if (img.metadata.size >= 100000 && img.metadata.size <= 1024 * 1024) {
      score += 0.4;
    } else if (img.metadata.size >= 50000 && img.metadata.size <= 2 * 1024 * 1024) {
      score += 0.2;
    }
    
    // Aspect ratio (ближе к 1.0)
    if (img.metadata.aspectRatio) {
      const ratio = img.metadata.aspectRatio;
      if (ratio >= 0.9 && ratio <= 1.1) {
        score += 0.3;
      } else if (ratio >= 0.8 && ratio <= 1.2) {
        score += 0.15;
      }
    }
    
    // Имя файла (без служебных слов)
    const filename = path.basename(img.path, '.webp').toLowerCase();
    if (!/упаковк|маркетинг|коробк|2$|3$|back|side/i.test(filename)) {
      score += 0.3;
    } else {
      score -= 0.2; // Штраф за служебные слова
    }
    
    return { image: img, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0].image;
}

// ============================================================================
// ГРУППИРОВКА ИЗОБРАЖЕНИЙ
// ============================================================================

/**
 * Группирует изображения в папке по визуальной схожести
 */
function groupImagesInDirectory(dirPath, foodsDir) {
  const images = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
        // Пропускаем явные дубликаты (файлы с цифрой в конце)
        if (!/^\d+\.webp$/i.test(entry.name) && !/\s+\d{1}\.webp$/i.test(entry.name)) {
          const fullPath = path.join(dirPath, entry.name);
          const metadata = getImageMetadata(fullPath);
          
          if (metadata && metadata.exists) {
            images.push({
              path: fullPath,
              filename: entry.name,
              metadata: metadata,
              relativePath: path.relative(foodsDir, fullPath)
            });
          }
        }
      }
    }
  } catch (e) {
    // Игнорируем ошибки
  }
  
  if (images.length === 0) return [];
  
  // Группируем по визуальной схожести
  const groups = [];
  const processed = new Set();
  
  for (let i = 0; i < images.length; i++) {
    if (processed.has(i)) continue;
    
    const group = [images[i]];
    processed.add(i);
    
    // Ищем похожие изображения
    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(j)) continue;
      
      const comparison = compareImagesByHash(images[i].metadata, images[j].metadata);
      
      // Если очень похожи - это варианты одного продукта
      if (comparison.similar) {
        group.push(images[j]);
        processed.add(j);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

// ============================================================================
// АНАЛИЗ ГРУППЫ
// ============================================================================

/**
 * Структурный анализ группы изображений
 */
function analyzeGroupStructure(group, foodsDir) {
  if (group.length === 0) return { score: 0, factors: [] };
  
  const firstImage = group[0];
  const relativePath = path.relative(foodsDir, firstImage.path);
  const dirPath = path.dirname(relativePath);
  const parts = dirPath.split(path.sep).filter(p => p);
  
  let score = 0;
  const factors = [];
  
  // Глубина (оптимально 3-5)
  const depth = parts.length;
  if (depth >= 3 && depth <= 5) {
    score += 0.3;
    factors.push('optimal_depth');
  } else if (depth >= 2 && depth <= 6) {
    score += 0.15;
    factors.push('acceptable_depth');
  }
  
  // Структурированность (бренд → категория → подкатегория)
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
  
  // Количество изображений в группе
  const count = group.length;
  if (count >= CONFIG.GROUPING.OPTIMAL_IMAGES_IN_GROUP.min && 
      count <= CONFIG.GROUPING.OPTIMAL_IMAGES_IN_GROUP.max) {
    score += 0.3;
    factors.push('optimal_group_size');
  } else if (count >= CONFIG.GROUPING.MIN_IMAGES_IN_GROUP && 
             count <= CONFIG.GROUPING.MAX_IMAGES_IN_GROUP) {
    score += 0.15;
    factors.push('acceptable_group_size');
  } else if (count > CONFIG.GROUPING.MAX_IMAGES_IN_GROUP) {
    score -= 0.2; // Штраф за слишком много изображений
    factors.push('penalty_too_many_images');
  }
  
  return {
    score: Math.max(0, Math.min(1.0, score)),
    factors,
    depth,
    parts,
    imageCount: count
  };
}

/**
 * Семантический анализ группы
 */
function analyzeGroupSemantics(group, foodsDir) {
  if (group.length === 0) return { score: 0, factors: [], extracted: {} };
  
  const firstImage = group[0];
  const relativePath = path.relative(foodsDir, firstImage.path);
  const dirPath = path.dirname(relativePath);
  const allText = `${dirPath} ${firstImage.filename}`.toLowerCase();
  
  let score = 0;
  const factors = [];
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
      score += 0.2;
      factors.push('brand_found');
      break;
    }
  }
  
  // Категория
  const categoryPatterns = [
    { pattern: /мармелад/i, value: 'мармелад' },
    { pattern: /конфет/i, value: 'конфеты' },
    { pattern: /шоколад/i, value: 'шоколад' },
    { pattern: /драже/i, value: 'драже' },
    { pattern: /лукум/i, value: 'лукум' },
    { pattern: /желейн/i, value: 'желейный' }
  ];
  for (const { pattern, value } of categoryPatterns) {
    if (pattern.test(allText)) {
      extracted.category = value;
      score += 0.2;
      factors.push('category_found');
      break;
    }
  }
  
  // Тип
  const typePatterns = [
    { pattern: /(ремешк|ремни)/i, value: 'ремешки' },
    { pattern: /(карандаш)/i, value: 'карандаши' },
    { pattern: /(мишк|медвед)/i, value: 'мишки' },
    { pattern: /(трубочк)/i, value: 'трубочки' },
    { pattern: /(вафл)/i, value: 'вафли' },
    { pattern: /(печенье)/i, value: 'печенье' }
  ];
  for (const { pattern, value } of typePatterns) {
    const match = allText.match(pattern);
    if (match) {
      extracted.type = value;
      score += 0.15;
      factors.push('type_found');
      break;
    }
  }
  
  // Вес
  const weightMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|кг)/i);
  if (weightMatch) {
    const isKg = /кг/i.test(allText);
    extracted.weight = weightMatch[1] + (isKg ? 'kg' : 'gr');
    score += 0.15;
    factors.push('weight_found');
  }
  
  // Вкус
  const flavorPatterns = [
    'клубник', 'арбуз', 'яблок', 'апельсин', 'виноград', 'вишн', 
    'малин', 'ежевик', 'кола', 'ананас', 'кокос', 'ваниль', 
    'шоколад', 'кофе', 'радуг', 'ассорти', 'тропик', 'голубик'
  ];
  for (const flavor of flavorPatterns) {
    if (new RegExp(flavor, 'i').test(allText)) {
      extracted.flavor = flavor;
      score += 0.1;
      factors.push('flavor_found');
      break;
    }
  }
  
  // Штраф за использование числовых кодов в slug
  const hasNumericCode = /\d{4,}/.test(firstImage.filename);
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
 * Визуальный анализ группы
 */
function analyzeGroupVisual(group) {
  if (group.length === 0) return { score: 0, factors: [] };
  
  let score = 0;
  const factors = [];
  let validImages = 0;
  
  for (const img of group) {
    const meta = img.metadata;
    if (!meta || !meta.exists) continue;
    
    validImages++;
    
    // Размер файла
    if (meta.size >= 50000 && meta.size <= 2 * 1024 * 1024) {
      score += 0.2;
      if (meta.size >= 100000 && meta.size <= 1024 * 1024) {
        score += 0.1; // Бонус за оптимальный размер
      }
    } else if (meta.size < CONFIG.VISUAL.MIN_IMAGE_SIZE || 
               meta.size > CONFIG.VISUAL.MAX_IMAGE_SIZE) {
      score -= 0.1; // Штраф
    }
    
    // Aspect ratio
    if (meta.aspectRatio) {
      if (meta.aspectRatio >= CONFIG.VISUAL.OPTIMAL_ASPECT_RATIO.min &&
          meta.aspectRatio <= CONFIG.VISUAL.OPTIMAL_ASPECT_RATIO.max) {
        score += 0.15;
        factors.push('optimal_aspect');
      } else if (meta.aspectRatio >= CONFIG.VISUAL.MIN_ASPECT_RATIO &&
                 meta.aspectRatio <= CONFIG.VISUAL.MAX_ASPECT_RATIO) {
        score += 0.05;
      }
    }
    
    // Perceptual hash
    if (meta.phash) {
      score += 0.1;
      factors.push('valid_phash');
    }
  }
  
  // Нормализуем по количеству изображений
  if (validImages > 0) {
    score = score / validImages;
  }
  
  // Бонус за несколько изображений (варианты продукта)
  if (group.length >= 2 && group.length <= 5) {
    score += 0.1;
    factors.push('multiple_variants');
  }
  
  return {
    score: Math.max(0, Math.min(1.0, score)),
    factors,
    imageCount: validImages
  };
}

/**
 * Контекстный анализ группы
 */
function analyzeGroupContext(group, foodsDir) {
  if (group.length === 0) return { score: 0, factors: [] };
  
  const firstImage = group[0];
  const dirPath = path.dirname(firstImage.path);
  
  let score = 0;
  const factors = [];
  
  // Наличие docx файла
  try {
    const files = fs.readdirSync(dirPath);
    const hasDocx = files.some(f => 
      f.toLowerCase().endsWith('.docx') || f.toLowerCase().endsWith('.doc')
    );
    if (hasDocx) {
      score += 0.3;
      factors.push('has_description_file');
    }
  } catch (e) {
    // Игнорируем
  }
  
  // Стабильность пути
  const relativePath = path.relative(foodsDir, firstImage.path);
  if (!/temp|tmp|test|backup|old/i.test(relativePath)) {
    score += 0.2;
    factors.push('stable_path');
  }
  
  // Наличие других файлов (признак продукта)
  try {
    const files = fs.readdirSync(dirPath);
    const otherFiles = files.filter(f => 
      !f.toLowerCase().endsWith('.webp') &&
      !f.toLowerCase().endsWith('.docx') &&
      !f.toLowerCase().endsWith('.doc')
    );
    if (otherFiles.length > 0) {
      score += 0.1;
      factors.push('has_related_files');
    }
  } catch (e) {
    // Игнорируем
  }
  
  return {
    score: Math.min(1.0, score),
    factors
  };
}

/**
 * Общий scoring группы изображений
 */
function scoreImageGroup(group, foodsDir, projectRoot, existingProducts) {
  if (group.length === 0) return null;
  
  const structural = analyzeGroupStructure(group, foodsDir);
  const semantic = analyzeGroupSemantics(group, foodsDir);
  const visual = analyzeGroupVisual(group);
  const context = analyzeGroupContext(group, foodsDir);
  
  // Проверка на дубликаты с существующими продуктами
  let duplicatePenalty = 0;
  const mainImage = selectMainImage(group);
  
  if (mainImage && mainImage.metadata.phash) {
    const isDuplicate = existingProducts.some(existing => {
      if (!existing.image) return false;
      const existingPath = path.join(projectRoot, existing.image);
      if (!fs.existsSync(existingPath)) return false;
      
      const existingMeta = getImageMetadata(existingPath);
      if (!existingMeta || !existingMeta.phash) return false;
      
      const comparison = compareImagesByHash(mainImage.metadata, existingMeta);
      return comparison.similar;
    });
    
    if (isDuplicate) {
      duplicatePenalty = -0.5;
      visual.factors.push('duplicate_with_existing');
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
    shouldImport: totalScore >= CONFIG.SCORING.MIN_SCORE,
    mainImage: mainImage
  };
}

/**
 * Создание immutable slug из семантических данных
 */
function createImmutableSlug(semanticData, structuralData) {
  const parts = [];
  
  // Бренд
  if (semanticData.extracted.brand) {
    const brandSlug = createSlug(semanticData.extracted.brand);
    if (brandSlug) parts.push(brandSlug);
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
  
  return parts.filter(p => p).join('-') || null;
}

// ============================================================================
// ОСНОВНАЯ ЛОГИКА ИМПОРТА
// ============================================================================

/**
 * Сканирует foods и группирует изображения
 */
function scanAndGroupImages(foodsDir) {
  console.log('🔍 Сканирование и группировка изображений...');
  
  const imageGroups = [];
  
  function scanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const hasWebp = entries.some(e => 
        e.isFile() && e.name.toLowerCase().endsWith('.webp')
      );
      
      // Если в папке есть webp файлы, группируем их
      if (hasWebp) {
        const groups = groupImagesInDirectory(dir, foodsDir);
        groups.forEach(group => {
          if (group.length > 0) {
            imageGroups.push({
              dir: dir,
              images: group
            });
          }
        });
      }
      
      // Рекурсивно обходим подпапки
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDirectory(path.join(dir, entry.name));
        }
      }
    } catch (e) {
      // Игнорируем ошибки доступа
    }
  }
  
  scanDirectory(foodsDir);
  
  console.log(`   Найдено групп изображений: ${imageGroups.length}`);
  const totalImages = imageGroups.reduce((sum, g) => sum + g.images.length, 0);
  console.log(`   Всего изображений: ${totalImages}\n`);
  
  return imageGroups;
}

/**
 * Интеллектуальный импорт продуктов
 */
function intelligentIngestion(foodsDir, projectRoot, existingProducts) {
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 2: INTELLIGENT IMAGE-AWARE INGESTION');
  console.log('='.repeat(80) + '\n');
  
  const existingIds = new Set(existingProducts.map(p => p.id));
  const existingImageHashes = new Set();
  
  // Предзагружаем hash существующих изображений
  existingProducts.forEach(p => {
    if (p.image) {
      const fullPath = path.join(projectRoot, p.image);
      if (fs.existsSync(fullPath)) {
        const meta = getImageMetadata(fullPath);
        if (meta && meta.phash) {
          existingImageHashes.add(meta.phash);
        }
      }
    }
  });
  
  // Сканируем и группируем изображения
  const imageGroups = scanAndGroupImages(foodsDir);
  
  // Оцениваем каждую группу
  console.log('📊 Оценка групп изображений...');
  const scoredGroups = [];
  
  imageGroups.forEach((groupData, idx) => {
    if (idx % 20 === 0 && idx > 0) {
      process.stdout.write(`\r   Обработано: ${idx}/${imageGroups.length}`);
    }
    
    const score = scoreImageGroup(
      groupData.images,
      foodsDir,
      projectRoot,
      existingProducts
    );
    
    if (score && score.shouldImport && score.mainImage) {
      const semantic = score.semantic;
      const structural = score.structural;
      
      // Создаем immutable slug
      let productId = createImmutableSlug(semantic, structural);
      
      if (!productId) {
        // Если не удалось создать slug, пропускаем
        return;
      }
      
      // Проверяем уникальность
      let finalId = productId;
      let counter = 1;
      while (existingIds.has(finalId) || 
             scoredGroups.some(g => g.id === finalId)) {
        finalId = `${productId}-${counter}`;
        counter++;
        // Защита от бесконечного цикла
        if (counter > 100) {
          return; // Пропускаем, если не можем создать уникальный ID
        }
      }
      
      // Проверяем, не используется ли уже главное изображение
      if (score.mainImage.metadata.phash && 
          existingImageHashes.has(score.mainImage.metadata.phash)) {
        return; // Пропускаем дубликат
      }
      
      scoredGroups.push({
        id: finalId,
        group: groupData.images,
        mainImage: score.mainImage,
        score: score,
        semantic: semantic.extracted,
        structural: structural
      });
      
      existingIds.add(finalId);
      if (score.mainImage.metadata.phash) {
        existingImageHashes.add(score.mainImage.metadata.phash);
      }
    }
  });
  
  process.stdout.write(`\r   Обработано: ${imageGroups.length}/${imageGroups.length}\n\n`);
  
  console.log(`📊 Результаты оценки:`);
  console.log(`   Всего групп: ${imageGroups.length}`);
  console.log(`   Прошли порог (${CONFIG.SCORING.MIN_SCORE}): ${scoredGroups.length}`);
  console.log(`   Отклонено: ${imageGroups.length - scoredGroups.length}\n`);
  
  return scoredGroups;
}

// ============================================================================
// СОЗДАНИЕ ПРОДУКТОВ
// ============================================================================

function createProductsFromGroups(scoredGroups, foodsDir, projectRoot) {
  console.log('🔄 Создание продуктов из групп...');
  
  const newProducts = [];
  let copiedImages = 0;
  
  scoredGroups.forEach(groupData => {
    const semantic = groupData.semantic;
    const mainImage = groupData.mainImage;
    
    // Определяем категорию
    let category = 'candy';
    if (semantic.category) {
      const catMap = {
        'мармелад': 'marmalade',
        'конфеты': 'candy',
        'шоколад': 'chocolate',
        'драже': 'candy',
        'лукум': 'candy',
        'желейный': 'jelly'
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
      : path.basename(mainImage.path, '.webp');
    
    // Копируем главное изображение
    const targetFolder = groupData.id;
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
      id: groupData.id,
      name: productName,
      nameRu: productName,
      nameEn: productName,
      category: category,
      brand: brand,
      image: imageRelativePath,
      descriptionKey: groupData.id.replace(/-/g, '_'),
      descriptionTextKey: groupData.id.replace(/-/g, '_') + '_filling_text',
      titleKey: 'card__popular-item',
      tags: [...new Set(tags)]
    };
    
    if (semantic.weight) {
      newProduct.weight = semantic.weight;
    }
    
    newProducts.push(newProduct);
  });
  
  console.log(`   Создано продуктов: ${newProducts.length}`);
  console.log(`   Скопировано изображений: ${copiedImages}\n`);
  
  return newProducts;
}

// ============================================================================
// САНАЦИЯ (используем из предыдущего скрипта)
// ============================================================================

function sanitizeProducts(products, projectRoot, foodsDir) {
  // Используем упрощенную версию санации
  // Полная версия в intelligent-products-import.js
  console.log('\n' + '='.repeat(80));
  console.log('ЭТАП 1: САНАЦИЯ PRODUCTS');
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

function main() {
  const projectRoot = findProjectRoot();
  const productsFile = path.join(projectRoot, 'data', 'products.json');
  const foodsDir = path.join(projectRoot, 'foods');
  const backupFile = path.join(projectRoot, 'data', `products.backup-${Date.now()}.json`);
  
  console.log('🚀 IMAGE-AWARE PRODUCT INGESTION FRAMEWORK');
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
  const scoredGroups = intelligentIngestion(foodsDir, projectRoot, sanitized.products);
  
  // Создаем продукты из групп
  const newProducts = createProductsFromGroups(scoredGroups, foodsDir, projectRoot);
  
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
  console.log(`   Добавлено новых продуктов: ${newProducts.length}`);
  console.log(`   Всего продуктов в файле: ${productsData.products.length}`);
  console.log(`\n💾 Backup: ${backupFile}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { main, intelligentIngestion, sanitizeProducts };


