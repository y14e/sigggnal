# Sigggnal

High-performance async machinery powered by `AbortSignal`. Supports cancellation, timeouts, retries, and concurrency control.

## Features

* 🚀 AbortSignal-first design
* 🔁 Retry with backoff, jitter, and conditions
* ⏱ Timeout utilities
* ⚡ Concurrent task control (`all`, `map`, limiter, queue)
* 🧠 Promise control helpers (`deferred`, `once`, `memo`)
* 🎛 Flow control (`debounce`, `throttle`, `latest`)
* 🧩 Composable cancellation via `anySignal`

## Installation

```bash
npm i sigggnal
```

## Philosophy

This library treats **AbortSignal as the single control plane** for async flow.

Instead of inventing new abstractions, everything is:

* cancelable
* composable
* interoperable with Web / Node APIs

## Basic Usage

### Cancellation

```ts
import { sleep } from 'sigggnal';

const controller = new AbortController();

setTimeout(() => controller.abort('cancelled'), 1000);

await sleep(3000, controller.signal); // throws
```

### Timeout

```ts
import { timeout } from 'sigggnal';

const result = await timeout(1000, async (signal) => {
  const res = await fetch('/api', { signal });
  return res.json();
});
```

### Retry

```ts
import { retry } from 'sigggnal';

const result = await retry(async (signal) => {
  const res = await fetch('/api', { signal });
  return res.json();
}, undefined, {
  maxRetries: 5,
  minTimeout: 500,
});
```

## Concurrency

### `all` (with limit)

```ts
import { all } from 'sigggnal';

await all([
  (s) => fetch('/a', { signal: s }),
  (s) => fetch('/b', { signal: s }),
], 2);
```

### `map`

```ts
import { map, sleep } from 'sigggnal';

const result = await map(
  [1, 2, 3],
  2,
  async (value, signal) => {
    await sleep(1000, signal);
    return value * 2;
  }
);
```

### `race`

```ts
import { race } from 'sigggnal';

const result = await race([
  (s) => fetch('/fast', { signal: s }),
  (s) => fetch('/slow', { signal: s }),
]);
```

### `any`

```ts
import { any } from 'sigggnal';

const result = await any([
  (s) => fetch('/a', { signal: s }),
  (s) => fetch('/b', { signal: s }),
]);
```

### `parallel`

```ts
import { parallel } from 'sigggnal';

const result = await parallel([
  (s) => fetch('/a', { signal: s }),
  (s) => fetch('/b', { signal: s }),
]);
```

### `settled`

```ts
import { settled } from 'sigggnal';

const result = await settled([
  (s) => fetch('/a', { signal: s }),
  (s) => fetch('/b', { signal: s }),
]);
```

## Retry

### Options

```ts
interface RetryOptions {
  maxRetries?: number;     // Maximum number of retries (default: 10)

  minTimeout?: number;     // Initial delay in ms (default: 1000)
  maxTimeout?: number;     // Maximum delay in ms (default: Infinity)
  factor?: number;         // Backoff multiplier (default: 2)
  jitter?: number;         // Jitter factor (0–1) (default: 0)

  maxTotalTime?: number;   // Maximum total retry time in ms

  retryOnError?: (error: unknown) => boolean;
  retryOnResult?: (result: unknown) => boolean;

  onRetry?: (context: RetryContext) => void;
}
```

### RetryContext

```ts
interface RetryContext {
  attempt: number;   // Current attempt (0-based)
  error?: unknown;   // Present if retry triggered by error
  result?: unknown;  // Present if retry triggered by result
  delay: number;     // Next delay in ms
}
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

### Queue

```ts
import { createQueue } from 'sigggnal';

const queue = createQueue({ concurrent: 2 });

queue.add(() => fetch('/a'));
queue.add(() => fetch('/b'));

await queue.onIdle();
```

## Flow Control

### `debounce`

```ts
import { debounce } from 'sigggnal';

const fn = debounce(300, async (value, signal) => {
  return fetch(`/search?q=${value}`, { signal });
});
```

### `throttle`

```ts
import { throttle } from 'sigggnal';

const fn = throttle(1000, async (value, signal) => {
  return fetch(`/data?q=${value}`, { signal });
});
```

### `latest`

```ts
import { latest } from 'sigggnal';

const fn = latest(async (value, signal) => {
  return fetch(`/data?q=${value}`, { signal });
});
```

## Signals

### Combine signals

```ts
import { anySignal } from 'sigggnal';

const combined = anySignal(signalA, signalB);
```

* Aborts when **any** signal aborts
* Uses native `AbortSignal.any` if available

### Timeout signal

```ts
import { timeoutSignal } from 'sigggnal';

const signal = timeoutSignal(1000);
```

## Utilities

### `sleep` (`wait`)

```ts
import { sleep } from 'sigggnal';

await sleep(1000);
```

### `deferred`

```ts
import { deferred } from 'sigggnal';

const d = deferred();

setTimeout(() => d.resolve('done'), 1000);

await d.promise;
```

### `once`

```ts
import { once } from 'sigggnal';

const fn = once(async () => {
  console.log('called once');
});
```

### `memo`

```ts
import { memo } from 'sigggnal';

const fn = memo((x) => x * 2);
```

## Design Notes

* Every async operation **accepts AbortSignal**
* Internal cancellation is propagated via `AbortController`
* Tasks are isolated and safely aborted when no longer needed
* Native APIs (`fetch`, `setTimeout`, etc.) integrate seamlessly

## Comparison

| Feature        | Sigggnal | p-limit | RxJS       |
| -------------- | ---------- | ------- | ---------- |
| AbortSignal    | ✅ Native   | ❌       | ❌ (custom) |
| Retry          | ✅          | ❌       | ⚠️         |
| Concurrency    | ✅          | ✅       | ✅          |
| Flow control   | ✅          | ❌       | ✅          |
| Learning curve | Low        | Low     | High       |
