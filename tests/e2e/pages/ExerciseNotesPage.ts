import { Page, expect } from '@playwright/test';

export class ExerciseNotesPage {
  private modalTitleSelector = 'text=EXERCISE NOTES';
  private inputSelector = '[data-testid="notes-input"]';
  private cancelBtnSelector = '[data-testid="cancel-notes-btn"]';
  private saveBtnSelector = '[data-testid="save-notes-btn"]';

  constructor(private page: Page) {}

  async expectOpen() {
    await expect(this.page.locator(this.modalTitleSelector)).toBeVisible({ timeout: 2000 });
  }

  async expectClosed() {
    await expect(this.page.locator(this.modalTitleSelector)).toBeHidden({ timeout: 2000 });
  }

  async typeNotes(text: string) {
    const input = this.page.locator(this.inputSelector);
    await input.fill(text);
  }

  async getNotesValue(): Promise<string> {
    const input = this.page.locator(this.inputSelector);
    return await input.inputValue();
  }

  async tapSave() {
    await this.page.click(this.saveBtnSelector);
  }

  async tapCancel() {
    await this.page.click(this.cancelBtnSelector);
  }
}
