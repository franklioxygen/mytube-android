describe('mediaUrl mixed-content policy', () => {
  afterEach(() => {
    jest.resetModules();
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
  });

  test('rejects cleartext signed playback URL when host base is HTTPS', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    jest.isolateModules(() => {
      const { getVideoPlaybackUrl } = require('../../../src/core/utils/mediaUrl');
      const url = getVideoPlaybackUrl({
        id: 'v1',
        title: 'Video',
        signedUrl: 'http://insecure.example.com/video.mp4',
      });
      expect(url).toBe('');
    });
  });

  test('rejects cleartext signed playback URL with uppercase scheme', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    jest.isolateModules(() => {
      const { getVideoPlaybackUrl } = require('../../../src/core/utils/mediaUrl');
      const url = getVideoPlaybackUrl({
        id: 'v1',
        title: 'Video',
        signedUrl: 'HTTP://insecure.example.com/video.mp4',
      });
      expect(url).toBe('');
    });
  });

  test('builds cloud redirect fallback URL', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    jest.isolateModules(() => {
      const { getCloudVideoRedirectUrl } = require('../../../src/core/utils/mediaUrl');
      const url = getCloudVideoRedirectUrl('folder/video 1.mp4');
      expect(url).toBe(
        'https://your-backend.example.com/cloud/videos/folder%2Fvideo%201.mp4'
      );
    });
  });
});
