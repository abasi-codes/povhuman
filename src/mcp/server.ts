import type { McpToolDefinition } from "./types.js";

/**
 * MCP tool definitions for ProofStream.
 * Stub: returns tool schemas but handleToolCall returns "not connected" error.
 *
 * Real implementation will connect to a running ProofStream server.
 */

export function getProofStreamTools(): McpToolDefinition[] {
  return [
    {
      name: "create_verification_task",
      description:
        "Create a verification task. Specify what the human should do and " +
        "the checkpoints (location, object, document) to verify completion.",
      inputSchema: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "What the human should do (e.g., 'Deliver package to 123 Main St')",
          },
          webhook_url: {
            type: "string",
            description: "URL to receive verification events",
          },
          checkpoints: {
            type: "array",
            description: "Verification checkpoints",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["location", "object", "document"],
                  description: "Checkpoint type",
                },
                target: {
                  type: "string",
                  description: "What to verify (location name, object name, document type)",
                },
              },
              required: ["type", "target"],
            },
          },
          max_duration_seconds: {
            type: "number",
            description: "Maximum task duration in seconds (default: 3600)",
          },
        },
        required: ["description", "webhook_url", "checkpoints"],
      },
    },
    {
      name: "get_task_status",
      description: "Get the current status of a verification task including checkpoint progress.",
      inputSchema: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "The task ID to check",
          },
        },
        required: ["task_id"],
      },
    },
    {
      name: "cancel_task",
      description: "Cancel a running verification task. Stops streaming and Trio jobs.",
      inputSchema: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "The task ID to cancel",
          },
        },
        required: ["task_id"],
      },
    },
  ];
}

/**
 * Handle an MCP tool call. Stub: returns "not connected" for all calls.
 */
export function handleToolCall(
  name: string,
  _input: Record<string, unknown>,
): { error: string } {
  return {
    error: `ProofStream MCP server is not connected. Tool "${name}" cannot be executed. ` +
      "Connect to a running ProofStream instance first.",
  };
}
