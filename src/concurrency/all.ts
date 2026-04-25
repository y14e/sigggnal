import { runWithConcurrency } from '@/internal';
import type { Task } from '@/types';

export async function all<T>(
  tasks: readonly Task<T>[],
  concurrency: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let firstError: unknown | undefined;
  await runWithConcurrency(
    tasks,
    concurrency,
    (index, result) => {
      if (result.status === 'fulfilled') {
        results[index] = result.value;
      } else if (firstError === undefined) {
        firstError = result.reason;
      }
    },
    () => firstError !== undefined,
    signal,
  );

  if (firstError !== undefined) {
    throw firstError;
  }

  return results;
}
