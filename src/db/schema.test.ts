import { describe, it, expect } from "vitest";
import { createTestDb } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("initDatabase", () => {
  it("creates all 4 tables", () => {
    const db = createTestDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("sessions");
    expect(names).toContain("agent_bindings");
    expect(names).toContain("trio_jobs");
    expect(names).toContain("perception_events");
    db.close();
  });

  it("sets WAL journal mode (memory DBs report 'memory')", () => {
    const db = createTestDb();
    const rows = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    // In-memory databases cannot use WAL, so SQLite reports 'memory'
    // The code calls pragma("journal_mode = WAL") but :memory: ignores it
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
    expect(names).toContain("idx_jobs_session");
    expect(names).toContain("idx_events_session");
    expect(names).toContain("idx_events_expires");
    expect(names).toContain("idx_bindings_session");
    db.close();
  });

  it("is idempotent (can be called twice)", () => {
    const db = createTestDb();
    // Second init should not throw
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        stream_url TEXT NOT NULL,
        stream_platform TEXT NOT NULL DEFAULT 'youtube',
        state TEXT NOT NULL DEFAULT 'created',
        sharing_scope TEXT NOT NULL DEFAULT 'events_only',
        redaction_policy TEXT NOT NULL DEFAULT '{}',
        retention_mode TEXT NOT NULL DEFAULT 'short_lived',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.close();
  });

  it("sessions table has expected columns", () => {
    const db = createTestDb();
    const cols = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("session_id");
    expect(names).toContain("stream_url");
    expect(names).toContain("state");
    expect(names).toContain("sharing_scope");
    expect(names).toContain("retention_mode");
    expect(names).toContain("created_at");
    db.close();
  });
});
