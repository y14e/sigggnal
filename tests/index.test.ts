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

  test('timeoutSignal: aborts after timeout', async () => {
    const signal = timeoutSignal(10);

    await new Promise((r) => setTimeout(r, 20));
    expect(signal.aborted).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Time
  // ---------------------------------------------------------------------------

  test('sleep: resolves after delay', async () => {
    const start = Date.now();
    await sleep(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });

  test('timeout(fn): rejects on timeout', async () => {
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
    expect(count).toBe(3);
  });

  test('retry: respects maxRetries', async () => {
    await expect(
      retry(
        async () => {
          throw new Error('fail');
        },
        { maxRetries: 1 },
      ),
    ).rejects.toThrow('fail');
  });

  // ---------------------------------------------------------------------------
  // Concurrent
  // ---------------------------------------------------------------------------

  test('all: resolves all tasks', async () => {
    const tasks = [async () => 1, async () => 2];

    const result = await all(tasks, 2);
    expect(result).toEqual([1, 2]);
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

  test('any: resolves first success', async () => {
    const result = await any([
      async () => {
        throw new Error('fail');
      },
      async () => 42,
    ]);
    expect(result).toBe(42);
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
      return count;
    });

    const p1 = fn(1);
    const p2 = fn(2);
    const p3 = fn(3);

    await Promise.allSettled([p1, p2, p3]);

    expect(count).toBeLessThanOrEqual(2);
  });

  test('debounce: only last call executes', async () => {
    let count = 0;

    const fn = debounce(10, async () => {
      count++;
      return count;
    });

    fn(1);
    fn(2);
    await fn(3);

    expect(count).toBe(1);
  });

  test('latest: cancels previous', async () => {
    const fn = latest(async (signal: AbortSignal, _: number) => {
      await sleep(20, signal); // ← signalを渡す
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
});
