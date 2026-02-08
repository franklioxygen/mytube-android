/**
 * Normalized client error model per 04-error-handling.md.
 */

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'SERVER'
  | 'NETWORK'
  | 'UNKNOWN';

export interface AppError {
  code: AppErrorCode;
  httpStatus?: number;
  message: string;
  backendType?: string;
  recoverable?: boolean;
  waitTimeMs?: number;
  retryAfterMs?: number;
  raw?: unknown;
}

interface ErrorBody {
  success?: boolean;
  error?: string;
  message?: string;
  statusCode?: number;
  type?: string;
  recoverable?: boolean;
  waitTime?: number;
}

function mapStatusToCode(status: number): AppErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMIT';
    case 400:
      return 'VALIDATION';
    default:
      if (status >= 500) return 'SERVER';
      return 'UNKNOWN';
  }
}

function getMessage(body: ErrorBody, fallback: string): string {
  return body?.error ?? body?.message ?? fallback;
}

function parseRetryAfterMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 1000);
  }

  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.round(numeric * 1000);
  }

  const at = Date.parse(text);
  if (Number.isNaN(at)) return undefined;

  const deltaMs = at - Date.now();
  if (deltaMs <= 0) return 0;
  return Math.round(deltaMs);
}

/**
 * Parse API error response into AppError.
 * If body has success === false and statusCode, use statusCode as effective HTTP status.
 */
export function parseApiError(
  httpStatus: number,
  body: unknown,
  networkMessage?: string,
  retryAfter?: unknown
): AppError {
  const retryAfterMs = parseRetryAfterMs(retryAfter);

  if (body == null && networkMessage) {
    return {
      code: 'NETWORK',
      message: networkMessage,
      retryAfterMs,
      raw: undefined,
    };
  }

  const b = (body ?? {}) as ErrorBody;
  const effectiveStatus =
    b.success === false && typeof b.statusCode === 'number'
      ? b.statusCode
      : httpStatus;
  const code = mapStatusToCode(effectiveStatus);
  const message = getMessage(b, `Request failed (${effectiveStatus})`);

  return {
    code,
    httpStatus: effectiveStatus,
    message,
    backendType: b.type,
    recoverable: b.recoverable,
    waitTimeMs: typeof b.waitTime === 'number' ? b.waitTime : undefined,
    retryAfterMs,
    raw: body,
  };
}

/** Status codes that should not be auto-retried. */
export const NO_RETRY_STATUSES = [400, 401, 403, 404, 409, 429];

export function shouldRetry(error: AppError): boolean {
  if (error.code === 'NETWORK') return true;
  if (error.code === 'SERVER' && error.httpStatus && error.httpStatus >= 500)
    return true;
  if (error.httpStatus && NO_RETRY_STATUSES.includes(error.httpStatus))
    return false;
  return false;
}
