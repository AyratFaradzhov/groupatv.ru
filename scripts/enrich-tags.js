const fs = require('fs');
const path = require('path');

// Настройки
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const BACKUP_JSON = path.join(PROJECT_ROOT, 'data', 'products.backup-enrich-tags.json');
const REPORT_PATH = path.join(__dirname, 'enrich-tags-report.json');

// Маппинг категорий
const CATEGORY_MAP = {
  'cookies': ['cookie', 'biscuit', 'печенье', 'бисквит', 'cracker'],
  'marmalade': ['marmalade', 'gummy', 'мармелад', 'жевательный', 'jelly'],
  'candy': ['candy', 'sweet', 'конфета', 'сладость', 'sweets'],
  'chocolate': ['chocolate', 'шоколад', 'choco'],
  'cake': ['cake', 'торт', 'пирожное', 'dessert'],
  'wafers': ['wafer', 'вафля', 'вафельный'],
  'caramel': ['caramel', 'карамель', 'карамельный'],
  'jelly': ['jelly', 'желе', 'желейный', 'десерт']
};

// Маппинг форм
const SHAPE_MAP = {
  'bears': ['bear', 'мишка', 'медведь', 'mishki', 'bears'],
  'cubes': ['cube', 'кубик', 'куб', 'cubes'],
  'belts': ['belt', 'ремень', 'ремешок', 'strip', 'belts', 'remeshki'],
  'tubes': ['tube', 'трубка', 'трубочка', 'tubes', 'trubochki'],
  'wafers': ['wafer', 'вафля', 'wafers', 'вафельный'],
  'sticks': ['stick', 'палочка', 'карандаш', 'pencil', 'sticks', 'karandashi'],
  'balls': ['ball', 'шарик', 'мячик', 'balls'],
  'rings': ['ring', 'кольцо', 'колечко', 'rings'],
  'hearts': ['heart', 'сердце', 'сердечко', 'hearts'],
  'stars': ['star', 'звезда', 'звездочка', 'stars'],
  'pencils': ['pencil', 'карандаш', 'karandash', 'pencils', 'karandashi']
};

// Маппинг вкусов
const FLAVOR_MAP = {
  'chocolate': ['chocolate', 'шоколад', 'шоколадный'],
  'milk': ['milk', 'молоко', 'молочный', 'cream', 'крем', 'сливочный'],
  'strawberry': ['strawberry', 'клубника', 'клубничный', 'klubnika'],
  'sour': ['sour', 'кислый', 'кислота', 'acid'],
  'fruit': ['fruit', 'фрукт', 'фруктовый', 'fruity'],
  'cola': ['cola', 'кола', 'coca-cola'],
  'apple': ['apple', 'яблоко', 'яблочный', 'yabloko'],
  'orange': ['orange', 'апельсин', 'апельсиновый'],
  'cherry': ['cherry', 'вишня', 'вишневый'],
  'grape': ['grape', 'виноград', 'виноградный'],
  'watermelon': ['watermelon', 'арбуз', 'арбузный'],
  'rainbow': ['rainbow', 'радуга', 'радужный', 'raduga'],
  'pistachio': ['pistachio', 'фисташка', 'фисташковый'],
  'vanilla': ['vanilla', 'ваниль', 'ванильный'],
  'caramel': ['caramel', 'карамель', 'карамельный'],
  'coffee': ['coffee', 'кофе', 'кофейный']
};

// Маппинг текстур
const TEXTURE_MAP = {
  'chewy': ['chewy', 'жевательный', 'тягучий', 'elastic'],
  'crispy': ['crispy', 'хрустящий', 'хруст', 'crunchy'],
  'soft': ['soft', 'мягкий', 'нежный'],
  'glazed': ['glazed', 'глазированный', 'glaze'],
  'hard': ['hard', 'твердый', 'жесткий'],
  'creamy': ['creamy', 'кремовый', 'сливочный']
};

// Функция нормализации строки
function normalizeString(str) {
  if (!str) return '';
  return str.toString().toLowerCase().trim();
}

// Функция транслитерации кириллицы
function transliterate(text) {
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  return text.split('').map(char => map[char] || char).join('');
}

// Извлечение тегов из текста
function extractTagsFromText(text, tagMap) {
  if (!text) return [];
  const normalized = normalizeString(text);
  const tags = [];
  
  for (const [key, variants] of Object.entries(tagMap)) {
    for (const variant of variants) {
      if (normalized.includes(normalizeString(variant))) {
        tags.push(key);
        break;
      }
    }
  }
  
  return tags;
}

