/**
 * Subscription repository: subscriptions and task state.
 */

import * as subscriptionEndpoints from '../api/endpoints/subscriptions';
import type { Subscription, SubscriptionTask } from '../../types';
import { queryKeys } from './queryKeys';

export const subscriptionQueryKeys = {
  all: queryKeys.subscriptions,
  tasks: queryKeys.subscriptionTasks,
};

export const SubscriptionRepository = {
  getSubscriptions: (): Promise<Subscription[]> =>
    subscriptionEndpoints.getSubscriptions(),

  getTasks: (): Promise<SubscriptionTask[]> =>
    subscriptionEndpoints.getSubscriptionTasks(),
};
