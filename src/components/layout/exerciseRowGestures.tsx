import React, { createContext, useContext } from 'react';

interface ExerciseRowGesturesContextType {
  swipeGesture?: any;
  reorderGesture?: any;
}

export const ExerciseRowGesturesContext = createContext<ExerciseRowGesturesContextType>({});

export const useExerciseRowGestures = () => useContext(ExerciseRowGesturesContext);
