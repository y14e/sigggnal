import { runWithConcurrency } from '@/internal';

export const settled = async <T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  concurrency = Infinity,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<T>[]> => {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  await runWithConcurrency(
    tasks,
    concurrency,
    signal,
    (index, result): void => {
      results[index] = result;
    },
  );
  return results;
};
