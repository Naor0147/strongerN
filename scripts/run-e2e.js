// scripts/run-e2e.js
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 8081;
const URL = `http://localhost:${PORT}`;
const EXPO_TIMEOUT_MS = 120000; // 2 minutes

let expoProcess = null;
let didStartExpo = false;

// Clean up child process on exit
function cleanup() {
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
  } catch (err) {}

  if (didStartExpo && expoProcess) {
    console.log('[e2e] Cleaning up Expo.');
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${expoProcess.pid} /T /F`, { stdio: 'ignore' });
      } catch (err) {
        // Process might already be dead
      }
    } else {
      expoProcess.kill('SIGTERM');
    }
    expoProcess = null;
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

// Check if port is already active
function checkPortActive() {
  return new Promise((resolve) => {
    const req = http.get(URL, { timeout: 1000 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Poll the Expo server until it responds with 200
function pollExpoServer(timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`[e2e] Expo server did not start within ${timeoutMs / 1000}s`));
        return;
      }

      const req = http.get(URL, { timeout: 1000 }, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      });

      req.on('error', () => {
        // Server not ready yet
      });

      req.on('timeout', () => {
        req.destroy();
      });
    }, 200);
  });
}

async function main() {
  try {
    fs.writeFileSync(path.resolve(__dirname, '../.env.local'), 'EXPO_PUBLIC_E2E=true\n');
    console.log(`[e2e] Checking :${PORT}...`);
    const isActive = await checkPortActive();

    if (isActive) {
      console.log('[e2e] Expo already running.');
    } else {
      console.log('[e2e] Expo not running. Starting...');
      
      const logPath = path.resolve(__dirname, '../expo-e2e.log');
      const logStream = fs.createWriteStream(logPath, { flags: 'w' });

      const startTime = Date.now();

      expoProcess = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
        stdio: 'pipe',
        shell: true,
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, EXPO_PUBLIC_E2E: 'true' }
      });

      expoProcess.stdout.pipe(logStream);
      expoProcess.stderr.pipe(logStream);

      didStartExpo = true;

      expoProcess.on('error', (err) => {
        console.error('[e2e] Failed to start Expo:', err);
        process.exit(1);
      });

      // Wait for server to be healthy
      try {
        await pollExpoServer(EXPO_TIMEOUT_MS);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[e2e] Expo ready (${duration}s)`);
      } catch (err) {
        // Show tail of log file on failure
        try {
          const logContent = fs.readFileSync(logPath, 'utf8');
          const lines = logContent.trim().split('\n');
          const lastLines = lines.slice(-3).join('\n');
          console.error(`[e2e] Expo failed. Last 3 log lines:\n${lastLines}`);
        } catch (readErr) {
          console.error('[e2e] Expo failed, and log file could not be read.');
        }
        cleanup();
        process.exit(1);
      }
    }

    console.log('[e2e] Running tests...');
    const extraArgs = process.argv.slice(2);
    const playwrightArgs = [
      'playwright',
      'test',
      '--config',
      'tests/e2e/config/playwright.config.ts',
      ...extraArgs,
    ];

    const playwrightProcess = spawn('npx', playwrightArgs, {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..'),
    });

    playwrightProcess.on('close', (code) => {
      cleanup();
      console.log('[e2e] Done.');
      process.exit(code);
    });

  } catch (error) {
    console.error('[e2e] Error during execution:', error.message);
    cleanup();
    process.exit(1);
  }
}

main();
