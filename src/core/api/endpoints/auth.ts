/**
 * Auth and session endpoints per 02-auth-session.md.
 */

import { apiGet, apiPost } from '../client';
import { buildInFlightKey } from '../inFlight';
import type {
  PasswordEnabledResponse,
  LoginResponse,
  PasskeysExistsResponse,
  PasskeyAuthBeginResponse,
} from '../../../types';

export function getPasswordEnabled(): Promise<PasswordEnabledResponse> {
  return apiGet<PasswordEnabledResponse>('/settings/password-enabled');
}

export function getPasskeysExists(): Promise<PasskeysExistsResponse> {
  return apiGet<PasskeysExistsResponse>('/settings/passkeys/exists');
}

export function getResetPasswordCooldown(): Promise<{ cooldown: number }> {
  return apiGet<{ cooldown: number }>('/settings/reset-password-cooldown');
}

export function verifyAdminPassword(password: string): Promise<LoginResponse> {
  const path = '/settings/verify-admin-password';
  return apiPost<LoginResponse>(
    path,
    { password },
    buildInFlightKey('POST', path)
  );
}

export function verifyVisitorPassword(
  password: string
): Promise<LoginResponse> {
  const path = '/settings/verify-visitor-password';
  return apiPost<LoginResponse>(
    path,
    { password },
    buildInFlightKey('POST', path)
  );
}

export function passkeysAuthenticate(): Promise<PasskeyAuthBeginResponse> {
  const path = '/settings/passkeys/authenticate';
  return apiPost<PasskeyAuthBeginResponse>(
    path,
    undefined,
    buildInFlightKey('POST', path)
  );
}

export function passkeysAuthenticateVerify(
  body: Record<string, unknown>,
  challenge: string
): Promise<LoginResponse> {
  const path = '/settings/passkeys/authenticate/verify';
  return apiPost<LoginResponse>(
    path,
    { body, challenge },
    buildInFlightKey('POST', path)
  );
}

export function logout(): Promise<{ success: boolean; message?: string }> {
  const path = '/settings/logout';
  return apiPost<{ success: boolean; message?: string }>(
    path,
    undefined,
    buildInFlightKey('POST', path)
  );
}
