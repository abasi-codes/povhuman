// --- Trio API Request/Response Types ---

export type InputMode = "frames" | "clip" | "hybrid";

export interface ValidateUrlResponse {
  valid: boolean;
  url: string;
  platform: "youtube" | "twitch" | "rtsp" | string;
  title?: string;
  channel?: string;
  is_live?: boolean;
  viewer_count?: number;
  error?: string;
}

export interface PrepareStreamResponse {
  stream_id: string;
  embed_url: string;
  cached: boolean;
}

export interface LiveMonitorRequest {
  url: string;
  condition: string;
  webhook_url: string;
  interval_seconds?: number; // 5-300, default 30
  input_mode?: InputMode; // default "hybrid"
  clip_duration_seconds?: number; // 1-10
  enable_prefilter?: boolean; // default true
  max_duration_seconds?: number; // auto-stops at 600 (10 min)
}

export interface LiveMonitorResponse {
  job_id: string;
  status: "started" | "error";
  message?: string;
}

export interface LiveDigestRequest {
  url: string;
  prompt?: string;
  webhook_url: string;
  window_minutes?: number; // 1-60
  capture_interval_seconds?: number; // 10-300
  max_duration_seconds?: number;
}

export interface LiveDigestResponse {
  job_id: string;
  status: "started" | "error";
  message?: string;
}

export interface CheckOnceRequest {
  url: string;
  condition: string;
  input_mode?: InputMode;
  clip_duration_seconds?: number;
}

export interface CheckOnceResponse {
  triggered: boolean;
  explanation: string;
  frame_b64?: string;
  confidence?: number;
}

export interface JobStatus {
  job_id: string;
  status: "running" | "stopped" | "error" | "completed";
  stop_reason?: "max_duration_reached" | "stream_offline" | "condition_triggered" | "cancelled" | "error";
  checks_performed?: number;
  triggers_fired?: number;
  frames_skipped?: number;
  started_at?: string;
  stopped_at?: string;
}

// --- Webhook Payload Types ---

export type WebhookEventType =
  | "live_monitor_triggered"
  | "live_digest_ready"
  | "job_status"
  | "job_error";

export interface WebhookPayload {
  event: WebhookEventType;
  job_id: string;
  timestamp: string;
}

export interface MonitorTriggeredPayload extends WebhookPayload {
  event: "live_monitor_triggered";
  explanation: string;
  frame_b64: string;
  condition: string;
  check_number: number;
}

export interface DigestReadyPayload extends WebhookPayload {
  event: "live_digest_ready";
  digest: string;
  window_start: string;
  window_end: string;
  frames_analyzed: number;
}

export interface JobStatusPayload extends WebhookPayload {
  event: "job_status";
  status: JobStatus["status"];
  stop_reason?: JobStatus["stop_reason"];
}

export interface JobErrorPayload extends WebhookPayload {
  event: "job_error";
  error: string;
  recoverable: boolean;
}

export type AnyWebhookPayload =
  | MonitorTriggeredPayload
  | DigestReadyPayload
  | JobStatusPayload
  | JobErrorPayload;
