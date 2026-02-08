/**
 * MCP (Model Context Protocol) adapter configuration for Trio.
 *
 * Trio exposes 5 MCP tools at https://trio.machinefi.com/mcp/ via SSE:
 * - check_once: Single condition check on a live stream
 * - live_monitor: Continuous monitoring with webhook notifications
 * - live_digest: Periodic narrative summaries
 * - get_job_status: Query running job details
 * - cancel_job: Terminate active jobs
 *
 * Use openclaw-mcp-adapter to connect Trio's MCP endpoint as native
 * agent tools, wrapped by the policy gateway for scope enforcement.
 */

export interface McpAdapterConfig {
  /** Display name for this MCP server in OpenClaw */
  name: string;
  /** Trio MCP endpoint URL */
  url: string;
  /** Transport type (SSE for Trio) */
  transport: "sse" | "stdio";
  /** Tools to expose (subset for security) */
  allowed_tools: string[];
  /** Environment variables to pass through */
  env: Record<string, string>;
}

/**
 * Generate the MCP adapter configuration for Trio.
 * This gets installed into the OpenClaw agent's MCP config.
 */
export function generateMcpConfig(
  trioMcpUrl: string,
  googleApiKey: string,
): McpAdapterConfig {
  return {
    name: "trio-perception",
    url: trioMcpUrl,
    transport: "sse",
    // Only expose read-only and safe tools.
    // live_monitor requires webhook config so it goes through our backend.
    allowed_tools: ["check_once", "get_job_status"],
    env: {
      GOOGLE_API_KEY: googleApiKey,
    },
  };
}

/**
 * Generate the Claude Desktop MCP configuration snippet.
 * Users can paste this into their claude_desktop_config.json.
 */
export function generateClaudeDesktopConfig(trioMcpUrl: string): object {
  return {
    mcpServers: {
      "trio-perception": {
        command: "npx",
        args: ["-y", "mcp-remote", trioMcpUrl],
      },
    },
  };
}
