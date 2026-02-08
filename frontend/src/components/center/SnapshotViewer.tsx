import { useState, useEffect, useMemo } from "react";
import { useSessionContext } from "../../context/SessionContext";
import { getFrame } from "../../api/events";

export function SnapshotViewer() {
  const { events, sessionId } = useSessionContext();
  const [frameData, setFrameData] = useState<string | null>(null);
  const [loadingFrame, setLoadingFrame] = useState(false);

  // Find the latest trigger event
  const latestTrigger = useMemo(
    () => events.find((e) => e.type === "triggered"),
    [events],
  );

  useEffect(() => {
    if (!sessionId || !latestTrigger) {
      setFrameData(null);
      return;
    }

    let cancelled = false;
    setLoadingFrame(true);
    getFrame(sessionId, latestTrigger.event_id)
      .then((res) => {
        if (!cancelled) setFrameData(res.frame_b64);
      })
      .catch(() => {
        if (!cancelled) setFrameData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFrame(false);
      });

    return () => { cancelled = true; };
  }, [sessionId, latestTrigger]);

  // Parse metadata from latest trigger
  const detections = useMemo(() => {
    if (!latestTrigger) return null;
    try {
      return JSON.parse(latestTrigger.metadata);
    } catch {
      return null;
    }
  }, [latestTrigger]);

  return (
    <div className="snap">
      <div className="snap-label">Latest Trigger Frame</div>
      <div className="snap-box">
        {loadingFrame ? (
          <div className="snap-ph">
            <span className="spinner" />
          </div>
        ) : frameData ? (
          <img src={`data:image/jpeg;base64,${frameData}`} alt="Trigger frame" />
        ) : (
          <div className="snap-ph">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 4 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <div>{latestTrigger ? "Frame unavailable" : "No triggers yet"}</div>
          </div>
        )}
      </div>
      {latestTrigger && (
        <div className="snap-timestamp">
          {new Date(latestTrigger.created_at.endsWith("Z") ? latestTrigger.created_at : latestTrigger.created_at + "Z").toLocaleTimeString("en-US", { hour12: false })}
          {detections?.condition && ` · ${detections.condition}`}
        </div>
      )}
    </div>
  );
}
