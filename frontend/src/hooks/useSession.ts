import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { getSession } from "../api/sessions";
import type { SessionDetail } from "../api/types";

export function useSession(sessionId: string | null) {
  const fetchFn = useCallback(
    () => getSession(sessionId!),
    [sessionId],
  );

  return usePolling<SessionDetail>(fetchFn, 5000, !!sessionId);
}
