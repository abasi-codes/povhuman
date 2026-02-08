import { apiFetch } from "./client";
import type { AgentBinding } from "./types";

export async function getAgents(
  sessionId: string,
): Promise<{ agents: AgentBinding[] }> {
  return apiFetch<{ agents: AgentBinding[] }>(`/sessions/${sessionId}/agents`);
}

export async function bindAgent(
  sessionId: string,
  agentId: string,
  permissions: Record<string, boolean> = {},
): Promise<{ binding_id: string; agent_id: string }> {
  return apiFetch<{ binding_id: string; agent_id: string }>(
    `/sessions/${sessionId}/agents`,
    {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, permissions }),
    },
  );
}

export async function revokeAgent(
  sessionId: string,
  agentId: string,
): Promise<{ revoked: boolean }> {
  return apiFetch<{ revoked: boolean }>(
    `/sessions/${sessionId}/agents/${agentId}`,
    { method: "DELETE" },
  );
}
