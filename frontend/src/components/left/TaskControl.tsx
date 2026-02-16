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

  if (!taskId) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-label">Task Control</div>
        </div>
        <button
          className="btn btn-green"
          style={{ width: "100%" }}
          onClick={createTask}
          disabled={!canCreate}
        >
          Create Task
        </button>
        {createError && <div className="error-text">{createError}</div>}
      </div>
    );
  }

  const statusClass = task?.status || "pending";

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Task Control</div>
        {task && (task.status === "streaming" || task.status === "verifying") && (
          <div className="panel-badge live">Active</div>
        )}
        {task?.status === "completed" && (
          <div className="panel-badge ok">Done</div>
        )}
      </div>

      <div className={`task-state ${statusClass}`}>
        <div>
          <div className="task-state-label">State</div>
          <div className="task-state-value">
            {task?.status
              ? task.status.charAt(0).toUpperCase() + task.status.slice(1).replace("_", " ")
              : "Pending"}
          </div>
        </div>
      </div>

      <div className="task-meta">
        <div className="meta-box">
          <div className="meta-label">Task ID</div>
          <div className="meta-value">{task?.task_id || taskId}</div>
        </div>
        <div className="meta-box">
          <div className="meta-label">Human</div>
          <div className="meta-value">{task?.human_id || "--"}</div>
        </div>
        {task?.stream_url && (
          <div className="meta-box" style={{ gridColumn: "1 / -1" }}>
            <div className="meta-label">Stream URL</div>
            <div className="meta-value">{task.stream_url}</div>
          </div>
        )}
      </div>

      <div className="task-actions">
        {canStart && (
          <button className="btn btn-green" onClick={startTask}>
            Start
          </button>
        )}
        {canStop && (
          <button className="btn btn-red" onClick={stopTask}>
            Cancel Task
          </button>
        )}
        {task?.status === "completed" && (
          <button className="btn" disabled>
            Completed
          </button>
        )}
        {task?.status === "cancelled" && (
          <button className="btn" disabled>
            Cancelled
          </button>
        )}
      </div>

      {createError && <div className="error-text">{createError}</div>}
    </div>
  );
}
