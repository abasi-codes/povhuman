import { useEffect, useState } from "react";
import { useSessionContext } from "../../context/SessionContext";

export function ConditionBuilder() {
  const {
    presets,
    loadPresets,
    selectedPresetIds,
    togglePreset,
    customConditions,
    addCustomCondition,
    removeCondition,
    sessionId,
  } = useSessionContext();

  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const handleAdd = () => {
    if (customInput.trim()) {
      addCustomCondition(customInput);
      setCustomInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="card">
      <div className="card-title">Conditions</div>

      <div className="condition-chips">
        {presets.map((p) => (
          <span
            key={p.id}
            className={`tag ${selectedPresetIds.has(p.id) ? "on" : ""}`}
            onClick={() => !sessionId && togglePreset(p.id)}
            style={sessionId ? { opacity: 0.6, cursor: "default" } : undefined}
          >
            {p.label}
          </span>
        ))}
      </div>

      {!sessionId && (
        <div className="cust-row">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Custom yes/no condition..."
          />
          <button className="btn" onClick={handleAdd} disabled={!customInput.trim()}>
            Add
          </button>
        </div>
      )}

      {customConditions.length > 0 && (
        <div className="w-list">
          {customConditions.map((cond, i) => (
            <div key={i} className="w-item">
              <span>{cond}</span>
              {!sessionId && (
                <button className="remove" onClick={() => removeCondition(i)}>
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
