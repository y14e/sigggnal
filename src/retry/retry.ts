import { anySignal } from '@/signal/any-signal';
import { sleep } from '@/time/sleep';
import type { RetryContext, RetryOptions, Task } from '@/types';

export const retry = async <T>(
  callback: Task<T>,
  optionsOrSignal?: RetryOptions<T> | AbortSignal,
  maybeSignal?: AbortSignal,
): Promise<T> => {
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

    let context: RetryContext<T>;

    try {
      const result = await callback(combined);

      if (!shouldRetryResult?.(result)) {
        return result;
      }

      const elapsedTime = Date.now() - start;

      const base = Math.min(
        initialDelay * backoffMultiplier ** attempt,
        maxDelay,
      );

      const delay =
        jitterFactor > 0 ? base * (1 + Math.random() * jitterFactor) : base;

      context = {
        attempt,
        status: 'fulfilled',
        result,
        elapsedTime,
        delay,
      };

      lastError = result instanceof Error ? result : new Error(String(result));

      controller.abort(lastError);
    } catch (error) {
      const elapsedTime = Date.now() - start;

      const base = Math.min(
        initialDelay * backoffMultiplier ** attempt,
        maxDelay,
      );

      const delay =
        jitterFactor > 0 ? base * (1 + Math.random() * jitterFactor) : base;

      context = {
        attempt,
        status: 'rejected',
        error,
        elapsedTime,
        delay,
      };

      lastError = error;

      controller.abort(error);
    }

    if (attempt === maxRetries || shouldStop?.(context)) {
      if (context.status === 'rejected') {
        throw context.error;
      }
      throw lastError ?? new Error('Retry failed');
    }

    onRetry?.(context);

    try {
      await sleep(context.delay, signal);
    } catch {
      throw signal?.reason ?? lastError;
    }
  }

  throw lastError ?? new Error('Retry failed');
};
