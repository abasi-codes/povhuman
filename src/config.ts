import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  googleApiKey: optional("GOOGLE_API_KEY", ""),

  trio: {
    baseUrl: optional("TRIO_BASE_URL", "https://trio.machinefi.com"),
    mcpUrl: optional("TRIO_MCP_URL", "https://trio.machinefi.com/mcp/"),
    webhookSecret: process.env.TRIO_WEBHOOK_SECRET || "",
  },

  server: {
    port: parseInt(optional("PORT", "3000"), 10),
    host: optional("HOST", "0.0.0.0"),
    logLevel: optional("LOG_LEVEL", "info"),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  database: {
    path: optional("DATABASE_PATH", "./data/proofstream.db"),
  },

  redaction: {
    enabled: optional("REDACTION_ENABLED", "true") === "true",
    failClosed: optional("REDACTION_FAIL_CLOSED", "true") === "true",
  },

  task: {
    defaultIntervalSeconds: parseInt(optional("DEFAULT_INTERVAL_SECONDS", "15"), 10),
    defaultInputMode: optional("DEFAULT_INPUT_MODE", "frames") as "frames" | "clip" | "hybrid",
    defaultPrefilter: optional("DEFAULT_PREFILTER", "true") === "true",
    maxConcurrentJobs: parseInt(optional("MAX_CONCURRENT_JOBS", "10"), 10),
    jobRestartGapTargetMs: parseInt(optional("JOB_RESTART_GAP_TARGET_MS", "2000"), 10),
    defaultMaxDurationSeconds: parseInt(optional("DEFAULT_MAX_DURATION_SECONDS", "3600"), 10),
  },

  retention: {
    eventHours: parseInt(optional("EVENT_RETENTION_HOURS", "72"), 10),
    frameMinutes: parseInt(optional("FRAME_RETENTION_MINUTES", "60"), 10),
  },
} as const;
