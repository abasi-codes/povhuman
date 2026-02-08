import { describe, it, expect } from "vitest";
import { generateMcpConfig, generateClaudeDesktopConfig } from "./mcp-config.js";

describe("generateMcpConfig", () => {
  const config = generateMcpConfig("https://trio.machinefi.com/mcp/", "gk-123");

  it("has the correct name", () => {
    expect(config.name).toBe("trio-perception");
  });

  it("passes through the URL", () => {
    expect(config.url).toBe("https://trio.machinefi.com/mcp/");
  });

  it("uses SSE transport", () => {
    expect(config.transport).toBe("sse");
  });

  it("exposes only safe tools", () => {
    expect(config.allowed_tools).toEqual(["check_once", "get_job_status"]);
  });

  it("passes Google API key via env", () => {
    expect(config.env.GOOGLE_API_KEY).toBe("gk-123");
  });
});

describe("generateClaudeDesktopConfig", () => {
  it("returns mcpServers object", () => {
    const result = generateClaudeDesktopConfig("https://trio.machinefi.com/mcp/") as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(result.mcpServers).toBeDefined();
    expect(result.mcpServers["trio-perception"]).toBeDefined();
  });

  it("uses npx mcp-remote command", () => {
    const result = generateClaudeDesktopConfig("https://trio.machinefi.com/mcp/") as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    const server = result.mcpServers["trio-perception"];
    expect(server.command).toBe("npx");
    expect(server.args).toContain("mcp-remote");
    expect(server.args).toContain("https://trio.machinefi.com/mcp/");
  });
});
