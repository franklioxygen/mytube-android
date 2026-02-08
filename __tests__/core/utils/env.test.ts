declare const process:
  | {
      env: Record<string, string | undefined>;
    }
  | undefined;

const ORIGINAL_API_BASE_URL = process?.env.API_BASE_URL;
const ORIGINAL_LEGACY_API_BASE_URL = process?.env.MYTUBE_API_BASE_URL;

interface LoadEnvOptions {
  dev: boolean;
  apiBaseUrl?: string;
  legacyApiBaseUrl?: string;
  scriptURL?: string;
}

function setEnvVar(name: string, value: string | undefined): void {
  if (!process?.env) return;
  if (value == null) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function loadEnvModule(options: LoadEnvOptions) {
  setEnvVar('API_BASE_URL', options.apiBaseUrl);
  setEnvVar('MYTUBE_API_BASE_URL', options.legacyApiBaseUrl);
  (globalThis as { __DEV__?: boolean }).__DEV__ = options.dev;

  jest.resetModules();
  jest.doMock('react-native', () => ({
    NativeModules: {
      SourceCode: {
        scriptURL:
          options.scriptURL ??
          'http://10.0.2.2:8081/index.bundle?platform=android',
      },
    },
  }));

  return require('../../../src/core/utils/env') as typeof import('../../../src/core/utils/env');
}

describe('env URL normalization', () => {
  afterEach(() => {
    setEnvVar('API_BASE_URL', ORIGINAL_API_BASE_URL);
    setEnvVar('MYTUBE_API_BASE_URL', ORIGINAL_LEGACY_API_BASE_URL);
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('sanitizes valid HTTP/HTTPS API base URLs', () => {
    const env = loadEnvModule({ dev: true });
    expect(env.__normalizeApiBaseUrlForTests('http://example.com:5551///')).toBe(
      'http://example.com:5551/api'
    );
    expect(
      env.__normalizeApiBaseUrlForTests(
        'https://example.com/custom/path?x=1#top'
      )
    ).toBe('https://example.com/custom/path/api');
  });

  test('rejects malformed URLs and unsupported protocols', () => {
    const env = loadEnvModule({ dev: true });
    expect(env.__normalizeApiBaseUrlForTests('not-a-url')).toBe('');
    expect(env.__normalizeApiBaseUrlForTests('ftp://example.com')).toBe('');
  });

  test('uses sanitized env override in development', () => {
    const env = loadEnvModule({
      dev: true,
      apiBaseUrl: 'http://192.168.1.50:5551////',
    });
    expect(env.API_BASE_URL).toBe('http://192.168.1.50:5551/api');
  });

  test('falls back to bundle host when env override is invalid', () => {
    const env = loadEnvModule({
      dev: true,
      apiBaseUrl: 'not-a-url',
      scriptURL: 'http://172.16.0.2:8081/index.bundle?platform=android',
    });
    expect(env.API_BASE_URL).toBe('http://172.16.0.2:5551/api');
  });

  test('rejects cleartext override in production and keeps HTTPS default', () => {
    const env = loadEnvModule({
      dev: false,
      apiBaseUrl: 'http://prod.example.com/api',
    });
    expect(env.API_BASE_URL).toBe('https://your-backend.example.com/api');
  });

  test('accepts HTTPS override in production', () => {
    const env = loadEnvModule({
      dev: false,
      apiBaseUrl: 'https://prod.example.com/root/',
    });
    expect(env.API_BASE_URL).toBe('https://prod.example.com/root/api');
  });

  test('supports legacy env key when API_BASE_URL is missing', () => {
    const env = loadEnvModule({
      dev: true,
      legacyApiBaseUrl: 'http://legacy.example.com:5551',
    });
    expect(env.API_BASE_URL).toBe('http://legacy.example.com:5551/api');
  });
});
