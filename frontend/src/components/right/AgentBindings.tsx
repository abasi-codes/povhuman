import { useState, useEffect, useCallback } from "react";
import { useSessionContext } from "../../context/SessionContext";
import { getAgents, bindAgent, revokeAgent } from "../../api/agents";
import type { AgentBinding } from "../../api/types";

export function AgentBindings() {
  const { sessionId } = useSessionContext();
  const [agents, setAgents] = useState<AgentBinding[]>([]);
  const [newAgentId, setNewAgentId] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { agents: a } = await getAgents(sessionId);
      setAgents(a);
    } catch { /* ignore */ }
  }, [sessionId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleBind = async () => {
    if (!sessionId || !newAgentId.trim()) return;
    setLoading(true);
    try {
      await bindAgent(sessionId, newAgentId.trim(), {
        events: true,
        frames_on_trigger: false,
        digests: false,
      });
      setNewAgentId("");
      await fetchAgents();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleRevoke = async (agentId: string) => {
    if (!sessionId) return;
    await revokeAgent(sessionId, agentId);
    await fetchAgents();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBind();
  };

  return (
    <div className="card">
      <div className="card-title">Agent Bindings</div>

      <div className="agent-list">
        {agents.map((a) => {
          let perms: Record<string, boolean> = {};
          try { perms = JSON.parse(a.permissions); } catch { /* ignore */ }
          return (
            <div key={a.binding_id} className="agent">
              <div className="agent-header">
                <div className="agent-name">{a.agent_id}</div>
                <button className="agent-revoke" onClick={() => handleRevoke(a.agent_id)}>
                  Revoke
                </button>
              </div>
              <div className="agent-perms">
                <span className={`pp ${perms.events ? "y" : "n"}`}>events</span>
                <span className={`pp ${perms.frames_on_trigger ? "y" : "n"}`}>frames</span>
                <span className={`pp ${perms.digests ? "y" : "n"}`}>digests</span>
              </div>
            </div>
          );
        })}
        {agents.length === 0 && (
          <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 14 }}>
            No agents bound
          </div>
        )}
      </div>

      {sessionId && (
        <div className="agent-bind-row">
          <input
            type="text"
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="agent-id..."
            disabled={loading}
          />
          <button className="btn" onClick={handleBind} disabled={loading || !newAgentId.trim()}>
            {loading ? <span className="spinner" /> : "Bind"}
          </button>
        </div>
      )}
    </div>
  );
}
