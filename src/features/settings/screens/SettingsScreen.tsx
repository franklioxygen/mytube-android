/**
 * Settings and about: SettingsRepository + React Query, logout.
 * Admin can edit full settings; visitor can edit Cloudflare tunnel keys only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SettingsRepository, settingsQueryKeys } from '../../../core/repositories';
import { useAuth } from '../../../core/auth/AuthContext';
import { canEditSettings, canMutate } from '../../../core/utils/roleGate';
import { useSnackbar, useLanguage } from '../../../app/providers';
import {
  SUPPORTED_LOCALE_CODES,
  LOCALE_LABEL_KEYS,
  normalizeLocaleCode,
  type SupportedLocaleCode,
} from '../../../app/providers/LanguageProvider';
import type { Settings } from '../../../types';

type ThemeValue = 'light' | 'dark' | 'system';

interface SettingsScreenProps {
  onLogout: () => void;
}

export function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { role, loginRequired, logout } = useAuth();
  const queryClient = useQueryClient();
  const { show, showError } = useSnackbar();
  const canEditGeneralSettings = canMutate(role, loginRequired);
  const canEditCloudflareSettings = canEditSettings(
    role,
    ['cloudflaredTunnelEnabled'],
    loginRequired
  );
  const canEditAnySettings = canEditGeneralSettings || canEditCloudflareSettings;

  const [editWebsiteName, setEditWebsiteName] = useState('');
  const [editTheme, setEditTheme] = useState<ThemeValue>('system');
  const [editCloudflaredTunnelEnabled, setEditCloudflaredTunnelEnabled] = useState(false);
  const [editCloudflaredToken, setEditCloudflaredToken] = useState('');
  const [editLanguage, setEditLanguage] = useState<SupportedLocaleCode>(
    normalizeLocaleCode(language)
  );
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  const selectedLanguageCode = canEditGeneralSettings
    ? editLanguage
    : normalizeLocaleCode(language);
  const currentLocaleLabel = t(LOCALE_LABEL_KEYS[selectedLanguageCode]);

  const handleLanguageSelect = useCallback(
    (localeCode: SupportedLocaleCode) => {
      setEditLanguage(localeCode);
      setLanguagePickerVisible(false);
    },
    []
  );

  const settingsQuery = useQuery({
    queryKey: settingsQueryKeys.settings,
    queryFn: () => SettingsRepository.getSettings(),
  });

  const versionQuery = useQuery({
    queryKey: settingsQueryKeys.systemVersion,
    queryFn: () => SettingsRepository.getSystemVersion(),
  });

  const settings = settingsQuery.data ?? null;
  const version = versionQuery.data ?? null;
  const loading = settingsQuery.isLoading && versionQuery.isLoading;
  const error =
    settingsQuery.error ?? versionQuery.error
      ? (settingsQuery.error as { message?: string })?.message ??
        (versionQuery.error as { message?: string })?.message ??
        'Failed to load settings'
      : null;

  useEffect(() => {
    if (settings != null) {
      setEditWebsiteName(settings.websiteName ?? '');
      const nextTheme = settings.theme ?? 'system';
      setEditTheme(
        nextTheme === 'light' || nextTheme === 'dark' || nextTheme === 'system'
          ? nextTheme
          : 'system'
      );
      setEditCloudflaredTunnelEnabled(Boolean(settings.cloudflaredTunnelEnabled));
      setEditCloudflaredToken(
        typeof settings.cloudflaredToken === 'string' ? settings.cloudflaredToken : ''
      );
      setEditLanguage(normalizeLocaleCode(settings.language, normalizeLocaleCode(language)));
    }
  }, [settings, language]);

  const changedPayload = useMemo(() => {
    const payload: Partial<Settings> = {};
    if (settings == null) return payload;

    if (canEditGeneralSettings) {
      const websiteName = editWebsiteName.trim().slice(0, 15);
      if (websiteName !== (settings.websiteName ?? '')) {
        payload.websiteName = websiteName;
      }

      const currentTheme = (
        settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system'
          ? settings.theme
          : 'system'
      ) as ThemeValue;
      if (editTheme !== currentTheme) {
        payload.theme = editTheme;
      }

      const currentLanguage = normalizeLocaleCode(
        settings.language,
        normalizeLocaleCode(language)
      );
      if (editLanguage !== currentLanguage) {
        payload.language = editLanguage;
      }
    }

    if (canEditCloudflareSettings) {
      if (editCloudflaredTunnelEnabled !== Boolean(settings.cloudflaredTunnelEnabled)) {
        payload.cloudflaredTunnelEnabled = editCloudflaredTunnelEnabled;
      }

      const currentCloudflaredToken =
        typeof settings.cloudflaredToken === 'string' ? settings.cloudflaredToken : '';
      if (editCloudflaredToken !== currentCloudflaredToken) {
        payload.cloudflaredToken = editCloudflaredToken;
      }
    }

    return payload;
  }, [
    settings,
    canEditGeneralSettings,
    canEditCloudflareSettings,
    editWebsiteName,
    editTheme,
    editLanguage,
    language,
    editCloudflaredTunnelEnabled,
    editCloudflaredToken,
  ]);

  const changedKeys = useMemo(() => Object.keys(changedPayload), [changedPayload]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Settings>) =>
      SettingsRepository.updateSettings(payload),
    onSuccess: (_response, payload) => {
      if (typeof payload.language === 'string') {
        setLanguage(payload.language);
      }
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.settings });
      show('Settings saved.');
    },
    onError: (err: { message?: string }) => {
      showError(err.message ?? 'Failed to save settings');
    },
  });

  const refetch = useCallback(() => {
    settingsQuery.refetch();
    versionQuery.refetch();
  }, [settingsQuery, versionQuery]);

  const handleLogout = useCallback(async () => {
    await logout();
    onLogout();
  }, [logout, onLogout]);

  const handleSave = useCallback(() => {
    if (changedKeys.length === 0) return;
    if (!canEditSettings(role, changedKeys, loginRequired)) {
      showError('Your role cannot update these settings.');
      return;
    }
    updateMutation.mutate(changedPayload);
  }, [changedKeys, changedPayload, role, loginRequired, showError, updateMutation]);

  const canSave =
    canEditAnySettings &&
    changedKeys.length > 0 &&
    canEditSettings(role, changedKeys, loginRequired) &&
    !updateMutation.isPending;

  if (loading && !settings && !version) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error != null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch}>
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('account')}</Text>
        <Text style={styles.role}>Role: {role ?? '—'}</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>{t('logOut')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('language')}</Text>
        {canEditGeneralSettings ? (
          <TouchableOpacity
            style={styles.languageRow}
            onPress={() => setLanguagePickerVisible(true)}
            accessibilityLabel={t('language')}
            accessibilityRole="button"
          >
            <Text style={styles.row}>{currentLocaleLabel}</Text>
            <Text style={styles.rowHint}>Tap to change</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.languageRow}>
            <Text style={styles.row}>{currentLocaleLabel}</Text>
          </View>
        )}
      </View>

      <Modal
        visible={languagePickerVisible && canEditGeneralSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setLanguagePickerVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t('language')}</Text>
            {SUPPORTED_LOCALE_CODES.map(code => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.modalOption,
                  editLanguage === code && styles.modalOptionActive,
                ]}
                onPress={() => handleLanguageSelect(code)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    editLanguage === code && styles.modalOptionTextActive,
                  ]}
                >
                  {t(LOCALE_LABEL_KEYS[code])}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setLanguagePickerVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {settings != null && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings')}</Text>
          {canEditGeneralSettings ? (
            <>
              <Text style={styles.label}>Website name</Text>
              <TextInput
                style={styles.input}
                value={editWebsiteName}
                onChangeText={setEditWebsiteName}
                maxLength={15}
                placeholder="Website name"
                placeholderTextColor="#888"
              />
              <Text style={styles.label}>Theme</Text>
              <View style={styles.themeRow}>
                {(['light', 'dark', 'system'] as const).map(theme => (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.themeOption,
                      editTheme === theme && styles.themeOptionActive,
                    ]}
                    onPress={() => setEditTheme(theme)}
                  >
                    <Text
                      style={[
                        styles.themeOptionText,
                        editTheme === theme && styles.themeOptionTextActive,
                      ]}
                    >
                      {theme}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              {settings.websiteName != null && (
                <Text style={styles.row}>{settings.websiteName}</Text>
              )}
              {settings.theme != null && (
                <Text style={styles.row}>Theme: {settings.theme}</Text>
              )}
            </>
          )}

          {canEditCloudflareSettings && (
            <>
              <Text style={styles.subsectionTitle}>Cloudflare tunnel</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Tunnel enabled</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    editCloudflaredTunnelEnabled && styles.toggleButtonActive,
                  ]}
                  onPress={() => setEditCloudflaredTunnelEnabled(v => !v)}
                  accessibilityLabel="Toggle cloudflared tunnel"
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      editCloudflaredTunnelEnabled && styles.toggleButtonTextActive,
                    ]}
                  >
                    {editCloudflaredTunnelEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Cloudflared token</Text>
              <TextInput
                style={styles.input}
                value={editCloudflaredToken}
                onChangeText={setEditCloudflaredToken}
                placeholder="Cloudflared token"
                placeholderTextColor="#888"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          {canEditAnySettings && (
            <>
              {updateMutation.isError && (
                <Text style={styles.inlineError}>
                  {(updateMutation.error as { message?: string }).message}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!canSave}
                accessibilityLabel="Save settings"
              >
                <Text style={styles.saveButtonText}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {version != null && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about')}</Text>
          <Text style={styles.row}>Current: {version.currentVersion}</Text>
          <Text style={styles.row}>Latest: {version.latestVersion}</Text>
          {version.hasUpdate && version.releaseUrl && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => Linking.openURL(version.releaseUrl)}
            >
              <Text style={styles.linkText}>Open release</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },
  errorBanner: {
    backgroundColor: '#332222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#f66',
    marginBottom: 8,
  },
  retryLink: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
  },
  rowHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  languageRow: {
    marginBottom: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#333',
  },
  modalOptionActive: {
    backgroundColor: '#0a7ea4',
  },
  modalOptionText: {
    color: '#ccc',
    fontSize: 16,
  },
  modalOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
  },
  label: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 6,
  },
  subsectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  themeOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  themeOptionActive: {
    backgroundColor: '#0a7ea4',
  },
  themeOptionText: {
    color: '#ccc',
    fontSize: 14,
  },
  themeOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleLabel: {
    color: '#ccc',
    fontSize: 14,
    marginRight: 12,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  toggleButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  toggleButtonText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  inlineError: {
    color: '#f66',
    fontSize: 13,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#0a7ea4',
    padding: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  saveButtonDisabled: {
    backgroundColor: '#444',
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  role: {
    color: '#aaa',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#333',
    padding: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 8,
  },
  linkText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
});
