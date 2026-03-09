import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  CollectionRepository,
  VideoRepository,
  collectionQueryKeys,
  videoQueryKeys,
} from '../../../core/repositories';
import { getThumbnailUrl } from '../../../core/utils/mediaUrl';
import type { MainStackParamList } from '../../../app/navigation/RootNavigator';
import { useSidebar } from '../context/SidebarContext';

const SIDEBAR_WIDTH = 272;

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  expanded,
  onToggle,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

// ─── Collections section ──────────────────────────────────────────────────────

function CollectionsSection({ onNavigate }: { onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: collections = [] } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => CollectionRepository.getCollections(),
  });

  const handlePress = useCallback(
    (id: string) => {
      onNavigate();
      navigation.navigate('CollectionDetail', { collectionId: id });
    },
    [navigation, onNavigate]
  );

  return (
    <View>
      <SectionHeader
        title="Collections"
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
      />
      {expanded && (
        <View style={styles.sectionBody}>
          {collections.length === 0 ? (
            <Text style={styles.emptyText}>No collections</Text>
          ) : (
            collections.map(col => (
              <TouchableOpacity
                key={col.id}
                style={styles.collectionRow}
                onPress={() => handlePress(col.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.folderIcon}>📁</Text>
                <Text style={styles.collectionName} numberOfLines={1}>
                  {col.name || col.title}
                </Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{col.videos?.length ?? 0}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ─── Tags section ─────────────────────────────────────────────────────────────

function TagsSection({ onSelectFilter }: { onSelectFilter: (tag: string | null) => void }) {
  const [expanded, setExpanded] = useState(true);
  const { filter } = useSidebar();
  const { data: videos = [] } = useQuery({
    queryKey: videoQueryKeys.all,
    queryFn: () => VideoRepository.getVideos(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const tags = useMemo(() => {
    const set = new Set<string>();
    videos.forEach(v => v.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [videos]);

  const activeTag = filter?.type === 'tag' ? filter.value : null;

  return (
    <View>
      <SectionHeader
        title="Tags"
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
      />
      {expanded && (
        <View style={styles.sectionBody}>
          {tags.length === 0 ? (
            <Text style={styles.emptyText}>No tags</Text>
          ) : (
            <View style={styles.tagsWrap}>
              {tags.map(tag => {
                const active = tag === activeTag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                    onPress={() => onSelectFilter(active ? null : tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Authors section ──────────────────────────────────────────────────────────

function AuthorsSection({ onSelectFilter }: { onSelectFilter: (author: string | null) => void }) {
  const [expanded, setExpanded] = useState(true);
  const { filter } = useSidebar();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: videos = [] } = useQuery({
    queryKey: videoQueryKeys.all,
    queryFn: () => VideoRepository.getVideos(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const authors = useMemo(() => {
    const map = new Map<string, { avatarUri: string | null }>();
    videos.forEach(v => {
      if (!v.author) return;
      if (!map.has(v.author)) {
        const avatarUri = v.authorAvatarPath
          ? getThumbnailUrl({ thumbnailPath: v.authorAvatarPath } as Parameters<typeof getThumbnailUrl>[0])
          : null;
        map.set(v.author, { avatarUri });
      }
    });
    return Array.from(map.entries())
      .map(([name, { avatarUri }]) => ({ name, avatarUri }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [videos]);

  const activeAuthor = filter?.type === 'author' ? filter.value : null;

  const handlePress = useCallback(
    (name: string) => {
      onSelectFilter(null);
      navigation.navigate('Author', { authorName: name });
    },
    [navigation, onSelectFilter]
  );

  return (
    <View>
      <SectionHeader
        title="Authors"
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
      />
      {expanded && (
        <View style={styles.sectionBody}>
          {authors.length === 0 ? (
            <Text style={styles.emptyText}>No authors</Text>
          ) : (
            authors.map(({ name, avatarUri }) => {
              const active = name === activeAuthor;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.authorRow, active && styles.authorRowActive]}
                  onPress={() => handlePress(name)}
                  activeOpacity={0.7}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[styles.authorName, active && styles.authorNameActive]} numberOfLines={1}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function HomeSidebar() {
  const { isOpen, close, setFilter } = useSidebar();
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [isOpen, slideAnim, backdropAnim]);

  const handleTagFilter = useCallback(
    (tag: string | null) => {
      setFilter(tag ? { type: 'tag', value: tag } : null);
      close();
    },
    [setFilter, close]
  );

  const handleAuthorFilter = useCallback(
    (author: string | null) => {
      setFilter(author ? { type: 'author', value: author } : null);
    },
    [setFilter]
  );

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={close} activeOpacity={1} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <CollectionsSection onNavigate={close} />
          <View style={styles.divider} />
          <TagsSection onSelectFilter={handleTagFilter} />
          <View style={styles.divider} />
          <AuthorsSection onSelectFilter={handleAuthorFilter} />
          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#222',
    borderRightWidth: 1,
    borderRightColor: '#333',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e1e1e',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chevron: {
    color: '#888',
    fontSize: 10,
  },
  sectionBody: {
    paddingVertical: 4,
  },
  emptyText: {
    color: '#666',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Collections
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  folderIcon: {
    fontSize: 16,
  },
  collectionName: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
  },
  countBadge: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  // Tags
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#333',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  tagChipActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  tagChipText: {
    color: '#ccc',
    fontSize: 13,
  },
  tagChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Authors
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 10,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  authorRowActive: {
    backgroundColor: '#2a3a44',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  authorName: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
  },
  authorNameActive: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 2,
  },
});
