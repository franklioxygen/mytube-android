import { QueryClient } from '@tanstack/react-query';
import { resetBackend } from '../../../src/core/config/resetBackend';

jest.mock('../../../src/core/config/backendUrlStorage', () => ({
  setStoredBackendApiUrl: jest.fn(),
}));
jest.mock('../../../src/core/auth/roleStorage', () => ({
  setStoredRole: jest.fn(),
}));
jest.mock('../../../src/core/api/endpoints/auth', () => ({
  bestEffortLogoutFromBaseUrl: jest.fn(),
}));
jest.mock('../../../src/core/api/runtimeBaseUrl', () => ({
  getRuntimeApiBaseUrl: jest.fn(() => 'https://old-backend.example.com/api'),
  setRuntimeApiBaseUrl: jest.fn(),
}));

import { bestEffortLogoutFromBaseUrl } from '../../../src/core/api/endpoints/auth';
import { setStoredBackendApiUrl } from '../../../src/core/config/backendUrlStorage';
import { setStoredRole } from '../../../src/core/auth/roleStorage';
import {
  getRuntimeApiBaseUrl,
  setRuntimeApiBaseUrl,
} from '../../../src/core/api/runtimeBaseUrl';

describe('resetBackend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clears backend URL, role, runtime base URL, and React Query cache', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['videos'], [{ id: 'v1' }]);
    expect(queryClient.getQueryData(['videos'])).toEqual([{ id: 'v1' }]);

    resetBackend(queryClient);

    expect(getRuntimeApiBaseUrl).toHaveBeenCalled();
    expect(bestEffortLogoutFromBaseUrl).toHaveBeenCalledWith(
      'https://old-backend.example.com/api'
    );
    expect(setStoredBackendApiUrl).toHaveBeenCalledWith(null);
    expect(setStoredRole).toHaveBeenCalledWith(null);
    expect(setRuntimeApiBaseUrl).toHaveBeenCalled();
    expect(queryClient.getQueryData(['videos'])).toBeUndefined();
  });

  test('does not throw if individual storage operations fail', () => {
    (setStoredBackendApiUrl as jest.Mock).mockImplementationOnce(() => {
      throw new Error('storage failed');
    });
    const queryClient = new QueryClient();
    expect(() => resetBackend(queryClient)).not.toThrow();
  });
});
