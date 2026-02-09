const fs = require('fs');
const path = require('path');

// Настройки
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const BACKUP_JSON = path.join(PROJECT_ROOT, 'data', 'products.backup-deduplicate.json');
const REPORT_PATH = path.join(__dirname, 'deduplicate-report.json');

// Пороги для определения дубликатов
const THRESHOLDS = {
  nameSimilarity: 0.7, // 70% схожести названий
  tagsOverlap: 0.7, // 70% совпадения тегов
  minMatches: 2 // Минимум 2 совпадения для дубликата
};

// Функция нормализации бренда
function normalizeBrand(brand) {
  if (!brand) return '';
  return brand.toString().trim().toUpperCase().replace(/\s+/g, '');
}

// Функция нормализации строки для сравнения
function normalizeString(str) {
  if (!str) return '';
  return str.toString().toLowerCase().trim().replace(/[^a-z0-9а-я]/g, '');
}

// Расстояние Левенштейна (упрощенная версия)
function levenshteinDistance(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  
  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[s2.length][s1.length];
}

// Схожесть названий (0-1)
function nameSimilarity(name1, name2) {
  const dist = levenshteinDistance(name1, name2);
  const maxLen = Math.max(normalizeString(name1).length, normalizeString(name2).length);
  if (maxLen === 0) return 1;
  return 1 - (dist / maxLen);
}

