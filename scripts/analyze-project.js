const fs = require('fs');
const path = require('path');

/* =====================================================
   ГЛУБОКИЙ АНАЛИЗ ПРОЕКТА
   Senior Data Engineer + Frontend Architect
===================================================== */

const projectRoot = path.resolve(__dirname, '..');
const foodsDir = path.join(projectRoot, 'foods');
const productsJsonPath = path.join(projectRoot, 'data', 'products.json');
const reportPath = path.join(__dirname, 'foods-scan-report.json');

console.log('🔍 ГЛУБОКИЙ АНАЛИЗ ПРОЕКТА\n');
console.log('='.repeat(80));

// ============================================
// 1. АНАЛИЗ СТРУКТУРЫ FOODS/
// ============================================

console.log('\n📁 1. АНАЛИЗ СТРУКТУРЫ foods/\n');

function analyzeFoodsStructure(dirPath, level = 0, prefix = '') {
  const structure = {
    brands: new Set(),
    categories: new Set(),
    types: new Set(),
    weights: new Set(),
    flavors: new Set(),
    paths: []
  };

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(foodsDir, fullPath);
      
      if (entry.isDirectory()) {
        // Анализируем название папки
        const name = entry.name;
        
        // Бренды (верхний уровень: "01 Tayas", "02 Pakel" и т.д.)
        if (level === 0 && /^\d+\s+/.test(name)) {
          const brand = name.replace(/^\d+\s+/, '');
          structure.brands.add(brand);
        }
        
        // Категории (второй уровень: "01 Мармелады", "Драже" и т.д.)
        if (level === 1) {
          structure.categories.add(name);
        }
        
        // Вес (папки с весом: "15 г", "90gr", "1000 г")
        const weightMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|кг)/i);
        if (weightMatch) {
          structure.weights.add(name);
        }
        
        // Типы (ремешки, карандаши, трубочки, мишки)
        const typeKeywords = ['ремешки', 'карандаши', 'трубочки', 'мишки', 'драже', 'лукум', 'шоколад', 'пирожное', 'десерт'];
        for (const keyword of typeKeywords) {
          if (name.toLowerCase().includes(keyword)) {
            structure.types.add(keyword);
          }
        }
        
        // Вкусы
        const flavorKeywords = ['арбуз', 'клубника', 'яблоко', 'апельсин', 'виноград', 'вишня', 'малина', 'ежевика', 'кола', 'ананас', 'кокос', 'ваниль', 'шоколад', 'кофе', 'радуга', 'ассорти', 'тропик', 'голубика'];
        for (const keyword of flavorKeywords) {
          if (name.toLowerCase().includes(keyword)) {
            structure.flavors.add(keyword);
          }
        }
        
        structure.paths.push({
          type: 'directory',
          path: relPath,
          name: name,
          level: level
        });
        
        // Рекурсивно анализируем подпапки
        const subStructure = analyzeFoodsStructure(fullPath, level + 1, prefix + '  ');
        structure.brands = new Set([...structure.brands, ...subStructure.brands]);
        structure.categories = new Set([...structure.categories, ...subStructure.categories]);
        structure.types = new Set([...structure.types, ...subStructure.types]);
        structure.weights = new Set([...structure.weights, ...subStructure.weights]);
        structure.flavors = new Set([...structure.flavors, ...subStructure.flavors]);
        structure.paths.push(...subStructure.paths);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
        structure.paths.push({
          type: 'file',
          path: relPath,
          name: entry.name,
          level: level
        });
      }
    }
  } catch (error) {
    console.error(`Ошибка при анализе ${dirPath}:`, error.message);
  }
  
  return structure;
}

const foodsStructure = analyzeFoodsStructure(foodsDir);

console.log(`Бренды найдены: ${foodsStructure.brands.size}`);
console.log('Бренды:', Array.from(foodsStructure.brands).join(', '));

console.log(`\nКатегории найдены: ${foodsStructure.categories.size}`);
console.log('Категории:', Array.from(foodsStructure.categories).join(', '));

console.log(`\nТипы продуктов найдены: ${foodsStructure.types.size}`);
console.log('Типы:', Array.from(foodsStructure.types).join(', '));

console.log(`\nВкусы найдены: ${foodsStructure.flavors.size}`);
console.log('Вкусы:', Array.from(foodsStructure.flavors).join(', '));

const webpFiles = foodsStructure.paths.filter(p => p.type === 'file');
console.log(`\nВсего .webp файлов в foods/: ${webpFiles.length}`);

// ============================================
// 2. АНАЛИЗ products.json
// ============================================

