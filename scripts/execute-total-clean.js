// Прямое выполнение логики очистки
const fs = require('fs');
const path = require('path');

// Находим корень проекта
let BASE_DIR = __dirname;
for (let i = 0; i < 10; i++) {
  const testPath = path.join(BASE_DIR, 'data', 'products.json');
  if (fs.existsSync(testPath)) {
    break;
  }
  const parent = path.join(BASE_DIR, '..');
  if (parent === BASE_DIR) break;
  BASE_DIR = parent;
}

const PRODUCTS_JSON = path.join(BASE_DIR, 'data', 'products.json');
const PRODUCTS_IMAGES_DIR = path.join(BASE_DIR, 'assets', 'images', 'products');
const ASSETS_IMAGES_DIR = path.join(BASE_DIR, 'assets', 'images');

const EXCLUDED_DIRS = ['about', 'benefit', 'categories', 'partner', 'icons'];
const EXCLUDED_FILES = ['logo.png'];
const EXCLUDED_PRODUCTS_DIRS = ['brand_active', 'brand_hover', 'brand_logo', 'icons'];

let stats = {
  productsJsonCleared: false,
  productImagesDeleted: 0,
  productFoldersDeleted: 0,
  productFoldersInAssetsDeleted: 0,
  totalSizeFreed: 0,
  errors: []
};

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function deleteFile(filePath) {
  try {
    const size = getFileSize(filePath);
    fs.unlinkSync(filePath);
    stats.productImagesDeleted++;
    stats.totalSizeFreed += size;
    return true;
  } catch (error) {
    stats.errors.push(`Ошибка удаления ${filePath}: ${error.message}`);
    return false;
  }
}

function deleteProductImages(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        deleteProductImages(itemPath);
        try {
          const remaining = fs.readdirSync(itemPath);
          if (remaining.length === 0) {
            fs.rmdirSync(itemPath);
            stats.productFoldersDeleted++;
          }
        } catch {}
      } else {
        const ext = path.extname(item).toLowerCase();
        if (['.webp', '.png', '.jpg', '.jpeg', '.ps1', '.svg'].includes(ext)) {
          deleteFile(itemPath);
        }
      }
    } catch (error) {
      stats.errors.push(`Ошибка обработки ${itemPath}: ${error.message}`);
    }
  }
}

function deleteProductFoldersInAssets() {
  if (!fs.existsSync(ASSETS_IMAGES_DIR)) return;

  const items = fs.readdirSync(ASSETS_IMAGES_DIR);
  for (const item of items) {
    if (EXCLUDED_DIRS.includes(item) || EXCLUDED_FILES.includes(item)) continue;

    const itemPath = path.join(ASSETS_IMAGES_DIR, item);
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        deleteProductImages(itemPath);
        try {
          fs.rmSync(itemPath, { recursive: true, force: true });
          stats.productFoldersInAssetsDeleted++;
        } catch (error) {
          stats.errors.push(`Ошибка удаления папки ${itemPath}: ${error.message}`);
        }
      }
    } catch (error) {
      stats.errors.push(`Ошибка обработки ${itemPath}: ${error.message}`);
    }
  }
}

console.log('====================================');
console.log('🚀 TOTAL CLEAN MODE - ЗАПУСК');
console.log('====================================\n');
console.log('Базовая директория:', BASE_DIR);

// 1. Очистка products.json
console.log('\n📄 Очистка data/products.json...');
try {
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify({ products: [] }, null, 2), 'utf8');
  stats.productsJsonCleared = true;
  console.log('  ✓ products.json очищен');
} catch (error) {
  console.error('  ✗ Ошибка:', error.message);
}

// 2. Удаление из assets/images/products
console.log('\n📁 Удаление изображений из assets/images/products/**...');
if (fs.existsSync(PRODUCTS_IMAGES_DIR)) {
  const items = fs.readdirSync(PRODUCTS_IMAGES_DIR);
  for (const item of items) {
    if (EXCLUDED_PRODUCTS_DIRS.includes(item)) continue;
    const itemPath = path.join(PRODUCTS_IMAGES_DIR, item);
    deleteProductImages(itemPath);
    try {
      fs.rmSync(itemPath, { recursive: true, force: true });
      stats.productFoldersDeleted++;
    } catch {}
  }
} else {
  console.log('  ⚠ Папка не существует');
}

// 3. Удаление папок продуктов из assets/images
console.log('\n📁 Удаление папок продуктов из assets/images...');
deleteProductFoldersInAssets();

// 4. Отчёт
console.log('\n====================================');
console.log('📊 ОТЧЁТ О ВЫПОЛНЕНИИ');
console.log('====================================\n');

try {
  const data = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
  const count = Array.isArray(data.products) ? data.products.length : -1;
  console.log(`✓ products.json: ${count === 0 ? 'ОЧИЩЕН' : `ОШИБКА! Осталось ${count}`}`);
  stats.productsJsonCleared = count === 0;
} catch (error) {
  console.log(`✗ products.json: Ошибка проверки - ${error.message}`);
}

console.log(`✓ Удалено файлов изображений: ${stats.productImagesDeleted}`);
console.log(`✓ Удалено папок в products/: ${stats.productFoldersDeleted}`);
console.log(`✓ Удалено папок продуктов в assets/images/: ${stats.productFoldersInAssetsDeleted}`);
console.log(`✓ Освобождено места: ${(stats.totalSizeFreed / 1024 / 1024).toFixed(2)} MB`);

if (stats.errors.length > 0) {
  console.log(`\n⚠ Ошибок: ${stats.errors.length}`);
}

// Финальная проверка
console.log('\n🔍 Финальная проверка...');
let remaining = 0;

if (fs.existsSync(PRODUCTS_IMAGES_DIR)) {
  const countFiles = (dir) => {
    let count = 0;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (EXCLUDED_PRODUCTS_DIRS.includes(item)) continue;
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) count++;
        } else if (stat.isDirectory()) {
          count += countFiles(itemPath);
        }
      }
    } catch {}
    return count;
  };
  remaining += countFiles(PRODUCTS_IMAGES_DIR);
}

if (fs.existsSync(ASSETS_IMAGES_DIR)) {
  const items = fs.readdirSync(ASSETS_IMAGES_DIR);
  for (const item of items) {
    if (EXCLUDED_DIRS.includes(item) || EXCLUDED_FILES.includes(item)) continue;
    const itemPath = path.join(ASSETS_IMAGES_DIR, item);
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        const countFiles = (dir) => {
          let count = 0;
          try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
              const itemPath = path.join(dir, item);
              const stat = fs.statSync(itemPath);
              if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) count++;
              } else if (stat.isDirectory()) {
                count += countFiles(itemPath);
              }
            }
          } catch {}
          return count;
        };
        remaining += countFiles(itemPath);
      }
    } catch {}
  }
}

if (remaining === 0 && stats.productsJsonCleared) {
  console.log('✅ ВСЕ ПРОДУКТЫ УСПЕШНО УДАЛЕНЫ!');
  console.log('\n====================================');
  console.log('🎉 TOTAL CLEAN COMPLETED');
  console.log('====================================');
  console.log('\nГотов к следующему этапу: RE-IMPORT MODE');
} else {
  console.log(`⚠ ВНИМАНИЕ: Обнаружено ${remaining} оставшихся файлов продукции!`);
}

