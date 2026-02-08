/**
 * Downloads: queue status + history with lifecycle-aware polling.
 * Implements 06-state-and-polling.md behavior for mobile.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  ScrollView,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import type { AppError } from '../../../core/api/client';
import { DownloadRepository, downloadQueryKeys } from '../../../core/repositories';
import {
  getJitteredIntervalMs,
  getPollingRetryDelayMs,
  shouldRetryPollingError,
} from '../../../core/utils/polling';
import type { DownloadInfo, DownloadStatusResponse } from '../../../types';

function shouldStopPolling(error: AppError | null): boolean {
  return error?.code === 'UNAUTHENTICATED' || error?.code === 'FORBIDDEN';
}

function formatProgress(progress?: number): string | null {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return null;
  const normalized = progress <= 1 ? progress * 100 : progress;
  const clamped = Math.max(0, Math.min(100, normalized));
  return `${Math.round(clamped)}%`;
}

function formatTimestamp(ts?: number): string | null {
  if (typeof ts !== 'number' || Number.isNaN(ts) || ts <= 0) return null;
  const ms = ts < 1_000_000_000_000 ? ts * 1000 : ts;
  return new Date(ms).toLocaleString();
}

function getDownloadTitle(item: DownloadInfo): string {
  return item.title ?? item.filename ?? `Download ${item.id}`;
}

function getItemKey(item: DownloadInfo, index: number): string {
  return item.id ? `${item.id}-${index}` : `download-item-${index}`;
}

function runAsync(task: Promise<unknown>): void {
  task.catch(() => {});
}

export function DownloadsScreen() {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isFocused = useIsFocused();
  const isForeground = appState === 'active';
  const canPoll = isForeground && isFocused;

  const statusQuery = useQuery({
    queryKey: downloadQueryKeys.status,
    queryFn: () => DownloadRepository.getDownloadStatus(),
    refetchInterval: query => {
      if (!canPoll) return false;
      const error = (query.state.error as AppError | null) ?? null;
      if (shouldStopPolling(error)) return false;
      if (error?.code === 'RATE_LIMIT') {
        if (typeof error.retryAfterMs === 'number') {
          return Math.max(1000, error.retryAfterMs);
        }
        return getJitteredIntervalMs(60000);
      }
      const data = query.state.data as DownloadStatusResponse | undefined;
      const active = data?.activeDownloads?.length ?? 0;
      const queued = data?.queuedDownloads?.length ?? 0;
      return active > 0 || queued > 0 ? getJitteredIntervalMs(2000) : false;
    },
    retry: (failureCount, error) => {
      if (!canPoll) return false;
      const appError = error as unknown as AppError;
      if (
        shouldStopPolling(appError) ||
        appError.code === 'RATE_LIMIT' ||
        !shouldRetryPollingError(appError)
      ) {
        return false;
      }
      return failureCount < 5;
    },
    retryDelay: getPollingRetryDelayMs,
  });

  const activeDownloads = statusQuery.data?.activeDownloads ?? [];
  const queuedDownloads = statusQuery.data?.queuedDownloads ?? [];
  const hasQueueWork = activeDownloads.length > 0 || queuedDownloads.length > 0;

  const historyQuery = useQuery({
    queryKey: downloadQueryKeys.history,
    queryFn: () => DownloadRepository.getDownloadHistory(),
    refetchInterval: query => {
      if (!canPoll) return false;
      const error = (query.state.error as AppError | null) ?? null;
      if (shouldStopPolling(error)) return false;
      if (error?.code === 'RATE_LIMIT') {
        if (typeof error.retryAfterMs === 'number') {
          return Math.max(1000, error.retryAfterMs);
        }
        return getJitteredIntervalMs(60000);
      }
      return hasQueueWork ? getJitteredIntervalMs(5000) : getJitteredIntervalMs(30000);
    },
    retry: (failureCount, error) => {
      if (!canPoll) return false;
      const appError = error as unknown as AppError;
      if (
        shouldStopPolling(appError) ||
        appError.code === 'RATE_LIMIT' ||
        !shouldRetryPollingError(appError)
      ) {
        return false;
      }
      return failureCount < 5;
    },
    retryDelay: getPollingRetryDelayMs,
  });
  const refetchStatus = statusQuery.refetch;
  const refetchHistory = historyQuery.refetch;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const prev = previousAppStateRef.current;
      previousAppStateRef.current = nextState;
      setAppState(nextState);
      if (prev !== 'active' && nextState === 'active' && isFocused) {
        runAsync(refetchStatus());
        runAsync(refetchHistory());
      }
    });
    return () => subscription.remove();
  }, [refetchStatus, refetchHistory, isFocused]);

  useEffect(() => {
    if (!canPoll) return;
    runAsync(refetchStatus());
    runAsync(refetchHistory());
  }, [canPoll, refetchStatus, refetchHistory]);

  const history = historyQuery.data ?? [];
  const refreshing = statusQuery.isRefetching || historyQuery.isRefetching;
  const loading = statusQuery.isLoading && historyQuery.isLoading;

  const errorText = useMemo(() => {
    const statusError = statusQuery.error as AppError | null;
    const historyError = historyQuery.error as AppError | null;
    if (statusError?.message) return statusError.message;
    if (historyError?.message) return historyError.message;
    return null;
  }, [statusQuery.error, historyQuery.error]);

  const refreshAll = useCallback(() => {
    runAsync(refetchStatus());
    runAsync(refetchHistory());
  }, [refetchStatus, refetchHistory]);

  if (loading && activeDownloads.length === 0 && queuedDownloads.length === 0 && history.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading downloads…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor="#0a7ea4" />
      }
    >
      {errorText != null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Queue</Text>
        <Text style={styles.sectionMeta}>
          Active: {activeDownloads.length} | Queued: {queuedDownloads.length}
        </Text>
        {activeDownloads.length === 0 && queuedDownloads.length === 0 ? (
          <Text style={styles.emptyText}>No active or queued downloads.</Text>
        ) : (
          <>
            {activeDownloads.map((item, index) => {
              const progress = formatProgress(item.progress);
              return (
                <View key={getItemKey(item, index)} style={styles.card}>
                  <Text style={styles.cardTitle}>{getDownloadTitle(item)}</Text>
                  <Text style={styles.cardMeta}>Status: active</Text>
                  {progress != null && <Text style={styles.cardMeta}>Progress: {progress}</Text>}
                  {item.speed != null && <Text style={styles.cardMeta}>Speed: {item.speed}</Text>}
                </View>
              );
            })}
            {queuedDownloads.map((item, index) => (
              <View key={getItemKey(item, index)} style={styles.card}>
                <Text style={styles.cardTitle}>{getDownloadTitle(item)}</Text>
                <Text style={styles.cardMeta}>Status: queued</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>History</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No download history yet.</Text>
        ) : (
          history.map((item, index) => {
            const at = formatTimestamp(item.updatedAt ?? item.timestamp ?? item.createdAt);
            return (
              <View key={getItemKey(item, index)} style={styles.card}>
                <Text style={styles.cardTitle}>{getDownloadTitle(item)}</Text>
                <Text style={styles.cardMeta}>Status: {item.status ?? 'unknown'}</Text>
                {at != null && <Text style={styles.cardMeta}>Updated: {at}</Text>}
                {item.error != null && <Text style={styles.cardError}>{item.error}</Text>}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 24,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionMeta: {
    color: '#888',
    fontSize: 13,
    marginBottom: 10,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 2,
  },
  cardError: {
    color: '#ff8b8b',
    fontSize: 13,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#332222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff8b8b',
    fontSize: 13,
  },
});
