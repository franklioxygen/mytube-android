import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../../../src/core/auth/AuthContext';
import {
  getPasswordEnabled,
  verifyAdminPassword,
} from '../../../src/core/api/endpoints/auth';
import { getSettings } from '../../../src/core/api/endpoints/settings';

jest.mock('../../../src/core/api/client', () => ({
  setUnauthorizedHandler: jest.fn(),
}));

jest.mock('../../../src/core/api/endpoints/auth', () => ({
  getPasswordEnabled: jest.fn(),
  verifyAdminPassword: jest.fn(),
  verifyVisitorPassword: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('../../../src/core/api/endpoints/settings', () => ({
  getSettings: jest.fn(),
}));

jest.mock('../../../src/core/repositories', () => ({
  AuthRepository: {
    passkeysAuthenticate: jest.fn(),
    passkeysAuthenticateVerify: jest.fn(),
  },
}));

jest.mock('../../../src/core/auth/roleStorage', () => ({
  getStoredRole: jest.fn(() => null),
  setStoredRole: jest.fn(),
}));

const mockedGetPasswordEnabled = getPasswordEnabled as jest.MockedFunction<
  typeof getPasswordEnabled
>;
const mockedVerifyAdminPassword = verifyAdminPassword as jest.MockedFunction<
  typeof verifyAdminPassword
>;
const mockedGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;

type AuthSnapshot = {
  loading: boolean;
  failedAttempts: number | null;
  waitTimeMs: number | null;
  loginAsAdmin: (password: string) => Promise<boolean>;
  clearError: () => void;
};

async function waitForAuthLoaded(
  readState: () => AuthSnapshot | null
): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    if (readState()?.loading === false) return;
    await act(async () => {
      await Promise.resolve();
    });
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  }
  throw new Error('Auth state did not finish loading in test');
}

describe('AuthContext failedAttempts handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPasswordEnabled.mockResolvedValue({
      enabled: true,
      loginRequired: true,
    });
    mockedGetSettings.mockRejectedValue({
      code: 'UNAUTHENTICATED',
      message: 'Login required',
    });
  });

  test('exposes failedAttempts after login failure and clears it on clearError', async () => {
    mockedVerifyAdminPassword.mockResolvedValue({
      success: false,
      message: 'Invalid password',
      waitTime: 5000,
      failedAttempts: 4,
      statusCode: 401,
    });

    const latestAuthRef: { current: AuthSnapshot | null } = { current: null };
    const Probe = () => {
      latestAuthRef.current = useAuth();
      return null;
    };

    await act(async () => {
      ReactTestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );
    });

    await waitForAuthLoaded(() => latestAuthRef.current);
    expect(latestAuthRef.current?.failedAttempts).toBeNull();

    let ok = true;
    await act(async () => {
      ok = await latestAuthRef.current!.loginAsAdmin('wrong-password');
    });

    expect(ok).toBe(false);
    expect(latestAuthRef.current?.failedAttempts).toBe(4);
    expect(latestAuthRef.current?.waitTimeMs).toBe(5000);

    await act(async () => {
      latestAuthRef.current!.clearError();
    });
    expect(latestAuthRef.current?.failedAttempts).toBeNull();
  });
});
