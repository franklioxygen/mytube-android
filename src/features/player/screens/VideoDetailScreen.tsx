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
  PanResponder,
  Share,
  TextInput,
} from 'react-native';
import type { AppStateStatus, LayoutChangeEvent } from 'react-native';
import Video, { TextTrackType, SelectedTrackType } from 'react-native-video';
import type { VideoRef, TextTracks, OnLoadData } from 'react-native-video';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getVideo,
  getVideoComments,
  getAuthorChannelUrl,
  postVideoView,
  putVideoProgress,
  postVideoRate,
  putVideo,
  deleteVideo,
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
  getAuthorAvatarUrl,
} from '../../../core/utils/mediaUrl';
import { getRuntimeHostBase } from '../../../core/api/runtimeBaseUrl';
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

function formatSeconds(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format duration string: if it's a plain number of seconds, convert to mm:ss or h:mm:ss. */
function formatDuration(duration: string): string {
  const secs = Number(duration);
  if (!Number.isFinite(secs) || duration.includes(':')) return duration;
  return formatSeconds(secs);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function resolveFromHeight(h: number): string {
  if (h >= 2160) return '4K';
  if (h >= 1440) return '1440P';
  if (h >= 1080) return '1080P';
  if (h >= 720) return '720P';
  if (h >= 480) return '480P';
  if (h >= 360) return '360P';
  if (h >= 240) return '240P';
  return `${h}P`;
}

function sourceLabel(source: string | undefined): string {
  if (!source) return 'Unknown';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/** Format YYYYMMDD or ISO-like date strings to YYYY-MM-DD; returns null when not parseable. */
function formatPublishDate(date: string | undefined): string | null {
  if (!date) return null;
  if (/^\d{8}$/.test(date)) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  }
  const ms = new Date(date).getTime();
  if (Number.isFinite(ms) && ms > 0) {
    return new Date(ms).toISOString().split('T')[0];
  }
  return null;
}

/** Draggable progress slider with time display. */
function ProgressSlider({
  currentTime,
  duration,
  onSeekTo,
}: {
  currentTime: number;
  duration: number;
  onSeekTo: (seconds: number) => void;
}) {
  const [seekRatio, setSeekRatio] = useState<number | null>(null);
  const widthRef = useRef(0);
  const latestRef = useRef({ duration, onSeekTo });
  latestRef.current = { duration, onSeekTo };

  const ratio = duration > 0 ? clamp01(currentTime / duration) : 0;
  const displayRatio = seekRatio !== null ? seekRatio : ratio;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (widthRef.current > 0 && latestRef.current.duration > 0) {
          setSeekRatio(clamp01(e.nativeEvent.locationX / widthRef.current));
        }
      },
      onPanResponderMove: (e) => {
        if (widthRef.current > 0) {
          setSeekRatio(clamp01(e.nativeEvent.locationX / widthRef.current));
        }
      },
      onPanResponderRelease: (e) => {
        const w = widthRef.current;
        const { duration: d, onSeekTo: seek } = latestRef.current;
        if (w > 0 && d > 0) {
          seek(clamp01(e.nativeEvent.locationX / w) * d);
        }
        setSeekRatio(null);
      },
      onPanResponderTerminate: () => setSeekRatio(null),
    })
  ).current;

  const pct = `${(displayRatio * 100).toFixed(2)}%` as unknown as number;

  return (
    <View style={sliderStyles.row}>
      <Text style={sliderStyles.time}>{formatSeconds(currentTime)}</Text>
      <View
        style={sliderStyles.track}
        onLayout={(e: LayoutChangeEvent) => {
          widthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={sliderStyles.rail} />
        <View style={[sliderStyles.fill, { width: pct }]} />
        <View style={[sliderStyles.thumb, { left: pct, marginLeft: -7 }]} />
      </View>
      <Text style={sliderStyles.time}>{formatSeconds(duration)}</Text>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  time: {
    color: '#ccc',
    fontSize: 11,
    minWidth: 38,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    height: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: '#0a7ea4',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    top: 3,
  },
});

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
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const shortEdge = Math.min(width, height);
  const isTabletLandscape = shortEdge >= 600 && width > height;

  const { role, loginRequired } = useAuth();
  const canWrite = canMutate(role, loginRequired);
  const queryClient = useQueryClient();
  const { show, showError } = useSnackbar();

  // Modal states
  const [addToCollectionModalVisible, setAddToCollectionModalVisible] = useState(false);
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [tagsModalVisible, setTagsModalVisible] = useState(false);

  // Playback state
  const [playbackRate, setPlaybackRate] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const isLoopingRef = useRef(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(0);

  // Data state
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
  const [videoResolution, setVideoResolution] = useState<string | null>(null);

  // Description + tags state
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionClamped, setDescriptionClamped] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [titleClamped, setTitleClamped] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [localTags, setLocalTags] = useState<string[]>([]);

  // Refs
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

  // Refs to avoid stale closures in callbacks
  const upNextVideosRef = useRef<VideoType[]>([]);
  const autoPlayNextRef = useRef(autoPlayNext);
  const onVideoPressRef = useRef(onVideoPress);

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
  const availableTags: string[] = useMemo(
    () => (Array.isArray(settings?.tags) ? settings.tags : []),
    [settings]
  );

  const { data: allVideos = [] } = useQuery({
    queryKey: videoQueryKeys.all,
    queryFn: () => VideoRepository.getVideos(),
    select: list => (Array.isArray(list) ? list : []),
  });
  const upNextVideos = useMemo(
    () => allVideos.filter(v => v.id !== videoId).slice(0, 10),
    [allVideos, videoId]
  );

  // Keep refs in sync
  useEffect(() => { upNextVideosRef.current = upNextVideos; }, [upNextVideos]);
  useEffect(() => { autoPlayNextRef.current = autoPlayNext; }, [autoPlayNext]);
  useEffect(() => { onVideoPressRef.current = onVideoPress; }, [onVideoPress]);

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

  useEffect(() => {
    setLocalTags(video?.tags ?? []);
  }, [video?.tags]);

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
              url = getVideoPlaybackUrl({ ...v, signedUrl });
            }
          } catch {
            // Fallback below keeps details visible when signing endpoint is unavailable.
          }
          if (!url) {
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

  const handleSeekTo = useCallback((seconds: number) => {
    videoRef.current?.seek(seconds);
    currentTimeRef.current = seconds;
    handleProgress(seconds);
  }, [handleProgress]);

  const handleVideoEnd = useCallback(() => {
    if (isLoopingRef.current) return;
    setIsPaused(true);
    handleProgress(0);
    pendingProgressRef.current = 0;
    runAsync(flushProgressWrite(true));
    if (autoPlayNextRef.current) {
      const next = upNextVideosRef.current[0];
      if (next) {
        onVideoPressRef.current?.(next.id);
      }
    }
  }, [handleProgress, flushProgressWrite]);

  useEffect(() => {
    setIsPaused(!autoPlay);
  }, [autoPlay]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

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

  const handleLoad = useCallback((data: OnLoadData) => {
    const dur = data.duration;
    setDuration(dur);
    durationRef.current = dur;
    const { height: h } = data.naturalSize;
    if (h > 0) {
      setVideoResolution(resolveFromHeight(h));
    }
    const savedProgress = latestProgressRef.current;
    if (savedProgress > 0) {
      videoRef.current?.seek(savedProgress);
    }
  }, []);

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

  const handleOpenSourceUrl = useCallback(async () => {
    const url = video?.sourceUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      showError('Could not open source URL.');
    }
  }, [video?.sourceUrl, showError]);

  const handleOpenDownload = useCallback(async () => {
    if (!video) return;
    const url = playbackUrl || video.sourceUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      showError('Could not open download URL.');
    }
  }, [video, playbackUrl, showError]);

  const handleShare = useCallback(async () => {
    if (!video) return;
    try {
      await Share.share({
        title: video.title,
        message: video.sourceUrl || playbackUrl || video.title,
      });
    } catch {
      // user dismissed share sheet
    }
  }, [video, playbackUrl]);

  const handleCopyUrl = useCallback(async () => {
    const url = playbackUrl || video?.sourceUrl || '';
    if (!url) {
      showError('No URL available.');
      return;
    }
    try {
      await Share.share({ message: url });
    } catch {
      // user dismissed
    }
  }, [playbackUrl, video?.sourceUrl, showError]);

  const handleDeleteVideo = useCallback(async () => {
    if (!video || !canWrite) return;
    setIsDeleting(true);
    try {
      await deleteVideo(video.id);
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.all });
      setDeleteModalVisible(false);
      onBack();
    } catch (e) {
      showError((e as { message?: string }).message ?? 'Failed to delete video');
    } finally {
      setIsDeleting(false);
    }
  }, [video, canWrite, queryClient, onBack, showError]);

  const handleTagsUpdate = useCallback(
    async (newTags: string[]) => {
      if (!video || !canWrite) return;
      const prevTags = localTags;
      setLocalTags(newTags);
      try {
        await putVideo(video.id, { tags: newTags });
        queryClient.invalidateQueries({ queryKey: videoQueryKeys.detail(video.id) });
        show('Tags updated.');
      } catch (e) {
        setLocalTags(prevTags);
        showError((e as { message?: string }).message ?? 'Failed to update tags');
      }
    },
    [video, canWrite, localTags, queryClient, show, showError]
  );

  const handleAddTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed || localTags.includes(trimmed)) return;
      const newTags = [...localTags, trimmed];
      runAsync(handleTagsUpdate(newTags));
      setTagInput('');
    },
    [localTags, handleTagsUpdate]
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const newTags = localTags.filter(existing => existing !== tag);
      runAsync(handleTagsUpdate(newTags));
    },
    [localTags, handleTagsUpdate]
  );

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

  const textTracks = useMemo((): TextTracks => {
    const hostBase = getRuntimeHostBase();
    return (video?.subtitles?.map(sub => ({
      title: sub.language,
      language: sub.language,
      type: sub.filename.endsWith('.vtt') ? TextTrackType.VTT : TextTrackType.SUBRIP,
      uri: `${hostBase}${sub.path.startsWith('/') ? '' : '/'}${sub.path}`,
    })) ?? []) as TextTracks;
  }, [video]);

  const selectedTextTrack = useMemo(
    () =>
      subtitlesEnabled && textTracks.length > 0
        ? { type: SelectedTrackType.INDEX, value: 0 }
        : { type: SelectedTrackType.DISABLED },
    [subtitlesEnabled, textTracks.length]
  );

  const allTagOptions = useMemo(
    () => Array.from(new Set([...availableTags, ...localTags])).sort(),
    [availableTags, localTags]
  );

  const authorAvatarUrl = useMemo(
    () => (video ? getAuthorAvatarUrl(video) : ''),
    [video]
  );

  const formattedPublishDate = useMemo(
    () => formatPublishDate(video?.date),
    [video]
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
          <Text style={styles.backButtonText}>{t('actionBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!video) return null;

  const hasDescription =
    typeof video.description === 'string' && video.description.trim().length > 0;

  const playerAndMeta = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* ── 1. Video player ── */}
      {playbackUrl ? (
        <>
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: playbackUrl, textTracks: textTracks.length > 0 ? textTracks : undefined }}
              style={styles.video}
              paused={isPaused}
              rate={playbackRate}
              repeat={isLooping}
              selectedTextTrack={selectedTextTrack}
              onLoad={handleLoad}
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

          {/* ── 2. Progress bar + inline toggles ── */}
          <View style={styles.controlsBar}>
            <View style={styles.progressControlRow}>
              <Pressable style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]} onPress={handleTogglePlay}>
                <MaterialIcons name={isPaused ? 'play-arrow' : 'pause'} size={24} color="#fff" />
              </Pressable>
              <View style={styles.progressSliderWrap}>
                <ProgressSlider
                  currentTime={progress}
                  duration={duration}
                  onSeekTo={handleSeekTo}
                />
              </View>
              {textTracks.length > 0 && (
                <Pressable style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]} onPress={() => setSubtitlesEnabled(e => !e)}>
                  <MaterialIcons name="subtitles" size={24} color={subtitlesEnabled ? '#0a7ea4' : '#fff'} />
                </Pressable>
              )}
              <Pressable style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]} onPress={() => setIsLooping(l => !l)}>
                <MaterialIcons name="repeat" size={24} color={isLooping ? '#0a7ea4' : '#fff'} />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]} onPress={handleToggleFullscreen}>
                <MaterialIcons name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={24} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.seekBar}>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.controlBtnPressed]} onPress={() => handleSeek(-600)}>
                <MaterialIcons name="keyboard-double-arrow-left" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.controlBtnPressed]} onPress={() => handleSeek(-60)}>
                <MaterialIcons name="fast-rewind" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.controlBtnPressed]} onPress={() => handleSeek(-10)}>
                <MaterialIcons name="replay-10" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.controlBtnPressed]} onPress={() => handleSeek(10)}>
                <MaterialIcons name="forward-10" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.controlBtnPressed]} onPress={() => handleSeek(60)}>
                <MaterialIcons name="fast-forward" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.controlBtnPressed]} onPress={() => handleSeek(600)}>
                <MaterialIcons name="keyboard-double-arrow-right" size={28} color="#fff" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.seekBtn, pressed && styles.controlBtnPressed]} onPress={() => setSpeedModalVisible(true)}>
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

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── 4. Title + rating ── */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.titleRow}
          onPress={() => titleClamped && setTitleExpanded(e => !e)}
          activeOpacity={titleClamped ? 0.6 : 1}
          disabled={!titleClamped}
        >
          <View style={styles.titleTextWrap}>
            <Text
              style={[styles.title, styles.titleHidden]}
              onTextLayout={e => {
                if (!titleExpanded) {
                  setTitleClamped(e.nativeEvent.lines.length > 2);
                }
              }}
            >
              {video.title}
            </Text>
            <Text
              style={styles.title}
              numberOfLines={titleExpanded ? undefined : 2}
            >
              {video.title}
            </Text>
          </View>
          {titleClamped && (
            <MaterialIcons
              name={titleExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color="#aaa"
              style={styles.titleChevron}
            />
          )}
        </TouchableOpacity>

        <View style={styles.ratingRow}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(n => {
              const filled = rating != null && n <= rating;
              const iconColor = filled ? '#f5c518' : '#666';
              const iconName = filled ? 'star' : 'star-border';
              return canWrite ? (
                <TouchableOpacity key={n} onPress={() => handleRate(n)} style={styles.starButton}>
                  <MaterialIcons name={iconName} size={22} color={iconColor} />
                </TouchableOpacity>
              ) : (
                <View key={n} style={styles.starButton}>
                  <MaterialIcons name={iconName} size={22} color={iconColor} />
                </View>
              );
            })}
          </View>
          {rating == null && canWrite && (
            <Text style={styles.ratingHint}>Rate this video</Text>
          )}
          <View style={styles.ratingSpacer} />
          {video.viewCount != null && (
            <Text style={styles.viewCountText}>
              {video.viewCount.toLocaleString()} views
            </Text>
          )}
        </View>

      </View>

      {/* ── 5. Tags ── */}
      {canWrite && (
        <TouchableOpacity
          style={styles.tagsSection}
          onPress={() => setTagsModalVisible(true)}
        >
          <MaterialIcons name="local-offer" size={15} color="#888" style={{ marginRight: 4 }} />
          {localTags.length === 0 ? (
            <Text style={styles.tagsPlaceholder}>Tags</Text>
          ) : (
            <View style={styles.tagsChips}>
              {localTags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <TouchableOpacity onPress={() => handleRemoveTag(tag)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                    <MaterialIcons name="close" size={12} color="#aaa" />
                  </TouchableOpacity>
                </View>
              ))}
              <MaterialIcons name="add" size={16} color="#888" />
            </View>
          )}
        </TouchableOpacity>
      )}
      {!canWrite && localTags.length > 0 && (
        <View style={styles.tagsSection}>
          <MaterialIcons name="local-offer" size={15} color="#888" style={{ marginRight: 4 }} />
          <View style={styles.tagsChips}>
            {localTags.map(tag => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── 6. Author block + action buttons ── */}
      <View style={styles.authorActionsRow}>
        <TouchableOpacity
          style={styles.authorBlock}
          onPress={() => {
            if (authorChannelUrl) {
              runAsync(handleOpenAuthorChannel());
            } else if (onAuthorPress != null && video.author != null) {
              onAuthorPress(video.author);
            }
          }}
          activeOpacity={0.7}
          disabled={
            video.author == null ||
            (authorChannelUrl == null && onAuthorPress == null)
          }
        >
          <View style={styles.avatar}>
            {authorAvatarUrl ? (
              <Image source={{ uri: authorAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>
                {video.author ? video.author.charAt(0).toUpperCase() : 'A'}
              </Text>
            )}
          </View>
          <View style={styles.authorTextBlock}>
            <Text style={styles.authorName} numberOfLines={1}>
              {video.author ?? 'Unknown'}
            </Text>
            {formattedPublishDate != null && (
              <Text style={styles.authorDate}>{formattedPublishDate}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => runAsync(handleCopyUrl())}
            accessibilityLabel="Copy URL"
          >
            <MaterialIcons name="content-copy" size={18} color="#aaa" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => runAsync(handleShare())}
            accessibilityLabel="Share"
          >
            <MaterialIcons name="share" size={18} color="#aaa" />
          </TouchableOpacity>
          {canWrite && (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => setAddToCollectionModalVisible(true)}
              accessibilityLabel="Add to collection"
            >
              <MaterialIcons name="add" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
          {canWrite && (
            <TouchableOpacity
              style={[styles.iconActionBtn, styles.iconActionBtnDanger]}
              onPress={() => setDeleteModalVisible(true)}
              accessibilityLabel="Delete"
            >
              <MaterialIcons name="delete" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 7. Description ── */}
      {hasDescription && (
        <View style={styles.section}>
          <Text
            style={[styles.description, styles.descriptionHidden]}
            onTextLayout={e => {
              if (!descriptionExpanded) {
                setDescriptionClamped(e.nativeEvent.lines.length > 3);
              }
            }}
          >
            {video.description}
          </Text>
          <Text
            style={styles.description}
            numberOfLines={descriptionExpanded ? undefined : 3}
          >
            {video.description}
          </Text>
          {descriptionClamped && (
            <TouchableOpacity
              onPress={() => setDescriptionExpanded(e => !e)}
              style={styles.descriptionToggle}
            >
              <MaterialIcons
                name={descriptionExpanded ? 'expand-less' : 'expand-more'}
                size={18}
                color="#0a7ea4"
              />
              <Text style={styles.descriptionToggleText}>
                {descriptionExpanded ? 'Collapse' : 'Show more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── 8. Compact metadata bar ── */}
      <View style={styles.metadataBar}>
        {video.sourceUrl != null && (
          <TouchableOpacity style={styles.metaItem} onPress={() => runAsync(handleOpenSourceUrl())}>
            <MaterialIcons name="link" size={14} color="#0a7ea4" />
            <Text style={styles.metaItemLink}>Original Link</Text>
          </TouchableOpacity>
        )}
        {(playbackUrl || video.sourceUrl) && (
          <TouchableOpacity style={styles.metaItem} onPress={() => runAsync(handleOpenDownload())}>
            <MaterialIcons name="download" size={14} color="#0a7ea4" />
            <Text style={styles.metaItemLink}>Download</Text>
          </TouchableOpacity>
        )}
        {video.source != null && (
          <View style={styles.metaItem}>
            <MaterialIcons name="video-library" size={14} color="#888" />
            <Text style={styles.metaItemText}>{sourceLabel(video.source)}</Text>
          </View>
        )}
        {video.addedAt != null && (
          <View style={styles.metaItem}>
            <MaterialIcons name="calendar-today" size={14} color="#888" />
            <Text style={styles.metaItemText}>
              {new Date(video.addedAt).toISOString().split('T')[0]}
            </Text>
          </View>
        )}
        {videoResolution != null && (
          <View style={styles.metaItem}>
            <MaterialIcons name="high-quality" size={14} color="#888" />
            <Text style={styles.metaItemText}>{videoResolution}</Text>
          </View>
        )}
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── 9. Latest Comments ── */}
      <View style={styles.commentsSection}>
        <View style={styles.commentsHeaderRow}>
          <Text style={styles.commentsTitle}>Latest Comments</Text>
          {!commentsLoaded && (
            <TouchableOpacity
              style={styles.showCommentsButton}
              onPress={() => runAsync(handleLoadComments())}
              disabled={commentsLoading}
            >
              <Text style={styles.showCommentsButtonText}>
                {commentsLoading ? 'Loading…' : 'Show Comments'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {commentsLoaded && (
          comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet.</Text>
          ) : (
            comments.map(c => (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.commentAuthor}>{c.author}</Text>
                <Text style={styles.commentContent}>{c.content}</Text>
              </View>
            ))
          )
        )}
      </View>

      {/* ── Divider ── */}
      {!isTabletLandscape && <View style={styles.divider} />}

      {/* ── 10. Up next (inline) ── */}
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

      {/* Add to collection modal */}
      <Modal
        visible={addToCollectionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddToCollectionModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddToCollectionModalVisible(false)}
        >
          <Pressable style={styles.modalBox} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('modalAddToCollection')}</Text>
              <TouchableOpacity onPress={() => setAddToCollectionModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#aaa" />
              </TouchableOpacity>
            </View>
            {addToCollectionMutation.isError && (
              <Text style={styles.modalError}>
                {(addToCollectionMutation.error as { message?: string }).message}
              </Text>
            )}
            <FlatList
              data={collections}
              keyExtractor={(c: Collection) => c.id}
              renderItem={({ item }: { item: Collection }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => addToCollectionMutation.mutate(item.id)}
                  disabled={addToCollectionMutation.isPending}
                >
                  <Text style={styles.modalRowText}>
                    {item.name ?? item.title ?? item.id}
                  </Text>
                  <Text style={styles.modalRowMeta}>
                    {item.videos?.length ?? 0} videos
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>{t('emptyCollections')}</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Speed modal */}
      <Modal
        visible={speedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpeedModalVisible(false)}
      >
        <Pressable style={styles.speedOverlay} onPress={() => setSpeedModalVisible(false)}>
          <Pressable style={styles.speedModal} onPress={e => e.stopPropagation()}>
            <Text style={styles.speedModalTitle}>{t('modalPlaybackSpeed')}</Text>
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

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable style={styles.deleteOverlay} onPress={() => setDeleteModalVisible(false)}>
          <Pressable style={styles.deleteModal} onPress={e => e.stopPropagation()}>
            <Text style={styles.deleteModalTitle}>{t('modalDeleteVideoTitle')}</Text>
            <Text style={styles.deleteModalBody}>
              This will permanently delete "{video.title}". This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.deleteCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, isDeleting && styles.deleteConfirmBtnDisabled]}
                onPress={() => runAsync(handleDeleteVideo())}
                disabled={isDeleting}
              >
                <Text style={styles.deleteConfirmBtnText}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tags modal */}
      <Modal
        visible={tagsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTagsModalVisible(false)}
      >
        <Pressable style={styles.tagsOverlay} onPress={() => setTagsModalVisible(false)}>
          <Pressable style={styles.tagsModal} onPress={e => e.stopPropagation()}>
            <View style={styles.tagsModalHeader}>
              <Text style={styles.tagsModalTitle}>Tags</Text>
              <TouchableOpacity onPress={() => setTagsModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#aaa" />
              </TouchableOpacity>
            </View>

            <View style={styles.tagsModalCurrentSection}>
              <Text style={styles.tagsModalSectionLabel}>Current tags</Text>
              {localTags.length === 0 ? (
                <Text style={styles.tagsModalEmpty}>No tags yet.</Text>
              ) : (
                <View style={styles.tagsChips}>
                  {localTags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tagChipRemovable}
                      onPress={() => handleRemoveTag(tag)}
                    >
                      <Text style={styles.tagChipText}>{tag}</Text>
                      <MaterialIcons name="close" size={12} color="#aaa" style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.tagsInputRow}>
              <TextInput
                style={styles.tagsInput}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag…"
                placeholderTextColor="#666"
                returnKeyType="done"
                onSubmitEditing={() => handleAddTag(tagInput)}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.tagsInputAddBtn}
                onPress={() => handleAddTag(tagInput)}
                disabled={!tagInput.trim()}
              >
                <MaterialIcons name="add" size={22} color={tagInput.trim() ? '#0a7ea4' : '#555'} />
              </TouchableOpacity>
            </View>

            {allTagOptions.filter(option => !localTags.includes(option)).length > 0 && (
              <View style={styles.tagsModalSuggestSection}>
                <Text style={styles.tagsModalSectionLabel}>Suggestions</Text>
                <View style={styles.tagsChips}>
                  {allTagOptions
                    .filter(option => !localTags.includes(option))
                    .filter(option => !tagInput || option.toLowerCase().includes(tagInput.toLowerCase()))
                    .map(tag => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.tagSuggestionChip}
                        onPress={() => handleAddTag(tag)}
                      >
                        <Text style={styles.tagSuggestionText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}
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
    paddingBottom: 8,
  },
  progressControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  progressSliderWrap: {
    flex: 1,
  },
  controlBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  controlBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  seekBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 8,
  },
  seekBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#333',
    marginVertical: 0,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleTextWrap: {
    flex: 1,
  },
  titleHidden: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
    marginBottom: 0,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  titleChevron: {
    marginLeft: 6,
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    paddingHorizontal: 1,
    paddingVertical: 2,
  },
  ratingHint: {
    color: '#888',
    fontSize: 12,
    marginLeft: 8,
  },
  ratingSpacer: {
    flex: 1,
  },
  viewCountText: {
    color: '#888',
    fontSize: 13,
  },
  authorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  authorBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a7ea4',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  authorTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  authorDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconActionBtnDanger: {
    borderColor: '#5a2222',
  },
  descriptionHidden: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
  description: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  descriptionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  descriptionToggleText: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
  },
  tagsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tagsPlaceholder: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  tagsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2a3a4a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagChipRemovable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a3a4a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagChipText: {
    color: '#5bc4e8',
    fontSize: 12,
    fontWeight: '500',
  },
  metadataBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    columnGap: 16,
    rowGap: 8,
    backgroundColor: '#222',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemLink: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
  },
  metaItemText: {
    color: '#aaa',
    fontSize: 13,
  },
  commentsSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  commentsTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  showCommentsButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#0a7ea4',
    borderRadius: 6,
  },
  showCommentsButtonText: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
  },
  noComments: {
    color: '#666',
    fontSize: 14,
  },
  comment: {
    marginBottom: 12,
  },
  commentAuthor: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  commentContent: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  upNextInline: {
    paddingTop: 4,
  },
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletMain: {
    flex: 1,
  },
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
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  deleteModal: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  deleteModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  deleteModalBody: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  deleteCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  deleteCancelBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#c0392b',
    borderRadius: 8,
  },
  deleteConfirmBtnDisabled: {
    opacity: 0.5,
  },
  deleteConfirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  tagsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  tagsModal: {
    backgroundColor: '#222',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  tagsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tagsModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  tagsModalCurrentSection: {
    marginBottom: 14,
  },
  tagsModalSuggestSection: {
    marginTop: 12,
  },
  tagsModalSectionLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tagsModalEmpty: {
    color: '#555',
    fontSize: 13,
    fontStyle: 'italic',
  },
  tagsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  tagsInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 10,
  },
  tagsInputAddBtn: {
    padding: 4,
  },
  tagSuggestionChip: {
    backgroundColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#555',
  },
  tagSuggestionText: {
    color: '#ccc',
    fontSize: 12,
  },
  // Generic modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalError: {
    color: '#f66',
    fontSize: 13,
    marginBottom: 8,
  },
  modalRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalRowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalRowMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  modalEmpty: {
    color: '#666',
    textAlign: 'center',
    padding: 24,
  },
});
