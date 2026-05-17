/**
 * Shared settings query hook. Centralizes config so providers and screens
 * cannot drift on staleTime/retry/enabled semantics for the settings cache.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { SettingsRepository, settingsQueryKeys } from './settingsRepository';
import type { Settings } from '../../types';

export interface UseSettingsQueryOptions {
  enabled?: boolean;
}

export function useSettingsQuery(
  options: UseSettingsQueryOptions = {}
): UseQueryResult<Settings, unknown> {
  return useQuery({
    queryKey: settingsQueryKeys.settings,
    queryFn: () => SettingsRepository.getSettings(),
    enabled: options.enabled ?? true,
    retry: false,
    staleTime: 60 * 1000,
  });
}
