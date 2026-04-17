// In-process Mutex for concurrent draft writes
// Single-process, no cross-process risk

const lockMap: Map<string, Promise<void>> = new Map();

export async function acquireLock(key: string): Promise<void> {
  const prev = lockMap.get(key) || Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  lockMap.set(key, next);
  await prev;
  // Lock is now held; caller must call releaseLock(key) when done
  // We store the resolve so releaseLock can call it
  releaseMap.set(key, resolve);
}

const releaseMap: Map<string, () => void> = new Map();

export function releaseLock(key: string): void {
  const resolve = releaseMap.get(key);
  if (resolve) {
    releaseMap.delete(key);
    resolve();
  }
}