// Схожесть тегов (0-1)
function tagsSimilarity(tags1, tags2) {
  if (!tags1 || !tags2 || tags1.length === 0 || tags2.length === 0) return 0;
  
  const set1 = new Set(tags1.map(t => normalizeString(t)));
  const set2 = new Set(tags2.map(t => normalizeString(t)));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// Проверка, являются ли товары дубликатами
function areDuplicates(product1, product2) {
  let matches = 0;
  const details = [];
  
  // 1. Бренд
  const brand1 = normalizeBrand(product1.brand);
  const brand2 = normalizeBrand(product2.brand);
  if (brand1 && brand2 && brand1 === brand2) {
    matches++;
    details.push('brand');
  }
  
  // 2. Категория
  if (product1.category && product2.category && 
      product1.category === product2.category) {
    matches++;
    details.push('category');
  }
  
  // 3. Вес
  const weight1 = product1.weight || '';
  const weight2 = product2.weight || '';
  if (weight1 && weight2 && normalizeString(weight1) === normalizeString(weight2)) {
    matches++;
    details.push('weight');
  }
  
  // 4. Схожесть названий
  const nameSim = nameSimilarity(
    product1.name || product1.nameRu || '',
    product2.name || product2.nameRu || ''
  );
  if (nameSim >= THRESHOLDS.nameSimilarity) {
    matches++;
    details.push(`name(${nameSim.toFixed(2)})`);
  }
  
  // 5. Схожесть image (путь)
  const img1 = normalizeString(product1.image || '');
  const img2 = normalizeString(product2.image || '');
  if (img1 && img2) {
    // Проверяем, содержат ли пути одинаковые ключевые слова
    const img1Parts = img1.split(/[\/\\]/);
    const img2Parts = img2.split(/[\/\\]/);
    const commonParts = img1Parts.filter(p => img2Parts.includes(p) && p.length > 3);
    if (commonParts.length >= 2) {
      matches++;
      details.push('image');
    }
  }
  
  // 6. Схожесть тегов
  const tagsSim = tagsSimilarity(product1.tags || [], product2.tags || []);
  if (tagsSim >= THRESHOLDS.tagsOverlap) {
    matches++;
    details.push(`tags(${tagsSim.toFixed(2)})`);
  }
  
  return {
    isDuplicate: matches >= THRESHOLDS.minMatches,
    matches: matches,
    details: details,
    nameSimilarity: nameSim,
    tagsSimilarity: tagsSim
  };
}

// Определение, являются ли товары вариантами (разные вес/вкус/тип)
function areVariants(product1, product2) {
  const brand1 = normalizeBrand(product1.brand);
  const brand2 = normalizeBrand(product2.brand);
  
  // Должны быть одного бренда
  if (!brand1 || !brand2 || brand1 !== brand2) return false;
  
  // Проверяем различия
  const differences = [];
  
  if (product1.weight !== product2.weight) {
    differences.push('weight');
  }
  if (product1.type !== product2.type) {
    differences.push('type');
  }
  
  // Проверяем flavors
  const flavors1 = new Set((product1.flavors || []).map(f => normalizeString(f)));
  const flavors2 = new Set((product2.flavors || []).map(f => normalizeString(f)));
  const flavorsDiff = [...flavors1].filter(f => !flavors2.has(f)).length > 0 ||
                      [...flavors2].filter(f => !flavors1.has(f)).length > 0;
  if (flavorsDiff) {
    differences.push('flavors');
  }
  
  // Если есть различия и названия схожи - это варианты
  const nameSim = nameSimilarity(
    product1.name || product1.nameRu || '',
    product2.name || product2.nameRu || ''
  );
  
  return differences.length > 0 && nameSim >= 0.5;
}

// Объединение товаров
function mergeProducts(products) {
  // Выбираем основной товар (с наибольшим количеством полей)
  const mainProduct = products.reduce((best, current) => {
    let bestScore = 0;
    let currentScore = 0;
    
    if (best.image) bestScore++;
    if (best.weight) bestScore++;
    if (best.type) bestScore++;
    if (best.flavors && best.flavors.length > 0) bestScore++;
    if (best.tags && best.tags.length > 0) bestScore += best.tags.length;
    
    if (current.image) currentScore++;
    if (current.weight) currentScore++;
    if (current.type) currentScore++;
    if (current.flavors && current.flavors.length > 0) currentScore++;
    if (current.tags && current.tags.length > 0) currentScore += current.tags.length;
    
    return currentScore > bestScore ? current : best;
  });
  
  // Объединяем теги
  const allTags = new Set();
  products.forEach(p => {
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach(tag => allTags.add(tag));
    }
  });
  mainProduct.tags = Array.from(allTags);
  
  // Выбираем лучший image (существующий файл)
  for (const p of products) {
    if (p.image) {
      const imagePath = path.join(PROJECT_ROOT, p.image);
      if (fs.existsSync(imagePath)) {
        mainProduct.image = p.image;
        break;
      }
    }
  }
  
  // Объединяем остальные поля, если они отсутствуют
  if (!mainProduct.weight) {
    const weight = products.find(p => p.weight)?.weight;
    if (weight) mainProduct.weight = weight;
  }
  
  if (!mainProduct.type) {
    const type = products.find(p => p.type)?.type;
    if (type) mainProduct.type = type;
  }
  
  if (!mainProduct.flavors || mainProduct.flavors.length === 0) {
    const allFlavors = new Set();
    products.forEach(p => {
      if (p.flavors && Array.isArray(p.flavors)) {
        p.flavors.forEach(f => allFlavors.add(f));
      }
    });
    if (allFlavors.size > 0) {
      mainProduct.flavors = Array.from(allFlavors);
    }
  }
  
  // Добавляем информацию о слиянии
  if (!mainProduct.mergedFrom) {
    mainProduct.mergedFrom = [];
  }
  products.forEach(p => {
    if (p.id !== mainProduct.id) {
      mainProduct.mergedFrom.push(p.id);
    }
  });
  
  return mainProduct;
}

// Нормализация ID для вариантов
function normalizeVariantId(product) {
  const parts = [];
  
  if (product.brand) {
    parts.push(normalizeBrand(product.brand).toLowerCase().replace(/[^a-z0-9]/g, '-'));
  }
  
  // Используем тип или название
  if (product.type) {
    parts.push(product.type);
  } else {
    const nameSlug = normalizeString(product.name || product.nameRu || '')
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 30);
    if (nameSlug) parts.push(nameSlug);
  }
  
  // Добавляем вес
  if (product.weight) {
    const weightNum = product.weight.replace(/[^0-9]/g, '');
    if (weightNum) {
      parts.push(weightNum + 'gr');
    }
  }
  
  // Добавляем вкус, если есть
  if (product.flavors && product.flavors.length > 0) {
    const firstFlavor = product.flavors[0];
    const flavorSlug = normalizeString(firstFlavor)
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 20);
    if (flavorSlug && flavorSlug.length > 2) {
      parts.push(flavorSlug);
    }
  }
  
  return parts.join('-').substring(0, 150);
}

