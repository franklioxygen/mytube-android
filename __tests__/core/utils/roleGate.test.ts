import { canEditSettings, canMutate } from '../../../src/core/utils/roleGate';

describe('canMutate', () => {
  test('requires admin when login is enabled', () => {
    expect(canMutate('admin', true)).toBe(true);
    expect(canMutate('visitor', true)).toBe(false);
    expect(canMutate(null, true)).toBe(false);
  });

  test('allows null/admin when login is disabled', () => {
    expect(canMutate('admin', false)).toBe(true);
    expect(canMutate(null, false)).toBe(true);
    expect(canMutate('visitor', false)).toBe(false);
  });
});

describe('canEditSettings', () => {
  test('visitor can edit only cloudflare keys', () => {
    expect(canEditSettings('visitor', ['cloudflaredToken'], true)).toBe(true);
    expect(canEditSettings('visitor', ['websiteName'], true)).toBe(false);
  });

  test('null role can edit when login is disabled', () => {
    expect(canEditSettings(null, ['websiteName'], false)).toBe(true);
  });
});
