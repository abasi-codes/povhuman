import { Hono } from "hono";
import { z } from "zod";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import type Database from "better-sqlite3";
import type { AgentKeyRow } from "../db/schema.js";

const CreateKeySchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  label: z.string().optional(),
});

export function createAgentKeyRoutes(db: Database.Database): Hono {
  const app = new Hono();

  const insertKey = db.prepare(`
    INSERT INTO agent_keys (key_id, agent_id, key_hash, label) VALUES (?, ?, ?, ?)
  `);
  const getKeysByAgent = db.prepare(`
    SELECT key_id, agent_id, label, created_at, revoked_at FROM agent_keys WHERE agent_id = ? AND revoked_at IS NULL
  `);
  const revokeKey = db.prepare(`
    UPDATE agent_keys SET revoked_at = datetime('now') WHERE key_id = ?
  `);

  // POST /api/v1/agents/keys — Create agent API key
  app.post("/keys", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateKeySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
        code: "VALIDATION_ERROR",
      }, 400);
    }

    const { agent_id, label } = parsed.data;
    const keyId = nanoid(12);
    const rawKey = `vh_${nanoid(32)}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    insertKey.run(keyId, agent_id, keyHash, label || null);

    return c.json({
      key_id: keyId,
      agent_id,
      api_key: rawKey, // Only shown once
      label: label || null,
    }, 201);
  });

  // GET /api/v1/agents/keys?agent_id=...
  app.get("/keys", (c) => {
    const agentId = c.req.query("agent_id");
    if (!agentId) return c.json({ error: "agent_id query param required", code: "MISSING_PARAM" }, 400);

    const keys = getKeysByAgent.all(agentId) as Omit<AgentKeyRow, "key_hash">[];
    return c.json({ keys });
  });

  // DELETE /api/v1/agents/keys/:keyId
  app.delete("/keys/:keyId", (c) => {
    const keyId = c.req.param("keyId");
    revokeKey.run(keyId);
    return c.json({ revoked: true, key_id: keyId });
  });

  return app;
}
