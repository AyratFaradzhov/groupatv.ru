const fs = require('fs');
const path = require('path');

// Настройки
const PROJECT_ROOT = path.resolve(__dirname, '..');
const FOODS_DIR = path.join(PROJECT_ROOT, 'foods');
const ASSETS_IMAGES_DIR = path.join(PROJECT_ROOT, 'assets', 'images');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const BACKUP_JSON = path.join(PROJECT_ROOT, 'data', 'products.backup-normalize.json');
const REPORT_PATH = path.join(__dirname, 'normalize-report.json');

// Поддержка изображений
const IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg'];

// Маппинг кириллицы в латиницу
const CYRILLIC_TO_LATIN = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
  'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
  'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
  'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
  'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  'İ': 'I', 'ı': 'i', 'Ş': 'S', 'ş': 's', 'Ç': 'C', 'ç': 'c',
  'Ğ': 'G', 'ğ': 'g', 'Ö': 'O', 'ö': 'o', 'Ü': 'U', 'ü': 'u'
};

// Функция транслитерации
function transliterate(text) {
  if (!text) return '';
  return text.split('').map(char => CYRILLIC_TO_LATIN[char] || char).join('');
}

// Функция нормализации имени файла/папки в kebab-case
function normalizeToKebabCase(text) {
  if (!text) return '';
  
  // Транслитерация
  let normalized = transliterate(text);
  
  // Убираем расширение для обработки
  const ext = path.extname(normalized);
  const nameWithoutExt = path.basename(normalized, ext);
  
  // Заменяем все не-латинские и не-цифровые символы на дефисы
  normalized = nameWithoutExt
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  
  // Возвращаем с расширением
  return normalized + ext.toLowerCase();
}

// Функция генерации нормализованного имени на основе данных
function generateNormalizedName(product, originalPath) {
  const parts = [];
  
  // Бренд
  if (product.brand) {
    const brandSlug = normalizeToKebabCase(product.brand).replace(/\.[^.]+$/, '');
    if (brandSlug && brandSlug !== 'unknown') {
      parts.push(brandSlug);
    }
  }
  
  // Тип
  if (product.type) {
    parts.push(product.type);
  }
  
  // Вкус (первый из flavors, если есть)
  if (product.flavors && product.flavors.length > 0) {
    const firstFlavor = product.flavors[0];
    const flavorSlug = normalizeToKebabCase(firstFlavor).replace(/\.[^.]+$/, '');
    if (flavorSlug && flavorSlug.length > 2) {
      parts.push(flavorSlug);
    }
  }
  
  // Вес
  if (product.weight) {
    const weightNum = product.weight.replace(/[^0-9]/g, '');
    if (weightNum) {
      parts.push(weightNum + 'gr');
    }
  }
  
  // Если ничего не получилось, используем ID
  if (parts.length === 0) {
    parts.push(product.id || 'product');
  }
  
  const baseName = parts.join('-');
  return baseName + '.webp';
}

// Рекурсивное сканирование директории
function scanDirectoryRecursive(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectoryRecursive(filePath, fileList);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          fileList.push(filePath);
        }
      }
    } catch (error) {
      console.warn(`⚠ Ошибка при сканировании ${filePath}:`, error.message);
    }
  }
  
  return fileList;
}

// Нормализация для сравнения (убираем все спецсимволы)
function normalizeForComparison(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Поиск файла по различным вариантам имени
function findImageFile(imagePath) {
  // Прямой путь
  const fullPath = path.join(PROJECT_ROOT, imagePath);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  
  const fileName = path.basename(imagePath);
  const imageBaseName = normalizeForComparison(path.basename(fileName, path.extname(fileName)));
  
  // Ищем в исходной директории
  const dirName = path.dirname(imagePath);
  const originalDir = path.join(PROJECT_ROOT, dirName);
  if (fs.existsSync(originalDir)) {
    try {
      const files = fs.readdirSync(originalDir);
      for (const file of files) {
        const filePath = path.join(originalDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            const fileBaseName = normalizeForComparison(path.basename(file, path.extname(file)));
            if (fileBaseName === imageBaseName) {
              return filePath;
            }
          }
        } catch (e) {
          // Пропускаем ошибки
        }
      }
    } catch (e) {
      // Пропускаем ошибки
    }
  }
  
  // Ищем рекурсивно в assets/images/
  try {
    const allImages = scanDirectoryRecursive(ASSETS_IMAGES_DIR);
    for (const imgPath of allImages) {
      const imgBaseName = normalizeForComparison(path.basename(imgPath, path.extname(imgPath)));
      if (imgBaseName === imageBaseName) {
        return imgPath;
      }
    }
  } catch (e) {
    // Пропускаем ошибки
  }
  
  // Ищем в foods/
  try {
    const allFoodsImages = scanDirectoryRecursive(FOODS_DIR);
    for (const imgPath of allFoodsImages) {
      const imgBaseName = normalizeForComparison(path.basename(imgPath, path.extname(imgPath)));
      if (imgBaseName === imageBaseName) {
        return imgPath;
      }
    }
  } catch (e) {
    // Пропускаем ошибки
  }
  
  return null;
}

