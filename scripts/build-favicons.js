/**
 * Генерирует фавиконки из логотипа хедера (assets/images/logo.png).
 * Запуск: npm run build:favicons
 * Нужен: sharp (devDependencies)
 */
const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

const rootDir = path.join(__dirname, '..');
const logoPath = path.join(rootDir, 'assets', 'images', 'logo.png');
const outDir = path.join(rootDir, 'assets', 'favicon');

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

if (!fs.existsSync(logoPath)) {
  console.error('Logo not found:', logoPath);
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function build() {
  const buffer = fs.readFileSync(logoPath);
  for (const { name, size } of sizes) {
    await sharp(buffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, name));
    console.log('Created', name);
  }
  console.log('Favicons saved to assets/favicon/');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
