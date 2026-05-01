import { anySignal } from '@/signal/any-signal';
import type { Task } from '@/types';

export function _abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError');
}

export function _combineSignals(
  parent?: AbortSignal,
  child?: AbortSignal,
): AbortSignal | undefined {
  if (parent && child) {
    return anySignal(parent, child);
  }
  return child ?? parent;
}

export function _createCleanup(timer: ReturnType<typeof setTimeout> | undefined) {
  return () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

export function _createSettler(
  signal: AbortSignal | undefined,
  reject: (reason?: unknown) => void,
) {
  let isSettled = false;
  const controllers: AbortController[] = [];

  const cleanup = () => {
    signal?.removeEventListener('abort', onAbort);
  };

  const settle = (fn: () => void) => {
    if (isSettled) {
      return;
    }

    isSettled = true;
    cleanup();

    controllers.forEach((controller) => {
      controller.abort();
    });

    fn();
  };

  const onAbort = () => {
    settle(() => reject(_abortReason(signal)));
  };

  signal?.addEventListener('abort', onAbort, { once: true });

  return {
    controllers,
    settle,
    throwIfAborted: () => {
      if (signal?.aborted) {
        settle(() => reject(_abortReason(signal)));
        return true;
      }

      return false;
    },
  };
}

export function _createTimeoutError(ms: number) {
  return new DOMException(`The operation timed out (${ms}ms)`, 'TimeoutError');
}

export function _runWithConcurrency<T>(
  tasks: readonly Task<T>[],
  concurrency: number,
  onSettled?: (result: PromiseSettledResult<T>, index: number) => void,
  shouldStop?: () => boolean,
  signal?: AbortSignal,
): Promise<void> {
  let isDone = false;
  let index = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (isDone) {
        return;
      }

      if (shouldStop?.()) {
        isDone = true;
        resolve();
        return;
      }

      if (index >= tasks.length && active === 0) {
        isDone = true;
        resolve();
        return;
      }

      while (active < concurrency && index < tasks.length) {
        const current = index;
        index++;
        active++;
        const controller = new AbortController();
        const { signal: internal } = controller;

        (tasks[current] as Task<T>)(
          _combineSignals(signal, internal) as AbortSignal,
        )
          .then((value: T) => {
            onSettled?.({ status: 'fulfilled', value }, current);
          })
          .catch((reason: unknown) => {
            onSettled?.({ status: 'rejected', reason }, current);
          })
          .finally(() => {
            active--;
            next();
          });
      }
    };

    signal?.addEventListener(
      'abort',
      () => {
        isDone = true;
        reject(_abortReason(signal));
      },
      { once: true },
    );

    next();
  });
}

export async function _withAbort<T>(
  signal: AbortSignal | undefined,
  setup: (ctrl: AbortController) => {
    promise: Promise<T>;
    cleanup?: () => void;
  },
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(_abortReason(signal));
  }

  const controller = new AbortController();
  const { promise, cleanup: c } = setup(controller);

  const cleanup = () => {
    c?.();
    signal?.removeEventListener('abort', onAbort);
  };

  const onAbort = () => {
    cleanup();
    controller.abort(_abortReason(signal));
  };

  signal?.addEventListener('abort', onAbort, { once: true });

  const abortPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(_abortReason(controller.signal)),
      { once: true },
    );
  });

  return Promise.race([promise, abortPromise]).finally(cleanup);
}
