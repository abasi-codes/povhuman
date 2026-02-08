import pino from "pino";

const SENSITIVE_KEYS = [
  "GOOGLE_API_KEY",
  "OPENCLAW_BEARER_TOKEN",
  "TRIO_WEBHOOK_SECRET",
  "YOUTUBE_API_KEY",
  "authorization",
  "cookie",
];

function redactValue(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  for (const sensitive of SENSITIVE_KEYS) {
    if (key.toLowerCase().includes(sensitive.toLowerCase())) {
      return "[REDACTED]";
    }
  }
  return value;
}

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
  redact: {
    paths: [
      "GOOGLE_API_KEY",
      "OPENCLAW_BEARER_TOKEN",
      "TRIO_WEBHOOK_SECRET",
      "YOUTUBE_API_KEY",
      "*.GOOGLE_API_KEY",
      "*.OPENCLAW_BEARER_TOKEN",
      "*.TRIO_WEBHOOK_SECRET",
      "*.YOUTUBE_API_KEY",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    // Catch-all for any object that might contain secrets
    req: (req) => {
      if (!req) return req;
      const serialized: Record<string, unknown> = {
        method: req.method,
        url: req.url,
      };
      if (req.headers) {
        const headers = { ...req.headers };
        for (const key of Object.keys(headers)) {
          headers[key] = redactValue(key, headers[key]);
        }
        serialized.headers = headers;
      }
      return serialized;
    },
  },
});
