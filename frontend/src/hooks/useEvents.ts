import { useState, useEffect, useRef, useCallback } from "react";
import { getEvents } from "../api/events";
import type { VerificationEvent } from "../api/types";

const MAX_EVENTS = 100;

export function useEvents(taskId: string | null, intervalMs = 3000) {
  const [events, setEvents] = useState<VerificationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());

  const doFetch = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const { events: newEvents } = await getEvents(taskId, 50);

      setEvents((prev) => {
        const merged = [...prev];
        for (const evt of newEvents) {
          if (!seenIds.current.has(evt.event_id)) {
            seenIds.current.add(evt.event_id);
            merged.push(evt);
          }
        }
        merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
        return merged.slice(0, MAX_EVENTS);
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    setEvents([]);
    seenIds.current.clear();

    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => clearInterval(id);
  }, [taskId, intervalMs, doFetch]);

  return { events, loading, error, refresh: doFetch };
}
