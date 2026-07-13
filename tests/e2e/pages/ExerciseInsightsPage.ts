import { Page, expect } from '@playwright/test';

export class ExerciseInsightsPage {
  private inputSelector = '[data-testid="insights-notes-input"]';
  private backBtnSelector = '[data-testid="insights-back-btn"]';

  constructor(private page: Page) {}

  async expectOpen() {
    await expect(this.page.locator(this.inputSelector)).toBeVisible({ timeout: 2000 });
  }

  async expectClosed() {
    await expect(this.page.locator(this.inputSelector)).toBeHidden({ timeout: 2000 });
  }

  async typeNotes(text: string) {
    const input = this.page.locator(this.inputSelector);
    await input.fill(text);
    // Trigger blur to ensure onEndEditing is called and auto-saves
    await input.blur();
  }

  async getNotesValue(): Promise<string> {
    const input = this.page.locator(this.inputSelector);
    return await input.inputValue();
  }

  async tapBack() {
    await this.page.click(this.backBtnSelector);
  }
}
