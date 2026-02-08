import { createHmac } from "node:crypto";
import { initDatabase } from "./db/schema.js";
import type { SessionConfig } from "./sessions/types.js";
import type { AnyWebhookPayload, MonitorTriggeredPayload, DigestReadyPayload, JobStatusPayload, JobErrorPayload } from "./trio/types.js";

/**
 * Create an in-memory SQLite database for tests.
 */
export function createTestDb() {
  return initDatabase(":memory:");
}

/**
 * Queue-based fetch stub. Enqueue responses, they are consumed in order.
 */
export function mockFetch(
  responses: Array<{ ok: boolean; status?: number; body?: unknown; text?: string }>,
) {
  const queue = [...responses];
  const fn = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("mockFetch: no more queued responses");
    return {
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 500),
      json: async () => next.body,
      text: async () => next.text ?? JSON.stringify(next.body ?? ""),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/**
 * Create a mock TrioClient with all 7 methods as vi.fn().
 */
export function createMockTrioClient(overrides: Record<string, unknown> = {}) {
  return {
    validateUrl: vi.fn().mockResolvedValue({ valid: true, is_live: true, url: "", platform: "youtube" }),
    prepareStream: vi.fn().mockResolvedValue({ stream_id: "s1", embed_url: "http://e", cached: false }),
    startLiveMonitor: vi.fn().mockResolvedValue({ job_id: "job-1", status: "started" }),
    startLiveDigest: vi.fn().mockResolvedValue({ job_id: "job-2", status: "started" }),
    checkOnce: vi.fn().mockResolvedValue({ triggered: false, explanation: "nothing" }),
    getJobStatus: vi.fn().mockResolvedValue({ job_id: "job-1", status: "running" }),
    cancelJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Build a webhook payload of a given type.
 */
export function buildWebhookPayload(
  type: "monitor_triggered" | "digest_ready" | "job_status" | "job_error",
  overrides: Record<string, unknown> = {},
): AnyWebhookPayload {
  const base = {
    job_id: "job-abc",
    timestamp: "2025-01-01T00:00:00Z",
  };

  if (type === "monitor_triggered") {
    return {
      ...base,
      event: "live_monitor_triggered",
      explanation: "person detected",
      frame_b64: "base64data",
      condition: "Is there a person?",
      check_number: 1,
      ...overrides,
    } as MonitorTriggeredPayload;
  }
  if (type === "digest_ready") {
    return {
      ...base,
      event: "live_digest_ready",
      digest: "Summary of the last 5 minutes",
      window_start: "2025-01-01T00:00:00Z",
      window_end: "2025-01-01T00:05:00Z",
      frames_analyzed: 10,
      ...overrides,
    } as DigestReadyPayload;
  }
  if (type === "job_status") {
    return {
      ...base,
      event: "job_status",
      status: "stopped",
      stop_reason: "max_duration_reached",
      ...overrides,
    } as JobStatusPayload;
  }
  // job_error
  return {
    ...base,
    event: "job_error",
    error: "Stream went offline",
    recoverable: true,
    ...overrides,
  } as JobErrorPayload;
}

/**
 * Build a SessionConfig for tests.
 */
export function buildSessionConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    conditions: ["Is there a person visible?"],
    sharing_scope: "events_only",
    redaction_policy: {
      blur_faces: true,
      blur_screens: false,
      blur_text: false,
      block_private_locations: true,
    },
    retention_mode: "short_lived",
    interval_seconds: 30,
    input_mode: "hybrid",
    enable_prefilter: true,
    agent_ids: ["agent-1"],
    ...overrides,
  };
}

/**
 * HMAC-SHA256 signer for webhook tests. Returns "sha256=<hex>" format.
 */
export function signPayload(body: string, secret: string): string {
  const hex = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hex}`;
}
