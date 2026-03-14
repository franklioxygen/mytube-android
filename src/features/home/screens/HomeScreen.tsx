/**
 * Home/feed: list videos via VideoRepository and React Query.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  VideoRepository,
  videoQueryKeys,
  CollectionRepository,
  collectionQueryKeys,
} from '../../../core/repositories';
import { getThumbnailUrl } from '../../../core/utils/mediaUrl';
import { getVideoCardColumns } from '../../../core/utils/layout';
import { useAuth } from '../../../core/auth/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { HomeSidebar } from '../components/HomeSidebar';
import type { MainStackParamList } from '../../../app/navigation/RootNavigator';
import type { Video, Collection } from '../../../types';

type ActiveTab = 'videos' | 'collections' | 'history';

export type SortOption =
  | 'date_added_newest'
  | 'date_added_oldest'
  | 'views_high_to_low'
  | 'views_low_to_high'
  | 'name_az'
  | 'create_date_newest'
  | 'create_date_oldest'
  | 'random';

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'date_added_newest',  label: 'Date Added (Newest)',        icon: '⏱' },
  { value: 'date_added_oldest',  label: 'Date Added (Oldest)',        icon: '⏱' },
  { value: 'views_high_to_low',  label: 'Views (High to Low)',        icon: '👁' },
  { value: 'views_low_to_high',  label: 'Views (Low to High)',        icon: '👁' },
  { value: 'name_az',            label: 'Name (A-Z)',                 icon: 'AZ' },
  { value: 'create_date_newest', label: 'Video Create Date (Newest)', icon: '⏱' },
  { value: 'create_date_oldest', label: 'Video Create Date (Oldest)', icon: '⏱' },
  { value: 'random',             label: 'Random Shuffle',             icon: '⇌' },
];

interface HomeScreenProps {
  onVideoPress: (videoId: string) => void;
}

function toMs(d: string | number | undefined): number {
  if (d == null) return 0;
  const ms = typeof d === 'number' ? d : new Date(d).getTime();
  return isNaN(ms) ? 0 : ms;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

function formatDownloadTime(video: Video, now = Date.now()): string | null {
  const downloadedAt = toMs(video.addedAt ?? video.createdAt);
  if (downloadedAt <= 0) return null;

  const elapsed = Math.max(0, now - downloadedAt);

  if (elapsed < HOUR_MS) return 'Just now';

  if (elapsed < 5 * HOUR_MS) {
    const hours = Math.max(1, Math.floor(elapsed / HOUR_MS));
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (elapsed < DAY_MS) return 'Today';
  if (elapsed < WEEK_MS) return 'This week';

  if (elapsed <= 4 * WEEK_MS) {
    const weeks = Math.max(1, Math.floor(elapsed / WEEK_MS));
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  return new Date(downloadedAt).toLocaleDateString();
}

function formatVideoCardMeta(video: Video): string | null {
  const parts: string[] = [];
  const downloadTime = formatDownloadTime(video);

  if (downloadTime != null) parts.push(downloadTime);
  if (typeof video.viewCount === 'number' && Number.isFinite(video.viewCount)) {
    parts.push(`${video.viewCount.toLocaleString()} views`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

function applySort(videos: Video[], option: SortOption): Video[] {
  const arr = [...videos];
  switch (option) {
    case 'date_added_newest':
      return arr.sort((a, b) => toMs(b.addedAt ?? b.createdAt) - toMs(a.addedAt ?? a.createdAt));
    case 'date_added_oldest':
      return arr.sort((a, b) => toMs(a.addedAt ?? a.createdAt) - toMs(b.addedAt ?? b.createdAt));
    case 'views_high_to_low':
      return arr.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    case 'views_low_to_high':
      return arr.sort((a, b) => (a.viewCount ?? 0) - (b.viewCount ?? 0));
    case 'name_az':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'create_date_newest':
      return arr.sort((a, b) => toMs(b.date) - toMs(a.date));
    case 'create_date_oldest':
      return arr.sort((a, b) => toMs(a.date) - toMs(b.date));
    case 'random':
      return arr.sort(() => Math.random() - 0.5);
  }
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

/** Visitor cannot see videos with visibility=0 (hidden). */
function filterVisibleForRole(videos: Video[], role: 'admin' | 'visitor' | null): Video[] {
  if (role !== 'visitor') return videos;
  return videos.filter(v => v.visibility !== 0);
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

function SortDropdown({
  visible,
  onClose,
  sortOption,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  sortOption: SortOption;
  onSelect: (s: SortOption) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dropStyles.backdrop} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity style={dropStyles.panel} activeOpacity={1}>
          {SORT_OPTIONS.map(opt => {
            const active = opt.value === sortOption;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[dropStyles.row, active && dropStyles.rowActive]}
                onPress={() => { onSelect(opt.value); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[dropStyles.icon, opt.icon === 'AZ' && dropStyles.iconAz]}>
                  {opt.icon}
                </Text>
                <Text style={[dropStyles.label, active && dropStyles.labelActive]}>
                  {opt.label}
                </Text>
                {active && <Text style={dropStyles.check}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const dropStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 52,
    paddingRight: 8,
  },
  panel: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    minWidth: 240,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3a3a',
  },
  rowActive: {
    backgroundColor: '#1e3a4a',
  },
  icon: {
    fontSize: 15,
    width: 22,
    textAlign: 'center',
    color: '#aaa',
  },
  iconAz: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaa',
  },
  label: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
  },
  labelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  check: {
    color: '#0a7ea4',
    fontSize: 14,
    fontWeight: '700',
  },
});

