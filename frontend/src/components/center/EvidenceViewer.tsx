import { useTaskContext } from "../../context/TaskContext";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return iso;
  }
}

const sceneEmoji: Record<string, string> = {
  location: "\uD83C\uDFE0",
  object: "\uD83D\uDCE6",
  document: "\uD83D\uDCC4",
  gps: "\uD83D\uDCCD",
};

export function EvidenceViewer() {
  const { task } = useTaskContext();

  const isLive = task && (task.status === "streaming" || task.status === "verifying");
  const verifiedCheckpoints = task?.checkpoints.filter((cp) => cp.verified) ?? [];
  const latest = verifiedCheckpoints.length > 0
    ? verifiedCheckpoints[verifiedCheckpoints.length - 1]
    : null;

  if (!latest) {
    return (
      <div className="evidence-panel">
        <div className="panel-label" style={{ marginBottom: 10 }}>Latest Evidence</div>
        <div className="evidence-frame">
          <div className="ev-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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

  return (
    <div className="evidence-panel">
      <div className="panel-label" style={{ marginBottom: 10 }}>Latest Evidence</div>
      <div className="evidence-frame">
        <div className="phone-view">
          {isLive && (
            <div className="live-badge">
              <div className="live-badge-dot" /> LIVE
            </div>
          )}
          {latest.verified_at && (
            <div className="timestamp-overlay">
              {formatTime(latest.verified_at)}
            </div>
          )}
          <div className="street-scene">
            {sceneEmoji[latest.type] || "\uD83D\uDCF7"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", opacity: 0.5 }}>
            {latest.target}
          </div>
          <div className="blur-overlay" />
          <div className="redact-label">Faces Redacted</div>
        </div>
      </div>
      <div className="evidence-meta">
        <strong>Checkpoint:</strong> {latest.type.charAt(0).toUpperCase() + latest.type.slice(1)} &mdash; {latest.target}<br />
        <strong>Confidence:</strong>{" "}
        <span style={{ color: "var(--green)" }}>
          {latest.confidence != null ? `${Math.round(latest.confidence * 100)}%` : "--"}
        </span><br />
        {latest.verified_at && (
          <><strong>Captured:</strong> {formatTime(latest.verified_at)} UTC<br /></>
        )}
        <strong>Redaction:</strong> blur_faces applied
        {latest.evidence_zg_root && (
          <><br /><strong>Storage:</strong>{" "}
            <span style={{ color: "var(--amber)", fontFamily: "var(--fm)" }}>
              Solana &mdash; {latest.evidence_zg_root.slice(0, 12)}...{latest.evidence_zg_root.slice(-8)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
