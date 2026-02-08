import {
  __isRetryableMethodForTests,
  __shouldTriggerReauthForTests,
} from '../../../src/core/api/client';

describe('client retryable methods', () => {
  test('allows safe/idempotent read methods', () => {
    expect(__isRetryableMethodForTests('GET')).toBe(true);
    expect(__isRetryableMethodForTests('head')).toBe(true);
    expect(__isRetryableMethodForTests(' OPTIONS ')).toBe(true);
  });

  test('blocks write methods from automatic transport retries', () => {
    expect(__isRetryableMethodForTests('POST')).toBe(false);
    expect(__isRetryableMethodForTests('PUT')).toBe(false);
    expect(__isRetryableMethodForTests('DELETE')).toBe(false);
    expect(__isRetryableMethodForTests('PATCH')).toBe(false);
  });

  test('treats unknown/missing methods as non-retryable', () => {
    expect(__isRetryableMethodForTests(undefined)).toBe(false);
    expect(__isRetryableMethodForTests('')).toBe(false);
    expect(__isRetryableMethodForTests('   ')).toBe(false);
  });
});

describe('client re-auth trigger policy', () => {
  test('triggers on 401 for any method', () => {
    expect(
      __shouldTriggerReauthForTests('POST', {
        code: 'UNAUTHENTICATED',
        message: 'auth required',
      })
    ).toBe(true);
  });

  test('triggers on 403 for read methods only', () => {
    expect(
      __shouldTriggerReauthForTests('GET', {
        code: 'FORBIDDEN',
        message: 'forbidden',
      })
    ).toBe(true);

    expect(
      __shouldTriggerReauthForTests('POST', {
        code: 'FORBIDDEN',
        message: 'forbidden',
      })
    ).toBe(false);
  });
});
