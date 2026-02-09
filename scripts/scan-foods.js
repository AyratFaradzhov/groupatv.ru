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

// Функция для создания slug из строки
function createSlug(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => {
      const map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Функция для извлечения веса из строки
function extractWeight(text) {
  if (!text) return null;
  
  // Паттерны: "15 г", "90gr", "1000 г", "20гр", "75gr", "49,3 г", "49.3 г"
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(?:г|gr|гр|gram|grams)/gi,
    /(\d+(?:[.,]\d+)?)\s*кг/gi
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Берем первое совпадение
      const match = matches[0];
      let weight = match.replace(/[^\d.,]/g, '').replace(',', '.');
      const isKg = /кг/i.test(match);
      if (isKg) {
        const numWeight = parseFloat(weight);
        if (isNaN(numWeight)) continue;
        weight = (numWeight * 1000).toString();
      } else {
        const numWeight = parseFloat(weight);
        if (isNaN(numWeight)) continue;
        weight = numWeight.toString();
      }
      // Убираем лишние нули в конце
      weight = weight.replace(/\.0+$/, '').replace(/^0+/, '');
      if (weight === '' || weight === '0') return null;
      return weight + 'gr';
    }
  }
  
  return null;
}

// Функция для извлечения вкуса/типа из строки
function extractFlavor(text) {
  if (!text) return null;
  
  const flavors = [
    'арбуз', 'клубника', 'яблоко', 'апельсин', 'виноград', 'вишня',
    'малина', 'ежевика', 'кола', 'ананас', 'кокос', 'ваниль', 'шоколад',
    'кофе', 'радуга', 'ассорти', 'тропик', 'голубика', 'пона-колада'
  ];
  
  const lowerText = text.toLowerCase();
  for (const flavor of flavors) {
    if (lowerText.includes(flavor)) {
      return flavor;
    }
  }
  
  return null;
}

// Функция для извлечения типа продукта
function extractType(text) {
  if (!text) return null;
  
  const types = [
    'ремешки', 'карандаши', 'мишки', 'трубочки', 'вафли', 'печенье',
    'конфеты', 'мармелад', 'шоколад', 'драже', 'лукум', 'паста'
  ];
  
  const lowerText = text.toLowerCase();
  for (const type of types) {
    if (lowerText.includes(type)) {
      return type;
    }
  }
  
  return null;
}

// Функция для определения главного изображения
function isMainImage(filename) {
  const lower = filename.toLowerCase();
  return lower.includes('main') || 
         /[^0-9]1\.webp$/i.test(filename) ||
         (!/\d+\.webp$/i.test(filename) && filename.length < 50);
}

// Функция для получения приоритета файла (меньше = главнее)
function getImagePriority(filename) {
  const lower = filename.toLowerCase();
  
  // Главные изображения имеют приоритет 0
  if (isMainImage(filename)) return 0;
  
  // Файлы с "1" в конце имеют приоритет 1
  if (/[^0-9]1\.webp$/i.test(filename)) return 1;
  
  // Файлы с числами в конце - по возрастанию
  const match = filename.match(/(\d+)\.webp$/i);
  if (match) return 10 + parseInt(match[1]);
  
  // Короткие имена предпочтительнее длинных
  return 1000 + filename.length;
}

// Определение подбрендов
function detectSubBrand(dirName, parentBrand) {
  const upper = dirName.toUpperCase();
  if (upper.includes('DAMLA')) return 'DAMLA';
  if (upper.includes('JIMMY') || upper.includes('JIMMY PANDA')) return 'JIMMY';
  if (upper.includes('MINIYUM')) return 'MINIYUM';
  if (upper.includes('KIDZI')) return 'KIDZI';
  if (upper.includes('MISKETS')) return 'MISKETS';
  if (upper.includes('BONJUKS')) return 'BONJUKS';
  return parentBrand;
}

