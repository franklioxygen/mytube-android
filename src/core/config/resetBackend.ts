/**
 * Centralized backend reset: attempts to invalidate the current backend
 * session, then clears stored URL, role, runtime base URL, and the React
 * Query cache so a fresh backend can never see stale data tied to the
 * previous one.
 */

import type { QueryClient } from '@tanstack/react-query';
import { bestEffortLogoutFromBaseUrl } from '../api/endpoints/auth';
import {
  getRuntimeApiBaseUrl,
  setRuntimeApiBaseUrl,
} from '../api/runtimeBaseUrl';
import { setStoredBackendApiUrl } from './backendUrlStorage';
import { setStoredRole } from '../auth/roleStorage';
import { API_BASE_URL } from '../utils/env';

export function resetBackend(queryClient: QueryClient): void {
  const previousBaseUrl = getRuntimeApiBaseUrl();
  bestEffortLogoutFromBaseUrl(previousBaseUrl);

  try {
    setStoredBackendApiUrl(null);
  } catch {
    // ignore storage failure
  }
  try {
    setStoredRole(null);
  } catch {
    // ignore storage failure
  }
  setRuntimeApiBaseUrl(API_BASE_URL);
  queryClient.clear();
}
