import { useState } from "react";
import { useTaskContext } from "../../context/TaskContext";

const CHECKPOINT_TYPES = [
  { value: "location", label: "Location", icon: "📍" },
  { value: "object", label: "Object", icon: "📦" },
  { value: "document", label: "Document", icon: "📄" },
];

export function CheckpointBuilder() {
  const { checkpointInputs, addCheckpoint, removeCheckpoint, taskId } = useTaskContext();
  const [newType, setNewType] = useState("location");
  const [newTarget, setNewTarget] = useState("");

  if (taskId) return null;

  const handleAdd = () => {
    if (newTarget.trim()) {
      addCheckpoint(newType, newTarget);
      setNewTarget("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="card">
      <div className="card-title">Checkpoints</div>

      <div className="checkpoint-list">
        {checkpointInputs.map((cp, i) => {
          const typeInfo = CHECKPOINT_TYPES.find((t) => t.value === cp.type);
          return (
            <div key={i} className="checkpoint-item">
              <span className="checkpoint-icon">{typeInfo?.icon || "?"}</span>
              <div className="checkpoint-detail">
                <div className="checkpoint-type">{typeInfo?.label || cp.type}</div>
                <div className="checkpoint-target">{cp.target}</div>
              </div>
              <button className="checkpoint-remove" onClick={() => removeCheckpoint(i)}>
                x
              </button>
            </div>
          );
        })}
        {checkpointInputs.length === 0 && (
          <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 14 }}>
            Add at least one checkpoint
          </div>
        )}
      </div>

      <div className="checkpoint-add">
        <select value={newType} onChange={(e) => setNewType(e.target.value)}>
          {CHECKPOINT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What to verify..."
        />
        <button className="btn" onClick={handleAdd} disabled={!newTarget.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
