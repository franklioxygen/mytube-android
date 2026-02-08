/**
 * Media URL resolution per 01-api-overview.md.
 * - Prefer signedUrl when present.
 * - cloud: path -> use /api/cloud/signed-url (caller or VideoRepository fetches URL).
 * - mount: path -> use /api/mount-video/:id (streaming URL below).
 * - Local path -> host + path.
 */

import { getRuntimeHostBase } from '../api/runtimeBaseUrl';
import type { Video } from '../../types';

function isAbsoluteHttpUrl(pathOrUrl: string): boolean {
  return /^https?:\/\//i.test(pathOrUrl);
}

/**
 * Security hardening: when API host is HTTPS, reject cleartext media URLs.
 */
function isDowngradedCleartextUrl(pathOrUrl: string): boolean {
  return (
    getRuntimeHostBase().startsWith('https://') &&
    pathOrUrl.toLowerCase().startsWith('http://')
  );
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (isAbsoluteHttpUrl(pathOrUrl)) {
    if (isDowngradedCleartextUrl(pathOrUrl)) return '';
    return pathOrUrl;
  }
  const hostBase = getRuntimeHostBase();
  return `${hostBase}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/** Playback URL for video. Prefer signedUrl; else local path. cloud: returns '' (fetch signed URL separately). */
export function getVideoPlaybackUrl(video: Video): string {
  if (video.signedUrl) {
    return toAbsoluteUrl(video.signedUrl);
  }
  if (video.videoPath) {
    if (isAbsoluteHttpUrl(video.videoPath)) {
      return toAbsoluteUrl(video.videoPath);
    }
    if (video.videoPath.startsWith('mount:')) {
      return video.id ? getMountVideoUrl(video.id) : '';
    }
    if (video.videoPath.startsWith('cloud:')) return '';
    return toAbsoluteUrl(video.videoPath);
  }
  return '';
}

/** Mount-directory streaming URL. Use for videoPath starting with mount:. */
export function getMountVideoUrl(videoId: string): string {
  const hostBase = getRuntimeHostBase();
  const base = hostBase.endsWith('/') ? hostBase.slice(0, -1) : hostBase;
  return `${base}/api/mount-video/${videoId}`;
}

/**
 * Fallback cloud redirect route from 01-api-overview.md.
 * Used when signed URL APIs are unavailable but backend can redirect to cloud media.
 */
export function getCloudVideoRedirectUrl(filename: string): string {
  const normalizedFilename = filename.trim();
  if (normalizedFilename.length === 0) return '';
  return toAbsoluteUrl(`/cloud/videos/${encodeURIComponent(normalizedFilename)}`);
}

/** Thumbnail URL. Use signedThumbnailUrl or local thumbnailPath. */
export function getThumbnailUrl(video: Video): string {
  if (video.signedThumbnailUrl) {
    return toAbsoluteUrl(video.signedThumbnailUrl);
  }
  if (video.thumbnailPath) {
    if (isAbsoluteHttpUrl(video.thumbnailPath)) {
      return toAbsoluteUrl(video.thumbnailPath);
    }
    if (video.thumbnailPath.startsWith('cloud:')) return '';
    return toAbsoluteUrl(video.thumbnailPath);
  }
  if (video.thumbnailUrl) return toAbsoluteUrl(video.thumbnailUrl);
  return '';
}
