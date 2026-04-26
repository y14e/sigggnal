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
    (result, index) => {
      results[index] = result;
    },
    undefined,
    signal,
  );

  return results;
};
