import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { TrioClient } from "./trio/client.js";
import { initDatabase } from "./db/schema.js";
import { startRetentionWorker } from "./db/retention.js";
import { TaskManager } from "./tasks/manager.js";
import { HeartbeatMonitor } from "./tasks/heartbeat.js";
import { StreamRelay } from "./stream/relay.js";
import { AgentDelivery } from "./agents/delivery.js";
import { EvidenceCaptureService } from "./evidence/capture.js";
import { createWebhookReceiver } from "./webhooks/receiver.js";
import { createTaskRoutes } from "./routes/tasks.js";
import { createBrowseRoutes } from "./routes/browse.js";
import { seedDemoTasks } from "./db/seed.js";
import { createHealthRoutes } from "./routes/health.js";
import { createEventRoutes } from "./routes/events.js";
import { createAgentKeyRoutes } from "./routes/agents.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createMetricsRoutes, incrementCounter } from "./routes/metrics.js";
import { DEFAULT_REDACTION_POLICY } from "./tasks/types.js";
import type { AnyWebhookPayload, MonitorTriggeredPayload, JobStatusPayload } from "./trio/types.js";

// --- Initialize dependencies ---

const db = initDatabase(config.database.path);
const trio = new TrioClient(config.trio.baseUrl, config.googleApiKey);
const streamRelay = new StreamRelay();
const agentDelivery = new AgentDelivery();
const evidenceCapture = new EvidenceCaptureService(
  DEFAULT_REDACTION_POLICY,
  config.redaction.failClosed,
);

const webhookBaseUrl = `http://${config.server.host === "0.0.0.0" ? "localhost" : config.server.host}:${config.server.port}`;

const taskManager = new TaskManager(
  db,
  trio,
  streamRelay,
  agentDelivery,
  evidenceCapture,
  webhookBaseUrl,
);

// --- Seed demo tasks ---
seedDemoTasks(db, taskManager);

// --- Load HTML pages ---
const rootDir = join(import.meta.dirname ?? ".", "..");
const landingHtml = readFileSync(join(rootDir, "landing.html"), "utf-8");
const dashboardHtml = readFileSync(join(rootDir, "dashboard.html"), "utf-8");

// --- Webhook handler: routes Trio events to task manager ---

async function handleWebhook(payload: AnyWebhookPayload): Promise<void> {
  incrementCounter("trio_webhooks_total");
  const taskId = taskManager.findJobTask(payload.job_id);
  if (!taskId) {
    logger.warn({ job_id: payload.job_id }, "Webhook for unknown job");
    return;
  }

  switch (payload.event) {
    case "live_monitor_triggered": {
      const p = payload as MonitorTriggeredPayload;
      await taskManager.handleTrioTrigger(
        payload.job_id,
        p.explanation,
        p.frame_b64 || null,
      );
      incrementCounter("checkpoints_verified_total");
      break;
    }

    case "job_status": {
      const p = payload as JobStatusPayload;
      taskManager.markJobStopped(payload.job_id, p.stop_reason || "unknown");

      if (p.stop_reason === "max_duration_reached") {
        logger.info({ job_id: payload.job_id }, "Job hit 10-min cap, restarting");
        await taskManager.restartJob(payload.job_id);
        incrementCounter("job_restarts_total");
      }
      break;
    }

    case "job_error": {
      const errPayload = payload as { error: string; recoverable: boolean };
      logger.error(
        { job_id: payload.job_id, error: errPayload.error },
        "Trio job error",
      );
      break;
    }
  }
}

// --- Auto-restart handler for heartbeat-detected stops ---

async function handleJobStopped(jobId: string, reason: string): Promise<void> {
  taskManager.markJobStopped(jobId, reason);
  if (reason === "max_duration_reached") {
    await taskManager.restartJob(jobId);
  }
}

// --- Build the app ---

const app = new Hono();

// --- Global middleware ---

app.use("*", securityHeaders());
app.use("*", requestLogger());

app.use(
  "*",
  cors({
    origin: config.server.allowedOrigins.length > 0
      ? config.server.allowedOrigins
      : (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// Rate limiting
app.use("/api/v1/*", rateLimiter(60, 60_000));
app.use("/webhooks/*", rateLimiter(60, 60_000));

// Tighter rate limit on task creation: 10 req/min per IP
app.post("/api/v1/tasks", rateLimiter(10, 60_000));

// Health check
app.route("/health", createHealthRoutes());

// Prometheus metrics
app.route("/metrics", createMetricsRoutes());

// Webhook receiver
app.route(
  "/webhooks",
  createWebhookReceiver(config.trio.webhookSecret, handleWebhook),
);

// Serve landing page and dashboard
app.get("/", (c) => c.html(landingHtml));
app.get("/dashboard", (c) => c.html(dashboardHtml));

// Task management
app.route("/api/v1/tasks", createTaskRoutes(taskManager));

// Event feed (nested under /api/v1/tasks/:id/events)
const eventRoutes = createEventRoutes(taskManager);
app.route("/api/v1/tasks/:id/events", eventRoutes);

// Browse API (human-facing)
app.route("/api/v1/browse", createBrowseRoutes(taskManager, trio));

// Agent key management
app.route("/api/v1/agents", createAgentKeyRoutes(db));

// --- Serve frontend static files (production build) ---
const frontendDist = join(import.meta.dirname ?? ".", "../frontend/dist");
if (existsSync(frontendDist)) {
  app.use("/*", serveStatic({ root: "./frontend/dist" }));
  app.get("*", serveStatic({ root: "./frontend/dist", path: "index.html" }));
}

// --- Start server and background workers ---

const heartbeat = new HeartbeatMonitor(taskManager, trio, handleJobStopped);
heartbeat.start();

const retentionInterval = startRetentionWorker(db);

serve(
  { fetch: app.fetch, port: config.server.port, hostname: config.server.host },
  (info) => {
    logger.info(
      { port: info.port, host: config.server.host },
      "VerifyHuman server started",
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
