import { anySignal } from '@/signal/any-signal';
import { sleep } from '@/time/sleep';
import type { RetryContext, RetryOptions, Task } from '@/types';

export const retry = async <T>(
  callback: Task<T>,
  options: RetryOptions = {},
  signal?: AbortSignal,
): Promise<T> => {
  const {
    maxRetries = 10,
    initialDelay = 1000,
    maxDelay = Infinity,
    backoffMultiplier = 2,
    jitterFactor = 0,
    shouldStop,
    retryOnResult,
    onRetry,
  } = options;

  const start = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw signal.reason;
    }

    const controller = new AbortController();
    const combined = signal
      ? anySignal(signal, controller.signal)
      : controller.signal;

    let result: T | undefined;
    let error: unknown;

    try {
      result = await callback(combined);

      if (!retryOnResult?.(result)) {
        return result;
      }

      error = result instanceof Error ? result : new Error(String(result));
      lastError = error;
    } catch (e) {
      error = e;
      lastError = e;
    }

    controller.abort();

    const elapsedTime = Date.now() - start;

    const base = Math.min(
      initialDelay * backoffMultiplier ** attempt,
      maxDelay,
    );

    const delay =
      jitterFactor > 0 ? base * (1 + Math.random() * jitterFactor) : base;

    const context: RetryContext = {
      attempt,
      error,
      result,
      elapsedTime,
      delay,
    };

    if (attempt === maxRetries || shouldStop?.(context)) {
      throw error;
    }

    onRetry?.(context);

    try {
      await sleep(delay, signal);
    } catch {
      throw signal?.reason ?? error;
    }
  }

  throw lastError;
};
