import { runWithConcurrency } from '@/internal';

export async function parallel<T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  concurrency = Infinity,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = [];

  await runWithConcurrency(
    tasks,
    concurrency,
    (result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    },
    undefined,
    signal,
  );

  return results;
}
