import { useSessionContext } from "../../context/SessionContext";

export function ResourceGauges() {
  const { session } = useSessionContext();

  const activeJobs = session?.active_jobs ?? 0;
  const maxJobs = 10;
  const circumference = 2 * Math.PI * 20; // r=20
  const offset = circumference - (activeJobs / maxJobs) * circumference;

  return (
    <div className="card">
      <div className="card-title">Resources</div>

      <div className="usg-section">
        <div className="usg-header">
          <span className="usg-label">YouTube API Quota</span>
          <span className="usg-value">Remaining</span>
        </div>
        <div className="usg-bar">
          <div className="usg-fill blue" style={{ width: "88%" }} />
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

      {session && (
        <div className="session-info-box">
          <div style={{ color: "var(--text2)", marginBottom: 4 }}>
            Session: <span style={{ color: "var(--blue)", fontSize: 12, fontWeight: 600 }}>
              {session.session_id}
            </span>
          </div>
          <div>Started: {session.created_at}</div>
          <div>Retention: {session.retention_mode}</div>
        </div>
      )}
    </div>
  );
}
