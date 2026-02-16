import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { logger } from "../logger.js";
import { TrioClient } from "../trio/client.js";
import { StreamRelay } from "../stream/relay.js";
import { AgentDelivery } from "../agents/delivery.js";
import { EvidenceCaptureService } from "../evidence/capture.js";
import { buildCombinedCondition, parseTrioResponse } from "../checkpoints/evaluator.js";
import type { TaskConfig, TaskStatus } from "./types.js";
import { DEFAULT_REDACTION_POLICY } from "./types.js";
import type { TaskRow, CheckpointRow, TrioJobRow } from "../db/schema.js";
import type { InputMode } from "../trio/types.js";

export class TaskManager {
  private db: Database.Database;
  private trio: TrioClient;
  private streamRelay: StreamRelay;
  private agentDelivery: AgentDelivery;
  private evidenceCapture: EvidenceCaptureService;
  private webhookBaseUrl: string;

  private stmts: ReturnType<typeof this.prepareStatements>;

  constructor(
    db: Database.Database,
    trio: TrioClient,
    streamRelay: StreamRelay,
    agentDelivery: AgentDelivery,
    evidenceCapture: EvidenceCaptureService,
    webhookBaseUrl: string,
  ) {
    this.db = db;
    this.trio = trio;
    this.streamRelay = streamRelay;
    this.agentDelivery = agentDelivery;
    this.evidenceCapture = evidenceCapture;
    this.webhookBaseUrl = webhookBaseUrl;
    this.stmts = this.prepareStatements();
  }

