import { useState, useEffect, useCallback } from "react";
import { getAgentKeys, createAgentKey, revokeAgentKey } from "../../api/agents";
import type { AgentKey } from "../../api/types";

export function AgentBindings() {
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [newAgentId, setNewAgentId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!newAgentId.trim()) return;
    try {
      const { keys: k } = await getAgentKeys(newAgentId.trim());
      setKeys(k);
    } catch { /* ignore */ }
  }, [newAgentId]);

  useEffect(() => {
    if (newAgentId.trim()) fetchKeys();
  }, [fetchKeys, newAgentId]);

  const handleCreate = async () => {
    if (!newAgentId.trim()) return;
    setLoading(true);
    try {
      const result = await createAgentKey(newAgentId.trim(), newLabel || undefined);
      setLastKey(result.api_key);
      setNewLabel("");
      await fetchKeys();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleRevoke = async (keyId: string) => {
    await revokeAgentKey(keyId);
    await fetchKeys();
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Agent Keys</div>
      </div>

      <div className="field">
        <div className="field-label">Agent ID</div>
        <input
          className="field-input"
          type="text"
          value={newAgentId}
          onChange={(e) => setNewAgentId(e.target.value)}
          placeholder="agent-id..."
        />
      </div>

      {keys.length > 0 && (
        <div className="key-list">
          {keys.map((k) => (
            <div key={k.key_id} className="key-item">
              <div className="key-info">
                <div className="key-agent">{k.label || k.key_id}</div>
                <div className="key-hash">vh_{k.key_id.slice(0, 12)}...</div>
              </div>
              <button className="key-revoke" onClick={() => handleRevoke(k.key_id)}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {keys.length === 0 && newAgentId.trim() && (
        <div style={{ color: "var(--text4)", fontSize: 11, textAlign: "center", padding: 14, marginBottom: 12 }}>
          No active keys
        </div>
      )}

      {lastKey && (
        <div className="key-display">
          <div style={{ fontSize: 10, color: "var(--amber)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
            Save this key — shown only once
          </div>
          <code>{lastKey}</code>
        </div>
      )}

      <div className="row" style={{ gap: 6 }}>
        <input
          className="field-input"
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="label"
          disabled={loading}
          style={{ fontSize: 11, padding: "6px 8px" }}
        />
        <button
          className="btn btn-sm"
          onClick={handleCreate}
          disabled={loading || !newAgentId.trim()}
        >
          {loading ? <span className="spinner" /> : "Create"}
        </button>
      </div>
    </div>
  );
}
