import { anySignal } from '../signal/any-signal';
import type { Task } from '../types.js';

export function run<T>(
  tasks: readonly Task<T>[],
  concurrent: number,
  signal?: AbortSignal,
  onSettled?: (i: number, r: PromiseSettledResult<T>) => void,
  shouldStop?: () => boolean,
): Promise<void> {
  let index = 0;
  let active = 0;
  let finished = false;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (finished || shouldStop?.()) {
        return;
      }

      if (index >= tasks.length && active === 0) {
        finished = true;
        resolve();
        return;
      }

      while (active < concurrent && index < tasks.length) {
        const current = index;
        index += 1;
        active += 1;

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
            active -= 1;
            next();
          });
      }
    };

    signal?.addEventListener(
      'abort',
      () => {
        finished = true;
        reject(signal.reason);
      },
      { once: true },
    );

    next();
  });
}
