import { Page, expect } from '@playwright/test';

export class ActiveWorkoutPage {
  private titleInputSelector = '[data-testid="workout-title-input"]';
  private discardBtnSelector = '[data-testid="discard-workout-btn"]';
  private finishBtnSelector = '[data-testid="finish-workout-btn"]';
  private minimizeBtnSelector = '[data-testid="minimize-workout-btn"]';
  private activeWorkoutBarSelector = '[data-testid="active-workout-bar"]';
  private resumeWorkoutBtnSelector = '[data-testid="resume-workout-btn"]';

  constructor(private page: Page) {}

  async expectOpen() {
    await expect(this.page.locator(this.titleInputSelector)).toBeVisible({ timeout: 5000 });
  }

  async expectClosed() {
    await expect(this.page.locator(this.titleInputSelector)).toBeHidden({ timeout: 5000 });
  }

  async getWorkoutTitle(): Promise<string> {
    const input = this.page.locator(this.titleInputSelector);
    return await input.inputValue();
  }

  async setWorkoutTitle(title: string) {
    const input = this.page.locator(this.titleInputSelector);
    await input.fill(title);
  }

  async getSetWeight(exIdx: number, setIdx: number): Promise<string> {
    const cell = this.page.locator(`[data-testid="set-weight-${exIdx}-${setIdx}"]`);
    await cell.scrollIntoViewIfNeeded();
    return await cell.innerText();
  }

  async getSetReps(exIdx: number, setIdx: number): Promise<string> {
    const cell = this.page.locator(`[data-testid="set-reps-${exIdx}-${setIdx}"]`);
    await cell.scrollIntoViewIfNeeded();
    return await cell.innerText();
  }

  async tapSetCheckbox(exIdx: number, setIdx: number) {
    const btn = this.page.locator(`[data-testid="set-checkbox-${exIdx}-${setIdx}"]`);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  async tapAddSet(exIdx: number) {
    const btn = this.page.locator(`[data-testid="add-set-btn-${exIdx}"]`);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  async tapMinimize() {
    const btn = this.page.locator(this.minimizeBtnSelector);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  async expectActiveBarVisible() {
    await expect(this.page.locator(this.activeWorkoutBarSelector)).toBeVisible({ timeout: 5000 });
  }

  async expectActiveBarHidden() {
    await expect(this.page.locator(this.activeWorkoutBarSelector)).toBeHidden({ timeout: 3000 });
  }

  async tapResumeBar() {
    const btn = this.page.locator(this.resumeWorkoutBtnSelector);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  async tapDiscardWorkout() {
    const btn = this.page.locator(this.discardBtnSelector);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  async tapFinishWorkout() {
    const btn = this.page.locator(this.finishBtnSelector);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }
}