// Рекурсивное сканирование папки
function scanDirectory(dirPath, relativePath = '', brand = null, category = null, level = 0) {
  const items = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        // Определяем бренд по верхнему уровню
        let newBrand = brand;
        let newCategory = category;
        
        // Уровень 0: основной бренд
        if (level === 0 && BRAND_MAP[entry.name]) {
          newBrand = BRAND_MAP[entry.name];
        } else if (level === 0 && /^\d+\s+/.test(entry.name)) {
          const match = entry.name.match(/^\d+\s+(.+)/);
          if (match) {
            newBrand = createSlug(match[1]).toUpperCase().replace(/-/g, '-');
          }
        }
        
        // Определяем подбренд (DAMLA, JIMMY внутри TAYAS)
        if (newBrand && level > 0) {
          const subBrand = detectSubBrand(entry.name, newBrand);
          if (subBrand !== newBrand) {
            newBrand = subBrand;
          }
        }
        
        // Определяем категорию (уровень 1)
        if (level === 1) {
          // Убираем префиксы типа "01 " из категории
          let catName = entry.name.replace(/^\d+\s+/, '').trim();
          const catLower = catName.toLowerCase();
          
          if (catLower.includes('мармелад') || 
              catLower.includes('конфет') || 
              catLower.includes('шоколад') ||
              catLower.includes('драже') ||
              catLower.includes('лукум') ||
              catLower.includes('пирожное') ||
              catLower.includes('десерт') ||
              catLower.includes('карамель')) {
            newCategory = catName;
          }
        } else if (level > 1) {
          // Сохраняем категорию из уровня 1
          newCategory = category;
        }
        
        // Рекурсивно сканируем подпапку
        items.push(...scanDirectory(fullPath, relPath, newBrand, newCategory, level + 1));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
        // Найден webp файл
        const fileInfo = {
          sourcePath: fullPath,
          relativePath: relPath,
          filename: entry.name,
          brand: brand || 'UNKNOWN',
          category: category || '',
          dirPath: dirPath,
          level: level
        };
        items.push(fileInfo);
      }
    }
  } catch (error) {
    console.error(`Ошибка при сканировании ${dirPath}:`, error.message);
  }
  
  return items;
}

// Группировка файлов по продуктам
function groupByProduct(files) {
  const groups = new Map();
  
  for (const file of files) {
    // Извлекаем информацию из пути и имени файла
    const pathParts = file.relativePath.split(path.sep);
    const fullText = [...pathParts, file.filename].join(' ');
    
    // Извлекаем вес
    const weight = extractWeight(fullText) || extractWeight(file.filename);
    
    // Извлекаем вкус
    const flavor = extractFlavor(fullText);
    
    // Извлекаем тип
    const type = extractType(fullText);
    
    // Определяем название продукта
    let productName = '';
    
    // Пытаемся извлечь из имени файла (часто там самое точное название)
    const filenameBase = file.filename.replace('.webp', '').toLowerCase();
    
    // Если в имени файла есть тип и вкус
    const fileType = extractType(file.filename);
    const fileFlavor = extractFlavor(file.filename);
    
    if (fileType && fileFlavor) {
      productName = `${fileType} ${fileFlavor}`;
    } else if (fileType) {
      productName = fileType;
      if (fileFlavor) productName += ` ${fileFlavor}`;
    } else if (fileFlavor) {
      productName = fileFlavor;
      if (fileType) productName = `${fileType} ${productName}`;
    } else if (type && flavor) {
      productName = `${type} ${flavor}`;
    } else if (type) {
      productName = type;
    } else if (flavor) {
      productName = flavor;
    } else {
      // Пытаемся извлечь из имени файла или папки
      const nameParts = file.filename.replace('.webp', '').split(/[\s\-_]+/);
      const filtered = nameParts.filter(p => 
        !/^\d+$/.test(p) && 
        !p.toLowerCase().includes('damla') &&
        !p.toLowerCase().includes('jimmy') &&
        !p.toLowerCase().includes('miskets') &&
        !p.toLowerCase().includes('panda') &&
        p.length > 2
      );
      productName = filtered.slice(0, 3).join(' ') || 'product';
    }
    
    // Создаем ключ для группировки
    // Используем также директорию для более точной группировки
    const dirName = path.basename(file.dirPath);
    const brandSlug = createSlug(file.brand);
    const nameSlug = createSlug(productName);
    const weightSlug = weight || 'unknown';
    
    // Если файлы в одной папке и имеют похожие имена - это один продукт
    // Иначе группируем по brand-name-weight
    let groupKey;
    if (dirName && !dirName.match(/^\d+\s/)) {
      // Если папка не начинается с цифры, используем её в ключе
      const dirSlug = createSlug(dirName);
      groupKey = `${brandSlug}-${dirSlug}-${weightSlug}`;
    } else {
      groupKey = `${brandSlug}-${nameSlug}-${weightSlug}`;
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        brand: file.brand,
        brandSlug: brandSlug,
        category: file.category,
        productName: productName,
        nameSlug: nameSlug,
        weight: weight,
        weightSlug: weightSlug,
        suggestedId: groupKey,
        files: []
      });
    }
    
    groups.get(groupKey).files.push(file);
  }
  
  return groups;
}

