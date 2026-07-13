import { Page } from '@playwright/test';

export class AppPage {
  constructor(private page: Page) {}

  async goto() {
    this.page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    this.page.on('pageerror', err => {
      console.log(`[BROWSER EXCEPTION]: ${err.message}\n${err.stack}`);
    });
    await this.page.goto('/');
  }

  async startTemplateWorkout() {
    await this.page.click('[data-testid="start-template-workout"]');
  }

  async startEmptyWorkout() {
    await this.page.click('[data-testid="start-empty-workout"]');
  }
}
