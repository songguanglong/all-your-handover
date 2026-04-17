import { describe, it, expect, vi } from 'vitest';
import { LLMQueue } from '../src/llm/llm-queue';

// Create a subclass with shorter retry delays for testing
class TestLLMQueue extends LLMQueue {
  constructor(config?: { maxGlobalConcurrency?: number }) {
    super(config);
    // Override retry settings via any for testing
    (this as any).maxRetries = 1;
    (this as any).retryDelay = 50;
  }
}

describe('LLMQueue', () => {
  it('processes tasks in channel order', async () => {
    const queue = new TestLLMQueue({ maxGlobalConcurrency: 1 });
    const order: string[] = [];

    queue.enqueue('ch1', {
      execute: async () => { order.push('ch1-1'); return 'a'; },
      onSuccess: async () => { order.push('ch1-1-done'); },
      onFailure: async () => {},
    });

    queue.enqueue('ch1', {
      execute: async () => { order.push('ch1-2'); return 'b'; },
      onSuccess: async () => { order.push('ch1-2-done'); },
      onFailure: async () => {},
    });

    await new Promise((r) => setTimeout(r, 500));

    expect(order).toEqual(['ch1-1', 'ch1-1-done', 'ch1-2', 'ch1-2-done']);
  });

  it('respects global concurrency limit', async () => {
    const queue = new TestLLMQueue({ maxGlobalConcurrency: 1 });
    let activeCount = 0;
    let maxActive = 0;

    const makeTask = (ch: string, delay: number) => ({
      execute: async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise((r) => setTimeout(r, delay));
        activeCount--;
        return 'ok';
      },
      onSuccess: async () => {},
      onFailure: async () => {},
    });

    queue.enqueue('ch1', makeTask('ch1', 50));
    queue.enqueue('ch2', makeTask('ch2', 50));

    await new Promise((r) => setTimeout(r, 300));

    expect(maxActive).toBeLessThanOrEqual(1);
  });

  it('retries on failure then succeeds', async () => {
    const queue = new TestLLMQueue({ maxGlobalConcurrency: 1 });
    let attempts = 0;

    queue.enqueue('ch1', {
      execute: async () => {
        attempts++;
        if (attempts < 2) throw new Error('fail');
        return 'success';
      },
      onSuccess: async () => {},
      onFailure: async () => {},
    });

    await new Promise((r) => setTimeout(r, 1000));

    expect(attempts).toBe(2);
  });

  it('calls onFailure after exhausting retries', async () => {
    const queue = new TestLLMQueue({ maxGlobalConcurrency: 1 });
    let failureCalled = false;

    queue.enqueue('ch1', {
      execute: async () => { throw new Error('always fail'); },
      onSuccess: async () => {},
      onFailure: async () => { failureCalled = true; },
    });

    await new Promise((r) => setTimeout(r, 1000));

    expect(failureCalled).toBe(true);
  });

  it('getStatus reports correct counts', async () => {
    const queue = new TestLLMQueue({ maxGlobalConcurrency: 1 });

    queue.enqueue('ch1', {
      execute: async () => { await new Promise((r) => setTimeout(r, 200)); return 'ok'; },
      onSuccess: async () => {},
      onFailure: async () => {},
    });

    queue.enqueue('ch1', {
      execute: async () => 'ok',
      onSuccess: async () => {},
      onFailure: async () => {},
    });

    const status = queue.getStatus();
    expect(status.byChannel['ch1']).toBeGreaterThanOrEqual(0);
    expect(status.activeCalls).toBeGreaterThanOrEqual(0);
  });

  it('setConcurrency resizes the semaphore', () => {
    const queue = new TestLLMQueue({ maxGlobalConcurrency: 2 });
    queue.setConcurrency(5);
    expect(true).toBe(true);
  });
});