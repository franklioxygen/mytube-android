import { parseApiError, shouldRetry } from '../../../src/core/api/errors';

describe('parseApiError', () => {
  test('maps network failures when no response body is present', () => {
    const error = parseApiError(0, null, 'Request timeout');
    expect(error.code).toBe('NETWORK');
    expect(error.message).toBe('Request timeout');
    expect(error.httpStatus).toBeUndefined();
  });

  test('honors body statusCode on auth endpoints returning HTTP 200', () => {
    const error = parseApiError(200, {
      success: false,
      message: 'Too many attempts',
      statusCode: 429,
      waitTime: 120000,
    });

    expect(error.code).toBe('RATE_LIMIT');
    expect(error.httpStatus).toBe(429);
    expect(error.waitTimeMs).toBe(120000);
    expect(error.message).toBe('Too many attempts');
  });

  test('maps backend type and recoverable flags', () => {
    const error = parseApiError(409, {
      error: 'Duplicate',
      type: 'duplicate',
      recoverable: true,
    });

    expect(error.code).toBe('CONFLICT');
    expect(error.backendType).toBe('duplicate');
    expect(error.recoverable).toBe(true);
  });

  test('parses Retry-After seconds into retryAfterMs', () => {
    const error = parseApiError(
      429,
      { error: 'Too many requests' },
      undefined,
      '120'
    );
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.retryAfterMs).toBe(120000);
  });
});

describe('shouldRetry', () => {
  test('retries network and 5xx errors only', () => {
    expect(
      shouldRetry({
        code: 'NETWORK',
        message: 'offline',
      })
    ).toBe(true);

    expect(
      shouldRetry({
        code: 'SERVER',
        httpStatus: 503,
        message: 'down',
      })
    ).toBe(true);

    expect(
      shouldRetry({
        code: 'UNAUTHENTICATED',
        httpStatus: 401,
        message: 'auth',
      })
    ).toBe(false);

    expect(
      shouldRetry({
        code: 'RATE_LIMIT',
        httpStatus: 429,
        message: 'slow down',
      })
    ).toBe(false);
  });
});
