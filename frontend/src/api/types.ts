// Session types
export type SessionState = "created" | "validating" | "live" | "paused" | "stopped" | "error";
export type SharingScope = "events_only" | "events_and_frames" | "digests";
export type RetentionMode = "no_storage" | "short_lived" | "extended";
export type InputMode = "frames" | "clip" | "hybrid";

export interface RedactionPolicy {
  blur_faces: boolean;
  blur_screens: boolean;
  blur_text: boolean;
  block_private_locations: boolean;
}

export interface SessionRow {
  session_id: string;
  stream_url: string;
  stream_platform: string;
  state: SessionState;
  sharing_scope: SharingScope;
  redaction_policy: string; // JSON string
  retention_mode: RetentionMode;
  created_at: string;
  updated_at: string;
}

export interface JobInfo {
  job_id: string;
  status: string;
  restart_count: number;
  last_restart_gap_ms: number | null;
}

export interface SessionDetail extends SessionRow {
  active_jobs: number;
  jobs: JobInfo[];
}

// Validate response
export interface ValidateResponse {
  valid: boolean;
  video_id?: string;
  is_live?: boolean;
  title?: string;
  channel?: string;
  embeddable?: boolean;
  platform?: string;
  trio_validation?: string;
  error?: string;
}

// Create session request
export interface CreateSessionRequest {
  stream_url: string;
  conditions?: string[];
  preset_ids?: string[];
  sharing_scope?: SharingScope;
  redaction_policy?: Partial<RedactionPolicy>;
  retention_mode?: RetentionMode;
  interval_seconds?: number;
  input_mode?: InputMode;
  enable_prefilter?: boolean;
  agent_ids?: string[];
}

export interface CreateSessionResponse {
  session_id: string;
  job_id?: string;
  state: string;
  error?: string;
}

// Condition presets
export interface ConditionPreset {
  id: string;
  label: string;
  condition: string;
  recommended_interval: number;
  recommended_input_mode: InputMode;
}

// Events
export interface PerceptionEvent {
  event_id: string;
  session_id: string;
  job_id: string | null;
  type: "triggered" | "status" | "digest" | "heartbeat" | "restart";
  explanation: string | null;
  metadata: string; // JSON string
  created_at: string;
  expires_at: string | null;
}

// Agent bindings
export interface AgentBinding {
  binding_id: string;
  session_id: string;
  agent_id: string;
  permissions: string; // JSON string
  created_at: string;
  revoked_at: string | null;
}

// Test condition
export interface TestConditionRequest {
  url: string;
  condition?: string;
  preset_id?: string;
  input_mode?: InputMode;
}

export interface TestConditionResponse {
  triggered: boolean;
  explanation: string;
  has_frame: boolean;
}
