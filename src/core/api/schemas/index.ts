/**
 * Zod schemas at the API boundary. Mirrors src/types/models.ts so the
 * runtime shape and the static type cannot drift.
 *
 * Parse strategy: loose by design. Schemas use .passthrough() so a backend
 * that adds new fields cannot break the client. In dev (__DEV__), parse
 * failures emit a warning so they become observable. In all modes the
 * original data is returned on parse failure to keep the app available.
 */

import { z } from 'zod';
import type { AppError } from '../errors';

const PassthroughObject = z.object({}).passthrough();

export const SubtitleSchema = z.object({
  language: z.string(),
  filename: z.string(),
  path: z.string(),
});

export const VideoSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    author: z.string().optional(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    date: z.string().optional(),
    addedAt: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    videoPath: z.string().optional(),
    thumbnailPath: z.string().nullable().optional(),
    thumbnailUrl: z.string().optional(),
    signedUrl: z.string().optional(),
    signedThumbnailUrl: z.string().optional(),
    description: z.string().optional(),
    duration: z.string().optional(),
    fileSize: z.string().optional(),
    tags: z.array(z.string()).optional(),
    rating: z.number().optional(),
    viewCount: z.number().optional(),
    progress: z.number().optional(),
    lastPlayedAt: z.number().optional(),
    visibility: z.number().optional(),
    subtitles: z.array(SubtitleSchema).optional(),
    authorAvatarFilename: z.string().optional(),
    authorAvatarPath: z.string().optional(),
  })
  .passthrough();

export const VideoListSchema = z.array(VideoSchema);

export const SettingsSchema = z
  .object({
    loginEnabled: z.boolean().optional(),
    isPasswordSet: z.boolean().optional(),
    isVisitorPasswordSet: z.boolean().optional(),
    language: z.string().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    websiteName: z.string().optional(),
    itemsPerPage: z.number().optional(),
    infiniteScroll: z.boolean().optional(),
    showYoutubeSearch: z.boolean().optional(),
    cloudflaredTunnelEnabled: z.boolean().optional(),
    cloudflaredToken: z.string().optional(),
    autoPlayVideo: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const LoginSuccessSchema = z.object({
  success: z.literal(true),
  role: z.enum(['admin', 'visitor']),
});

export const LoginFailureSchema = z
  .object({
    success: z.literal(false),
    waitTime: z.number().optional(),
    failedAttempts: z.number().optional(),
    message: z.string().optional(),
    statusCode: z.number().optional(),
  })
  .passthrough();

export const LoginResponseSchema = z.union([
  LoginSuccessSchema,
  LoginFailureSchema,
]);

export const PasswordEnabledSchema = z
  .object({
    enabled: z.boolean(),
    waitTime: z.number().optional(),
    loginRequired: z.boolean().optional(),
    visitorUserEnabled: z.boolean().optional(),
    isVisitorPasswordSet: z.boolean().optional(),
    passwordLoginAllowed: z.boolean().optional(),
    allowResetPassword: z.boolean().optional(),
    websiteName: z.string().optional(),
  })
  .passthrough();

export interface ParseWithSchemaOptions {
  mode?: 'loose' | 'throw';
  errorCode?: AppError['code'];
  message?: string;
}

/**
 * Parse with a schema, returning typed data on success.
 * On failure: warn in dev, then return the raw data cast to T to keep
 * the app available even when a single response shape drifts.
 */
export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
  source: string,
  options: ParseWithSchemaOptions = {}
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[schema:${source}] validation failed`, result.error.issues);
  }
  if (options.mode === 'throw') {
    const appError: AppError = {
      code: options.errorCode ?? 'SERVER',
      message: options.message ?? `Invalid response from ${source}`,
      raw: data,
      recoverable: false,
    };
    throw appError;
  }
  return data as T;
}

export { PassthroughObject };
