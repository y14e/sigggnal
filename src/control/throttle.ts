export interface ThrottleOptions {
  readonly leading?: boolean;
  readonly trailing?: boolean;
}

export function throttle<T, R>(
  delay: number,
  fn: (value: T, signal: AbortSignal) => Promise<R>,
  options: ThrottleOptions = {},
): (value: T) => Promise<R | undefined> {
  let controller: AbortController | null = null;
  let lastTime = 0;
  let lastArgs: T | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { leading = true, trailing = true } = options;

  const invoke = (value: T) => {
    controller?.abort();
    controller = new AbortController();
    lastTime = Date.now();
    return fn(value, controller.signal);
  };

  return (value: T): Promise<R | undefined> => {
    const now = Date.now();
    const remaining = lastTime === 0 ? 0 : delay - (now - lastTime);

    if (remaining <= 0) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }

      if (leading) {
        return invoke(value);
      }
    }

    if (trailing && timer === undefined) {
      lastArgs = value;
      return new Promise<R | undefined>((resolve, reject) => {
        timer = setTimeout(() => {
          timer = undefined;

          if (lastArgs !== null) {
            invoke(lastArgs).then(resolve, reject);
            lastArgs = null;
          }
        }, remaining);
      });
    }

    return Promise.resolve(undefined);
  };
}
