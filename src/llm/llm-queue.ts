import type { LLMTask } from '../types';
import { Semaphore } from './semaphore';
import { logger } from '../utils/logger';

interface QueueItem {
  task: LLMTask;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class LLMQueue {
  private channelQueues: Map<string, QueueItem[]> = new Map();
  private channelProcessing: Map<string, boolean> = new Map();
  private globalSemaphore: Semaphore;
  private maxRetries = 2;
  private retryDelay = 2000;

  constructor(config?: { maxGlobalConcurrency?: number }) {
    const max = config?.maxGlobalConcurrency ?? 3;
    this.globalSemaphore = new Semaphore(max);
  }

  enqueue(channelCode: string, task: LLMTask): void {
    if (!this.channelQueues.has(channelCode)) {
      this.channelQueues.set(channelCode, []);
    }
    this.channelQueues.get(channelCode)!.push({ task });
    this.drainChannel(channelCode);
  }

  private async drainChannel(channelCode: string): Promise<void> {
    if (this.channelProcessing.get(channelCode)) return;
    this.channelProcessing.set(channelCode, true);

    try {
      while (true) {
        const queue = this.channelQueues.get(channelCode);
        if (!queue || queue.length === 0) break;

        // Shift the item from the queue BEFORE processing
        const item = queue.shift()!;

        try {
          await this.globalSemaphore.acquire();
          try {
            const result = await this.callWithRetry(item.task);
            await item.task.onSuccess(result);
          } finally {
            this.globalSemaphore.release();
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          await item.task.onFailure(error);
        }
      }
    } finally {
      this.channelProcessing.set(channelCode, false);
    }
  }

  private async callWithRetry(task: LLMTask): Promise<unknown> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await task.execute();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          await sleep(this.retryDelay * (attempt + 1));
        }
      }
    }
    throw lastError ?? new Error('Unreachable');
  }

  setConcurrency(n: number): void {
    this.globalSemaphore.resize(n);
  }

  getStatus(): { totalPending: number; activeCalls: number; byChannel: Record<string, number> } {
    let totalPending = 0;
    const byChannel: Record<string, number> = {};
    for (const [code, items] of this.channelQueues) {
      byChannel[code] = items.length;
      totalPending += items.length;
    }
    return { totalPending, activeCalls: this.globalSemaphore.active, byChannel };
  }
}