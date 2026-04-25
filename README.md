# Sigggnal

High-performance async machinery powered by `AbortSignal`. Supports cancellation, timeouts, retries, and concurrency control.

* 🚀 AbortSignal-first design
* 🔁 Retry with backoff, jitter, and conditions
* ⏱ Timeout utilities
* ⚡ Concurrent task control (`all`, `map`, limiter, queue)
* 🧠 Promise control helpers (`deferred`, `once`, `memo`)
* 🎛 Flow control (`debounce`, `throttle`, `latest`)
* 🧩 Composable cancellation via `anySignal`

---

## Built Around AbortSignal

This library is designed from the ground up with AbortSignal as a first-class primitive — not an afterthought.

Instead of inventing custom cancellation APIs, everything composes naturally around the standard Web API. Every async operation accepts a signal, propagates it downstream, and reacts to it immediately.

* **Cancellation is universal** — stop anything, anytime
* **Timeouts are just signals** — no special cases
* **Concurrency is cooperative** — tasks respect cancellation automatically
* **Retries are interruptible** — no more waiting for backoff loops to finish

Signals are merged, forwarded, and isolated per task, so complex flows stay predictable and leak-free. For example, multiple signals can be combined into one, ensuring that any upstream cancellation propagates instantly .

This approach enables a consistent mental model:

> If you can pass a signal, you can control it.

No hidden state. No global flags. No ad-hoc cancellation logic.

Just **composable, standard, AbortSignal-driven async control**.

---

## Installation

```bash
npm i sigggnal
```

## Usage

### Concurrency

#### `all` (with limit)

```ts
import { all } from 'sigggnal';

await all([
  (s) => fetch('/a', { signal: s }),
  (s) => fetch('/b', { signal: s }),
], 2, signal);
```

#### `map`

```ts
import { map, sleep } from 'sigggnal';

const result = await map(
  [1, 2, 3],
  2,
  async (value, signal) => {
    await sleep(1000, signal);
    return value * 2;
  },
  signal
);
```

#### `race`
#### `any`
#### `parallel`
#### `settled`

### Retry

```ts
import { retry } from 'sigggnal';

const result = await retry(async (signal) => {
  const res = await fetch('/api', { signal });
  return res.json();
}, {
  maxRetries: 5,
  minTimeout: 500,
}, signal);
```

#### RetryOptions

```ts
interface RetryOptions {
  maxRetries?: number;        // Safety cap (default: 10)
  initialDelay?: number;      // Initial delay in ms (default: 1000)
  maxDelay?: number;          // Maximum delay in ms (default: Infinity)
  backoffMultiplier?: number; // Backoff multiplier (default: 2)
  jitterFactor?: number;      // Jitter factor (0–1) (default: 0)
  shouldStop?: (context: RetryContext) => boolean;
  shouldRetryResult?: (result: unknown) => boolean;
  onRetry?: (context: RetryContext) => void;
}
```

#### RetryContext

```ts
interface RetryContext {
  attempt: number;     // Current attempt (0-based)
  status: string;      // 'fulfilled' or 'rejected'
  error?: unknown;     // Error from previous attempt
  result?: unknown;    // Result if retry triggered by result
  elapsedTime: number; // Total elapsed time in ms
  delay: number;       // Next delay in ms
}
```

Retry behavior is controlled by `shouldStop(context)`.

* `true` → stop immediately
* `false` → continue retrying

### Limit retries

```ts
await retry(fn, {
  maxRetries: 5,
}, signal);
```

### Backoff

```ts
await retry(fn, {
  initialDelay: 500,
  backoffMultiplier: 2,
  maxDelay: 5000,
}, signal);
```

### Retry on result

```ts
await retry(async () => {
  const res = await fetch('/api');
  return res;
}, {
  retryOnResult: (res) => res.status === 503,
}, signal);
```

### Stop after total time

```ts
await retry(fn, {
  shouldStop: ({ elapsedTime }) => elapsedTime > 10000,
}, signal);
```

### Stop on specific error

```ts
await retry(fn, {
  shouldStop: ({ error }) =>
    error instanceof Error && error.message === 'Unauthorized',
}, signal);
```

### Complex control

```ts
await retry(fn, {
  shouldStop: ({ attempt, elapsedTime, error }) => {
    if (attempt >= 5) return true;
    if (elapsedTime > 10000) return true;

    if (error instanceof Error) {
      if (error.message.includes('fatal')) return true;
    }

    return false;
  },
}, signal);
```

### onRetry

```ts
await retry(fn, {
  onRetry: ({ attempt, delay }) => {
    console.log(`Retry #${attempt} in ${delay}ms`);
  },
}, signal);
```

## Scheduling

### Limiter

```ts
import { createLimiter } from 'sigggnal';

const limit = createLimiter(2);

await Promise.all([
  limit(() => fetch('/a')),
  limit(() => fetch('/b')),
]);
```

#### Queue

```ts
import { createQueue } from 'sigggnal';

const queue = createQueue({ concurrent: 2 });

queue.add(() => fetch('/a'));
queue.add(() => fetch('/b'));

await queue.onIdle();
```

### Control

#### `debounce`

```ts
import { debounce } from 'sigggnal';

const fn = debounce(300, async (value, signal) => {
  return fetch(`/search?q=${value}`, { signal });
});
```

#### `throttle`

```ts
import { throttle } from 'sigggnal';

const fn = throttle(1000, async (value, signal) => {
  return fetch(`/data?q=${value}`, { signal });
});
```

#### `latest`

```ts
import { latest } from 'sigggnal';

const fn = latest(async (value, signal) => {
  return fetch(`/data?q=${value}`, { signal });
});
```

### Signals

#### Combine signals

```ts
import { anySignal } from 'sigggnal';

const combined = anySignal(signalA, signalB);
```

* Aborts when **any** signal aborts
* Uses native `AbortSignal.any` if available

#### Timeout signal

```ts
import { timeoutSignal } from 'sigggnal';

const controller = new AbortController();

await timeoutSignal(1000, controller.signal);
```

### Time

#### `sleep` (`wait`)

```ts
import { sleep } from 'sigggnal';

const controller = new AbortController();

await sleep(1000, controller.signal);
```

#### `timeout`

```ts
import { timeout } from 'sigggnal';

const controller = new AbortController();

await timeout(1000, fn, signal);
```

### Utils

#### `deferred`

```ts
import { deferred } from 'sigggnal';

const d = deferred();

setTimeout(() => d.resolve('done'), 1000);

await d.promise;
```

#### `once`

```ts
import { once } from 'sigggnal';

const fn = once(async () => {
  console.log('called once');
});
```

#### `memo`

```ts
import { memo } from 'sigggnal';

const fn = memo((x) => x * 2);
```

## Comparison

| Feature        | Sigggnal | p-limit | RxJS       |
| -------------- | ---------- | ------- | ---------- |
| AbortSignal    | ✅ Native   | ❌       | ❌ (custom) |
| Retry          | ✅          | ❌       | ⚠️         |
| Concurrency    | ✅          | ✅       | ✅          |
| Flow control   | ✅          | ❌       | ✅          |
| Learning curve | Low        | Low     | High       |
