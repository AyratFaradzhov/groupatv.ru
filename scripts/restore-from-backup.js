// Восстановление данных из бэкапа
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const BACKUP_FILE = path.join(BASE_DIR, 'data', 'products.backup-prepare-search-seo.json');
const PRODUCTS_FILE = path.join(BASE_DIR, 'data', 'products.json');
const CATEGORIES_FILE = path.join(BASE_DIR, 'data', 'categories.json');

console.log('🔄 Восстановление данных из бэкапа...\n');
console.log('Бэкап:', BACKUP_FILE);
console.log('Целевой файл:', PRODUCTS_FILE);

try {
  // Читаем бэкап
  console.log('\n📖 Чтение бэкапа...');
  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf8');
  const backupData = JSON.parse(backupContent);
  
  // Восстанавливаем products.json
  console.log('💾 Восстановление products.json...');
  fs.writeFileSync(PRODUCTS_FILE, backupContent, 'utf8');
  
  // Проверяем восстановленные данные
  const restored = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  
  console.log(`  ✓ Восстановлено товаров: ${restored.products ? restored.products.length : 0}`);
  console.log(`  ✓ Восстановлено категорий: ${restored.categories ? Object.keys(restored.categories).length : 0}`);
  console.log(`  ✓ Восстановлено брендов: ${restored.brands ? restored.brands.length : 0}`);
  
  // Восстанавливаем categories.json отдельно
  if (restored.categories) {
    console.log('\n💾 Восстановление categories.json...');
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(restored.categories, null, 2), 'utf8');
    console.log(`  ✓ Категории сохранены`);
  }
  
  console.log('\n✅ Восстановление завершено успешно!');
  console.log('\n📊 Итоговая статистика:');
  console.log(`   - Товаров: ${restored.products.length}`);
  console.log(`   - Категорий: ${Object.keys(restored.categories).length}`);
  console.log(`   - Брендов: ${restored.brands.length}`);
  
} catch (error) {
  console.error('❌ Ошибка при восстановлении:', error.message);
  console.error(error.stack);
  process.exit(1);
}



