# sigmachine

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
npm i sigmachine
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
import { sleep } from 'sigmachine';

const controller = new AbortController();

setTimeout(() => controller.abort('cancelled'), 1000);

await sleep(3000, controller.signal); // throws
```

### Timeout

```ts
import { timeout } from 'sigmachine';

const result = await timeout(1000, async (signal) => {
  const res = await fetch('/api', { signal });
  return res.json();
});
```

### Retry

```ts
import { retry } from 'sigmachine';

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
import { all } from 'sigmachine';

await all([
  (s) => fetch('/a', { signal: s }),
  (s) => fetch('/b', { signal: s }),
], 2);
```

### `map`

```ts
import { map, sleep } from 'sigmachine';

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
import { race } from 'sigmachine';

const result = await race([
  (s) => fetch('/fast', { signal: s }),
  (s) => fetch('/slow', { signal: s }),
]);
```

### `any`

```ts
import { any } from 'sigmachine';

const result = await any([
  (s) => fetch('/a', { signal: s }),
  (s) => fetch('/b', { signal: s }),
]);
```

## Scheduling

### Limiter

```ts
import { createLimiter } from 'sigmachine';

const limit = createLimiter(2);

await Promise.all([
  limit(() => fetch('/a')),
  limit(() => fetch('/b')),
]);
```

### Queue

```ts
import { createQueue } from 'sigmachine';

const queue = createQueue({ concurrent: 2 });

queue.add(() => fetch('/a'));
queue.add(() => fetch('/b'));

await queue.onIdle();
```

## Flow Control

### `debounce`

```ts
import { debounce } from 'sigmachine';

const fn = debounce(300, async (value, signal) => {
  return fetch(`/search?q=${value}`, { signal });
});
```

### `throttle`

```ts
import { throttle } from 'sigmachine';

const fn = throttle(1000, async (value, signal) => {
  return fetch(`/data?q=${value}`, { signal });
});
```

### `latest`

```ts
import { latest } from 'sigmachine';

const fn = latest(async (value, signal) => {
  return fetch(`/data?q=${value}`, { signal });
});
```

## Signals

### Combine signals

```ts
import { anySignal } from 'sigmachine';

const combined = anySignal(signalA, signalB);
```

* Aborts when **any** signal aborts
* Uses native `AbortSignal.any` if available

### Timeout signal

```ts
import { timeoutSignal } from 'sigmachine';

const signal = timeoutSignal(1000);
```

## Utilities

### `sleep`

```ts
import { sleep } from 'sigmachine';

await sleep(1000);
```

### `deferred`

```ts
import { deferred } from 'sigmachine';

const d = deferred();

setTimeout(() => d.resolve('done'), 1000);

await d.promise;
```

### `once`

```ts
import { once } from 'sigmachine';

const fn = once(async () => {
  console.log('called once');
});
```

### `memo`

```ts
import { memo } from 'sigmachine';

const fn = memo((x) => x * 2);
```

## Design Notes

* Every async operation **accepts AbortSignal**
* Internal cancellation is propagated via `AbortController`
* Tasks are isolated and safely aborted when no longer needed
* Native APIs (`fetch`, `setTimeout`, etc.) integrate seamlessly

## Comparison

| Feature        | sigmachine | p-limit | RxJS       |
| -------------- | ---------- | ------- | ---------- |
| AbortSignal    | ✅ Native   | ❌       | ❌ (custom) |
| Retry          | ✅          | ❌       | ⚠️         |
| Concurrency    | ✅          | ✅       | ✅          |
| Flow control   | ✅          | ❌       | ✅          |
| Learning curve | Low        | Low     | High       |
