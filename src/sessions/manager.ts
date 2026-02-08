import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { logger } from "../logger.js";
import { TrioClient } from "../trio/client.js";
import type { SessionConfig, SessionState } from "./types.js";
import { DEFAULT_REDACTION_POLICY } from "./types.js";
import { combineConditions } from "../conditions/combiner.js";
import type { SessionRow, TrioJobRow } from "../db/schema.js";
import type { InputMode } from "../trio/types.js";

export class SessionManager {
  private db: Database.Database;
  private trio: TrioClient;
  private webhookBaseUrl: string;

  // Prepared statements
  private stmts: ReturnType<typeof this.prepareStatements>;

  constructor(
    db: Database.Database,
    trio: TrioClient,
    webhookBaseUrl: string,
  ) {
    this.db = db;
    this.trio = trio;
    this.webhookBaseUrl = webhookBaseUrl;
    this.stmts = this.prepareStatements();
  }

  private prepareStatements() {
    return {
      insertSession: this.db.prepare(`
        INSERT INTO sessions (session_id, stream_url, stream_platform, state, sharing_scope, redaction_policy, retention_mode)
        VALUES (?, ?, 'youtube', ?, ?, ?, ?)
      `),
      updateSessionState: this.db.prepare(`
        UPDATE sessions SET state = ?, updated_at = datetime('now') WHERE session_id = ?
      `),
      getSession: this.db.prepare(`
        SELECT * FROM sessions WHERE session_id = ?
      `),
      listActiveSessions: this.db.prepare(`
        SELECT * FROM sessions WHERE state IN ('live', 'paused', 'validating')
      `),
      insertJob: this.db.prepare(`
        INSERT INTO trio_jobs (job_id, session_id, job_type, condition, interval_seconds, input_mode, clip_duration_seconds, enable_prefilter)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateJobStatus: this.db.prepare(`
        UPDATE trio_jobs SET status = ?, stop_reason = ?, stopped_at = datetime('now') WHERE job_id = ?
      `),
      updateJobRestart: this.db.prepare(`
        UPDATE trio_jobs
        SET job_id = ?, status = 'running', restart_count = restart_count + 1,
            last_restart_at = datetime('now'), last_restart_gap_ms = ?, stopped_at = NULL
        WHERE job_id = ?
      `),
      getJobsBySession: this.db.prepare(`
        SELECT * FROM trio_jobs WHERE session_id = ? AND status = 'running'
      `),
      getJob: this.db.prepare(`
        SELECT * FROM trio_jobs WHERE job_id = ?
      `),
      getAllRunningJobs: this.db.prepare(`
        SELECT * FROM trio_jobs WHERE status = 'running'
      `),
      insertBinding: this.db.prepare(`
        INSERT INTO agent_bindings (binding_id, session_id, agent_id, permissions)
        VALUES (?, ?, ?, ?)
      `),
      revokeBinding: this.db.prepare(`
        UPDATE agent_bindings SET revoked_at = datetime('now') WHERE session_id = ? AND revoked_at IS NULL
      `),
      insertEvent: this.db.prepare(`
        INSERT INTO perception_events (event_id, session_id, job_id, type, explanation, frame_b64, metadata, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getActiveBindings: this.db.prepare(`
        SELECT * FROM agent_bindings WHERE session_id = ? AND revoked_at IS NULL
      `),
      countRunningJobs: this.db.prepare(`
        SELECT COUNT(*) as count FROM trio_jobs WHERE status = 'running'
      `),
    };
  }

  async createSession(config: SessionConfig): Promise<string> {
    const sessionId = nanoid(12);

    this.stmts.insertSession.run(
      sessionId,
      config.stream_url,
      "created",
      config.sharing_scope,
      JSON.stringify(config.redaction_policy ?? DEFAULT_REDACTION_POLICY),
      config.retention_mode,
    );

    // Bind agents
    for (const agentId of config.agent_ids) {
      this.stmts.insertBinding.run(
        nanoid(12),
        sessionId,
        agentId,
        JSON.stringify({ events: true, frames_on_trigger: config.sharing_scope === "events_and_frames", digests: config.sharing_scope === "digests" }),
      );
    }

    logger.info({ sessionId }, "Session created");
    return sessionId;
  }

  async startSession(sessionId: string): Promise<void> {
    const session = this.stmts.getSession.get(sessionId) as SessionRow | undefined;
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.state === "live") return; // already running

    // Check concurrent job limit
    const { count } = this.stmts.countRunningJobs.get() as { count: number };
    if (count >= 10) {
      throw new Error("Maximum 10 concurrent jobs reached. Stop a session or combine conditions.");
    }

    this.stmts.updateSessionState.run("validating", sessionId);

    // Validate URL with Trio
    const validation = await this.trio.validateUrl(session.stream_url);
    if (!validation.valid || !validation.is_live) {
      this.stmts.updateSessionState.run("error", sessionId);
      throw new Error(`Stream not live: ${validation.error || "Stream is offline"}`);
    }

    this.stmts.updateSessionState.run("live", sessionId);
    logger.info({ sessionId }, "Session started");
  }

  async startMonitoringJob(
    sessionId: string,
    conditions: string[],
    opts: {
      interval_seconds?: number;
      input_mode?: InputMode;
      enable_prefilter?: boolean;
    } = {},
  ): Promise<string> {
    // Combine multiple conditions into a single prompt to conserve jobs
    const combinedCondition = combineConditions(conditions);

    const result = await this.trio.startLiveMonitor({
      url: this.getStreamUrl(sessionId),
      condition: combinedCondition,
      webhook_url: `${this.webhookBaseUrl}/webhooks/trio`,
      interval_seconds: opts.interval_seconds ?? 30,
      input_mode: opts.input_mode ?? "hybrid",
      enable_prefilter: opts.enable_prefilter ?? true,
    });

    this.stmts.insertJob.run(
      result.job_id,
      sessionId,
      "live-monitor",
      combinedCondition,
      opts.interval_seconds ?? 30,
      opts.input_mode ?? "hybrid",
      null,
      opts.enable_prefilter ?? true ? 1 : 0,
    );

    logger.info({ sessionId, jobId: result.job_id }, "Monitor job started");
    return result.job_id;
  }

  /**
   * Auto-restart a job that hit the 10-minute cap.
   * Target: <2 second gap between old job stopping and new job starting.
   */
  async restartJob(oldJobId: string): Promise<string | null> {
    const job = this.stmts.getJob.get(oldJobId) as TrioJobRow | undefined;
    if (!job) return null;

    const session = this.stmts.getSession.get(job.session_id) as SessionRow | undefined;
    if (!session || session.state !== "live") return null;

    const restartStart = Date.now();

    try {
      const result = await this.trio.startLiveMonitor({
        url: session.stream_url,
        condition: job.condition || "",
        webhook_url: `${this.webhookBaseUrl}/webhooks/trio`,
        interval_seconds: job.interval_seconds,
        input_mode: job.input_mode as InputMode,
        enable_prefilter: job.enable_prefilter === 1,
      });

      const gapMs = Date.now() - restartStart;

      // Update the old job row to point to the new job ID
      this.stmts.updateJobRestart.run(result.job_id, gapMs, oldJobId);

      // Record a restart event
      this.stmts.insertEvent.run(
        nanoid(12),
        job.session_id,
        result.job_id,
        "restart",
        `Job restarted (gap: ${gapMs}ms, restart #${job.restart_count + 1})`,
        null,
        JSON.stringify({ old_job_id: oldJobId, gap_ms: gapMs }),
        null,
      );

      logger.info(
        { oldJobId, newJobId: result.job_id, gapMs },
        "Job restarted",
      );
      return result.job_id;
    } catch (err) {
      logger.error({ err, oldJobId }, "Job restart failed");
      this.stmts.updateJobStatus.run("error", "restart_failed", oldJobId);
      return null;
    }
  }

  async pauseSession(sessionId: string): Promise<void> {
    const jobs = this.stmts.getJobsBySession.all(sessionId) as TrioJobRow[];
    for (const job of jobs) {
      try {
        await this.trio.cancelJob(job.job_id);
        this.stmts.updateJobStatus.run("stopped", "paused", job.job_id);
      } catch (err) {
        logger.warn({ err, jobId: job.job_id }, "Failed to cancel job on pause");
      }
    }
    this.stmts.updateSessionState.run("paused", sessionId);
    logger.info({ sessionId }, "Session paused");
  }

  async stopSession(sessionId: string): Promise<void> {
    const jobs = this.stmts.getJobsBySession.all(sessionId) as TrioJobRow[];
    for (const job of jobs) {
      try {
        await this.trio.cancelJob(job.job_id);
        this.stmts.updateJobStatus.run("stopped", "cancelled", job.job_id);
      } catch (err) {
        logger.warn({ err, jobId: job.job_id }, "Failed to cancel job on stop");
      }
    }
    this.stmts.revokeBinding.run(sessionId);
    this.stmts.updateSessionState.run("stopped", sessionId);
    logger.info({ sessionId }, "Session stopped");
  }

  recordEvent(
    sessionId: string,
    jobId: string | null,
    type: string,
    explanation: string | null,
    frameB64: string | null,
    metadata: Record<string, unknown> = {},
    retentionMode: string = "short_lived",
  ): string {
    const eventId = nanoid(12);
    const expiresAt =
      retentionMode === "no_storage"
        ? new Date().toISOString()
        : retentionMode === "short_lived"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null;

    this.stmts.insertEvent.run(
      eventId,
      sessionId,
      jobId,
      type,
      explanation,
      frameB64,
      JSON.stringify(metadata),
      expiresAt,
    );
    return eventId;
  }

  getSession(sessionId: string): SessionRow | undefined {
    return this.stmts.getSession.get(sessionId) as SessionRow | undefined;
  }

  getActiveBindings(sessionId: string) {
    return this.stmts.getActiveBindings.all(sessionId);
  }

  getRunningJobs(sessionId: string): TrioJobRow[] {
    return this.stmts.getJobsBySession.all(sessionId) as TrioJobRow[];
  }

  getAllRunningJobs(): TrioJobRow[] {
    return this.stmts.getAllRunningJobs.all() as TrioJobRow[];
  }

  findJobSession(jobId: string): string | null {
    const job = this.stmts.getJob.get(jobId) as TrioJobRow | undefined;
    return job?.session_id ?? null;
  }

  markJobStopped(jobId: string, reason: string): void {
    this.stmts.updateJobStatus.run("stopped", reason, jobId);
  }

  private getStreamUrl(sessionId: string): string {
    const session = this.stmts.getSession.get(sessionId) as SessionRow | undefined;
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return session.stream_url;
  }
}
