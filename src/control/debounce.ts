export const debounce = <T, R>(
  delay: number,
  callback: (value: T, signal: AbortSignal) => Promise<R>,
) => {
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (value: T) => {
    controller?.abort();

    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    controller = new AbortController();
    return new Promise<R>((resolve, reject) => {
      timer = setTimeout(() => {
        callback(value, controller?.signal as AbortSignal).then(
          resolve,
          reject,
        );
      }, delay);
    });
  };
};
