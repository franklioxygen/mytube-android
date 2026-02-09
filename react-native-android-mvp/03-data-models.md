# Data Models (RN Android MVP)

This file defines practical client-side models for the MVP endpoint subset.

## 1. Core Domain Models

```ts
export interface Subtitle {
  language: string;
  filename: string;
  path: string; // e.g. /subtitles/...
}

export interface Video {
  id: string;
  title: string;
  author?: string;
  source?: "youtube" | "bilibili" | "local" | "missav" | string;
  sourceUrl?: string;
  date?: string;
  addedAt?: string;
  createdAt?: string;
  updatedAt?: string;

  // media paths
  videoPath?: string;           // /videos/... or cloud:...
  thumbnailPath?: string | null; // /images/... or cloud:...
  thumbnailUrl?: string;
  signedUrl?: string;           // injected for mount/cloud cases
  signedThumbnailUrl?: string;  // injected for cloud thumbnail

  // metadata
  description?: string;
  duration?: string;
  fileSize?: string;
  tags?: string[];
  rating?: number;
  viewCount?: number;
  progress?: number;
  lastPlayedAt?: number;
  visibility?: number; // 1 visible, 0 hidden

  subtitles?: Subtitle[];
  authorAvatarFilename?: string;
  authorAvatarPath?: string;
}
```

`GET /api/videos` behavior in MVP: the backend returns the full video array in one response (no server-side pagination/filtering).

```ts
export interface Comment {
  id: string;
  author: string;
  content: string;
  date: string;
  avatar?: string;
}
```

```ts
export interface Collection {
  id: string;
  name: string;
  title?: string; // backward compatibility
  videos: string[]; // video IDs
  createdAt: string;
  updatedAt?: string;
}
```

## 2. Auth/Session Related Models

```ts
export interface PasswordEnabledResponse {
  enabled: boolean;
  waitTime?: number;
  loginRequired?: boolean;
  visitorUserEnabled?: boolean;
  isVisitorPasswordSet?: boolean;
  passwordLoginAllowed?: boolean;
  allowResetPassword?: boolean;
  websiteName?: string;
}

export interface LoginSuccess {
  success: true;
  role: "admin" | "visitor";
}

export interface LoginFailure {
  success: false;
  waitTime?: number;
  failedAttempts?: number;
  message?: string;
  statusCode?: number; // often 401 or 429, returned inside body
}

export type LoginResponse = LoginSuccess | LoginFailure;
```

Passkey endpoints:

```ts
export interface PasskeysExistsResponse {
  exists: boolean;
}

export interface PasskeyAuthBeginResponse {
  options: Record<string, unknown>;
  challenge: string;
}
```

## 3. Settings Model for MVP

Settings payload is large and extensible. Use a tolerant model:

```ts
export interface Settings {
  loginEnabled?: boolean;
  isPasswordSet?: boolean;
  isVisitorPasswordSet?: boolean;
  language?: string;
  theme?: "light" | "dark" | "system";
  websiteName?: string;
  itemsPerPage?: number;
  infiniteScroll?: boolean;
  showYoutubeSearch?: boolean;
  [key: string]: unknown;
}
```

For `PATCH /api/settings`, send only fields your app edits.

## 4. Interaction Response Models

```ts
export interface ViewIncrementResponse {
  success: true;
  viewCount?: number;
}

export interface RateResponse {
  success: true;
  video: Video;
}
```

`PUT /api/videos/:id/progress` currently returns wrapped format:

```ts
export interface ProgressUpdateResponse {
  success: true;
  data: {
    progress: number;
  };
  message?: string;
}
```

## 5. Cloud URL Response

```ts
export interface CloudSignedUrlResponse {
  success: boolean;
  url?: string;
  cached?: boolean; // present for thumbnail flow
  message?: string; // present on 404/failure
}
```

## 6. System Version Model

```ts
export interface SystemVersion {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  hasUpdate: boolean;
  error?: string;
}
```

## 7. API Envelope Normalization (Recommended)

Backend uses mixed direct and wrapped responses. Normalize in your API layer:

```ts
export type RawApiResult<T> =
  | T
  | { success: true; data: T; message?: string }
  | { success: false; error?: string; message?: string };

export function unwrap<T>(raw: RawApiResult<T>): T {
  if (
    raw &&
    typeof raw === "object" &&
    "success" in raw &&
    (raw as any).success === true &&
    "data" in raw
  ) {
    return (raw as any).data as T;
  }
  return raw as T;
}
```
