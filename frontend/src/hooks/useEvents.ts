import { useState, useEffect, useRef, useCallback } from "react";
import { getEvents } from "../api/events";
import type { PerceptionEvent } from "../api/types";

const MAX_EVENTS = 100;

export function useEvents(sessionId: string | null, intervalMs = 3000) {
  const [events, setEvents] = useState<PerceptionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());

  const doFetch = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const { events: newEvents } = await getEvents(sessionId, 50);

      setEvents((prev) => {
        const merged = [...prev];
        for (const evt of newEvents) {
          if (!seenIds.current.has(evt.event_id)) {
            seenIds.current.add(evt.event_id);
            merged.push(evt);
          }
        }
        // Sort descending by created_at
        merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
        // Keep latest MAX_EVENTS
        return merged.slice(0, MAX_EVENTS);
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    // Reset on session change
    setEvents([]);
    seenIds.current.clear();

    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => clearInterval(id);
  }, [sessionId, intervalMs, doFetch]);

  return { events, loading, error, refresh: doFetch };
}
