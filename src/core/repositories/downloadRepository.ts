/**
 * Download repository: queue state and history.
 */

import * as downloadEndpoints from '../api/endpoints/downloads';
import type { DownloadInfo, DownloadStatusResponse } from '../../types';
import { queryKeys } from './queryKeys';

export const downloadQueryKeys = {
  status: queryKeys.downloadStatus,
  history: queryKeys.downloadHistory,
};

export const DownloadRepository = {
  getDownloadStatus: (): Promise<DownloadStatusResponse> =>
    downloadEndpoints.getDownloadStatus(),

  getDownloadHistory: (): Promise<DownloadInfo[]> =>
    downloadEndpoints.getDownloadHistory(),
};
