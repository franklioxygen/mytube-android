/**
 * Settings and system endpoints per 01-api-overview.md.
 */

import { apiGet, apiPatch } from '../client';
import { buildInFlightKey } from '../inFlight';
import type { Settings, SystemVersion } from '../../../types';

export function getSettings(): Promise<Settings> {
  return apiGet<Settings>('/settings');
}

export function updateSettings(payload: Partial<Settings>): Promise<{ success: boolean; settings: Settings }> {
  const path = '/settings';
  return apiPatch<{ success: boolean; settings: Settings }>(
    path,
    payload,
    buildInFlightKey('PATCH', path)
  );
}

export function getSystemVersion(): Promise<SystemVersion> {
  return apiGet<SystemVersion>('/system/version');
}
