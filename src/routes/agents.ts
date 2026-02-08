import { Hono } from "hono";
import { z } from "zod";
import type { SessionManager } from "../sessions/manager.js";

const BindAgentSchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export function createAgentRoutes(sessionManager: SessionManager): Hono {
  const app = new Hono();

  // GET /sessions/:id/agents
  app.get("/", (c) => {
    const sessionId = c.req.param("id") as string;
    const session = sessionManager.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);

    const bindings = sessionManager.getActiveBindings(sessionId);
    return c.json({ agents: bindings });
  });

  // POST /sessions/:id/agents
  app.post("/", async (c) => {
    const sessionId = c.req.param("id") as string;
    const session = sessionManager.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);

    const raw = await c.req.json().catch(() => ({}));
    const parsed = BindAgentSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
        code: "VALIDATION_ERROR",
      }, 400);
    }
    const { agent_id, permissions } = parsed.data;

    const bindingId = sessionManager.bindAgent(sessionId, agent_id, permissions || {});
    return c.json({ binding_id: bindingId, agent_id, permissions }, 201);
  });

  // DELETE /sessions/:id/agents/:agentId
  app.delete("/:agentId", (c) => {
    const sessionId = c.req.param("id") as string;
    const agentId = c.req.param("agentId") as string;

    const session = sessionManager.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);

    sessionManager.revokeAgentBinding(sessionId, agentId);
    return c.json({ revoked: true, agent_id: agentId });
  });

  return app;
}