// ─── Collections tab content ──────────────────────────────────────────────────

function CollectionsTab() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const {
    data: collections = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => CollectionRepository.getCollections(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const renderItem = useCallback(
    ({ item }: { item: Collection }) => (
      <TouchableOpacity
        style={colStyles.card}
        onPress={() => navigation.navigate('CollectionDetail', { collectionId: item.id })}
        activeOpacity={0.7}
      >
        <Text style={colStyles.folderIcon}>📁</Text>
        <View style={colStyles.cardInfo}>
          <Text style={colStyles.cardName} numberOfLines={1}>{item.name ?? item.title}</Text>
          <Text style={colStyles.cardMeta}>{item.videos?.length ?? 0} videos</Text>
        </View>
        <Text style={colStyles.chevron}>›</Text>
      </TouchableOpacity>
    ),
    [navigation]
  );

  if (isLoading && collections.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  return (
    <FlatList
      data={collections}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={colStyles.list}
      refreshing={isRefetching}
      onRefresh={() => refetch()}
      ListEmptyComponent={<Text style={styles.emptyText}>No collections yet.</Text>}
    />
  );
}

const colStyles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  folderIcon: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardName: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardMeta: { color: '#888', fontSize: 13 },
  chevron: { color: '#555', fontSize: 20, fontWeight: '300' },
});

// ─── History tab content ──────────────────────────────────────────────────────

