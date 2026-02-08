/**
 * Auth state: startup probe, role, login/logout.
 * Per 02-auth-session.md: cookie-based session, store only role (no password).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { setUnauthorizedHandler } from '../api/client';
import {
  getPasswordEnabled,
  verifyAdminPassword,
  verifyVisitorPassword,
  logout as apiLogout,
} from '../api/endpoints/auth';
import { getSettings } from '../api/endpoints/settings';
import { AuthRepository } from '../repositories';
import { getStoredRole, setStoredRole } from './roleStorage';
import type {
  LoginResponse,
  PasswordEnabledResponse,
  PasskeyAuthBeginResponse,
} from '../../types';
import type { AppError } from '../api/client';

type Role = 'admin' | 'visitor' | null;

interface AuthState {
  role: Role;
  hasValidSession: boolean;
  loginRequired: boolean;
  passwordEnabled: PasswordEnabledResponse | null;
  loading: boolean;
  error: AppError | null;
  waitTimeMs: number | null;
}

interface AuthContextValue extends AuthState {
  loginAsAdmin: (password: string) => Promise<boolean>;
  loginAsVisitor: (password: string) => Promise<boolean>;
  startPasskeyAuth: () => Promise<PasskeyAuthBeginResponse>;
  loginWithPasskey: (credentialResponse: unknown, challenge: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshAuthConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isLoginSuccess(r: LoginResponse): r is { success: true; role: 'admin' | 'visitor' } {
  return r && (r as { success?: boolean }).success === true;
}

function loginFailureErrorCode(body: { statusCode?: number }): AppError['code'] {
  return body.statusCode === 429 ? 'RATE_LIMIT' : 'UNAUTHENTICATED';
}

function normalizeRole(role: unknown): Role {
  return role === 'admin' || role === 'visitor' ? role : null;
}

function resolveStartupRole(
  loginRequired: boolean,
  hasValidSession: boolean,
  probeRole: Role
): Role {
  if (!loginRequired) return null;
  return hasValidSession ? probeRole : null;
}

function getRoleFromSettings(settings: unknown): Role {
  if (settings == null || typeof settings !== 'object') return null;
  const candidate = settings as {
    role?: unknown;
    userRole?: unknown;
    currentRole?: unknown;
  };
  return (
    normalizeRole(candidate.role) ??
    normalizeRole(candidate.userRole) ??
    normalizeRole(candidate.currentRole)
  );
}

function safeGetStoredRole(): Role {
  try {
    return getStoredRole();
  } catch {
    return null;
  }
}

function safeSetStoredRole(role: Role): void {
  try {
    setStoredRole(role);
  } catch {
    // Ignore storage failures so auth bootstrap cannot get stuck.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const storedRole = safeGetStoredRole();
  const [state, setState] = useState<AuthState>({
    role: storedRole,
    hasValidSession: false,
    loginRequired: false,
    passwordEnabled: null,
    loading: true,
    error: null,
    waitTimeMs: null,
  });

  const refreshAuthConfig = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const passwordEnabled = await getPasswordEnabled();
      let loginRequired =
        passwordEnabled.loginRequired ?? passwordEnabled.enabled ?? false;
      let hasValidSession = !loginRequired;
      let probeError: AppError | null = null;

      let probeRole: Role = loginRequired ? safeGetStoredRole() : null;
      if (loginRequired) {
        try {
          const settings = await getSettings();
          hasValidSession = true;
          probeRole = getRoleFromSettings(settings) ?? probeRole;
        } catch (e) {
          const err = e as AppError;
          if (err.code === 'UNAUTHENTICATED' || err.code === 'FORBIDDEN') {
            hasValidSession = false;
          } else {
            // Do not force-login on connectivity/server failures.
            // Keep app accessible and surface the connection error in data screens.
            loginRequired = false;
            hasValidSession = false;
            probeError = err;
          }
        }
      }

      const resolvedRole = resolveStartupRole(
        loginRequired,
        hasValidSession,
        probeRole
      );
      safeSetStoredRole(resolvedRole);

      setState(s => ({
        ...s,
        passwordEnabled,
        loginRequired,
        hasValidSession,
        role: resolvedRole,
        loading: false,
        error: probeError,
      }));
    } catch (e) {
      const err = e as AppError;
      let loginRequired = false;
      let hasValidSession = false;
      let resolvedRole: Role = null;
      let startupError: AppError | null = err;

      // Some backends do not support /settings/password-enabled reliably.
      // Probe /settings and only force login when backend explicitly rejects auth.
      try {
        const settings = await getSettings();
        hasValidSession = true;
        resolvedRole = getRoleFromSettings(settings);
        startupError = null;
      } catch (probeError) {
        const probeErr = probeError as AppError;
        if (probeErr.code === 'UNAUTHENTICATED' || probeErr.code === 'FORBIDDEN') {
          loginRequired = true;
          startupError = null;
        } else {
          startupError = probeErr;
        }
      }

      safeSetStoredRole(resolvedRole);
      setState(s => ({
        ...s,
        role: resolvedRole,
        hasValidSession,
        loading: false,
        error: startupError,
        loginRequired,
      }));
    }
  }, []);

  useEffect(() => {
    refreshAuthConfig();
  }, [refreshAuthConfig]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      safeSetStoredRole(null);
      setState(s => ({ ...s, role: null, hasValidSession: false }));
    });
  }, []);

  const loginAsAdmin = useCallback(async (password: string): Promise<boolean> => {
    setState(s => ({ ...s, error: null, waitTimeMs: null }));
    try {
      const res: LoginResponse = await verifyAdminPassword(password);
      if (isLoginSuccess(res)) {
        safeSetStoredRole(res.role);
        setState(s => ({
          ...s,
          role: res.role,
          hasValidSession: true,
          error: null,
          waitTimeMs: null,
        }));
        return true;
      }
      const fail = res as { waitTime?: number; message?: string; statusCode?: number };
      setState(s => ({
        ...s,
        waitTimeMs: fail.waitTime ?? null,
        hasValidSession: false,
        error: {
          code: loginFailureErrorCode(fail),
          message: fail.message ?? 'Login failed',
          waitTimeMs: fail.waitTime,
        } as AppError,
      }));
      return false;
    } catch (e) {
      const err = e as AppError;
      setState(s => ({
        ...s,
        error: err,
        hasValidSession: false,
        waitTimeMs: err.waitTimeMs ?? null,
      }));
      return false;
    }
  }, []);

  const loginAsVisitor = useCallback(async (password: string): Promise<boolean> => {
    setState(s => ({ ...s, error: null, waitTimeMs: null }));
    try {
      const res: LoginResponse = await verifyVisitorPassword(password);
      if (isLoginSuccess(res)) {
        safeSetStoredRole(res.role);
        setState(s => ({
          ...s,
          role: res.role,
          hasValidSession: true,
          error: null,
          waitTimeMs: null,
        }));
        return true;
      }
      const fail = res as { waitTime?: number; message?: string; statusCode?: number };
      setState(s => ({
        ...s,
        waitTimeMs: fail.waitTime ?? null,
        hasValidSession: false,
        error: {
          code: loginFailureErrorCode(fail),
          message: fail.message ?? 'Login failed',
          waitTimeMs: fail.waitTime,
        } as AppError,
      }));
      return false;
    } catch (e) {
      const err = e as AppError;
      setState(s => ({
        ...s,
        error: err,
        hasValidSession: false,
        waitTimeMs: err.waitTimeMs ?? null,
      }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      safeSetStoredRole(null);
      setState(s => ({
        ...s,
        role: null,
        hasValidSession: false,
        error: null,
        waitTimeMs: null,
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  const startPasskeyAuth = useCallback(
    async (): Promise<PasskeyAuthBeginResponse> => AuthRepository.passkeysAuthenticate(),
    []
  );

  const loginWithPasskey = useCallback(
    async (credentialResponse: unknown, challenge: string): Promise<boolean> => {
      setState(s => ({ ...s, error: null, waitTimeMs: null }));
      try {
        const res = await AuthRepository.passkeysAuthenticateVerify(
          credentialResponse as Record<string, unknown>,
          challenge
        );
        if (isLoginSuccess(res)) {
          safeSetStoredRole(res.role);
          setState(s => ({
            ...s,
            role: res.role,
            hasValidSession: true,
            error: null,
            waitTimeMs: null,
          }));
          return true;
        }
        const fail = res as { waitTime?: number; message?: string; statusCode?: number };
        setState(s => ({
          ...s,
          waitTimeMs: fail.waitTime ?? null,
          hasValidSession: false,
          error: {
            code: loginFailureErrorCode(fail),
            message: (fail as { message?: string }).message ?? 'Passkey login failed',
            waitTimeMs: fail.waitTime,
          } as AppError,
        }));
        return false;
      } catch (e) {
        const err = e as AppError;
        setState(s => ({
          ...s,
          error: err,
          hasValidSession: false,
          waitTimeMs: err.waitTimeMs ?? null,
        }));
        return false;
      }
    },
    []
  );

  const value: AuthContextValue = {
    ...state,
    loginAsAdmin,
    loginAsVisitor,
    startPasskeyAuth,
    loginWithPasskey,
    logout,
    clearError,
    refreshAuthConfig,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Test-only helper.
export function __resolveStartupRoleForTests(
  loginRequired: boolean,
  hasValidSession: boolean,
  probeRole: Role
): Role {
  return resolveStartupRole(loginRequired, hasValidSession, probeRole);
}
