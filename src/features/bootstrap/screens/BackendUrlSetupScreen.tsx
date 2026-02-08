import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { normalizeApiBaseUrl } from '../../../core/utils/env';

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
  const normalized = useMemo(() => normalizeApiBaseUrl(inputValue), [inputValue]);
  const hasError = touched && normalized.length === 0;

  const handleSave = () => {
    setTouched(true);
    if (normalized.length === 0) return;
    onSave(normalized);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Set Backend URL</Text>
        <Text style={styles.subtitle}>
          Enter your backend API URL to continue.
        </Text>
        <TextInput
          style={[styles.input, hasError && styles.inputError]}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="https://example.com/api"
          placeholderTextColor="#777"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {hasError && (
          <Text style={styles.errorText}>
            Enter a valid URL like `http://host:5551/api` or `https://host/api`.
          </Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save and Continue</Text>
        </TouchableOpacity>
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
  card: {
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#bbb',
    fontSize: 14,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#4a4a4a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: '#222',
  },
  inputError: {
    borderColor: '#cc6666',
  },
  errorText: {
    marginTop: 8,
    color: '#ff9c9c',
    fontSize: 12,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
