/**
 * In-memory idempotency tracker for webhook deduplication.
 * Trio uses at-least-once delivery, so duplicates are expected.
 *
 * Uses a combination of job_id + event type + timestamp as the key.
 * Entries expire after TTL to prevent unbounded memory growth.
 */
export class IdempotencyTracker {
  private seen = new Map<string, number>();
  private ttlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(ttlMs = 300_000 /* 5 minutes */) {
    this.ttlMs = ttlMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /** Returns true if this event was already processed (is a duplicate). */
  isDuplicate(key: string): boolean {
    if (this.seen.has(key)) return true;
    this.seen.set(key, Date.now());
    return false;
  }

  /** Build a dedup key from webhook payload fields. */
  static keyFrom(jobId: string, event: string, timestamp: string): string {
    return `${jobId}:${event}:${timestamp}`;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(key);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
