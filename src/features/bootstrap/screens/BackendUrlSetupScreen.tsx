import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { normalizeApiBaseUrl } from '../../../core/utils/env';

const CYAN = '#00d9ff';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

interface BackendUrlSetupScreenProps {
  suggestedUrl: string;
  onSave: (url: string) => void;
}

export function BackendUrlSetupScreen({
  suggestedUrl,
  onSave,
}: BackendUrlSetupScreenProps) {
  const [inputValue, setInputValue] = useState(suggestedUrl);
  const [touched, setTouched] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState('');
  const normalized = useMemo(() => normalizeApiBaseUrl(inputValue), [inputValue]);
  const hasError = touched && normalized.length === 0;
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setTestState('idle');
    setTestMessage('');
  };

  const handleTest = async () => {
    setTouched(true);
    if (normalized.length === 0) return;
    setTestState('testing');
    setTestMessage('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(normalized + '/settings/password-enabled', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok || res.status === 401 || res.status === 403) {
        // 401/403 means the server is reachable but requires auth — that's fine
        setTestState('ok');
        setTestMessage('Server reachable!');
      } else {
        setTestState('fail');
        setTestMessage(`Server returned HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestState('fail');
      setTestMessage(
        msg.includes('aborted') ? 'Timed out — check the URL and server.' : `Cannot reach server: ${msg}`
      );
    }
  };

  const handleSave = () => {
    setTouched(true);
    if (normalized.length === 0) return;
    onSave(normalized);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.inner, isTablet && styles.innerTablet]}>

          {/* Logo + app name */}
          <View style={styles.logoRow}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.appName}>MyTube</Text>
          </View>

          {/* Heading */}
          <View style={styles.headingRow}>
            <Text style={styles.headingIcon}>⚙</Text>
            <Text style={styles.headingText}>Backend URL</Text>
          </View>

          <Text style={styles.subtitle}>
            Enter your backend API URL to continue.
          </Text>

          {/* URL input */}
          <View style={[styles.inputWrapper, hasError && styles.inputWrapperError]}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={handleInputChange}
              placeholder="https://example.com/api"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {hasError && (
            <Text style={styles.errorText}>
              Enter a valid URL like `http://host:5551/api` or `https://host/api`.
            </Text>
          )}

          {/* Test result */}
          {testState !== 'idle' && (
            <View style={[
              styles.testResult,
              testState === 'ok' && styles.testResultOk,
              testState === 'fail' && styles.testResultFail,
            ]}>
              {testState === 'testing' ? (
                <ActivityIndicator size="small" color={CYAN} />
              ) : (
                <Text style={[
                  styles.testResultText,
                  testState === 'ok' && styles.testResultTextOk,
                  testState === 'fail' && styles.testResultTextFail,
                ]}>
                  {testState === 'ok' ? '✓ ' : '✗ '}{testMessage}
                </Text>
              )}
            </View>
          )}

          {/* Button row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.testButton, !inputValue.trim() && styles.testButtonDisabled]}
              onPress={handleTest}
              activeOpacity={0.8}
              disabled={testState === 'testing'}
            >
              {testState === 'testing' ? (
                <ActivityIndicator size="small" color={CYAN} />
              ) : (
                <Text style={styles.testButtonText}>Test</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, !inputValue.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Save and Continue</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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

  // Logo
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
    marginBottom: 12,
    gap: 10,
  },
  headingIcon: {
    fontSize: 24,
  },
  headingText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },

  subtitle: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
  },

  // Input
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    backgroundColor: '#0d0d0d',
    marginBottom: 8,
  },
  inputWrapperError: {
    borderColor: '#f66',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#fff',
  },
  errorText: {
    color: '#f66',
    fontSize: 12,
    marginBottom: 8,
  },

  // Test result
  testResult: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: '#111',
  },
  testResultOk: {
    backgroundColor: '#0d2a1a',
  },
  testResultFail: {
    backgroundColor: '#2a0d0d',
  },
  testResultText: {
    fontSize: 13,
    color: '#aaa',
  },
  testResultTextOk: {
    color: '#4caf50',
  },
  testResultTextFail: {
    color: '#f66',
  },

  // Button row
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },

  // Test button
  testButton: {
    borderWidth: 1.5,
    borderColor: CYAN,
    borderRadius: 50,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  testButtonDisabled: {
    opacity: 0.4,
  },
  testButtonText: {
    color: CYAN,
    fontSize: 17,
    fontWeight: '700',
  },

  // Save button
  saveButton: {
    flex: 1,
    backgroundColor: CYAN,
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
