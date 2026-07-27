import React, { useCallback } from 'react';
import { View } from 'react-native';
import { spacing, radius } from '../../theme';
import { useTrackRender } from '../../utils/renderTracker';
import { SwipeableRow as SharedSwipeableRow } from './SwipeableRow';
import { ActiveExerciseRow } from './ActiveExerciseRow';

export interface ActiveExerciseCardProps {
  exercise: any;
  exIdx: number;
  listWidth: number;
  nextIsSameSuperSet: boolean;
  prevIsSameSuperSet: boolean;
  isSuperSet: boolean;
  superSetColor: string | undefined;
  handleDeleteExercise: (idx: number) => void;
  handleExerciseMenuPress: (idx: number) => void;
  handleOpenExerciseInsights?: (idx: number) => void;
  handleSelectVariation?: (exIdx: number, variation: string | undefined) => void;
  exerciseLibraryMap: Map<string, any>;
  handleSetFocus: any;
  updateSetField: any;
  deleteSet: any;
  toggleSetComplete: any;
  inputRefs: any;
  isRpeMode: boolean;
  addSet: (idx: number, unilateral?: boolean) => void;
}

export const ActiveExerciseCard: React.FC<ActiveExerciseCardProps> = React.memo(({
  exercise,
  exIdx,
  listWidth,
  nextIsSameSuperSet,
  prevIsSameSuperSet,
  isSuperSet,
  superSetColor,
  handleDeleteExercise,
  handleExerciseMenuPress,
  handleOpenExerciseInsights,
  handleSelectVariation,
  exerciseLibraryMap,
  handleSetFocus,
  updateSetField,
  deleteSet,
  toggleSetComplete,
  inputRefs,
  isRpeMode,
  addSet,
}) => {
  useTrackRender('ActiveExerciseCard', exercise.id);
  const handleDelete = useCallback(() => {
    handleDeleteExercise(exIdx);
  }, [handleDeleteExercise, exIdx]);

  return (
    <View style={{ marginBottom: nextIsSameSuperSet ? 0 : spacing.lg, width: listWidth }}>
      <SharedSwipeableRow
        onDelete={handleDelete}
        activeOffsetX={[-15, 15]}
        snapBackOnRelease={true}
        borderRadius={radius.md}
      >
        <ActiveExerciseRow
          exercise={exercise}
          exIdx={exIdx}
          exItemKey={exercise.id}
          isSuperSet={isSuperSet}
          nextIsSameSuperSet={nextIsSameSuperSet}
          prevIsSameSuperSet={prevIsSameSuperSet}
          superSetColor={superSetColor}
          handleExerciseMenuPress={handleExerciseMenuPress}
          handleOpenExerciseInsights={handleOpenExerciseInsights}
          handleSelectVariation={handleSelectVariation}
          exerciseLibraryMap={exerciseLibraryMap}
          handleSetFocus={handleSetFocus}
          updateSetField={updateSetField}
          deleteSet={deleteSet}
          toggleSetComplete={toggleSetComplete}
          inputRefs={inputRefs}
          isRpeMode={isRpeMode}
          addSet={addSet}
        />
      </SharedSwipeableRow>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.exIdx === nextProps.exIdx &&
    prevProps.listWidth === nextProps.listWidth &&
    prevProps.nextIsSameSuperSet === nextProps.nextIsSameSuperSet &&
    prevProps.prevIsSameSuperSet === nextProps.prevIsSameSuperSet &&
    prevProps.isSuperSet === nextProps.isSuperSet &&
    prevProps.superSetColor === nextProps.superSetColor &&
    prevProps.isRpeMode === nextProps.isRpeMode &&
    prevProps.exercise === nextProps.exercise &&
    prevProps.exerciseLibraryMap === nextProps.exerciseLibraryMap
  );
});
