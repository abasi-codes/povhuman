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
import type { SolanaChainClient } from "../chain/client.js";
import type { ChainReceipt } from "../chain/types.js";
import type { GpsResult } from "../checkpoints/gps.js";
import { computeCompositeScore } from "../checkpoints/composite-scorer.js";
import type { AttestationResult } from "../attestation/verifier.js";
import { computeTrustScore } from "../attestation/trust-score.js";
import type { GpsReadingRow, DeviceAttestationRow } from "../db/schema.js";

export class TaskManager {
  private db: Database.Database;
  private trio: TrioClient;
  private streamRelay: StreamRelay;
  private agentDelivery: AgentDelivery;
  private evidenceCapture: EvidenceCaptureService;
  private webhookBaseUrl: string;
  private solanaChain?: SolanaChainClient;

  private stmts: ReturnType<typeof this.prepareStatements>;

  constructor(
    db: Database.Database,
    trio: TrioClient,
    streamRelay: StreamRelay,
    agentDelivery: AgentDelivery,
    evidenceCapture: EvidenceCaptureService,
    webhookBaseUrl: string,
    solanaChain?: SolanaChainClient,
  ) {
    this.db = db;
    this.trio = trio;
    this.streamRelay = streamRelay;
    this.agentDelivery = agentDelivery;
    this.evidenceCapture = evidenceCapture;
    this.webhookBaseUrl = webhookBaseUrl;
    this.solanaChain = solanaChain;
    this.stmts = this.prepareStatements();
  }

