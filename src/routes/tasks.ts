import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { TaskManager } from "../tasks/manager.js";
import { CHECKPOINT_TEMPLATES } from "../checkpoints/types.js";
import { config } from "../config.js";
import { evaluateGpsCheckpoint } from "../checkpoints/gps.js";
import type { GpsTarget } from "../checkpoints/gps.js";
import { lookupIpLocation } from "../checkpoints/ip-geo.js";
import { haversineDistance } from "../checkpoints/gps.js";
import { createChallenge, verifyChallenge } from "../attestation/challenges.js";
import { AttestationVerifier } from "../attestation/verifier.js";
import { logger } from "../logger.js";

// --- Zod schemas ---

const CreateTaskSchema = z.object({
  description: z.string().min(1, "description is required"),
  title: z.string().optional(),
  payout_cents: z.number().int().min(0).optional(),
  webhook_url: z.string().min(1, "webhook_url is required").url("webhook_url must be a valid URL"),
  checkpoints: z.array(z.object({
    type: z.enum(["location", "object", "document", "gps", "person", "action", "duration", "text"]),
    target: z.string().min(1, "target is required"),
    description: z.string().optional(),
    confidence_threshold: z.number().min(0).max(1).optional(),
    required: z.boolean().optional(),
    ordering: z.number().int().min(0).optional(),
  })).min(1, "At least one checkpoint is required"),
  redaction_policy: z.object({
    blur_faces: z.boolean(),
    blur_text: z.boolean(),
  }).optional(),
  max_duration_seconds: z.number().int().min(60).max(86400).optional(),
  escrow_lamports: z.number().int().min(0).optional(),
  agent_wallet: z.string().optional(),
});

const ClaimTaskSchema = z.object({
  human_id: z.string().min(1, "human_id is required"),
  human_wallet: z.string().optional(),
});

function zodError(result: z.ZodError) {
  return {
    error: result.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    code: "VALIDATION_ERROR",
  };
}

