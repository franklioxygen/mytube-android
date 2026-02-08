/**
 * React Query key constants. Single source for cache keys and invalidation.
 */

export const queryKeys = {
  videos: ['videos'] as const,
  video: (id: string) => ['videos', id] as const,
  videoComments: (id: string) => ['videos', id, 'comments'] as const,

  collections: ['collections'] as const,
  collection: (id: string) => ['collections', id] as const,

  settings: ['settings'] as const,
  systemVersion: ['system', 'version'] as const,

  downloadStatus: ['downloads', 'status'] as const,
  downloadHistory: ['downloads', 'history'] as const,

  subscriptions: ['subscriptions'] as const,
  subscriptionTasks: ['subscriptions', 'tasks'] as const,

  auth: {
    passwordEnabled: ['auth', 'passwordEnabled'] as const,
    passkeysExists: ['auth', 'passkeysExists'] as const,
    resetPasswordCooldown: ['auth', 'resetPasswordCooldown'] as const,
  },
} as const;
