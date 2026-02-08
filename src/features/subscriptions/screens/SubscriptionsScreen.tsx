/**
 * Subscriptions + task state with lifecycle-aware polling.
 * Implements 06-state-and-polling.md intervals and compatibility handling.
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
import { SubscriptionRepository, subscriptionQueryKeys } from '../../../core/repositories';
import {
  getJitteredIntervalMs,
  getPollingRetryDelayMs,
  shouldRetryPollingError,
} from '../../../core/utils/polling';
import type { Subscription, SubscriptionTask } from '../../../types';

type NormalizedTaskStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'unknown';

function shouldStopPolling(error: AppError | null): boolean {
  return error?.code === 'UNAUTHENTICATED' || error?.code === 'FORBIDDEN';
}

function normalizeTaskStatus(status?: string): NormalizedTaskStatus {
  if (status === 'active') return 'active';
  if (status === 'paused') return 'paused';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'unknown';
}

function formatTimestamp(ts?: number): string | null {
  if (typeof ts !== 'number' || Number.isNaN(ts) || ts <= 0) return null;
  const ms = ts < 1_000_000_000_000 ? ts * 1000 : ts;
  return new Date(ms).toLocaleString();
}

function getSubscriptionLabel(item: Subscription): string {
  return item.authorName ?? item.url ?? item.authorUrl ?? item.playlistUrl ?? item.id;
}

function getTaskLabel(item: SubscriptionTask): string {
  const id = item.subscriptionId ?? item.id;
  return `Task ${id}`;
}

function runAsync(task: Promise<unknown>): void {
  task.catch(() => {});
}

export function SubscriptionsScreen() {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isFocused = useIsFocused();
  const isForeground = appState === 'active';
  const canPoll = isForeground && isFocused;

  const tasksQuery = useQuery({
    queryKey: subscriptionQueryKeys.tasks,
    queryFn: () => SubscriptionRepository.getTasks(),
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
      const tasks = (query.state.data as SubscriptionTask[] | undefined) ?? [];
      const hasLiveTask = tasks.some(task => {
        const status = normalizeTaskStatus(task.status);
        return status === 'active' || status === 'paused';
      });
      return hasLiveTask ? getJitteredIntervalMs(10000) : getJitteredIntervalMs(60000);
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

  const subscriptionsQuery = useQuery({
    queryKey: subscriptionQueryKeys.all,
    queryFn: () => SubscriptionRepository.getSubscriptions(),
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
      return getJitteredIntervalMs(30000);
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
  const refetchTasks = tasksQuery.refetch;
  const refetchSubscriptions = subscriptionsQuery.refetch;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const prev = previousAppStateRef.current;
      previousAppStateRef.current = nextState;
      setAppState(nextState);
      if (prev !== 'active' && nextState === 'active' && isFocused) {
        runAsync(refetchTasks());
        runAsync(refetchSubscriptions());
      }
    });
    return () => subscription.remove();
  }, [refetchTasks, refetchSubscriptions, isFocused]);

  useEffect(() => {
    if (!canPoll) return;
    runAsync(refetchTasks());
    runAsync(refetchSubscriptions());
  }, [canPoll, refetchTasks, refetchSubscriptions]);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const subscriptions = useMemo(
    () => subscriptionsQuery.data ?? [],
    [subscriptionsQuery.data]
  );
  const refreshing = tasksQuery.isRefetching || subscriptionsQuery.isRefetching;
  const loading = tasksQuery.isLoading && subscriptionsQuery.isLoading;

  const summary = useMemo(() => {
    const result = {
      active: 0,
      paused: 0,
      completed: 0,
      cancelled: 0,
      unknown: 0,
    };
    for (const task of tasks) {
      result[normalizeTaskStatus(task.status)] += 1;
    }
    return result;
  }, [tasks]);

  const errorText = useMemo(() => {
    const taskError = tasksQuery.error as AppError | null;
    const subError = subscriptionsQuery.error as AppError | null;
    if (taskError?.message) return taskError.message;
    if (subError?.message) return subError.message;
    return null;
  }, [tasksQuery.error, subscriptionsQuery.error]);

  const refreshAll = useCallback(() => {
    runAsync(refetchTasks());
    runAsync(refetchSubscriptions());
  }, [refetchTasks, refetchSubscriptions]);

  if (loading && tasks.length === 0 && subscriptions.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading subscriptions…</Text>
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
        <Text style={styles.sectionTitle}>Tasks</Text>
        <Text style={styles.sectionMeta}>
          active {summary.active} | paused {summary.paused} | completed {summary.completed} | cancelled {summary.cancelled} | unknown {summary.unknown}
        </Text>
        {tasks.length === 0 ? (
          <Text style={styles.emptyText}>No active subscription tasks.</Text>
        ) : (
          tasks.map((task, index) => {
            const status = normalizeTaskStatus(task.status);
            const updatedAt = formatTimestamp(task.updatedAt);
            const hasFailures =
              (typeof task.failedCount === 'number' && task.failedCount > 0) ||
              (typeof task.error === 'string' && task.error.length > 0);
            return (
              <View key={`${task.id}-${index}`} style={styles.card}>
                <Text style={styles.cardTitle}>{getTaskLabel(task)}</Text>
                <Text style={styles.cardMeta}>Status: {status}</Text>
                {typeof task.progress === 'number' && (
                  <Text style={styles.cardMeta}>Progress: {Math.round(task.progress)}%</Text>
                )}
                {typeof task.failedCount === 'number' && (
                  <Text style={styles.cardMeta}>Failed: {task.failedCount}</Text>
                )}
                {updatedAt != null && <Text style={styles.cardMeta}>Updated: {updatedAt}</Text>}
                {hasFailures && task.error != null && (
                  <Text style={styles.cardError}>{task.error}</Text>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        {subscriptions.length === 0 ? (
          <Text style={styles.emptyText}>No subscriptions found.</Text>
        ) : (
          subscriptions.map((subscriptionItem, index) => (
            <View key={`${subscriptionItem.id}-${index}`} style={styles.card}>
              <Text style={styles.cardTitle}>{getSubscriptionLabel(subscriptionItem)}</Text>
              <Text style={styles.cardMeta}>Paused: {subscriptionItem.paused ? 'yes' : 'no'}</Text>
              {typeof subscriptionItem.totalVideos === 'number' && (
                <Text style={styles.cardMeta}>Total videos: {subscriptionItem.totalVideos}</Text>
              )}
              {formatTimestamp(subscriptionItem.lastCheckTime) != null && (
                <Text style={styles.cardMeta}>
                  Last check: {formatTimestamp(subscriptionItem.lastCheckTime)}
                </Text>
              )}
            </View>
          ))
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