// Извлечение веса в формате тега
function extractWeightTag(weight) {
  if (!weight) return null;
  
  // Извлекаем число
  const match = weight.match(/(\d+)/);
  if (!match) return null;
  
  const num = match[1];
  
  // Определяем единицу измерения
  const normalized = normalizeString(weight);
  if (normalized.includes('kg') || normalized.includes('кг')) {
    return `${num}kg`;
  } else {
    return `${num}g`;
  }
}

// Извлечение тегов из имени файла/пути
function extractTagsFromPath(imagePath) {
  if (!imagePath) return [];
  const tags = [];
  
  const pathParts = imagePath.split(/[\/\\]/);
  const fileName = pathParts[pathParts.length - 1] || '';
  const dirName = pathParts[pathParts.length - 2] || '';
  
  const fullText = `${dirName} ${fileName}`.toLowerCase();
  
  // Ищем формы
  tags.push(...extractTagsFromText(fullText, SHAPE_MAP));
  
  // Ищем вкусы
  tags.push(...extractTagsFromText(fullText, FLAVOR_MAP));
  
  // Ищем текстуры
  tags.push(...extractTagsFromText(fullText, TEXTURE_MAP));
  
  return tags;
}

// Обогащение тегов для продукта
function enrichProductTags(product) {
  const tags = new Set();
  
  // 1. Добавляем существующие теги (нормализованные)
  if (product.tags && Array.isArray(product.tags)) {
    product.tags.forEach(tag => {
      if (tag) {
        tags.add(normalizeString(tag));
      }
    });
  }
  
  // 2. Тип продукта (из category)
  if (product.category) {
    const categoryTag = normalizeString(product.category);
    tags.add(categoryTag);
    
    // Добавляем синонимы категории
    if (CATEGORY_MAP[categoryTag]) {
      CATEGORY_MAP[categoryTag].forEach(synonym => {
        tags.add(normalizeString(synonym));
      });
    }
  }
  
  // 3. Форма (из type или извлеченная из названия)
  if (product.type) {
    const typeTag = normalizeString(product.type);
    tags.add(typeTag);
    
    // Добавляем синонимы формы
    if (SHAPE_MAP[typeTag]) {
      SHAPE_MAP[typeTag].forEach(synonym => {
        tags.add(normalizeString(synonym));
      });
    }
  }
  
  // Извлекаем форму из названий
  const nameText = `${product.name || ''} ${product.nameRu || ''} ${product.nameEn || ''}`;
  const shapeTags = extractTagsFromText(nameText, SHAPE_MAP);
  shapeTags.forEach(tag => tags.add(tag));
  
  // 4. Вкус (из flavors или извлеченный)
  if (product.flavors && Array.isArray(product.flavors)) {
    product.flavors.forEach(flavor => {
      if (flavor) {
        const flavorTag = normalizeString(flavor);
        tags.add(flavorTag);
        
        // Добавляем синонимы вкуса
        for (const [key, variants] of Object.entries(FLAVOR_MAP)) {
          if (variants.some(v => normalizeString(v) === flavorTag)) {
            tags.add(key);
            break;
          }
        }
      }
    });
  }
  
  // Извлекаем вкус из названий
  const flavorTags = extractTagsFromText(nameText, FLAVOR_MAP);
  flavorTags.forEach(tag => tags.add(tag));
  
  // 5. Текстура (извлеченная из названий)
  const textureTags = extractTagsFromText(nameText, TEXTURE_MAP);
  textureTags.forEach(tag => tags.add(tag));
  
  // 6. Вес
  if (product.weight) {
    const weightTag = extractWeightTag(product.weight);
    if (weightTag) {
      tags.add(weightTag);
    }
  }
  
  // 7. Бренд (нормализованный)
  if (product.brand) {
    const brandTag = normalizeString(product.brand);
    tags.add(brandTag);
    
    // Транслитерация для брендов с кириллицей
    const transliterated = transliterate(brandTag);
    if (transliterated !== brandTag) {
      tags.add(transliterated);
    }
  }
  
  // 8. Извлечение из пути изображения
  if (product.image) {
    const pathTags = extractTagsFromPath(product.image);
    pathTags.forEach(tag => tags.add(tag));
  }
  
  // 9. Дополнительные теги из названий (ключевые слова)
  const nameWords = nameText
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  // Добавляем значимые слова (не стоп-слова)
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'for', 'with', 'from', 'this', 'that', 'the', 'a', 'an',
    'и', 'или', 'но', 'для', 'с', 'от', 'это', 'то', 'а', 'в', 'на', 'по', 'из'
  ]);
  
  nameWords.forEach(word => {
    if (!stopWords.has(word) && word.length > 2) {
      // Добавляем только если это не число и не слишком длинное
      if (!/^\d+$/.test(word) && word.length < 20) {
        // Транслитерация для кириллицы
        const transliterated = transliterate(word);
        if (transliterated !== word && transliterated.length > 2) {
          tags.add(transliterated);
        }
        tags.add(word);
      }
    }
  });
  
  // 10. Языковые теги (RU + EN)
  // Определяем язык по наличию кириллицы
  const hasCyrillic = /[а-яё]/i.test(nameText);
  if (hasCyrillic) {
    tags.add('ru');
  }
  tags.add('en');
  
  // Очистка и ограничение
  const finalTags = Array.from(tags)
    .filter(tag => tag && tag.length > 0 && tag.length < 30) // Убираем слишком длинные
    .filter(tag => !/^\d+$/.test(tag) || tag.length <= 4) // Числа только как вес
    .slice(0, 25); // Максимум 25 тегов
  
  return finalTags.sort();
}

