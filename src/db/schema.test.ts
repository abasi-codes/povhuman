import { describe, it, expect } from "vitest";
import { createTestDb } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("initDatabase", () => {
  it("creates all 5 tables", () => {
    const db = createTestDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("tasks");
    expect(names).toContain("checkpoints");
    expect(names).toContain("trio_jobs");
    expect(names).toContain("verification_events");
    expect(names).toContain("agent_keys");
    db.close();
  });

  it("sets WAL journal mode (memory DBs report 'memory')", () => {
    const db = createTestDb();
    const rows = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    expect(rows[0].journal_mode).toBe("memory");
    db.close();
  });

  it("enables foreign keys", () => {
    const db = createTestDb();
    const [row] = db.pragma("foreign_keys") as Array<{ foreign_keys: number }>;
    expect(row.foreign_keys).toBe(1);
    db.close();
  });

  it("creates expected indexes", () => {
    const db = createTestDb();
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_checkpoints_task");
    expect(names).toContain("idx_jobs_task");
    expect(names).toContain("idx_events_task");
    expect(names).toContain("idx_events_expires");
    expect(names).toContain("idx_agent_keys_agent");
    db.close();
  });

  it("enforces foreign keys on checkpoints", () => {
    const db = createTestDb();
    expect(() => {
      db.prepare(
        "INSERT INTO checkpoints (checkpoint_id, task_id, type, target) VALUES (?, ?, ?, ?)",
      ).run("cp-1", "nonexistent", "location", "test");
    }).toThrow();
    db.close();
  });

  it("cascades deletes from tasks to checkpoints", () => {
    const db = createTestDb();
    db.prepare(
      "INSERT INTO tasks (task_id, agent_id, description, webhook_url) VALUES (?, ?, ?, ?)",
    ).run("t-1", "agent-1", "Test task", "https://example.com/hook");
    db.prepare(
      "INSERT INTO checkpoints (checkpoint_id, task_id, type, target) VALUES (?, ?, ?, ?)",
    ).run("cp-1", "t-1", "location", "office");

    db.prepare("DELETE FROM tasks WHERE task_id = ?").run("t-1");

    const remaining = db.prepare("SELECT * FROM checkpoints WHERE task_id = ?").all("t-1");
    expect(remaining).toHaveLength(0);
    db.close();
  });

  it("tasks table has expected columns", () => {
    const db = createTestDb();
    const cols = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("task_id");
    expect(names).toContain("agent_id");
    expect(names).toContain("description");
    expect(names).toContain("webhook_url");
    expect(names).toContain("status");
    expect(names).toContain("stream_url");
    expect(names).toContain("human_id");
    expect(names).toContain("verification_hash");
    expect(names).toContain("max_duration_seconds");
    db.close();
  });

  it("inserts a task with defaults", () => {
    const db = createTestDb();
    db.prepare(
      "INSERT INTO tasks (task_id, agent_id, description, webhook_url) VALUES (?, ?, ?, ?)",
    ).run("t-2", "agent-1", "Test", "https://example.com/hook");

    const row = db.prepare("SELECT * FROM tasks WHERE task_id = ?").get("t-2") as Record<string, unknown>;
    expect(row.status).toBe("pending");
    expect(row.max_duration_seconds).toBe(3600);
    expect(row.redaction_policy).toBe("{}");
    db.close();
  });

  it("inserts verification events with checkpoint reference", () => {
    const db = createTestDb();
    db.prepare(
      "INSERT INTO tasks (task_id, agent_id, description, webhook_url) VALUES (?, ?, ?, ?)",
    ).run("t-3", "agent-1", "Test", "https://example.com/hook");
    db.prepare(
      "INSERT INTO checkpoints (checkpoint_id, task_id, type, target) VALUES (?, ?, ?, ?)",
    ).run("cp-3", "t-3", "object", "package");
    db.prepare(
      "INSERT INTO verification_events (event_id, task_id, checkpoint_id, event_type) VALUES (?, ?, ?, ?)",
    ).run("ev-1", "t-3", "cp-3", "checkpoint_verified");

    const row = db.prepare("SELECT * FROM verification_events WHERE event_id = ?").get("ev-1") as Record<string, unknown>;
    expect(row.event_type).toBe("checkpoint_verified");
    expect(row.checkpoint_id).toBe("cp-3");
    db.close();
  });

  it("inserts agent keys", () => {
    const db = createTestDb();
    db.prepare(
      "INSERT INTO agent_keys (key_id, agent_id, key_hash, label) VALUES (?, ?, ?, ?)",
    ).run("k-1", "agent-1", "abc123hash", "test key");

    const row = db.prepare("SELECT * FROM agent_keys WHERE key_id = ?").get("k-1") as Record<string, unknown>;
    expect(row.agent_id).toBe("agent-1");
    expect(row.label).toBe("test key");
    expect(row.revoked_at).toBeNull();
    db.close();
  });
});
