import { logger } from "../logger.js";

export interface PerceptionEvent {
  event_id: string;
  session_id: string;
  type: "triggered" | "digest" | "status" | "heartbeat" | "restart";
  timestamp: string;
  explanation: string | null;
  frame_b64: string | null;
  metadata: Record<string, unknown>;
}

interface DeliveryOptions {
  /** "now" for immediate processing, "next-heartbeat" for deferred */
  processing: "now" | "next-heartbeat";
  /** Include frame data in the delivery */
  include_frame: boolean;
}

/**
 * Deliver a PerceptionEvent to an OpenClaw agent via webhook.
 *
 * OpenClaw webhook endpoints:
 * - POST /hooks/wake  — Enqueues system events for the main session
 * - POST /hooks/agent — Launches isolated agent sessions
 * - POST /hooks/<name> — Custom mapped endpoints
 */
export class OpenClawDelivery {
  private baseUrl: string;
  private bearerToken: string;

  constructor(baseUrl: string, bearerToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.bearerToken = bearerToken;
  }

  /**
   * Deliver a perception event to OpenClaw's wake hook.
   * Triggered events use "now" processing, digests use "next-heartbeat".
   */
  async deliverEvent(
    event: PerceptionEvent,
    options: DeliveryOptions = { processing: "now", include_frame: false },
  ): Promise<boolean> {
    const payload = {
      type: "perception_event",
      processing: options.processing,
      data: {
        event_id: event.event_id,
        session_id: event.session_id,
        event_type: event.type,
        timestamp: event.timestamp,
        explanation: event.explanation,
        frame: options.include_frame ? event.frame_b64 : undefined,
        metadata: event.metadata,
      },
    };

    return this.postToHook("/hooks/wake", payload);
  }

  /**
   * Launch an isolated agent session for a specific perception event.
   * Used for high-priority triggered events that need immediate agent attention.
   */
  async launchAgentSession(
    event: PerceptionEvent,
    agentConfig: Record<string, unknown> = {},
  ): Promise<boolean> {
    const payload = {
      type: "perception_event",
      processing: "now",
      agent_config: agentConfig,
      data: {
        event_id: event.event_id,
        session_id: event.session_id,
        event_type: event.type,
        timestamp: event.timestamp,
        explanation: event.explanation,
        metadata: event.metadata,
      },
    };

    return this.postToHook("/hooks/agent", payload);
  }

  private async postToHook(
    path: string,
    payload: unknown,
  ): Promise<boolean> {
    if (!this.baseUrl) {
      logger.debug("OpenClaw delivery skipped: no base URL configured");
      return false;
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        logger.warn(
          { status: res.status, path },
          "OpenClaw delivery failed",
        );
        return false;
      }

      logger.debug({ path }, "OpenClaw delivery succeeded");
      return true;
    } catch (err) {
      logger.error({ err, path }, "OpenClaw delivery error");
      return false;
    }
  }
}
