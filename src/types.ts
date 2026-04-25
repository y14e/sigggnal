export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export type RetryContext<T = unknown> =
  | {
      attempt: number;
      status: 'fulfilled';
      result: T;

      elapsedTime: number;
      delay: number;
    }
  | {
      attempt: number;
      status: 'rejected';
      error: unknown;

      elapsedTime: number;
      delay: number;
    };

export interface RetryOptions<T = unknown> {
  maxRetries?: number;

  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;

  shouldRetryResult?: (result: T) => boolean;
  shouldStop?: (context: RetryContext<T>) => boolean;

  onRetry?: (context: RetryContext<T>) => void;
}

export type Task<T> = (signal: AbortSignal) => Promise<T>;
