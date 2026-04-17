import { describe, it, expect } from 'vitest';
import { Semaphore } from '../src/llm/semaphore';

describe('Semaphore', () => {
  it('allows up to max concurrent acquires', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    expect(sem.active).toBe(2);
    sem.release();
    sem.release();
    expect(sem.active).toBe(0);
  });

  it('blocks when at capacity and resumes on release', async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    await sem.acquire();

    const p2 = (async () => {
      await sem.acquire();
      order.push(2);
      sem.release();
    })();

    order.push(1);
    sem.release();

    await p2;
    expect(order).toEqual([1, 2]);
  });

  it('resize increases capacity and unblocks waiters', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();
    expect(sem.active).toBe(1);

    let p2acquired = false;
    const p2 = (async () => {
      await sem.acquire();
      p2acquired = true;
    })();

    // Resize to 2 — should unblock p2
    sem.resize(2);

    await p2;
    expect(p2acquired).toBe(true);
  });

  it('resize decreases capacity', () => {
    const sem = new Semaphore(3);
    sem.resize(1);
    expect((sem as any).max).toBe(1);
  });
});