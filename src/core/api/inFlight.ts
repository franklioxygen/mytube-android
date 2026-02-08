/**
 * Global in-flight guard for write requests.
 * Uses method + normalized target key to avoid duplicate concurrent writes.
 */

const inFlightRequests = new Map<string, Promise<unknown>>();

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const [rawPath, rawQuery = ''] = withLeadingSlash.split('?');
  const normalizedPath = rawPath.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';

  return rawQuery ? `${normalizedPath}?${rawQuery}` : normalizedPath;
}

function normalizeAbsoluteUrl(urlText: string): string {
  const match = urlText
    .trim()
    .match(/^(https?:\/\/[^/?#]+)(\/[^?#]*)?(\?[^#]*)?/i);
  if (!match) return normalizePath(urlText);

  const origin = match[1].replace(/\/+$/, '');
  const path = (match[2] ?? '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  const query = match[3] ?? '';
  return `${origin}${path}${query}`;
}

function normalizeTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return normalizeAbsoluteUrl(trimmed);
  }
  return normalizePath(trimmed);
}

export function buildInFlightKey(method: string, target: string): string {
  return `${method.trim().toUpperCase()} ${normalizeTarget(target)}`;
}

/**
 * Run request once per key at a time.
 * If a request with the same key is already running, return that same promise.
 */
export function withInFlightKey<T>(
  key: string,
  requestFactory: () => Promise<T>
): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const request = Promise.resolve().then(requestFactory);
  inFlightRequests.set(key, request);

  request.finally(() => {
    if (inFlightRequests.get(key) === request) {
      inFlightRequests.delete(key);
    }
  });

  return request;
}

// Test-only helpers.
export function __getInFlightRequestCount(): number {
  return inFlightRequests.size;
}

export function __resetInFlightRequestsForTests(): void {
  inFlightRequests.clear();
}
