const fs = require('fs');
const path = require('path');

// Определяем корень проекта
let projectRoot = __dirname;
for (let i = 0; i < 10; i++) {
  const testPath = path.join(projectRoot, 'data', 'products.json');
  if (fs.existsSync(testPath)) {
    break;
  }
  const parent = path.join(projectRoot, '..');
  if (parent === projectRoot) break;
  projectRoot = parent;
}

const productsFile = path.join(projectRoot, 'data', 'products.json');
const foodsDir = path.join(projectRoot, 'foods');

console.log('🔍 АНАЛИЗ PRODUCTS.JSON ДЛЯ САНАЦИИ\n');

// Загружаем данные
const productsData = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
const products = productsData.products || [];

console.log(`Всего продуктов: ${products.length}\n`);

// Анализ 1: ID с суффиксами (-1, -2, -3)
const withSuffix = products.filter(p => /-\d+$/.test(p.id));
console.log(`📊 ID с суффиксами (-1, -2, etc): ${withSuffix.length}`);
if (withSuffix.length > 0) {
  console.log('   Примеры:', withSuffix.slice(0, 10).map(p => p.id).join(', '));
}

// Анализ 2: Дубликаты по изображениям
const imageMap = new Map();
products.forEach(p => {
  if (p.image) {
    const normalized = p.image.toLowerCase().replace(/\\/g, '/');
    if (!imageMap.has(normalized)) {
      imageMap.set(normalized, []);
    }
    imageMap.get(normalized).push(p);
  }
});

const duplicateImages = Array.from(imageMap.entries())
  .filter(([img, prods]) => prods.length > 1);
console.log(`\n📊 Дубликаты по изображениям: ${duplicateImages.length} групп`);
if (duplicateImages.length > 0) {
  const totalDups = duplicateImages.reduce((sum, [, prods]) => sum + prods.length - 1, 0);
  console.log(`   Всего дубликатов: ${totalDups}`);
  console.log('   Примеры:');
  duplicateImages.slice(0, 5).forEach(([img, prods]) => {
    console.log(`     ${img}: ${prods.map(p => p.id).join(', ')}`);
  });
}

// Анализ 3: Продукты с несуществующими изображениями
let missingImages = 0;
const missingImageProducts = [];
products.forEach(p => {
  if (p.image) {
    const fullPath = path.join(projectRoot, p.image);
    if (!fs.existsSync(fullPath)) {
      missingImages++;
      missingImageProducts.push(p);
    }
  }
});
console.log(`\n📊 Продукты с несуществующими изображениями: ${missingImages}`);

// Анализ 4: ID основанные на filename
const filenameBased = products.filter(p => {
  if (!p.image) return false;
  const imageName = path.basename(p.image, '.webp');
  const idParts = p.id.split('-');
  const imageParts = imageName.toLowerCase().split(/[-_\s]+/);
  
  // Проверяем, содержит ли ID части имени файла
  const hasFilenameParts = imageParts.some(part => 
    part.length > 3 && idParts.some(idPart => idPart.includes(part))
  );
  
  return hasFilenameParts && idParts.length <= 3;
});
console.log(`\n📊 ID основанные на filename: ${filenameBased.length}`);

// Анализ 5: Продукты без подтверждения в foods
let notInFoods = 0;
const notInFoodsProducts = [];

function scanFoodsForImage(imagePath) {
  const imageName = path.basename(imagePath);
  const baseName = path.basename(imagePath, '.webp');
  
  function searchDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
          if (entry.name === imageName || 
              path.basename(entry.name, '.webp') === baseName) {
            return true;
          }
        } else if (entry.isDirectory()) {
          if (searchDir(fullPath)) return true;
        }
      }
    } catch (e) {
      // Игнорируем ошибки
    }
    return false;
  }
  
  return searchDir(foodsDir);
}

console.log('\n🔍 Проверка продуктов на наличие в foods/...');
products.slice(0, 50).forEach((p, idx) => {
  if (idx % 10 === 0) process.stdout.write(`\r   Проверено: ${idx}/${Math.min(50, products.length)}`);
  if (p.image) {
    const fullPath = path.join(projectRoot, p.image);
    if (fs.existsSync(fullPath)) {
      // Файл существует, проверяем в foods
      if (!scanFoodsForImage(fullPath)) {
        notInFoods++;
        notInFoodsProducts.push(p);
      }
    }
  }
});
process.stdout.write(`\r   Проверено: ${Math.min(50, products.length)}/${Math.min(50, products.length)}\n`);

console.log(`\n📊 Продукты без подтверждения в foods (из первых 50): ${notInFoods}`);

// Анализ 6: Короткие или подозрительные ID
const suspiciousIds = products.filter(p => {
  const idParts = p.id.split('-');
  return idParts.length < 2 || 
         p.id.length < 10 || 
         /^\d+$/.test(idParts[idParts.length - 1]);
});
console.log(`\n📊 Подозрительные ID (короткие/только цифры): ${suspiciousIds.length}`);

// Итоговый отчет
console.log('\n' + '='.repeat(80));
console.log('📋 ИТОГОВЫЙ ОТЧЕТ ДЛЯ САНАЦИИ');
console.log('='.repeat(80));
console.log(`
Критерии для удаления:
1. ID с суффиксами (-1, -2, -3): ${withSuffix.length} продуктов
2. Дубликаты по изображениям: ~${duplicateImages.reduce((sum, [, prods]) => sum + prods.length - 1, 0)} продуктов
3. Несуществующие изображения: ${missingImages} продуктов
4. ID основанные на filename: ${filenameBased.length} продуктов
5. Подозрительные ID: ${suspiciousIds.length} продуктов

Оценка мусорных продуктов: ~${Math.max(
  withSuffix.length,
  duplicateImages.reduce((sum, [, prods]) => sum + prods.length - 1, 0),
  missingImages
)} продуктов
`);

// Сохраняем отчет
const report = {
  timestamp: new Date().toISOString(),
  totalProducts: products.length,
  withSuffix: withSuffix.map(p => ({ id: p.id, name: p.name, image: p.image })),
  duplicateImages: duplicateImages.map(([img, prods]) => ({
    image: img,
    products: prods.map(p => ({ id: p.id, name: p.name }))
  })),
  missingImages: missingImageProducts.map(p => ({ id: p.id, name: p.name, image: p.image })),
  filenameBased: filenameBased.slice(0, 20).map(p => ({ id: p.id, name: p.name, image: p.image })),
  suspiciousIds: suspiciousIds.slice(0, 20).map(p => ({ id: p.id, name: p.name }))
};

const reportPath = path.join(__dirname, 'sanitation-analysis-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\n💾 Отчет сохранен: ${reportPath}`);


