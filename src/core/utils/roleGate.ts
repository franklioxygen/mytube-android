/**
 * Role gate: admin vs visitor. Visitors are read-only for most mutations.
 * Visitor cannot: delete video, update metadata, download trigger, subscribe/unsubscribe,
 * hooks/db/cookies admin actions. Backend also denies these; UI hides/disables via canMutate(role).
 */

export type Role = 'admin' | 'visitor' | null;

const VISITOR_SETTINGS_EDITABLE_KEYS = new Set([
  'cloudflaredTunnelEnabled',
  'cloudflaredToken',
]);

export function isAdmin(role: Role): boolean {
  return role === 'admin';
}

/**
 * True only for admin. Use to hide/disable mutating actions (delete, update,
 * download, settings write, hooks/db/cookies admin actions) for visitors.
 * When login is disabled server-side, null role is treated as writable.
 */
export function canMutate(role: Role, loginRequired: boolean = true): boolean {
  if (!loginRequired) return role !== 'visitor';
  return role === 'admin';
}

/**
 * Settings write policy from 08-settings-dictionary.md:
 * - admin: full settings write
 * - visitor: only cloudflaredTunnelEnabled/cloudflaredToken
 * - when login is disabled: null/admin can write, visitor remains restricted
 */
export function canEditSettings(
  role: Role,
  keys: string[],
  loginRequired: boolean = true
): boolean {
  if (!loginRequired && role !== 'visitor') return true;
  if (role === 'admin') return true;
  if (role !== 'visitor') return false;
  return keys.every(key => VISITOR_SETTINGS_EDITABLE_KEYS.has(key));
}
