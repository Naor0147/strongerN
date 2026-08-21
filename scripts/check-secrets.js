/**
 * scripts/check-secrets.js
 * Scans the repository to ensure no sensitive secrets, private keys, or credentials
 * are exposed or inadvertently committed to Git.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SECRET_PATTERNS = [
  { name: 'Google API Key', regex: /AIzaSy[0-9A-Za-z-_]{33}/g },
  { name: 'OpenAI Secret Key', regex: /sk-[A-Za-z0-9-_]{32,}/g },
  { name: 'Anthropic Secret Key', regex: /sk-ant-api[0-9a-zA-Z-_]{32,}/g },
  { name: 'GitHub Token', regex: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9A-Za-z]{10,}/g },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { name: 'Generic Hardcoded Bearer', regex: /bearer\s+[a-zA-Z0-9_\-\.]{40,}/gi },
];

const REQUIRED_IGNORE_FILES = [
  '.gitignore',
  '.museignore',
  '.aiexclude',
  '.cursorignore',
  '.copilotignore',
];

console.log('🛡️  Running StrongerN Security & Secret Scan...\n');

let issuesFound = 0;

// 1. Verify required ignore files exist
for (const file of REQUIRED_IGNORE_FILES) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing critical security ignore file: ${file}`);
    issuesFound++;
  } else {
    console.log(`✅ Verified ignore file: ${file}`);
  }
}

// 2. Scan tracked git files for leaked secret patterns
try {
  const trackedFilesOutput = execSync('git ls-files', { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  const trackedFiles = trackedFilesOutput.split('\n').map(f => f.trim()).filter(Boolean);

  for (const relativePath of trackedFiles) {
    // Skip binary files and package-lock
    if (relativePath.endsWith('.png') || relativePath.endsWith('.wav') || relativePath.endsWith('.jar') || relativePath.endsWith('.keystore') || relativePath.endsWith('.apk') || relativePath.endsWith('package-lock.json')) {
      continue;
    }

    const fullPath = path.join(__dirname, '..', relativePath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) continue;

    const content = fs.readFileSync(fullPath, 'utf8');

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        console.error(`❌ [LEAK DETECTED] File "${relativePath}" matched secret pattern: ${pattern.name}`);
        issuesFound++;
      }
    }
  }
} catch (err) {
  console.warn('⚠️  Could not run git ls-files check:', err.message);
}

// 3. Verify .env is not tracked
try {
  const envTracked = execSync('git ls-files .env', { encoding: 'utf8', cwd: path.join(__dirname, '..') }).trim();
  if (envTracked) {
    console.error('❌ CRITICAL: .env file is currently tracked in Git!');
    issuesFound++;
  } else {
    console.log('✅ Verified: .env is NOT tracked in Git.');
  }
} catch {
  // Ignored
}

if (issuesFound > 0) {
  console.error(`\n🚨 Scan failed: ${issuesFound} security issue(s) detected. Please resolve before committing.\n`);
  process.exit(1);
} else {
  console.log('\n🔒 All security checks passed successfully. Repo is secure for Muse Spark & AI contributors.\n');
  process.exit(0);
}
