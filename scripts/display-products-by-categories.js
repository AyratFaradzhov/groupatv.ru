const fs = require('fs');
const path = require('path');

// Маппинг брендов из папок
const BRAND_MAP = {
  '01 Tayas': 'TAYAS',
  '02 Pakel': 'PAKEL',
  '03 Alikhan Ata': 'ALIKHAN-ATA',
  '04 Puffico': 'PUFFICO',
  '05 Oslo': 'OSLO',
  '06 Love Me TM': 'LOVE-ME',
  '07 Panda Lee TM': 'PANDA-LEE',
  '08 Navroz': 'NAVROZ',
  '09 Crafers': 'CRAFERS'
};

// Функция для удаления кодов из начала названия
function removeProductCode(text) {
  if (!text) return '';
  
  // Удаляем коды типа PL1030, AF0001, PF0001, KA0006, SL0001, и т.д. в начале строки
  // Паттерн: 1-3 буквы + 3+ цифры, за которыми следует пробел
  text = text.replace(/^[A-Z]{1,3}\d{3,}\s+/i, ''); // PL1030, AF0001, PF0001, KA0006, SL0001
  
  // Удаляем коды только из цифр (3+ цифры) в начале строки
  text = text.replace(/^\d{3,}\s+/, ''); // 1753, 8481, 3000, 3012
  
  // Удаляем коды в формате "1753 Арбуз 2" - убираем цифру в конце если она одна
  text = text.replace(/\s+\d{1}\s*$/, '');
  
  // Удаляем коды в середине, если они стоят отдельно (например, "Товар PL1030 название")
  text = text.replace(/\s+[A-Z]{1,3}\d{3,}\s+/gi, ' ');
  text = text.replace(/\s+\d{3,}\s+/g, ' ');
  
  return text.trim();
}

// Функция для проверки, является ли файл дубликатом
function isDuplicate(filename) {
  // Если в конце имени файла есть одна цифра (например, "Арбуз 2.webp"), это дубликат
  const match = filename.match(/^(.+?)\s+(\d{1})\.webp$/i);
  if (match) {
    const baseName = match[1];
    const number = parseInt(match[2]);
    // Если это 2, 3, 4 и т.д. (не 1), это дубликат
    return number > 1;
  }
  return false;
}

// Функция для получения базового имени файла (без дубликата)
function getBaseFilename(filename) {
  // Удаляем расширение
  let base = filename.replace(/\.webp$/i, '');
  
  // Если есть цифра в конце (дубликат), убираем её
  const match = base.match(/^(.+?)\s+(\d{1})$/);
  if (match && parseInt(match[2]) > 1) {
    base = match[1];
  }
  
  // Убираем коды из начала
  base = removeProductCode(base);
  
  return base.trim();
}

// Функция для очистки названия продукта
function cleanProductName(name) {
  if (!name) return '';
  
  // Удаляем коды
  name = removeProductCode(name);
  
  // Удаляем лишние пробелы
  name = name.replace(/\s+/g, ' ').trim();
  
  // Удаляем лишние символы в начале и конце
  name = name.replace(/^[_\s\-]+|[_\s\-]+$/g, '');
  
  return name;
}

// Функция для извлечения категории из пути
function extractCategory(filePath, foodsDir) {
  const relativePath = path.relative(foodsDir, filePath);
  const parts = path.dirname(relativePath).split(path.sep);
  
  // Ищем категорию в структуре папок
  const categoryKeywords = {
    'мармелад': 'Мармелады',
    'жевательные': 'Жевательные конфеты',
    'конфеты': 'Конфеты',
    'шоколад': 'Шоколады',
    'драже': 'Драже',
    'лукум': 'Лукум',
    'желейный': 'Желейные десерты',
    'бисквитное': 'Бисквитные пирожные',
    'трубочки': 'Хрустящие трубочки'
  };
  
  const pathLower = relativePath.toLowerCase();
  
  for (const [keyword, category] of Object.entries(categoryKeywords)) {
    if (pathLower.includes(keyword)) {
      return category;
    }
  }
  
  // Если не нашли, берем название из структуры папок
  for (const part of parts) {
    if (part && part !== '.' && !part.match(/^\d+\s+/)) {
      const cleanPart = part.replace(/^\d+\s+/, '').trim();
      if (cleanPart && cleanPart.length > 2) {
        return cleanPart;
      }
    }
  }
  
  return 'Другое';
}

