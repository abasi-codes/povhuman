import { logger } from "../logger.js";

/**
 * Policy gateway for OpenClaw agent access control.
 *
 * Enforces least-privilege: agents never get raw stream URLs,
 * only receive artifacts matching their permission scope,
 * and all sensitive operations require explicit confirmation.
 */

export interface AgentPermissions {
  events: boolean;
  frames_on_trigger: boolean;
  digests: boolean;
}

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  redacted_fields: string[];
}

/**
 * Evaluate whether an agent action is permitted.
 */
export function evaluatePolicy(
  action: string,
  permissions: AgentPermissions,
  payload: Record<string, unknown>,
): PolicyDecision {
  // Never expose raw stream URLs
  if ("stream_url" in payload || "url" in payload) {
    return {
      allow: false,
      reason: "Raw stream URLs are not exposed to agents",
      redacted_fields: ["stream_url", "url"],
    };
  }

  // Check event type permissions
  if (action === "receive_event") {
    if (!permissions.events) {
      return {
        allow: false,
        reason: "Agent does not have event permission",
        redacted_fields: [],
      };
    }
  }

  if (action === "receive_frame") {
    if (!permissions.frames_on_trigger) {
      return {
        allow: false,
        reason: "Agent does not have frame permission",
        redacted_fields: ["frame_b64"],
      };
    }
  }

  if (action === "receive_digest") {
    if (!permissions.digests) {
      return {
        allow: false,
        reason: "Agent does not have digest permission",
        redacted_fields: [],
      };
    }
  }

  return { allow: true, reason: "Permitted", redacted_fields: [] };
}

/**
 * Strip restricted fields from a payload before delivery to an agent.
 */
export function redactPayload(
  payload: Record<string, unknown>,
  fieldsToRedact: string[],
): Record<string, unknown> {
  const cleaned = { ...payload };
  for (const field of fieldsToRedact) {
    delete cleaned[field];
  }
  // Always strip these regardless
  delete cleaned["stream_url"];
  delete cleaned["url"];
  delete cleaned["google_api_key"];
  return cleaned;
}

/**
 * Actions that require explicit user confirmation per AGENTS.md rules.
 */
export const CONFIRMATION_REQUIRED_ACTIONS = [
  "start_monitoring",
  "stop_monitoring",
  "change_conditions",
  "bind_agent",
  "revoke_agent",
] as const;

export function requiresConfirmation(action: string): boolean {
  return (CONFIRMATION_REQUIRED_ACTIONS as readonly string[]).includes(action);
}
