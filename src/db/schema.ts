import Database from "better-sqlite3";
import { logger } from "../logger.js";

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      stream_url TEXT NOT NULL,
      stream_platform TEXT NOT NULL DEFAULT 'youtube',
      state TEXT NOT NULL DEFAULT 'created',
      -- state: created | validating | live | paused | stopped | error
      sharing_scope TEXT NOT NULL DEFAULT 'events_only',
      -- sharing_scope: events_only | events_and_frames | digests
      redaction_policy TEXT NOT NULL DEFAULT '{}',
      retention_mode TEXT NOT NULL DEFAULT 'short_lived',
      -- retention_mode: no_storage | short_lived | extended
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_bindings (
      binding_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '{}',
      -- permissions: JSON with events, frames_on_trigger, digests booleans
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS trio_jobs (
      job_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      job_type TEXT NOT NULL,
      -- job_type: live-monitor | live-digest
      condition TEXT,
      interval_seconds INTEGER NOT NULL DEFAULT 30,
      input_mode TEXT NOT NULL DEFAULT 'hybrid',
      clip_duration_seconds INTEGER,
      enable_prefilter INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'running',
      -- status: running | stopped | error | completed
      stop_reason TEXT,
      restart_count INTEGER NOT NULL DEFAULT 0,
      last_restart_at TEXT,
      last_restart_gap_ms INTEGER,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      stopped_at TEXT
    );

    CREATE TABLE IF NOT EXISTS perception_events (
      event_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      job_id TEXT REFERENCES trio_jobs(job_id),
      type TEXT NOT NULL,
      -- type: triggered | status | digest | heartbeat | restart
      explanation TEXT,
      frame_b64 TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_session ON trio_jobs(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_session ON perception_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_expires ON perception_events(expires_at);
    CREATE INDEX IF NOT EXISTS idx_bindings_session ON agent_bindings(session_id);
  `);

  logger.info({ dbPath }, "Database initialized");
  return db;
}

// --- Type-safe row interfaces ---

export interface SessionRow {
  session_id: string;
  stream_url: string;
  stream_platform: string;
  state: "created" | "validating" | "live" | "paused" | "stopped" | "error";
  sharing_scope: string;
  redaction_policy: string;
  retention_mode: string;
  created_at: string;
  updated_at: string;
}

export interface TrioJobRow {
  job_id: string;
  session_id: string;
  job_type: string;
  condition: string | null;
  interval_seconds: number;
  input_mode: string;
  clip_duration_seconds: number | null;
  enable_prefilter: number;
  status: string;
  stop_reason: string | null;
  restart_count: number;
  last_restart_at: string | null;
  last_restart_gap_ms: number | null;
  started_at: string;
  stopped_at: string | null;
}

export interface PerceptionEventRow {
  event_id: string;
  session_id: string;
  job_id: string | null;
  type: string;
  explanation: string | null;
  frame_b64: string | null;
  metadata: string;
  created_at: string;
  expires_at: string | null;
}

export interface AgentBindingRow {
  binding_id: string;
  session_id: string;
  agent_id: string;
  permissions: string;
  created_at: string;
  revoked_at: string | null;
}
