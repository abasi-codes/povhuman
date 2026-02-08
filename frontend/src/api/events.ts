import { apiFetch } from "./client";
import type { PerceptionEvent } from "./types";

export async function getEvents(
  sessionId: string,
  limit = 50,
  types?: string[],
): Promise<{ events: PerceptionEvent[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (types && types.length > 0) {
    params.set("types", types.join(","));
  }
  return apiFetch<{ events: PerceptionEvent[] }>(
    `/sessions/${sessionId}/events?${params}`,
  );
}

export async function getFrame(
  sessionId: string,
  eventId: string,
): Promise<{ event_id: string; frame_b64: string }> {
  return apiFetch<{ event_id: string; frame_b64: string }>(
    `/sessions/${sessionId}/events/${eventId}/frame`,
  );
}
