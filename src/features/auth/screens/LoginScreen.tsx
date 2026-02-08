/**
 * Login screen: password (admin/visitor) and passkey (when runtime supports it).
 * Per 02-auth-session.md, 04-error-handling.md (waitTime countdown). Phase 10 i18n.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../../../core/auth/AuthContext';
import {
  createPasskeyAssertion,
  isPasskeyClientError,
  isPasskeySupported,
} from '../../../core/auth/passkey';
import { AuthRepository } from '../../../core/repositories';

type LoginMode = 'admin' | 'visitor';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onChangeBackendUrl?: () => void;
}

export function LoginScreen({ onLoginSuccess, onChangeBackendUrl }: LoginScreenProps) {
  const { t } = useTranslation();
  const {
    role,
    passwordEnabled,
    loading: authConfigLoading,
    error,
    waitTimeMs,
    loginAsAdmin,
    loginAsVisitor,
    startPasskeyAuth,
    loginWithPasskey,
    clearError,
  } = useAuth();

  const [mode, setMode] = useState<LoginMode>('admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [hasPasskeys, setHasPasskeys] = useState<boolean>(false);
  const [passkeyStatusLoaded, setPasskeyStatusLoaded] = useState(false);
  const passkeySupported = isPasskeySupported();

  useEffect(() => {
    if (role) onLoginSuccess();
  }, [role, onLoginSuccess]);

  useEffect(() => {
    if (waitTimeMs == null || waitTimeMs <= 0) return;
    const next = Math.ceil(waitTimeMs / 1000);
    setCountdown(prev => Math.max(prev, next));
  }, [waitTimeMs]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timerId = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [countdown]);

  useEffect(() => {
    let cancelled = false;
    const loadCooldown = async () => {
      try {
        const res = await AuthRepository.getResetPasswordCooldown();
        if (!cancelled && typeof res.cooldown === 'number' && res.cooldown > 0) {
          const next = Math.ceil(res.cooldown / 1000);
          setCountdown(prev => Math.max(prev, next));
        }
      } catch {
        // Endpoint is optional for UX; ignore errors.
      }
    };
    loadCooldown();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadPasskeysStatus = async () => {
      try {
        const res = await AuthRepository.getPasskeysExists();
        if (!isCancelled) {
          setHasPasskeys(!!res.exists);
        }
      } catch {
        if (!isCancelled) {
          setHasPasskeys(false);
        }
      } finally {
        if (!isCancelled) {
          setPasskeyStatusLoaded(true);
        }
      }
    };

    loadPasskeysStatus();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handlePasskeyPress = useCallback(async () => {
    if (!passkeySupported) {
      Alert.alert('Passkey sign-in', 'Passkey is not supported in this app/runtime.');
      return;
    }
    setPasskeyLoading(true);
    clearError();
    try {
      const begin = await startPasskeyAuth();
      const assertion = await createPasskeyAssertion(begin.options);
      const ok = await loginWithPasskey(assertion, begin.challenge);
      if (ok) {
        onLoginSuccess();
      } else {
        Alert.alert('Passkey sign-in failed', 'Please try again.');
      }
    } catch (e) {
      if (isPasskeyClientError(e)) {
        Alert.alert('Passkey sign-in', e.message);
      } else {
        const err = e as { message?: string };
        Alert.alert('Passkey error', err.message ?? 'Could not complete passkey sign-in');
      }
    } finally {
      setPasskeyLoading(false);
    }
  }, [startPasskeyAuth, loginWithPasskey, onLoginSuccess, clearError, passkeySupported]);

  const handleSubmit = async () => {
    if (!password.trim() || countdown > 0) return;
    setSubmitting(true);
    clearError();
    const ok =
      mode === 'admin'
        ? await loginAsAdmin(password)
        : await loginAsVisitor(password);
    setSubmitting(false);
    if (ok) onLoginSuccess();
  };

  const visitorEnabled =
    passwordEnabled?.visitorUserEnabled ?? passwordEnabled?.isVisitorPasswordSet ?? false;
  const passwordAllowed =
    passwordEnabled?.passwordLoginAllowed ?? passwordEnabled?.enabled ?? true;

  if (authConfigLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          {passwordEnabled?.websiteName ?? 'MyTube'}
        </Text>
        <Text style={styles.subtitle}>Sign in</Text>

        {passwordAllowed ? (
          <>
            {visitorEnabled && (
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, mode === 'admin' && styles.tabActive]}
                  onPress={() => setMode('admin')}
                >
                  <Text style={mode === 'admin' ? styles.tabTextActive : styles.tabText}>
                    Admin
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, mode === 'visitor' && styles.tabActive]}
                  onPress={() => setMode('visitor')}
                >
                  <Text style={mode === 'visitor' ? styles.tabTextActive : styles.tabText}>
                    Visitor
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={countdown === 0}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {error != null && (
              <Text style={styles.errorText}>{error.message}</Text>
            )}

            {countdown > 0 && (
              <Text style={styles.countdownText}>
                Retry in {countdown}s
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                (countdown > 0 || submitting || !password.trim()) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={countdown > 0 || submitting || !password.trim()}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.hint}>
            Password login is disabled on this server.
          </Text>
        )}

        {passkeyStatusLoaded && hasPasskeys && passkeySupported && (
          <>
            <TouchableOpacity
              style={[styles.passkeyButton, passkeyLoading && styles.buttonDisabled]}
              onPress={handlePasskeyPress}
              disabled={passkeyLoading}
            >
              {passkeyLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign in with passkey</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Use a passkey-capable runtime/device to continue.
            </Text>
          </>
        )}
        {passkeyStatusLoaded && hasPasskeys && !passkeySupported && (
          <Text style={styles.hint}>
            Passkeys are enabled on this server, but this app/runtime does not support passkeys.
          </Text>
        )}
        {onChangeBackendUrl != null && (
          <TouchableOpacity style={styles.linkButton} onPress={onChangeBackendUrl}>
            <Text style={styles.linkText}>Change backend URL</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#1a1a1a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },
  card: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#333',
  },
  tabActive: {
    backgroundColor: '#444',
    borderWidth: 1,
    borderColor: '#666',
  },
  tabText: {
    color: '#aaa',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  errorText: {
    color: '#f66',
    marginBottom: 8,
    fontSize: 14,
  },
  countdownText: {
    color: '#fa0',
    marginBottom: 8,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  passkeyButton: {
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#666',
  },
  hint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  linkButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#6cc1e2',
    fontWeight: '600',
  },
});
