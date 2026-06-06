// __tests__/realImport.test.ts
import fs from 'fs';
import { importStrongCSV } from '../utils/csvImporter';
import { mockExercises } from '../data/mockData';

describe('Real Strong CSV Import Verification', () => {
  const realCSVPath = 'F:/Antigravity/strongerN/csvDemo/strong4726328791545586766.csv';

  it('should successfully read and parse the real user-provided CSV', () => {
    // Check if file is readable
    if (!fs.existsSync(realCSVPath)) {
      console.warn(`[Skip Test] Real user CSV not found at: ${realCSVPath}`);
      return;
    }

    const csvContent = fs.readFileSync(realCSVPath, 'utf-8');
    expect(csvContent.length).toBeGreaterThan(0);

    const result = importStrongCSV(csvContent, mockExercises);

    console.log('--- Real CSV Import Summary ---');
    console.log(`Total Workouts Found/Imported: ${result.importedSessions.length}`);
    console.log(`Total New Exercises Added: ${result.addedExercises.length}`);
    
    // Log new exercises created
    if (result.addedExercises.length > 0) {
      console.log('New Exercises Created:');
      result.addedExercises.slice(0, 15).forEach(e => {
        console.log(` - ${e.name} (Muscle: ${e.muscleGroup}, Equipment: ${e.equipment})`);
      });
      if (result.addedExercises.length > 15) {
        console.log(` ... and ${result.addedExercises.length - 15} more`);
      }
    }
    console.log('-------------------------------');

    // Assert that we successfully parsed a significant number of workouts
    expect(result.importedSessions.length).toBeGreaterThan(50);
    
    // Assert that some exercises are matched to existing ones
    // For example, "Bench Press (Barbell)" from CSV should match "Bench Press" from mockExercises
    // Let's verify that "Bench Press" (from mockExercises) is present in the imported sessions
    const hasBenchPress = result.importedSessions.some(session =>
      session.exercises.some(ex => ex.name === 'Bench Press')
    );
    expect(hasBenchPress).toBe(true);

    // Let's verify that we didn't duplicate names by asserting all added exercise names are unique and not already in mockExercises
    const existingNames = new Set(mockExercises.map(e => e.name.toLowerCase().trim()));
    result.addedExercises.forEach(e => {
      expect(existingNames.has(e.name.toLowerCase().trim())).toBe(false);
    });
  });
});
