/**
 * Collection detail: name and list of videos. Phase 6.
 */

import React, { useCallback, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CollectionRepository, collectionQueryKeys } from '../../../core/repositories';
import { VideoRepository, videoQueryKeys } from '../../../core/repositories';
import { getThumbnailUrl } from '../../../core/utils/mediaUrl';
import { getVideoCardColumns } from '../../../core/utils/layout';
import { useAuth } from '../../../core/auth/AuthContext';
import { canMutate } from '../../../core/utils/roleGate';
import { useSnackbar } from '../../../app/providers';
import type { MainStackParamList } from '../../../app/navigation/RootNavigator';
import type { Video } from '../../../types';

type Props = NativeStackScreenProps<MainStackParamList, 'CollectionDetail'>;

/** Visitor cannot see videos with visibility=0 (hidden). */
function filterVisibleForRole(videos: Video[], role: 'admin' | 'visitor' | null): Video[] {
  if (role !== 'visitor') return videos;
  return videos.filter(v => v.visibility !== 0);
}

export function CollectionDetailScreen({ route }: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const { width, height } = useWindowDimensions();
  const numColumns = getVideoCardColumns(width, height);
  const isGrid = numColumns > 1;
  const { role, loginRequired } = useAuth();
  const queryClient = useQueryClient();
  const { show, showError } = useSnackbar();
  const collectionId = route.params?.collectionId ?? '';
  const canEdit = canMutate(role, loginRequired);

  const removeMutation = useMutation({
    mutationFn: (videoId: string) =>
      CollectionRepository.updateCollection(collectionId, { videoId, action: 'remove' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
      show('Removed from collection.');
    },
    onError: (err: { message?: string }) => {
      showError(err.message ?? 'Failed to remove from collection');
    },
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

  const collection = useMemo(
    () => collections.find(c => c.id === collectionId) ?? null,
    [collections, collectionId]
  );

  const displayVideos = useMemo(() => {
    if (!collection?.videos?.length) return [];
    const videoMap = new Map(videos.map(v => [v.id, v]));
    const visible = filterVisibleForRole(videos, role);
    const visibleIds = new Set(visible.map(v => v.id));
    const ordered: Video[] = [];
    for (const id of collection.videos) {
      const v = videoMap.get(id);
      if (v != null && visibleIds.has(id)) ordered.push(v);
    }
    return ordered;
  }, [collection, videos, role]);

  const loading =
    (collectionsLoading && collections.length === 0) || (videosLoading && videos.length === 0);
  const refreshing = collectionsRefreshing || videosRefreshing;
  const refetch = useCallback(() => {
    refetchCollections();
    refetchVideos();
  }, [refetchCollections, refetchVideos]);

  const collectionsErrorMsg =
    collectionsError != null
      ? (collectionsError as { message?: string }).message ?? 'Failed to load collections'
      : null;
  const videosErrorMsg =
    videosError != null
      ? (videosError as { message?: string }).message ?? 'Failed to load videos'
      : null;
  const errorMessage = collectionsErrorMsg ?? videosErrorMsg;

  const onVideoPress = useCallback(
    (videoId: string) => {
      navigation.navigate('VideoDetail', { videoId });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Video }) => {
      const thumb = getThumbnailUrl(item);
      return (
        <View style={[styles.cardWrap, isGrid && styles.cardWrapGrid]}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardTouchable}
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
                <Text style={styles.cardTitle} numberOfLines={2}>
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
            {canEdit && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeMutation.mutate(item.id)}
                disabled={removeMutation.isPending}
                accessibilityLabel="Remove from collection"
              >
                <Text style={styles.removeBtnText}>
                  {removeMutation.isPending ? '…' : 'Remove'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [onVideoPress, canEdit, removeMutation, isGrid]
  );

  const keyExtractor = useCallback((item: Video) => item.id, []);

  if (loading && !collection) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (errorMessage != null && !collection && collections.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Collection not found.</Text>
      </View>
    );
  }

  if (displayVideos.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.collectionName}>
            {collection.name ?? collection.title ?? collectionId}
          </Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No videos in this collection.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.collectionName}>
          {collection.name ?? collection.title ?? collectionId}
        </Text>
      </View>
      <FlatList
        key={`collection-videos-${numColumns}`}
        data={displayVideos}
        numColumns={numColumns}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        refreshing={refreshing}
        onRefresh={refetch}
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
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  collectionName: {
    color: '#fff',
    fontSize: 20,
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
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardTouchable: {
    flex: 1,
    flexDirection: 'row',
  },
  removeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: '#5a2a2a',
    borderRadius: 8,
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 13,
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
  cardTitle: {
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
