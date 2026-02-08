/**
 * Collections endpoints per 01-api-overview.md.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../client';
import { buildInFlightKey } from '../inFlight';
import type { Collection } from '../../../types';

export function getCollections(): Promise<Collection[]> {
  return apiGet<Collection[]>('/collections');
}

export function createCollection(
  name: string,
  videoId?: string
): Promise<Collection> {
  const path = '/collections';
  return apiPost<Collection>(
    path,
    videoId ? { name, videoId } : { name },
    buildInFlightKey('POST', path)
  );
}

export function updateCollection(
  id: string,
  payload: { name?: string; videoId?: string; action?: 'add' | 'remove' }
): Promise<Collection> {
  const path = `/collections/${id}`;
  return apiPut<Collection>(
    path,
    payload,
    buildInFlightKey('PUT', path)
  );
}

export function deleteCollection(
  id: string,
  deleteVideos?: boolean
): Promise<{ success: boolean; message?: string }> {
  const q = deleteVideos != null ? `?deleteVideos=${deleteVideos}` : '';
  const path = `/collections/${id}${q}`;
  return apiDelete<{ success: boolean; message?: string }>(
    path,
    buildInFlightKey('DELETE', path)
  );
}
