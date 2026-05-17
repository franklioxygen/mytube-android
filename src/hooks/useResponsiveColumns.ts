/**
 * Reactive column-count hook for tablet-aware list layouts.
 * Encapsulates the width>=600 tablet test that was previously repeated
 * across multiple screens.
 */

import { useWindowDimensions } from 'react-native';
import { getVideoCardColumns } from '../core/utils/layout';

export interface UseResponsiveColumnsResult {
  columns: number;
  width: number;
  height: number;
  isTablet: boolean;
}

export function useResponsiveColumns(): UseResponsiveColumnsResult {
  const { width, height } = useWindowDimensions();
  const columns = getVideoCardColumns(width, height);
  const isTablet = Math.min(width, height) >= 600;
  return { columns, width, height, isTablet };
}