// Функция для извлечения бренда из пути
function extractBrand(filePath, foodsDir) {
  const relativePath = path.relative(foodsDir, filePath);
  const parts = relativePath.split(path.sep);
  
  // Первая папка обычно содержит бренд
  if (parts.length > 0) {
    const brandFolder = parts[0];
    return BRAND_MAP[brandFolder] || brandFolder.replace(/^\d+\s+/, '').trim();
  }
  
  return 'Неизвестный бренд';
}

// Функция для поиска docx файла с описанием рядом с изображением
function findDescriptionFile(imagePath) {
  const dir = path.dirname(imagePath);
  const baseName = path.basename(imagePath, '.webp');
  
  // Ищем docx файлы в той же директории
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.toLowerCase().endsWith('.docx') || file.toLowerCase().endsWith('.doc')) {
        // Проверяем, содержит ли имя файла код продукта
        const fileBase = path.basename(file, path.extname(file));
        const imageBase = baseName;
        
        // Если в docx есть код, который совпадает с кодом в изображении
        const imageCode = imageBase.match(/^([A-Z]{0,3}\d{3,}|\d{3,})/i);
        if (imageCode) {
          const code = imageCode[1];
          if (fileBase.includes(code)) {
            return path.join(dir, file);
          }
        }
      }
    }
  } catch (e) {
    // Игнорируем ошибки
  }
  
  return null;
}

