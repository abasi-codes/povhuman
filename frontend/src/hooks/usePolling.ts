import { useState, useEffect, useRef, useCallback } from "react";

interface UsePollingResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const doFetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, doFetch]);

  return { data, loading, error, refresh: doFetch };
}
