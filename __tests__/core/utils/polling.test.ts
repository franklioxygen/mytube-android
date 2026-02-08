import {
  getJitteredIntervalMs,
  getPollingRetryDelayMs,
  shouldRetryPollingError,
} from '../../../src/core/utils/polling';

describe('getPollingRetryDelayMs', () => {
  test('uses bounded backoff steps', () => {
    expect(getPollingRetryDelayMs(0)).toBe(2000);
    expect(getPollingRetryDelayMs(1)).toBe(5000);
    expect(getPollingRetryDelayMs(2)).toBe(10000);
    expect(getPollingRetryDelayMs(99)).toBe(60000);
  });
});

describe('getJitteredIntervalMs', () => {
  test('applies +/-20% jitter and keeps at least 1000ms', () => {
    const base = 2000;
    for (let i = 0; i < 20; i += 1) {
      const value = getJitteredIntervalMs(base);
      expect(value).toBeGreaterThanOrEqual(1600);
      expect(value).toBeLessThanOrEqual(2400);
    }

    expect(getJitteredIntervalMs(100)).toBeGreaterThanOrEqual(1000);
  });
});

describe('shouldRetryPollingError', () => {
  test('retries only transient network/server errors', () => {
    expect(
      shouldRetryPollingError({
        code: 'NETWORK',
        message: 'offline',
      } as any)
    ).toBe(true);

    expect(
      shouldRetryPollingError({
        code: 'SERVER',
        httpStatus: 503,
        message: 'unavailable',
      } as any)
    ).toBe(true);

    expect(
      shouldRetryPollingError({
        code: 'VALIDATION',
        httpStatus: 400,
        message: 'bad input',
      } as any)
    ).toBe(false);

    expect(
      shouldRetryPollingError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'missing',
      } as any)
    ).toBe(false);
  });
});
