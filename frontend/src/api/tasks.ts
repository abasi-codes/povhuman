import { apiFetch } from "./client";
import type {
  CreateTaskRequest,
  CreateTaskResponse,
  TaskDetail,
  CheckpointInfo,
} from "./types";

export async function createTask(req: CreateTaskRequest): Promise<CreateTaskResponse> {
  return apiFetch<CreateTaskResponse>("/api/v1/tasks", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  return apiFetch<TaskDetail>(`/api/v1/tasks/${taskId}`);
}

export async function claimTask(taskId: string, humanId: string): Promise<{ task_id: string; status: string; stream_url: string }> {
  return apiFetch(`/api/v1/tasks/${taskId}/claim`, {
    method: "POST",
    body: JSON.stringify({ human_id: humanId }),
  });
}

export async function startTask(taskId: string): Promise<{ task_id: string; job_id: string; status: string }> {
  return apiFetch(`/api/v1/tasks/${taskId}/start`, {
    method: "POST",
  });
}

export async function stopTask(taskId: string): Promise<{ task_id: string; status: string }> {
  return apiFetch(`/api/v1/tasks/${taskId}/stop`, {
    method: "POST",
  });
}

export async function getCheckpoints(taskId: string): Promise<{ checkpoints: CheckpointInfo[] }> {
  return apiFetch(`/api/v1/tasks/${taskId}/checkpoints`);
}
