import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { OPTIONAL_DEPS_METADATA, SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import {
  RUN_CONCURRENCY_LIMITER_OPTIONS,
  RunConcurrencyLimiter,
} from '../src/protocol/run-concurrency-limiter';

test('run concurrency limiter options are optional for Nest dependency injection', () => {
  const optionalDeps = Reflect.getMetadata(OPTIONAL_DEPS_METADATA, RunConcurrencyLimiter) || [];
  const declaredDeps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, RunConcurrencyLimiter) || [];

  assert.ok(optionalDeps.includes(0));
  assert.ok(declaredDeps.some((dep: any) =>
    dep.index === 0 && dep.param === RUN_CONCURRENCY_LIMITER_OPTIONS
  ));
});

test('run concurrency limiter queues callers beyond the active limit', async () => {
  const limiter = new RunConcurrencyLimiter({
    maxConcurrent: 1,
    maxQueue: 2,
    queueTimeoutMs: 1000,
  });

  const first = await limiter.acquire();
  let secondAcquired = false;
  const secondPromise = limiter.acquire().then((slot) => {
    secondAcquired = true;
    return slot;
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(secondAcquired, false);
  assert.deepEqual(limiter.getSnapshot(), { running: 1, queued: 1, concurrency: 1 });

  first.release();
  const second = await secondPromise;
  assert.equal(secondAcquired, true);
  assert.deepEqual(limiter.getSnapshot(), { running: 1, queued: 0, concurrency: 1 });

  second.release();
  assert.deepEqual(limiter.getSnapshot(), { running: 0, queued: 0, concurrency: 1 });
});

test('run concurrency limiter rejects when the queue is full', async () => {
  const limiter = new RunConcurrencyLimiter({
    maxConcurrent: 1,
    maxQueue: 1,
    queueTimeoutMs: 1000,
  });

  const first = await limiter.acquire();
  const queued = limiter.acquire();

  await assert.rejects(() => limiter.acquire(), /对话排队已满/);

  first.release();
  const queuedSlot = await queued;
  queuedSlot.release();
});
