import { Page } from '@playwright/test';

export class ExerciseMenuPage {
  constructor(private page: Page) {}

  async open(exerciseIndex: number) {
    const selector = `[data-testid="ex-ellipsis-${exerciseIndex}"]`;
    await this.page.click(selector);
  }

  async tapSetAutoTimer() {
    await this.page.click('[data-testid="set-auto-timer"]');
  }

  async tapExerciseInsights() {
    await this.page.click('[data-testid="exercise-insights-menu-item"]');
  }
}
