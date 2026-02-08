/**
 * Convenience hook: true only for admin. Use to hide/disable mutating actions.
 * Visitor cannot: delete video, update metadata, download, subscribe, settings writes, hooks/db/cookies admin.
 */

import { useAuth } from '../core/auth/AuthContext';
import { canMutate } from '../core/utils/roleGate';

export function useCanMutate(): boolean {
  const { role, loginRequired } = useAuth();
  return canMutate(role, loginRequired);
}
