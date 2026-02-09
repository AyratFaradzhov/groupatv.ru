const fs = require('fs');
const path = require('path');

// Конфигурация
const PRODUCTS_JSON_PATH = path.join(__dirname, '..', 'data', 'products.json');
const PRODUCTS_IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images', 'products');

// Исключения - папки, которые НЕ нужно удалять
const EXCLUDED_DIRS = ['brand_logo', 'icons'];

// Расширения изображений для удаления
const IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg'];

// Статистика
let stats = {
  filesDeleted: 0,
  dirsDeleted: 0,
  totalSizeFreed: 0,
  errors: []
};

/**
 * Получить размер файла в байтах
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (err) {
    return 0;
  }
}

/**
 * Форматировать размер в читаемый вид
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Проверить, является ли файл изображением
 */
function isImageFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Удалить файл
 */
function deleteFile(filePath) {
  try {
    const size = getFileSize(filePath);
    fs.unlinkSync(filePath);
    stats.filesDeleted++;
    stats.totalSizeFreed += size;
    console.log(`  ✓ Удалён: ${path.relative(PRODUCTS_IMAGES_DIR, filePath)} (${formatSize(size)})`);
    return true;
  } catch (err) {
    stats.errors.push(`Ошибка удаления ${filePath}: ${err.message}`);
    console.error(`  ✗ Ошибка: ${path.relative(PRODUCTS_IMAGES_DIR, filePath)} - ${err.message}`);
    return false;
  }
}

/**
 * Удалить директорию рекурсивно
 */
function deleteDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Рекурсивно удаляем поддиректории
        deleteDirectory(fullPath);
      } else {
        // Удаляем файлы (только изображения)
        if (isImageFile(entry.name)) {
          deleteFile(fullPath);
        } else {
          // Удаляем и другие файлы (например, .ps1, .svg), если они не в исключениях
          const size = getFileSize(fullPath);
          fs.unlinkSync(fullPath);
          stats.filesDeleted++;
          stats.totalSizeFreed += size;
          console.log(`  ✓ Удалён: ${path.relative(PRODUCTS_IMAGES_DIR, fullPath)} (${formatSize(size)})`);
        }
      }
    }

    // Удаляем саму директорию, если она не в исключениях
    const dirName = path.basename(dirPath);
    if (!EXCLUDED_DIRS.includes(dirName)) {
      fs.rmdirSync(dirPath);
      stats.dirsDeleted++;
      console.log(`  ✓ Удалена папка: ${path.relative(PRODUCTS_IMAGES_DIR, dirPath)}`);
    }
  } catch (err) {
    stats.errors.push(`Ошибка удаления директории ${dirPath}: ${err.message}`);
    console.error(`  ✗ Ошибка директории ${path.relative(PRODUCTS_IMAGES_DIR, dirPath)}: ${err.message}`);
  }
}

/**
 * Очистить products.json
 */
function cleanProductsJson() {
  try {
    console.log('\n[1/2] Очистка data/products.json...');
    
    const data = { products: [] };
    fs.writeFileSync(PRODUCTS_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
    
    // Проверка
    const verify = JSON.parse(fs.readFileSync(PRODUCTS_JSON_PATH, 'utf8'));
    if (verify.products.length === 0) {
      console.log('  ✓ products.json очищен: products.length === 0');
      return true;
    } else {
      console.error(`  ✗ ОШИБКА: products.length === ${verify.products.length} (должно быть 0)`);
      return false;
    }
  } catch (err) {
    stats.errors.push(`Ошибка очистки products.json: ${err.message}`);
    console.error(`  ✗ Ошибка: ${err.message}`);
    return false;
  }
}

/**
 * Очистить изображения продукции
 */
function cleanProductImages() {
  console.log('\n[2/2] Удаление изображений продукции...');
  console.log(`  Целевая директория: ${PRODUCTS_IMAGES_DIR}`);
  console.log(`  Исключения: ${EXCLUDED_DIRS.join(', ')}`);
  
  if (!fs.existsSync(PRODUCTS_IMAGES_DIR)) {
    console.log('  ⚠ Директория не существует, пропуск');
    return;
  }

  const entries = fs.readdirSync(PRODUCTS_IMAGES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(PRODUCTS_IMAGES_DIR, entry.name);

    // Пропускаем исключённые директории
    if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) {
      console.log(`  ⊘ Пропущено (исключение): ${entry.name}/`);
      continue;
    }

    if (entry.isDirectory()) {
      console.log(`\n  Удаление папки: ${entry.name}/`);
      deleteDirectory(fullPath);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      deleteFile(fullPath);
    }
  }
}

/**
 * Проверка результата
 */
function verifyCleanup() {
  console.log('\n[ПРОВЕРКА] Проверка результата очистки...');
  
  let hasRemainingProducts = false;
  const remainingItems = [];

  if (!fs.existsSync(PRODUCTS_IMAGES_DIR)) {
    console.log('  ✓ Директория products/ не существует');
    return !hasRemainingProducts;
  }

  const entries = fs.readdirSync(PRODUCTS_IMAGES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(PRODUCTS_IMAGES_DIR, entry.name);

    // Игнорируем исключённые директории
    if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      hasRemainingProducts = true;
      remainingItems.push(`Папка: ${entry.name}/`);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      hasRemainingProducts = true;
      remainingItems.push(`Файл: ${entry.name}`);
    }
  }

  if (hasRemainingProducts) {
    console.error('  ✗ ОШИБКА: Обнаружены оставшиеся файлы/папки продукции:');
    remainingItems.forEach(item => console.error(`    - ${item}`));
  } else {
    console.log('  ✓ Все файлы продукции удалены');
  }

  return !hasRemainingProducts;
}

/**
 * Главная функция
 */
function main() {
  console.log('====================================');
  console.log('TOTAL CLEAN MODE - ПОЛНАЯ ОЧИСТКА');
  console.log('====================================\n');

  // 1. Очистка products.json
  const jsonCleaned = cleanProductsJson();

  // 2. Удаление изображений
  cleanProductImages();

  // 3. Проверка
  const verified = verifyCleanup();

  // 4. Отчёт
  console.log('\n====================================');
  console.log('ОТЧЁТ О ВЫПОЛНЕНИИ');
  console.log('====================================');
  console.log(`✓ Файлов изображений удалено: ${stats.filesDeleted}`);
  console.log(`✓ Папок удалено: ${stats.dirsDeleted}`);
  console.log(`✓ Освобождено места: ${formatSize(stats.totalSizeFreed)}`);
  console.log(`✓ products.json очищен: ${jsonCleaned ? 'ДА' : 'НЕТ'}`);
  console.log(`✓ Проверка пройдена: ${verified ? 'ДА' : 'НЕТ'}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠ Ошибок: ${stats.errors.length}`);
    stats.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }

  console.log('\n====================================');
  if (jsonCleaned && verified && stats.errors.length === 0) {
    console.log('TOTAL CLEAN COMPLETED');
    console.log('====================================\n');
    process.exit(0);
  } else {
    console.log('TOTAL CLEAN - ЕСТЬ ПРОБЛЕМЫ');
    console.log('====================================\n');
    process.exit(1);
  }
}

// Запуск
main();