// Основная функция обогащения
function enrichTags() {
  console.log('🏷️  Начинаю обогащение тегов...\n');
  
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
    enriched: 0,
    tagsBefore: 0,
    tagsAfter: 0,
    examples: []
  };
  
  console.log(`📊 Обработка ${stats.total} товаров...\n`);
  
  // Обрабатываем каждый продукт
  for (let i = 0; i < productsData.products.length; i++) {
    const product = productsData.products[i];
    
    if (i % 50 === 0 && i > 0) {
      process.stdout.write(`\rОбработано: ${i}/${stats.total}`);
    }
    
    const tagsBefore = (product.tags || []).length;
    stats.tagsBefore += tagsBefore;
    
    // Обогащаем теги
    const enrichedTags = enrichProductTags(product);
    product.tags = enrichedTags;
    
    const tagsAfter = enrichedTags.length;
    stats.tagsAfter += tagsAfter;
    
    if (tagsAfter > tagsBefore) {
      stats.enriched++;
      
      // Сохраняем примеры
      if (stats.examples.length < 10) {
        stats.examples.push({
          id: product.id,
          name: product.name || product.nameRu,
          tagsBefore: tagsBefore,
          tagsAfter: tagsAfter,
          tags: enrichedTags
        });
      }
    }
  }
  
  process.stdout.write(`\rОбработано: ${stats.total}/${stats.total}\n\n`);
  
  // Сохраняем обновленный JSON
  console.log('💾 Сохранение обновленного products.json...');
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');
  console.log('✅ products.json обновлен\n');
  
  // Сохраняем отчет
  const report = {
    timestamp: new Date().toISOString(),
    stats: stats,
    examples: stats.examples
  };
  
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  
  // Выводим итоги
  console.log('\n' + '='.repeat(80));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ ПО ОБОГАЩЕНИЮ ТЕГОВ');
  console.log('='.repeat(80));
  console.log(`Всего товаров: ${stats.total}`);
  console.log(`Обогащено товаров: ${stats.enriched}`);
  console.log(`Тегов ДО: ${stats.tagsBefore} (среднее: ${(stats.tagsBefore / stats.total).toFixed(1)})`);
  console.log(`Тегов ПОСЛЕ: ${stats.tagsAfter} (среднее: ${(stats.tagsAfter / stats.total).toFixed(1)})`);
  console.log(`Добавлено тегов: ${stats.tagsAfter - stats.tagsBefore}`);
  
  if (stats.examples.length > 0) {
    console.log('\n📋 ПРИМЕРЫ ОБОГАЩЕНИЯ:');
    stats.examples.slice(0, 5).forEach((example, idx) => {
      console.log(`\n${idx + 1}. ${example.name} (${example.id})`);
      console.log(`   Тегов ДО: ${example.tagsBefore} → ПОСЛЕ: ${example.tagsAfter}`);
      console.log(`   Теги: ${example.tags.slice(0, 10).join(', ')}${example.tags.length > 10 ? '...' : ''}`);
    });
  }
  
  console.log(`\n📄 Детальный отчет сохранен: ${REPORT_PATH}`);
  console.log('='.repeat(80));
  console.log('✅ ОБОГАЩЕНИЕ ТЕГОВ ЗАВЕРШЕНО');
  console.log('='.repeat(80));
}

// Запуск
enrichTags();

