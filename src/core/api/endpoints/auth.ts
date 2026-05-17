/**
 * Auth and session endpoints per 02-auth-session.md.
 */

import { apiGet, apiPost } from '../client';
import { buildInFlightKey } from '../inFlight';
import {
  LoginResponseSchema,
  PasswordEnabledSchema,
  parseWithSchema,
} from '../schemas';
import { API_TIMEOUT_MS } from '../../utils/env';
import type {
  PasswordEnabledResponse,
  LoginResponse,
  PasskeysExistsResponse,
  PasskeyAuthBeginResponse,
} from '../../../types';
import axios from 'axios';

export async function getPasswordEnabled(): Promise<PasswordEnabledResponse> {
  const raw = await apiGet<PasswordEnabledResponse>('/settings/password-enabled');
  return parseWithSchema(
    PasswordEnabledSchema,
    raw,
    'getPasswordEnabled',
    { mode: 'throw' }
  );
}

export function getPasskeysExists(): Promise<PasskeysExistsResponse> {
  return apiGet<PasskeysExistsResponse>('/settings/passkeys/exists');
}

export async function verifyAdminPassword(
  password: string
): Promise<LoginResponse> {
  const path = '/settings/verify-admin-password';
  const raw = await apiPost<LoginResponse>(path, { password }, buildInFlightKey('POST', path));
  return parseWithSchema(
    LoginResponseSchema,
    raw,
    'verifyAdminPassword',
    { mode: 'throw' }
  );
}

export async function verifyVisitorPassword(
  password: string
): Promise<LoginResponse> {
  const path = '/settings/verify-visitor-password';
  const raw = await apiPost<LoginResponse>(path, { password }, buildInFlightKey('POST', path));
  return parseWithSchema(
    LoginResponseSchema,
    raw,
    'verifyVisitorPassword',
    { mode: 'throw' }
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

export async function passkeysAuthenticateVerify(
  body: Record<string, unknown>,
  challenge: string
): Promise<LoginResponse> {
  const path = '/settings/passkeys/authenticate/verify';
  const raw = await apiPost<LoginResponse>(path, { body, challenge }, buildInFlightKey('POST', path));
  return parseWithSchema(
    LoginResponseSchema,
    raw,
    'passkeysAuthenticateVerify',
    { mode: 'throw' }
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

export async function bestEffortLogoutFromBaseUrl(baseUrl: string): Promise<void> {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  if (!normalizedBaseUrl) return;

  try {
    await axios.post(`${normalizedBaseUrl}/settings/logout`, undefined, {
      withCredentials: true,
      timeout: API_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Best-effort session invalidation: local reset still proceeds.
  }
}