  private prepareStatements() {
    return {
      insertTask: this.db.prepare(`
        INSERT INTO tasks (task_id, agent_id, description, title, payout_cents, webhook_url, status, stream_url, redaction_policy, max_duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `),
      updateTaskStatus: this.db.prepare(`
        UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE task_id = ?
      `),
      updateTaskStarted: this.db.prepare(`
        UPDATE tasks SET status = 'streaming', started_at = datetime('now'), updated_at = datetime('now') WHERE task_id = ?
      `),
      updateTaskCompleted: this.db.prepare(`
        UPDATE tasks SET status = 'completed', verification_hash = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE task_id = ?
      `),
      updateTaskHumanId: this.db.prepare(`
        UPDATE tasks SET human_id = ?, status = 'awaiting_stream', updated_at = datetime('now') WHERE task_id = ?
      `),
      getTask: this.db.prepare(`
        SELECT * FROM tasks WHERE task_id = ?
      `),
      insertCheckpoint: this.db.prepare(`
        INSERT INTO checkpoints (checkpoint_id, task_id, type, target, description, confidence_threshold, required, ordering)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getCheckpoints: this.db.prepare(`
        SELECT * FROM checkpoints WHERE task_id = ? ORDER BY ordering
      `),
      getUnverifiedCheckpoints: this.db.prepare(`
        SELECT * FROM checkpoints WHERE task_id = ? AND verified = 0 ORDER BY ordering
      `),
      updateCheckpointVerified: this.db.prepare(`
        UPDATE checkpoints SET verified = 1, verified_at = datetime('now'), evidence_frame_b64 = ?,
        evidence_explanation = ?, confidence = ? WHERE checkpoint_id = ?
      `),
      countRequiredCheckpoints: this.db.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified
        FROM checkpoints WHERE task_id = ? AND required = 1
      `),
      insertJob: this.db.prepare(`
        INSERT INTO trio_jobs (job_id, task_id, job_type, condition, interval_seconds, input_mode, enable_prefilter)
        VALUES (?, ?, 'live-monitor', ?, ?, ?, ?)
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
      getJob: this.db.prepare(`
        SELECT * FROM trio_jobs WHERE job_id = ?
      `),
      getJobsByTask: this.db.prepare(`
        SELECT * FROM trio_jobs WHERE task_id = ? AND status = 'running'
      `),
      getAllRunningJobs: this.db.prepare(`
        SELECT * FROM trio_jobs WHERE status = 'running'
      `),
      countRunningJobs: this.db.prepare(`
        SELECT COUNT(*) as count FROM trio_jobs WHERE status = 'running'
      `),
      insertEvent: this.db.prepare(`
        INSERT INTO verification_events (event_id, task_id, job_id, checkpoint_id, event_type, confidence, explanation, evidence_frame_b64, metadata, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getEvents: this.db.prepare(`
        SELECT event_id, task_id, job_id, checkpoint_id, event_type, confidence, explanation, metadata, created_at, expires_at
        FROM verification_events
        WHERE task_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `),
      getEventFrame: this.db.prepare(`
        SELECT evidence_frame_b64 FROM verification_events WHERE event_id = ?
      `),
    };
  }

  /**
   * Create a verification task with checkpoints.
   */
  createTask(config: TaskConfig): string {
    const taskId = nanoid(12);
    const streamSession = this.streamRelay.createSession(taskId);

    this.stmts.insertTask.run(
      taskId,
      config.agent_id,
      config.description,
      config.title ?? "",
      config.payout_cents ?? 0,
      config.webhook_url,
      streamSession.rtsp_url,
      JSON.stringify(config.redaction_policy ?? DEFAULT_REDACTION_POLICY),
      config.max_duration_seconds ?? 3600,
    );

    // Insert checkpoints
    for (let i = 0; i < config.checkpoints.length; i++) {
      const cp = config.checkpoints[i];
      this.stmts.insertCheckpoint.run(
        nanoid(12),
        taskId,
        cp.type,
        cp.target,
        cp.description || null,
        cp.confidence_threshold ?? 0.8,
        cp.required !== false ? 1 : 0,
        cp.ordering ?? i,
      );
    }

    logger.info({ taskId, checkpoints: config.checkpoints.length }, "Task created");
    return taskId;
  }

  /**
   * Human claims a task. Status → awaiting_stream.
   */
  claimTask(taskId: string, humanId: string): void {
    const task = this.stmts.getTask.get(taskId) as TaskRow | undefined;
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.status !== "pending") {
      throw new Error(`Task ${taskId} is ${task.status}, cannot claim`);
    }

    this.stmts.updateTaskHumanId.run(humanId, taskId);
    logger.info({ taskId, humanId }, "Task claimed");
  }

  /**
   * Stream connected, start Trio monitoring jobs.
   * Status → streaming.
   */
  async startStreaming(taskId: string): Promise<string> {
    const task = this.stmts.getTask.get(taskId) as TaskRow | undefined;
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.status !== "awaiting_stream" && task.status !== "pending") {
      throw new Error(`Task ${taskId} is ${task.status}, cannot start streaming`);
    }

    // Check concurrent job limit
    const { count } = this.stmts.countRunningJobs.get() as { count: number };
    if (count >= 10) {
      throw new Error("Maximum 10 concurrent jobs reached");
    }

    const checkpoints = this.stmts.getUnverifiedCheckpoints.all(taskId) as CheckpointRow[];
    if (checkpoints.length === 0) {
      throw new Error(`Task ${taskId} has no unverified checkpoints`);
    }

    const condition = buildCombinedCondition(checkpoints);

    const result = await this.trio.startLiveMonitor({
      url: task.stream_url!,
      condition,
      webhook_url: `${this.webhookBaseUrl}/webhooks/trio`,
      interval_seconds: 15,
      input_mode: "frames",
      enable_prefilter: true,
    });

    this.stmts.insertJob.run(
      result.job_id,
      taskId,
      condition,
      15,
      "frames",
      1,
    );

    this.stmts.updateTaskStarted.run(taskId);

    // Deliver task_started event
    const eventId = nanoid(12);
    this.stmts.insertEvent.run(
      eventId, taskId, result.job_id, null,
      "task_started", null, "Streaming started, monitoring checkpoints",
      null, "{}", null,
    );

    this.agentDelivery.deliverEvent(task.webhook_url, {
      event_id: eventId,
      task_id: taskId,
      event_type: "task_started",
      timestamp: new Date().toISOString(),
      metadata: { checkpoints: checkpoints.length },
    }).catch((err) => {
      logger.error({ err, taskId }, "Failed to deliver task_started event");
    });

    logger.info({ taskId, jobId: result.job_id }, "Streaming started");
    return result.job_id;
  }

