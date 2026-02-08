/**
 * Persist auth role locally to improve cold-start role restoration.
 */

export type StoredRole = 'admin' | 'visitor';

const ROLE_KEY = 'auth.role';
type RoleStorageBackend = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
};

function createMemoryStorage(): RoleStorageBackend {
  const memory = new Map<string, string>();
  return {
    getString: key => memory.get(key),
    set: (key, value) => memory.set(key, value),
    delete: key => memory.delete(key),
  };
}

function createStorage(): RoleStorageBackend {
  try {
    // Runtime import avoids Jest ESM parsing issues in unit tests.
    const mmkv = require('react-native-mmkv') as {
      createMMKV?: (config?: { id?: string }) => RoleStorageBackend;
    };
    if (typeof mmkv.createMMKV === 'function') {
      return mmkv.createMMKV({ id: 'auth-storage' });
    }
  } catch {
    // fall through to in-memory fallback
  }
  return createMemoryStorage();
}

const storage = createStorage();

export function getStoredRole(): StoredRole | null {
  const role = storage.getString(ROLE_KEY);
  return role === 'admin' || role === 'visitor' ? role : null;
}

export function setStoredRole(role: StoredRole | null): void {
  if (role == null) {
    storage.delete(ROLE_KEY);
    return;
  }
  storage.set(ROLE_KEY, role);
}
