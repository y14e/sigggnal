export function once<Args extends unknown[], T>(
  callback: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<T> {
  let isCalled = false;
  let result: T;
  return async (...args: Args) => {
    if (!isCalled) {
      isCalled = true;
      result = await callback(...args);
    }

    return result;
  };
}