function HistoryTab({
  onVideoPress,
  sortOption,
}: {
  onVideoPress: (id: string) => void;
  sortOption: SortOption;
}) {
  const { role } = useAuth();
  const { width, height } = useWindowDimensions();
  const numColumns = getVideoCardColumns(width, height);
  const isGrid = numColumns > 1;
  const listPadding = 12;
  const columnGap = 12;
  const cardWidth = (width - listPadding * 2 - columnGap * (numColumns - 1)) / numColumns;

  const {
    data: videos = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: videoQueryKeys.all,
    queryFn: () => VideoRepository.getVideos(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const history = useMemo(() => {
    const watched = filterVisibleForRole(videos, role).filter(v => v.lastPlayedAt != null);
    // Default history order is most-recently-played; otherwise apply sort
    if (sortOption === 'date_added_newest' || sortOption === 'date_added_oldest') {
      return watched.sort((a, b) =>
        sortOption === 'date_added_newest'
          ? (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)
          : (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0)
      );
    }
    return applySort(watched, sortOption);
  }, [videos, role, sortOption]);

  const renderItem = useCallback(
    ({ item }: { item: Video }) => {
      const thumb = getThumbnailUrl(item);
      return (
        <View style={[styles.cardWrap, isGrid && { width: cardWidth }]}>
          <TouchableOpacity style={styles.card} onPress={() => onVideoPress(item.id)} activeOpacity={0.7}>
            <View style={styles.thumbContainer}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbPlaceholderText}>No thumb</Text>
                </View>
              )}
              {item.duration != null && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
                </View>
              )}
              {item.progress != null && item.duration != null && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, (item.progress / Number(item.duration)) * 100)}%` },
                    ]}
                  />
                </View>
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {item.author != null && (
                <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [onVideoPress, isGrid, cardWidth]
  );

  if (isLoading && history.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  return (
    <FlatList
      key={`history-${numColumns}`}
      data={history}
      numColumns={numColumns}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      refreshing={isRefetching}
      onRefresh={() => refetch()}
      ListEmptyComponent={<Text style={styles.emptyText}>No watch history yet.</Text>}
    />
  );
}

// ─── Main HomeScreen ──────────────────────────────────────────────────────────

export function HomeScreen({ onVideoPress }: HomeScreenProps) {
  const { role } = useAuth();
  const { width, height } = useWindowDimensions();
  const numColumns = getVideoCardColumns(width, height);
  const isGrid = numColumns > 1;
  const listPadding = 12;
  const columnGap = 12;
  const cardWidth = (width - listPadding * 2 - columnGap * (numColumns - 1)) / numColumns;

  const [activeTab, setActiveTab] = useState<ActiveTab>('videos');
  const [sortOption, setSortOption] = useState<SortOption>('date_added_newest');
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);
  const { filter, setFilter, isOpen, toggle } = useSidebar();

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

  const displayVideos = useMemo(() => {
    const visible = filterVisibleForRole(videos, role);
    const filtered = filter == null
      ? visible
      : filter.type === 'tag'
      ? visible.filter(v => v.tags?.includes(filter.value))
      : visible.filter(v => v.author === filter.value);
    return applySort(filtered, sortOption);
  }, [videos, role, filter, sortOption]);

  const errorMessage =
    error != null
      ? (error as { message?: string }).message ?? 'Failed to load videos'
      : null;

  const renderItem = useCallback(
    ({ item }: { item: Video }) => {
      const thumb = getThumbnailUrl(item);
      const metaText = formatVideoCardMeta(item);
      return (
        <View style={[styles.cardWrap, isGrid && { width: cardWidth }]}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => onVideoPress(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.thumbContainer}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbPlaceholderText}>No thumb</Text>
                </View>
              )}
              {item.duration != null && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
                </View>
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {(item.author != null || metaText != null) && (
                <View style={styles.metaRow}>
                  {item.author != null ? (
                    <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
                  ) : (
                    <View style={styles.metaSpacer} />
                  )}
                  {metaText != null && (
                    <Text style={styles.meta} numberOfLines={1}>{metaText}</Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [onVideoPress, isGrid, cardWidth]
  );

  const keyExtractor = useCallback((item: Video) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Toolbar: sidebar toggle + tabs + sort */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.sidebarToggle, isOpen && styles.sidebarToggleActive]}
          onPress={toggle}
          accessibilityLabel="Toggle sidebar"
        >
          <View style={styles.sidebarIcon}>
            <View style={[styles.sidebarIconLeft, isOpen && styles.sidebarIconLeftActive]} />
            <View style={styles.sidebarIconLines}>
              <View style={[styles.sidebarIconLine, isOpen && styles.sidebarIconLineActive]} />
              <View style={[styles.sidebarIconLine, isOpen && styles.sidebarIconLineActive, { width: 8 }]} />
              <View style={[styles.sidebarIconLine, isOpen && styles.sidebarIconLineActive]} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.toolbarSpacer} />

        {(['videos', 'collections', 'history'] as ActiveTab[]).map(tab => {
          const active = activeTab === tab;
          const iconColor = active ? '#0a7ea4' : '#888';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              {width < 500 ? (
                tab === 'videos' ? (
                  // Play triangle
                  <View style={{ width: 0, height: 0, borderStyle: 'solid', borderLeftWidth: 11, borderTopWidth: 7, borderBottomWidth: 7, borderLeftColor: iconColor, borderTopColor: 'transparent', borderBottomColor: 'transparent' }} />
                ) : tab === 'collections' ? (
                  // 2×2 grid
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 13, gap: 2 }}>
                    {[0,1,2,3].map(i => <View key={i} style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: iconColor }} />)}
                  </View>
                ) : (
                  // Clock circle
                  <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: iconColor }} />
                )
              ) : (
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab === 'videos' ? 'ALL VIDEOS' : tab === 'collections' ? 'COLLECTIONS' : 'HISTORY'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.sortButton, sortDropdownVisible && styles.sortButtonActive]}
          onPress={() => setSortDropdownVisible(true)}
          accessibilityLabel="Sort"
        >
          <View style={styles.sortIcon}>
            <View style={[styles.sortIconLine, sortDropdownVisible && styles.sortIconLineActive]} />
            <View style={[styles.sortIconLine, sortDropdownVisible && styles.sortIconLineActive, { width: 10 }]} />
            <View style={[styles.sortIconLine, sortDropdownVisible && styles.sortIconLineActive, { width: 6 }]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Active filter banner (only for videos tab) */}
      {activeTab === 'videos' && filter != null && (
        <View style={styles.filterBanner}>
          <Text style={styles.filterBannerText}>
            {filter.type === 'tag' ? `Tag: ${filter.value}` : `Author: ${filter.value}`}
          </Text>
          <TouchableOpacity onPress={() => setFilter(null)} style={styles.filterClear}>
            <Text style={styles.filterClearText}>✕ Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab content */}
      {activeTab === 'collections' ? (
        <CollectionsTab />
      ) : activeTab === 'history' ? (
        <HistoryTab onVideoPress={onVideoPress} sortOption={sortOption} />
      ) : loading && displayVideos.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading videos…</Text>
        </View>
      ) : errorMessage != null && displayVideos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
      )}

      <HomeSidebar />

      <SortDropdown
        visible={sortDropdownVisible}
        onClose={() => setSortDropdownVisible(false)}
        sortOption={sortOption}
        onSelect={setSortOption}
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
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
  },
  // ── Toolbar ──
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 8,
  },
  sidebarToggle: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarToggleActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#1e3a4a',
  },
  sidebarIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sidebarIconLeft: {
    width: 5,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#777',
  },
  sidebarIconLeftActive: {
    backgroundColor: '#0a7ea4',
  },
  sidebarIconLines: {
    gap: 3,
  },
  sidebarIconLine: {
    width: 11,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#666',
  },
  sidebarIconLineActive: {
    backgroundColor: '#0a7ea4',
  },
  toolbarSpacer: {
    flex: 1,
  },

  tab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#0a1e28',
  },
  tabText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#0a7ea4',
  },

  sortButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  sortButtonActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#1e3a4a',
  },
  sortIcon: {
    gap: 3,
    alignItems: 'flex-start',
  },
  sortIconLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#777',
  },
  sortIconLineActive: {
    backgroundColor: '#0a7ea4',
  },
  // ── Filter banner ──
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e3a4a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0a7ea4',
  },
  filterBannerText: {
    color: '#7dd3f0',
    fontSize: 13,
    fontWeight: '600',
  },
  filterClear: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#0a7ea4',
    borderRadius: 12,
  },
  filterClearText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // ── Video cards ──
  list: {
    padding: 12,
    paddingBottom: 32,
  },
  columnWrapper: {
    gap: 12,
  },
  cardWrap: {
    marginBottom: 16,
  },
  card: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'transparent',
  },
  thumbContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: {
    color: '#666',
    fontSize: 12,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f00',
  },
  info: {
    paddingTop: 8,
    paddingHorizontal: 2,
    minHeight: 60,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
    minHeight: 40,
  },
  author: {
    color: '#aaa',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  meta: {
    color: '#888',
    fontSize: 12,
    flexShrink: 0,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  metaSpacer: {
    flex: 1,
  },
});
