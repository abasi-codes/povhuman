import { useSessionContext } from "../../context/SessionContext";
import type { SharingScope, RetentionMode } from "../../api/types";

export function SessionControl() {
  const {
    session,
    sessionId,
    startSession,
    pauseSession,
    stopSession,
    createError,
    sharingScope,
    setSharingScope,
    redactionPolicy,
    setRedactionPolicy,
    retentionMode,
    setRetentionMode,
    selectedPresetIds,
    customConditions,
    streamMeta,
  } = useSessionContext();

  const state = session?.state ?? "idle";
  const isLive = state === "live";
  const isPaused = state === "paused";
  const canStart = !sessionId && streamMeta?.valid && (selectedPresetIds.size > 0 || customConditions.length > 0);

  const bannerClass = isLive ? "" : isPaused ? "paused" : state === "stopped" ? "stopped" : "idle";
  const valueClass = isLive ? "live" : isPaused ? "paused" : state === "stopped" ? "stopped" : "idle";

  const toggleRedaction = (key: keyof typeof redactionPolicy) => {
    setRedactionPolicy({ ...redactionPolicy, [key]: !redactionPolicy[key] });
  };

  return (
    <div className="card">
      <div className="card-title">Session Control</div>

      <div className={`s-banner ${bannerClass}`}>
        <div>
          <div className="s-banner-label">Current State</div>
          <div className={`s-banner-value ${valueClass}`}>
            {sessionId ? state : "No Session"}
          </div>
        </div>
      </div>

      <div className="session-controls">
        {!sessionId ? (
          <button
            className="btn btn-green"
            style={{ flex: 1 }}
            onClick={startSession}
            disabled={!canStart}
          >
            Start Session
          </button>
        ) : (
          <>
            <button
              className="btn btn-amber"
              style={{ flex: 1 }}
              onClick={pauseSession}
              disabled={!isLive}
            >
              Pause
            </button>
            <button
              className="btn btn-red"
              style={{ flex: 1 }}
              onClick={stopSession}
              disabled={state === "stopped"}
            >
              Stop
            </button>
          </>
        )}
      </div>

      {createError && <div className="error-text">{createError}</div>}

      <div className="sg">
        <div className="sg-label">Sharing Scope</div>
        <select
          className="sg-select"
          value={sharingScope}
          onChange={(e) => setSharingScope(e.target.value as SharingScope)}
          disabled={!!sessionId}
        >
          <option value="events_only">events_only</option>
          <option value="events_and_frames">events_and_frames</option>
          <option value="digests">digests</option>
        </select>
      </div>

      <div className="sg">
        <div className="sg-label">Redaction Policy</div>
        <div className="toggle-group">
          {(
            [
              ["blur_faces", "Blur faces"],
              ["blur_screens", "Blur screens"],
              ["blur_text", "Blur text"],
              ["block_private_locations", "Block private locations"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="toggle-row">
              <span>{label}</span>
              <div
                className={`tg-track ${redactionPolicy[key] ? "on" : ""}`}
                onClick={() => !sessionId && toggleRedaction(key)}
                style={sessionId ? { opacity: 0.6, cursor: "default" } : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="sg">
        <div className="sg-label">Retention Mode</div>
        <select
          className="sg-select"
          value={retentionMode}
          onChange={(e) => setRetentionMode(e.target.value as RetentionMode)}
          disabled={!!sessionId}
        >
          <option value="no_storage">no_storage</option>
          <option value="short_lived">short_lived</option>
          <option value="extended">extended</option>
        </select>
      </div>
    </div>
  );
}
