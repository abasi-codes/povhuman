import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { getTask } from "../api/tasks";
import type { TaskDetail } from "../api/types";

export function useTask(taskId: string | null) {
  const fetchFn = useCallback(
    () => getTask(taskId!),
    [taskId],
  );

  return usePolling<TaskDetail>(fetchFn, 5000, !!taskId);
}
