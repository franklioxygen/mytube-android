/**
 * Polling helpers aligned with 06-state-and-polling.md recommendations.
 */

import type { AppError } from '../api/client';

const BACKOFF_STEPS_MS = [2000, 5000, 10000, 20000, 60000];

export function getPollingRetryDelayMs(attempt: number): number {
  const index = Math.max(0, Math.min(BACKOFF_STEPS_MS.length - 1, attempt));
  return BACKOFF_STEPS_MS[index];
}

/** Add +/-20% jitter to avoid synchronized client bursts. */
export function getJitteredIntervalMs(baseMs: number): number {
  const factor = 0.8 + Math.random() * 0.4;
  return Math.max(1000, Math.round(baseMs * factor));
}

/**
 * 04-error-handling.md:
 * - auto-retry only transient network/server failures
 * - do not auto-retry 400/401/403/404/409/429
 */
export function shouldRetryPollingError(error: AppError | null): boolean {
  if (error == null) return true;
  return error.code === 'NETWORK' || error.code === 'SERVER';
}
