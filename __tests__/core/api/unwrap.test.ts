import { unwrap } from '../../../src/core/api/unwrap';

describe('unwrap', () => {
  test('returns direct payload as-is', () => {
    const payload = [{ id: 'v1', title: 'Video 1' }];
    expect(unwrap(payload)).toEqual(payload);
  });

  test('unwraps { success: true, data } payload', () => {
    const payload = { success: true as const, data: { id: 'v2', title: 'Video 2' } };
    expect(unwrap(payload)).toEqual({ id: 'v2', title: 'Video 2' });
  });
});
