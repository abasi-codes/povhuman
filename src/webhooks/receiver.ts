import { Hono } from "hono";
import { logger } from "../logger.js";
import { verifyTrioSignature } from "./verification.js";
import { IdempotencyTracker } from "./idempotency.js";
import type { AnyWebhookPayload } from "../trio/types.js";

export type WebhookHandler = (payload: AnyWebhookPayload) => Promise<void>;

/**
 * Creates the webhook receiver router.
 *
 * Design: respond 200 immediately (within Trio's 5-second window),
 * then process the event asynchronously in the background.
 */
export function createWebhookReceiver(
  webhookSecret: string,
  handler: WebhookHandler,
): Hono {
  const app = new Hono();
  const tracker = new IdempotencyTracker();

  app.post("/trio", async (c) => {
    const rawBody = await c.req.text();

    // Verify HMAC signature
    const signature = c.req.header("X-Trio-Signature");
    if (!verifyTrioSignature(rawBody, signature, webhookSecret)) {
      logger.warn("Webhook signature verification failed");
      return c.json({ error: "Invalid signature" }, 401);
    }

    let payload: AnyWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as AnyWebhookPayload;
    } catch {
      logger.warn("Webhook payload parse error");
      return c.json({ error: "Invalid JSON" }, 400);
    }

    // Check idempotency - respond 200 for duplicates too
    const dedupKey = IdempotencyTracker.keyFrom(
      payload.job_id,
      payload.event,
      payload.timestamp,
    );
    if (tracker.isDuplicate(dedupKey)) {
      logger.debug({ dedupKey }, "Duplicate webhook, skipping");
      return c.json({ status: "duplicate" }, 200);
    }

    // Respond immediately (within 5s requirement), process async
    logger.info(
      { event: payload.event, job_id: payload.job_id },
      "Webhook received",
    );

    // Fire and forget - errors are logged inside the handler
    handler(payload).catch((err) => {
      logger.error({ err, event: payload.event }, "Webhook handler error");
    });

    return c.json({ status: "accepted" }, 200);
  });

  return app;
}
