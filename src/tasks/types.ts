export type TaskStatus =
  | "pending"
  | "awaiting_stream"
  | "streaming"
  | "verifying"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

export interface RedactionPolicy {
  blur_faces: boolean;
  blur_text: boolean;
}

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  blur_faces: true,
  blur_text: false,
};

export interface CheckpointConfig {
  type: string;
  target: string;
  description?: string;
  confidence_threshold?: number;
  required?: boolean;
  ordering?: number;
}

export interface TaskConfig {
  agent_id: string;
  description: string;
  title?: string;
  payout_cents?: number;
  webhook_url: string;
  checkpoints: CheckpointConfig[];
  redaction_policy?: RedactionPolicy;
  max_duration_seconds?: number;
}

export interface TaskInfo {
  task_id: string;
  agent_id: string;
  description: string;
  status: TaskStatus;
  stream_url: string | null;
  human_id: string | null;
  checkpoints_total: number;
  checkpoints_verified: number;
  verification_hash: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}
