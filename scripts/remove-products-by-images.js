const fs = require('fs');
const path = require('path');

// Настройки
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const BACKUP_JSON = path.join(PROJECT_ROOT, 'data', 'products.backup-remove-by-images.json');
const REPORT_PATH = path.join(__dirname, 'remove-products-by-images-report.json');
const EXCLUDED_IMAGES_FILE = path.join(__dirname, 'excluded-images.json');

// Загрузка списка исключенных изображений
function loadExcludedImages() {
  try {
    if (fs.existsSync(EXCLUDED_IMAGES_FILE)) {
      const content = fs.readFileSync(EXCLUDED_IMAGES_FILE, 'utf8');
      const data = JSON.parse(content);
      return data.images || [];
    }
  } catch (error) {
    console.warn(`⚠ Предупреждение: Не удалось загрузить ${EXCLUDED_IMAGES_FILE}:`, error.message);
  }
  
  // Fallback: список по умолчанию
  return [
    // Первая партия
    'assets/images/products/tayas/tayas-belts-assorti-75gr.webp',
    'assets/images/products/tayas/tayas-marmalade-80gr.webp',
    'assets/images/products/tayas/tayas-marmalade-80gr-v1.webp',
    'assets/images/products/tayas/tayas-marmalade-sour-80gr.webp',
    'assets/images/products/tayas/tayas-marmalade-80gr-v4.webp',
    'assets/images/products/tayas/tayas-marmalade-80gr-v8.webp',
    'assets/images/products/tayas/tayas-marmalade-80gr-v10.webp',
    // Вторая партия
    'assets/images/products/tayas/tayas-belts-vinograd-15gr-v2.webp',
    'assets/images/products/tayas/tayas-belts-pina-kolada-15gr-v2.webp',
    'assets/images/products/tayas/tayas-belts-arbuz-15gr-v2.webp',
    'assets/images/products/tayas/tayas-belts-malina-ezhevika-15gr-v2.webp',
    'assets/images/products/tayas/tayas-belts-klubnika-15gr-v2.webp',
    'assets/images/products/tayas/tayas-belts-golubika-15gr-v2.webp',
    'assets/images/products/tayas/tayas-marmalade-80gr-v6.webp',
    'assets/images/products/tayas/tayas-belts-yabloko-15gr-v2.webp',
    // Третья партия
    'assets/images/products/tayas/tayas-belts-kola-15gr-v2.webp',
    'assets/images/products/tayas/tayas-belts-raduga-15gr-v2.webp',
    'assets/images/products/tayas/tayas-belts-raduga-75gr-v1.webp',
    'assets/images/products/tayas/tayas-belts-raduga-75gr.webp',
    'assets/images/products/tayas/tayas-belts-assorti-75gr-v3.webp',
    'assets/images/products/tayas/tayas-belts-assorti-75gr-v2.webp'
  ];
}

// Нормализация пути изображения (убираем протокол, домен, параметры)
function normalizeImagePath(imagePath) {
  if (!imagePath) return '';
  
  let normalized = imagePath.toString();
  
  // Убираем HTML теги и извлекаем путь из атрибутов
  const srcMatch = normalized.match(/src=["']([^"']+)["']/);
  if (srcMatch) {
    normalized = srcMatch[1];
  } else {
    // Убираем HTML теги полностью
    normalized = normalized.replace(/<[^>]+>/g, '');
  }
  
  // Убираем протокол и домен (http://, https://, http://192.168.31.217:5500)
  normalized = normalized
    .replace(/^https?:\/\/[^\/\s]+/, '')
    .replace(/^http:\/\/[^\/\s]+/, '');
  
  // Убираем начальные слеши
  normalized = normalized.replace(/^\/+/, '');
  
  // Убираем параметры запроса и якоря
  normalized = normalized.split('?')[0].split('#')[0];
  
  // Убираем лишние пробелы и переносы строк
  normalized = normalized.trim().replace(/\s+/g, '');
  
  return normalized;
}

