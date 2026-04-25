import { abortReason } from '@/internal';

export function timeoutSignal(
  timeout: number,
  signal?: AbortSignal,
): AbortSignal {
  const controller = new AbortController();
  const { signal: own } = controller;

  if (signal?.aborted) {
    controller.abort(abortReason(signal));
    return own;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    signal?.removeEventListener('abort', onAbort);
  };

  const onAbort = (): void => {
    cleanup();
    controller.abort(abortReason(signal));
  };

  signal?.addEventListener('abort', onAbort, { once: true });
  own.addEventListener('abort', cleanup, { once: true });

  timer = setTimeout((): void => {
    controller.abort(
      new DOMException(
        `The operation timed out (${timeout}ms)`,
        'TimeoutError',
      ),
    );
  }, timeout);

  return own;
}
