import { useTaskContext } from "../../context/TaskContext";

export function ResourceGauges() {
  const { task } = useTaskContext();

  const activeJobs = task?.active_jobs ?? 0;
  const maxJobs = 10;
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (activeJobs / maxJobs) * circumference;

  const checkpointsVerified = task?.checkpoints.filter((cp) => cp.verified).length ?? 0;
  const checkpointsTotal = task?.checkpoints.length ?? 0;
  const progress = checkpointsTotal > 0 ? (checkpointsVerified / checkpointsTotal) * 100 : 0;

  return (
    <div className="card">
      <div className="card-title">Resources</div>

      <div className="usg-section">
        <div className="usg-header">
          <span className="usg-label">Verification Progress</span>
          <span className="usg-value">{checkpointsVerified}/{checkpointsTotal}</span>
        </div>
        <div className="usg-bar">
          <div className="usg-fill blue" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="sg-label" style={{ marginBottom: 10 }}>Trio Concurrent Jobs</div>
        <div className="ring-card">
          <div className="gauge-ring">
            <svg viewBox="0 0 48 48">
              <circle className="gauge-bg" cx="24" cy="24" r="20" />
              <circle
                className="gauge-fg"
                cx="24"
                cy="24"
                r="20"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="gauge-text">{activeJobs}</div>
          </div>
          <div className="gauge-label-text">
            {activeJobs} of {maxJobs} slots used
            <span className="gauge-label-sub">Max concurrent per account</span>
          </div>
        </div>
      </div>

      {task && (
        <div className="session-info-box">
          <div style={{ color: "var(--text2)", marginBottom: 4 }}>
            Task: <span style={{ color: "var(--blue)", fontSize: 12, fontWeight: 600 }}>
              {task.task_id}
            </span>
          </div>
          <div>Status: {task.status}</div>
          <div>Created: {task.created_at}</div>
          {task.verification_hash && (
            <div>Hash: {task.verification_hash.slice(0, 16)}...</div>
          )}
        </div>
      )}
    </div>
  );
}
