/**
 * Global Snackbar/Toast provider using React Native Paper Snackbar.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Snackbar } from 'react-native-paper';
import { StyleSheet } from 'react-native';

interface SnackbarContextValue {
  show: (message: string, options?: { duration?: number }) => void;
  showError: (message: string) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState(3000);

  const show = useCallback((msg: string, options?: { duration?: number }) => {
    setMessage(msg);
    setDuration(options?.duration ?? 3000);
    setVisible(true);
  }, []);

  const showError = useCallback((msg: string) => {
    show(msg, { duration: 5000 });
  }, [show]);

  const onDismiss = useCallback(() => setVisible(false), []);

  const value: SnackbarContextValue = { show, showError };

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        duration={duration}
        style={styles.snackbar}
      >
        {message}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}

const styles = StyleSheet.create({
  snackbar: {
    backgroundColor: '#333',
  },
});
