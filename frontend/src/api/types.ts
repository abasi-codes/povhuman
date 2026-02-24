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

export type EscrowStatus = "none" | "deposited" | "released" | "refunded";

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
  title: string;
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
  // Escrow fields
  escrow_lamports: number;
  escrow_status: EscrowStatus;
  agent_wallet: string | null;
  human_wallet: string | null;
  escrow_pda: string | null;
  deposit_signature: string | null;
  release_signature: string | null;
  trust_score: number | null;
  trust_grade: string | null;
  // Agent identity
  agent_name: string;
  agent_avatar: string;
  agent_description: string;
  // Trust breakdown
  trust_breakdown: {
    vlm: number; vlm_weighted: number;
    gps: number; gps_weighted: number;
    attestation: number; attestation_weighted: number;
  } | null;
  trust_flags: string[];
  // Device attestation
  attestation: {
    valid: boolean; device_type: string;
    integrity_level: string; platform: string;
  } | null;
  // GPS reading
  gps_reading: {
    lat: number; lng: number;
    accuracy_m: number; ip_distance_km: number | null;
  } | null;
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
  escrow_lamports?: number;
  agent_wallet?: string;
}

export interface CreateTaskResponse {
  task_id: string;
  status: string;
  stream_url: string;
  escrow_lamports: number;
  escrow_status: EscrowStatus;
  escrow_pda: string | null;
  deposit_signature: string | null;
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

// Agent
export interface Agent {
  agent_id: string;
  name: string;
  description: string;
  avatar: string;
  wallet_address: string | null;
}

// GPS
export interface GpsReading {
  lat: number;
  lng: number;
  accuracy_m: number;
  timestamp?: string;
}

export interface GpsCheckpointConfig {
  lat: number;
  lng: number;
  radius_m: number;
}

// Attestation
export interface AttestationResult {
  valid: boolean;
  device_type: string;
  integrity_level: string;
  trust_score?: TrustScore;
}

export interface TrustScore {
  score: number;
  grade: "A" | "B" | "C" | "F";
  breakdown: {
    vlm: number;
    vlm_weighted: number;
    gps: number;
    gps_weighted: number;
    attestation: number;
    attestation_weighted: number;
  };
  flags: string[];
}
