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

<a id="concurrency"></a>**Concurrency**

[all](#all) ·
[any](#any) ·
[map](#map) ·
[parallel](#parallel) ·
[race](#race) ·
[settled](#settled)

```ts
import { all, any, map, parallel, race, settled } from 'sigggnal';
```

### all

Runs tasks with limited concurrency. Resolves when all tasks succeed, or rejects on the first error.

```ts
all(tasks, concurrency, signal);
// => Promise<T[]>
//
// tasks: ((signal) => Promise<T>)[]
// concurrency: number
// signal (optional): AbortSignal
```

### any

Resolves with the first fulfilled result. Rejects if all tasks fail.

```ts
any(tasks, signal);
// => Promise<T>
//
// tasks: ((signal) => Promise<T>)[]
// signal (optional): AbortSignal
```

### map

Maps items to async tasks with limited concurrency. Resolves with results in the same order as input.

```ts
map(items, concurrency, fn, signal);
// => Promise<R[]>
//
// items: T[]
// concurrency: number
// fn: (item, index, signal) => Promise<R>
// signal (optional): AbortSignal
```

### parallel

Runs tasks in parallel with optional concurrency control. Resolves with all fulfilled results (errors are ignored).

```ts
parallel(tasks, concurrency, signal);
// => Promise<T[]>
//
// tasks: ((signal) => Promise<T>)[]
// concurrency: number
// signal (optional): AbortSignal
```

### race

Resolves or rejects as soon as one task settles. Cancels all remaining tasks.

```ts
race(tasks, signal);
// => Promise<T>
//
// tasks: ((signal) => Promise<T>)[]
// signal (optional): AbortSignal
```

### settled

Runs all tasks and collects their results. Always resolves with the outcome of each task.

```ts
settled(tasks, concurrency, signal);
// => Promise<T[]>
//
// tasks: ((signal) => Promise<T>)[]
// concurrency: number
// signal (optional): AbortSignal
```

---

<a id="control"></a>**Control**

[debounce](#debounce) ·
[latest](#latest) ·
[throttle](#throttle)

```ts
import { debounce, latest, throttle } from 'sigggnal';
```

### debounce

Debounces async calls. Only the last call is executed; previous pending calls are canceled.

```ts
debounce(delay, fn);
// => (value) => Promise<T>
//
// delay: number (ms)
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
throttle(delay, fn, { leading: true, trailing: true });
// => (value) => Promise<T>
//
// delay: number (ms)
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
// options (optional): RetryOptions
// signal (optional): AbortSignal
```

#### 🪄 Options

```ts
interface RetryOptions<T = unknown> {
  backoffMultiplier?: number; // (default: 2)
  initialDelay?: number;      // ms (default: 1000)
  jitterFactor?: number;      // 0-1 (default: 0)
  maxDelay?: number;          // ms (default: Infinity)
  maxRetries?: number;        // (default: 10)

  onRetry?: (context: RetryContext<T>) => void;
  shouldRetryResult?: (result: T) => boolean;
  shouldStop?: (context: RetryContext<T>) => boolean;
}

type RetryContext<T = unknown> =
  | {
      attempt: number;        // 0-based
      delay: number;          // ms
      elapsedTime: number;    // ms
      result: T;              // Result if retry triggered by result
      status: 'fulfilled';
    }
  | {
      attempt: number;
      delay: number;
      elapsedTime: number;
      error: unknown;         // Error from previous attempt
      status: 'rejected';
  };
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

<a id="scheduler"></a>**Scheduler**

[Limiter](#limiter) ·
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

<a id="signal"></a>**Signal**

[abortable](#abortable) ·
[anySignal](#anysignal) ·
[timeoutSignal](#timeoutsignal) ·
[withSignal](#withsignal)

```ts
import { abortable, anySignal, timeoutSignal, withSignal } from 'sigggnal';
```

### abortable

Wraps a promise to make it abortable. Rejects if the signal is aborted.

```ts
abortable(promise, signal);
// => Promise<T>
//
// promise: Promise<T>
// signal (optional): AbortSignal
```

### anySignal

Combines multiple signals into one. Aborts when any of the input signals abort.

```ts
anySignal(...signals);
// => AbortSignal
//
// ...signals: AbortSignal[]
```

### timeoutSignal

Creates a signal that aborts after a timeout. Also propagates abort from the parent signal.

```ts
timeoutSignal(timeout, signal);
// => AbortSignal
//
// timeout: number (ms)
// signal (optional): AbortSignal
```

### withSignal

Adapts a function to work with composed signals. Combines parent and internal signals into a single one.

```ts
withSignal(fn);
// => (...args) => (parent?) => (internal) => Promise<T>
//
// fn: (signal, ...args) => Promise<T>
```

---

<a id="time"></a>**Time**

[sleep (wait)](#sleep-wait) ·
[timeout](#timeout)

```ts
import { sleep, timeout } from 'sigggnal';
```

### sleep (wait)

```ts
sleep(timeout, signal);
// => Promise<void>
//
// timeout: number (ms)
// signal (optional): AbortSignal

// Alias
wait(1000, signal);
```

### timeout

```ts
timeout(timeout, fn, signal);
// => Promise<T>
//
// timeout: number (ms)
// fn: (signal) => Promise<T>
// signal (optional): AbortSignal
```

---

<a id="utils"></a>**Utils**

[deferred](#deferred) ·
[memo](#memo) ·
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
