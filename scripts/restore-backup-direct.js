// Прямое восстановление из бэкапа
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

const BACKUP_FILE = path.join(BASE_DIR, 'data', 'products.backup-prepare-search-seo.json');
const PRODUCTS_FILE = path.join(BASE_DIR, 'data', 'products.json');
const CATEGORIES_FILE = path.join(BASE_DIR, 'data', 'categories.json');

console.log('🔄 Восстановление данных из бэкапа...');
console.log('Корень проекта:', BASE_DIR);
console.log('Бэкап:', BACKUP_FILE);

if (!fs.existsSync(BACKUP_FILE)) {
  console.error('❌ Бэкап не найден!');
  process.exit(1);
}

try {
  console.log('\n📖 Чтение бэкапа...');
  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf8');
  const backupData = JSON.parse(backupContent);
  
  console.log('💾 Восстановление products.json...');
  fs.writeFileSync(PRODUCTS_FILE, backupContent, 'utf8');
  
  console.log(`  ✓ Товаров: ${backupData.products ? backupData.products.length : 0}`);
  console.log(`  ✓ Категорий: ${backupData.categories ? Object.keys(backupData.categories).length : 0}`);
  console.log(`  ✓ Брендов: ${backupData.brands ? backupData.brands.length : 0}`);
  
  if (backupData.categories) {
    console.log('💾 Восстановление categories.json...');
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(backupData.categories, null, 2), 'utf8');
    console.log('  ✓ Категории сохранены');
  }
  
  console.log('\n✅ Восстановление завершено успешно!');
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}



