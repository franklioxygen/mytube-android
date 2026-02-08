/**
 * Settings repository: wraps settings and system endpoints.
 */

import * as settingsEndpoints from '../api/endpoints/settings';
import type { Settings, SystemVersion } from '../../types';
import { queryKeys } from './queryKeys';

export const settingsQueryKeys = {
  settings: queryKeys.settings,
  systemVersion: queryKeys.systemVersion,
};

export const SettingsRepository = {
  getSettings: (): Promise<Settings> => settingsEndpoints.getSettings(),

  updateSettings: (
    payload: Partial<Settings>
  ): Promise<{ success: boolean; settings: Settings }> =>
    settingsEndpoints.updateSettings(payload),

  getSystemVersion: (): Promise<SystemVersion> =>
    settingsEndpoints.getSystemVersion(),
};
