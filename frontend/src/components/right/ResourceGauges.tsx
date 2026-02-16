import { useTaskContext } from "../../context/TaskContext";

export function ResourceGauges() {
  const { task } = useTaskContext();

  const activeJobs = task?.active_jobs ?? 0;
  const maxJobs = 10;
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (activeJobs / maxJobs) * circumference;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Resources</div>
      </div>

      <div className="gauge-row">
        <div className="gauge-ring">
          <svg viewBox="0 0 40 40">
            <circle className="gauge-bg" cx="20" cy="20" r={r} />
            <circle
              className="gauge-fg"
              cx="20"
              cy="20"
              r={r}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="gauge-text">{activeJobs}</div>
        </div>
        <div className="gauge-info">
          Trio Jobs<br />
          <span className="gauge-sub">{activeJobs} of {maxJobs} slots used</span>
        </div>
      </div>

      <div className="hash-display">
        <div className="hash-label">Verification Hash</div>
        {task?.verification_hash ? (
          <div className="hash-value">{task.verification_hash}</div>
        ) : (
          <div className="hash-pending">
            Pending &mdash; computed when all checkpoints verified
          </div>
        )}
      </div>
    </div>
  );
}
