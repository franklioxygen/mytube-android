/**
 * Manage: videos and collections hub. Phase 5.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { VideoRepository, videoQueryKeys } from '../../../core/repositories';
import { CollectionRepository, collectionQueryKeys } from '../../../core/repositories';
import { getThumbnailUrl } from '../../../core/utils/mediaUrl';
import { useAuth } from '../../../core/auth/AuthContext';
import type { Video, Collection } from '../../../types';

interface ManageScreenProps {
  onVideoPress: (videoId: string) => void;
  onCollectionPress: (collectionId: string) => void;
}

/** Visitor cannot see videos with visibility=0 (hidden). */
function filterVisibleForRole(videos: Video[], role: 'admin' | 'visitor' | null): Video[] {
  if (role !== 'visitor') return videos;
  return videos.filter(v => v.visibility !== 0);
}

export function ManageScreen({ onVideoPress, onCollectionPress }: ManageScreenProps) {
  const { role } = useAuth();

  const {
    data: videos = [],
    isLoading: videosLoading,
    isRefetching: videosRefreshing,
    error: videosError,
    refetch: refetchVideos,
  } = useQuery({
    queryKey: videoQueryKeys.all,
    queryFn: () => VideoRepository.getVideos(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const {
    data: collections = [],
    isLoading: collectionsLoading,
    isRefetching: collectionsRefreshing,
    error: collectionsError,
    refetch: refetchCollections,
  } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => CollectionRepository.getCollections(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const displayVideos = useMemo(
    () => filterVisibleForRole(videos, role),
    [videos, role]
  );

  const refreshing = videosRefreshing || collectionsRefreshing;
  const onRefresh = useCallback(() => {
    refetchVideos();
    refetchCollections();
  }, [refetchVideos, refetchCollections]);

  const videosErrorMsg =
    videosError != null
      ? (videosError as { message?: string }).message ?? 'Failed to load videos'
      : null;
  const collectionsErrorMsg =
    collectionsError != null
      ? (collectionsError as { message?: string }).message ?? 'Failed to load collections'
      : null;

  const loading =
    (videosLoading && videos.length === 0) || (collectionsLoading && collections.length === 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a7ea4" />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Videos</Text>
        {videosErrorMsg != null && displayVideos.length === 0 ? (
          <Text style={styles.errorText}>{videosErrorMsg}</Text>
        ) : displayVideos.length === 0 ? (
          <Text style={styles.emptyText}>No videos.</Text>
        ) : (
          displayVideos.map(v => {
            const thumb = getThumbnailUrl(v);
            return (
              <TouchableOpacity
                key={v.id}
                style={styles.videoRow}
                onPress={() => onVideoPress(v.id)}
                activeOpacity={0.7}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={styles.thumbPlaceholderText}>—</Text>
                  </View>
                )}
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {v.title}
                  </Text>
                  {v.author != null && (
                    <Text style={styles.videoMeta} numberOfLines={1}>
                      {v.author}
                    </Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Collections</Text>
        {collectionsErrorMsg != null && collections.length === 0 ? (
          <Text style={styles.errorText}>{collectionsErrorMsg}</Text>
        ) : collections.length === 0 ? (
          <Text style={styles.emptyText}>No collections yet.</Text>
        ) : (
          collections.map((c: Collection) => (
            <TouchableOpacity
              key={c.id}
              style={styles.collectionRow}
              onPress={() => onCollectionPress(c.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.collectionName}>{c.name ?? c.title ?? c.id}</Text>
              <Text style={styles.collectionMeta}>
                {c.videos?.length ?? 0} videos
              </Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  errorText: {
    color: '#f66',
    fontSize: 14,
    marginBottom: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  thumb: {
    width: 80,
    height: 45,
    backgroundColor: '#333',
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: {
    color: '#666',
    fontSize: 12,
  },
  videoInfo: {
    flex: 1,
    padding: 12,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  videoMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  collectionName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  collectionMeta: {
    color: '#888',
    fontSize: 14,
    marginRight: 8,
  },
  chevron: {
    color: '#888',
    fontSize: 20,
  },
});
