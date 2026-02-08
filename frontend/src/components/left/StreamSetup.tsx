import { useSessionContext } from "../../context/SessionContext";

export function StreamSetup() {
  const {
    streamUrl,
    setStreamUrl,
    streamMeta,
    validating,
    validateStream,
    validationError,
    sessionId,
  } = useSessionContext();

  return (
    <div className="card">
      <div className="card-title">Stream Source</div>
      <div className="url-row">
        <input
          type="text"
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder="https://youtube.com/live/..."
          disabled={!!sessionId}
        />
        <button
          className="btn btn-blue"
          onClick={validateStream}
          disabled={validating || !streamUrl || !!sessionId}
        >
          {validating ? <span className="spinner" /> : "Validate"}
        </button>
      </div>

      <div className="cam-preview">
        {streamMeta?.is_live && <div className="live-indicator">LIVE</div>}
        <div className="cam-preview-text">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {streamMeta ? "Stream Validated" : "Enter a YouTube Live URL"}
        </div>
      </div>

      {validationError && <div className="error-text">{validationError}</div>}

      {streamMeta && (
        <div className="stream-meta">
          <div className="d-box">
            <div className="d-label">Title</div>
            <div className="d-value">{streamMeta.title || "—"}</div>
          </div>
          <div className="d-box">
            <div className="d-label">Channel</div>
            <div className="d-value">{streamMeta.channel || "—"}</div>
          </div>
          <div className="d-box">
            <div className="d-label">Live Status</div>
            <div className={`d-value ${streamMeta.is_live ? "positive" : "negative"}`}>
              {streamMeta.is_live ? "Broadcasting" : "Not Live"}
            </div>
          </div>
          <div className="d-box">
            <div className="d-label">Embeddable</div>
            <div className={`d-value ${streamMeta.embeddable ? "positive" : "negative"}`}>
              {streamMeta.embeddable ? "Yes" : "No"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
