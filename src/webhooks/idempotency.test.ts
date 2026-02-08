import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { IdempotencyTracker } from "./idempotency.js";

describe("IdempotencyTracker", () => {
  let tracker: IdempotencyTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new IdempotencyTracker(5000); // 5s TTL for tests
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
  });

  it("returns false on first encounter (not a duplicate)", () => {
    expect(tracker.isDuplicate("key1")).toBe(false);
  });

  it("returns true on second encounter (is a duplicate)", () => {
    tracker.isDuplicate("key1");
    expect(tracker.isDuplicate("key1")).toBe(true);
  });

  it("tracks different keys independently", () => {
    tracker.isDuplicate("key1");
    expect(tracker.isDuplicate("key2")).toBe(false);
  });

  it("expires entries after TTL", () => {
    tracker.isDuplicate("key1");
    // Advance past TTL + cleanup interval (60s)
    vi.advanceTimersByTime(5001);
    // Trigger cleanup by advancing to cleanup interval
    vi.advanceTimersByTime(60_000);
    expect(tracker.isDuplicate("key1")).toBe(false);
  });

  it("preserves entries before TTL", () => {
    tracker.isDuplicate("key1");
    vi.advanceTimersByTime(3000);
    expect(tracker.isDuplicate("key1")).toBe(true);
  });

  it("destroy clears the cleanup interval", () => {
    const spy = vi.spyOn(globalThis, "clearInterval");
    tracker.destroy();
    expect(spy).toHaveBeenCalled();
  });
});

describe("IdempotencyTracker.keyFrom", () => {
  it("builds key from job_id, event, and timestamp", () => {
    const key = IdempotencyTracker.keyFrom("j1", "live_monitor_triggered", "2025-01-01T00:00:00Z");
    expect(key).toBe("j1:live_monitor_triggered:2025-01-01T00:00:00Z");
  });

  it("produces different keys for different inputs", () => {
    const k1 = IdempotencyTracker.keyFrom("j1", "event1", "t1");
    const k2 = IdempotencyTracker.keyFrom("j1", "event2", "t1");
    expect(k1).not.toBe(k2);
  });
});
