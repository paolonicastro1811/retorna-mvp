// ============================================================
// Simple concurrency limiter for API calls
// Prevents hammering the Anthropic API under load.
// ============================================================

export class RateLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(
    private maxConcurrent: number = 3,
    private minDelayMs: number = 200
  ) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    // Wait in queue
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    // Enforce minimum delay between calls
    setTimeout(() => {
      this.running--;
      const next = this.queue.shift();
      if (next) {
        this.running++;
        next();
      }
    }, this.minDelayMs);
  }

  async wrap<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get stats() {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

// Singleton: max 3 concurrent Anthropic calls, 200ms between releases
export const anthropicLimiter = new RateLimiter(3, 200);