console.log('\n\n📄 2. АНАЛИЗ data/products.json\n');

let productsData;
try {
  const content = fs.readFileSync(productsJsonPath, 'utf8');
  productsData = JSON.parse(content);
} catch (error) {
  console.error('Ошибка при чтении products.json:', error.message);
  process.exit(1);
}

const products = productsData.products || [];
const categories = productsData.categories || {};
const brands = productsData.brands || [];

console.log(`Товаров в JSON: ${products.length}`);
console.log(`Категорий в JSON: ${Object.keys(categories).length}`);
console.log(`Брендов в JSON: ${brands.length}`);

// Анализ полей
const productsWithWeight = products.filter(p => p.weight).length;
const productsWithFlavors = products.filter(p => p.flavors && p.flavors.length > 0).length;
const productsWithType = products.filter(p => p.type).length;

console.log(`\nТоваров с полем weight: ${productsWithWeight}`);
console.log(`Товаров с полем flavors: ${productsWithFlavors}`);
console.log(`Товаров с полем type: ${productsWithType}`);

// Анализ путей изображений
const imagePaths = products.map(p => p.image);
const missingImages = imagePaths.filter(imgPath => {
  const fullPath = path.join(projectRoot, imgPath);
  return !fs.existsSync(fullPath);
});

console.log(`\nТоваров с отсутствующими изображениями: ${missingImages.length}`);
if (missingImages.length > 0 && missingImages.length <= 10) {
  console.log('Примеры:');
  missingImages.slice(0, 5).forEach(img => console.log(`  - ${img}`));
}

// ============================================
// 3. СРАВНЕНИЕ foods/ И products.json
// ============================================

console.log('\n\n🔀 3. СРАВНЕНИЕ foods/ И products.json\n');

// Читаем отчет сканирования
let reportItems = [];
try {
  if (fs.existsSync(reportPath)) {
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    reportItems = JSON.parse(reportContent);
  }
} catch (error) {
  console.warn('⚠ Отчет сканирования не найден или поврежден');
}

console.log(`Товаров в отчете сканирования: ${reportItems.length}`);

// Товары из отчета
const reportIds = new Set(reportItems.map(item => item.suggestedId));
const jsonIds = new Set(products.map(p => p.id));

// Товары в foods/, но не в JSON
const missingInJson = reportItems.filter(item => !jsonIds.has(item.suggestedId));
console.log(`\nТоваров в foods/, но отсутствуют в products.json: ${missingInJson.length}`);

// Товары в JSON, но не в foods/ (старые товары)
const missingInFoods = products.filter(p => !reportIds.has(p.id));
console.log(`Товаров в products.json, но отсутствуют в foods/: ${missingInFoods.length}`);

// Анализ брендов
const jsonBrands = new Set(products.map(p => p.brand?.toUpperCase().trim().replace(/\s+/g, '')));
const foodsBrands = new Set(Array.from(foodsStructure.brands).map(b => b.toUpperCase().trim().replace(/\s+/g, '')));

const missingBrandsInJson = Array.from(foodsBrands).filter(b => !Array.from(jsonBrands).includes(b));
console.log(`\nБрендов в foods/, но отсутствуют в products.json: ${missingBrandsInJson.length}`);
if (missingBrandsInJson.length > 0) {
  console.log('Бренды:', missingBrandsInJson.join(', '));
}

// Анализ категорий
const jsonCategories = new Set(Object.keys(categories));
console.log(`\nКатегорий в JSON: ${jsonCategories.size}`);
console.log('Категории:', Array.from(jsonCategories).join(', '));

// ============================================
// 4. ВНУТРЕННЯЯ МОДЕЛЬ ИЗВЛЕЧЕНИЯ ДАННЫХ
// ============================================

console.log('\n\n🧩 4. ВНУТРЕННЯЯ МОДЕЛЬ ИЗВЛЕЧЕНИЯ ДАННЫХ ИЗ foods/\n');

console.log('ПРАВИЛА ИЗВЛЕЧЕНИЯ:');
console.log('\n1. BRAND (Бренд):');
console.log('   - Уровень 0: папки вида "01 Tayas", "02 Pakel"');
console.log('   - Извлекать: текст после номера');
console.log('   - Нормализация: trim, uppercase, убрать пробелы');

console.log('\n2. CATEGORY (Категория):');
console.log('   - Уровень 1: "01 Мармелады", "Драже", "Лукум", "Шоколады"');
console.log('   - Маппинг:');
console.log('     * "мармелад" → "marmalade"');
console.log('     * "конфет" → "candy"');
console.log('     * "шоколад" → "chocolate"');
console.log('     * "драже" → "candy"');
console.log('     * "лукум" → "candy"');
console.log('     * "пирожное" → "cookies"');
console.log('     * "десерт" → "jelly"');

