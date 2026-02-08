/**
 * Author list or videos by author. Phase 5.
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import type { MainStackParamList } from '../../../app/navigation/RootNavigator';
import { VideoRepository, videoQueryKeys } from '../../../core/repositories';
import { getThumbnailUrl } from '../../../core/utils/mediaUrl';
import { useAuth } from '../../../core/auth/AuthContext';
import type { Video } from '../../../types';

interface AuthorScreenProps {
  authorName?: string;
  onVideoPress: (videoId: string) => void;
}

/** Visitor cannot see videos with visibility=0 (hidden). */
function filterVisibleForRole(videos: Video[], role: 'admin' | 'visitor' | null): Video[] {
  if (role !== 'visitor') return videos;
  return videos.filter(v => v.visibility !== 0);
}

function getUniqueAuthors(videos: Video[]): string[] {
  const set = new Set<string>();
  for (const v of videos) {
    if (v.author != null && v.author.trim() !== '') set.add(v.author);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function AuthorScreen({ authorName, onVideoPress }: AuthorScreenProps) {
  const { role } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

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

  const displayVideos = useMemo(
    () => filterVisibleForRole(videos, role),
    [videos, role]
  );

  const authors = useMemo(() => getUniqueAuthors(displayVideos), [displayVideos]);

  const videosByAuthor = useMemo(
    () => (authorName ? displayVideos.filter(v => v.author === authorName) : []),
    [displayVideos, authorName]
  );

  const isAuthorListMode = authorName == null || authorName === '';
  const errorMessage =
    error != null
      ? (error as { message?: string }).message ?? 'Failed to load videos'
      : null;

  const onAuthorSelect = useCallback(
    (name: string) => {
      navigation.navigate('Author', { authorName: name });
    },
    [navigation]
  );

  const renderAuthorItem = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={styles.authorRow}
        onPress={() => onAuthorSelect(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.authorName}>{item}</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    ),
    [onAuthorSelect]
  );

  const renderVideoItem = useCallback(
    ({ item }: { item: Video }) => {
      const thumb = getThumbnailUrl(item);
      return (
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
            {item.duration != null && (
              <Text style={styles.meta}>{item.duration}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [onVideoPress]
  );

  if (loading && videos.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          {isAuthorListMode ? 'Loading authors…' : 'Loading videos…'}
        </Text>
      </View>
    );
  }

  if (errorMessage != null && videos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isAuthorListMode) {
    if (authors.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No authors found.</Text>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <FlatList
          data={authors}
          renderItem={renderAuthorItem}
          keyExtractor={item => item}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => refetch()}
        />
      </View>
    );
  }

  if (videosByAuthor.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No videos for this author.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={videosByAuthor}
        renderItem={renderVideoItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
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
    backgroundColor: '#1a1a1a',
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
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 8,
  },
  authorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    color: '#888',
    fontSize: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
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
  meta: {
    color: '#888',
    fontSize: 12,
  },
});
