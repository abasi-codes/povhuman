import { apiFetch } from "./client";
import type { AgentKey } from "./types";

export async function getAgentKeys(
  agentId: string,
): Promise<{ keys: AgentKey[] }> {
  return apiFetch<{ keys: AgentKey[] }>(`/api/v1/agents/keys?agent_id=${agentId}`);
}

export async function createAgentKey(
  agentId: string,
  label?: string,
): Promise<{ key_id: string; agent_id: string; api_key: string }> {
  return apiFetch(`/api/v1/agents/keys`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, label }),
  });
}

export async function revokeAgentKey(
  keyId: string,
): Promise<{ revoked: boolean }> {
  return apiFetch<{ revoked: boolean }>(
    `/api/v1/agents/keys/${keyId}`,
    { method: "DELETE" },
  );
}
