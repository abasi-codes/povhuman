import { Hono } from "hono";
import type { SessionManager } from "../sessions/manager.js";

export function createEventRoutes(sessionManager: SessionManager): Hono {
  const app = new Hono();

  // GET /sessions/:id/events?limit=50&types=triggered,digest
  app.get("/", (c) => {
    const sessionId = c.req.param("id") as string;
    const session = sessionManager.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);

    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
    const typesParam = c.req.query("types");
    const types = typesParam ? typesParam.split(",") : null;

    const events = sessionManager.getEvents(sessionId, limit, types);
    return c.json({ events });
  });

  // GET /sessions/:id/events/:eventId/frame
  app.get("/:eventId/frame", (c) => {
    const sessionId = c.req.param("id") as string;
    const eventId = c.req.param("eventId") as string;

    const session = sessionManager.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);

    const frame = sessionManager.getEventFrame(eventId);
    if (!frame) return c.json({ error: "Frame not found", code: "NOT_FOUND" }, 404);

    return c.json({ event_id: eventId, frame_b64: frame });
  });

  return app;
}
