/**
 * EXPORT PRODUCTS
 * 
 * Собирает все товары из out/products/*.json в один файл out/products.json
 * Исключает служебный файл _issues.json
 */

const fs = require('fs');
const path = require('path');

// Определяем корень проекта
function findProjectRoot() {
  let root = __dirname;
  for (let i = 0; i < 10; i++) {
    const testPath = path.join(root, 'package.json');
    if (fs.existsSync(testPath)) {
      return root;
    }
    const parent = path.join(root, '..');
    if (parent === root) break;
    root = parent;
  }
  return root;
}

function findProductsDirectory(projectRoot) {
  // Пробуем разные возможные пути
  const possiblePaths = [
    path.join(projectRoot, 'out', 'products'),
    path.join(projectRoot, 'foods-tools-cursor', 'foods_tools_cursor', 'out', 'products'),
    path.join(projectRoot, 'foods-tools-cursor', 'out', 'products'),
    // Рекурсивный поиск
    ...findOutDirectories(projectRoot)
  ];
  
  for (const dirPath of possiblePaths) {
    if (fs.existsSync(dirPath)) {
      // Проверяем, что это действительно директория с товарами
      try {
        const files = fs.readdirSync(dirPath);
        const hasJsonFiles = files.some(f => 
          f.toLowerCase().endsWith('.json') && f !== '_issues.json'
        );
        if (hasJsonFiles) {
          return dirPath;
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }
  }
  
  return null;
}

function findOutDirectories(root, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];
  
  const paths = [];
  
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(root, entry.name);
        
        // Если нашли out/products
        if (entry.name === 'out') {
          const productsPath = path.join(fullPath, 'products');
          if (fs.existsSync(productsPath)) {
            paths.push(productsPath);
          }
        }
        
        // Рекурсивно ищем дальше (но не в node_modules и других служебных папках)
        if (!entry.name.startsWith('.') && 
            entry.name !== 'node_modules' && 
            entry.name !== 'dist' &&
            entry.name !== 'build') {
          paths.push(...findOutDirectories(fullPath, maxDepth, currentDepth + 1));
        }
      }
    }
  } catch (e) {
    // Игнорируем ошибки доступа
  }
  
  return paths;
}

