import { all } from '@/concurrency/all';
import type { Task } from '@/types';

export function map<T, R>(
  items: T[],
  concurrency: number,
  callback: (item: T, signal: AbortSignal, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const tasks: Task<R>[] = items.map(
    (item, index) => (signal) => callback(item, signal, index),
  );
  return all(tasks, concurrency, signal);
}
