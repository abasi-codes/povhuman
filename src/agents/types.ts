export interface VerificationEvent {
  event_id: string;
  task_id: string;
  event_type: "checkpoint_verified" | "task_completed" | "task_failed" | "task_started" | "task_cancelled" | "chain_receipt";
  timestamp: string;
  checkpoint_id?: string;
  checkpoint_type?: string;
  checkpoint_target?: string;
  confidence?: number;
  explanation?: string;
  evidence_frame_b64?: string;
  evidence_zg_root?: string;
  verification_hash?: string;
  metadata: Record<string, unknown>;
}

export interface AgentDeliveryResult {
  delivered: boolean;
  status_code?: number;
  error?: string;
}
