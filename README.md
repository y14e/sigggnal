# Sigggnal

High-performance async machinery powered by `AbortSignal`. Supports cancellation, timeouts, retries, and concurrency control.

* AbortSignal-first design
* Retry with backoff, jitter, and conditions
* Timeout utilities
* Concurrent task control (`all`, `map`, limiter, queue)
* Promise control helpers (`deferred`, `once`, `memo`)
* Flow control (`debounce`, `throttle`, `latest`)
* Composable cancellation via `anySignal`

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

---

<a id="concurrency"></a>**Concurrency** /
[all](#all),
[any](#any),
[map](#map),
[parallel](#parallel),
[race](#race),
[settled](#settled)

```ts
import { all, any, map, parallel, race, setttled } from 'sigggnal';
```

### all

Runs tasks with limited concurrency. Resolves when all tasks succeed, or rejects on the first error.

```ts
all(tasks, 3, signal);
// => Promise<T[]>
//
// tasks: ((signal) => Promise<T>)[]
```

### any

Runs tasks with limited concurrency. Resolves when all tasks succeed, or rejects on the first error.

```ts
any(tasks, signal);
// => Promise<T>
//
// tasks: ((signal) => Promise<T>)[]
```

### map

Maps items to async tasks with limited concurrency. Resolves with results in the same order as input.

```ts
map(items, 3, fn, signal);
// => Promise<R[]>
//
// items: T[]
// fn: (item, index, signal) => Promise<R>
```

### parallel

Runs tasks in parallel with optional concurrency control. Resolves with all fulfilled results (errors are ignored).

```ts
parallel(tasks, 3, signal);
// => Promise<T[]>
//
// tasks: ((signal) => Promise<T>)[]
```

### race

Resolves or rejects as soon as one task settles. Cancels all remaining tasks.

```ts
race(tasks, signal);
// => Promise<T>
//
// tasks: ((signal) => Promise<T>)[]
```

### settled

Runs all tasks and collects their results. Always resolves with the outcome of each task.

```ts
settled(tasks, 3, signal);
// => Promise<T[]>
//
// tasks: ((signal) => Promise<T>)[]
```

---

<a id="control"></a>**Control** /
[debounce](#debounce),
[latest](#latest),
[throttle](#throttle)

```ts
import { debounce, latest, throttle } from 'sigggnal';
```

### debounce

Debounces async calls. Only the last call is executed; previous pending calls are canceled.

```ts
debounce(300, fn);
// => (value) => Promise<T>
//
// fn: (value, signal) => Promise<T>
```

### latest

Ensures only the latest call is active. Previous calls are canceled when a new one starts.

```ts
latest(fn);
// => (value) => Promise<T>
//
// fn: (value, signal) => Promise<T>
```

### throttle

Throttles async calls to run at most once per interval. Supports leading and trailing execution.

```ts
throttle(300, fn, { leading: true, trailing: true });
// => (value) => Promise<T>
//
// fn: (value, signal) => Promise<T>
```

---

### Retry

```ts
import { retry } from 'sigggnal';
```

```ts
retry(fn, options, signal);
// => Promise<T>
//
// fn: (signal) => Promise<T>
// options: RetryOptions
```

#### RetryOptions

```ts
{
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
{
  attempt: number;     // Current attempt (0-based)
  status: string;      // 'fulfilled' or 'rejected'
  error?: unknown;     // Error from previous attempt
  result?: unknown;    // Result if retry triggered by result
  elapsedTime: number; // Total elapsed time in ms
  delay: number;       // Next delay in ms
}
```

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

---

<a id="scheduler"></a>**Scheduler** /
[Limiter](#limiter),
[Queue](#queue)

```ts
import { createLimiter, createQueue } from 'sigggnal';
```

### Limiter

```ts
const limit = createLimiter(2);

await Promise.all([
  limit(() => fetch('/a')),
  limit(() => fetch('/b')),
]);
```

### Queue

```ts
const queue = createQueue({ concurrent: 2 });

queue.add(() => fetch('/a'));
queue.add(() => fetch('/b'));

await queue.onIdle();
```

---

<a id="signal"></a>**Signal** /
[abortable](#abortable),
[anySignal](#anysignal),
[timeoutSignal](#timeoutsignal),
[withSignal](#withsignal)

```ts
import { abortable, anySignal, timeoutSignal, withSignal } from 'sigggnal';
```

### abortable

Wraps a promise to make it abortable. Rejects if the signal is aborted.

```ts
abortable(promise, signal);
// => Promise<T>
```

### anySignal

Combines multiple signals into one. Aborts when any of the input signals abort.

```ts
anySignal(signal1, signal2, /* ..., */ signalN);
// => AbortSignal
```

### timeoutSignal

Creates a signal that aborts after a timeout. Also propagates abort from the parent signal.

```ts
timeoutSignal(1000, signal);
// => AbortSignal
```

### withSignal

Adapts a function to work with composed signals. Combines parent and internal signals into a single one.

```ts
withSignal(fn, signal);
// => (...args) => (parent?) => (own) => Promise<T>
//
// fn: (signal, ...args) => Promise<T>
```

---

<a id="time"></a>**Time** /
[sleep (wait)](#sleep-wait),
[timeout](#timeout)

```ts
import { sleep, timeout } from 'sigggnal';
```

### sleep (wait)

```ts
sleep(1000, signal);
// => Promise<void>

// alias
wait(1000, signal);
```

### timeout

```ts
timeout(1000, fn, signal);
// => Promise<T>
//
// fn: (signal) => Promise<T>
```

---

<a id="utils"></a>**Utils** /
[deferred](#deferred),
[memo](#memo),
[once](#once)

```ts
import { deferred, memo, once } from 'sigggnal';
```

### deferred

```ts
const d = deferred();

setTimeout(() => d.resolve('done'), 1000);

await d.promise;
```

### memo

```ts
const fn = memo((x) => x * 2, { ttl: 5000 });
```

### once

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
