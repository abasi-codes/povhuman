import { useTaskContext } from "../../context/TaskContext";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return iso;
  }
}

export function CheckpointProgress() {
  const { task } = useTaskContext();

  if (!task) return null;

  const checkpoints = task.checkpoints;
  const verified = checkpoints.filter((cp) => cp.verified).length;
  const total = checkpoints.length;

  if (total === 0) return null;

  // Find first non-verified checkpoint (the "active" one)
  const firstPendingIndex = checkpoints.findIndex((cp) => !cp.verified);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Checkpoint Progress</div>
        <div className={`panel-badge ${verified === total ? "ok" : "live"}`}>
          {verified}/{total}
        </div>
      </div>
      <div className="pipeline">
        {checkpoints.map((cp, i) => {
          const isVerified = cp.verified;
          const isActive = !isVerified && i === firstPendingIndex;
          const isPending = !isVerified && !isActive;
          const isLast = i === checkpoints.length - 1;

          return (
            <div key={cp.checkpoint_id} className="pipe-item">
              <div className="pipe-track">
                <div
                  className={`pipe-node ${isVerified ? "verified" : isActive ? "active" : "pending"}`}
                >
                  {isVerified ? "\u2713" : isActive ? "\u25CF" : "\u25CB"}
                </div>
                {!isLast && (
                  <div className={`pipe-line ${isVerified ? "done" : ""}`} />
                )}
              </div>
              <div className="pipe-content">
                <div className="pipe-head">
                  <span className={`pipe-type ${cp.type}`}>
                    {cp.type.charAt(0).toUpperCase() + cp.type.slice(1)}
                  </span>
                  <span className="pipe-target">{cp.target}</span>
                </div>
                <div className="pipe-details">
                  {isVerified && cp.confidence != null && (
                    <span className="pipe-conf">
                      {Math.round(cp.confidence * 100)}%
                    </span>
                  )}
                  {isVerified && cp.verified_at && (
                    <span className="pipe-time">{formatTime(cp.verified_at)}</span>
                  )}
                  {isActive && (
                    <span style={{ color: "var(--text4)" }}>
                      Awaiting verification...
                    </span>
                  )}
                  {isPending && (
                    <span style={{ color: "var(--text4)" }}>Pending</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
