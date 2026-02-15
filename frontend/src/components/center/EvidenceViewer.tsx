import { useTaskContext } from "../../context/TaskContext";

export function EvidenceViewer() {
  const { task } = useTaskContext();

  if (!task) return null;

  const verifiedCheckpoints = task.checkpoints.filter((cp) => cp.verified);

  if (verifiedCheckpoints.length === 0) {
    return (
      <div className="snap">
        <div className="snap-label">Evidence</div>
        <div className="snap-box">
          <div className="snap-ph">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 4 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <div>No checkpoints verified yet</div>
          </div>
        </div>
      </div>
    );
  }

  const latest = verifiedCheckpoints[verifiedCheckpoints.length - 1];

  return (
    <div className="snap">
      <div className="snap-label">Latest Verified Checkpoint</div>
      <div className="snap-box">
        <div className="snap-ph">
          <div style={{ fontSize: 24, marginBottom: 8 }}>{"\u2705"}</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{latest.type}: {latest.target}</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {latest.evidence_explanation || "Verified"}
          </div>
          {latest.confidence != null && (
            <div style={{ fontSize: 12, color: "var(--blue)", marginTop: 4 }}>
              Confidence: {Math.round(latest.confidence * 100)}%
            </div>
          )}
        </div>
      </div>
      {latest.verified_at && (
        <div className="snap-timestamp">
          {new Date(latest.verified_at.endsWith("Z") ? latest.verified_at : latest.verified_at + "Z").toLocaleTimeString("en-US", { hour12: false })}
        </div>
      )}
    </div>
  );
}
