/**
 * i18n Language provider. Phase 10 + Language picker: keys, es locale, display names.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useAuth } from '../../core/auth/AuthContext';
import { SettingsRepository, settingsQueryKeys } from '../../core/repositories';

const enTranslation = {
  appName: 'MyTube',
  home: 'Videos',
  downloads: 'Downloads',
  subscriptions: 'Subscriptions',
  collections: 'Collections',
  settings: 'Settings',
  video: 'Video',
  collection: 'Collection',
  author: 'Author',
  manage: 'Manage',
  search: 'Search',
  instruction: 'Instruction',
  account: 'Account',
  about: 'About',
  logOut: 'Log out',
  loading: 'Loading…',
  language: 'Language',
  languageEn: 'English',
  languageEs: 'Español',
};

const esTranslation = {
  appName: 'MyTube',
  home: 'Vídeos',
  downloads: 'Descargas',
  subscriptions: 'Suscripciones',
  collections: 'Colecciones',
  settings: 'Ajustes',
  video: 'Vídeo',
  collection: 'Colección',
  author: 'Autor',
  manage: 'Gestionar',
  search: 'Buscar',
  instruction: 'Instrucción',
  account: 'Cuenta',
  about: 'Acerca de',
  logOut: 'Cerrar sesión',
  loading: 'Cargando…',
  language: 'Idioma',
  languageEn: 'English',
  languageEs: 'Español',
};

const resources = {
  en: { translation: enTranslation },
  es: { translation: esTranslation },
};

/** Locale codes supported by the language picker. */
export const SUPPORTED_LOCALE_CODES = ['en', 'es'] as const;
export type SupportedLocaleCode = (typeof SUPPORTED_LOCALE_CODES)[number];
const DEFAULT_LOCALE_CODE: SupportedLocaleCode = 'en';

const SUPPORTED_LOCALE_CODES_SET = new Set<string>(SUPPORTED_LOCALE_CODES);

export function isSupportedLocaleCode(value: unknown): value is SupportedLocaleCode {
  return typeof value === 'string' && SUPPORTED_LOCALE_CODES_SET.has(value);
}

export function normalizeLocaleCode(
  value: unknown,
  fallback: SupportedLocaleCode = DEFAULT_LOCALE_CODE
): SupportedLocaleCode {
  return isSupportedLocaleCode(value) ? value : fallback;
}

/** Display name for each locale (for picker). Use t('languageEn'), t('languageEs') in UI. */
export const LOCALE_LABEL_KEYS: Record<(typeof SUPPORTED_LOCALE_CODES)[number], string> = {
  en: 'languageEn',
  es: 'languageEs',
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

interface LanguageContextValue {
  language: string;
  setLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { loading, loginRequired, hasValidSession } = useAuth();
  const [language, setLanguageState] = useState<string>(
    normalizeLocaleCode(i18n.language)
  );

  const canLoadSettingsLanguage = !loading && (!loginRequired || hasValidSession);
  const settingsQuery = useQuery({
    queryKey: settingsQueryKeys.settings,
    queryFn: () => SettingsRepository.getSettings(),
    enabled: canLoadSettingsLanguage,
    retry: false,
    staleTime: 60 * 1000,
  });

  const setLanguage = useCallback((lang: string) => {
    const nextLanguage = normalizeLocaleCode(lang, normalizeLocaleCode(i18n.language));
    i18n.changeLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  useEffect(() => {
    const handleLanguageChanged = (nextLanguage: string) => {
      setLanguageState(normalizeLocaleCode(nextLanguage));
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    const serverLanguage = settingsQuery.data?.language;
    if (!isSupportedLocaleCode(serverLanguage)) return;
    if (serverLanguage === language) return;
    setLanguage(serverLanguage);
  }, [settingsQuery.data?.language, language, setLanguage]);

  const value: LanguageContextValue = { language, setLanguage };

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
