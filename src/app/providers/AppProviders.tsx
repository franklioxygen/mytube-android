/**
 * Provider composition: QueryClient → Auth → Theme → Language → Snackbar → children.
 * Plan Phase 1.2.
 */

import React from 'react';
import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { AuthProvider, useAuth } from '../../core/auth/AuthContext';
import { SettingsRepository, settingsQueryKeys } from '../../core/repositories';
import { SnackbarProvider } from './SnackbarProvider';
import { LanguageProvider } from './LanguageProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Transport-layer retry policy is centralized in api/client.ts.
      // Keep React Query retries disabled by default to avoid duplicate retry stacks.
      retry: false,
      staleTime: 60 * 1000,
    },
  },
});

const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#0a7ea4',
    background: '#1a1a1a',
    surface: '#2a2a2a',
  },
};

const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0a7ea4',
    background: '#f5f5f5',
    surface: '#ffffff',
  },
};

type ThemeMode = 'light' | 'dark' | 'system';

function normalizeThemeMode(mode: unknown): ThemeMode {
  if (mode === 'light' || mode === 'dark' || mode === 'system') return mode;
  return 'system';
}

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const { loading, loginRequired, hasValidSession } = useAuth();
  const canLoadSettingsTheme = !loading && (!loginRequired || hasValidSession);

  const settingsQuery = useQuery({
    queryKey: settingsQueryKeys.settings,
    queryFn: () => SettingsRepository.getSettings(),
    enabled: canLoadSettingsTheme,
    retry: false,
    staleTime: 60 * 1000,
  });

  const preferredMode = normalizeThemeMode(settingsQuery.data?.theme);
  const resolvedMode =
    preferredMode === 'system'
      ? systemColorScheme === 'light'
        ? 'light'
        : 'dark'
      : preferredMode;
  const paperTheme = resolvedMode === 'light' ? paperLightTheme : paperDarkTheme;

  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppThemeProvider>
          <LanguageProvider>
            <SnackbarProvider>{children}</SnackbarProvider>
          </LanguageProvider>
        </AppThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