function main() {
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  let customPath = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--path' || args[i] === '-p') {
      customPath = args[i + 1];
      break;
    }
  }
  
  const projectRoot = findProjectRoot();
  let productsDir = null;
  
  // Если указан путь вручную
  if (customPath) {
    const resolvedPath = path.isAbsolute(customPath) 
      ? customPath 
      : path.join(projectRoot, customPath);
    
    if (fs.existsSync(resolvedPath)) {
      productsDir = resolvedPath;
    } else {
      console.error(`❌ Указанный путь не существует: ${resolvedPath}`);
      process.exit(1);
    }
  } else {
    // Автоматический поиск
    productsDir = findProductsDirectory(projectRoot);
  }
  
  // Выходной файл должен быть в корне out (на уровень выше products)
  let outputFile;
  if (productsDir) {
    const outDir = path.dirname(productsDir);
    outputFile = path.join(outDir, 'products.json');
  } else {
    // Fallback
    outputFile = path.join(projectRoot, 'out', 'products.json');
  }
  
  console.log('📦 EXPORT PRODUCTS');
  console.log('='.repeat(80));
  console.log(`Корень проекта: ${projectRoot}`);
  
  // Проверяем существование директории
  if (!productsDir || !fs.existsSync(productsDir)) {
    // Пробуем экспортировать напрямую из data/products.json
    const productsJsonPath = path.join(projectRoot, 'data', 'products.json');
    if (fs.existsSync(productsJsonPath)) {
      console.log('📦 EXPORT PRODUCTS');
      console.log('='.repeat(80));
      console.log(`Корень проекта: ${projectRoot}`);
      console.log(`\n⚠️  Директория out/products не найдена, но найден data/products.json`);
      console.log(`   Экспортирую напрямую из data/products.json...\n`);
      
      try {
        const productsData = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));
        const products = Array.isArray(productsData.products) ? productsData.products : productsData;
        const productsArray = Array.isArray(products) ? products : [products];
        
        // Создаем выходную директорию
        const outDir = path.dirname(outputFile);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        
        // Сохраняем
        fs.writeFileSync(outputFile, JSON.stringify(productsArray, null, 2), 'utf8');
        
        console.log(`✅ Экспортировано товаров: ${productsArray.length}`);
        console.log(`✅ Файл: ${outputFile}\n`);
        console.log('💡 Совет: Запустите "npm run build:foods" для полной обработки из папки foods/');
        process.exit(0);
      } catch (error) {
        console.error(`❌ Ошибка при чтении data/products.json: ${error.message}`);
        process.exit(1);
      }
    }
    
    console.error(`❌ Директория out/products не найдена!`);
    console.error(`\n   Возможные решения:`);
    console.error(`   1. Запустите 'npm run build:foods' для обработки папки foods/`);
    console.error(`   2. Запустите 'npm run build' в foods-tools-cursor`);
    console.error(`   3. Укажите путь вручную: npm run export -- --path <путь>`);
    console.error(`      Пример: npm run export -- --path "foods-tools-cursor/foods_tools_cursor/out/products"`);
    console.error(`\n   Проверенные пути:`);
    console.error(`   - ${path.join(projectRoot, 'out', 'products')}`);
    console.error(`   - ${path.join(projectRoot, 'foods-tools-cursor', 'foods_tools_cursor', 'out', 'products')}`);
    console.error(`   - ${path.join(projectRoot, 'foods-tools-cursor', 'out', 'products')}`);
    process.exit(1);
  }
  
  console.log(`Директория товаров: ${productsDir}`);
  console.log(`Выходной файл: ${outputFile}\n`);
  
  console.log('🔍 Сканирование директории...');
  
  // Читаем все .json файлы
  let files = [];
  try {
    files = fs.readdirSync(productsDir, { withFileTypes: true })
      .filter(entry => 
        entry.isFile() && 
        entry.name.toLowerCase().endsWith('.json') &&
        entry.name !== '_issues.json'
      )
      .map(entry => entry.name);
  } catch (error) {
    console.error(`❌ Ошибка при чтении директории: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`   Найдено файлов: ${files.length}\n`);
  
  if (files.length === 0) {
    console.warn('⚠️  Файлы товаров не найдены!');
    console.warn('   Убедитесь, что вы выполнили "npm run build" в foods-tools-cursor');
    process.exit(0);
  }
  
  // Читаем и парсим все файлы
  console.log('📖 Чтение товаров...');
  const products = [];
  const errors = [];
  
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(productsDir, filename);
    
    if (i % 50 === 0 && i > 0) {
      process.stdout.write(`\r   Обработано: ${i}/${files.length}`);
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const product = JSON.parse(content);
      products.push(product);
    } catch (error) {
      errors.push({
        file: filename,
        error: error.message
      });
    }
  }
  
  process.stdout.write(`\r   Обработано: ${files.length}/${files.length}\n\n`);
  
  if (errors.length > 0) {
    console.warn(`⚠️  Ошибки при чтении ${errors.length} файлов:`);
    errors.slice(0, 10).forEach(err => {
      console.warn(`   - ${err.file}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.warn(`   ... и еще ${errors.length - 10} ошибок`);
    }
    console.log('');
  }
  
  // Создаем выходную директорию, если её нет
  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  // Сохраняем результат
  console.log('💾 Сохранение результата...');
  try {
    const output = JSON.stringify(products, null, 2);
    fs.writeFileSync(outputFile, output, 'utf8');
    
    console.log(`   ✅ Сохранено товаров: ${products.length}`);
    console.log(`   ✅ Файл: ${outputFile}\n`);
  } catch (error) {
    console.error(`❌ Ошибка при сохранении: ${error.message}`);
    process.exit(1);
  }
  
  // Статистика
  console.log('📊 Статистика:');
  console.log(`   Всего файлов: ${files.length}`);
  console.log(`   Успешно прочитано: ${products.length}`);
  console.log(`   Ошибок: ${errors.length}`);
  console.log(`   Размер файла: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB\n`);
  
  console.log('✅ Экспорт завершен!\n');
}

if (require.main === module) {
  main();
}

module.exports = { main };

