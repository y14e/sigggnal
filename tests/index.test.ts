import { describe, test, expect } from 'bun:test';
import {
  anySignal,
  timeoutSignal,
  sleep,
  timeout,
  retry,
  all,
  map,
  race,
  any,
  settled,
  parallel,
  throttle,
  debounce,
  latest,
  createLimiter,
  createQueue,
  deferred,
  once,
  memo,
} from '../src/index';

describe('sigggnal', () => {
  // ---------------------------------------------------------------------------
  // Signal
  // ---------------------------------------------------------------------------

  test('anySignal: aborts when one aborts', () => {
    const a = new AbortController();
    const b = new AbortController();

    const signal = anySignal(a.signal, b.signal);

    a.abort('reason');

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('reason');
  });

  test('anySignal: empty → aborted', () => {
    const signal = anySignal();
    expect(signal.aborted).toBe(true);
  });

  test('anySignal: single returns same signal', () => {
    const a = new AbortController();
    const signal = anySignal(a.signal);
    expect(signal).toBe(a.signal);
  });

  test('timeoutSignal: aborts after timeout', async () => {
    const signal = timeoutSignal(10);
    await sleep(20);
    expect(signal.aborted).toBe(true);
  });

  test('timeoutSignal: parent abort propagates', () => {
    const parent = new AbortController();
    const signal = timeoutSignal(50, parent.signal);

    parent.abort('x');

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('x');
  });

  // ---------------------------------------------------------------------------
  // Time
  // ---------------------------------------------------------------------------

  test('sleep: resolves after delay', async () => {
    const start = Date.now();
    await sleep(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });

  test('sleep: abort rejects', async () => {
    const c = new AbortController();

    const p = sleep(50, c.signal);
    c.abort('stop');

    await expect(p).rejects.toBe('stop');
  });

  test('timeout: resolves if within time', async () => {
    const result = await timeout(50, async () => {
      await sleep(10);
      return 42;
    });

    expect(result).toBe(42);
  });

  test('timeout: rejects on timeout', async () => {
    await expect(
      timeout(10, async (signal) => {
        await sleep(50, signal);
      }),
    ).rejects.toThrow('timed out');
  });

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------

  test('retry: succeeds after retries', async () => {
    let count = 0;

    const result = await retry(async () => {
      count++;
      if (count < 3) throw new Error('fail');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(count).toBe(3); // ← 0,1,2 の3回
  });

  test('retry: respects maxRetries (attempt-based)', async () => {
    let count = 0;

    await expect(
      retry(
        async () => {
          count++;
          throw new Error('fail');
        },
        { maxRetries: 1 },
      ),
    ).rejects.toThrow(/^fail$/);

    expect(count).toBe(2); // ← ここ重要（0,1）
  });

  test('retry: shouldRetryResult always true → fails', async () => {
    let count = 0;

    await expect(
      retry(
        async () => {
          count++;
          return 1;
        },
        {
          shouldRetryResult: () => true,
          maxRetries: 2,
        },
      ),
    ).rejects.toThrow(/^Retry failed$/);

    expect(count).toBe(3);
  });

  test('retry: result retry eventually fails', async () => {
    let count = 0;

    await expect(
      retry(
        async () => {
          count++;
          return 1;
        },
        {
          shouldRetryResult: () => true,
          maxRetries: 1,
        },
      ),
    ).rejects.toThrow(/^Retry failed$/);

    expect(count).toBe(2); // ← ここがズレやすい
  });

  test('retry: shouldStop stops early', async () => {
    let count = 0;

    await expect(
      retry(
        async () => {
          count++;
          throw new Error('fail');
        },
        {
          shouldStop: ({ attempt }) => attempt >= 1,
        },
      ),
    ).rejects.toThrow();

    expect(count).toBe(2); // attempt 0,1 で止まる
  });

  test('retry: onRetry called correct times', async () => {
    let calls = 0;

    await expect(
      retry(
        async () => {
          throw new Error('fail');
        },
        {
          maxRetries: 2,
          onRetry: () => calls++,
        },
      ),
    ).rejects.toThrow();

    expect(calls).toBe(2); // ← retry回数だけ呼ばれる
  });

  test('retry: error is not wrapped', async () => {
    await expect(
      retry(
        async () => {
          throw new Error('original');
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/^original$/);
  });

  test('retry: abort propagates', async () => {
    const c = new AbortController();

    const p = retry(async (signal) => {
      await sleep(50, signal);
      return 1;
    }, c.signal);

    c.abort('stop');

    await expect(p).rejects.toBe('stop');
  });

  // ---------------------------------------------------------------------------
  // Concurrent
  // ---------------------------------------------------------------------------

  test('all: resolves all tasks', async () => {
    const tasks = [async () => 1, async () => 2];
    const result = await all(tasks, 2);
    expect(result).toEqual([1, 2]);
  });

  test('all: stops on first error', async () => {
    let ran = false;

    await expect(
      all(
        [
          async () => {
            throw new Error('x');
          },
          async () => {
            ran = true;
          },
        ],
        1,
      ),
    ).rejects.toThrow();

    expect(ran).toBe(false);
  });

  test('map: maps with concurrency', async () => {
    const result = await map([1, 2, 3], 2, async (v) => v * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  test('race: resolves first', async () => {
    const result = await race([
      async () => {
        await sleep(20);
        return 1;
      },
      async () => 2,
    ]);
    expect(result).toBe(2);
  });

  test('race: rejects if first rejects', async () => {
    await expect(
      race([
        async () => {
          throw new Error('fail');
        },
        async () => {
          await sleep(10);
          return 1;
        },
      ]),
    ).rejects.toThrow('fail');
  });

  test('any: resolves first success', async () => {
    const result = await any([
      async () => {
        throw new Error('fail');
      },
      async () => 42,
    ]);
    expect(result).toBe(42);
  });

  test('any: rejects when all fail', async () => {
    await expect(
      any([
        async () => {
          throw new Error('a');
        },
        async () => {
          throw new Error('b');
        },
      ]),
    ).rejects.toThrow('All promises were rejected');
  });

  test('settled: collects all results', async () => {
    const result = await settled([
      async () => 1,
      async () => {
        throw new Error('x');
      },
    ]);

    expect(result[0].status).toBe('fulfilled');
    expect(result[1].status).toBe('rejected');
  });

  test('parallel: collects results without order guarantee', async () => {
    const result = await parallel([
      async () => {
        await sleep(20);
        return 1;
      },
      async () => 2,
    ]);

    expect(result.sort()).toEqual([1, 2]);
  });

  // ---------------------------------------------------------------------------
  // Control
  // ---------------------------------------------------------------------------

  test('throttle: limits calls', async () => {
    let count = 0;

    const fn = throttle(50, async () => {
      count++;
    });

    const p1 = fn(1);
    const p2 = fn(2);
    const p3 = fn(3);

    await Promise.allSettled([p1, p2, p3]);

    expect(count).toBeLessThanOrEqual(2);
  });

  test('throttle: trailing only', async () => {
    let count = 0;

    const fn = throttle(
      20,
      async () => {
        count++;
      },
      { leading: false },
    );

    fn(1);
    fn(2);
    await fn(3);

    expect(count).toBe(1);
  });

  test('debounce: only last value is used', async () => {
    const calls: number[] = [];

    const fn = debounce(10, async (v) => {
      calls.push(v);
    });

    fn(1);
    fn(2);
    await fn(3);

    expect(calls).toEqual([3]);
  });

  test('latest: cancels previous', async () => {
    const fn = latest(async (signal: AbortSignal) => {
      await sleep(20, signal);
      return 1;
    });

    const p1 = fn(1);
    const p2 = fn(2);

    await expect(p1).rejects.toBeDefined();
    await expect(p2).resolves.toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Scheduler
  // ---------------------------------------------------------------------------

  test('createLimiter: limits concurrency', async () => {
    const limit = createLimiter(1);
    let active = 0;
    let max = 0;

    const task = () =>
      limit(async () => {
        active++;
        max = Math.max(max, active);
        await sleep(10);
        active--;
      });

    await Promise.all([task(), task(), task()]);

    expect(max).toBe(1);
  });

  test('createQueue: processes tasks', async () => {
    const queue = createQueue({ concurrency: 1 });
    const result: number[] = [];

    queue.add(async () => result.push(1));
    queue.add(async () => result.push(2));

    await queue.onIdle();

    expect(result).toEqual([1, 2]);
  });

  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------

  test('deferred: resolves externally', async () => {
    const d = deferred<number>();
    setTimeout(() => d.resolve(42), 10);
    await expect(d.promise).resolves.toBe(42);
  });

  test('once: only runs once', async () => {
    let count = 0;

    const fn = once(async () => {
      count++;
      return count;
    });

    await fn();
    await fn();

    expect(count).toBe(1);
  });

  test('once: resets on error', async () => {
    let count = 0;

    const fn = once(async () => {
      count++;
      throw new Error('fail');
    });

    await expect(fn()).rejects.toThrow();
    await expect(fn()).rejects.toThrow();

    expect(count).toBe(2);
  });

  test('memo: caches results', async () => {
    let count = 0;

    const fn = memo(async (x: number) => {
      count++;
      return x * 2;
    });

    await fn(2);
    await fn(2);

    expect(count).toBe(1);
  });

  test('memo: respects maxSize (LRU)', async () => {
    let count = 0;

    const fn = memo(
      async (x: number) => {
        count++;
        return x;
      },
      { maxSize: 1 },
    );

    await fn(1);
    await fn(2);
    await fn(1);

    expect(count).toBe(3);
  });
});
