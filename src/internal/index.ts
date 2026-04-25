import { anySignal } from '@/signal/any-signal';
import type { Task } from '@/types';

export function abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError');
}

export function runWithConcurrency<T>(
  tasks: readonly Task<T>[],
  concurrency: number,
  signal?: AbortSignal,
  onSettled?: (i: number, r: PromiseSettledResult<T>) => void,
  shouldStop?: () => boolean,
): Promise<void> {
  let isDone = false;
  let index = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (isDone || shouldStop?.()) {
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
        const { signal: own } = controller;
        const combined = signal ? anySignal(signal, own) : own;

        (tasks[current] as Task<T>)(combined)
          .then((value: T) => {
            onSettled?.(current, { status: 'fulfilled', value });
          })
          .catch((reason: unknown) => {
            onSettled?.(current, { status: 'rejected', reason });
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
        reject(abortReason(signal));
      },
      { once: true },
    );

    next();
  });
}
