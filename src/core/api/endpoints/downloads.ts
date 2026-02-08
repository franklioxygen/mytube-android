/**
 * Download status/history endpoints per 06-state-and-polling.md.
 */

import { apiGet } from '../client';
import type { DownloadInfo, DownloadStatusResponse } from '../../../types';

export function getDownloadStatus(): Promise<DownloadStatusResponse> {
  return apiGet<DownloadStatusResponse>('/download-status');
}

export function getDownloadHistory(): Promise<DownloadInfo[]> {
  return apiGet<DownloadInfo[]>('/downloads/history');
}
