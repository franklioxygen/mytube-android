/**
 * Client-side models per 03-data-models.md and web frontend parity.
 * Critical: video.progress is number in seconds; visibility 1 = visible, 0 = hidden.
 */

export interface Subtitle {
  language: string;
  filename: string;
  path: string;
}

export interface Video {
  id: string;
  title: string;
  author?: string;
  source?: 'youtube' | 'bilibili' | 'local' | 'missav' | string;
  sourceUrl?: string;
  date?: string;
  addedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  videoPath?: string;
  thumbnailPath?: string | null;
  thumbnailUrl?: string;
  signedUrl?: string;
  signedThumbnailUrl?: string;
  description?: string;
  duration?: string;
  fileSize?: string;
  tags?: string[];
  rating?: number;
  viewCount?: number;
  progress?: number;
  lastPlayedAt?: number;
  visibility?: number;
  subtitles?: Subtitle[];
  authorAvatarFilename?: string;
  authorAvatarPath?: string;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  date: string;
  avatar?: string;
}

export interface Collection {
  id: string;
  name: string;
  title?: string;
  videos: string[];
  createdAt: string;
  updatedAt?: string;
}

export type DownloadQueueStatus = 'active' | 'queued' | string;
export type DownloadHistoryStatus = 'success' | 'failed' | 'skipped' | 'deleted' | string;

export interface DownloadInfo {
  id: string;
  title?: string;
  status?: DownloadQueueStatus | DownloadHistoryStatus;
  timestamp?: number;
  createdAt?: number;
  updatedAt?: number;
  progress?: number;
  speed?: string;
  totalSize?: string;
  downloadedSize?: string;
  filename?: string;
  error?: string;
  [key: string]: unknown;
}

export interface DownloadStatusResponse {
  activeDownloads: DownloadInfo[];
  queuedDownloads: DownloadInfo[];
}

/** Subscription DTO (GET /api/subscriptions). */
export interface Subscription {
  id: string;
  authorUrl?: string;
  playlistUrl?: string;
  url: string;
  interval?: number;
  authorName?: string;
  paused?: number | boolean;
  lastCheckTime?: number;
  totalVideos?: number;
  [key: string]: unknown;
}

export type SubscriptionTaskStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | string;

/** Subscription task DTO (GET /api/subscriptions/tasks). */
export interface SubscriptionTask {
  id: string;
  subscriptionId?: string;
  status?: SubscriptionTaskStatus;
  progress?: number;
  failedCount?: number;
  downloadedCount?: number;
  skippedCount?: number;
  error?: string;
  startedAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

/** Search result item (online search). */
export interface SearchResultItem {
  id?: string;
  title: string;
  author?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  [key: string]: unknown;
}

/** API response wrapper used by backend. */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

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
  role: 'admin' | 'visitor';
}

export interface LoginFailure {
  success: false;
  waitTime?: number;
  failedAttempts?: number;
  message?: string;
  statusCode?: number;
}

export type LoginResponse = LoginSuccess | LoginFailure;

export interface PasskeysExistsResponse {
  exists: boolean;
}

export interface PasskeyAuthBeginResponse {
  options: Record<string, unknown>;
  challenge: string;
}

export interface Settings {
  loginEnabled?: boolean;
  isPasswordSet?: boolean;
  isVisitorPasswordSet?: boolean;
  language?: string;
  theme?: 'light' | 'dark' | 'system';
  websiteName?: string;
  itemsPerPage?: number;
  infiniteScroll?: boolean;
  showYoutubeSearch?: boolean;
  cloudflaredTunnelEnabled?: boolean;
  cloudflaredToken?: string;
  [key: string]: unknown;
}

export interface ViewIncrementResponse {
  success: true;
  viewCount?: number;
}

export interface RateResponse {
  success: true;
  video: Video;
}

export interface ProgressUpdateResponse {
  success: true;
  data: { progress: number };
  message?: string;
}

export interface CloudSignedUrlResponse {
  success: boolean;
  url?: string;
  cached?: boolean;
  message?: string;
}

export interface SystemVersion {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  hasUpdate: boolean;
  error?: string;
}
