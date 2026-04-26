export function latest<T, R>(
  callback: (value: T, signal: AbortSignal) => Promise<R>,
) {
  let controller: AbortController | null = null;

  return (value: T) => {
    controller?.abort();
    controller = new AbortController();
    return callback(value, controller.signal);
  };
}
