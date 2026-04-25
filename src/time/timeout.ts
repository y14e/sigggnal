import { abortReason } from '@/internal';
import { anySignal } from '@/signal/any-signal';

export async function timeout<T>(
  timeout: number,
  callback: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(abortReason(signal));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    signal?.removeEventListener('abort', onAbort);
  };

  const controller = new AbortController();

  const onAbort = (): void => {
    cleanup();
    controller.abort(abortReason(signal));
  };

  signal?.addEventListener('abort', onAbort, { once: true });

  timer = setTimeout(() => {
    controller.abort(
      new DOMException(
        `The operation timed out (${timeout}ms)`,
        'TimeoutError',
      ),
    );
  }, timeout);

  const { signal: own } = controller;
  return callback(signal ? anySignal(signal, own) : own).finally(cleanup);
}
