/**
 * MyTube React Native app root.
 * Composes providers and navigation per plan Phase 1.2.
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders, queryClient } from './providers';
import { RootNavigator } from './navigation/RootNavigator';
import { API_BASE_URL } from '../core/utils/env';
import {
  getStoredBackendApiUrl,
  setStoredBackendApiUrl,
} from '../core/config/backendUrlStorage';
import { setRuntimeApiBaseUrl } from '../core/api/runtimeBaseUrl';
import { resetBackend } from '../core/config/resetBackend';
import { BackendUrlSetupScreen } from '../features/bootstrap/screens/BackendUrlSetupScreen';

const bootstrappedBackendUrl = getStoredBackendApiUrl();
if (bootstrappedBackendUrl != null) {
  setRuntimeApiBaseUrl(bootstrappedBackendUrl);
}

export default function App() {
  const [backendApiUrl, setBackendApiUrl] = React.useState<string | null>(
    bootstrappedBackendUrl
  );
  const [suggestedUrl, setSuggestedUrl] = React.useState(
    bootstrappedBackendUrl ?? API_BASE_URL
  );

  const handleSaveBackendUrl = React.useCallback((url: string) => {
    setStoredBackendApiUrl(url);
    setRuntimeApiBaseUrl(url);
    setBackendApiUrl(url);
    setSuggestedUrl(url);
  }, []);

  const handleChangeBackendUrl = React.useCallback(() => {
    resetBackend(queryClient);
    setBackendApiUrl(null);
    // suggestedUrl keeps the last entered value so the user can edit it
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      {backendApiUrl == null ? (
        <BackendUrlSetupScreen
          suggestedUrl={suggestedUrl}
          onSave={handleSaveBackendUrl}
        />
      ) : (
        <AppProviders>
          <RootNavigator onRequestChangeBackendUrl={handleChangeBackendUrl} />
        </AppProviders>
      )}
    </SafeAreaProvider>
  );
}