// Создание нормализованной структуры папок
function ensureNormalizedDir(product) {
  // Создаем структуру: assets/images/products/{brand}/{normalized-name}/
  const brandSlug = product.brand 
    ? normalizeToKebabCase(product.brand).replace(/\.[^.]+$/, '')
    : 'unknown';
  
  const productDir = path.join(ASSETS_IMAGES_DIR, 'products', brandSlug);
  
  if (!fs.existsSync(productDir)) {
    fs.mkdirSync(productDir, { recursive: true });
  }
  
  return productDir;
}

// Основная функция нормализации
function normalizeFiles() {
  console.log('🔄 Начинаю нормализацию файлов и путей...\n');
  
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
    filesFound: 0,
    filesRenamed: 0,
    pathsUpdated: 0,
    filesNotFound: [],
    conflicts: [],
    errors: []
  };
  
  const renameMap = new Map(); // Старый путь -> новый путь
  const usedNames = new Set(); // Для отслеживания коллизий
  
  console.log(`📁 Обработка ${productsData.products.length} товаров...\n`);
  
  // Кэшируем результаты сканирования для ускорения
  console.log('🔍 Сканирование всех изображений...');
  const allImagesCache = scanDirectoryRecursive(ASSETS_IMAGES_DIR);
  const allFoodsImagesCache = scanDirectoryRecursive(FOODS_DIR);
  console.log(`   Найдено в assets/images/: ${allImagesCache.length}`);
  console.log(`   Найдено в foods/: ${allFoodsImagesCache.length}\n`);
  
  // Обрабатываем каждый продукт
  for (let i = 0; i < productsData.products.length; i++) {
    const product = productsData.products[i];
    const oldImagePath = product.image;
    
    if (i % 10 === 0 && i > 0) {
      process.stdout.write(`\rОбработано: ${i}/${productsData.products.length}`);
    }
    
    if (!oldImagePath) {
      stats.errors.push({
        productId: product.id,
        error: 'Нет поля image'
      });
      continue;
    }
    
    // Ищем реальный файл
    let foundFile = findImageFile(oldImagePath);
    
    // Если не нашли, пробуем более агрессивный поиск
    if (!foundFile) {
      const fileName = path.basename(oldImagePath);
      const imageBaseName = normalizeForComparison(path.basename(fileName, path.extname(fileName)));
      
      // Ищем во всех изображениях
      for (const imgPath of [...allImagesCache, ...allFoodsImagesCache]) {
        const imgBaseName = normalizeForComparison(path.basename(imgPath, path.extname(imgPath)));
        if (imgBaseName === imageBaseName || 
            (imgBaseName.length > 5 && imageBaseName.length > 5 && 
             (imgBaseName.includes(imageBaseName) || imageBaseName.includes(imgBaseName)))) {
          foundFile = imgPath;
          break;
        }
      }
    }
    
    if (!foundFile) {
      stats.filesNotFound.push({
        productId: product.id,
        oldPath: oldImagePath,
        productName: product.name
      });
      continue;
    }
    
    stats.filesFound++;
    
    // Генерируем нормализованное имя
    const normalizedName = generateNormalizedName(product, oldImagePath);
    
    // Проверяем коллизии
    let finalName = normalizedName;
    let counter = 1;
    while (usedNames.has(finalName)) {
      const ext = path.extname(normalizedName);
      const base = path.basename(normalizedName, ext);
      finalName = `${base}-v${counter}${ext}`;
      counter++;
    }
    
    if (counter > 1) {
      stats.conflicts.push({
        productId: product.id,
        originalName: normalizedName,
        finalName: finalName
      });
    }
    
    usedNames.add(finalName);
    
    // Создаем нормализованную директорию
    const targetDir = ensureNormalizedDir(product);
    const targetPath = path.join(targetDir, finalName);
    
    // Переименовываем/копируем файл
    try {
      const foundFileName = path.basename(foundFile);
      const foundFileDir = path.dirname(foundFile);
      
      // Проверяем, нужно ли что-то делать
      if (foundFileDir === targetDir && foundFileName === finalName) {
        // Файл уже в правильном месте с правильным именем
        // Просто обновляем путь в JSON
      } else {
        // Проверяем, существует ли уже файл с таким именем
        if (fs.existsSync(targetPath)) {
          // Файл уже существует - используем его
          // Не копируем, чтобы не перезаписать
        } else {
          // Копируем файл
          fs.copyFileSync(foundFile, targetPath);
          stats.filesRenamed++;
        }
        
        // Если исходный файл не в assets/images/products/, удаляем его
        // Только если это не foods/ (исходник)
        if (!foundFile.includes(path.join('assets', 'images', 'products')) && 
            !foundFile.includes('foods')) {
          try {
            // Проверяем, не используется ли этот файл другими товарами
            const isUsedElsewhere = productsData.products.some((p, idx) => {
              if (idx === i) return false;
              const otherPath = findImageFile(p.image);
              return otherPath === foundFile;
            });
            
            if (!isUsedElsewhere) {
              fs.unlinkSync(foundFile);
            }
          } catch (e) {
            // Игнорируем ошибки удаления
          }
        }
      }
    } catch (error) {
      stats.errors.push({
        productId: product.id,
        error: `Ошибка при копировании: ${error.message}`,
        source: foundFile,
        target: targetPath
      });
      continue;
    }
    
    // Обновляем путь в products.json
    const newRelativePath = path.relative(PROJECT_ROOT, targetPath).replace(/\\/g, '/');
    product.image = newRelativePath;
    stats.pathsUpdated++;
    
    renameMap.set(oldImagePath, newRelativePath);
  }
  
  process.stdout.write(`\rОбработано: ${productsData.products.length}/${productsData.products.length}\n\n`);
  
  // Сохраняем обновленный products.json
  console.log('💾 Сохранение обновленного products.json...');
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');
  console.log('✅ products.json обновлен\n');
  
  // Финальная проверка
  console.log('🔍 Финальная проверка путей...\n');
  let missingPaths = 0;
  for (const product of productsData.products) {
    if (product.image) {
      const fullPath = path.join(PROJECT_ROOT, product.image);
      if (!fs.existsSync(fullPath)) {
        missingPaths++;
        console.warn(`⚠ Путь не существует: ${product.image} (product: ${product.id})`);
      }
    }
  }
  
  // Сохраняем отчет
  const report = {
    timestamp: new Date().toISOString(),
    stats: stats,
    renameMap: Object.fromEntries(renameMap)
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  
  // Выводим итоги
  console.log('\n' + '='.repeat(80));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(80));
  console.log(`Файлов найдено: ${stats.filesFound}`);
  console.log(`Файлов переименовано/скопировано: ${stats.filesRenamed}`);
  console.log(`Путей обновлено в JSON: ${stats.pathsUpdated}`);
  console.log(`Файлов не найдено: ${stats.filesNotFound.length}`);
  console.log(`Коллизий имен: ${stats.conflicts.length}`);
  console.log(`Ошибок: ${stats.errors.length}`);
  console.log(`Отсутствующих путей после нормализации: ${missingPaths}`);
  
  if (stats.filesNotFound.length > 0) {
    console.log('\n⚠ ФАЙЛЫ НЕ НАЙДЕНЫ:');
    stats.filesNotFound.slice(0, 10).forEach(item => {
      console.log(`  - ${item.productId}: ${item.oldPath}`);
    });
    if (stats.filesNotFound.length > 10) {
      console.log(`  ... и еще ${stats.filesNotFound.length - 10} файлов`);
    }
  }
  
  if (stats.conflicts.length > 0) {
    console.log('\n⚠ КОЛЛИЗИИ ИМЕН (решены автоматически):');
    stats.conflicts.slice(0, 5).forEach(item => {
      console.log(`  - ${item.productId}: ${item.originalName} → ${item.finalName}`);
    });
  }
  
  if (missingPaths > 0) {
    console.log(`\n❌ ВНИМАНИЕ: ${missingPaths} путей не существуют после нормализации!`);
  } else {
    console.log('\n✅ ВСЕ ПУТИ СУЩЕСТВУЮТ!');
  }
  
  console.log(`\n📄 Детальный отчет сохранен: ${REPORT_PATH}`);
  console.log('='.repeat(80));
  console.log('✅ НОРМАЛИЗАЦИЯ ЗАВЕРШЕНА');
  console.log('='.repeat(80));
}

// Запуск
normalizeFiles();

