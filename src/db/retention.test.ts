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
    // Insert a task for FK
    db.prepare(
      "INSERT INTO tasks (task_id, agent_id, description, webhook_url) VALUES (?, ?, ?, ?)"
    ).run("t1", "agent-1", "Test", "https://example.com/hook");
  });

  afterEach(() => {
    db.close();
    vi.useRealTimers();
  });

  it("deletes events with expired expires_at", () => {
    db.prepare(
      "INSERT INTO verification_events (event_id, task_id, event_type, expires_at) VALUES (?, ?, ?, datetime('now', '-1 hour'))"
    ).run("e1", "t1", "checkpoint_verified");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const rows = db.prepare("SELECT * FROM verification_events WHERE event_id = ?").all("e1");
    expect(rows).toHaveLength(0);
  });

  it("preserves events with future expires_at", () => {
    db.prepare(
      "INSERT INTO verification_events (event_id, task_id, event_type, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))"
    ).run("e2", "t1", "checkpoint_verified");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const rows = db.prepare("SELECT * FROM verification_events WHERE event_id = ?").all("e2");
    expect(rows).toHaveLength(1);
  });

  it("clears evidence_frame_b64 older than 60 minutes", () => {
    db.prepare(
      "INSERT INTO verification_events (event_id, task_id, event_type, evidence_frame_b64, created_at) VALUES (?, ?, ?, ?, datetime('now', '-65 minutes'))"
    ).run("e3", "t1", "checkpoint_verified", "oldframe");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const row = db.prepare("SELECT evidence_frame_b64 FROM verification_events WHERE event_id = ?").get("e3") as { evidence_frame_b64: string | null };
    expect(row.evidence_frame_b64).toBeNull();
  });

  it("keeps evidence_frame_b64 for recent events", () => {
    db.prepare(
      "INSERT INTO verification_events (event_id, task_id, event_type, evidence_frame_b64) VALUES (?, ?, ?, ?)"
    ).run("e4", "t1", "checkpoint_verified", "recentframe");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const row = db.prepare("SELECT evidence_frame_b64 FROM verification_events WHERE event_id = ?").get("e4") as { evidence_frame_b64: string | null };
    expect(row.evidence_frame_b64).toBe("recentframe");
  });

  it("preserves events without expires_at", () => {
    db.prepare(
      "INSERT INTO verification_events (event_id, task_id, event_type) VALUES (?, ?, ?)"
    ).run("e5", "t1", "checkpoint_verified");

    const interval = startRetentionWorker(db, 1000);
    vi.advanceTimersByTime(1001);
    clearInterval(interval);

    const rows = db.prepare("SELECT * FROM verification_events WHERE event_id = ?").all("e5");
    expect(rows).toHaveLength(1);
  });

  it("logs error and continues when DB throws", () => {
    const interval = startRetentionWorker(db, 1000);
    db.close();
    expect(() => vi.advanceTimersByTime(1001)).not.toThrow();
    clearInterval(interval);
  });
});
