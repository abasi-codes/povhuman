import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { TrioClient } from "./trio/client.js";
import { initDatabase } from "./db/schema.js";
import { startRetentionWorker } from "./db/retention.js";
import { SessionManager } from "./sessions/manager.js";
import { HeartbeatMonitor } from "./sessions/heartbeat.js";
import { createWebhookReceiver } from "./webhooks/receiver.js";
import { createSessionRoutes } from "./routes/sessions.js";
import { createHealthRoutes } from "./routes/health.js";
import { createEventRoutes } from "./routes/events.js";
import { createAgentRoutes } from "./routes/agents.js";
import { OpenClawDelivery } from "./openclaw/delivery.js";
import { RedactionMiddleware } from "./privacy/redaction.js";
import { QuotaTracker } from "./youtube/quota.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createMetricsRoutes, incrementCounter } from "./routes/metrics.js";
import type { AnyWebhookPayload, MonitorTriggeredPayload, JobStatusPayload } from "./trio/types.js";
import { DEFAULT_REDACTION_POLICY } from "./sessions/types.js";

// --- Initialize dependencies ---

const db = initDatabase(config.database.path);
const trio = new TrioClient(config.trio.baseUrl, config.googleApiKey);
const quotaTracker = new QuotaTracker();

const webhookBaseUrl = `http://${config.server.host === "0.0.0.0" ? "localhost" : config.server.host}:${config.server.port}`;

const sessionManager = new SessionManager(db, trio, webhookBaseUrl);
const openclawDelivery = new OpenClawDelivery(
  config.openclaw.baseUrl,
  config.openclaw.bearerToken,
);
const redaction = new RedactionMiddleware(
  DEFAULT_REDACTION_POLICY,
  config.redaction.failClosed,
);

// --- Webhook handler: routes Trio events to sessions and OpenClaw ---

async function handleWebhook(payload: AnyWebhookPayload): Promise<void> {
  incrementCounter("trio_webhooks_total");
  const sessionId = sessionManager.findJobSession(payload.job_id);
  if (!sessionId) {
    logger.warn({ job_id: payload.job_id }, "Webhook for unknown job");
    return;
  }

  switch (payload.event) {
    case "live_monitor_triggered": {
      const p = payload as MonitorTriggeredPayload;

      // Run frame through redaction pipeline if configured
      let frameB64: string | null = p.frame_b64;
      if (config.redaction.enabled && frameB64) {
        const result = await redaction.process(frameB64);
        if (result.dropped) {
          logger.info({ sessionId }, "Frame dropped by redaction pipeline");
          frameB64 = null;
        } else {
          frameB64 = result.frame_b64;
        }
      }

      // Record event
      const eventId = sessionManager.recordEvent(
        sessionId,
        payload.job_id,
        "triggered",
        p.explanation,
        frameB64,
        { condition: p.condition, check_number: p.check_number },
      );

      // Deliver to OpenClaw
      const session = sessionManager.getSession(sessionId);
      const includeFrame = session?.sharing_scope === "events_and_frames";
      await openclawDelivery.deliverEvent(
        {
          event_id: eventId,
          session_id: sessionId,
          type: "triggered",
          timestamp: payload.timestamp,
          explanation: p.explanation,
          frame_b64: includeFrame ? frameB64 : null,
          metadata: { condition: p.condition },
        },
        { processing: "now", include_frame: includeFrame },
      );
      incrementCounter("events_delivered_total");
      break;
    }

    case "job_status": {
      const p = payload as JobStatusPayload;
      sessionManager.markJobStopped(payload.job_id, p.stop_reason || "unknown");

      // Auto-restart if the job hit the 10-minute cap
      if (p.stop_reason === "max_duration_reached") {
        logger.info({ job_id: payload.job_id }, "Job hit 10-min cap, restarting");
        await sessionManager.restartJob(payload.job_id);
        incrementCounter("job_restarts_total");
      } else if (p.stop_reason === "stream_offline") {
        sessionManager.recordEvent(
          sessionId,
          payload.job_id,
          "status",
          "Stream went offline",
          null,
        );
      }
      break;
    }

    case "live_digest_ready": {
      sessionManager.recordEvent(
        sessionId,
        payload.job_id,
        "digest",
        (payload as { digest: string }).digest,
        null,
      );

      await openclawDelivery.deliverEvent(
        {
          event_id: `digest-${payload.job_id}-${Date.now()}`,
          session_id: sessionId,
          type: "digest",
          timestamp: payload.timestamp,
          explanation: (payload as { digest: string }).digest,
          frame_b64: null,
          metadata: {},
        },
        { processing: "next-heartbeat", include_frame: false },
      );
      break;
    }

    case "job_error": {
      const errPayload = payload as { error: string; recoverable: boolean };
      sessionManager.recordEvent(
        sessionId,
        payload.job_id,
        "status",
        `Error: ${errPayload.error}`,
        null,
        { recoverable: errPayload.recoverable },
      );
      break;
    }
  }
}