// Функция для извлечения названия из docx имени файла
function extractNameFromDocx(docxPath) {
  if (!docxPath) return null;
  
  const filename = path.basename(docxPath, path.extname(docxPath));
  let name = cleanProductName(filename);
  
  // Удаляем служебные слова
  const stopWords = ['текстовка', 'от', 'октября', '2025', 'есть', 'вопросы', 'стикеров'];
  const words = name.split(' ');
  const filteredWords = words.filter(word => {
    const lowerWord = word.toLowerCase();
    return !stopWords.some(stop => lowerWord.includes(stop));
  });
  
  name = filteredWords.join(' ').trim();
  
  // Удаляем ТМ и кавычки
  name = name.replace(/ТМ\s*«[^»]*»/gi, '');
  name = name.replace(/«[^»]*»/g, '');
  name = name.replace(/[«»"]/g, '');
  
  // Удаляем вес в конце (если есть)
  name = name.replace(/\s*\d+[.,]?\d*\s*(?:г|gr|гр|кг|шт|х|х_)\s*\d*\s*(?:шт|бл|шб)?\s*$/i, '');
  
  return cleanProductName(name) || null;
}

// Функция для построения полного названия продукта
function buildProductName(filePath, filename, foodsDir) {
  const relativePath = path.relative(foodsDir, filePath);
  const dirPath = path.dirname(relativePath);
  const dirParts = dirPath.split(path.sep);
  
  // Сначала пытаемся найти описание в docx файле
  const docxPath = findDescriptionFile(filePath);
  if (docxPath) {
    const nameFromDocx = extractNameFromDocx(docxPath);
    if (nameFromDocx && nameFromDocx.length > 5) {
      return nameFromDocx;
    }
  }
  
  // Убираем коды из имени файла
  let productName = cleanProductName(filename.replace(/\.webp$/i, ''));
  
  // Собираем информацию из структуры папок
  const nameParts = [];
  
  // Проходим по папкам (начиная с 1, пропуская бренд)
  for (let i = 1; i < dirParts.length; i++) {
    const part = dirParts[i];
    if (part && part !== '.' && part.length > 2) {
      // Убираем номера в начале папок
      let cleanPart = part.replace(/^\d+\s+/, '').trim();
      
      // Пропускаем общие категории, но берем конкретные названия
      const lowerPart = cleanPart.toLowerCase();
      const isGeneralCategory = 
        lowerPart.includes('мармелад') && !lowerPart.includes('кисл') && !lowerPart.includes('желейн') ||
        (lowerPart.includes('конфет') && !lowerPart.match(/\d+\s*г/)) ||
        (lowerPart.includes('шоколад') && !lowerPart.match(/\d+\s*г/)) ||
        lowerPart === 'жевательные' ||
        lowerPart === 'драже' ||
        lowerPart === 'лукум';
      
      if (!isGeneralCategory && cleanPart.length > 1) {
        // Если в папке есть вес, оставляем его
        nameParts.push(cleanPart);
      }
    }
  }
  
  // Если имя файла содержит только код или очень короткое, используем информацию из папок
  if (productName.length < 3 || /^[A-Z]{0,3}\d{3,}$/i.test(productName) || /^\d{3,}$/.test(productName)) {
    if (nameParts.length > 0) {
      // Объединяем название из папок
      productName = nameParts.join(' ');
    }
  } else {
    // Если имя файла информативное, комбинируем с информацией из папок
    // Добавляем информацию из папок, если её нет в имени файла
    const productNameLower = productName.toLowerCase();
    const missingParts = nameParts.filter(part => {
      const partLower = part.toLowerCase();
      // Проверяем, есть ли эта информация уже в названии
      return !productNameLower.includes(partLower) && partLower.length > 3;
    });
    
    if (missingParts.length > 0) {
      // Добавляем недостающую информацию
      productName = [productName, ...missingParts].join(' ');
    }
  }
  
  // Очищаем финальное название
  productName = cleanProductName(productName);
  
  // Если все еще короткое или пустое, используем имя файла как есть
  if (!productName || productName.length < 3) {
    productName = filename.replace(/\.webp$/i, '');
    productName = cleanProductName(productName);
  }
  
  return productName || 'Неизвестный продукт';
}

// Функция для сканирования директории
function scanDirectory(dir, foodsDir, products = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath, foodsDir, products);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
      // Пропускаем дубликаты (файлы с цифрой 2, 3, 4 и т.д. в конце)
      if (isDuplicate(entry.name)) {
        continue;
      }
      
      const category = extractCategory(fullPath, foodsDir);
      const brand = extractBrand(fullPath, foodsDir);
      const productName = buildProductName(fullPath, entry.name, foodsDir);
      
      // Создаем ключ для группировки (бренд + категория + название без кода)
      const baseName = getBaseFilename(entry.name);
      const cleanName = cleanProductName(baseName);
      
      // Также используем информацию из директории для более точной группировки
      const dirName = path.dirname(path.relative(foodsDir, fullPath));
      const dirParts = dirName.split(path.sep).filter(p => p && p !== '.');
      const relevantDirPart = dirParts[dirParts.length - 1] || '';
      const cleanDirPart = cleanProductName(relevantDirPart.replace(/^\d+\s+/, ''));
      
      // Если имя файла короткое, используем директорию для группировки
      const groupingName = cleanName.length > 5 ? cleanName : (cleanDirPart || cleanName);
      const groupKey = `${brand}|||${category}|||${groupingName}`;
      
      // Ищем существующий продукт
      let product = products.find(p => p.groupKey === groupKey);
      
      // Если не нашли по точному ключу, ищем по похожему названию
      if (!product && cleanName.length > 3) {
        product = products.find(p => {
          const sameBrand = p.brand === brand;
          const sameCategory = p.category === category;
          const similarName = p.name.toLowerCase().includes(cleanName.toLowerCase()) ||
                             cleanName.toLowerCase().includes(p.name.toLowerCase());
          return sameBrand && sameCategory && similarName;
        });
        
        if (product) {
          // Обновляем ключ для найденного продукта
          product.groupKey = groupKey;
        }
      }
      
      if (!product) {
        product = {
          groupKey,
          brand,
          category,
          name: productName,
          images: [],
          path: fullPath
        };
        products.push(product);
      }
      
      product.images.push({
        filename: entry.name,
        path: fullPath
      });
    }
  }
  
  return products;
}

