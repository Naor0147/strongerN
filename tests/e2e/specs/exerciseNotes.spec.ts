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
    // 1. Open exercise options menu for the first exercise
    await exMenuPage.open(0);

    // 2. Open Exercise Notes
    await exMenuPage.tapViewEditNotes();

    // 3. Verify it is open
    await notesPage.expectOpen();

    // 4. Fill in notes
    const testNotes = 'Seat height 5, cue: chest up';
    await notesPage.typeNotes(testNotes);

    // 5. Save the notes
    await notesPage.tapSave();

    // 6. Verify modal is closed
    await notesPage.expectClosed();

    // 7. Verify the note is now displayed on the screen
    const displayedNotes = page.locator('[data-testid="exercise-notes-text"]');
    await expect(displayedNotes).toBeVisible();
    await expect(displayedNotes).toHaveText(testNotes);

    // 8. Re-open the notes modal to ensure the notes are persisted in the input field
    await exMenuPage.open(0);
    await exMenuPage.tapViewEditNotes();
    await notesPage.expectOpen();
    const retrievedNotes = await notesPage.getNotesValue();
    expect(retrievedNotes).toBe(testNotes);

    // 9. Cancel and ensure it remains correct
    await notesPage.tapCancel();
    await notesPage.expectClosed();
  });

  test('exercise insights notes are separate from regular exercise notes and save automatically', async ({ page }) => {
    // 1. Add regular exercise notes first
    await exMenuPage.open(0);
    await exMenuPage.tapViewEditNotes();
    await notesPage.expectOpen();
    const regularNotes = 'Regular notes: height 3';
    await notesPage.typeNotes(regularNotes);
    await notesPage.tapSave();
    await notesPage.expectClosed();

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

    // 6. Verify regular notes are still displayed and unchanged
    const displayedNotes = page.locator('[data-testid="exercise-notes-text"]');
    await expect(displayedNotes).toBeVisible();
    await expect(displayedNotes).toHaveText(regularNotes);

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
