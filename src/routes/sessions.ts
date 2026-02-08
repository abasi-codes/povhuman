import { Hono } from "hono";
import { z } from "zod";
import type { SessionManager } from "../sessions/manager.js";
import { validateYouTubeUrl, extractVideoId } from "../youtube/validator.js";
import { validateCondition } from "../conditions/combiner.js";
import { CONDITION_PRESETS, getPreset } from "../conditions/presets.js";
import type { TrioClient } from "../trio/client.js";
import type { QuotaTracker } from "../youtube/quota.js";
import { DEFAULT_REDACTION_POLICY } from "../sessions/types.js";
import type { InputMode } from "../trio/types.js";

// --- Zod schemas ---

const ValidateUrlSchema = z.object({
  url: z.string().min(1, "url is required").url("url must be a valid URL"),
});

const PreviewSchema = z.object({
  url: z.string().min(1, "url is required").url("url must be a valid URL"),
});

const TestConditionSchema = z.object({
  url: z.string().min(1).url(),
  condition: z.string().optional(),
  preset_id: z.string().optional(),
  input_mode: z.enum(["frames", "clip", "hybrid"]).optional(),
});

const CreateSessionSchema = z.object({
  stream_url: z.string().min(1, "stream_url is required").url("stream_url must be a valid URL"),
  conditions: z.array(z.string().min(1)).optional(),
  preset_ids: z.array(z.string().min(1)).optional(),
  sharing_scope: z.enum(["events_only", "events_and_frames"]).optional(),
  redaction_policy: z.record(z.string(), z.boolean()).optional(),
  retention_mode: z.enum(["no_storage", "short_lived", "extended"]).optional(),
  interval_seconds: z.number().int().min(5).max(300).optional(),
  input_mode: z.enum(["frames", "clip", "hybrid"]).optional(),
  enable_prefilter: z.boolean().optional(),
  agent_ids: z.array(z.string()).optional(),
});

function zodError(result: z.ZodError) {
  return {
    error: result.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    code: "VALIDATION_ERROR",
  };
}

