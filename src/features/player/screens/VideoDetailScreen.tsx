/**
 * Video detail: metadata, playback, comments, view/progress/rate.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Image,
  Switch,
  useWindowDimensions,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import Video from 'react-native-video';
import type { VideoRef } from 'react-native-video';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getVideo,
  getVideoComments,
  getAuthorChannelUrl,
  postVideoView,
  putVideoProgress,
  postVideoRate,
} from '../../../core/api/endpoints/videos';
import {
  SettingsRepository,
  settingsQueryKeys,
  VideoRepository,
  videoQueryKeys,
} from '../../../core/repositories';
import { getCloudSignedUrl } from '../../../core/api/endpoints/cloud';
import {
  getCloudVideoRedirectUrl,
  getVideoPlaybackUrl,
  getThumbnailUrl,
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
  onVideoPress?: (videoId: string) => void;
}

/** Format duration string: if it's a plain number of seconds, convert to mm:ss or h:mm:ss. */
function formatDuration(duration: string): string {
  const secs = Number(duration);
  if (!Number.isFinite(secs) || duration.includes(':')) return duration;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
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

export function VideoDetailScreen({ videoId, onBack, onAuthorPress, onVideoPress }: VideoDetailScreenProps) {
  const { width, height } = useWindowDimensions();
  const shortEdge = Math.min(width, height);
  const isTabletLandscape = shortEdge >= 600 && width > height;

  const { role, loginRequired } = useAuth();
  const canWrite = canMutate(role, loginRequired);
  const queryClient = useQueryClient();
  const { show, showError } = useSnackbar();
  const [addToCollectionModalVisible, setAddToCollectionModalVisible] = useState(false);
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [video, setVideo] = useState<VideoType | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
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
  const videoRef = useRef<VideoRef>(null);
  const currentTimeRef = useRef(0);

  const { data: collections = [] } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => CollectionRepository.getCollections(),
    select: list => (Array.isArray(list) ? list : []),
    enabled: addToCollectionModalVisible,
  });

  const { data: settings } = useQuery({
    queryKey: settingsQueryKeys.settings,
    queryFn: () => SettingsRepository.getSettings(),
  });
  const autoPlay = Boolean(settings?.autoPlayVideo);

  const { data: allVideos = [] } = useQuery({
    queryKey: videoQueryKeys.all,
    queryFn: () => VideoRepository.getVideos(),
    select: list => (Array.isArray(list) ? list : []),
  });
  const upNextVideos = useMemo(
    () => allVideos.filter(v => v.id !== videoId),
    [allVideos, videoId]
  );

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

  const handleLoadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const list = await getVideoComments(videoId);
      setComments(Array.isArray(list) ? list : []);
      setCommentsLoaded(true);
    } catch {
      // silently fail — user can retry
    } finally {
      setCommentsLoading(false);
    }
  }, [videoId]);

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
      currentTimeRef.current = currentTime;
      handleProgress(currentTime);
    },
    [handleProgress, postViewForPlaybackEvent]
  );

  const handleSeek = useCallback((offsetSeconds: number) => {
    const next = Math.max(0, currentTimeRef.current + offsetSeconds);
    videoRef.current?.seek(next);
    currentTimeRef.current = next;
  }, []);

  const handleVideoEnd = useCallback(() => {
    setIsPaused(true);
    handleProgress(0);
    pendingProgressRef.current = 0;
    runAsync(flushProgressWrite(true));
  }, [handleProgress, flushProgressWrite]);

  useEffect(() => {
    setIsPaused(!autoPlay);
  }, [autoPlay]);

  const handleTogglePlay = useCallback(() => {
    setIsPaused(p => !p);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      videoRef.current?.dismissFullscreenPlayer();
    } else {
      videoRef.current?.presentFullscreenPlayer();
    }
  }, [isFullscreen]);

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

  const playerAndMeta = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {playbackUrl ? (
        <>
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: playbackUrl }}
              style={styles.video}
              paused={isPaused}
              rate={playbackRate}
              onProgress={handleVideoProgressEvent}
              onEnd={handleVideoEnd}
              onFullscreenPlayerDidPresent={() => setIsFullscreen(true)}
              onFullscreenPlayerDidDismiss={() => setIsFullscreen(false)}
            />
            <Pressable style={StyleSheet.absoluteFillObject} onPress={handleTogglePlay} />
            {isPaused && (
              <View style={styles.pauseIndicator} pointerEvents="none">
                <MaterialIcons name="play-arrow" size={72} color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </View>
          <View style={styles.controlsBar}>
            <View style={styles.controlsRow}>
              <Pressable style={({ pressed }) => [styles.controlBtn, pressed && styles.seekBtnPressed]} onPress={handleTogglePlay}>
                <MaterialIcons name={isPaused ? 'play-arrow' : 'pause'} size={28} color="#fff" />
              </Pressable>
              <View style={styles.controlsRowSpacer} />
              <Pressable style={({ pressed }) => [styles.controlBtn, pressed && styles.seekBtnPressed]} onPress={handleToggleFullscreen}>
                <MaterialIcons name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={28} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.seekBar}>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.seekBtnPressed]} onPress={() => handleSeek(-600)}>
                <MaterialIcons name="keyboard-double-arrow-left" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.seekBtnPressed]} onPress={() => handleSeek(-60)}>
                <MaterialIcons name="fast-rewind" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.seekBtnPressed]} onPress={() => handleSeek(-10)}>
                <MaterialIcons name="replay-10" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.seekBtnPressed]} onPress={() => handleSeek(10)}>
                <MaterialIcons name="forward-10" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.seekBtnPressed]} onPress={() => handleSeek(60)}>
                <MaterialIcons name="fast-forward" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.seekBtnPressed]} onPress={() => handleSeek(600)}>
                <MaterialIcons name="keyboard-double-arrow-right" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.seekBtnPressed]} onPress={() => setSpeedModalVisible(true)}>
                <Text style={styles.speedBtnText}>{playbackRate === 1 ? '1×' : `${playbackRate}×`}</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <View style={[styles.videoContainer, styles.videoPlaceholder]}>
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
            <TouchableOpacity key={n} onPress={() => handleRate(n)} style={styles.starButton}>
              <Text style={[styles.starText, rating != null && n <= rating && styles.starTextActive]}>
                {rating != null && n <= rating ? '★' : '☆'}
              </Text>
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
        {!commentsLoaded ? (
          <TouchableOpacity
            style={styles.loadCommentsButton}
            onPress={() => runAsync(handleLoadComments())}
            disabled={commentsLoading}
          >
            <Text style={styles.loadCommentsButtonText}>
              {commentsLoading ? 'Loading…' : 'Load comments'}
            </Text>
          </TouchableOpacity>
        ) : comments.length === 0 ? (
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

      {!isTabletLandscape && (
        <View style={styles.upNextInline}>
          <View style={styles.upNextHeader}>
            <Text style={styles.upNextTitle}>Up Next</Text>
            <View style={styles.upNextAutoPlayRow}>
              <Text style={styles.upNextAutoPlayLabel}>Auto-play Next</Text>
              <Switch
                value={autoPlayNext}
                onValueChange={setAutoPlayNext}
                trackColor={{ false: '#444', true: '#0a7ea4' }}
                thumbColor="#fff"
              />
            </View>
          </View>
          {upNextVideos.length === 0 ? (
            <Text style={styles.upNextEmpty}>No videos.</Text>
          ) : (
            upNextVideos.map(item => {
              const thumb = getThumbnailUrl(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.upNextItem}
                  onPress={() => onVideoPress?.(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.upNextThumbWrap}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.upNextThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.upNextThumb, styles.upNextThumbPlaceholder]} />
                    )}
                    {item.duration != null && (
                      <View style={styles.upNextDurationBadge}>
                        <Text style={styles.upNextDurationText}>{formatDuration(item.duration)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.upNextInfo}>
                    <Text style={styles.upNextItemTitle} numberOfLines={2}>{item.title}</Text>
                    {item.author != null && (
                      <Text style={styles.upNextItemAuthor} numberOfLines={1}>{item.author}</Text>
                    )}
                    <Text style={styles.upNextItemMeta}>
                      {[item.date, item.viewCount != null ? `${item.viewCount} views` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );

  const upNextSidebar = (
    <View style={styles.upNextSidebar}>
      <View style={styles.upNextHeader}>
        <Text style={styles.upNextTitle}>Up Next</Text>
        <View style={styles.upNextAutoPlayRow}>
          <Text style={styles.upNextAutoPlayLabel}>Auto-play Next</Text>
          <Switch
            value={autoPlayNext}
            onValueChange={setAutoPlayNext}
            trackColor={{ false: '#444', true: '#0a7ea4' }}
            thumbColor="#fff"
          />
        </View>
      </View>
      <FlatList
        data={upNextVideos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const thumb = getThumbnailUrl(item);
          return (
            <TouchableOpacity
              style={styles.upNextItem}
              onPress={() => onVideoPress?.(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.upNextThumbWrap}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.upNextThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.upNextThumb, styles.upNextThumbPlaceholder]} />
                )}
                {item.duration != null && (
                  <View style={styles.upNextDurationBadge}>
                    <Text style={styles.upNextDurationText}>{formatDuration(item.duration)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.upNextInfo}>
                <Text style={styles.upNextItemTitle} numberOfLines={2}>{item.title}</Text>
                {item.author != null && (
                  <Text style={styles.upNextItemAuthor} numberOfLines={1}>{item.author}</Text>
                )}
                <Text style={styles.upNextItemMeta}>
                  {[item.date, item.viewCount != null ? `${item.viewCount} views` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.upNextEmpty}>No videos.</Text>}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {isTabletLandscape ? (
        <View style={styles.tabletRow}>
          <View style={styles.tabletMain}>{playerAndMeta}</View>
          {upNextSidebar}
        </View>
      ) : (
        playerAndMeta
      )}

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

      <Modal
        visible={speedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpeedModalVisible(false)}
      >
        <Pressable style={styles.speedOverlay} onPress={() => setSpeedModalVisible(false)}>
          <Pressable style={styles.speedModal} onPress={e => e.stopPropagation()}>
            <Text style={styles.speedModalTitle}>Playback speed</Text>
            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(speed => (
              <TouchableOpacity
                key={speed}
                style={[styles.speedOption, playbackRate === speed && styles.speedOptionActive]}
                onPress={() => { setPlaybackRate(speed); setSpeedModalVisible(false); }}
              >
                <Text style={[styles.speedOptionText, playbackRate === speed && styles.speedOptionTextActive]}>
                  {speed === 1 ? '1× (Normal)' : `${speed}×`}
                </Text>
                {playbackRate === speed && (
                  <MaterialIcons name="check" size={18} color="#0a7ea4" />
                )}
              </TouchableOpacity>
            ))}
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
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  pauseIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
  },
  controlsBar: {
    backgroundColor: '#111',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  controlsRowSpacer: {
    flex: 1,
  },
  seekBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  seekBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  speedBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  speedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedModal: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 220,
  },
  speedModalTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  speedOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  speedOptionActive: {
    backgroundColor: 'rgba(10,126,164,0.1)',
  },
  speedOptionText: {
    color: '#fff',
    fontSize: 15,
  },
  speedOptionTextActive: {
    color: '#0a7ea4',
    fontWeight: '600',
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
  starButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  starText: {
    fontSize: 28,
    color: '#555',
  },
  starTextActive: {
    color: '#f5c518',
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
  loadCommentsButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#333',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  loadCommentsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  // Inline Up Next section (portrait / phone)
  upNextInline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    marginTop: 8,
  },
  // Tablet landscape two-column layout
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletMain: {
    flex: 1,
  },
  // Up Next sidebar
  upNextSidebar: {
    width: 340,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  upNextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  upNextTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  upNextAutoPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upNextAutoPlayLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  upNextItem: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  upNextThumbWrap: {
    width: 120,
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 4,
    overflow: 'hidden',
  },
  upNextThumb: {
    width: '100%',
    height: '100%',
  },
  upNextThumbPlaceholder: {
    backgroundColor: '#2a2a2a',
  },
  upNextDurationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  upNextDurationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  upNextInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  upNextItemTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
    lineHeight: 18,
  },
  upNextItemAuthor: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 2,
  },
  upNextItemMeta: {
    color: '#666',
    fontSize: 11,
  },
  upNextEmpty: {
    color: '#666',
    padding: 16,
    textAlign: 'center',
  },
});
