/**
 * Responsive layout helpers for video-card lists.
 */

export function getVideoCardColumns(windowWidth: number, windowHeight: number): number {
  const shortEdge = Math.min(windowWidth, windowHeight);
  const isLandscape = windowWidth > windowHeight;
  const isTablet = shortEdge >= 600;

  if (isTablet) {
    if (windowWidth >= 1200) return 4;
    if (windowWidth >= 900) return 3;
    return 2;
  }

  if (isLandscape && windowWidth >= 700) {
    return 2;
  }

  return 1;
}
