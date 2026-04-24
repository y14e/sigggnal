import type { Task } from '../types';
import { run } from './internal';

export const all = async <T>(
  tasks: readonly Task<T>[],
  concurrent: number,
  signal?: AbortSignal,
): Promise<T[]> => {
  const result: T[] = new Array(tasks.length);
  let error: unknown | undefined;

  await run(
    tasks,
    concurrent,
    signal,
    (i, r) => {
      if (r.status === 'fulfilled') {
        result[i] = r.value as T;
      } else if (error === undefined) {
        error = r.reason;
      }
    },
    () => error !== undefined,
  );

  if (error !== undefined) {
    throw error;
  }

  return result;
};