  /**
   * Handle a Trio trigger webhook. Evaluate checkpoints, capture evidence, deliver events.
   */
  async handleTrioTrigger(
    jobId: string,
    explanation: string,
    frameB64: string | null,
  ): Promise<void> {
    const job = this.stmts.getJob.get(jobId) as TrioJobRow | undefined;
    if (!job) {
      logger.warn({ jobId }, "Trio trigger for unknown job");
      return;
    }

    const task = this.stmts.getTask.get(job.task_id) as TaskRow | undefined;
    if (!task || (task.status !== "streaming" && task.status !== "verifying")) return;

    const checkpoints = this.stmts.getUnverifiedCheckpoints.all(job.task_id) as CheckpointRow[];
    if (checkpoints.length === 0) return;

    // Parse the VLM response per checkpoint
    const results = parseTrioResponse(explanation, checkpoints);

    for (const result of results) {
      const checkpoint = checkpoints.find((cp) => cp.checkpoint_id === result.checkpoint_id);
      if (!checkpoint) continue;

      if (result.passed && result.confidence >= checkpoint.confidence_threshold) {
        // Capture evidence
        const evidence = await this.evidenceCapture.capture(
          result.checkpoint_id,
          frameB64,
          result.explanation,
          result.confidence,
        );

        // Mark checkpoint as verified
        this.stmts.updateCheckpointVerified.run(
          evidence.frame_b64,
          evidence.explanation,
          evidence.confidence,
          result.checkpoint_id,
        );

        // Record verification event
        const eventId = nanoid(12);
        this.stmts.insertEvent.run(
          eventId, job.task_id, jobId, result.checkpoint_id,
          "checkpoint_verified", result.confidence, result.explanation,
          evidence.frame_b64, JSON.stringify({ type: checkpoint.type, target: checkpoint.target }),
          null,
        );

        // Deliver to agent
        this.agentDelivery.deliverEvent(task.webhook_url, {
          event_id: eventId,
          task_id: job.task_id,
          event_type: "checkpoint_verified",
          timestamp: new Date().toISOString(),
          checkpoint_id: result.checkpoint_id,
          checkpoint_type: checkpoint.type,
          checkpoint_target: checkpoint.target,
          confidence: result.confidence,
          explanation: result.explanation,
          metadata: {},
        }).catch((err) => {
          logger.error({ err, taskId: job.task_id }, "Failed to deliver checkpoint event");
        });

        logger.info(
          { taskId: job.task_id, checkpointId: result.checkpoint_id, confidence: result.confidence },
          "Checkpoint verified",
        );
      }
    }

    // Check if all required checkpoints are now verified
    const { total, verified } = this.stmts.countRequiredCheckpoints.get(job.task_id) as { total: number; verified: number };
    if (verified >= total) {
      await this.completeTask(job.task_id);
    } else {
      // Update status to verifying (at least one checkpoint has been evaluated)
      this.stmts.updateTaskStatus.run("verifying", job.task_id);
    }
  }

  /**
   * Complete a task: all required checkpoints verified.
   */
  async completeTask(taskId: string): Promise<void> {
    const task = this.stmts.getTask.get(taskId) as TaskRow | undefined;
    if (!task) return;

    // Cancel all running jobs
    const jobs = this.stmts.getJobsByTask.all(taskId) as TrioJobRow[];
    for (const job of jobs) {
      try {
        await this.trio.cancelJob(job.job_id);
        this.stmts.updateJobStatus.run("stopped", "task_completed", job.job_id);
      } catch (err) {
        logger.warn({ err, jobId: job.job_id }, "Failed to cancel job on task completion");
      }
    }

    // Generate verification hash (SHA-256 of all checkpoint evidence)
    const checkpoints = this.stmts.getCheckpoints.all(taskId) as CheckpointRow[];
    const hashInput = checkpoints
      .filter((cp) => cp.verified)
      .map((cp) => `${cp.checkpoint_id}:${cp.type}:${cp.target}:${cp.confidence}:${cp.verified_at}`)
      .join("|");
    const verificationHash = createHash("sha256").update(hashInput).digest("hex");

    this.stmts.updateTaskCompleted.run(verificationHash, taskId);

    // Record and deliver completion event
    const eventId = nanoid(12);
    this.stmts.insertEvent.run(
      eventId, taskId, null, null,
      "task_completed", null, "All required checkpoints verified",
      null, JSON.stringify({ verification_hash: verificationHash }),
      null,
    );

    this.agentDelivery.deliverEvent(task.webhook_url, {
      event_id: eventId,
      task_id: taskId,
      event_type: "task_completed",
      timestamp: new Date().toISOString(),
      verification_hash: verificationHash,
      metadata: {
        checkpoints_verified: checkpoints.filter((cp) => cp.verified).length,
        checkpoints_total: checkpoints.length,
      },
    }).catch((err) => {
      logger.error({ err, taskId }, "Failed to deliver task_completed event");
    });

    this.streamRelay.removeSession(taskId);
    logger.info({ taskId, verificationHash }, "Task completed");
  }

