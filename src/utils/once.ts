export function once<T extends unknown[], R>(
  callback: (...args: T) => R | Promise<R>,
): (...args: T) => Promise<R> {
  let pendingPromise: Promise<R> | undefined;

  return (...args: T): Promise<R> => {
    if (pendingPromise === undefined) {
      const nextPromise = Promise.resolve().then(() => callback(...args));
      pendingPromise = nextPromise;

      nextPromise.catch(() => {
        if (pendingPromise === nextPromise) {
          pendingPromise = undefined;
        }
      });
    }

    return pendingPromise;
  };
}
