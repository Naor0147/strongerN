import {
  logOauthEvent,
  getOauthLogs,
  clearOauthLogs,
  subscribeOauthLogs,
  formatOauthLogsText,
  copyOauthLogsToClipboard,
} from '../utils/oauthDiagnostics';
import { Clipboard } from 'react-native';

describe('OAuth Diagnostics Telemetry Utility', () => {
  beforeEach(() => {
    clearOauthLogs();
    jest.clearAllMocks();
  });

  it('logs info, ok, and error events with timestamps and details', () => {
    const ev1 = logOauthEvent('request loaded', 'redirectUri: com.google...:/oauth2redirect', 'ok');
    expect(ev1.step).toBe('request loaded');
    expect(ev1.level).toBe('ok');
    expect(ev1.formattedTime).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    expect(ev1.detail).toContain('redirectUri');

    const ev2 = logOauthEvent('browser opened', 'Launching Google Auth', 'info');
    expect(ev2.step).toBe('browser opened');
    expect(ev2.level).toBe('info');

    const ev3 = logOauthEvent('exchange failed', new Error('Network timeout'), 'error');
    expect(ev3.step).toBe('exchange failed');
    expect(ev3.level).toBe('error');
    expect(ev3.detail).toBe('Network timeout');

    const logs = getOauthLogs();
    expect(logs.length).toBe(3);
    expect(logs[0].id).toBe(ev1.id);
    expect(logs[1].id).toBe(ev2.id);
    expect(logs[2].id).toBe(ev3.id);
  });

  it('enforces ring-buffer capacity of max 50 events', () => {
    for (let i = 0; i < 65; i++) {
      logOauthEvent(`step-${i}`, `detail-${i}`, 'info');
    }

    const logs = getOauthLogs();
    expect(logs.length).toBe(50);
    // Oldest 15 should have been evicted; earliest remaining should be step-15
    expect(logs[0].step).toBe('step-15');
    expect(logs[49].step).toBe('step-64');
  });

  it('notifies subscribers on new log entries and clear', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeOauthLogs(listener);

    // Initial subscribe call
    expect(listener).toHaveBeenCalledTimes(1);

    logOauthEvent('browser returned', 'type: success', 'ok');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].length).toBe(1);

    clearOauthLogs();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[2][0].length).toBe(0);

    unsubscribe();
    logOauthEvent('after unsubscribe', undefined, 'info');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('formats text log and copies to system clipboard', () => {
    const setStringSpy = jest.spyOn(Clipboard, 'setString');

    logOauthEvent('request loaded', 'scheme: com.google', 'ok');
    logOauthEvent('watchdog timeout', '2.5s expired', 'error');

    const text = formatOauthLogsText();
    expect(text).toContain('=== StrongerN OAuth Diagnostics Log ===');
    expect(text).toContain('[OK]    request loaded');
    expect(text).toContain('[ERROR] watchdog timeout -> 2.5s expired');

    const copied = copyOauthLogsToClipboard();
    expect(copied).toBe(true);
    expect(setStringSpy).toHaveBeenCalledWith(expect.stringContaining('=== StrongerN OAuth Diagnostics Log ==='));
    expect(setStringSpy).toHaveBeenCalledWith(expect.stringContaining('[OK]    request loaded'));
    expect(setStringSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] watchdog timeout -> 2.5s expired'));
  });
});
