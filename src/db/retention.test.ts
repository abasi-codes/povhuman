import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../test-helpers.js";
import { startRetentionWorker } from "./retention.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("startRetentionWorker", () => {
  let db: Database.Database;

  beforeEach(() => {
    vi.useFakeTimers();
    db = createTestDb();
    // Insert a session for FK
    db.prepare(
      "INSERT INTO sessions (session_id, stream_url, state) VALUES (?, ?, ?)"
    ).run("s1", "https://youtube.com/watch?v=abc", "live");
  });

  afterEach(() => {
    db.close();
    vi.useRealTimers();
  });

  it("deletes events with expired expires_at", () => {
    // Insert an already-expired event
    db.prepare(
      "INSERT INTO perception_events (event_id, session_id, type, expires_at) VALUES (?, ?, ?, datetime('now', '-1 hour'))"
    ).run("e1", "s1", "triggered");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const rows = db.prepare("SELECT * FROM perception_events WHERE event_id = ?").all("e1");
    expect(rows).toHaveLength(0);
  });

  it("preserves events with future expires_at", () => {
    db.prepare(
      "INSERT INTO perception_events (event_id, session_id, type, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))"
    ).run("e2", "s1", "triggered");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const rows = db.prepare("SELECT * FROM perception_events WHERE event_id = ?").all("e2");
    expect(rows).toHaveLength(1);
  });

  it("clears frame_b64 older than 15 minutes", () => {
    db.prepare(
      "INSERT INTO perception_events (event_id, session_id, type, frame_b64, created_at) VALUES (?, ?, ?, ?, datetime('now', '-20 minutes'))"
    ).run("e3", "s1", "triggered", "oldframe");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const row = db.prepare("SELECT frame_b64 FROM perception_events WHERE event_id = ?").get("e3") as { frame_b64: string | null };
    expect(row.frame_b64).toBeNull();
  });

  it("keeps frame_b64 for recent events", () => {
    db.prepare(
      "INSERT INTO perception_events (event_id, session_id, type, frame_b64) VALUES (?, ?, ?, ?)"
    ).run("e4", "s1", "triggered", "recentframe");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const row = db.prepare("SELECT frame_b64 FROM perception_events WHERE event_id = ?").get("e4") as { frame_b64: string | null };
    expect(row.frame_b64).toBe("recentframe");
  });

  it("preserves events without expires_at", () => {
    db.prepare(
      "INSERT INTO perception_events (event_id, session_id, type) VALUES (?, ?, ?)"
    ).run("e5", "s1", "triggered");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const rows = db.prepare("SELECT * FROM perception_events WHERE event_id = ?").all("e5");
    expect(rows).toHaveLength(1);
  });

  it("logs error and continues when DB throws", () => {
    const interval = startRetentionWorker(db, 1000);
    // Close DB to force an error on next tick
    db.close();
    // Should not throw — error is caught and logged
    expect(() => vi.advanceTimersByTime(1001)).not.toThrow();
    clearInterval(interval);
  });
});
