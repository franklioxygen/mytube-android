import { normalizeApiBaseUrl } from '../utils/env';

const BACKEND_URL_KEY = 'config.backendApiUrl';

type BackendUrlStorage = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
};

function createMemoryStorage(): BackendUrlStorage {
  const memory = new Map<string, string>();
  return {
    getString: key => memory.get(key),
    set: (key, value) => memory.set(key, value),
    delete: key => memory.delete(key),
  };
}

function createStorage(): BackendUrlStorage {
  try {
    const mmkv = require('react-native-mmkv') as {
      createMMKV?: (config?: { id?: string }) => BackendUrlStorage;
    };
    if (typeof mmkv.createMMKV === 'function') {
      return mmkv.createMMKV({ id: 'backend-config-storage' });
    }
  } catch {
    // fall through to in-memory fallback
  }
  return createMemoryStorage();
}

const storage = createStorage();

export function getStoredBackendApiUrl(): string | null {
  let raw: string | undefined;
  try {
    raw = storage.getString(BACKEND_URL_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  const normalized = normalizeApiBaseUrl(raw);
  if (!normalized) {
    try {
      storage.delete(BACKEND_URL_KEY);
    } catch {
      // ignore storage cleanup failure
    }
    return null;
  }
  return normalized;
}

export function setStoredBackendApiUrl(url: string | null): void {
  if (url == null) {
    try {
      storage.delete(BACKEND_URL_KEY);
    } catch {
      // ignore storage delete failure
    }
    return;
  }
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) {
    try {
      storage.delete(BACKEND_URL_KEY);
    } catch {
      // ignore storage delete failure
    }
    return;
  }
  try {
    storage.set(BACKEND_URL_KEY, normalized);
  } catch {
    // ignore storage set failure
  }
}
