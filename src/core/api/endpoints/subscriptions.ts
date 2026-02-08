/**
 * Subscription list/task endpoints per 06-state-and-polling.md.
 */

import { apiGet } from '../client';
import type { Subscription, SubscriptionTask } from '../../../types';

export function getSubscriptions(): Promise<Subscription[]> {
  return apiGet<Subscription[]>('/subscriptions');
}

export function getSubscriptionTasks(): Promise<SubscriptionTask[]> {
  return apiGet<SubscriptionTask[]>('/subscriptions/tasks');
}
