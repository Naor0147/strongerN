import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.resolve(__dirname, '../specs'),
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    [path.resolve(__dirname, '../core/reporter.ts')],
  ],
  use: {
    baseURL: 'http://localhost:8081',
    actionTimeout: 5000,
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],
});
