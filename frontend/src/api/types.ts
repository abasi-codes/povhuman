// Task types
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

export interface CheckpointInfo {
  checkpoint_id: string;
  type: string;
  target: string;
  description: string | null;
  confidence_threshold: number;
  required: boolean;
  ordering: number;
  verified: boolean;
  verified_at: string | null;
  confidence: number | null;
  evidence_explanation: string | null;
  evidence_zg_root: string | null;
}

export interface JobInfo {
  job_id: string;
  status: string;
  restart_count: number;
  last_restart_gap_ms: number | null;
}

export interface TaskDetail {
  task_id: string;
  agent_id: string;
  description: string;
  status: TaskStatus;
  stream_url: string | null;
  human_id: string | null;
  verification_hash: string | null;
  tx_hash: string | null;
  max_duration_seconds: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  checkpoints: CheckpointInfo[];
  active_jobs: number;
  jobs: JobInfo[];
}

// Create task
export interface CreateTaskRequest {
  description: string;
  webhook_url: string;
  checkpoints: Array<{
    type: string;
    target: string;
    description?: string;
    confidence_threshold?: number;
    required?: boolean;
    ordering?: number;
  }>;
  redaction_policy?: RedactionPolicy;
  max_duration_seconds?: number;
}

export interface CreateTaskResponse {
  task_id: string;
  status: string;
  stream_url: string;
  checkpoints: Array<{
    checkpoint_id: string;
    type: string;
    target: string;
    required: boolean;
    ordering: number;
  }>;
}

// Events
export interface VerificationEvent {
  event_id: string;
  task_id: string;
  job_id: string | null;
  checkpoint_id: string | null;
  event_type: string;
  confidence: number | null;
  explanation: string | null;
  metadata: string; // JSON string
  created_at: string;
  expires_at: string | null;
}

// Agent keys
export interface AgentKey {
  key_id: string;
  agent_id: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
}
