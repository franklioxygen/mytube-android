/**
 * HTTP client with credentials for cookie-based session.
 * Plan Phase 2.2: baseURL, timeout, retry, cookie (withCredentials), ApiError, 401/429 handling.
 * Per 02-auth-session.md: withCredentials: true.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_TIMEOUT_MS } from '../utils/env';
import { parseApiError, AppError, shouldRetry } from './errors';
import { unwrap } from './unwrap';
import type { RawApiResult } from './unwrap';
import { withInFlightKey } from './inFlight';
import { getRuntimeApiBaseUrl } from './runtimeBaseUrl';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const api = axios.create({
  baseURL: getRuntimeApiBaseUrl(),
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function getRetryAfterHeader(
  response: AxiosError['response']
): unknown {
  const headers = response?.headers;
  if (!headers) return undefined;

  const withGet = headers as { get?: (name: string) => unknown };
  if (typeof withGet.get === 'function') {
    return withGet.get('retry-after');
  }

  const record = headers as Record<string, unknown>;
  return record['retry-after'] ?? record['Retry-After'];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableMethod(method: string | undefined): boolean {
  if (typeof method !== 'string') return false;
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod.length === 0) return false;
  return RETRYABLE_METHODS.has(normalizedMethod);
}

function shouldTriggerReauth(
  method: string | undefined,
  appError: AppError
): boolean {
  if (appError.code === 'UNAUTHENTICATED') return true;
  // 06-state-and-polling.md requires 401/403 auth-state handling for polling/read flows.
  if (appError.code === 'FORBIDDEN' && isRetryableMethod(method)) return true;
  return false;
}

api.interceptors.request.use(config => {
  config.baseURL = getRuntimeApiBaseUrl();
  return config;
});

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = (error.config ?? null) as (InternalAxiosRequestConfig & {
      _retryCount?: number;
    }) | null;
    if (!config) {
      const fallbackError = parseApiError(
        error.response?.status ?? 0,
        error.response?.data,
        error.message || 'Network error',
        getRetryAfterHeader(error.response)
      );
      if (fallbackError.code === 'UNAUTHENTICATED') onUnauthorized?.();
      return Promise.reject(fallbackError);
    }
    const retryCount = config._retryCount ?? 0;

    const httpStatus = error.response?.status ?? 0;
    const body = error.response?.data;
    const networkMessage =
      error.code === 'ECONNABORTED'
        ? 'Request timeout'
        : error.message || 'Network error';

    const appError = parseApiError(
      httpStatus,
      body,
      error.response ? undefined : networkMessage,
      getRetryAfterHeader(error.response)
    );

    if (
      retryCount < MAX_RETRIES &&
      isRetryableMethod(config.method) &&
      shouldRetry(appError)
    ) {
      config._retryCount = retryCount + 1;
      await delay(RETRY_DELAY_MS * (retryCount + 1));
      return api.request(config);
    }

    if (shouldTriggerReauth(config.method, appError)) {
      onUnauthorized?.();
    }

    return Promise.reject(appError);
  }
);

/** Typed get; throws AppError on failure. */
export async function apiGet<T>(url: string): Promise<T> {
  const res = await api.get<RawApiResult<T>>(url);
  return unwrap(res.data);
}

/** Typed post; throws AppError on failure. */
export async function apiPost<T>(
  url: string,
  data?: unknown,
  inFlightKey?: string
): Promise<T> {
  const runRequest = async (): Promise<T> => {
    const res = await api.post<RawApiResult<T>>(url, data);
    return unwrap(res.data);
  };
  if (inFlightKey == null) return runRequest();
  return withInFlightKey(inFlightKey, runRequest);
}

/** Typed put; throws AppError on failure. */
export async function apiPut<T>(
  url: string,
  data?: unknown,
  inFlightKey?: string
): Promise<T> {
  const runRequest = async (): Promise<T> => {
    const res = await api.put<RawApiResult<T>>(url, data);
    return unwrap(res.data);
  };
  if (inFlightKey == null) return runRequest();
  return withInFlightKey(inFlightKey, runRequest);
}

/** Typed patch; throws AppError on failure. */
export async function apiPatch<T>(
  url: string,
  data?: unknown,
  inFlightKey?: string
): Promise<T> {
  const runRequest = async (): Promise<T> => {
    const res = await api.patch<RawApiResult<T>>(url, data);
    return unwrap(res.data);
  };
  if (inFlightKey == null) return runRequest();
  return withInFlightKey(inFlightKey, runRequest);
}

/** Typed delete; throws AppError on failure. */
export async function apiDelete<T>(
  url: string,
  inFlightKey?: string
): Promise<T> {
  const runRequest = async (): Promise<T> => {
    const res = await api.delete<RawApiResult<T>>(url);
    return unwrap(res.data);
  };
  if (inFlightKey == null) return runRequest();
  return withInFlightKey(inFlightKey, runRequest);
}

export type { AppError };

// Test-only helper.
export function __isRetryableMethodForTests(
  method: string | undefined
): boolean {
  return isRetryableMethod(method);
}

export function __shouldTriggerReauthForTests(
  method: string | undefined,
  appError: AppError
): boolean {
  return shouldTriggerReauth(method, appError);
}
