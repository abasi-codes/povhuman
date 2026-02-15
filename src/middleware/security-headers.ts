import type { Context, Next } from "hono";

/**
 * Adds security headers (Helmet-style) to every response.
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "0");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    c.header("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  };
}
