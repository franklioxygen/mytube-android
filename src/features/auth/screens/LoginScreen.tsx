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
  useWindowDimensions,
  Image,
  ScrollView,
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
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

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
  const [showPassword, setShowPassword] = useState(false);
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
  const websiteName = passwordEnabled?.websiteName ?? 'MyTube';

  const showPasskeyButton =
    passkeyStatusLoaded && hasPasskeys && passkeySupported;
  const showPasskeyUnsupported =
    passkeyStatusLoaded && hasPasskeys && !passkeySupported;
  const showSecondarySection =
    showPasskeyButton || showPasskeyUnsupported || onChangeBackendUrl != null;

  if (authConfigLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={CYAN} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isTablet && styles.scrollTablet,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.inner, isTablet && styles.innerTablet]}>

          {/* Logo + App name */}
          <View style={styles.logoRow}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.appName}>{websiteName}</Text>
          </View>

          {/* Sign in heading */}
          <View style={styles.headingRow}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.headingText}>Sign in</Text>
          </View>

          {/* Tabs */}
          {visitorEnabled && (
            <View style={styles.tabs}>
              <TouchableOpacity
                style={styles.tab}
                onPress={() => setMode('admin')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, mode === 'admin' && styles.tabTextActive]}>
                  ADMIN
                </Text>
                {mode === 'admin' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tab}
                onPress={() => setMode('visitor')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, mode === 'visitor' && styles.tabTextActive]}>
                  VISITOR USER
                </Text>
                {mode === 'visitor' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            </View>
          )}

          {passwordAllowed ? (
            <>
              {/* Password input */}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Password *"
                  placeholderTextColor="#555"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={countdown === 0}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              {error != null && (
                <Text style={styles.errorText}>{error.message}</Text>
              )}

              {countdown > 0 && (
                <Text style={styles.countdownText}>Retry in {countdown}s</Text>
              )}

              {/* Sign in button */}
              <TouchableOpacity
                style={[
                  styles.signInButton,
                  (countdown > 0 || submitting || !password.trim()) && styles.signInButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={countdown > 0 || submitting || !password.trim()}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.signInButtonText}>Sign in</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.hint}>Password login is disabled on this server.</Text>
          )}

          {/* Secondary actions */}
          {showSecondarySection && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {showPasskeyButton && (
                <TouchableOpacity
                  style={[styles.outlinedButton, passkeyLoading && styles.outlinedButtonDisabled]}
                  onPress={handlePasskeyPress}
                  disabled={passkeyLoading}
                  activeOpacity={0.7}
                >
                  {passkeyLoading ? (
                    <ActivityIndicator color={CYAN} size="small" />
                  ) : (
                    <>
                      <Text style={styles.outlinedButtonIcon}>🖐</Text>
                      <Text style={styles.outlinedButtonText}>Login with Passkey</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {showPasskeyUnsupported && (
                <Text style={styles.hint}>
                  Passkeys are enabled on this server, but this app/runtime does not support passkeys.
                </Text>
              )}

              {onChangeBackendUrl != null && (
                <TouchableOpacity
                  style={styles.outlinedButton}
                  onPress={onChangeBackendUrl}
                  activeOpacity={0.7}
                >
                  <Text style={styles.outlinedButtonIcon}>⚙</Text>
                  <Text style={styles.outlinedButtonText}>Change Backend URL</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const CYAN = '#00d9ff';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  scrollTablet: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
  innerTablet: {
    maxWidth: 480,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },

  // Logo + app name
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 10,
  },
  logoImg: {
    width: 48,
    height: 48,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },

  // Heading
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    gap: 10,
  },
  lockIcon: {
    fontSize: 24,
  },
  headingText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 12,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: CYAN,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: CYAN,
    borderRadius: 1,
  },

  // Password input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#0d0d0d',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
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

  // Sign in button
  signInButton: {
    backgroundColor: CYAN,
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  signInButtonDisabled: {
    opacity: 0.5,
  },
  signInButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // OR divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#222',
  },
  dividerText: {
    color: '#555',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // Outlined buttons (passkey, backend url)
  outlinedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 10,
  },
  outlinedButtonDisabled: {
    opacity: 0.5,
  },
  outlinedButtonIcon: {
    fontSize: 18,
  },
  outlinedButtonText: {
    color: CYAN,
    fontSize: 15,
    fontWeight: '600',
  },

  hint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
