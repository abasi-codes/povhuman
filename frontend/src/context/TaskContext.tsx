import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { TaskDetail, VerificationEvent } from "../api/types";
import * as tasksApi from "../api/tasks";
import { useTask } from "../hooks/useTask";
import { useEvents } from "../hooks/useEvents";
import { useToast } from "../components/Toast";

interface TaskContextValue {
  // Task state
  taskId: string | null;
  task: TaskDetail | null;
  taskLoading: boolean;

  // Task creation
  description: string;
  setDescription: (d: string) => void;
  webhookUrl: string;
  setWebhookUrl: (u: string) => void;
  checkpointInputs: Array<{ type: string; target: string }>;
  addCheckpoint: (type: string, target: string) => void;
  removeCheckpoint: (index: number) => void;

  // Actions
  createTask: () => Promise<void>;
  claimTask: (humanId: string) => Promise<void>;
  startTask: () => Promise<void>;
  stopTask: () => Promise<void>;
  createError: string | null;

  // Events
  events: VerificationEvent[];
  eventsLoading: boolean;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast();

  const [taskId, setTaskId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [checkpointInputs, setCheckpointInputs] = useState<Array<{ type: string; target: string }>>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: task, loading: taskLoading } = useTask(taskId);
  const { events, loading: eventsLoading } = useEvents(taskId);

  // Toast on status changes
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!task) return;
    const status = task.status;
    if (prevStatusRef.current && prevStatusRef.current !== status) {
      if (status === "streaming") addToast("success", "Streaming started");
      else if (status === "completed") addToast("success", "Task completed — all checkpoints verified");
      else if (status === "cancelled") addToast("info", "Task cancelled");
    }
    prevStatusRef.current = status;
  }, [task, addToast]);

  const addCheckpoint = useCallback((type: string, target: string) => {
    if (target.trim()) {
      setCheckpointInputs((prev) => [...prev, { type, target: target.trim() }]);
    }
  }, []);

  const removeCheckpoint = useCallback((index: number) => {
    setCheckpointInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const doCreateTask = useCallback(async () => {
    setCreateError(null);
    try {
      const result = await tasksApi.createTask({
        description,
        webhook_url: webhookUrl,
        checkpoints: checkpointInputs,
      });
      setTaskId(result.task_id);
      addToast("success", "Task created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create task";
      setCreateError(msg);
      addToast("error", msg);
    }
  }, [description, webhookUrl, checkpointInputs, addToast]);

  const doClaimTask = useCallback(async (humanId: string) => {
    if (!taskId) return;
    try {
      await tasksApi.claimTask(taskId, humanId);
      addToast("success", "Task claimed");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to claim task");
    }
  }, [taskId, addToast]);

  const doStartTask = useCallback(async () => {
    if (!taskId) return;
    try {
      await tasksApi.startTask(taskId);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to start task");
    }
  }, [taskId, addToast]);

  const doStopTask = useCallback(async () => {
    if (!taskId) return;
    try {
      await tasksApi.stopTask(taskId);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to stop task");
    }
  }, [taskId, addToast]);

  return (
    <TaskContext.Provider
      value={{
        taskId,
        task,
        taskLoading,
        description,
        setDescription,
        webhookUrl,
        setWebhookUrl,
        checkpointInputs,
        addCheckpoint,
        removeCheckpoint,
        createTask: doCreateTask,
        claimTask: doClaimTask,
        startTask: doStartTask,
        stopTask: doStopTask,
        createError,
        events,
        eventsLoading,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTaskContext(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskContext must be used within TaskProvider");
  return ctx;
}
