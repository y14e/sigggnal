import { abortReason } from '@/internal';
import { anySignal } from '@/signal/any-signal';
import type { Task } from '@/types';

export const any = <T>(
  tasks: readonly Task<T>[],
  signal?: AbortSignal,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    if (tasks.length === 0) {
      return reject(new AggregateError([], 'All promises were rejected'));
    }

    if (signal?.aborted) {
      return reject(abortReason(signal));
    }

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    let isSettled = false;
    const controllers: AbortController[] = [];

    const settle = (callback: () => void, reason?: unknown): void => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();

      controllers.forEach((controller) => {
        controller.abort(reason);
      });

      callback();
    };

    const onAbort = (): void => {
      const reason = abortReason(signal);
      settle(() => reject(reason), reason);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    const errors: unknown[] = [];
    let rejected = 0;

    tasks.forEach((task) => {
      const controller = new AbortController();
      controllers.push(controller);
      const { signal: own } = controller;
      const combined = signal ? anySignal(signal, own) : own;

      task(combined)
        .then((value) => settle(() => resolve(value)))
        .catch((reason) => {
          errors.push(reason);
          rejected++;

          if (rejected === tasks.length) {
            settle(() =>
              reject(new AggregateError(errors, 'All promises were rejected')),
            );
          }
        });
    });
  });
};
