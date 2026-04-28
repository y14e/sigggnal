import { anySignal } from './any-signal';

export function withSignal<T extends unknown[], R>(
  callback: (signal: AbortSignal, ...args: T) => Promise<R>,
) {
  return (...args: T) =>
    (parent?: AbortSignal) =>
    (own: AbortSignal) =>
      callback(parent ? anySignal(parent, own) : own, ...args);
}