// Функция для красивого вывода
function displayProducts(products) {
  // Группируем по категориям
  const byCategory = {};
  
  for (const product of products) {
    if (!byCategory[product.category]) {
      byCategory[product.category] = [];
    }
    byCategory[product.category].push(product);
  }
  
  // Сортируем категории
  const sortedCategories = Object.keys(byCategory).sort();
  
  console.log('\n' + '='.repeat(80));
  console.log('📦 КАТАЛОГ ПРОДУКЦИИ');
  console.log('='.repeat(80));
  console.log(`\nВсего продуктов: ${products.length}`);
  console.log(`Всего категорий: ${sortedCategories.length}\n`);
  
  // Выводим по категориям
  for (const category of sortedCategories) {
    const categoryProducts = byCategory[category];
    
    console.log('\n' + '─'.repeat(80));
    console.log(`📁 ${category.toUpperCase()}`);
    console.log('─'.repeat(80));
    console.log(`   Товаров в категории: ${categoryProducts.length}\n`);
    
    // Группируем по брендам внутри категории
    const byBrand = {};
    for (const product of categoryProducts) {
      if (!byBrand[product.brand]) {
        byBrand[product.brand] = [];
      }
      byBrand[product.brand].push(product);
    }
    
    const sortedBrands = Object.keys(byBrand).sort();
    
    for (const brand of sortedBrands) {
      const brandProducts = byBrand[brand];
      
      console.log(`\n   🏷️  Бренд: ${brand}`);
      console.log('   ' + '·'.repeat(76));
      
      for (const product of brandProducts) {
        console.log(`\n   ✨ ${product.name}`);
        console.log(`      📍 Путь: ${path.relative(process.cwd(), product.path)}`);
        console.log(`      🖼️  Изображений: ${product.images.length}`);
        
        if (product.images.length > 1) {
          console.log(`      📸 Файлы:`);
          for (const img of product.images) {
            console.log(`         - ${img.filename}`);
          }
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Вывод завершен');
  console.log('='.repeat(80) + '\n');
}

// Основная функция
function main() {
  // Определяем корень проекта
  let projectRoot = __dirname;
  for (let i = 0; i < 10; i++) {
    const testPath = path.join(projectRoot, 'foods');
    if (fs.existsSync(testPath)) {
      break;
    }
    const parent = path.join(projectRoot, '..');
    if (parent === projectRoot) break;
    projectRoot = parent;
  }
  
  const foodsDir = path.join(projectRoot, 'foods');
  
  if (!fs.existsSync(foodsDir)) {
    console.error('❌ Директория foods не найдена!');
    process.exit(1);
  }
  
  console.log('🔍 Начинаю сканирование директории foods...');
  console.log(`📂 Путь: ${foodsDir}\n`);
  
  // Сканируем директорию
  const products = scanDirectory(foodsDir, foodsDir);
  
  console.log(`✅ Найдено продуктов: ${products.length}`);
  console.log(`✅ Найдено изображений: ${products.reduce((sum, p) => sum + p.images.length, 0)}\n`);
  
  // Выводим результат
  displayProducts(products);
  
  // Сохраняем результат в JSON
  const reportPath = path.join(__dirname, 'products-catalog-report.json');
  const report = {
    scanDate: new Date().toISOString(),
    totalProducts: products.length,
    totalImages: products.reduce((sum, p) => sum + p.images.length, 0),
    products: products.map(p => ({
      brand: p.brand,
      category: p.category,
      name: p.name,
      imagesCount: p.images.length,
      images: p.images.map(img => ({
        filename: img.filename,
        relativePath: path.relative(foodsDir, img.path)
      })),
      relativePath: path.relative(foodsDir, p.path)
    }))
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`💾 Отчет сохранен: ${reportPath}`);
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = { main, scanDirectory, cleanProductName, removeProductCode };

