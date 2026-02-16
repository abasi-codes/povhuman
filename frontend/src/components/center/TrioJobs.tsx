import { useTaskContext } from "../../context/TaskContext";

export function TrioJobs() {
  const { task } = useTaskContext();

  if (!task || !task.jobs || task.jobs.length === 0) return null;

  const activeCount = task.jobs.filter((j) => j.status === "running").length;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Trio Jobs</div>
        <div className="panel-badge live">{activeCount} Active</div>
      </div>
      <table className="jobs-table">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Status</th>
            <th>Restarts</th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>
          {task.jobs.map((job) => (
            <tr key={job.job_id}>
              <td style={{ color: "var(--text)" }}>{job.job_id}</td>
              <td>
                <span className={`job-status ${job.status}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
              </td>
              <td>{job.restart_count}</td>
              <td>
                {job.last_restart_gap_ms != null
                  ? `${job.last_restart_gap_ms}ms`
                  : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
