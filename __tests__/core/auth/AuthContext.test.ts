import { __resolveStartupRoleForTests } from '../../../src/core/auth/AuthContext';

describe('AuthContext startup role resolution', () => {
  test('clears persisted role when login is not required', () => {
    expect(__resolveStartupRoleForTests(false, true, 'visitor')).toBeNull();
    expect(__resolveStartupRoleForTests(false, true, 'admin')).toBeNull();
  });

  test('keeps probed role only for valid authenticated sessions', () => {
    expect(__resolveStartupRoleForTests(true, true, 'admin')).toBe('admin');
    expect(__resolveStartupRoleForTests(true, true, 'visitor')).toBe('visitor');
    expect(__resolveStartupRoleForTests(true, false, 'admin')).toBeNull();
  });
});
