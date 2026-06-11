const { execSync } = require('child_process');

const checks = [
  { name: 'TypeScript Type Check', cmd: 'npm run typecheck' },
  { name: 'Unit Tests', cmd: 'npm test' },
  { name: 'Build Verification', cmd: 'npx expo export --platform web --output-dir dist' }
];

let passed = 0;
let failed = 0;

console.log('🔍 StrongerN Health Check System');
console.log('================================\n');

for (const check of checks) {
  try {
    console.log(`⏳ Running ${check.name}...`);
    execSync(check.cmd, { stdio: 'inherit' });
    console.log(`✅ ${check.name} passed\n`);
    passed++;
  } catch (e) {
    console.error(`❌ ${check.name} failed\n`);
    failed++;
  }
}

console.log('================================');
console.log(`📊 Results: ${passed}/${checks.length} checks passed`);

if (failed > 0) {
  console.log(`⚠️  ${failed} check(s) failed`);
  process.exit(1);
} else {
  console.log('🎉 All health checks passed! App is ready for development.');
  process.exit(0);
}
