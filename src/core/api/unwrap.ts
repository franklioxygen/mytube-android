/**
 * Normalize backend response: unwrap { success: true, data: T } to T.
 * Per 03-data-models.md.
 */

export type RawApiResult<T> =
  | T
  | { success: true; data: T; message?: string }
  | { success: false; error?: string; message?: string };

export function unwrap<T>(raw: RawApiResult<T>): T {
  if (
    raw &&
    typeof raw === 'object' &&
    'success' in raw &&
    (raw as { success: unknown }).success === true &&
    'data' in raw
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}