// Основная функция удаления
function removeProductsByImages() {
  console.log('🗑️  Начинаю удаление товаров по изображениям...\n');
  
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
  
  // Загружаем список исключенных изображений
  const IMAGES_TO_REMOVE = loadExcludedImages();
  console.log(`📋 Загружено ${IMAGES_TO_REMOVE.length} изображений из excluded-images.json\n`);
  
  // Нормализуем пути изображений для удаления
  const normalizedImagesToRemove = IMAGES_TO_REMOVE.map(img => normalizeImagePath(img));
  console.log('📋 Изображения для удаления:');
  normalizedImagesToRemove.forEach(img => {
    console.log(`   - ${img}`);
  });
  console.log('');
  
  const stats = {
    total: productsData.products.length,
    removed: 0,
    removedProducts: []
  };
  
  // Находим и удаляем товары
  console.log('🔍 Поиск товаров с указанными изображениями...\n');
  
  const productsToKeep = [];
  
  for (const product of productsData.products) {
    if (!product.image) {
      // Товар без изображения - оставляем
      productsToKeep.push(product);
      continue;
    }
    
    // Нормализуем путь изображения товара
    const normalizedProductImage = normalizeImagePath(product.image);
    
    // Проверяем, нужно ли удалить этот товар
    const shouldRemove = normalizedImagesToRemove.some(imgToRemove => {
      // Точное совпадение
      if (normalizedProductImage === imgToRemove) {
        return true;
      }
      
      // Проверяем совпадение без учета регистра
      if (normalizedProductImage.toLowerCase() === imgToRemove.toLowerCase()) {
        return true;
      }
      
      // Проверяем, содержит ли путь изображения товара путь для удаления
      if (normalizedProductImage.includes(imgToRemove) || imgToRemove.includes(normalizedProductImage)) {
        return true;
      }
      
      return false;
    });
    
    if (shouldRemove) {
      stats.removed++;
      stats.removedProducts.push({
        id: product.id,
        name: product.name || product.nameRu || product.nameEn,
        image: product.image,
        brand: product.brand,
        category: product.category
      });
      console.log(`   ❌ Удален: ${product.id} - ${product.name || product.nameRu || 'Без названия'}`);
      console.log(`      Изображение: ${product.image}`);
    } else {
      productsToKeep.push(product);
    }
  }
  
  // Обновляем массив товаров
  productsData.products = productsToKeep;
  stats.afterCount = productsData.products.length;
  
  // Сохраняем обновленный JSON
  console.log('\n💾 Сохранение обновленного products.json...');
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');
  console.log('✅ products.json обновлен\n');
  
  // Сохраняем отчет
  const report = {
    timestamp: new Date().toISOString(),
    imagesToRemove: normalizedImagesToRemove,
    stats: stats,
    removedProducts: stats.removedProducts
  };
  
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  
  // Выводим итоги
  console.log('\n' + '='.repeat(80));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ ПО УДАЛЕНИЮ ТОВАРОВ');
  console.log('='.repeat(80));
  console.log(`Товаров ДО: ${stats.total}`);
  console.log(`Товаров ПОСЛЕ: ${stats.afterCount}`);
  console.log(`Удалено товаров: ${stats.removed}`);
  
  if (stats.removedProducts.length > 0) {
    console.log('\n🗑️  УДАЛЕННЫЕ ТОВАРЫ:');
    stats.removedProducts.forEach((product, idx) => {
      console.log(`\n${idx + 1}. ${product.id}`);
      console.log(`   Название: ${product.name || 'Без названия'}`);
      console.log(`   Бренд: ${product.brand || 'Не указан'}`);
      console.log(`   Категория: ${product.category || 'Не указана'}`);
      console.log(`   Изображение: ${product.image}`);
    });
  } else {
    console.log('\n✅ Товары с указанными изображениями не найдены.');
  }
  
  console.log(`\n📄 Детальный отчет сохранен: ${REPORT_PATH}`);
  console.log('='.repeat(80));
  console.log('✅ УДАЛЕНИЕ ТОВАРОВ ЗАВЕРШЕНО');
  console.log('='.repeat(80));
}

// Запуск
removeProductsByImages();

