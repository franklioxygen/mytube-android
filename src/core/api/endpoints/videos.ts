/**
 * Video endpoints per 01-api-overview.md.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../client';
import { buildInFlightKey } from '../inFlight';
import {
  VideoListSchema,
  VideoSchema,
  parseWithSchema,
} from '../schemas';
import type { Video, Comment, ViewIncrementResponse, RateResponse } from '../../../types';

export async function getVideos(): Promise<Video[]> {
  const raw = await apiGet<Video[]>('/videos');
  return parseWithSchema(VideoListSchema, raw, 'getVideos') as Video[];
}

export async function getVideo(id: string): Promise<Video> {
  const raw = await apiGet<Video>(`/videos/${id}`);
  return parseWithSchema(VideoSchema, raw, 'getVideo') as Video;
}

export function getAuthorChannelUrl(
  sourceUrl: string
): Promise<{ success: boolean; channelUrl: string | null }> {
  return apiGet<{ success: boolean; channelUrl: string | null }>(
    `/videos/author-channel-url?sourceUrl=${encodeURIComponent(sourceUrl)}`
  );
}

export function getVideoComments(id: string): Promise<Comment[]> {
  return apiGet<Comment[]>(`/videos/${id}/comments`);
}

export function postVideoView(id: string): Promise<ViewIncrementResponse> {
  const path = `/videos/${id}/view`;
  return apiPost<ViewIncrementResponse>(
    path,
    undefined,
    buildInFlightKey('POST', path)
  );
}

export async function putVideoProgress(
  id: string,
  progress: number
): Promise<{ progress: number }> {
  const path = `/videos/${id}/progress`;
  return apiPut<{ progress: number }>(
    path,
    { progress },
    buildInFlightKey('PUT', path)
  );
}

export function postVideoRate(
  id: string,
  rating: number
): Promise<RateResponse> {
  const path = `/videos/${id}/rate`;
  return apiPost<RateResponse>(
    path,
    { rating },
    buildInFlightKey('POST', path)
  );
}

export function putVideo(
  id: string,
  data: Partial<Video>
): Promise<{ success: boolean; video: Video }> {
  return apiPut<{ success: boolean; video: Video }>(`/videos/${id}`, data);
}

export function deleteVideo(id: string): Promise<{ success: boolean }> {
  const path = `/videos/${id}`;
  return apiDelete<{ success: boolean }>(path, buildInFlightKey('DELETE', path));
}
