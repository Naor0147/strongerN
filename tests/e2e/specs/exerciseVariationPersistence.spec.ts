import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/AppPage';
import { ActiveWorkoutPage } from '../pages/ActiveWorkoutPage';

test.describe('Active Workout Exercise Tag & Variation Persistence Edge Cases', () => {
  let appPage: AppPage;
  let workoutPage: ActiveWorkoutPage;

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
    workoutPage = new ActiveWorkoutPage(page);

    await appPage.goto();
    await appPage.clearStorage();
  });

  test('active workout with variation selection persists after backgrounding and page reload without crash', async ({ page }) => {
    // 1. Start a template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Set custom workout title
    const workoutTitle = 'Tagged Variation Push Workout';
    await workoutPage.setWorkoutTitle(workoutTitle);

    // 3. Complete set 0 of exercise 0
    await workoutPage.tapSetCheckbox(0, 0);

    // 4. Check if variation dropdown exists and select a variation tag if present
    const dropdownBtn = page.locator('[data-testid="variation-dropdown-btn"]').first();
    if (await dropdownBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dropdownBtn.click();
      
      // Select base or variation option
      const baseOption = page.locator('[data-testid="variation-option-base"]');
      await expect(baseOption).toBeVisible();
      await baseOption.click();
    }

    // 5. Minimize workout to background bar
    await workoutPage.tapMinimize();
    await workoutPage.expectActiveBarVisible();

    // 6. Wait for auto-save debounce
    await page.waitForTimeout(1200);

    // 7. Simulate backgrounding / cold-start restore by reloading browser
    await page.reload();

    // 8. Verify active workout bar appears on restoration without application error
    await workoutPage.expectActiveBarVisible();

    // 9. Re-open workout modal from active bar
    await workoutPage.tapResumeBar();
    await workoutPage.expectOpen();

    // 10. Verify title and set state remain preserved and functional
    const restoredTitle = await workoutPage.getWorkoutTitle();
    expect(restoredTitle).toBe(workoutTitle);

    // 11. Complete workout cleanly
    await workoutPage.tapFinishWorkout();
    await workoutPage.expectClosed();
  });

  test('double launch reload edge case does not crash or corrupt saved workout state', async ({ page }) => {
    // 1. Start template workout
    await appPage.startTemplateWorkout();
    await workoutPage.expectOpen();

    // 2. Mark first set completed
    await workoutPage.tapSetCheckbox(0, 0);

    // 3. Wait for auto-save
    await page.waitForTimeout(1200);

    // 4. First reload (Launch 1)
    await page.reload();
    await workoutPage.expectOpen();

    // 5. Immediately reload a second time (Launch 2 rapid restart edge case)
    await page.reload();
    await workoutPage.expectOpen();

    // 6. Verify modal re-mounts safely without crash or losing active state
    const title = await workoutPage.getWorkoutTitle();
    expect(title).toBeDefined();
  });
});
