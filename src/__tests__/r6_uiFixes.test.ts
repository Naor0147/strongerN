import { colors } from '../theme';
import { styles as activeWorkoutStyles } from '../components/layout/activeWorkoutStyles';
import { exerciseBlockStyles } from '../components/layout/exerciseBlockStyles';

describe('R6 UI Fixes: Completed Cell & Collapse Glitches', () => {
  it('defines colors.surfaceCompleted and colors.setConnector design tokens', () => {
    expect(colors.surfaceCompleted).toBe('#111A2E');
    expect(colors.setConnector).toBe('#253347');
  });

  it('activeWorkoutStyles and exerciseBlockStyles use tokenized surfaceCompleted', () => {
    expect(activeWorkoutStyles.setRowCompleted.backgroundColor).toBe(colors.surfaceCompleted);
    expect(exerciseBlockStyles.setRowCompleted.backgroundColor).toBe(colors.surfaceCompleted);
  });
});
