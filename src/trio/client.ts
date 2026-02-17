import { logger } from "../logger.js";
import type {
  ValidateUrlResponse,
  PrepareStreamResponse,
  LiveMonitorRequest,
  LiveMonitorResponse,
  LiveDigestRequest,
  LiveDigestResponse,
  CheckOnceRequest,
  CheckOnceResponse,
  JobStatus,
} from "./types.js";

export class TrioClient {
  private baseUrl: string;
  private apiKey: string;
  private authMode: "bearer" | "google";

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "") + "/api";
    this.apiKey = apiKey;
    // Google API keys (AIza prefix) use X-Google-Api-Key header
    // Everything else (Trio dashboard keys, JWTs, etc.) uses Bearer auth
    this.authMode = apiKey.startsWith("AIza") ? "google" : "bearer";
  }

  get hasApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authMode === "bearer") {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    } else {
      headers["X-Google-Api-Key"] = this.apiKey;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error({ status: res.status, url, body: text }, "Trio API error");
      throw new TrioApiError(res.status, text, path);
    }

    return res.json() as Promise<T>;
  }

  async validateUrl(url: string): Promise<ValidateUrlResponse> {
    return this.request<ValidateUrlResponse>(
      "GET",
      `/validate-url?url=${encodeURIComponent(url)}`,
    );
  }

  async prepareStream(url: string): Promise<PrepareStreamResponse> {
    return this.request<PrepareStreamResponse>("POST", "/prepare-stream", {
      url,
    });
  }

  async startLiveMonitor(
    req: LiveMonitorRequest,
  ): Promise<LiveMonitorResponse> {
    return this.request<LiveMonitorResponse>("POST", "/live-monitor", {
      ...req,
      max_duration_seconds: req.max_duration_seconds ?? 600,
    });
  }

  async startLiveDigest(req: LiveDigestRequest): Promise<LiveDigestResponse> {
    return this.request<LiveDigestResponse>("POST", "/live-digest", req);
  }

  async checkOnce(req: CheckOnceRequest): Promise<CheckOnceResponse> {
    return this.request<CheckOnceResponse>("POST", "/check-once", req);
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    return this.request<JobStatus>("GET", `/jobs/${jobId}`);
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.request("POST", `/jobs/${jobId}/cancel`, {});
  }
}

export class TrioApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`Trio API ${path} returned ${status}: ${body}`);
    this.name = "TrioApiError";
  }
}
