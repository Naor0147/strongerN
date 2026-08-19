import React from 'react';
import { render } from '@testing-library/react-native';
import { MuscleSetsBars } from '../components/ui/MuscleSetsBars';

describe('R4 Lifetime Stats UI & Muscle Sets Distribution', () => {
  it('renders MuscleSetsBars with sorted muscle groups and completed sets counts', () => {
    const muscleSets = {
      Chest: 42,
      Back: 56,
      Quads: 30,
    };

    const { getByText } = render(<MuscleSetsBars muscleSets={muscleSets} testID="test-muscle-bars" />);

    expect(getByText(/56/)).toBeTruthy();
    expect(getByText(/42/)).toBeTruthy();
    expect(getByText(/30/)).toBeTruthy();
  });

  it('renders empty fallback message when no muscle sets are recorded', () => {
    const { getByText } = render(<MuscleSetsBars muscleSets={{}} testID="test-empty-bars" />);
    expect(getByText(/No completed sets recorded yet/i)).toBeTruthy();
  });
});
