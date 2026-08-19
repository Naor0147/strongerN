const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

console.log('=== CHALLENGER 1: ADVERSARIAL AUDIT FOR MILESTONE 1 (R1) ===\n');

const projectRoot = path.resolve(__dirname, '../..');
const srcDir = path.resolve(projectRoot, 'src');

function getAllFiles(dir, exts) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.agents') continue;
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const allSrcFiles = getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
console.log(`[CENSUS] Total source files scanned in src/: ${allSrcFiles.length}`);

// 1. Scan for any illegal / barrel imports
const barrelVectorIconsOffenders = [];
const nonIoniconsVectorImports = [];
const barrelGoogleFontsOffenders = [];
const allVectorIconsFound = new Set();
const allGoogleFontsFound = new Set();

const barrelVectorRegex = /from\s+['"]@expo\/vector-icons['"](?!\/)/;
const requireVectorRegex = /require\(['"]@expo\/vector-icons['"]\)/;

const barrelGoogleRegex = /from\s+['"]@expo-google-fonts\/[a-zA-Z0-9_-]+['"](?!\/)/;
const requireGoogleRegex = /require\(['"]@expo-google-fonts\/[a-zA-Z0-9_-]+['"]\)/;

for (const file of allSrcFiles) {
  // We include ALL files except tests/mocks for strict production scan
  const isTestOrMock = file.includes('__tests__') || file.includes('mocks');
  const content = fs.readFileSync(file, 'utf-8');

  if (!isTestOrMock) {
    if (barrelVectorRegex.test(content) || requireVectorRegex.test(content)) {
      barrelVectorIconsOffenders.push(path.relative(projectRoot, file));
    }
    if (barrelGoogleRegex.test(content) || requireGoogleRegex.test(content)) {
      barrelGoogleFontsOffenders.push(path.relative(projectRoot, file));
    }
  }

  // Extract all occurrences of @expo/vector-icons
  const vecMatches = content.matchAll(/['"](@expo\/vector-icons[^\'"]*)['"]/g);
  for (const match of vecMatches) {
    const imported = match[1];
    allVectorIconsFound.add(imported);
    if (!isTestOrMock && imported !== '@expo/vector-icons/Ionicons') {
      nonIoniconsVectorImports.push({ file: path.relative(projectRoot, file), import: imported });
    }
  }

  // Extract all occurrences of @expo-google-fonts
  const gfMatches = content.matchAll(/['"](@expo-google-fonts[^\'"]*)['"]/g);
  for (const match of gfMatches) {
    allGoogleFontsFound.add(match[1]);
  }
}

console.log('\n--- 1. FONT IMPORT SCAN RESULTS ---');
console.log(`Barrel @expo/vector-icons found in production code: ${barrelVectorIconsOffenders.length}`);
if (barrelVectorIconsOffenders.length > 0) {
  console.log('Offenders:', barrelVectorIconsOffenders);
}
console.log(`Non-Ionicons @expo/vector-icons subpaths found: ${nonIoniconsVectorImports.length}`);
if (nonIoniconsVectorImports.length > 0) {
  console.log('Offenders:', nonIoniconsVectorImports);
}
console.log(`All @expo/vector-icons specifiers across codebase:`, Array.from(allVectorIconsFound));

console.log(`\nBarrel @expo-google-fonts found in production code: ${barrelGoogleFontsOffenders.length}`);
if (barrelGoogleFontsOffenders.length > 0) {
  console.log('Offenders:', barrelGoogleFontsOffenders);
}
console.log(`All @expo-google-fonts specifiers across codebase:`, Array.from(allGoogleFontsFound));

// 2. Check App.tsx and E2EAppHarness.tsx font declarations
console.log('\n--- 2. FONT LOADING SPECIFICATION CHECK ---');
const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
const harnessTsx = fs.readFileSync(path.join(srcDir, 'screens/E2EAppHarness.tsx'), 'utf-8');

const expectedFonts = [
  'Inter_400Regular',
  'Inter_500Medium',
  'Inter_600SemiBold',
  'Inter_700Bold',
  'Rubik_400Regular',
  'Rubik_500Medium',
  'Rubik_600SemiBold',
  'Rubik_700Bold',
];

for (const fontName of expectedFonts) {
  const inApp = appTsx.includes(fontName);
  const inHarness = harnessTsx.includes(fontName);
  console.log(`Font [${fontName}]: App.tsx -> ${inApp ? 'PASS' : 'FAIL'}, E2EAppHarness.tsx -> ${inHarness ? 'PASS' : 'FAIL'}`);
}
const ionicInApp = appTsx.includes('...Ionicons.font') || appTsx.includes('Ionicons.font');
const ionicInHarness = harnessTsx.includes('...Ionicons.font') || harnessTsx.includes('Ionicons.font');
console.log(`Font [Ionicons.font]: App.tsx -> ${ionicInApp ? 'PASS' : 'FAIL'}, E2EAppHarness.tsx -> ${ionicInHarness ? 'PASS' : 'FAIL'}`);

// 3. Logo verification
console.log('\n--- 3. LOGO ASSET INTEGRITY AUDIT ---');
const logoPath = path.join(projectRoot, 'assets/StorngNLogo.png');
const exists = fs.existsSync(logoPath);
console.log(`assets/StorngNLogo.png exists: ${exists}`);

if (exists) {
  const buf = fs.readFileSync(logoPath);
  console.log(`File size: ${buf.length} bytes (${(buf.length / 1024).toFixed(2)} KB)`);
  
  const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const validSig = buf.subarray(0, 8).equals(pngSig);
  console.log(`PNG Magic Header valid: ${validSig}`);

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  console.log(`Image Dimensions: ${width}x${height}, Bit Depth: ${bitDepth}, Color Type: ${colorType}`);

  // Test decompression of IDAT chunks
  let idatBuffers = [];
  let offset = 8;
  let chunkCount = 0;
  let hasIEND = false;

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const chunkData = buf.subarray(offset + 8, offset + 8 + len);
    const crc = buf.readUInt32BE(offset + 8 + len);
    chunkCount++;
    if (type === 'IDAT') {
      idatBuffers.push(chunkData);
    }
    if (type === 'IEND') {
      hasIEND = true;
    }
    offset += 8 + len + 4;
  }

  console.log(`Total PNG Chunks parsed: ${chunkCount}, Has IEND: ${hasIEND}`);
  try {
    const fullIdat = Buffer.concat(idatBuffers);
    const decompressed = zlib.inflateSync(fullIdat);
    console.log(`IDAT zlib decompression test: SUCCESS (${decompressed.length} raw uncompressed image bytes)`);
  } catch (err) {
    console.error(`IDAT zlib decompression test: FAILED -> ${err.message}`);
  }
}

// 4. Dead asset census verification
console.log('\n--- 4. DEAD ASSET CENSUS VERIFICATION ---');
const deadPaths = [
  'assets/logos',
  'assets/logos_v2',
  'assets/photos',
  'assets/sounds/bell1.mp3',
  'assets/sounds/bell2.mp3',
  'assets/sounds/boxing-bell.mp3',
];
for (const p of deadPaths) {
  const full = path.join(projectRoot, p);
  const exists = fs.existsSync(full);
  console.log(`Pruned path [${p}]: ${!exists ? 'PASS (Pruned)' : 'FAIL (Still Exists)'}`);
}

console.log('\n=== AUDIT COMPLETE ===');
