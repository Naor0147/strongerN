import { Page } from '@playwright/test';

export class ExerciseNotesPage {
  constructor(private page: Page) {}

  async typeNotes(text: string, exerciseIndex = 0) {
    const input = this.page.locator(`[data-testid="exercise-notes-input-${exerciseIndex}"]`);
    await input.fill(text);
    await input.blur();
  }

  async getNotesValue(exerciseIndex = 0): Promise<string> {
    const input = this.page.locator(`[data-testid="exercise-notes-input-${exerciseIndex}"]`);
    return await input.inputValue();
  }
}
