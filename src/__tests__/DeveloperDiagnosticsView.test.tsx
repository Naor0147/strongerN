import React from 'react';
import renderer from 'react-test-renderer';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DeveloperDiagnosticsView } from '../components/DeveloperDiagnosticsView';
import * as repository from '../storage/history/repository';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

describe('DeveloperDiagnosticsView', () => {
  let mockGetDiagnostics: jest.SpyInstance;
  let mockRestoreTombstones: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockGetDiagnostics = jest.spyOn(repository, 'getDatabaseDiagnostics').mockResolvedValue({
      isReady: true,
      activeSessionsCount: 20,
      tombstonedSessionsCount: 5,
      rawTotalSessionsCount: 25,
      cachedRecentCount: 20,
      cachedTotalCount: 25,
    });

    mockRestoreTombstones = jest.spyOn(repository, 'restoreAllTombstonedSessions').mockResolvedValue(5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches and renders database and MMKV telemetry', async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<DeveloperDiagnosticsView onBack={() => {}} />);
    });

    expect(mockGetDiagnostics).toHaveBeenCalledTimes(1);
    expect(tree.toJSON()).toBeTruthy();

    const root = tree.root;
    const texts = root.findAllByType('Text').map((t: any) => t.props.children);
    
    // Check values are present in rendered text elements
    expect(texts).toContain(20);
    expect(texts).toContain(5);
    expect(texts).toContain(25);
  });

  it('triggers repair action, calls onRefreshSessions, and shows feedback alert', async () => {
    const mockOnRefreshSessions = jest.fn().mockResolvedValue(undefined);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(
        <DeveloperDiagnosticsView
          onBack={() => {}}
          onRefreshSessions={mockOnRefreshSessions}
        />
      );
    });

    const root = tree.root;
    const pressableNodes = root.findAll((el: any) => el.props && typeof el.props.onPress === 'function');

    // Find the repair button (the second pressable on the screen: 0 = toolbar refresh, 1 = repair)
    const repairButton = pressableNodes[1];
    expect(repairButton).toBeDefined();

    await renderer.act(async () => {
      await repairButton.props.onPress();
    });

    expect(mockRestoreTombstones).toHaveBeenCalledTimes(1);
    expect(mockOnRefreshSessions).toHaveBeenCalledTimes(1);
    expect(mockGetDiagnostics).toHaveBeenCalledTimes(2);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('re-fetches diagnostics when refresh button is pressed', async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<DeveloperDiagnosticsView onBack={() => {}} />);
    });

    expect(mockGetDiagnostics).toHaveBeenCalledTimes(1);

    const root = tree.root;
    const pressableNodes = root.findAll((el: any) => el.props && typeof el.props.onPress === 'function');
    const refreshButton = pressableNodes[0]; // First pressable is toolbar refresh

    expect(refreshButton).toBeDefined();

    await renderer.act(async () => {
      await refreshButton.props.onPress();
    });

    expect(mockGetDiagnostics).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('displays healthy status when tombstonedSessionsCount is 0', async () => {
    mockGetDiagnostics.mockResolvedValueOnce({
      isReady: true,
      activeSessionsCount: 300,
      tombstonedSessionsCount: 0,
      rawTotalSessionsCount: 300,
      cachedRecentCount: 20,
      cachedTotalCount: 300,
    });

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<DeveloperDiagnosticsView onBack={() => {}} />);
    });

    const root = tree.root;
    const texts = root.findAllByType('Text').map((t: any) => t.props.children);
    expect(texts).toContain(300);
    expect(texts).toContain(0);
  });
});
