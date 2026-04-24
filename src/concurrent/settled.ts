import { run } from './internal';

export const settled = async <T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  concurrent = Infinity,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<T>[]> => {
  const result: PromiseSettledResult<T>[] = new Array(tasks.length);
  await run(tasks, concurrent, signal, (i, r) => {
    result[i] = r;
  });
  return result;
};
