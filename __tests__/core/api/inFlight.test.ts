import {
  __getInFlightRequestCount,
  __resetInFlightRequestsForTests,
  buildInFlightKey,
  withInFlightKey,
} from '../../../src/core/api/inFlight';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('inFlight guard', () => {
  beforeEach(() => {
    __resetInFlightRequestsForTests();
  });

  test('deduplicates concurrent requests for the same key', async () => {
    const gate = createDeferred<number>();
    const key = buildInFlightKey('post', '/videos/abc/view');
    let callCount = 0;

    const p1 = withInFlightKey(key, async () => {
      callCount += 1;
      return gate.promise;
    });
    const p2 = withInFlightKey(key, async () => {
      callCount += 1;
      return 999;
    });

    await Promise.resolve();
    expect(callCount).toBe(1);
    expect(__getInFlightRequestCount()).toBe(1);

    gate.resolve(42);
    await expect(p1).resolves.toBe(42);
    await expect(p2).resolves.toBe(42);
    expect(__getInFlightRequestCount()).toBe(0);
  });

  test('runs requests independently for different keys', async () => {
    const keyA = buildInFlightKey('POST', '/collections');
    const keyB = buildInFlightKey('PUT', '/collections/1');

    const [a, b] = await Promise.all([
      withInFlightKey(keyA, async () => 'a'),
      withInFlightKey(keyB, async () => 'b'),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(__getInFlightRequestCount()).toBe(0);
  });
});
