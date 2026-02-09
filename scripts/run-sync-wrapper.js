// Обертка для запуска sync-products-json.js
const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'sync-products-json.js');
const child = spawn('node', [scriptPath], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code);
});




