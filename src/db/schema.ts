import Database from "better-sqlite3";
import { logger } from "../logger.js";

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      description TEXT NOT NULL,
      title TEXT DEFAULT '',
      payout_cents INTEGER DEFAULT 0,
      webhook_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      -- status: pending | awaiting_stream | streaming | verifying | completed | failed | expired | cancelled
      stream_url TEXT,
      human_id TEXT,
      verification_hash TEXT,
      redaction_policy TEXT NOT NULL DEFAULT '{}',
      max_duration_seconds INTEGER NOT NULL DEFAULT 3600,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      expires_at TEXT,
      tx_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      checkpoint_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      -- type: location | object | document | person | action | duration | text
      target TEXT NOT NULL,
      description TEXT,
      confidence_threshold REAL NOT NULL DEFAULT 0.8,
      required INTEGER NOT NULL DEFAULT 1,
      ordering INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT,
      evidence_frame_b64 TEXT,
      evidence_explanation TEXT,
      confidence REAL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      evidence_zg_root TEXT
    );

    CREATE TABLE IF NOT EXISTS trio_jobs (
      job_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
      job_type TEXT NOT NULL DEFAULT 'live-monitor',
      condition TEXT,
      interval_seconds INTEGER NOT NULL DEFAULT 15,
      input_mode TEXT NOT NULL DEFAULT 'frames',
      enable_prefilter INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'running',
      stop_reason TEXT,
      restart_count INTEGER NOT NULL DEFAULT 0,
      last_restart_at TEXT,
      last_restart_gap_ms INTEGER,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      stopped_at TEXT
    );

    CREATE TABLE IF NOT EXISTS verification_events (
      event_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
      job_id TEXT REFERENCES trio_jobs(job_id),
      checkpoint_id TEXT REFERENCES checkpoints(checkpoint_id),
      event_type TEXT NOT NULL,
      confidence REAL,
      explanation TEXT,
      evidence_frame_b64 TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      evidence_zg_root TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_keys (
      key_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_checkpoints_task ON checkpoints(task_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_task ON trio_jobs(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_task ON verification_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_expires ON verification_events(expires_at);
    CREATE INDEX IF NOT EXISTS idx_agent_keys_agent ON agent_keys(agent_id);
  `);

  // Migrations for existing databases
  const migrations = [
    "ALTER TABLE tasks ADD COLUMN tx_hash TEXT",
    "ALTER TABLE checkpoints ADD COLUMN evidence_zg_root TEXT",
    "ALTER TABLE verification_events ADD COLUMN evidence_zg_root TEXT",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  logger.info({ dbPath }, "Database initialized");
  return db;
}

// --- Type-safe row interfaces ---

export interface TaskRow {
  task_id: string;
  agent_id: string;
  description: string;
  title: string;
  payout_cents: number;
  webhook_url: string;
  status: string;
  stream_url: string | null;
  human_id: string | null;
  verification_hash: string | null;
  redaction_policy: string;
  max_duration_seconds: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  tx_hash: string | null;
}

export interface CheckpointRow {
  checkpoint_id: string;
  task_id: string;
  type: string;
  target: string;
  description: string | null;
  confidence_threshold: number;
  required: number;
  ordering: number;
  verified: number;
  verified_at: string | null;
  evidence_frame_b64: string | null;
  evidence_explanation: string | null;
  confidence: number | null;
  metadata: string;
  created_at: string;
  evidence_zg_root: string | null;
}

export interface TrioJobRow {
  job_id: string;
  task_id: string;
  job_type: string;
  condition: string | null;
  interval_seconds: number;
  input_mode: string;
  enable_prefilter: number;
  status: string;
  stop_reason: string | null;
  restart_count: number;
  last_restart_at: string | null;
  last_restart_gap_ms: number | null;
  started_at: string;
  stopped_at: string | null;
}

export interface VerificationEventRow {
  event_id: string;
  task_id: string;
  job_id: string | null;
  checkpoint_id: string | null;
  event_type: string;
  confidence: number | null;
  explanation: string | null;
  evidence_frame_b64: string | null;
  metadata: string;
  created_at: string;
  expires_at: string | null;
  evidence_zg_root: string | null;
}

export interface AgentKeyRow {
  key_id: string;
  agent_id: string;
  key_hash: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
}
