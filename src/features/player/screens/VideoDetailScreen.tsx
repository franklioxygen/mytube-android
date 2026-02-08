/**
 * Video detail: metadata, playback, comments, view/progress/rate.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  FlatList,
  Linking,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import Video from 'react-native-video';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getVideo,
  getVideoComments,
  getAuthorChannelUrl,
  postVideoView,
  putVideoProgress,
  postVideoRate,
} from '../../../core/api/endpoints/videos';
import { getCloudSignedUrl } from '../../../core/api/endpoints/cloud';
import {
  getCloudVideoRedirectUrl,
  getVideoPlaybackUrl,
} from '../../../core/utils/mediaUrl';
import { useAuth } from '../../../core/auth/AuthContext';
import { canMutate } from '../../../core/utils/roleGate';
import { CollectionRepository, collectionQueryKeys } from '../../../core/repositories';
import { useSnackbar } from '../../../app/providers';
import type { Video as VideoType, Comment, Collection } from '../../../types';

interface VideoDetailScreenProps {
  videoId: string;
  onBack: () => void;
  onAuthorPress?: (authorName: string) => void;
}

const PROGRESS_WRITE_INTERVAL_MS = 10000;
const VIEW_RESUME_GAP_MS = 5000;

function runAsync(task: Promise<unknown>): void {
  task.catch(() => {});
}

function getCloudSignedUrlValue(response: unknown): string | null {
  if (response == null || typeof response !== 'object') return null;
  const payload = response as { success?: unknown; url?: unknown };
  if (payload.success === false) return null;
  return typeof payload.url === 'string' && payload.url.length > 0
    ? payload.url
    : null;
}

export function VideoDetailScreen({ videoId, onBack, onAuthorPress }: VideoDetailScreenProps) {
  const { role, loginRequired } = useAuth();
  const canWrite = canMutate(role, loginRequired);
  const queryClient = useQueryClient();
  const { show, showError } = useSnackbar();
  const [addToCollectionModalVisible, setAddToCollectionModalVisible] = useState(false);
  const [video, setVideo] = useState<VideoType | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [authorChannelUrl, setAuthorChannelUrl] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const lastPlaybackTickAtRef = useRef(0);
  const viewInFlightRef = useRef(false);
  const lastViewWriteAtRef = useRef(0);
  const latestProgressRef = useRef(0);
  const pendingProgressRef = useRef<number | null>(null);
  const progressInFlightRef = useRef(false);
  const lastProgressWriteAtRef = useRef(0);
  const ratingInFlightRef = useRef(false);
  const pendingRatingRef = useRef<number | null>(null);

  const { data: collections = [] } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => CollectionRepository.getCollections(),
    select: list => (Array.isArray(list) ? list : []),
    enabled: addToCollectionModalVisible,
  });

  const addToCollectionMutation = useMutation({
    mutationFn: (collectionId: string) =>
      CollectionRepository.updateCollection(collectionId, { videoId, action: 'add' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
      setAddToCollectionModalVisible(false);
      show('Added to collection.');
    },
    onError: (err: { message?: string }) => {
      showError(err.message ?? 'Failed to add to collection');
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadVideo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const v = await getVideo(videoId);
      setVideo(v);
      setAuthorChannelUrl(null);
      setProgress(v.progress ?? 0);
      setRating(v.rating ?? null);
      latestProgressRef.current = v.progress ?? 0;
      pendingProgressRef.current = null;
      progressInFlightRef.current = false;
      lastProgressWriteAtRef.current = 0;
      lastPlaybackTickAtRef.current = 0;
      viewInFlightRef.current = false;
      lastViewWriteAtRef.current = 0;
      ratingInFlightRef.current = false;
      pendingRatingRef.current = null;

      let url = getVideoPlaybackUrl(v);
      if (!url && v.videoPath?.startsWith('cloud:')) {
        const name = v.videoPath.replace(/^cloud:/, '').trim();
        if (name.length > 0) {
          try {
            const res = await getCloudSignedUrl(name, 'video');
            const signedUrl = getCloudSignedUrlValue(res);
            if (signedUrl != null) {
              // Reuse media URL policy so HTTPS hosts reject downgraded cleartext URLs.
              url = getVideoPlaybackUrl({ ...v, signedUrl });
            }
          } catch {
            // Fallback below keeps details visible when signing endpoint is unavailable.
          }
          if (!url) {
            // 01-api-overview.md: cloud redirect route fallback.
            url = getCloudVideoRedirectUrl(name);
          }
        }
      }
      setPlaybackUrl(url);

      const list = await getVideoComments(videoId);
      setComments(Array.isArray(list) ? list : []);

      if (typeof v.sourceUrl === 'string' && v.sourceUrl.trim().length > 0) {
        try {
          const channel = await getAuthorChannelUrl(v.sourceUrl);
          if (
            channel.success &&
            typeof channel.channelUrl === 'string' &&
            channel.channelUrl.length > 0
          ) {
            setAuthorChannelUrl(channel.channelUrl);
          }
        } catch {
          // optional metadata enhancement
        }
      }
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const flushProgressWrite = useCallback(
    async function flushProgress(force: boolean = false): Promise<void> {
      if (!canWrite) return;
      if (progressInFlightRef.current) return;

      const nextProgress = pendingProgressRef.current;
      if (nextProgress == null) return;

      const now = Date.now();
      if (
        !force &&
        now - lastProgressWriteAtRef.current < PROGRESS_WRITE_INTERVAL_MS
      ) {
        return;
      }

      progressInFlightRef.current = true;
      pendingProgressRef.current = null;

      try {
        const res = await putVideoProgress(videoId, nextProgress);
        const persistedProgress = res.progress ?? nextProgress;
        lastProgressWriteAtRef.current = Date.now();
        latestProgressRef.current = persistedProgress;
        if (mountedRef.current) {
          setProgress(persistedProgress);
        }
      } catch {
        pendingProgressRef.current = nextProgress;
      } finally {
        progressInFlightRef.current = false;
        if (
          force &&
          pendingProgressRef.current != null &&
          pendingProgressRef.current !== nextProgress
        ) {
          await flushProgress(true);
        }
      }
    },
    [videoId, canWrite]
  );

  const postViewForPlaybackEvent = useCallback(async () => {
    const now = Date.now();
    if (viewInFlightRef.current) return;
    if (now - lastViewWriteAtRef.current < 1000) return;

    viewInFlightRef.current = true;
    try {
      await postVideoView(videoId);
      lastViewWriteAtRef.current = now;
    } catch {
      // ignore view increment errors
    } finally {
      viewInFlightRef.current = false;
    }
  }, [videoId]);

  const handleProgress = useCallback(
    (seconds: number) => {
      setProgress(seconds);
      latestProgressRef.current = seconds;
      if (!canWrite) return;

      pendingProgressRef.current = seconds;
      const now = Date.now();
      if (now - lastProgressWriteAtRef.current >= PROGRESS_WRITE_INTERVAL_MS) {
        runAsync(flushProgressWrite(false));
      }
    },
    [canWrite, flushProgressWrite]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState !== 'active') {
          runAsync(flushProgressWrite(true));
        }
      }
    );

    return () => {
      subscription.remove();
      runAsync(flushProgressWrite(true));
    };
  }, [flushProgressWrite]);

  const handleVideoProgressEvent = useCallback(
    ({ currentTime }: { currentTime: number }) => {
      const now = Date.now();
      const isPlaybackStartOrResume =
        lastPlaybackTickAtRef.current === 0 ||
        now - lastPlaybackTickAtRef.current > VIEW_RESUME_GAP_MS;

      if (isPlaybackStartOrResume) {
        runAsync(postViewForPlaybackEvent());
      }
      lastPlaybackTickAtRef.current = now;
      handleProgress(currentTime);
    },
    [handleProgress, postViewForPlaybackEvent]
  );

  const handleVideoEnd = useCallback(() => {
    handleProgress(0);
    pendingProgressRef.current = 0;
    runAsync(flushProgressWrite(true));
  }, [handleProgress, flushProgressWrite]);

  const handleBackPress = useCallback(() => {
    runAsync(flushProgressWrite(true));
    onBack();
  }, [flushProgressWrite, onBack]);

  const handleOpenAuthorChannel = useCallback(async () => {
    if (!authorChannelUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(authorChannelUrl);
      if (!canOpen) {
        showError('Could not open author channel URL.');
        return;
      }
      await Linking.openURL(authorChannelUrl);
    } catch {
      showError('Could not open author channel URL.');
    }
  }, [authorChannelUrl, showError]);

  const handleRate = useCallback(
    async function submitLatestRating(value: number) {
      if (!canWrite) return;

      pendingRatingRef.current = value;
      if (ratingInFlightRef.current) return;

      ratingInFlightRef.current = true;
      try {
        while (pendingRatingRef.current != null) {
          const nextRating = pendingRatingRef.current;
          pendingRatingRef.current = null;
          setRating(nextRating);
          try {
            const res = await postVideoRate(videoId, nextRating);
            if (mountedRef.current) {
              setRating(res.video?.rating ?? nextRating);
            }
          } catch {
            // keep optimistic value and allow next queued rating
          }
        }
      } finally {
        ratingInFlightRef.current = false;
      }
    },
    [videoId, canWrite]
  );

  if (loading && !video) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (error != null && !video) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!video) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {playbackUrl ? (
          <Video
            source={{ uri: playbackUrl }}
            style={styles.video}
            controls
            onProgress={handleVideoProgressEvent}
            onEnd={handleVideoEnd}
          />
        ) : (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <Text style={styles.placeholderText}>No playback URL</Text>
          </View>
        )}

        <View style={styles.meta}>
          <Text style={styles.title}>{video.title}</Text>
          {video.author != null &&
            (onAuthorPress != null ? (
              <TouchableOpacity onPress={() => onAuthorPress(video.author!)}>
                <Text style={styles.author}>{video.author}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.author}>{video.author}</Text>
            ))}
          {authorChannelUrl != null && (
            <TouchableOpacity onPress={() => runAsync(handleOpenAuthorChannel())}>
              <Text style={styles.channelLink}>Open author channel</Text>
            </TouchableOpacity>
          )}
          {video.description != null && (
            <Text style={styles.description} numberOfLines={5}>
              {video.description}
            </Text>
          )}
          {video.viewCount != null && (
            <Text style={styles.metaText}>{video.viewCount} views</Text>
          )}
          {progress > 0 && (
            <Text style={styles.metaText}>Resume from {Math.floor(progress)}s</Text>
          )}
        </View>

        {canWrite && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Rate: </Text>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.star, rating === n && styles.starActive]}
                onPress={() => handleRate(n)}
              >
                <Text style={styles.starText}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {canWrite && (
          <TouchableOpacity
            style={styles.addToCollectionButton}
            onPress={() => setAddToCollectionModalVisible(true)}
          >
            <Text style={styles.addToCollectionButtonText}>Add to collection</Text>
          </TouchableOpacity>
        )}

        <View style={styles.comments}>
          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet.</Text>
          ) : (
            comments.map(c => (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.commentAuthor}>{c.author}</Text>
                <Text style={styles.commentContent}>{c.content}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={addToCollectionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddToCollectionModalVisible(false)}
      >
        <Pressable
          style={styles.addToCollectionOverlay}
          onPress={() => setAddToCollectionModalVisible(false)}
        >
          <Pressable style={styles.addToCollectionModal} onPress={e => e.stopPropagation()}>
            <View style={styles.addToCollectionModalHeader}>
              <Text style={styles.addToCollectionModalTitle}>Add to collection</Text>
              <TouchableOpacity onPress={() => setAddToCollectionModalVisible(false)}>
                <Text style={styles.addToCollectionModalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            {addToCollectionMutation.isError && (
              <Text style={styles.addToCollectionError}>
                {(addToCollectionMutation.error as { message?: string }).message}
              </Text>
            )}
            <FlatList
              data={collections}
              keyExtractor={(c: Collection) => c.id}
              renderItem={({ item }: { item: Collection }) => (
                <TouchableOpacity
                  style={styles.addToCollectionRow}
                  onPress={() => addToCollectionMutation.mutate(item.id)}
                  disabled={addToCollectionMutation.isPending}
                >
                  <Text style={styles.addToCollectionRowText}>
                    {item.name ?? item.title ?? item.id}
                  </Text>
                  <Text style={styles.addToCollectionRowMeta}>
                    {item.videos?.length ?? 0} videos
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.addToCollectionEmpty}>No collections yet.</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  header: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
  },
  meta: {
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  author: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  channelLink: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  metaText: {
    color: '#888',
    fontSize: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  ratingLabel: {
    color: '#aaa',
    marginRight: 8,
  },
  star: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  starActive: {
    backgroundColor: '#0a7ea4',
  },
  starText: {
    color: '#fff',
    fontWeight: '600',
  },
  addToCollectionButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addToCollectionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addToCollectionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  addToCollectionModal: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  addToCollectionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addToCollectionModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  addToCollectionModalClose: {
    color: '#0a7ea4',
    fontSize: 14,
  },
  addToCollectionError: {
    color: '#f66',
    fontSize: 13,
    marginBottom: 8,
  },
  addToCollectionRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  addToCollectionRowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  addToCollectionRowMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  addToCollectionEmpty: {
    color: '#666',
    textAlign: 'center',
    padding: 24,
  },
  comments: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  commentsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  noComments: {
    color: '#666',
  },
  comment: {
    marginBottom: 12,
  },
  commentAuthor: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  commentContent: {
    color: '#ccc',
    fontSize: 14,
  },
});
