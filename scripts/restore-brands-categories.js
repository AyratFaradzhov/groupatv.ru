/**
 * Восстановление брендов и категорий в products.json
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'data', 'products.json');
const BACKUP_JSON = path.join(PROJECT_ROOT, 'data', 'products.backup-prepare-search-seo.json');

console.log('🔄 Восстановление брендов и категорий...\n');

try {
  // Читаем текущий products.json
  let currentData = { products: [] };
  if (fs.existsSync(PRODUCTS_JSON)) {
    currentData = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
    console.log(`📦 Текущий файл: ${currentData.products.length} товаров`);
  }
  
  // Читаем бэкап
  let backupData = null;
  if (fs.existsSync(BACKUP_JSON)) {
    backupData = JSON.parse(fs.readFileSync(BACKUP_JSON, 'utf8'));
    console.log(`💾 Бэкап найден: ${backupData.products.length} товаров`);
  } else {
    console.error('❌ Бэкап не найден!');
    process.exit(1);
  }
  
  // Восстанавливаем categories
  if (backupData.categories) {
    currentData.categories = backupData.categories;
    console.log(`✅ Восстановлено категорий: ${Object.keys(currentData.categories).length}`);
  }
  
  // Восстанавливаем brands
  if (backupData.brands && Array.isArray(backupData.brands)) {
    currentData.brands = backupData.brands;
    console.log(`✅ Восстановлено брендов: ${currentData.brands.length}`);
  }
  
  // Сохраняем
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(currentData, null, 2), 'utf8');
  
  console.log('\n✅ Бренды и категории восстановлены!');
  console.log(`   Товаров: ${currentData.products.length}`);
  console.log(`   Категорий: ${Object.keys(currentData.categories || {}).length}`);
  console.log(`   Брендов: ${(currentData.brands || []).length}\n`);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

