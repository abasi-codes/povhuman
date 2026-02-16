import { useMemo } from "react";
import { useTaskContext } from "../../context/TaskContext";

export function StatsCards() {
  const { task, events } = useTaskContext();

  const stats = useMemo(() => {
    const checkpointsVerified = task?.checkpoints.filter((cp) => cp.verified).length ?? 0;
    const checkpointsTotal = task?.checkpoints.length ?? 0;

    let uptimeStr = "\u2014";
    let uptimeUnit = "";
    if (task?.started_at && (task.status === "streaming" || task.status === "verifying")) {
      const started = new Date(task.started_at + "Z").getTime();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      if (elapsed >= 3600) {
        uptimeStr = `${Math.floor(elapsed / 3600)}`;
        uptimeUnit = `h ${Math.floor((elapsed % 3600) / 60)}m`;
      } else {
        uptimeStr = `${Math.floor(elapsed / 60)}`;
        uptimeUnit = `m ${elapsed % 60}s`;
      }
    }

    const restarts = events.filter((e) => e.event_type === "job_restarted").length;

    return { checkpointsVerified, checkpointsTotal, uptimeStr, uptimeUnit, restarts };
  }, [task, events]);

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Verified</div>
          <div className="stat-value green">
            {stats.checkpointsVerified}
            <span className="stat-unit"> / {stats.checkpointsTotal}</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Events</div>
          <div className="stat-value cyan">{events.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Uptime</div>
          <div className="stat-value text">
            {stats.uptimeStr}
            {stats.uptimeUnit && <span className="stat-unit">{stats.uptimeUnit}</span>}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Restarts</div>
          <div className="stat-value amber">{stats.restarts}</div>
        </div>
      </div>
    </div>
  );
}
