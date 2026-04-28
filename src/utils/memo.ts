type MemoNode<T> = {
  objectBranch?: WeakMap<object, MemoNode<T>> | undefined;
  primitiveBranch?: Map<unknown, MemoNode<T>> | undefined;
  promise?: Promise<T> | undefined;
  value?: T | undefined;
  expireAt?: number | undefined;
};

export function memo<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  options: { ttl?: number } = {},
) {
  const { ttl } = options;
  const root: MemoNode<T> = {};

  const getNode = (args: A): MemoNode<T> => {
    let node = root;

    for (const arg of args) {
      const isObject =
        arg !== null && (typeof arg === 'object' || typeof arg === 'function');

      if (isObject) {
        node.objectBranch ??= new WeakMap();
        const map = node.objectBranch;
        let next = map.get(arg as object);
        if (!next) {
          next = {};
          map.set(arg as object, next);
        }
        node = next;
      } else {
        node.primitiveBranch ??= new Map();
        const map = node.primitiveBranch;
        let next = map.get(arg);
        if (!next) {
          next = {};
          map.set(arg, next);
        }
        node = next;
      }
    }

    return node;
  };

  const memoized = (...args: A): Promise<T> => {
    const now = Date.now();
    const node = getNode(args);

    // --- valueキャッシュ ---
    if (node.value !== undefined) {
      if (ttl === undefined || node.expireAt === undefined) {
        return Promise.resolve(node.value);
      }

      if (now < node.expireAt) {
        return Promise.resolve(node.value);
      }

      // 期限切れ
      node.value = undefined;
      node.expireAt = undefined;
    }

    // --- in-flight共有 ---
    if (node.promise) {
      return node.promise;
    }

    // --- 実行 ---
    const p = Promise.resolve().then(() => fn(...args));
    node.promise = p;

    p.then((value) => {
      node.value = value;

      if (ttl !== undefined) {
        node.expireAt = Date.now() + ttl;
      }
    })
      .catch(() => {
        // エラーはキャッシュしない
      })
      .finally(() => {
        if (node.promise === p) {
          delete node.promise;
        }
      });

    return p;
  };

  memoized.clear = () => {
    root.objectBranch = undefined;
    root.primitiveBranch = undefined;
    root.promise = undefined;
    root.value = undefined;
    root.expireAt = undefined;
  };

  memoized.delete = (...args: A) => {
    const node = getNode(args);
    node.promise = undefined;
    node.value = undefined;
    node.expireAt = undefined;
  };

  memoized.invalidate = (predicate: (args: A) => boolean) => {
    const walk = (node: MemoNode<T>, path: unknown[]) => {
      if (node.value !== undefined || node.promise !== undefined) {
        if (predicate(path as A)) {
          node.value = undefined;
          node.promise = undefined;
          node.expireAt = undefined;
        }
      }

      node.primitiveBranch?.forEach((child, key) => {
        walk(child, [...path, key]);
      });
    };

    walk(root, []);
  };

  return memoized as typeof memoized & {
    clear: () => void;
    delete: (...args: A) => void;
    invalidate: (predicate: (args: A) => boolean) => void;
  };
}
