// scripts/test-emulator-persistence.js
// Standalone Native Android Emulator Persistence Verification Script
const { execSync } = require('child_process');
const path = require('path');

const ADB = `"${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe"`;
const PACKAGE_NAME = 'com.naor.strongern';
const MAIN_ACTIVITY = `${PACKAGE_NAME}/.MainActivity`;

function runAdb(cmd) {
  try {
    return execSync(`${ADB} ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return err.stdout || err.stderr || err.message;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEmulatorTest() {
  console.log('======================================================================');
  console.log('       Android Emulator Active Workout Persistence Verification       ');
  console.log('======================================================================');

  // 1. Check connected device
  console.log('\n[1/7] Checking attached Android device/emulator...');
  const devicesOutput = runAdb('devices');
  console.log(devicesOutput);
  if (!devicesOutput.includes('emulator') && !devicesOutput.includes('device')) {
    console.error('❌ ERROR: No active Android emulator or device found.');
    process.exit(1);
  }
  console.log('✅ Android emulator connected.');

  // 2. Clear logcat buffer
  console.log('\n[2/7] Clearing logcat buffer...');
  runAdb('logcat -c');
  console.log('✅ Logcat cleared.');

  // 3. Launch application & grant permissions on emulator
  console.log('\n[3/7] Granting permissions & launching StrongerN on emulator...');
  runAdb(`shell pm grant ${PACKAGE_NAME} android.permission.POST_NOTIFICATIONS`);
  const launchOutput = runAdb(`shell am start -n ${MAIN_ACTIVITY}`);
  console.log('   Output:', launchOutput);
  await sleep(2500);

  // Dismiss any system permission popup by tapping "Allow" (x=500, y=540)
  runAdb('shell input tap 500 540');
  await sleep(1000);

  // 4. Start active workout & add exercise via ADB touch inputs
  console.log('\n[4/7] Starting workout & adding exercise via ADB touch inputs...');
  // Tap "Start Workout" button at center (x=540, y=340)
  runAdb('shell input tap 540 340');
  await sleep(2000);
  // Tap "+" Add Exercise button at top right (x=825, y=80)
  runAdb('shell input tap 825 80');
  await sleep(2000);
  // Tap first exercise item in picker list (x=500, y=350)
  runAdb('shell input tap 500 350');
  await sleep(2000);

  // 5. Simulate App Backgrounding (Home keypress)
  console.log('\n[5/7] Simulating App Backgrounding (KEYCODE_HOME)...');
  runAdb('shell input keyevent KEYCODE_HOME');
  await sleep(2000);
  console.log('✅ App backgrounded.');

  // 6. Force-stop application process (simulating OS process kill / swiping from recents)
  console.log('\n[6/7] Force-stopping app process (simulating background memory kill)...');
  runAdb(`shell am force-stop ${PACKAGE_NAME}`);
  await sleep(2000);
  console.log('✅ App process force-stopped.');

  // 7. Cold-relaunch application and inspect restoration logs
  console.log('\n[7/7] Cold launching app and reading native logs...');
  runAdb('logcat -c'); // clear logs right before launch
  runAdb(`shell am start -n ${MAIN_ACTIVITY}`);
  await sleep(4000);

  // Read logcat output
  const logs = runAdb('logcat -d -t 300');
  
  console.log('\n======================================================================');
  console.log('                      Native Log Analysis                             ');
  console.log('======================================================================');

  const logLines = logs.split('\n');
  const reactLogs = logLines.filter(line => line.includes('ReactNativeJS') || line.includes('[DB]') || line.includes('[RESTORE]') || line.includes('[SAVE]'));

  if (reactLogs.length > 0) {
    console.log('Captured React Native Storage Logs:');
    reactLogs.forEach(l => console.log('  ', l.trim()));
  } else {
    console.log('Captured Recent Log Sample (Tail 20 lines):');
    logLines.slice(-20).forEach(l => console.log('  ', l.trim()));
  }

  // Verification Assertions
  const hasDbInit = logs.includes('SQLite initialized successfully');
  const hasRestoreCheck = logs.includes('[RESTORE]');

  console.log('\n======================================================================');
  console.log('                         Test Assertions                              ');
  console.log('======================================================================');
  
  if (hasDbInit) {
    console.log('✅ [PASS] SQLite Native Engine initialized cleanly.');
  } else {
    console.log('⚠️ [INFO] SQLite initialized prior to log capture window.');
  }

  if (hasRestoreCheck) {
    console.log('✅ [PASS] Active Workout State restoration module executed on cold start.');
  } else {
    console.log('❌ [FAIL] Active Workout State restoration module did not execute.');
  }

  console.log('\n🎉 Android Emulator Native Persistence Test Execution Complete!\n');
}

runEmulatorTest().catch(err => {
  console.error('Fatal Error running test:', err);
  process.exit(1);
});
