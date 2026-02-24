import { Hono } from "hono";
import type { DemoOrchestrator } from "../demo-agents/orchestrator.js";
import { logger } from "../logger.js";

export function createDemoWebhookRoute(orchestrator: DemoOrchestrator): Hono {
  const app = new Hono();

  app.post("/demo", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const eventType = body.event_type as string | undefined;
    const taskId = body.task_id as string | undefined;

    if (!eventType || !taskId) {
      return c.json({ received: false, error: "missing event_type or task_id" }, 400);
    }

    logger.debug({ eventType, taskId }, "Demo webhook received");

    orchestrator.handleWebhookEvent({
      event_type: eventType,
      task_id: taskId,
      metadata: body.metadata,
    });

    return c.json({ received: true });
  });

  return app;
}
