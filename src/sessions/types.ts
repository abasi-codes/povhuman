import type { InputMode } from "../trio/types.js";

export type SessionState =
  | "created"
  | "validating"
  | "live"
  | "paused"
  | "stopped"
  | "error";

export type SharingScope = "events_only" | "events_and_frames" | "digests";

export interface RedactionPolicy {
  blur_faces: boolean;
  blur_screens: boolean;
  blur_text: boolean;
  block_private_locations: boolean;
}

export interface SessionConfig {
  stream_url: string;
  conditions: string[];
  sharing_scope: SharingScope;
  redaction_policy: RedactionPolicy;
  retention_mode: "no_storage" | "short_lived" | "extended";
  interval_seconds: number;
  input_mode: InputMode;
  enable_prefilter: boolean;
  agent_ids: string[];
}

export interface SessionInfo {
  session_id: string;
  state: SessionState;
  stream_url: string;
  active_jobs: number;
  last_heartbeat: string | null;
  total_triggers: number;
  total_restarts: number;
  created_at: string;
}

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  blur_faces: true,
  blur_screens: false,
  blur_text: false,
  block_private_locations: true,
};