  /**
   * Cancel a task. Stop all Trio jobs.
   */
  async cancelTask(taskId: string): Promise<void> {
    const jobs = this.stmts.getJobsByTask.all(taskId) as TrioJobRow[];
    for (const job of jobs) {
      try {
        await this.trio.cancelJob(job.job_id);
        this.stmts.updateJobStatus.run("stopped", "cancelled", job.job_id);
      } catch (err) {
        logger.warn({ err, jobId: job.job_id }, "Failed to cancel job");
      }
    }

    const task = this.stmts.getTask.get(taskId) as TaskRow | undefined;

    this.stmts.updateTaskStatus.run("cancelled", taskId);
    this.streamRelay.removeSession(taskId);

    // Deliver cancellation event
    if (task) {
      const eventId = nanoid(12);
      this.stmts.insertEvent.run(
        eventId, taskId, null, null,
        "task_cancelled", null, "Task cancelled",
        null, "{}", null,
      );

      this.agentDelivery.deliverEvent(task.webhook_url, {
        event_id: eventId,
        task_id: taskId,
        event_type: "task_cancelled",
        timestamp: new Date().toISOString(),
        metadata: {},
      }).catch((err) => {
        logger.error({ err, taskId }, "Failed to deliver task_cancelled event");
      });
    }

    logger.info({ taskId }, "Task cancelled");
  }

  /**
   * Auto-restart a job that hit the 10-minute cap.
   */
  async restartJob(oldJobId: string): Promise<string | null> {
    const job = this.stmts.getJob.get(oldJobId) as TrioJobRow | undefined;
    if (!job) return null;

    const task = this.stmts.getTask.get(job.task_id) as TaskRow | undefined;
    if (!task || (task.status !== "streaming" && task.status !== "verifying")) return null;

    const restartStart = Date.now();

    try {
      const result = await this.trio.startLiveMonitor({
        url: task.stream_url!,
        condition: job.condition || "",
        webhook_url: `${this.webhookBaseUrl}/webhooks/trio`,
        interval_seconds: job.interval_seconds,
        input_mode: job.input_mode as InputMode,
        enable_prefilter: job.enable_prefilter === 1,
      });

      const gapMs = Date.now() - restartStart;
      this.stmts.updateJobRestart.run(result.job_id, gapMs, oldJobId);

      const eventId = nanoid(12);
      this.stmts.insertEvent.run(
        eventId, job.task_id, result.job_id, null,
        "job_restarted", null,
        `Job restarted (gap: ${gapMs}ms, restart #${job.restart_count + 1})`,
        null, JSON.stringify({ old_job_id: oldJobId, gap_ms: gapMs }),
        null,
      );

      logger.info({ oldJobId, newJobId: result.job_id, gapMs }, "Job restarted");
      return result.job_id;
    } catch (err) {
      logger.error({ err, oldJobId }, "Job restart failed");
      this.stmts.updateJobStatus.run("error", "restart_failed", oldJobId);
      return null;
    }
  }

  markJobStopped(jobId: string, reason: string): void {
    this.stmts.updateJobStatus.run("stopped", reason, jobId);
  }

  getTask(taskId: string): TaskRow | undefined {
    return this.stmts.getTask.get(taskId) as TaskRow | undefined;
  }

  getCheckpoints(taskId: string): CheckpointRow[] {
    return this.stmts.getCheckpoints.all(taskId) as CheckpointRow[];
  }

  getRunningJobs(taskId: string): TrioJobRow[] {
    return this.stmts.getJobsByTask.all(taskId) as TrioJobRow[];
  }

  getAllRunningJobs(): TrioJobRow[] {
    return this.stmts.getAllRunningJobs.all() as TrioJobRow[];
  }

  findJobTask(jobId: string): string | null {
    const job = this.stmts.getJob.get(jobId) as TrioJobRow | undefined;
    return job?.task_id ?? null;
  }

  getEvents(taskId: string, limit: number) {
    return this.stmts.getEvents.all(taskId, limit);
  }

  getEventFrame(eventId: string): string | null {
    const row = this.stmts.getEventFrame.get(eventId) as { evidence_frame_b64: string | null } | undefined;
    return row?.evidence_frame_b64 ?? null;
  }
}
