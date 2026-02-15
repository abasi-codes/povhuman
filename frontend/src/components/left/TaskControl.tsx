import { useTaskContext } from "../../context/TaskContext";

export function TaskControl() {
  const {
    task, taskId,
    createTask, startTask, stopTask,
    description, webhookUrl, checkpointInputs,
    createError,
  } = useTaskContext();

  const canCreate = !taskId && description.trim() && webhookUrl.trim() && checkpointInputs.length > 0;
  const canStart = task && (task.status === "awaiting_stream" || task.status === "pending");
  const canStop = task && (task.status === "streaming" || task.status === "verifying");

  return (
    <div className="card">
      <div className="card-title">Task Control</div>

      {!taskId && (
        <button className="btn btn-blue btn-full" onClick={createTask} disabled={!canCreate}>
          Create Task
        </button>
      )}

      {taskId && canStart && (
        <button className="btn btn-blue btn-full" onClick={startTask}>
          Start Streaming
        </button>
      )}

      {taskId && canStop && (
        <button className="btn btn-red btn-full" onClick={stopTask}>
          Cancel Task
        </button>
      )}

      {task?.status === "completed" && (
        <div className="task-status-badge completed">
          All checkpoints verified
        </div>
      )}

      {task?.status === "cancelled" && (
        <div className="task-status-badge cancelled">
          Task cancelled
        </div>
      )}

      {createError && (
        <div className="error-msg">{createError}</div>
      )}
    </div>
  );
}
