import { anySignal } from '@/signal/any-signal';
import { sleep } from '@/time/sleep';
import type { RetryContext, RetryOptions, Task } from '@/types';

export async function retry<T>(
  fn: Task<T>,
  optionsOrSignal?: RetryOptions<T> | AbortSignal,
  maybeSignal?: AbortSignal,
): Promise<T> {
  let options: RetryOptions<T>;
  let signal: AbortSignal | undefined;

  if (optionsOrSignal instanceof AbortSignal) {
    signal = optionsOrSignal;
    options = {};
  } else {
    options = optionsOrSignal ?? {};
    signal = maybeSignal;
  }

  const {
    maxRetries = 10,
    initialDelay = 1000,
    maxDelay = Infinity,
    backoffMultiplier = 2,
    jitterFactor = 0,
    shouldRetryResult,
    shouldStop,
    onRetry,
  } = options;

  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw signal.reason;
    }

    const controller = new AbortController();
    const combined = signal
      ? anySignal(signal, controller.signal)
      : controller.signal;

    const elapsedTime = Date.now() - startTime;

    const base = Math.min(
      initialDelay * backoffMultiplier ** attempt,
      maxDelay,
    );

    const delay =
      jitterFactor > 0 ? base * (1 + Math.random() * jitterFactor) : base;

    let context: RetryContext<T>;

    try {
      const result = await fn(combined);

      // 成功 → retry不要
      if (!shouldRetryResult?.(result)) {
        return result;
      }

      // 成功だけど retry対象
      context = {
        attempt,
        delay,
        elapsedTime,
        result,
        status: 'fulfilled',
      };

      // result系は error扱いしない
      lastError = undefined;
    } catch (error) {
      context = {
        attempt,
        delay,
        elapsedTime,
        error,
        status: 'rejected',
      };

      lastError = error;

      // error時のみ abort伝播
      controller.abort(error);
    }

    // 終了条件
    if (attempt === maxRetries || shouldStop?.(context)) {
      if (context.status === 'rejected') {
        throw context.error;
      }

      // result retry failure
      throw new Error('Retry failed');
    }

    // フック
    onRetry?.(context);

    // wait
    try {
      await sleep(context.delay, signal);
    } catch {
      throw signal?.reason ?? lastError ?? new Error('Retry aborted');
    }
  }

  // 通常ここには来ないが安全のため
  throw lastError ?? new Error('Retry failed');
}
