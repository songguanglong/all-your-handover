// Simple semaphore for controlling concurrent LLM calls

export class Semaphore {
  private waiting: (() => void)[] = [];

  constructor(private max: number, public active = 0) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    }
  }

  resize(n: number): void {
    const diff = n - this.max;
    this.max = n;
    for (let i = 0; i < diff && this.waiting.length > 0; i++) {
      this.active++;
      this.waiting.shift()!();
    }
  }
}