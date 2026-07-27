import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/AppPage';
import { ExerciseMenuPage } from '../pages/ExerciseMenuPage';
import { ExerciseNotesPage } from '../pages/ExerciseNotesPage';
import { ExerciseInsightsPage } from '../pages/ExerciseInsightsPage';

test.describe('Exercise Notes Regression Tests', () => {
  let appPage: AppPage;
  let exMenuPage: ExerciseMenuPage;
  let notesPage: ExerciseNotesPage;
  let insightsPage: ExerciseInsightsPage;

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
    exMenuPage = new ExerciseMenuPage(page);
    notesPage = new ExerciseNotesPage(page);
    insightsPage = new ExerciseInsightsPage(page);

    await appPage.goto();
    await appPage.clearStorage();
    await appPage.startTemplateWorkout();
  });

  test('can add and edit notes for an exercise', async ({ page }) => {
    // 1. Fill in notes inline
    const testNotes = 'Seat height 5, cue: chest up';
    await notesPage.typeNotes(testNotes);

    // 2. Verify the note is displayed in the input field
    const displayedNotes = page.locator('[data-testid^="exercise-notes-input-"]').first();
    await expect(displayedNotes).toBeVisible();
    await expect(displayedNotes).toHaveValue(testNotes);

    // 3. Verify value retrieved from notesPage matches
    const retrievedNotes = await notesPage.getNotesValue();
    expect(retrievedNotes).toBe(testNotes);
  });

  test('exercise insights notes are separate from regular exercise notes and save automatically', async ({ page }) => {
    // 1. Add regular exercise notes inline first
    const regularNotes = 'Regular notes: height 3';
    await notesPage.typeNotes(regularNotes);

    // 2. Open Exercise Insights
    await exMenuPage.open(0);
    await exMenuPage.tapExerciseInsights();
    await insightsPage.expectOpen();

    // 3. Verify Insights Notes field is empty initially (separate from regular notes)
    const initialInsightsNotes = await insightsPage.getNotesValue();
    expect(initialInsightsNotes).toBe('');

    // 4. Fill in Insights Notes and trigger auto-save (blur)
    const insightsNotesText = 'Insights notes: focused on speed';
    await insightsPage.typeNotes(insightsNotesText);

    // 5. Close Exercise Insights
    await insightsPage.tapBack();
    await insightsPage.expectClosed();

    // 6. Verify regular notes are still displayed and unchanged in inline input
    const displayedNotes = page.locator('[data-testid^="exercise-notes-input-"]').first();
    await expect(displayedNotes).toBeVisible();
    await expect(displayedNotes).toHaveValue(regularNotes);

    // 7. Verify insights notes are persisted by opening insights again
    await exMenuPage.open(0);
    await exMenuPage.tapExerciseInsights();
    await insightsPage.expectOpen();
    const savedInsightsNotes = await insightsPage.getNotesValue();
    expect(savedInsightsNotes).toBe(insightsNotesText);

    // 8. Close and clean up
    await insightsPage.tapBack();
    await insightsPage.expectClosed();
  });
});
