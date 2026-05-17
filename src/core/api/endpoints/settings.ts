/**
 * Settings and system endpoints per 01-api-overview.md.
 */

import { apiGet, apiPatch } from '../client';
import { buildInFlightKey } from '../inFlight';
import { SettingsSchema, parseWithSchema } from '../schemas';
import type { Settings, SystemVersion } from '../../../types';

export async function getSettings(): Promise<Settings> {
  const raw = await apiGet<Settings>('/settings');
  return parseWithSchema(SettingsSchema, raw, 'getSettings') as Settings;
}

export async function updateSettings(
  payload: Partial<Settings>
): Promise<{ success: boolean; settings: Settings }> {
  const path = '/settings';
  const raw = await apiPatch<{ success: boolean; settings: Settings }>(
    path,
    payload,
    buildInFlightKey('PATCH', path)
  );
  return {
    success: raw.success,
    settings: parseWithSchema(
      SettingsSchema,
      raw.settings,
      'updateSettings'
    ) as Settings,
  };
}

export function getSystemVersion(): Promise<SystemVersion> {
  return apiGet<SystemVersion>('/system/version');
}
