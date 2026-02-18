/**
 * Search screen: client-side search over /api/videos.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../app/navigation/RootNavigator';
import { VideoRepository, videoQueryKeys } from '../../../core/repositories';
import { getThumbnailUrl } from '../../../core/utils/mediaUrl';
import { getVideoCardColumns } from '../../../core/utils/layout';
import { useAuth } from '../../../core/auth/AuthContext';
import type { Video } from '../../../types';

type Props = NativeStackScreenProps<MainStackParamList, 'Search'>;

function filterVisibleForRole(videos: Video[], role: 'admin' | 'visitor' | null): Video[] {
  if (role !== 'visitor') return videos;
  return videos.filter(v => v.visibility !== 0);
}

function toSearchText(video: Video): string {
  const tags = Array.isArray(video.tags) ? video.tags.join(' ') : '';
  return [video.title, video.author, video.description, tags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function SearchScreen({ route, navigation }: Props) {
  const { role } = useAuth();
  const { width, height } = useWindowDimensions();
  const numColumns = getVideoCardColumns(width, height);
  const isGrid = numColumns > 1;
  const initialQuery = route.params?.query ?? '';
  const [searchText, setSearchText] = useState(initialQuery);

  useEffect(() => {
    setSearchText(initialQuery);
  }, [initialQuery]);

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

  const visibleVideos = useMemo(
    () => filterVisibleForRole(videos, role),
    [videos, role]
  );
  const normalizedQuery = searchText.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) return visibleVideos;
    return visibleVideos.filter(video => toSearchText(video).includes(normalizedQuery));
  }, [visibleVideos, normalizedQuery]);

  const errorMessage =
    error != null
      ? (error as { message?: string }).message ?? 'Failed to load videos'
      : null;

  if (loading && videos.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.subtitle}>Loading videos…</Text>
      </View>
    );
  }

  if (errorMessage != null && results.length === 0) {
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
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search videos"
          placeholderTextColor="#888"
          returnKeyType="search"
        />
        <Text style={styles.resultMeta}>
          {results.length} result{results.length === 1 ? '' : 's'}
        </Text>
      </View>

      {results.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>
            {normalizedQuery ? 'No matches found.' : 'No videos available.'}
          </Text>
        </View>
      ) : (
        <FlatList
          key={`search-videos-${numColumns}`}
          data={results}
          numColumns={numColumns}
          keyExtractor={item => item.id}
          refreshing={refreshing}
          onRefresh={() => refetch()}
          contentContainerStyle={styles.list}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
          renderItem={({ item }) => {
            const thumb = getThumbnailUrl(item);
            return (
              <View style={[styles.cardWrap, isGrid && styles.cardWrapGrid]}>
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => navigation.navigate('VideoDetail', { videoId: item.id })}
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
                      <Text style={styles.meta} numberOfLines={1}>
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
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  input: {
    height: 42,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  resultMeta: {
    color: '#888',
    fontSize: 12,
  },
  list: {
    padding: 16,
    paddingTop: 8,
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  },
  meta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
  },
  errorText: {
    color: '#f66',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
