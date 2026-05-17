import { getVideoCardColumns } from '../../src/core/utils/layout';

// useResponsiveColumns is a thin wrapper over useWindowDimensions + getVideoCardColumns.
// React Native's test environment makes mocking useWindowDimensions brittle, so we
// validate the pure column-count logic that the hook delegates to.
describe('useResponsiveColumns (layout logic)', () => {
  test('returns 1 column on a small phone', () => {
    expect(getVideoCardColumns(360, 800)).toBe(1);
  });

  test('returns 2 columns on a small tablet', () => {
    expect(getVideoCardColumns(800, 1200)).toBe(2);
  });

  test('returns 3 columns on a wide tablet', () => {
    expect(getVideoCardColumns(1000, 700)).toBe(3);
  });

  test('returns 4 columns on a very wide tablet', () => {
    expect(getVideoCardColumns(1400, 900)).toBe(4);
  });

  test('returns 2 columns in landscape on a small phone with enough width', () => {
    expect(getVideoCardColumns(720, 400)).toBe(2);
  });
});
