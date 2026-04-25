import { abortReason } from '@/internal';

export function anySignal(
  ...signals: (AbortSignal | null | undefined)[]
): AbortSignal {
  const sources = signals.filter((signal): signal is AbortSignal => {
    return typeof signal === 'object' && signal !== null && 'aborted' in signal;
  });

  const controller = new AbortController();

  if (sources.length === 0) {
    controller.abort(new DOMException('Aborted', 'AbortError'));
    return controller.signal;
  }

  if (sources.length === 1) {
    return sources[0] as AbortSignal;
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(sources);
  }

  const { signal: own } = controller;

  const cleanup = (): void => {
    for (const source of sources) {
      source.removeEventListener('abort', onAbort);
    }

    own.removeEventListener('abort', cleanup);
  };

  const onAbort = (event: Event): void => {
    cleanup();
    controller.abort(abortReason(event.currentTarget as AbortSignal));
  };

  own.addEventListener('abort', cleanup, { once: true });

  for (const source of sources) {
    if (source.aborted) {
      cleanup();
      controller.abort(abortReason(source));
      return own;
    }

    source.addEventListener('abort', onAbort, { once: true });
  }

  return own;
}
