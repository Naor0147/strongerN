const fs = require('fs');
const path = require('path');

function inspectPng(filePath) {
  const buf = fs.readFileSync(filePath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.readUInt8(24);
  const colorType = buf.readUInt8(25);
  console.log(`${filePath}: ${width}x${height}, BitDepth=${bitDepth}, ColorType=${colorType}, Size=${buf.length} bytes (${(buf.length/1024).toFixed(1)} KB)`);
}

const assets = [
  'assets/StorngNLogo.png',
  'assets/icon.png',
  'assets/splash-icon.png',
  'assets/android-icon-foreground.png',
  'assets/android-icon-background.png',
  'assets/android-icon-monochrome.png',
  'assets/favicon.png'
];

assets.forEach(f => {
  const fullPath = path.resolve('c:/Antigravity/strongerN', f);
  if (fs.existsSync(fullPath)) {
    inspectPng(fullPath);
  } else {
    console.log(`Not found: ${f}`);
  }
});
