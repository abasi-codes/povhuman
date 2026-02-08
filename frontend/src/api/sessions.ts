import { apiFetch } from "./client";
import type {
  ValidateResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  SessionDetail,
  ConditionPreset,
  TestConditionRequest,
  TestConditionResponse,
} from "./types";

export async function validateUrl(url: string): Promise<ValidateResponse> {
  return apiFetch<ValidateResponse>("/sessions/validate", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function createSession(req: CreateSessionRequest): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return apiFetch<SessionDetail>(`/sessions/${sessionId}`);
}

export async function pauseSession(sessionId: string): Promise<{ state: string }> {
  return apiFetch<{ state: string }>(`/sessions/${sessionId}/pause`, {
    method: "POST",
  });
}

export async function stopSession(sessionId: string): Promise<{ state: string }> {
  return apiFetch<{ state: string }>(`/sessions/${sessionId}/stop`, {
    method: "POST",
  });
}

export async function getPresets(): Promise<{ presets: ConditionPreset[] }> {
  return apiFetch<{ presets: ConditionPreset[] }>("/sessions/presets");
}

export async function testCondition(req: TestConditionRequest): Promise<TestConditionResponse> {
  return apiFetch<TestConditionResponse>("/sessions/test-condition", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
