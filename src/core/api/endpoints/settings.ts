/**
 * Settings and system endpoints per 01-api-overview.md.
 */

import { apiGet, apiPost } from '../client';
import { buildInFlightKey } from '../inFlight';
import type { Settings, SystemVersion } from '../../../types';

export function getSettings(): Promise<Settings> {
  return apiGet<Settings>('/settings');
}

export function updateSettings(payload: Partial<Settings>): Promise<{ success: boolean; settings: Settings }> {
  const path = '/settings';
  return apiPost<{ success: boolean; settings: Settings }>(
    path,
    payload,
    buildInFlightKey('POST', path)
  );
}

export function getSystemVersion(): Promise<SystemVersion> {
  return apiGet<SystemVersion>('/system/version');
}
