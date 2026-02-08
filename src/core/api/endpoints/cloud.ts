/**
 * Cloud signed URL per 01-api-overview.md.
 */

import { apiGet } from '../client';
import type { CloudSignedUrlResponse } from '../../../types';

export function getCloudSignedUrl(
  filename: string,
  type: 'video' | 'thumbnail' = 'video'
): Promise<CloudSignedUrlResponse> {
  return apiGet<CloudSignedUrlResponse>(
    `/cloud/signed-url?filename=${encodeURIComponent(filename)}&type=${type}`
  );
}
