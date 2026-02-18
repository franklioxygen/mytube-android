/**
 * Home/feed: list videos via VideoRepository and React Query.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { VideoRepository, videoQueryKeys } from '../../../core/repositories';
import { getThumbnailUrl } from '../../../core/utils/mediaUrl';
import { getVideoCardColumns } from '../../../core/utils/layout';
import { useAuth } from '../../../core/auth/AuthContext';
import type { Video } from '../../../types';

interface HomeScreenProps {
  onVideoPress: (videoId: string) => void;
}

/** Visitor cannot see videos with visibility=0 (hidden). */
function filterVisibleForRole(videos: Video[], role: 'admin' | 'visitor' | null): Video[] {
  if (role !== 'visitor') return videos;
  return videos.filter(v => v.visibility !== 0);
}

export function HomeScreen({ onVideoPress }: HomeScreenProps) {
  const { role } = useAuth();
  const { width, height } = useWindowDimensions();
  const numColumns = getVideoCardColumns(width, height);
  const isGrid = numColumns > 1;
  const {
    data: videos = [],
    isLoading: loading,
    isRefetching: refreshing,
    error,
    refetch,
  } = useQuery({
    queryKey: videoQueryKeys.all,
    queryFn: () => VideoRepository.getVideos(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const displayVideos = filterVisibleForRole(videos, role);

  const errorMessage =
    error != null
      ? (error as { message?: string }).message ?? 'Failed to load videos'
      : null;

  const renderItem = useCallback(
    ({ item }: { item: Video }) => {
      const thumb = getThumbnailUrl(item);
      return (
        <View style={[styles.cardWrap, isGrid && styles.cardWrapGrid]}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => onVideoPress(item.id)}
            activeOpacity={0.7}
          >
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbPlaceholderText}>No thumb</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              {item.author != null && (
                <Text style={styles.author} numberOfLines={1}>
                  {item.author}
                </Text>
              )}
              {item.duration != null && (
                <Text style={styles.meta}>{item.duration}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [onVideoPress, isGrid]
  );

  const keyExtractor = useCallback((item: Video) => item.id, []);

  if (loading && displayVideos.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading videos…</Text>
      </View>
    );
  }

  if (errorMessage != null && displayVideos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={`home-videos-${numColumns}`}
        data={displayVideos}
        numColumns={numColumns}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        refreshing={refreshing}
        onRefresh={() => refetch()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },
  errorText: {
    color: '#f66',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  cardWrap: {
    marginBottom: 12,
  },
  cardWrapGrid: {
    flex: 1,
    marginHorizontal: 6,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: 120,
    height: 68,
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
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  author: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 2,
  },
  meta: {
    color: '#888',
    fontSize: 12,
  },
});
