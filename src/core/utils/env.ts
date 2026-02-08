/**
 * API base URL and environment config.
 * - Emulator: use 10.0.2.2 to reach host machine localhost.
 * - Physical device: use your machine's LAN IP (e.g. 192.168.1.x).
 * - Production: HTTPS only (09-security.md). Do not ship cleartext API URLs in release builds.
 */
import { NativeModules, Platform } from 'react-native';

declare const __DEV__: boolean;
declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

type EnvRecord = Record<string, string | undefined>;

function normalizePathForApi(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  const trimmed = collapsed.replace(/\/+$/, '');
  const basePath = trimmed.length > 0 ? trimmed : '';
  const withApi = basePath.endsWith('/api') ? basePath : `${basePath}/api`;
  return withApi.startsWith('/') ? withApi : `/${withApi}`;
}

function normalizeHostForRuntime(host: string): string {
  if (Platform.OS !== 'android') return host;
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.startsWith('localhost:')) {
    return host.replace(/^localhost/i, '10.0.2.2');
  }
  if (lower === '127.0.0.1' || lower.startsWith('127.0.0.1:')) {
    return host.replace(/^127\.0\.0\.1/i, '10.0.2.2');
  }
  return host;
}

export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  const match = trimmed.match(
    /^(https?):\/\/([^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i
  );
  if (!match) return '';

  const protocol = match[1].toLowerCase();
  const host = normalizeHostForRuntime(match[2].trim());
  if (!host || /\s/.test(host) || host.includes('@')) return '';

  const path = match[3] ?? '';
  const normalizedPath = normalizePathForApi(path);
  return `${protocol}://${host}${normalizedPath}`;
}

function isHttpsUrl(url: string): boolean {
  const match = url.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
  if (!match) return false;
  return match[1].toLowerCase() === 'https';
}

function getConfigEnv(): EnvRecord | null {
  try {
    const mod = require('react-native-config') as
      | { default?: EnvRecord }
      | EnvRecord;
    if (mod != null && typeof mod === 'object') {
      if ('default' in mod && mod.default != null) {
        return mod.default as EnvRecord;
      }
      return mod as EnvRecord;
    }
  } catch {
    // Optional at runtime in tests / non-configured builds.
  }
  return null;
}

function getFirstEnvValue(...names: string[]): string | undefined {
  const processEnv = process?.env;
  if (processEnv != null) {
    for (const name of names) {
      const value = processEnv[name];
      if (typeof value === 'string' && value.trim().length > 0) return value;
    }
  }

  const configEnv = getConfigEnv();
  if (configEnv != null) {
    for (const name of names) {
      const value = configEnv[name];
      if (typeof value === 'string' && value.trim().length > 0) return value;
    }
  }

  return undefined;
}

function getApiBaseUrlFromEnv(): string | null {
  const rawValue = getFirstEnvValue('API_BASE_URL', 'MYTUBE_API_BASE_URL');
  const value = normalizeApiBaseUrl(rawValue ?? '');
  if (value.length === 0) return null;

  // Security: reject cleartext override in production.
  if (typeof __DEV__ !== 'undefined' && !__DEV__ && !isHttpsUrl(value)) {
    return null;
  }

  return value;
}

function getDevApiBaseUrlFromBundleHost(): string | null {
  const sourceCode = NativeModules.SourceCode as { scriptURL?: unknown } | undefined;
  const scriptURL =
    sourceCode != null && typeof sourceCode.scriptURL === 'string'
      ? sourceCode.scriptURL
      : '';

  // Example:
  // http://192.168.1.8:8081/index.bundle?platform=android...
  const match = scriptURL.match(/^(https?):\/\/([^/:?#]+)(?::\d+)?\//i);
  if (!match) return null;
  const protocol = match[1].toLowerCase() === 'https' ? 'https' : 'http';
  const host = match[2];
  return `${protocol}://${host}:5551/api`;
}

const getApiBaseUrl = (): string => {
  const envOverride = getApiBaseUrlFromEnv();
  if (envOverride != null) {
    return envOverride;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return getDevApiBaseUrlFromBundleHost() ?? 'http://10.0.2.2:5551/api';
  }

  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return 'https://your-backend.example.com/api';
  }

  return 'http://10.0.2.2:5551/api';
};

export const API_BASE_URL = getApiBaseUrl();

/** Host base for building media URLs (no /api suffix). */
export const HOST_BASE = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://10.0.2.2:5551';

export const API_TIMEOUT_MS = 15000;

// Test-only helper.
export function __normalizeApiBaseUrlForTests(url: string): string {
  return normalizeApiBaseUrl(url);
}
