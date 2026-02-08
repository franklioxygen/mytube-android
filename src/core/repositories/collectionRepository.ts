/**
 * Collection repository: wraps collection endpoints.
 */

import * as collectionEndpoints from '../api/endpoints/collections';
import type { Collection } from '../../types';
import { queryKeys } from './queryKeys';

export const collectionQueryKeys = {
  all: queryKeys.collections,
  detail: queryKeys.collection,
};

export const CollectionRepository = {
  getCollections: (): Promise<Collection[]> =>
    collectionEndpoints.getCollections(),

  createCollection: (name: string, videoId?: string): Promise<Collection> =>
    collectionEndpoints.createCollection(name, videoId),

  updateCollection: (
    id: string,
    payload: { name?: string; videoId?: string; action?: 'add' | 'remove' }
  ): Promise<Collection> => collectionEndpoints.updateCollection(id, payload),

  deleteCollection: (
    id: string,
    deleteVideos?: boolean
  ): Promise<{ success: boolean; message?: string }> =>
    collectionEndpoints.deleteCollection(id, deleteVideos),
};
