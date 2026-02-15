import { apiFetch } from "./client";
import type { VerificationEvent } from "./types";

export async function getEvents(
  taskId: string,
  limit = 50,
): Promise<{ events: VerificationEvent[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiFetch<{ events: VerificationEvent[] }>(
    `/api/v1/tasks/${taskId}/events?${params}`,
  );
}

export async function getFrame(
  taskId: string,
  eventId: string,
): Promise<{ event_id: string; frame_b64: string }> {
  return apiFetch<{ event_id: string; frame_b64: string }>(
    `/api/v1/tasks/${taskId}/events/${eventId}/frame`,
  );
}
