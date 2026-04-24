import { run } from './internal';

export const parallel = async <T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  concurrent = Infinity,
  signal?: AbortSignal,
): Promise<T[]> => {
  const result: T[] = [];
  await run(tasks, concurrent, signal, (_, r) => {
    if (r.status === 'fulfilled') {
      result.push(r.value);
    }
  });
  return result;
};
