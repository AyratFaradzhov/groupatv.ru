// Простой wrapper для запуска агрессивного скана
const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'aggressive-scan.js');
const child = spawn('node', [scriptPath], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code || 0);
});




