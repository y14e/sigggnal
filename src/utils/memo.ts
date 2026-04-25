type MemoNode<R> = {
  promise?: Promise<R>;
  strong?: Map<unknown, MemoNode<R>>;
  weak?: WeakMap<object, MemoNode<R>>;
};

export function memo<T extends unknown[], R>(
  callback: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  const root: MemoNode<R> = {};

  return (...args: T): Promise<R> => {
    let node: MemoNode<R> = root;

    for (const arg of args) {
      if (
        arg !== null &&
        (typeof arg === 'object' || typeof arg === 'function')
      ) {
        if (!node.weak) {
          node.weak = new WeakMap<object, MemoNode<R>>();
        }

        const weak = node.weak;
        const key = arg as object;
        let next = weak.get(key);

        if (!next) {
          next = {};
          weak.set(key, next);
        }

        node = next;
      } else {
        if (!node.strong) {
          node.strong = new Map<unknown, MemoNode<R>>();
        }

        const strong = node.strong;
        let next = strong.get(arg);

        if (!next) {
          next = {};
          strong.set(arg, next);
        }

        node = next;
      }
    }

    if (node.promise === undefined) {
      const current = node;
      const p = callback(...args);
      current.promise = p;
      p.catch(() => {
        if (current.promise === p) {
          delete current.promise;
        }
      });
      return p;
    }

    return node.promise;
  };
}
