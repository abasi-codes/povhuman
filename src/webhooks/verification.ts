import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Trio webhook signature (HMAC-SHA256 via X-Trio-Signature header).
 * Returns true if valid, false otherwise.
 * If no secret is configured, skips verification (logs warning).
 */
export function verifyTrioSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!secret) return true; // no secret configured, skip

  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  // Prefix format may be "sha256=<hex>" or just "<hex>"
  const provided = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;

  if (expected.length !== provided.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
