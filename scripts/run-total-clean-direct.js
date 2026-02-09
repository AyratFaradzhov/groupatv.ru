// Прямой запуск скрипта очистки
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Находим корень проекта
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

const scriptPath = path.join(projectRoot, 'scripts', 'total-clean.js');
console.log('Запуск скрипта:', scriptPath);
console.log('Рабочая директория:', projectRoot);

process.chdir(projectRoot);
require(scriptPath);