console.log('\n3. TYPE (Тип продукта):');
console.log('   - Извлекать из названий папок и файлов:');
console.log('     * "ремешки" → "belts"');
console.log('     * "карандаши" → "pencils"');
console.log('     * "трубочки" → "tubes"');
console.log('     * "мишки" → "bears"');
console.log('     * "драже" → "dragee"');
console.log('     * "лукум" → "lokum"');
console.log('     * "шоколад" → "chocolate"');
console.log('     * "вафли" → "wafers"');
console.log('     * "печенье" → "cookies"');

console.log('\n4. WEIGHT (Вес):');
console.log('   - Паттерны: "15 г", "90gr", "1000 г", "49,3 г", "1 кг"');
console.log('   - Нормализация:');
console.log('     * Заменить запятую на точку');
console.log('     * Если "кг" → умножить на 1000');
console.log('     * Формат результата: "15gr", "1000gr"');

console.log('\n5. FLAVORS (Вкусы):');
console.log('   - Извлекать из названий папок и файлов');
console.log('   - Маппинг RU → EN:');
console.log('     * "клубника" → "strawberry"');
console.log('     * "арбуз" → "watermelon"');
console.log('     * "яблоко" → "apple"');
console.log('     * "кола" → "cola"');
console.log('     * "радуга" → "rainbow"');
console.log('     * "ассорти" → "assortment"');
console.log('     * "малина-ежевика" → "raspberry-blackberry"');
console.log('   - Результат: массив [RU, EN]');

// ============================================
// 5. ПЛАН ДЕЙСТВИЙ
// ============================================

console.log('\n\n📋 5. ПЛАН ДЕЙСТВИЙ\n');

console.log('ЭТАП 1: Улучшение скрипта scan-foods.js');
console.log('  - Улучшить извлечение brand (учитывать все уровни)');
console.log('  - Улучшить извлечение category (более точный маппинг)');
console.log('  - Улучшить извлечение type (приоритет из имени файла)');
console.log('  - Улучшить извлечение weight (обработка всех форматов)');
console.log('  - Улучшить извлечение flavors (составные вкусы)');

console.log('\nЭТАП 2: Улучшение скрипта sync-products-json.js');
console.log('  - Более точное сопоставление товаров (по нескольким критериям)');
console.log('  - Обновление существующих товаров (исправление путей, добавление полей)');
console.log('  - Удаление устаревших товаров (которых нет в foods/)');
console.log('  - Валидация всех путей изображений');

console.log('\nЭТАП 3: Создание скрипта валидации');
console.log('  - Проверка целостности данных');
console.log('  - Проверка соответствия foods/ и products.json');
console.log('  - Генерация отчета о расхождениях');

console.log('\nЭТАП 4: Документация');
console.log('  - Документировать структуру foods/');
console.log('  - Документировать правила извлечения данных');
console.log('  - Создать руководство по добавлению новых товаров');

// ============================================
// 6. ВЫВОД СТАТИСТИКИ
// ============================================

console.log('\n\n📊 6. СТАТИСТИКА\n');

console.log('FOODS/:');
console.log(`  - Брендов: ${foodsStructure.brands.size}`);
console.log(`  - Категорий: ${foodsStructure.categories.size}`);
console.log(`  - Типов продуктов: ${foodsStructure.types.size}`);
console.log(`  - Вкусов: ${foodsStructure.flavors.size}`);
console.log(`  - .webp файлов: ${webpFiles.length}`);

console.log('\nPRODUCTS.JSON:');
console.log(`  - Товаров: ${products.length}`);
console.log(`  - Категорий: ${Object.keys(categories).length}`);
console.log(`  - Брендов: ${brands.length}`);
console.log(`  - С weight: ${productsWithWeight}`);
console.log(`  - С flavors: ${productsWithFlavors}`);
console.log(`  - С type: ${productsWithType}`);
console.log(`  - Отсутствующих изображений: ${missingImages.length}`);

console.log('\nРАСХОЖДЕНИЯ:');
console.log(`  - Товаров в foods/, но нет в JSON: ${missingInJson.length}`);
console.log(`  - Товаров в JSON, но нет в foods/: ${missingInFoods.length}`);
console.log(`  - Брендов в foods/, но нет в JSON: ${missingBrandsInJson.length}`);

console.log('\n' + '='.repeat(80));
console.log('✅ Анализ завершен!');




