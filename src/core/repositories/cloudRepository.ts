/**
 * Cloud repository: signed URL for cloud storage.
 */

import * as cloudEndpoints from '../api/endpoints/cloud';
import type { CloudSignedUrlResponse } from '../../types';

export const CloudRepository = {
  getSignedUrl: (
    filename: string,
    type: 'video' | 'thumbnail' = 'video'
  ): Promise<CloudSignedUrlResponse> =>
    cloudEndpoints.getCloudSignedUrl(filename, type),
};
