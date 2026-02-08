/**
 * Video endpoints per 01-api-overview.md.
 */

import { apiGet, apiPost, apiPut } from '../client';
import { buildInFlightKey } from '../inFlight';
import type { Video, Comment, ViewIncrementResponse, RateResponse } from '../../../types';

export function getVideos(): Promise<Video[]> {
  return apiGet<Video[]>('/videos');
}

export function getVideo(id: string): Promise<Video> {
  return apiGet<Video>(`/videos/${id}`);
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
