import { describe, it, expect, vi } from 'vitest';
import { acquireLock, releaseLock } from '../src/utils/file-lock';

describe('file-lock', () => {
  it('acquires and releases a lock', async () => {
    await acquireLock('test-key');
    releaseLock('test-key');
    // If we got here without hanging, it works
    expect(true).toBe(true);
  });

  it('serializes concurrent access', async () => {
    const order: number[] = [];

    async function worker(id: number, delayMs: number) {
      await acquireLock('shared');
      order.push(id);
      await new Promise((r) => setTimeout(r, delayMs));
      order.push(id + 100);
      releaseLock('shared');
    }

    // Start both workers concurrently; worker 1 should finish before worker 2 starts
    const p1 = worker(1, 50);
    const p2 = worker(2, 10);

    await p1;
    await p2;

    // Worker 1 should acquire first, release before worker 2 acquires
    expect(order).toEqual([1, 101, 2, 102]);
  });

  it('handles different keys independently', async () => {
    let aDone = false;
    let bDone = false;

    await acquireLock('a');
    await acquireLock('b');

    // Both locks should be acquired without waiting
    aDone = true;
    bDone = true;

    releaseLock('a');
    releaseLock('b');

    expect(aDone && bDone).toBe(true);
  });
});