// Основная функция
function main() {
  // Определяем корень проекта (на уровень выше scripts/)
  const projectRoot = path.resolve(__dirname, '..');
  const foodsDir = path.join(projectRoot, 'foods');
  const productsDir = path.join(projectRoot, 'assets', 'images', 'products');
  const reportPath = path.join(__dirname, 'foods-scan-report.json');
  
  console.log('Начинаю сканирование foods/...');
  
  // Сканируем все webp файлы
  const allFiles = scanDirectory(foodsDir, '', null, null, 0);
  console.log(`Найдено ${allFiles.length} webp файлов`);
  
  // Группируем по продуктам
  const productGroups = groupByProduct(allFiles);
  console.log(`Создано ${productGroups.size} групп продуктов`);
  
  // Обрабатываем каждую группу
  const report = [];
  let totalExtraImages = 0;
  
  // Создаем директорию для продуктов
  if (!fs.existsSync(productsDir)) {
    fs.mkdirSync(productsDir, { recursive: true });
  }
  
  for (const [key, group] of productGroups) {
    // Сортируем файлы по приоритету
    group.files.sort((a, b) => {
      const priorityA = getImagePriority(a.filename);
      const priorityB = getImagePriority(b.filename);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.filename.length - b.filename.length;
    });
    
    const mainFile = group.files[0];
    const extraFiles = group.files.slice(1);
    
    // Определяем целевую директорию
    const productFolder = group.suggestedId.replace(/^[^-]+-/, ''); // Убираем brandSlug из начала
    const targetDir = path.join(productsDir, productFolder);
    const targetImage = path.join(targetDir, `${productFolder}.webp`);
    
    // Создаем директорию
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Копируем главное изображение
    try {
      fs.copyFileSync(mainFile.sourcePath, targetImage);
    } catch (error) {
      console.error(`Ошибка при копировании ${mainFile.sourcePath}:`, error.message);
    }
    
    // Обрабатываем дополнительные изображения
    const extraImages = [];
    if (extraFiles.length > 0) {
      const extraDir = path.join(targetDir, 'extra');
      if (!fs.existsSync(extraDir)) {
        fs.mkdirSync(extraDir, { recursive: true });
      }
      
      for (const extraFile of extraFiles) {
        const extraTarget = path.join(extraDir, extraFile.filename);
        try {
          fs.copyFileSync(extraFile.sourcePath, extraTarget);
          extraImages.push({
            sourcePath: extraFile.sourcePath,
            targetPath: extraTarget,
            filename: extraFile.filename
          });
          totalExtraImages++;
        } catch (error) {
          console.error(`Ошибка при копировании ${extraFile.sourcePath}:`, error.message);
        }
      }
    }
    
    // Добавляем в отчет
    report.push({
      sourcePath: mainFile.sourcePath,
      brandGuess: group.brand,
      categoryGuess: group.category,
      weightGuess: group.weight,
      productNameGuess: group.productName,
      suggestedId: group.suggestedId,
      suggestedTargetDir: targetDir,
      suggestedTargetImage: targetImage,
      extraImages: extraImages
    });
  }
  
  // Сохраняем отчет
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  // Выводим итоги
  console.log('\n=== ИТОГИ ===');
  console.log(`Найдено webp файлов: ${allFiles.length}`);
  console.log(`Создано товаров: ${productGroups.size}`);
  console.log(`Дополнительных изображений: ${totalExtraImages}`);
  console.log(`Отчет сохранен: ${reportPath}`);
}

// Запуск
main();

