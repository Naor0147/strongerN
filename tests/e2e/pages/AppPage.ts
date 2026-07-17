import { Page } from '@playwright/test';

export class AppPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async startTemplateWorkout() {
    await this.page.click('[data-testid="start-template-workout"]');
  }

  async startEmptyWorkout() {
    await this.page.click('[data-testid="start-empty-workout"]');
  }

  async startLargeWorkout() {
    await this.page.click('[data-testid="start-large-workout"]');
  }
}