  private prepareStatements() {
    return {
      insertTask: this.db.prepare(`
        INSERT INTO tasks (task_id, agent_id, description, title, payout_cents, webhook_url, status, stream_url, redaction_policy, max_duration_seconds, escrow_lamports, agent_wallet)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
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
      updateTaskHumanWallet: this.db.prepare(`
        UPDATE tasks SET human_wallet = ?, updated_at = datetime('now') WHERE task_id = ?
      `),
      updateTaskEscrow: this.db.prepare(`
        UPDATE tasks SET escrow_status = ?, escrow_pda = ?, deposit_signature = ?, updated_at = datetime('now') WHERE task_id = ?
      `),
      updateTaskRelease: this.db.prepare(`
        UPDATE tasks SET escrow_status = 'released', release_signature = ?, updated_at = datetime('now') WHERE task_id = ?
      `),
      updateTaskRefund: this.db.prepare(`
        UPDATE tasks SET escrow_status = 'refunded', release_signature = ?, updated_at = datetime('now') WHERE task_id = ?
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
        SELECT evidence_frame_b64, evidence_zg_root FROM verification_events WHERE event_id = ?
      `),
      updateCheckpointZgRoot: this.db.prepare(`
        UPDATE checkpoints SET evidence_zg_root = ? WHERE checkpoint_id = ?
      `),
      updateEventZgRoot: this.db.prepare(`
        UPDATE verification_events SET evidence_zg_root = ? WHERE event_id = ?
      `),
      updateTaskTxHash: this.db.prepare(`
        UPDATE tasks SET tx_hash = ?, updated_at = datetime('now') WHERE task_id = ?
      `),
      // Agent queries
      getAgent: this.db.prepare(`
        SELECT * FROM agents WHERE agent_id = ?
      `),
      // GPS readings
      insertGpsReading: this.db.prepare(`
        INSERT INTO gps_readings (reading_id, task_id, lat, lng, accuracy_m, ip_address, ip_geo_lat, ip_geo_lng, ip_distance_km)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getLatestGpsReading: this.db.prepare(`
        SELECT * FROM gps_readings WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
      `),
      // Device attestations
      insertAttestation: this.db.prepare(`
        INSERT INTO device_attestations (attestation_id, task_id, human_id, platform, device_type, integrity_level, valid, raw_verdict)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getLatestAttestation: this.db.prepare(`
        SELECT * FROM device_attestations WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
      `),
      // Trust score
      updateTaskTrustScore: this.db.prepare(`
        UPDATE tasks SET trust_score = ?, trust_grade = ?, updated_at = datetime('now') WHERE task_id = ?
      `),
      updateCheckpointMetadata: this.db.prepare(`
        UPDATE checkpoints SET metadata = ? WHERE checkpoint_id = ?
      `),
    };
  }

  /**
   * Create a verification task with checkpoints.
   * If escrow_lamports > 0, creates a mock escrow on Solana.
   */
  async createTask(config: TaskConfig): Promise<string> {
    const taskId = config.task_id ?? nanoid(12);
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
      config.escrow_lamports ?? 0,
      config.agent_wallet ?? null,
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

    // Create escrow if lamports specified
    if ((config.escrow_lamports ?? 0) > 0 && config.agent_wallet && this.solanaChain) {
      try {
        const { receipt, pda } = await this.solanaChain.createTaskEscrow(
          taskId,
          config.agent_wallet,
          config.escrow_lamports!,
        );
        this.stmts.updateTaskEscrow.run("deposited", pda, receipt.signature, taskId);
        this.stmts.updateTaskTxHash.run(receipt.signature, taskId);
        logger.info({ taskId, pda, signature: receipt.signature.slice(0, 16) + "..." }, "Escrow created for task");
      } catch (err) {
        logger.warn({ err, taskId }, "Escrow creation failed, task created without escrow");
      }
    }

    logger.info({ taskId, checkpoints: config.checkpoints.length }, "Task created");
    return taskId;
  }

  /**
   * Human claims a task. Status -> awaiting_stream.
   */
  async claimTask(taskId: string, humanId: string, humanWallet?: string): Promise<void> {
    const task = this.stmts.getTask.get(taskId) as TaskRow | undefined;
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.status !== "pending") {
      throw new Error(`Task ${taskId} is ${task.status}, cannot claim`);
    }

    this.stmts.updateTaskHumanId.run(humanId, taskId);

    if (humanWallet) {
      this.stmts.updateTaskHumanWallet.run(humanWallet, taskId);
    }

    // Record claim on chain if escrow exists
    if (task.escrow_status === "deposited" && task.escrow_pda && humanWallet && this.solanaChain) {
      try {
        await this.solanaChain.claimTask(taskId, humanWallet, task.escrow_pda);
      } catch (err) {
        logger.warn({ err, taskId }, "On-chain claim recording failed");
      }
    }

    logger.info({ taskId, humanId, humanWallet }, "Task claimed");
  }

  /**
   * Stream connected, start Trio monitoring jobs.
   * Status -> streaming.
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
      stream_url: task.stream_url!,
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

        // Record checkpoint verification on-chain (async, non-blocking)
        if (this.solanaChain && task.escrow_status === "deposited") {
          this.solanaChain.verifyCheckpoint(job.task_id, result.checkpoint_id, "")
            .catch((err) => logger.warn({ err, checkpointId: result.checkpoint_id }, "On-chain checkpoint verify failed"));
        }

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
   * Releases escrow if deposited.
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

    // Compute trust score on completion
    const trustResult = this.computeAndStoreTrustScore(taskId);

    // Release escrow on-chain
    let releaseReceipt: ChainReceipt | null = null;
    if (this.solanaChain && task.escrow_status === "deposited" && task.escrow_pda) {
      try {
        releaseReceipt = await Promise.race([
          this.solanaChain.completeAndRelease(
            taskId,
            task.escrow_pda,
            verificationHash,
            checkpoints.filter((cp) => cp.verified).length,
          ),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
        ]);
        this.stmts.updateTaskRelease.run(releaseReceipt.signature, taskId);
        this.stmts.updateTaskTxHash.run(releaseReceipt.signature, taskId);
      } catch (err) {
        logger.warn({ err, taskId }, "Escrow release failed");
      }
    }

    // Record and deliver completion event
    const eventId = nanoid(12);
    this.stmts.insertEvent.run(
      eventId, taskId, null, null,
      "task_completed", null, "All required checkpoints verified",
      null, JSON.stringify({ verification_hash: verificationHash }),
      null,
    );

    const completionMetadata: Record<string, unknown> = {
      checkpoints_verified: checkpoints.filter((cp) => cp.verified).length,
      checkpoints_total: checkpoints.length,
      trust_score: trustResult.score,
      trust_grade: trustResult.grade,
    };

    if (releaseReceipt) {
      completionMetadata.signature = releaseReceipt.signature;
      completionMetadata.program_id = releaseReceipt.program_id;
      completionMetadata.explorer_url = releaseReceipt.explorer_url;
    }

    this.agentDelivery.deliverEvent(task.webhook_url, {
      event_id: eventId,
      task_id: taskId,
      event_type: "task_completed",
      timestamp: new Date().toISOString(),
      verification_hash: verificationHash,
      metadata: completionMetadata,
    }).catch((err) => {
      logger.error({ err, taskId }, "Failed to deliver task_completed event");
    });

    this.streamRelay.removeSession(taskId);
    logger.info({ taskId, verificationHash }, "Task completed");
  }

  /**
   * Cancel a task. Stop all Trio jobs. Refund escrow if deposited.
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

    // Refund escrow if deposited
    if (task && task.escrow_status === "deposited" && task.escrow_pda && this.solanaChain) {
      try {
        const receipt = await this.solanaChain.cancelAndRefund(taskId, task.escrow_pda);
        this.stmts.updateTaskRefund.run(receipt.signature, taskId);
      } catch (err) {
        logger.warn({ err, taskId }, "Escrow refund failed");
      }
    }

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
        stream_url: task.stream_url!,
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

  getEventZgRoot(eventId: string): string | null {
    const row = this.stmts.getEventFrame.get(eventId) as { evidence_frame_b64: string | null; evidence_zg_root: string | null } | undefined;
    return row?.evidence_zg_root ?? null;
  }

  getSolanaChain(): SolanaChainClient | undefined {
    return this.solanaChain;
  }

  getEvents(taskId: string, limit: number) {
    return this.stmts.getEvents.all(taskId, limit);
  }

  getEventFrame(eventId: string): string | null {
    const row = this.stmts.getEventFrame.get(eventId) as { evidence_frame_b64: string | null; evidence_zg_root: string | null } | undefined;
    return row?.evidence_frame_b64 ?? null;
  }

  // --- GPS Methods ---

  storeGpsReading(
    readingId: string,
    taskId: string,
    lat: number,
    lng: number,
    accuracyM: number,
    ipAddress: string | null,
    ipGeoLat: number | null,
    ipGeoLng: number | null,
    ipDistanceKm: number | null,
  ): void {
    this.stmts.insertGpsReading.run(readingId, taskId, lat, lng, accuracyM, ipAddress, ipGeoLat, ipGeoLng, ipDistanceKm);
  }

  getLatestGpsReading(taskId: string): GpsReadingRow | undefined {
    return this.stmts.getLatestGpsReading.get(taskId) as GpsReadingRow | undefined;
  }

  verifyGpsCheckpoint(checkpointId: string, gpsResult: GpsResult, readingId: string): void {
    this.stmts.updateCheckpointVerified.run(
      null,
      `GPS verified: ${gpsResult.distance_m}m from target (within radius: ${gpsResult.within_radius})`,
      gpsResult.confidence,
      checkpointId,
    );
    this.stmts.updateCheckpointMetadata.run(
      JSON.stringify({ gps: gpsResult, reading_id: readingId }),
      checkpointId,
    );

    // Record verification event
    const eventId = nanoid(12);
    const checkpoint = this.stmts.getCheckpoints.all("").length; // get the checkpoint
    this.stmts.insertEvent.run(
      eventId, "", null, checkpointId,
      "checkpoint_verified", gpsResult.confidence,
      `GPS checkpoint verified: ${gpsResult.distance_m}m from target`,
      null, JSON.stringify({ gps: gpsResult, reading_id: readingId }),
      null,
    );

    // Find task for this checkpoint and deliver webhook + check completion
    const cpRow = this.db.prepare("SELECT task_id FROM checkpoints WHERE checkpoint_id = ?").get(checkpointId) as { task_id: string } | undefined;
    if (cpRow) {
      const task = this.stmts.getTask.get(cpRow.task_id) as TaskRow | undefined;
      if (task) {
        // Update the event with correct task_id
        this.db.prepare("UPDATE verification_events SET task_id = ? WHERE event_id = ?").run(cpRow.task_id, eventId);

        // Deliver webhook
        this.agentDelivery.deliverEvent(task.webhook_url, {
          event_id: eventId,
          task_id: cpRow.task_id,
          event_type: "checkpoint_verified",
          timestamp: new Date().toISOString(),
          checkpoint_id: checkpointId,
          checkpoint_type: "gps",
          confidence: gpsResult.confidence,
          metadata: { gps: gpsResult },
        }).catch((err) => {
          logger.error({ err, taskId: cpRow.task_id }, "Failed to deliver GPS checkpoint event");
        });

        // Check completion
        const { total, verified } = this.stmts.countRequiredCheckpoints.get(cpRow.task_id) as { total: number; verified: number };
        if (verified >= total) {
          this.completeTask(cpRow.task_id).catch((err) => {
            logger.error({ err, taskId: cpRow.task_id }, "Failed to complete task after GPS checkpoint");
          });
        }
      }
    }
  }

  // --- Attestation Methods ---

  storeAttestation(
    taskId: string,
    humanId: string | null,
    platform: string,
    result: AttestationResult,
  ): void {
    this.stmts.insertAttestation.run(
      nanoid(12),
      taskId,
      humanId,
      platform,
      result.device_type,
      result.integrity_level,
      result.valid ? 1 : 0,
      result.raw_verdict ? JSON.stringify(result.raw_verdict) : null,
    );
  }

  getLatestAttestation(taskId: string): DeviceAttestationRow | undefined {
    return this.stmts.getLatestAttestation.get(taskId) as DeviceAttestationRow | undefined;
  }

  computeAndStoreTrustScore(taskId: string): { score: number; grade: string; breakdown: Record<string, unknown> } {
    const checkpoints = this.stmts.getCheckpoints.all(taskId) as CheckpointRow[];
    const verifiedCps = checkpoints.filter((cp) => cp.verified === 1);

    // Average VLM confidence from verified checkpoints (non-GPS)
    const vlmCheckpoints = verifiedCps.filter((cp) => cp.type !== "gps");
    const vlmConfidence = vlmCheckpoints.length > 0
      ? vlmCheckpoints.reduce((sum, cp) => sum + (cp.confidence || 0), 0) / vlmCheckpoints.length
      : 0;

    // Latest GPS reading
    const gpsReading = this.getLatestGpsReading(taskId);
    let gpsConfidence: number | undefined;
    if (gpsReading) {
      // Find GPS checkpoints and get best confidence
      const gpsCheckpoints = verifiedCps.filter((cp) => cp.type === "gps");
      if (gpsCheckpoints.length > 0) {
        gpsConfidence = Math.max(...gpsCheckpoints.map((cp) => cp.confidence || 0));
      }
    }

    // Latest attestation
    const attestation = this.getLatestAttestation(taskId);
    const attestationValid = attestation?.valid === 1;

    const result = computeTrustScore(vlmConfidence, gpsConfidence, attestationValid ? true : undefined);

    this.stmts.updateTaskTrustScore.run(result.score, result.grade, taskId);

    return { score: result.score, grade: result.grade, breakdown: result.breakdown as unknown as Record<string, unknown> };
  }
}
