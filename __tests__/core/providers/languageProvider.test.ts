import {
  isSupportedLocaleCode,
  normalizeLocaleCode,
} from '../../../src/app/providers/LanguageProvider';

describe('LanguageProvider locale helpers', () => {
  test('recognizes supported locale codes', () => {
    expect(isSupportedLocaleCode('en')).toBe(true);
    expect(isSupportedLocaleCode('es')).toBe(true);
    expect(isSupportedLocaleCode('fr')).toBe(false);
    expect(isSupportedLocaleCode(null)).toBe(false);
  });

  test('normalizes unsupported locale values to fallback', () => {
    expect(normalizeLocaleCode('en')).toBe('en');
    expect(normalizeLocaleCode('fr')).toBe('en');
    expect(normalizeLocaleCode(undefined, 'es')).toBe('es');
  });
});