export function createTaskRoutes(taskManager: TaskManager): Hono {
  const app = new Hono();

  // --- Create verification task ---
  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateTaskSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);
    const body = parsed.data;

    // Validate checkpoint types are available
    for (const cp of body.checkpoints) {
      const template = CHECKPOINT_TEMPLATES[cp.type];
      if (!template.available) {
        return c.json({
          error: `Checkpoint type "${cp.type}" is not yet available (coming soon)`,
          code: "CHECKPOINT_UNAVAILABLE",
        }, 400);
      }
    }

    const taskId = await taskManager.createTask({
      agent_id: "api", // TODO: extract from auth
      description: body.description,
      title: body.title,
      payout_cents: body.payout_cents,
      webhook_url: body.webhook_url,
      checkpoints: body.checkpoints,
      redaction_policy: body.redaction_policy,
      max_duration_seconds: body.max_duration_seconds,
      escrow_lamports: body.escrow_lamports,
      agent_wallet: body.agent_wallet,
    });

    const task = taskManager.getTask(taskId);
    const checkpoints = taskManager.getCheckpoints(taskId);

    return c.json({
      task_id: taskId,
      status: task?.status,
      stream_url: task?.stream_url,
      escrow_lamports: task?.escrow_lamports ?? 0,
      escrow_status: task?.escrow_status ?? "none",
      escrow_pda: task?.escrow_pda ?? null,
      deposit_signature: task?.deposit_signature ?? null,
      checkpoints: checkpoints.map((cp) => ({
        checkpoint_id: cp.checkpoint_id,
        type: cp.type,
        target: cp.target,
        required: cp.required === 1,
        ordering: cp.ordering,
      })),
    }, 201);
  });

  // --- Get task status + checkpoints ---
  app.get("/:id", (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    const checkpoints = taskManager.getCheckpoints(taskId);
    const jobs = taskManager.getRunningJobs(taskId);

    return c.json({
      task_id: task.task_id,
      agent_id: task.agent_id,
      description: task.description,
      title: task.title,
      payout_cents: task.payout_cents,
      status: task.status,
      stream_url: task.stream_url,
      human_id: task.human_id,
      verification_hash: task.verification_hash,
      tx_hash: task.tx_hash,
      max_duration_seconds: task.max_duration_seconds,
      created_at: task.created_at,
      started_at: task.started_at,
      completed_at: task.completed_at,
      // Escrow fields
      escrow_lamports: task.escrow_lamports,
      escrow_status: task.escrow_status,
      agent_wallet: task.agent_wallet,
      human_wallet: task.human_wallet,
      escrow_pda: task.escrow_pda,
      deposit_signature: task.deposit_signature,
      release_signature: task.release_signature,
      trust_score: task.trust_score ?? null,
      trust_grade: task.trust_grade ?? null,
      checkpoints: checkpoints.map((cp) => ({
        checkpoint_id: cp.checkpoint_id,
        type: cp.type,
        target: cp.target,
        description: cp.description,
        confidence_threshold: cp.confidence_threshold,
        required: cp.required === 1,
        ordering: cp.ordering,
        verified: cp.verified === 1,
        verified_at: cp.verified_at,
        confidence: cp.confidence,
        evidence_explanation: cp.evidence_explanation,
        evidence_zg_root: cp.evidence_zg_root,
      })),
      active_jobs: jobs.length,
      jobs: jobs.map((j) => ({
        job_id: j.job_id,
        status: j.status,
        restart_count: j.restart_count,
        last_restart_gap_ms: j.last_restart_gap_ms,
      })),
    });
  });

  // --- Human claims task ---
  app.post("/:id/claim", async (c) => {
    const taskId = c.req.param("id");
    const raw = await c.req.json().catch(() => ({}));
    const parsed = ClaimTaskSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);

    try {
      await taskManager.claimTask(taskId, parsed.data.human_id, parsed.data.human_wallet);
      const task = taskManager.getTask(taskId);
      return c.json({
        task_id: taskId,
        status: task?.status,
        stream_url: task?.stream_url,
        human_id: parsed.data.human_id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to claim task";
      return c.json({ error: message, code: "CLAIM_FAILED" }, 400);
    }
  });

  // --- Start streaming (human's stream connected) ---
  app.post("/:id/start", async (c) => {
    const taskId = c.req.param("id");
    try {
      const jobId = await taskManager.startStreaming(taskId);
      return c.json({ task_id: taskId, job_id: jobId, status: "streaming" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start streaming";
      return c.json({ error: message, code: "START_FAILED" }, 400);
    }
  });

  // --- Stop/cancel task ---
  app.post("/:id/stop", async (c) => {
    const taskId = c.req.param("id");
    try {
      await taskManager.cancelTask(taskId);
      return c.json({ task_id: taskId, status: "cancelled" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop task";
      return c.json({ error: message, code: "STOP_FAILED" }, 400);
    }
  });

  // --- Get verification events ---
  app.get("/:id/events", (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
    const events = taskManager.getEvents(taskId, limit);
    return c.json({ events });
  });

  // --- On-chain verification lookup ---
  app.get("/:id/verify", async (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    const result: Record<string, unknown> = {
      task_id: task.task_id,
      verification_hash: task.verification_hash,
      tx_hash: task.tx_hash,
      escrow_status: task.escrow_status,
      escrow_lamports: task.escrow_lamports,
    };

    if (task.tx_hash) {
      result.chain = {
        program_id: config.solana.programId,
        explorer_url: `${config.solana.explorerUrl}/tx/${task.tx_hash}?cluster=${config.solana.cluster}`,
      };
    }

    if (task.escrow_pda) {
      result.escrow = {
        pda: task.escrow_pda,
        deposit_signature: task.deposit_signature,
        release_signature: task.release_signature,
        status: task.escrow_status,
      };
    }

    return c.json(result);
  });

  // --- Get checkpoint statuses ---
  app.get("/:id/checkpoints", (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    const checkpoints = taskManager.getCheckpoints(taskId);
    return c.json({
      checkpoints: checkpoints.map((cp) => ({
        checkpoint_id: cp.checkpoint_id,
        type: cp.type,
        target: cp.target,
        description: cp.description,
        confidence_threshold: cp.confidence_threshold,
        required: cp.required === 1,
        ordering: cp.ordering,
        verified: cp.verified === 1,
        verified_at: cp.verified_at,
        confidence: cp.confidence,
        evidence_explanation: cp.evidence_explanation,
        evidence_zg_root: cp.evidence_zg_root,
      })),
    });
  });

  // --- Submit GPS reading ---
  const GpsReadingSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy_m: z.number().min(0).max(100),
    timestamp: z.string().optional(),
  });

  app.post("/:id/gps", async (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);
    if (task.status !== "streaming" && task.status !== "verifying") {
      return c.json({ error: "Task is not actively streaming", code: "INVALID_STATUS" }, 400);
    }

    const raw = await c.req.json().catch(() => ({}));
    const parsed = GpsReadingSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);

    const reading = parsed.data;
    const readingId = nanoid(12);
    const clientIp = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "";

    // IP geolocation cross-check (non-blocking)
    let ipGeoLat: number | null = null;
    let ipGeoLng: number | null = null;
    let ipDistanceKm: number | null = null;

    if (clientIp && clientIp !== "127.0.0.1" && clientIp !== "::1") {
      const ipGeo = await lookupIpLocation(clientIp);
      if (ipGeo) {
        ipGeoLat = ipGeo.lat;
        ipGeoLng = ipGeo.lng;
        ipDistanceKm = Math.round(
          haversineDistance(ipGeo.lat, ipGeo.lng, reading.lat, reading.lng) / 1000,
        );
      }
    }

    // Store reading
    taskManager.storeGpsReading(readingId, taskId, reading.lat, reading.lng, reading.accuracy_m, clientIp || null, ipGeoLat, ipGeoLng, ipDistanceKm);

    // Evaluate GPS checkpoints
    const checkpoints = taskManager.getCheckpoints(taskId);
    const gpsCheckpoints = checkpoints.filter((cp) => cp.type === "gps" && cp.verified === 0);
    const results: Array<{ checkpoint_id: string; distance_m: number; within_radius: boolean; confidence: number }> = [];

    for (const cp of gpsCheckpoints) {
      try {
        const target: GpsTarget = JSON.parse(cp.target);
        const gpsResult = evaluateGpsCheckpoint(
          { lat: reading.lat, lng: reading.lng, accuracy_m: reading.accuracy_m },
          target,
        );
        results.push({ checkpoint_id: cp.checkpoint_id, ...gpsResult });

        if (gpsResult.within_radius && gpsResult.confidence >= cp.confidence_threshold) {
          taskManager.verifyGpsCheckpoint(cp.checkpoint_id, gpsResult, readingId);
        }
      } catch {
        logger.warn({ checkpointId: cp.checkpoint_id }, "Failed to parse GPS target");
      }
    }

    return c.json({
      reading_id: readingId,
      task_id: taskId,
      results,
      ip_distance_km: ipDistanceKm,
    });
  });

  // --- Get attestation challenge ---
  app.get("/:id/challenge", (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    const challenge = createChallenge(taskId);
    return c.json(challenge);
  });

  // --- Submit device attestation ---
  const AttestSchema = z.object({
    challenge_id: z.string().min(1),
    platform: z.enum(["android", "ios", "web"]),
    token: z.string().min(1),
  });

  const attestationVerifier = new AttestationVerifier(config.attestation.liveMode);

  app.post("/:id/attest", async (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    const raw = await c.req.json().catch(() => ({}));
    const parsed = AttestSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);

    const { challenge_id, platform, token } = parsed.data;

    // Verify challenge
    if (!verifyChallenge(challenge_id)) {
      return c.json({ error: "Invalid or expired challenge", code: "CHALLENGE_FAILED" }, 400);
    }

    // Verify attestation
    const result = await attestationVerifier.verify(platform, token, challenge_id);

    // Store attestation
    taskManager.storeAttestation(taskId, task.human_id, platform, result);

    // Compute trust score
    const trustScore = taskManager.computeAndStoreTrustScore(taskId);

    return c.json({
      valid: result.valid,
      device_type: result.device_type,
      integrity_level: result.integrity_level,
      trust_score: trustScore,
    });
  });

  return app;
}
