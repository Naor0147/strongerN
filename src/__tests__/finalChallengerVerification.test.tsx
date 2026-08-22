import fs from 'fs';
import path from 'path';

describe('Final Challenger Comprehensive Adversarial Verification Suite', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const apkPath = path.resolve(projectRoot, 'apk/strongerN.apk');

  describe('1. Standalone Release APK Metrics and Hard Constraints (R1 / R4)', () => {
    it('apk/strongerN.apk must exist and be <= 20,000,000 bytes', () => {
      expect(fs.existsSync(apkPath)).toBe(true);
      const stat = fs.statSync(apkPath);
      expect(stat.size).toBeLessThanOrEqual(20000000);
      // Stretch target: <or= 18.0 MiB (18,874,368 bytes) — 17.16 MB baseline verified on x86_64 emulator
      expect(stat.size).toBeLessThanOrEqual(18 * 1024 * 1024);
    });

    it('assets/StorngNLogo.png must be compressed under 100KB', () => {
      const logoPath = path.resolve(projectRoot, 'assets/StorngNLogo.png');
      expect(fs.existsSync(logoPath)).toBe(true);
      const stat = fs.statSync(logoPath);
      expect(stat.size).toBeLessThan(100 * 1024);
    });

    it('dead assets must be completely removed from repository', () => {
      expect(fs.existsSync(path.resolve(projectRoot, 'assets/logos'))).toBe(false);
      expect(fs.existsSync(path.resolve(projectRoot, 'assets/logos_v2'))).toBe(false);
      expect(fs.existsSync(path.resolve(projectRoot, 'assets/photos'))).toBe(false);
      expect(fs.existsSync(path.resolve(projectRoot, 'assets/sounds/bell1.mp3'))).toBe(false);
      expect(fs.existsSync(path.resolve(projectRoot, 'assets/sounds/bell2.mp3'))).toBe(false);
      expect(fs.existsSync(path.resolve(projectRoot, 'assets/sounds/boxing-bell.mp3'))).toBe(false);
    });
  });

  describe('2. ProGuard, R8, and Gradle Optimization Constraints (R1)', () => {
    it('gradle.properties must enforce R8 fullMode, shrinking, and bundle compression', () => {
      const props = fs.readFileSync(path.resolve(projectRoot, 'android/gradle.properties'), 'utf-8');
      expect(props).toContain('android.enableMinifyInReleaseBuilds=true');
      expect(props).toContain('android.enableShrinkResourcesInReleaseBuilds=true');
      expect(props).toContain('android.enableR8.fullMode=true');
      expect(props).toContain('android.enableBundleCompression=true');
    });

    it('proguard-rules.pro must retain keep rules for all critical native modules', () => {
      const proguard = fs.readFileSync(path.resolve(projectRoot, 'android/app/proguard-rules.pro'), 'utf-8');
      expect(proguard).toContain('-keep class com.facebook.react.**');
      expect(proguard).toContain('-keep class expo.modules.**');
      expect(proguard).toContain('-keep class com.tencent.mmkv.**');
      expect(proguard).toContain('-keep class com.margelo.nitro.**');
      expect(proguard).toContain('-keep class io.invertase.notifee.**');
      expect(proguard).toContain('-keep class com.swmansion.reanimated.**');
      expect(proguard).toContain('-keep class com.naor.strongern.**');
    });
  });

  describe('3. Startup Pipeline, Code-Splitting and Batched Hydration (R2)', () => {
    it('App.tsx must code-split non-initial tab screens using React.lazy', () => {
      const appContent = fs.readFileSync(path.resolve(projectRoot, 'src/App.tsx'), 'utf-8');
      expect(appContent).toContain('const HistoryScreen = React.lazy(');
      expect(appContent).toContain('const WorkoutScreen = React.lazy(');
      expect(appContent).toContain('const ExercisesScreen = React.lazy(');
      expect(appContent).toContain('const MuscleMapScreen = React.lazy(');
      expect(appContent).toContain('const MeasureScreen = React.lazy(');
      expect(appContent).toContain('const ActiveWorkoutModal = React.lazy(');
    });

    it('ProfileScreen must be eagerly imported for instant initial tab render', () => {
      const appContent = fs.readFileSync(path.resolve(projectRoot, 'src/App.tsx'), 'utf-8');
      expect(appContent).toContain("import ProfileScreen from './screens/ProfileScreen'");
    });

    it('App.tsx must batch startup state updates using unstable_batchedUpdates', () => {
      const appContent = fs.readFileSync(path.resolve(projectRoot, 'src/App.tsx'), 'utf-8');
      expect(appContent).toContain('unstable_batchedUpdates');
    });
  });

  describe('4. 120 FPS UI-Thread Animations and Worklets (R3)', () => {
    it('LoginScreen must use Reanimated 3 staggered worklets and frame 0 gating', () => {
      const loginContent = fs.readFileSync(path.resolve(projectRoot, 'src/screens/LoginScreen.tsx'), 'utf-8');
      expect(loginContent).toContain('react-native-reanimated');
      expect(loginContent).toContain('requestAnimationFrame');
      expect(loginContent).toContain('isReadyToAnimate');
      expect(loginContent).toContain('withDelay');
      expect(loginContent).toContain('logoAnim');
      expect(loginContent).toContain('titleAnim');
      expect(loginContent).toContain('cardAnim');
      expect(loginContent).toContain('footerAnim');
    });

    it('BarChart must use Reanimated 3 UI worklets without JS-thread Animated', () => {
      const barChartContent = fs.readFileSync(path.resolve(projectRoot, 'src/components/ui/BarChart.tsx'), 'utf-8');
      expect(barChartContent).toContain('react-native-reanimated');
      expect(barChartContent).not.toContain('useNativeDriver: false');
      expect(barChartContent).toContain('useAnimatedStyle');
      expect(barChartContent).toContain('withTiming');
      expect(barChartContent).toContain('withDelay');
    });

    it('StatCard must use Reanimated 3 UI worklets without JS-thread Animated', () => {
      const statCardContent = fs.readFileSync(path.resolve(projectRoot, 'src/components/ui/StatCard.tsx'), 'utf-8');
      expect(statCardContent).toContain('react-native-reanimated');
      expect(statCardContent).not.toContain('useNativeDriver: false');
      expect(statCardContent).toContain('useAnimatedStyle');
      expect(statCardContent).toContain('withTiming');
    });
  });

  describe('5. App Version Synchronization and Production Parity (R4)', () => {
    it('app.json version must match i18n translation versions in English and Hebrew', () => {
      const appJson = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'app.json'), 'utf-8'));
      const appVersion = appJson.expo.version;
      expect(typeof appVersion).toBe('string');
      expect(appJson.expo.android.versionCode).toBeGreaterThan(0);

      const i18nContent = fs.readFileSync(path.resolve(projectRoot, 'src/utils/i18n.ts'), 'utf-8');
      expect(i18nContent).toContain('Version ' + appVersion);
      expect(i18nContent).toContain('v' + appVersion);
    });
  });
});
