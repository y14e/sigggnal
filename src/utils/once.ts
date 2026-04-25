export function once<T extends unknown[], R>(
  callback: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  let promise: Promise<R> | undefined;
  return (...args: T): Promise<R> => {
    if (promise === undefined) {
      const p = callback(...args);
      promise = p;
      p.catch(() => {
        if (promise === p) {
          promise = undefined;
        }
      });
    }

    return promise;
  };
}
