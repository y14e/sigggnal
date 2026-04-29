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

* [Concurrency](#concurrency)
* [Control](#control)
* [Retry](#retry)
* [Scheduler](#scheduler)
* [Signal](#signal)
* [Time](#time)
* [Utils](#utils)


### Concurrency

```ts
import { all, any, map, parallel, race, setttled } from 'sigggnal';
```

#### all

```ts
all(tasks, 3, signal);
// => Promise<T[]>
//
// tasks: (signal) => Promise<T>[]
```

#### any

```ts
any(tasks, signal);
// => Promise<T>
//
// tasks: (signal) => Promise<T>[]
```

#### map

```ts
map(items, 3, fn, signal);
// => Promise<T[]>
//
// items: []
// fn: (item, index, signal) => Promise<T>
```

#### parallel

```ts
parallel(tasks, 3, signal);
// => Promise<T[]>
//
// tasks: (signal) => Promise<T>[]
```

#### race

```ts
race(tasks, 3, signal);
// => Promise<T>
//
// tasks: (signal) => Promise<T>[]
```

#### settled

```ts
settled(tasks, 3, signal);
// => Promise<T[]>
//
// tasks: (signal) => Promise<T>[]
```

### Control

```ts
import { debounce, latest, throttle } from 'sigggnal';
```

#### debounce

```ts
debounce(300, fn);
// => (value) => Promise<T>
//
// fn: (value, signal) => Promise<T>
```

#### latest

```ts
latest(fn);
// => (value) => Promise<T>
//
// fn: (value, signal) => Promise<T>
```

#### throttle

```ts
throttle(300, fn, { leading: true, trailing: true });
// => (value) => Promise<T>
//
// fn: (value, signal) => Promise<T>
```

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

<details>
<summary>Retry details</summary>

#### Limit retries

```ts
await retry(fn, {
  maxRetries: 5,
}, signal);
```

#### Backoff

```ts
await retry(fn, {
  initialDelay: 500,
  backoffMultiplier: 2,
  maxDelay: 5000,
}, signal);
```

#### Retry on result

```ts
await retry(async () => {
  const res = await fetch('/api');
  return res;
}, {
  shouldRetryResult: (res) => res.status === 503,
}, signal);
```

#### Stop after total time

```ts
await retry(fn, {
  shouldStop: ({ elapsedTime }) => elapsedTime > 10000,
}, signal);
```

#### Stop on specific error

```ts
await retry(fn, {
  shouldStop: ({ error }) =>
    error instanceof Error && error.message === 'Unauthorized',
}, signal);
```

#### Complex control

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

#### onRetry

```ts
await retry(fn, {
  onRetry: ({ attempt, delay }) => {
    console.log(`Retry #${attempt} in ${delay}ms`);
  },
}, signal);
```
</details>

### Scheduler

```ts
import { createLimiter, createQueue } from 'sigggnal';
```

#### Limiter

```ts
const limit = createLimiter(2);

await Promise.all([
  limit(() => fetch('/a')),
  limit(() => fetch('/b')),
]);
```

#### Queue

```ts
const queue = createQueue({ concurrent: 2 });

queue.add(() => fetch('/a'));
queue.add(() => fetch('/b'));

await queue.onIdle();
```

### Signal

```ts
import { abortable, anySignal, timeoutSignal, withSignal } from 'sigggnal';
```

#### abortable

```ts
abortable(promise, signal);
// => Promise<T>
```

#### anySignal

Uses native `AbortSignal.any` if available.

```ts
anySignal(signal1, signal2, /* ..., */ signalN);
// => AbortSignal
```

#### timeoutSignal

```ts
timeoutSignal(1000, signal);
// => AbortSignal
```

#### withSignal

```ts
withSignal(fn, signal);
// => Promise<T>
//
// fn: (signal, ...args) => Promise<T>
```

### Time

```ts
import { sleep, timeout } from 'sigggnal';
```

#### sleep (wait)

```ts
sleep(1000, signal);
// => Promise<void>

// alias
wait(1000, signal);
```

#### timeout

```ts
timeout(1000, fn, signal);
// => Promise<T>
//
// fn: (signal) => Promise<T>
```

### Utils

```ts
import { deferred, memo, once } from 'sigggnal';
```

#### deferred

```ts
const d = deferred();

setTimeout(() => d.resolve('done'), 1000);

await d.promise;
```

#### memo

```ts
const fn = memo((x) => x * 2, { ttl: 5000 });
```

#### once

```ts
const fn = once(async () => {
  console.log('called once');
});
```


## Comparison

| Feature        | Sigggnal | p-limit | RxJS       |
| -------------- | ---------- | ------- | ---------- |
| AbortSignal    | ✅ Native   | ❌       | ❌ (custom) |
| Retry          | ✅          | ❌       | ⚠️         |
| Concurrency    | ✅          | ✅       | ✅          |
| Flow control   | ✅          | ❌       | ✅          |
| Learning curve | Low        | Low     | High       |
