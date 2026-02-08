import type { Context, Next } from "hono";
import { logger } from "../logger.js";

/**
 * Logs method, path, status, and duration for every request.
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    const level = c.res.status >= 500 ? "error" : c.res.status >= 400 ? "warn" : "info";
    logger[level](
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration_ms: duration,
      },
      `${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`,
    );
  };
}
