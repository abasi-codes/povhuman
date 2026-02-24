import { useState } from "react";
import { useTaskContext } from "../../context/TaskContext";


function formatGpsTarget(target: string): string {
  try {
    const parsed = JSON.parse(target);
    if (parsed.lat != null && parsed.lng != null) {
      return `${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)} (${parsed.radius_m ?? 100}m)`;
    }
  } catch { /* not JSON */ }
  return target;
}

const CHECKPOINT_TYPES = [
  { value: "location", label: "Location", badge: "LOC" },
  { value: "object", label: "Object", badge: "OBJ" },
  { value: "document", label: "Document", badge: "DOC" },
  { value: "gps", label: "GPS Geofence", badge: "GPS" },
];

export function CheckpointBuilder() {
  const { checkpointInputs, addCheckpoint, removeCheckpoint, taskId } = useTaskContext();
  const [newType, setNewType] = useState("location");
  const [newTarget, setNewTarget] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [gpsRadius, setGpsRadius] = useState("100");

  if (taskId) return null;

  const isGps = newType === "gps";

  const handleAdd = () => {
    if (isGps) {
      const lat = parseFloat(gpsLat);
      const lng = parseFloat(gpsLng);
      const radius = parseInt(gpsRadius, 10);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius) && radius > 0) {
        addCheckpoint("gps", JSON.stringify({ lat, lng, radius_m: radius }));
        setGpsLat("");
        setGpsLng("");
        setGpsRadius("100");
      }
    } else if (newTarget.trim()) {
      addCheckpoint(newType, newTarget);
      setNewTarget("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Checkpoints</div>
      </div>

      {checkpointInputs.length > 0 && (
        <div className="cp-list">
          {checkpointInputs.map((cp, i) => {
            const typeInfo = CHECKPOINT_TYPES.find((t) => t.value === cp.type);
            return (
              <div key={i} className="cp-item">
                <span className={`cp-type-badge ${cp.type}`}>
                  {typeInfo?.badge || cp.type.slice(0, 3).toUpperCase()}
                </span>
                <span className="cp-target">
                  {cp.type === "gps" ? formatGpsTarget(cp.target) : cp.target}
                </span>
                <button className="cp-remove" onClick={() => removeCheckpoint(i)}>
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {checkpointInputs.length === 0 && (
        <div style={{ color: "var(--text4)", fontSize: 11, textAlign: "center", padding: 14, marginBottom: 12 }}>
          Add at least one checkpoint
        </div>
      )}

      <div className="row">
        <div className="field">
          <select
            className="field-input"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          >
            {CHECKPOINT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {isGps ? (
          <>
            <div className="field">
              <input
                className="field-input"
                type="number"
                step="any"
                value={gpsLat}
                onChange={(e) => setGpsLat(e.target.value)}
                placeholder="Lat"
              />
            </div>
            <div className="field">
              <input
                className="field-input"
                type="number"
                step="any"
                value={gpsLng}
                onChange={(e) => setGpsLng(e.target.value)}
                placeholder="Lng"
              />
            </div>
            <div className="field" style={{ maxWidth: 70 }}>
              <input
                className="field-input"
                type="number"
                value={gpsRadius}
                onChange={(e) => setGpsRadius(e.target.value)}
                placeholder="Radius (m)"
              />
            </div>
          </>
        ) : (
          <div className="field" style={{ flex: 2 }}>
            <input
              className="field-input"
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Target to verify..."
            />
          </div>
        )}
        <button
          className="btn btn-amber btn-sm"
          onClick={handleAdd}
          disabled={isGps ? (!gpsLat || !gpsLng) : !newTarget.trim()}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
