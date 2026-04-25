import { runWithConcurrency } from '@/internal';

export async function parallel<T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  concurrency = Infinity,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = [];
  await runWithConcurrency(tasks, concurrency, signal, (_, result) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    }
  });
  return results;
}
