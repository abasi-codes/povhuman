import { Hono } from "hono";
import { z } from "zod";
import type { TaskManager } from "../tasks/manager.js";
import { CHECKPOINT_TEMPLATES } from "../checkpoints/types.js";

// --- Zod schemas ---

const CreateTaskSchema = z.object({
  description: z.string().min(1, "description is required"),
  webhook_url: z.string().min(1, "webhook_url is required").url("webhook_url must be a valid URL"),
  checkpoints: z.array(z.object({
    type: z.enum(["location", "object", "document", "person", "action", "duration", "text"]),
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
});

const ClaimTaskSchema = z.object({
  human_id: z.string().min(1, "human_id is required"),
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

    const taskId = taskManager.createTask({
      agent_id: "api", // TODO: extract from auth
      description: body.description,
      webhook_url: body.webhook_url,
      checkpoints: body.checkpoints,
      redaction_policy: body.redaction_policy,
      max_duration_seconds: body.max_duration_seconds,
    });

    const task = taskManager.getTask(taskId);
    const checkpoints = taskManager.getCheckpoints(taskId);

    return c.json({
      task_id: taskId,
      status: task?.status,
      stream_url: task?.stream_url,
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
      status: task.status,
      stream_url: task.stream_url,
      human_id: task.human_id,
      verification_hash: task.verification_hash,
      max_duration_seconds: task.max_duration_seconds,
      created_at: task.created_at,
      started_at: task.started_at,
      completed_at: task.completed_at,
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
      taskManager.claimTask(taskId, parsed.data.human_id);
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
      })),
    });
  });

  return app;
}