export function createSessionRoutes(
  sessionManager: SessionManager,
  trio: TrioClient,
  quotaTracker: QuotaTracker,
  youtubeApiKey: string | null,
): Hono {
  const app = new Hono();

  // --- Validate a YouTube URL ---
  app.post("/validate", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = ValidateUrlSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);
    const { url } = parsed.data;

    // First: YouTube-side validation
    const ytKey = quotaTracker.canAfford(1) ? youtubeApiKey : null;
    const ytResult = await validateYouTubeUrl(url, ytKey);
    if (ytKey) quotaTracker.use(1);

    if (!ytResult.valid) {
      return c.json({ valid: false, error: ytResult.error, code: "INVALID_URL" }, 400);
    }

    // Second: Trio-side validation
    try {
      const trioResult = await trio.validateUrl(url);
      return c.json({
        valid: true,
        video_id: ytResult.video_id,
        is_live: trioResult.is_live ?? ytResult.is_live,
        title: ytResult.title || trioResult.title,
        channel: ytResult.channel || trioResult.channel,
        embeddable: ytResult.embeddable,
        platform: trioResult.platform,
      });
    } catch {
      // Trio validation failed but YouTube validation passed
      return c.json({
        valid: true,
        video_id: ytResult.video_id,
        is_live: ytResult.is_live,
        title: ytResult.title,
        channel: ytResult.channel,
        embeddable: ytResult.embeddable,
        platform: "youtube",
        trio_validation: "unavailable",
      });
    }
  });

  // --- Preview a stream ---
  app.post("/preview", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PreviewSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);
    const { url } = parsed.data;

    try {
      const result = await trio.prepareStream(url);
      return c.json({
        stream_id: result.stream_id,
        embed_url: result.embed_url,
        cached: result.cached,
      });
    } catch {
      // Fallback: generate embed URL from video ID
      const videoId = extractVideoId(url);
      if (videoId) {
        return c.json({
          stream_id: null,
          embed_url: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
          cached: false,
          fallback: true,
        });
      }
      return c.json({ error: "Failed to prepare stream preview", code: "PREVIEW_FAILED" }, 500);
    }
  });

  // --- List condition presets ---
  app.get("/presets", (c) => {
    return c.json({ presets: CONDITION_PRESETS });
  });

  // --- Test a condition (check_once) ---
  app.post("/test-condition", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = TestConditionSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);
    const { url, condition, preset_id, input_mode } = parsed.data;

    let finalCondition: string;
    let finalMode: InputMode = input_mode || "hybrid";

    if (preset_id) {
      const preset = getPreset(preset_id);
      if (!preset) return c.json({ error: "Unknown preset", code: "UNKNOWN_PRESET" }, 400);
      finalCondition = preset.condition;
      finalMode = input_mode || preset.recommended_input_mode;
    } else if (condition) {
      const validationError = validateCondition(condition);
      if (validationError) return c.json({ error: validationError, code: "INVALID_CONDITION" }, 400);
      finalCondition = condition;
    } else {
      return c.json({ error: "condition or preset_id is required", code: "MISSING_CONDITION" }, 400);
    }

    const result = await trio.checkOnce({
      url,
      condition: finalCondition,
      input_mode: finalMode,
    });

    return c.json({
      triggered: result.triggered,
      explanation: result.explanation,
      has_frame: !!result.frame_b64,
    });
  });

  // --- Create a session ---
  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateSessionSchema.safeParse(raw);
    if (!parsed.success) return c.json(zodError(parsed.error), 400);
    const body = parsed.data;

    // Resolve conditions from presets or custom
    const conditions: string[] = [];
    if (body.preset_ids) {
      for (const id of body.preset_ids) {
        const preset = getPreset(id);
        if (!preset) return c.json({ error: `Unknown preset: ${id}`, code: "UNKNOWN_PRESET" }, 400);
        conditions.push(preset.condition);
      }
    }
    if (body.conditions) {
      for (const cond of body.conditions) {
        const err = validateCondition(cond);
        if (err) return c.json({ error: err, code: "INVALID_CONDITION" }, 400);
        conditions.push(cond);
      }
    }
    if (conditions.length === 0) {
      return c.json({ error: "At least one condition or preset_id is required", code: "NO_CONDITIONS" }, 400);
    }

    const sessionId = await sessionManager.createSession({
      stream_url: body.stream_url,
      conditions,
      sharing_scope: body.sharing_scope || "events_only",
      redaction_policy: {
        ...DEFAULT_REDACTION_POLICY,
        ...body.redaction_policy,
      },
      retention_mode: body.retention_mode || "short_lived",
      interval_seconds: body.interval_seconds ?? 30,
      input_mode: body.input_mode ?? "hybrid",
      enable_prefilter: body.enable_prefilter ?? true,
      agent_ids: body.agent_ids || [],
    });

    // Start session (validate URL + start monitoring)
    try {
      await sessionManager.startSession(sessionId);
      const jobId = await sessionManager.startMonitoringJob(sessionId, conditions, {
        interval_seconds: body.interval_seconds,
        input_mode: body.input_mode,
        enable_prefilter: body.enable_prefilter,
      });

      return c.json({ session_id: sessionId, job_id: jobId, state: "live" }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start session";
      return c.json({ session_id: sessionId, state: "error", error: message, code: "SESSION_START_FAILED" }, 400);
    }
  });

  // --- Get session info ---
  app.get("/:id", (c) => {
    const session = sessionManager.getSession(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);

    const jobs = sessionManager.getRunningJobs(session.session_id);
    return c.json({
      ...session,
      active_jobs: jobs.length,
      jobs: jobs.map((j) => ({
        job_id: j.job_id,
        status: j.status,
        restart_count: j.restart_count,
        last_restart_gap_ms: j.last_restart_gap_ms,
      })),
    });
  });

  // --- Pause session ---
  app.post("/:id/pause", async (c) => {
    await sessionManager.pauseSession(c.req.param("id"));
    return c.json({ state: "paused" });
  });

  // --- Stop session ---
  app.post("/:id/stop", async (c) => {
    await sessionManager.stopSession(c.req.param("id"));
    return c.json({ state: "stopped" });
  });

  return app;
}
