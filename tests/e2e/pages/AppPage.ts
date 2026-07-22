import { Page } from '@playwright/test';

export class AppPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/?e2e=true');
  }

  async clearStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('is_e2e_mode', 'true');
      sessionStorage.setItem('is_e2e_mode', 'true');
    });
    await this.goto();
  }

  async startTemplateWorkout() {
    const btn = this.page.locator('[data-testid="start-template-workout"]');
    await btn.waitFor({ state: 'visible', timeout: 30000 });
    await btn.click();
  }

  async startEmptyWorkout() {
    const btn = this.page.locator('[data-testid="start-empty-workout"]');
    await btn.waitFor({ state: 'visible', timeout: 30000 });
    await btn.click();
  }

  async startLargeWorkout() {
    const btn = this.page.locator('[data-testid="start-large-workout"]');
    await btn.waitFor({ state: 'visible', timeout: 30000 });
    await btn.click();
  }
}
