import { Hono } from "hono";
import type { TaskManager } from "../tasks/manager.js";

export function createEventRoutes(taskManager: TaskManager): Hono {
  const app = new Hono();

  // GET /api/v1/tasks/:id/events?limit=50
  app.get("/", (c) => {
    const taskId = c.req.param("id") as string;
    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
    const events = taskManager.getEvents(taskId, limit);
    return c.json({ events });
  });

  // GET /api/v1/tasks/:id/events/:eventId/frame
  app.get("/:eventId/frame", async (c) => {
    const taskId = c.req.param("id") as string;
    const eventId = c.req.param("eventId") as string;

    const task = taskManager.getTask(taskId);
    if (!task) return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);

    // Try local frame first
    const frame = taskManager.getEventFrame(eventId);
    if (frame) {
      return c.json({ event_id: eventId, source: "local", frame_b64: frame });
    }

    // Fall back to 0G Storage if local frame expired
    const zgRoot = taskManager.getEventZgRoot(eventId);
    const zgStorage = taskManager.getZgStorage();
    if (zgRoot && zgStorage?.isEnabled) {
      const downloaded = await zgStorage.downloadFrame(zgRoot);
      if (downloaded) {
        return c.json({ event_id: eventId, source: "0g", frame_b64: downloaded, zg_root: zgRoot });
      }
    }

    return c.json({ error: "Frame not found", code: "NOT_FOUND" }, 404);
  });

  return app;
}