// --- Auto-restart handler for heartbeat-detected stops ---

async function handleJobStopped(jobId: string, reason: string): Promise<void> {
  sessionManager.markJobStopped(jobId, reason);
  if (reason === "max_duration_reached") {
    await sessionManager.restartJob(jobId);
  }
}

// --- Build the app ---

const app = new Hono();

// --- Global middleware ---

// Security headers
app.use("*", securityHeaders());

// Request logging
app.use("*", requestLogger());

// CORS
app.use(
  "*",
  cors({
    origin: config.server.allowedOrigins.length > 0
      ? config.server.allowedOrigins
      : (origin) => origin, // same-origin when no explicit origins configured
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// Rate limiting — general API routes: 60 req/min per IP
app.use("/sessions/*", rateLimiter(60, 60_000));
app.use("/webhooks/*", rateLimiter(60, 60_000));

// Tighter rate limit on session creation: 10 req/min per IP
app.post("/sessions", rateLimiter(10, 60_000));

// Health check
app.route("/health", createHealthRoutes());

// Prometheus metrics
app.route("/metrics", createMetricsRoutes());

// Webhook receiver
app.route(
  "/webhooks",
  createWebhookReceiver(config.trio.webhookSecret, handleWebhook),
);

// Session management
app.route(
  "/sessions",
  createSessionRoutes(
    sessionManager,
    trio,
    quotaTracker,
    config.youtube.apiKey || null,
  ),
);

// Event feed (nested under /sessions/:id/events)
const eventRoutes = createEventRoutes(sessionManager);
app.route("/sessions/:id/events", eventRoutes);

// Agent bindings (nested under /sessions/:id/agents)
const agentRoutes = createAgentRoutes(sessionManager);
app.route("/sessions/:id/agents", agentRoutes);

// --- Serve frontend static files (production build) ---
const frontendDist = join(import.meta.dirname ?? ".", "../frontend/dist");
if (existsSync(frontendDist)) {
  app.use("/*", serveStatic({ root: "./frontend/dist" }));
  // SPA fallback: serve index.html for non-API routes
  app.get("*", serveStatic({ root: "./frontend/dist", path: "index.html" }));
}

// --- Start server and background workers ---

const heartbeat = new HeartbeatMonitor(sessionManager, trio, handleJobStopped);
heartbeat.start();

const retentionInterval = startRetentionWorker(db);

serve(
  { fetch: app.fetch, port: config.server.port, hostname: config.server.host },
  (info) => {
    logger.info(
      { port: info.port, host: config.server.host },
      "World Through My Eyes server started",
    );
  },
);

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Shutting down...");
  heartbeat.stop();
  clearInterval(retentionInterval);
  db.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Shutting down...");
  heartbeat.stop();
  clearInterval(retentionInterval);
  db.close();
  process.exit(0);
});
