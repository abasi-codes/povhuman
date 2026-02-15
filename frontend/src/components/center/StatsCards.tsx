import { useMemo } from "react";
import { useTaskContext } from "../../context/TaskContext";

export function StatsCards() {
  const { task, events } = useTaskContext();

  const stats = useMemo(() => {
    const checkpointsVerified = task?.checkpoints.filter((cp) => cp.verified).length ?? 0;
    const checkpointsTotal = task?.checkpoints.length ?? 0;

    // Uptime
    let uptimeStr = "\u2014";
    if (task?.started_at && (task.status === "streaming" || task.status === "verifying")) {
      const started = new Date(task.started_at + "Z").getTime();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      if (elapsed >= 3600) {
        uptimeStr = `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
      } else {
        uptimeStr = `${Math.floor(elapsed / 60)}m`;
      }
    }

    const restarts = events.filter((e) => e.event_type === "job_restarted").length;

    return { checkpointsVerified, checkpointsTotal, uptimeStr, restarts };
  }, [task, events]);

  return (
    <div className="stats-row">
      <div className="stat">
        <div className="stat-icon blue">&#x2705;</div>
        <div>
          <div className="stat-label">Checkpoints</div>
          <div className="stat-num">{stats.checkpointsVerified}/{stats.checkpointsTotal}</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon green">&#x26A1;</div>
        <div>
          <div className="stat-label">Events</div>
          <div className="stat-num">{events.length}</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon amber">&#x23F1;</div>
        <div>
          <div className="stat-label">Uptime</div>
          <div className="stat-num">{stats.uptimeStr}</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon purple">&#x1F504;</div>
        <div>
          <div className="stat-label">Restarts</div>
          <div className="stat-num">{stats.restarts}</div>
        </div>
      </div>
    </div>
  );
}
