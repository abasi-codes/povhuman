import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QuotaTracker } from "./quota.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("QuotaTracker", () => {
  let tracker: QuotaTracker;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2025-06-15T12:00:00-07:00") }); // noon Pacific
    tracker = new QuotaTracker(100);
  });

  afterEach(() => vi.useRealTimers());

  it("starts with full remaining quota", () => {
    expect(tracker.remaining()).toBe(100);
  });

  it("use() decrements remaining", () => {
    tracker.use(10);
    expect(tracker.remaining()).toBe(90);
  });

  it("use() returns true when within budget", () => {
    expect(tracker.use(50)).toBe(true);
  });

  it("use() returns false when over budget", () => {
    tracker.use(90);
    expect(tracker.use(20)).toBe(false);
    expect(tracker.remaining()).toBe(10); // should not have decremented
  });

  it("canAfford checks without recording", () => {
    tracker.use(90);
    expect(tracker.canAfford(10)).toBe(true);
    expect(tracker.canAfford(11)).toBe(false);
    expect(tracker.remaining()).toBe(10); // unchanged
  });

  it("resets after midnight Pacific rollover", () => {
    tracker.use(80);
    expect(tracker.remaining()).toBe(20);
    // Advance to next day (jump 24 hours)
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(tracker.remaining()).toBe(100);
  });

  it("does not reset on the same day", () => {
    tracker.use(50);
    vi.advanceTimersByTime(6 * 60 * 60 * 1000); // 6 hours later, same day
    expect(tracker.remaining()).toBe(50);
  });

  it("defaults to 10,000 daily limit", () => {
    vi.useRealTimers(); // use real timers for this one
    const defaultTracker = new QuotaTracker();
    expect(defaultTracker.remaining()).toBe(10_000);
  });

  it("use() at exact limit succeeds", () => {
    expect(tracker.use(100)).toBe(true);
    expect(tracker.remaining()).toBe(0);
    expect(tracker.use(1)).toBe(false);
  });
});
