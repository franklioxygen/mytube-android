/**
 * Auth repository: wraps auth/session endpoints.
 */

import * as authEndpoints from '../api/endpoints/auth';
import type {
  PasswordEnabledResponse,
  LoginResponse,
  PasskeysExistsResponse,
  PasskeyAuthBeginResponse,
} from '../../types';
import { queryKeys } from './queryKeys';

export const authQueryKeys = queryKeys.auth;

export const AuthRepository = {
  getPasswordEnabled: (): Promise<PasswordEnabledResponse> =>
    authEndpoints.getPasswordEnabled(),

  getPasskeysExists: (): Promise<PasskeysExistsResponse> =>
    authEndpoints.getPasskeysExists(),

  getResetPasswordCooldown: (): Promise<{ cooldown: number }> =>
    authEndpoints.getResetPasswordCooldown(),

  verifyAdminPassword: (password: string): Promise<LoginResponse> =>
    authEndpoints.verifyAdminPassword(password),

  verifyVisitorPassword: (password: string): Promise<LoginResponse> =>
    authEndpoints.verifyVisitorPassword(password),

  passkeysAuthenticate: (): Promise<PasskeyAuthBeginResponse> =>
    authEndpoints.passkeysAuthenticate(),

  passkeysAuthenticateVerify: (
    body: Record<string, unknown>,
    challenge: string
  ): Promise<LoginResponse> =>
    authEndpoints.passkeysAuthenticateVerify(body, challenge),

  logout: (): Promise<{ success: boolean; message?: string }> =>
    authEndpoints.logout(),
};
