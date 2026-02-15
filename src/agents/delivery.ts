import { logger } from "../logger.js";
import type { VerificationEvent, AgentDeliveryResult } from "./types.js";

/**
 * Deliver verification events to agent webhook URLs.
 * Agents receive structured events at the webhook_url they specified on task creation.
 */
export class AgentDelivery {
  /**
   * POST a verification event to the agent's webhook URL.
   */
  async deliverEvent(
    webhookUrl: string,
    event: VerificationEvent,
  ): Promise<AgentDeliveryResult> {
    if (!webhookUrl) {
      logger.debug("Agent delivery skipped: no webhook URL");
      return { delivered: false, error: "No webhook URL" };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VerifyHuman-Event": event.event_type,
        },
        body: JSON.stringify({
          event_id: event.event_id,
          task_id: event.task_id,
          event_type: event.event_type,
          timestamp: event.timestamp,
          checkpoint_id: event.checkpoint_id,
          checkpoint_type: event.checkpoint_type,
          checkpoint_target: event.checkpoint_target,
          confidence: event.confidence,
          explanation: event.explanation,
          verification_hash: event.verification_hash,
          metadata: event.metadata,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        logger.warn(
          { status: res.status, webhookUrl },
          "Agent delivery failed",
        );
        return { delivered: false, status_code: res.status };
      }

      logger.debug({ webhookUrl, eventType: event.event_type }, "Agent delivery succeeded");
      return { delivered: true, status_code: res.status };
    } catch (err) {
      logger.error({ err, webhookUrl }, "Agent delivery error");
      return {
        delivered: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
