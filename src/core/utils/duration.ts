/**
 * Duration parsing: HH:MM:SS or MM:SS to seconds, and seconds to display string.
 */

/**
 * Parse duration string to total seconds.
 * Supports "H:MM:SS", "MM:SS", "M:SS", or plain seconds number string.
 * e.g. "1:23:45" -> 5025, "12:34" -> 754, "90" -> 90
 */
export function parseDurationToSeconds(hhmmss: string): number {
  if (!hhmmss || typeof hhmmss !== 'string') return 0;
  const parts = hhmmss.trim().split(':').map(p => parseInt(p, 10));
  if (parts.some(n => isNaN(n))) return 0;
  if (parts.length === 1) return Math.floor(parts[0]);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/**
 * Format seconds to "H:MM:SS" or "M:SS" (no leading zero on first segment).
 */
export function formatSecondsToDuration(seconds: number): string {
  const s = Math.floor(Math.max(0, seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}
