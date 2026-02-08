import * as videoEndpoints from '../../../src/core/api/endpoints/videos';
import * as cloudEndpoints from '../../../src/core/api/endpoints/cloud';
import * as settingsEndpoints from '../../../src/core/api/endpoints/settings';
import * as subscriptionEndpoints from '../../../src/core/api/endpoints/subscriptions';
import {
  VideoRepository,
  SettingsRepository,
  SubscriptionRepository,
} from '../../../src/core/repositories';

jest.mock('../../../src/core/api/endpoints/videos', () => ({
  getVideos: jest.fn(),
  getVideo: jest.fn(),
  getAuthorChannelUrl: jest.fn(),
  getVideoComments: jest.fn(),
  postVideoView: jest.fn(),
  putVideoProgress: jest.fn(),
  postVideoRate: jest.fn(),
}));

jest.mock('../../../src/core/api/endpoints/cloud', () => ({
  getCloudSignedUrl: jest.fn(),
}));

jest.mock('../../../src/core/api/endpoints/settings', () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
  getSystemVersion: jest.fn(),
}));

jest.mock('../../../src/core/api/endpoints/subscriptions', () => ({
  getSubscriptions: jest.fn(),
  getSubscriptionTasks: jest.fn(),
}));

describe('compatibility schema tolerance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('/api/videos tolerates additive fields and missing optionals', async () => {
    const getVideosMock = videoEndpoints.getVideos as jest.MockedFunction<
      typeof videoEndpoints.getVideos
    >;
    const getCloudSignedUrlMock =
      cloudEndpoints.getCloudSignedUrl as jest.MockedFunction<
        typeof cloudEndpoints.getCloudSignedUrl
      >;

    getCloudSignedUrlMock.mockResolvedValue({ success: false });
    getVideosMock.mockResolvedValue([
      { id: 'v1', title: 'A', brandNewField: { nested: true } } as any,
      { id: 'v2', title: 'B' } as any,
    ]);

    const videos = await VideoRepository.getVideos();
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({
      id: 'v1',
      title: 'A',
      brandNewField: { nested: true },
    });
  });

  test('cloud thumbnail hydration tolerates signed-url payloads without explicit success', async () => {
    const getVideosMock = videoEndpoints.getVideos as jest.MockedFunction<
      typeof videoEndpoints.getVideos
    >;
    const getCloudSignedUrlMock =
      cloudEndpoints.getCloudSignedUrl as jest.MockedFunction<
        typeof cloudEndpoints.getCloudSignedUrl
      >;

    getVideosMock.mockResolvedValue([
      { id: 'v1', title: 'Cloud video', thumbnailPath: 'cloud:thumb.png' } as any,
    ]);
    getCloudSignedUrlMock.mockResolvedValue({
      url: 'https://cdn.example.com/thumb.png',
    } as any);

    const videos = await VideoRepository.getVideos();
    expect(videos[0]).toMatchObject({
      id: 'v1',
      signedThumbnailUrl: 'https://cdn.example.com/thumb.png',
    });
  });

  test('/api/videos/:id tolerates additive fields', async () => {
    const getVideoMock = videoEndpoints.getVideo as jest.MockedFunction<
      typeof videoEndpoints.getVideo
    >;
    const getCloudSignedUrlMock =
      cloudEndpoints.getCloudSignedUrl as jest.MockedFunction<
        typeof cloudEndpoints.getCloudSignedUrl
      >;

    getCloudSignedUrlMock.mockResolvedValue({ success: false });
    getVideoMock.mockResolvedValue({
      id: 'v3',
      title: 'Video 3',
      newServerFlag: 'future',
    } as any);

    const video = await VideoRepository.getVideo('v3');
    expect(video).toMatchObject({
      id: 'v3',
      title: 'Video 3',
      newServerFlag: 'future',
    });
  });

  test('/api/settings tolerates additive fields', async () => {
    const getSettingsMock = settingsEndpoints.getSettings as jest.MockedFunction<
      typeof settingsEndpoints.getSettings
    >;
    getSettingsMock.mockResolvedValue({
      websiteName: 'MyTube',
      featureFlagFuture: true,
    } as any);

    const settings = await SettingsRepository.getSettings();
    expect(settings).toMatchObject({
      websiteName: 'MyTube',
      featureFlagFuture: true,
    });
  });

  test('/api/subscriptions/tasks tolerates unknown future statuses', async () => {
    const getTasksMock =
      subscriptionEndpoints.getSubscriptionTasks as jest.MockedFunction<
        typeof subscriptionEndpoints.getSubscriptionTasks
      >;
    getTasksMock.mockResolvedValue([
      { id: 't1', status: 'retrying', failedCount: 1 },
      { id: 't2' },
    ] as any);

    const tasks = await SubscriptionRepository.getTasks();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].status).toBe('retrying');
    expect(tasks[1].status).toBeUndefined();
  });
});
