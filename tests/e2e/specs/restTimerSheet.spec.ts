import { test } from '@playwright/test';
import { AppPage } from '../pages/AppPage';
import { ExerciseMenuPage } from '../pages/ExerciseMenuPage';
import { RestTimerSheetPage } from '../pages/RestTimerSheetPage';

test.describe('Rest Timer Sheet Regression Tests', () => {
  let appPage: AppPage;
  let exMenuPage: ExerciseMenuPage;
  let timerSheetPage: RestTimerSheetPage;

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
    exMenuPage = new ExerciseMenuPage(page);
    timerSheetPage = new RestTimerSheetPage(page);

    await appPage.goto();
    await appPage.startTemplateWorkout();
  });

  test('ruler drag on web does not close the sheet', async ({ page }) => {
    // 1. Open exercise options menu for the first exercise
    await exMenuPage.open(0);

    // 2. Open Rest Timer Picker
    await exMenuPage.tapSetAutoTimer();

    // 3. Verify it is open
    await timerSheetPage.expectOpen();

    // Wait for the slide-in entrance animation to settle
    await page.waitForTimeout(250);

    // 4. Capture original time display text
    const initialTime = await timerSheetPage.getSecondsText();

    // 5. Drag the ruler
    await timerSheetPage.dragRuler(100);

    // 6. Verify the sheet stays open (the regression fix!)
    await timerSheetPage.expectOpen();

    // 7. Verify the value changed
    const newTime = await timerSheetPage.getSecondsText();
    timerSheetPage.expectValueChanged(initialTime, newTime);
  });

  test('backdrop tap closes the sheet', async ({ page }) => {
    // 1. Open exercise options menu for the first exercise
    await exMenuPage.open(0);

    // 2. Open Rest Timer Picker
    await exMenuPage.tapSetAutoTimer();

    // 3. Verify it is open
    await timerSheetPage.expectOpen();

    // Wait for slide-in entrance animation to settle
    await page.waitForTimeout(200);

    // 4. Tap backdrop
    await timerSheetPage.tapBackdrop();

    // 5. Verify the sheet is closed
    await timerSheetPage.expectClosed();
  });
});
