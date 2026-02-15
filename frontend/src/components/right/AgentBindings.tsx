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
    <div className="card">
      <div className="card-title">Agent API Keys</div>

      <div className="form-group">
        <label className="form-label">Agent ID</label>
        <input
          type="text"
          value={newAgentId}
          onChange={(e) => setNewAgentId(e.target.value)}
          placeholder="agent-id..."
        />
      </div>

      <div className="agent-list">
        {keys.map((k) => (
          <div key={k.key_id} className="agent">
            <div className="agent-header">
              <div className="agent-name">{k.label || k.key_id}</div>
              <button className="agent-revoke" onClick={() => handleRevoke(k.key_id)}>
                Revoke
              </button>
            </div>
            <div className="agent-perms">
              <span className="pp y">Created: {k.created_at}</span>
            </div>
          </div>
        ))}
        {keys.length === 0 && newAgentId.trim() && (
          <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 14 }}>
            No active keys
          </div>
        )}
      </div>

      {lastKey && (
        <div className="key-display">
          <div style={{ color: "var(--amber)", fontSize: 12, marginBottom: 4 }}>
            Save this key — it won't be shown again:
          </div>
          <code className="key-value">{lastKey}</code>
        </div>
      )}

      <div className="agent-bind-row">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Key label..."
          disabled={loading}
        />
        <button className="btn" onClick={handleCreate} disabled={loading || !newAgentId.trim()}>
          {loading ? <span className="spinner" /> : "Create Key"}
        </button>
      </div>
    </div>
  );
}
