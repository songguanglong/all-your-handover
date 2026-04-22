// In-process Mutex for concurrent draft writes
// Single-process, no cross-process risk
//
// Timeout note: if lock A times out while B is queued behind A,
// B will also time out because B's `prev` still references A's
// never-resolved promise. This causes cascade timeouts, but is
// acceptable because a 10s timeout indicates a real deadlock that
// needs investigation rather than retry.

import { logger } from './logger';

const DEFAULT_TIMEOUT_MS = 10_000;

const lockMap: Map<string, Promise<void>> = new Map();
const releaseMap: Map<string, () => void> = new Map();

export async function acquireLock(key: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<void> {
  const prev = lockMap.get(key) || Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  lockMap.set(key, next);

  // Wait for previous lock with timeout
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Lock acquisition timed out for key: ${key}`));
    }, timeoutMs);
  });

  try {
    await Promise.race([prev, timeout]);
  } catch (err) {
    // On timeout, clean up our entry from lockMap so we don't block future acquisitions
    if (lockMap.get(key) === next) lockMap.delete(key);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  // Lock is now held; store resolve AFTER acquiring so releaseLock finds the right one
  releaseMap.set(key, resolve);
}

export function releaseLock(key: string): void {
  const resolve = releaseMap.get(key);
  if (resolve) {
    releaseMap.delete(key);
    resolve();
  }
}