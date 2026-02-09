const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'video');
const oldPath = path.join(dir, 'vdieo_cooperation.mp4');
const newPath = path.join(dir, 'video_cooperation.mp4');

if (!fs.existsSync(oldPath)) {
  console.log('File vdieo_cooperation.mp4 not found in assets/video');
  process.exit(1);
}
fs.copyFileSync(oldPath, newPath);
fs.unlinkSync(oldPath);
console.log('Renamed: vdieo_cooperation.mp4 -> video_cooperation.mp4');
