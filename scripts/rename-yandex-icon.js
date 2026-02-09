const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'images', 'icons');
const oldPath = path.join(dir, 'Yandex-icon.webp');
const newPath = path.join(dir, 'yandex-icon.webp');

if (!fs.existsSync(oldPath)) {
  console.log('File Yandex-icon.webp not found in images/icons');
  process.exit(1);
}
fs.copyFileSync(oldPath, newPath);
fs.unlinkSync(oldPath);
console.log('Renamed: Yandex-icon.webp -> yandex-icon.webp');
