import { createLimiter } from './limiter';

export const createQueue = ({
  concurrency = 1,
} = {}): {
  add<T>(task: () => Promise<T>): Promise<T>;
  onIdle(): Promise<void>;
} => {
  let pending = 0;
  const limiter = createLimiter(concurrency);
  let idleResolvers: (() => void)[] = [];

  return {
    async add(task) {
      pending++;

      return limiter(task).finally(() => {
        pending--;

        if (pending > 0 || idleResolvers.length === 0) {
          return;
        }

        idleResolvers.forEach((resolver) => {
          resolver();
        });

        idleResolvers = [];
      });
    },
    onIdle() {
      if (pending === 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => idleResolvers.push(resolve));
    },
  };
};
