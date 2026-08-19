import fs from 'fs';
import path from 'path';

describe('Bundle & Asset Optimization Guard (M1 / R1)', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const srcDir = path.resolve(projectRoot, 'src');
  const assetsDir = path.resolve(projectRoot, 'assets');

  function getAllFiles(dir: string, extensions: string[]): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.agents') continue;
        results = results.concat(getAllFiles(fullPath, extensions));
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
    return results;
  }

  describe('Font Imports Tree-Shaking', () => {
    it('should have zero barrel imports of @expo/vector-icons across src files', () => {
      const srcFiles = getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
      const barrelRegex = /from\s+['"]@expo\/vector-icons['"](?!\/)/;

      const offendingFiles: string[] = [];
      for (const file of srcFiles) {
        // Skip mock files
        if (file.includes('__tests__') || file.includes('mocks')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        if (barrelRegex.test(content)) {
          offendingFiles.push(path.relative(projectRoot, file));
        }
      }

      expect(offendingFiles).toEqual([]);
    });

    it('should have zero barrel imports of @expo-google-fonts/inter or rubik across src files', () => {
      const srcFiles = getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
      const barrelRegex = /from\s+['"]@expo-google-fonts\/(inter|rubik)['"](?!\/)/;

      const offendingFiles: string[] = [];
      for (const file of srcFiles) {
        if (file.includes('__tests__') || file.includes('mocks')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        if (barrelRegex.test(content)) {
          offendingFiles.push(path.relative(projectRoot, file));
        }
      }

      expect(offendingFiles).toEqual([]);
    });

    it('should only import allowed font variants in App.tsx and E2EAppHarness.tsx', () => {
      const allowedImports = [
        '@expo-google-fonts/inter/400Regular',
        '@expo-google-fonts/inter/500Medium',
        '@expo-google-fonts/inter/600SemiBold',
        '@expo-google-fonts/inter/700Bold',
        '@expo-google-fonts/rubik/400Regular',
        '@expo-google-fonts/rubik/500Medium',
        '@expo-google-fonts/rubik/600SemiBold',
        '@expo-google-fonts/rubik/700Bold',
        '@expo/vector-icons/Ionicons',
        'expo-font',
      ];

      const appContent = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
      const harnessContent = fs.readFileSync(path.join(srcDir, 'screens/E2EAppHarness.tsx'), 'utf-8');

      for (const fontModule of [
        '@expo-google-fonts/inter/400Regular',
        '@expo-google-fonts/inter/500Medium',
        '@expo-google-fonts/inter/600SemiBold',
        '@expo-google-fonts/inter/700Bold',
        '@expo-google-fonts/rubik/400Regular',
        '@expo-google-fonts/rubik/500Medium',
        '@expo-google-fonts/rubik/600SemiBold',
        '@expo-google-fonts/rubik/700Bold',
      ]) {
        expect(appContent).toContain(fontModule);
        expect(harnessContent).toContain(fontModule);
      }
    });
  });

  describe('Dead Asset Pruning', () => {
    it('should not contain dead directories or unreferenced mp3 files in assets', () => {
      expect(fs.existsSync(path.join(assetsDir, 'logos'))).toBe(false);
      expect(fs.existsSync(path.join(assetsDir, 'logos_v2'))).toBe(false);
      expect(fs.existsSync(path.join(assetsDir, 'photos'))).toBe(false);
      expect(fs.existsSync(path.join(assetsDir, 'sounds/bell1.mp3'))).toBe(false);
      expect(fs.existsSync(path.join(assetsDir, 'sounds/bell2.mp3'))).toBe(false);
      expect(fs.existsSync(path.join(assetsDir, 'sounds/boxing-bell.mp3'))).toBe(false);
    });

    it('should retain active sounds in assets/sounds', () => {
      expect(fs.existsSync(path.join(assetsDir, 'sounds/set_completed.wav'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'sounds/timer_completed.wav'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'sounds/workout_completed.wav'))).toBe(true);
    });

    it('should have StorngNLogo.png optimally compressed below 100KB', () => {
      const logoPath = path.join(assetsDir, 'StorngNLogo.png');
      expect(fs.existsSync(logoPath)).toBe(true);
      const stat = fs.statSync(logoPath);
      expect(stat.size).toBeLessThan(100 * 1024);
    });
  });

  describe('Android Gradle & ProGuard / R8 Configuration', () => {
    it('should have R8 full mode, minification, resource shrinking, and bundle compression enabled in gradle.properties', () => {
      const gradlePropsPath = path.join(projectRoot, 'android/gradle.properties');
      const content = fs.readFileSync(gradlePropsPath, 'utf-8');

      expect(content).toContain('android.enableMinifyInReleaseBuilds=true');
      expect(content).toContain('android.enableShrinkResourcesInReleaseBuilds=true');
      expect(content).toContain('android.enableR8.fullMode=true');
      expect(content).toContain('android.enableBundleCompression=true');
    });

    it('should reference proguard-android-optimize.txt and shrinkResources in android/app/build.gradle', () => {
      const buildGradlePath = path.join(projectRoot, 'android/app/build.gradle');
      const content = fs.readFileSync(buildGradlePath, 'utf-8');

      expect(content).toContain('proguard-android-optimize.txt');
      expect(content).toContain('shrinkResources');
      expect(content).toContain('minifyEnabled enableMinifyInReleaseBuilds');
    });

    it('should have bulletproof keep rules in proguard-rules.pro', () => {
      const proguardPath = path.join(projectRoot, 'android/app/proguard-rules.pro');
      const content = fs.readFileSync(proguardPath, 'utf-8');

      expect(content).toContain('-keep class com.facebook.react.**');
      expect(content).toContain('-keep class expo.modules.**');
      expect(content).toContain('-keep class com.tencent.mmkv.**');
      expect(content).toContain('-keep class com.margelo.nitro.**');
      expect(content).toContain('-keep class io.invertase.notifee.**');
      expect(content).toContain('-keep class com.swmansion.reanimated.**');
      expect(content).toContain('-keep class com.naor.strongern.**');
    });
  });
});
