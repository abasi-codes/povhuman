import type { VerificationEvent } from "./types.js";

/**
 * Policy gateway for agent access control.
 * Strips sensitive fields before delivery.
 */

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  redacted_fields: string[];
}

/**
 * Strip sensitive fields from an event payload before delivery.
 * Agents never get raw stream URLs.
 */
export function sanitizeEventForDelivery(
  event: VerificationEvent,
  includeEvidence: boolean,
): VerificationEvent {
  const sanitized = { ...event };

  // Never include raw evidence frames unless explicitly allowed
  if (!includeEvidence) {
    delete sanitized.evidence_frame_b64;
  }

  // Strip any stream URLs from metadata
  if (sanitized.metadata) {
    const cleaned = { ...sanitized.metadata };
    delete cleaned["stream_url"];
    delete cleaned["rtsp_url"];
    delete cleaned["google_api_key"];
    sanitized.metadata = cleaned;
  }

  return sanitized;
}

/**
 * Actions that require explicit confirmation per AGENTS.md rules.
 */
export const CONFIRMATION_REQUIRED_ACTIONS = [
  "create_task",
  "cancel_task",
  "start_streaming",
  "revoke_key",
] as const;

export function requiresConfirmation(action: string): boolean {
  return (CONFIRMATION_REQUIRED_ACTIONS as readonly string[]).includes(action);
}
