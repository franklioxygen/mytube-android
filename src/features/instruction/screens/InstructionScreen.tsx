/**
 * Instruction / Help: static content. Phase 5.
 */

import React from 'react';
import { Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SettingsRepository, settingsQueryKeys } from '../../../core/repositories';

export function InstructionScreen() {
  const { data: version, isLoading: versionLoading } = useQuery({
    queryKey: settingsQueryKeys.systemVersion,
    queryFn: () => SettingsRepository.getSystemVersion(),
    retry: false,
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Help</Text>
      <Text style={styles.paragraph}>
        MyTube Android lets you browse and play your video library. Use the search bar at the top to
        find videos by title, author, description, or tags.
      </Text>
      <Text style={styles.subtitle}>Tabs</Text>
      <Text style={styles.paragraph}>
        • Home – list of videos.{'\n'}
        • Collections – your saved collections.{'\n'}
        • Settings – app settings and logout.
      </Text>
      <Text style={styles.subtitle}>Menu</Text>
      <Text style={styles.paragraph}>
        Open the menu from the top bar to jump to Manage, Settings, Collections, Authors,
        and this Instruction screen.
      </Text>
      <Text style={styles.subtitle}>Version</Text>
      <Text style={styles.paragraph}>
        Version info is available in Settings.
      </Text>
      {versionLoading ? (
        <ActivityIndicator size="small" color="#888" style={styles.versionLoader} />
      ) : version != null ? (
        <Text style={styles.versionText}>
          Server: {version.currentVersion ?? '—'}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  versionLoader: {
    marginTop: 16,
  },
  versionText: {
    color: '#888',
    fontSize: 12,
    marginTop: 16,
  },
});
