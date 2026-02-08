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
  googleApiKey: required("GOOGLE_API_KEY"),

  trio: {
    baseUrl: optional("TRIO_BASE_URL", "https://trio.machinefi.com"),
    mcpUrl: optional("TRIO_MCP_URL", "https://trio.machinefi.com/mcp/"),
    webhookSecret: process.env.TRIO_WEBHOOK_SECRET || "",
  },

  openclaw: {
    baseUrl: process.env.OPENCLAW_BASE_URL || "",
    bearerToken: process.env.OPENCLAW_BEARER_TOKEN || "",
  },

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || "",
  },

  server: {
    port: parseInt(optional("PORT", "3000"), 10),
    host: optional("HOST", "0.0.0.0"),
    logLevel: optional("LOG_LEVEL", "info"),
  },

  database: {
    path: optional("DATABASE_PATH", "./data/wtme.db"),
  },

  redaction: {
    enabled: optional("REDACTION_ENABLED", "true") === "true",
    failClosed: optional("REDACTION_FAIL_CLOSED", "true") === "true",
  },

  session: {
    defaultIntervalSeconds: parseInt(optional("DEFAULT_INTERVAL_SECONDS", "30"), 10),
    defaultInputMode: optional("DEFAULT_INPUT_MODE", "hybrid") as "frames" | "clip" | "hybrid",
    defaultPrefilter: optional("DEFAULT_PREFILTER", "true") === "true",
    maxConcurrentJobs: parseInt(optional("MAX_CONCURRENT_JOBS", "10"), 10),
    jobRestartGapTargetMs: parseInt(optional("JOB_RESTART_GAP_TARGET_MS", "2000"), 10),
  },

  retention: {
    eventHours: parseInt(optional("EVENT_RETENTION_HOURS", "24"), 10),
    frameMinutes: parseInt(optional("FRAME_RETENTION_MINUTES", "15"), 10),
  },
} as const;
