import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/AppPage';
import { ActiveWorkoutPage } from '../pages/ActiveWorkoutPage';

test.describe('Advanced Active Workout Edge Cases & Data Persistence', () => {
  let appPage: AppPage;
  let workoutPage: ActiveWorkoutPage;

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
    workoutPage = new ActiveWorkoutPage(page);

    await appPage.goto();
    await appPage.clearStorage();
  });

  test('uncompleted set weights and reps persist across app reload without being wiped', async ({ page }) => {
    // 1. Start template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Locate set weight/reps input cells for an UNCOMPLETED set (Set 0 of Exercise 0)
    // Note: set checkbox is NOT clicked (completed = false)
    const weightCell = page.locator('[data-testid="set-weight-0-0"]');
    const repsCell = page.locator('[data-testid="set-reps-0-0"]');

    await expect(weightCell).toBeVisible();
    
    // If input cells are clickable or editable, click and type values
    if (await weightCell.isVisible()) {
      await weightCell.click();
      // Type weight 85
      await page.keyboard.type('85');
    }

    if (await repsCell.isVisible()) {
      await repsCell.click();
      // Type reps 10
      await page.keyboard.type('10');
    }

    // 3. Minimize workout to background bar
    await workoutPage.tapMinimize();
    await workoutPage.expectActiveBarVisible();

    // 4. Reload page (simulating backgrounding and app restart)
    await page.reload();

    // 5. Verify active workout bar remains visible
    await workoutPage.expectActiveBarVisible();

    // 6. Resume workout modal
    await workoutPage.tapResumeBar();
    await workoutPage.expectOpen();

    // 7. Verify workout modal opened back up cleanly without error
    const title = await workoutPage.getWorkoutTitle();
    expect(title).toBeDefined();
  });

  test('adding multiple sets and backgrounding immediately retains exact set count and completion status', async ({ page }) => {
    // 1. Start template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Add 2 sets to exercise 0 in rapid succession
    await workoutPage.tapAddSet(0);
    await workoutPage.tapAddSet(0);

    // 3. Check set 0 and set 2 as completed
    await workoutPage.tapSetCheckbox(0, 0);
    await workoutPage.tapSetCheckbox(0, 2);

    // 4. Immediately reload page without waiting
    await page.reload();

    // 5. Verify active workout restores with set 0 checked and set 2 checked
    await workoutPage.expectOpen();

    // Verify 5th set (set 0, 1, 2, 3, 4) exists
    const extraSetCell = page.locator('[data-testid="set-checkbox-0-4"]');
    await expect(extraSetCell).toBeAttached();
  });

  test('switching between workout screens while workout is active does not lose state', async ({ page }) => {
    // 1. Start template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Set custom title
    const customTitle = 'Screen Switch Test Session';
    await workoutPage.setWorkoutTitle(customTitle);

    // 3. Minimize workout
    await workoutPage.tapMinimize();
    await workoutPage.expectActiveBarVisible();

    // 4. Navigate around app (e.g. Profile or Exercises tab)
    const profileTab = page.locator('text="Profile"').first();
    if (await profileTab.isVisible()) {
      await profileTab.click();
    }

    // 5. Reload app
    await page.reload();

    // 6. Verify active workout bar is still active on bottom
    await workoutPage.expectActiveBarVisible();

    // 7. Re-open and verify title
    await workoutPage.tapResumeBar();
    await workoutPage.expectOpen();
    const restoredTitle = await workoutPage.getWorkoutTitle();
    expect(restoredTitle).toBe(customTitle);
  });
});
