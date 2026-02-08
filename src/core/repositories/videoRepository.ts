/**
 * Video repository: wraps video endpoints.
 */

import * as videoEndpoints from '../api/endpoints/videos';
import { getCloudSignedUrl } from '../api/endpoints/cloud';
import type { Video, Comment, ViewIncrementResponse, RateResponse } from '../../types';
import { queryKeys } from './queryKeys';

export const videoQueryKeys = {
  all: queryKeys.videos,
  detail: queryKeys.video,
  comments: queryKeys.videoComments,
};

function getCloudFilename(path: string | null | undefined): string | null {
  if (typeof path !== 'string' || !path.startsWith('cloud:')) return null;
  const name = path.replace(/^cloud:/, '').trim();
  return name.length > 0 ? name : null;
}

/**
 * Compatibility hardening:
 * tolerate both `{ success, url }` and envelope-normalized payloads with only `url`.
 */
function getCloudUrlFromResponse(response: unknown): string | null {
  if (response == null || typeof response !== 'object') return null;
  const payload = response as { success?: unknown; url?: unknown };
  if (typeof payload.url !== 'string' || payload.url.length === 0) return null;
  if (payload.success === false) return null;
  return payload.url;
}

async function hydrateCloudThumbnail(video: Video): Promise<Video> {
  if (video.signedThumbnailUrl) return video;
  const filename = getCloudFilename(video.thumbnailPath);
  if (filename == null) return video;
  try {
    const res = await getCloudSignedUrl(filename, 'thumbnail');
    const signedThumbnailUrl = getCloudUrlFromResponse(res);
    if (signedThumbnailUrl != null) {
      return { ...video, signedThumbnailUrl };
    }
  } catch {
    // Keep original item; thumbnail can still be absent if signing fails.
  }
  return video;
}

async function hydrateCloudThumbnails(videos: Video[]): Promise<Video[]> {
  return Promise.all(videos.map(v => hydrateCloudThumbnail(v)));
}

export const VideoRepository = {
  getVideos: async (): Promise<Video[]> => {
    const videos = await videoEndpoints.getVideos();
    return hydrateCloudThumbnails(videos);
  },

  getVideo: async (id: string): Promise<Video> => {
    const video = await videoEndpoints.getVideo(id);
    return hydrateCloudThumbnail(video);
  },

  getAuthorChannelUrl: (
    sourceUrl: string
  ): Promise<{ success: boolean; channelUrl: string | null }> =>
    videoEndpoints.getAuthorChannelUrl(sourceUrl),

  getVideoComments: (id: string): Promise<Comment[]> =>
    videoEndpoints.getVideoComments(id),

  postVideoView: (id: string): Promise<ViewIncrementResponse> =>
    videoEndpoints.postVideoView(id),

  putVideoProgress: (
    id: string,
    progress: number
  ): Promise<{ progress: number }> =>
    videoEndpoints.putVideoProgress(id, progress),

  postVideoRate: (id: string, rating: number): Promise<RateResponse> =>
    videoEndpoints.postVideoRate(id, rating),
};