// Основная функция дедупликации
function deduplicateProducts() {
  console.log('🔍 Начинаю дедупликацию товаров...\n');
  
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
  
  const beforeCount = productsData.products.length;
  console.log(`📊 Товаров до дедупликации: ${beforeCount}\n`);
  
  const stats = {
    beforeCount: beforeCount,
    duplicatesFound: 0,
    merged: 0,
    removed: 0,
    normalized: 0,
    suspicious: []
  };
  
  const processed = new Set();
  const duplicateGroups = [];
  const variantGroups = [];
  const suspiciousCases = [];
  
  // Находим дубликаты и варианты
  console.log('🔍 Поиск дубликатов и вариантов...\n');
  
  for (let i = 0; i < productsData.products.length; i++) {
    if (processed.has(i)) continue;
    
    const product1 = productsData.products[i];
    const group = [product1];
    const groupIndices = [i];
    let isVariantGroup = false;
    
    for (let j = i + 1; j < productsData.products.length; j++) {
      if (processed.has(j)) continue;
      
      const product2 = productsData.products[j];
      const duplicateCheck = areDuplicates(product1, product2);
      
      if (duplicateCheck.isDuplicate) {
        // Проверяем, это варианты или дубликаты
        if (areVariants(product1, product2)) {
          // Это варианты - оставляем все
          if (!isVariantGroup) {
            isVariantGroup = true;
          }
          group.push(product2);
          groupIndices.push(j);
        } else {
          // Это дубликаты - объединяем
          group.push(product2);
          groupIndices.push(j);
        }
      }
    }
    
    if (group.length > 1) {
      if (isVariantGroup) {
        variantGroups.push({
          products: group,
          indices: groupIndices
        });
      } else {
        duplicateGroups.push({
          products: group,
          indices: groupIndices,
          details: areDuplicates(group[0], group[1])
        });
      }
      
      groupIndices.forEach(idx => processed.add(idx));
    }
  }
  
  console.log(`   Найдено групп дубликатов: ${duplicateGroups.length}`);
  console.log(`   Найдено групп вариантов: ${variantGroups.length}\n`);
  
  // Обрабатываем дубликаты (объединяем)
  console.log('🔄 Объединение дубликатов...\n');
  
  const productsToRemove = new Set();
  const productsToUpdate = new Map();
  
  for (const group of duplicateGroups) {
    const merged = mergeProducts(group.products);
    stats.merged++;
    stats.removed += group.products.length - 1;
    
    // Помечаем для удаления все, кроме первого
    for (let i = 1; i < group.indices.length; i++) {
      productsToRemove.add(group.indices[i]);
    }
    
    // Обновляем первый элемент
    productsToUpdate.set(group.indices[0], merged);
    
    // Проверяем на подозрительные случаи
    if (group.products.length > 3) {
      suspiciousCases.push({
        type: 'many_duplicates',
        count: group.products.length,
        products: group.products.map(p => ({
          id: p.id,
          name: p.name || p.nameRu,
          image: p.image
        }))
      });
    }
  }
  
  // Обрабатываем варианты (нормализуем ID)
  console.log('🔄 Нормализация вариантов...\n');
  
  const existingIds = new Set(productsData.products.map(p => p.id));
  
  for (const group of variantGroups) {
    for (let i = 0; i < group.products.length; i++) {
      const product = group.products[i];
      const normalizedId = normalizeVariantId(product);
      
      if (normalizedId && normalizedId !== product.id) {
        // Проверяем, не используется ли уже такой ID
        if (!existingIds.has(normalizedId)) {
          // Обновляем ID
          existingIds.delete(product.id);
          const oldId = product.id;
          product.id = normalizedId;
          product.legacyId = oldId;
          existingIds.add(normalizedId);
          stats.normalized++;
        } else {
          // Конфликт - оставляем старый ID, но добавляем в подозрительные
          suspiciousCases.push({
            type: 'id_conflict',
            product: {
              id: product.id,
              name: product.name || product.nameRu,
              suggestedId: normalizedId
            }
          });
        }
      }
      
      // Обновляем tags с различиями
      if (!product.tags) product.tags = [];
      const tagsSet = new Set(product.tags);
      
      if (product.weight) tagsSet.add(product.weight);
      if (product.type) tagsSet.add(product.type);
      if (product.flavors && product.flavors.length > 0) {
        product.flavors.forEach(f => tagsSet.add(f));
      }
      
      product.tags = Array.from(tagsSet);
    }
  }
  
  // Применяем изменения
  console.log('💾 Применение изменений...\n');
  
  // Создаем массив новых товаров
  const newProducts = [];
  const removedIds = new Set();
  
  // Собираем ID удаляемых товаров
  productsToRemove.forEach(idx => {
    removedIds.add(productsData.products[idx].id);
  });
  
  // Проходим по всем товарам
  for (let i = 0; i < productsData.products.length; i++) {
    if (productsToRemove.has(i)) {
      // Пропускаем удаляемые товары
      continue;
    }
    
    // Проверяем, нужно ли обновить товар
    if (productsToUpdate.has(i)) {
      newProducts.push(productsToUpdate.get(i));
    } else {
      newProducts.push(productsData.products[i]);
    }
  }
  
  productsData.products = newProducts;
  
  const afterCount = productsData.products.length;
  stats.afterCount = afterCount;
  stats.duplicatesFound = duplicateGroups.length;
  stats.suspicious = suspiciousCases;
  
  // Сохраняем обновленный JSON
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');
  
  // Сохраняем отчет
  const report = {
    timestamp: new Date().toISOString(),
    stats: stats,
    duplicateGroups: duplicateGroups.map(g => ({
      count: g.products.length,
      products: g.products.map(p => ({
        id: p.id,
        name: p.name || p.nameRu,
        brand: p.brand,
        category: p.category,
        weight: p.weight,
        image: p.image
      })),
      details: g.details
    })),
    variantGroups: variantGroups.map(g => ({
      count: g.products.length,
      products: g.products.map(p => ({
        id: p.id,
        name: p.name || p.nameRu,
        brand: p.brand,
        weight: p.weight,
        type: p.type,
        flavors: p.flavors
      }))
    })),
    suspiciousCases: suspiciousCases
  };
  
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  
  // Выводим итоги
  console.log('\n' + '='.repeat(80));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ ПО ДЕДУПЛИКАЦИИ');
  console.log('='.repeat(80));
  console.log(`Товаров ДО: ${stats.beforeCount}`);
  console.log(`Товаров ПОСЛЕ: ${stats.afterCount}`);
  console.log(`Удалено дубликатов: ${stats.removed}`);
  console.log(`Объединено групп: ${stats.merged}`);
  console.log(`Нормализовано вариантов: ${stats.normalized}`);
  console.log(`Подозрительных случаев: ${suspiciousCases.length}`);
  
  if (suspiciousCases.length > 0) {
    console.log('\n⚠ ПОДОЗРИТЕЛЬНЫЕ СЛУЧАИ:');
    suspiciousCases.slice(0, 10).forEach((case_, idx) => {
      console.log(`\n${idx + 1}. Тип: ${case_.type}`);
      if (case_.count) {
        console.log(`   Количество: ${case_.count}`);
      }
      if (case_.products) {
        console.log(`   Товары: ${case_.products.map(p => p.id).join(', ')}`);
      }
      if (case_.product) {
        console.log(`   Товар: ${case_.product.id} → ${case_.product.suggestedId}`);
      }
    });
    if (suspiciousCases.length > 10) {
      console.log(`\n... и еще ${suspiciousCases.length - 10} случаев`);
    }
  }
  
  if (duplicateGroups.length > 0) {
    console.log('\n📋 ПРИМЕРЫ ОБЪЕДИНЕННЫХ ДУБЛИКАТОВ:');
    duplicateGroups.slice(0, 5).forEach((group, idx) => {
      console.log(`\n${idx + 1}. Группа из ${group.products.length} товаров:`);
      group.products.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.id} - ${p.name || p.nameRu}`);
        if (i === 0) {
          console.log(`      → Оставлен как основной`);
        }
      });
    });
  }
  
  console.log(`\n📄 Детальный отчет сохранен: ${REPORT_PATH}`);
  console.log('='.repeat(80));
  console.log('✅ ДЕДУПЛИКАЦИЯ ЗАВЕРШЕНА');
  console.log('='.repeat(80));
}

// Запуск
deduplicateProducts();

