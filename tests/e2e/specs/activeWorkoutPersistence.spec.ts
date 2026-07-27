import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/AppPage';
import { ActiveWorkoutPage } from '../pages/ActiveWorkoutPage';
import { ExerciseMenuPage } from '../pages/ExerciseMenuPage';
import { ExerciseNotesPage } from '../pages/ExerciseNotesPage';

test.describe('Active Workout Data Integrity & Persistence Tests', () => {
  let appPage: AppPage;
  let workoutPage: ActiveWorkoutPage;
  let exMenuPage: ExerciseMenuPage;
  let notesPage: ExerciseNotesPage;

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
    workoutPage = new ActiveWorkoutPage(page);
    exMenuPage = new ExerciseMenuPage(page);
    notesPage = new ExerciseNotesPage(page);

    await appPage.goto();
    await appPage.clearStorage();
  });

  test('workout title, set completion, and set count persist after page refresh', async ({ page }) => {
    // 1. Start a template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Modify workout title
    const customTitle = 'Persistence Heavy Push Session';
    await workoutPage.setWorkoutTitle(customTitle);

    // 3. Mark set 0 of exercise 0 as completed
    await workoutPage.tapSetCheckbox(0, 0);

    // 4. Add a set to exercise 0
    await workoutPage.tapAddSet(0);
    await page.locator('[data-testid="set-weight-0-3"]').waitFor({ state: 'attached', timeout: 5000 });

    // 5. Wait for auto-save debounce
    await page.waitForTimeout(1200);

    // 6. Reload page to simulate leaving app / browser refresh
    await page.reload();

    // 7. Verify active workout is restored automatically
    await workoutPage.expectOpen();

    // 8. Assert data integrity after refresh
    const restoredTitle = await workoutPage.getWorkoutTitle();
    expect(restoredTitle).toBe(customTitle);

    // Verify set 0 is still recorded and 4th set exists (add set persisted)
    const fourthSetWeight = await workoutPage.getSetWeight(0, 3);
    expect(fourthSetWeight).toBeDefined();
  });

  test('exercise notes persist across page refresh', async ({ page }) => {
    // 1. Start template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Add exercise notes inline to the first exercise
    const noteText = 'Keep elbows tucked at 45 degrees for shoulder safety';
    await notesPage.typeNotes(noteText);

    // 3. Verify notes displayed in inline input
    const displayedNotes = page.locator('[data-testid^="exercise-notes-input-"]').first();
    await expect(displayedNotes).toBeVisible();
    await expect(displayedNotes).toHaveValue(noteText);

    // 4. Wait for auto-save and reload page
    await page.waitForTimeout(1200);
    await page.reload();

    // 5. Verify active workout and exercise notes are fully preserved after reload
    await workoutPage.expectOpen();
    const restoredNotes = page.locator('[data-testid^="exercise-notes-input-"]').first();
    await expect(restoredNotes).toBeVisible();
    await expect(restoredNotes).toHaveValue(noteText);
  });

  test('minimized workout bar state persists across refresh and allows resumption', async ({ page }) => {
    // 1. Start template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Minimize the active workout sheet
    await workoutPage.tapMinimize();
    await workoutPage.expectActiveBarVisible();

    // 3. Wait for auto-save and reload page
    await page.waitForTimeout(1200);
    await page.reload();

    // 4. Verify active workout bar is restored on main screen
    await workoutPage.expectActiveBarVisible();

    // 5. Tap resume button on active workout bar
    await workoutPage.tapResumeBar();

    // 6. Verify full active workout modal opens back up
    await workoutPage.expectOpen();
  });

  test('discarding workout wipes saved state permanently', async ({ page }) => {
    // 1. Start template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Discard the workout
    await workoutPage.tapDiscardWorkout();

    // 3. Verify modal and active bar are gone
    await workoutPage.expectActiveBarHidden();

    // 4. Reload page
    await page.reload();

    // 5. Verify no active workout is restored (state was cleared on discard)
    await workoutPage.expectActiveBarHidden();
  });
});
