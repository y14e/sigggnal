type ThrottleOptions = {
  leading?: boolean;
  trailing?: boolean;
};

export function throttle<T, R>(
  delay: number,
  callback: (value: T, signal: AbortSignal) => Promise<R>,
  options: ThrottleOptions = {},
) {
  const { leading = true, trailing = true } = options;

  let lastTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: T | null = null;
  let controller: AbortController | null = null;

  const invoke = (value: T) => {
    controller?.abort();
    controller = new AbortController();
    lastTime = Date.now();
    return callback(value, controller.signal);
  };

  return (value: T): Promise<R | undefined> => {
    const now = Date.now();
    const remaining = delay - (now - lastTime);
    lastArgs = value;

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      if (leading) {
        return invoke(value);
      }
    }

    if (trailing && !timer) {
      return new Promise<R | undefined>((resolve, reject) => {
        timer = setTimeout(() => {
          timer = null;

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
