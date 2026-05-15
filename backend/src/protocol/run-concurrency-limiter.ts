import { Inject, Injectable, Optional } from '@nestjs/common';

export const RUN_CONCURRENCY_LIMITER_OPTIONS = 'RUN_CONCURRENCY_LIMITER_OPTIONS';

export interface RunConcurrencyLimiterOptions {
  maxConcurrent?: number;
  maxQueue?: number;
  queueTimeoutMs?: number;
}

export interface RunConcurrencySnapshot {
  running: number;
  queued: number;
  concurrency: number;
}

export interface RunSlot {
  queuedMs: number;
  release: () => void;
}

interface PendingRun {
  enqueuedAt: number;
  resolve: (slot: RunSlot) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class RunQueueRejectedError extends Error {
  constructor(message: string, readonly snapshot: RunConcurrencySnapshot) {
    super(message);
    this.name = 'RunQueueRejectedError';
  }
}

@Injectable()
export class RunConcurrencyLimiter {
  private readonly maxConcurrent: number;
  private readonly maxQueue: number;
  private readonly queueTimeoutMs: number;
  private readonly queue: PendingRun[] = [];
  private running = 0;

  constructor(
    @Optional()
    @Inject(RUN_CONCURRENCY_LIMITER_OPTIONS)
    options: RunConcurrencyLimiterOptions = {},
  ) {
    this.maxConcurrent = positiveInteger(options?.maxConcurrent ?? process.env.CHAT_RUN_CONCURRENCY_LIMIT, 80);
    this.maxQueue = positiveInteger(options?.maxQueue ?? process.env.CHAT_RUN_QUEUE_LIMIT, 500);
    this.queueTimeoutMs = positiveInteger(options?.queueTimeoutMs ?? process.env.CHAT_RUN_QUEUE_TIMEOUT_MS, 90000);
  }

  async acquire(onQueued?: (snapshot: RunConcurrencySnapshot) => void): Promise<RunSlot> {
    if (this.running < this.maxConcurrent) {
      this.running += 1;
      return this.createSlot(0);
    }

    if (this.queue.length >= this.maxQueue) {
      throw new RunQueueRejectedError('对话排队已满，请稍后重试', this.getSnapshot());
    }

    return new Promise<RunSlot>((resolve, reject) => {
      const pending: PendingRun = {
        enqueuedAt: Date.now(),
        resolve,
        reject,
        timer: setTimeout(() => {
          this.removePending(pending);
          reject(new RunQueueRejectedError('对话排队等待超时，请稍后重试', this.getSnapshot()));
        }, this.queueTimeoutMs),
      };
      if (typeof pending.timer.unref === 'function') pending.timer.unref();
      this.queue.push(pending);
      onQueued?.(this.getSnapshot());
    });
  }

  getSnapshot(): RunConcurrencySnapshot {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.maxConcurrent,
    };
  }

  private createSlot(queuedMs: number): RunSlot {
    let released = false;
    return {
      queuedMs,
      release: () => {
        if (released) return;
        released = true;
        this.running = Math.max(0, this.running - 1);
        this.drain();
      },
    };
  }

  private drain() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const pending = this.queue.shift();
      if (!pending) return;
      clearTimeout(pending.timer);
      this.running += 1;
      pending.resolve(this.createSlot(Date.now() - pending.enqueuedAt));
    }
  }

  private removePending(target: PendingRun) {
    const index = this.queue.indexOf(target);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
  }
}

function positiveInteger(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
