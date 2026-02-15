import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createTaskRoutes } from "./tasks.js";
import { TaskManager } from "../tasks/manager.js";
import { StreamRelay } from "../stream/relay.js";
import { AgentDelivery } from "../agents/delivery.js";
import { EvidenceCaptureService } from "../evidence/capture.js";
import { createTestDb, createMockTrioClient } from "../test-helpers.js";
import { DEFAULT_REDACTION_POLICY } from "../tasks/types.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createTestApp() {
  const db = createTestDb();
  const trio = createMockTrioClient() as any;
  const streamRelay = new StreamRelay();
  const agentDelivery = new AgentDelivery();
  const evidenceCapture = new EvidenceCaptureService(DEFAULT_REDACTION_POLICY, true);

  const taskManager = new TaskManager(
    db, trio, streamRelay, agentDelivery, evidenceCapture,
    "http://localhost:3000",
  );

  const app = new Hono();
  app.route("/api/v1/tasks", createTaskRoutes(taskManager));

  return { app, taskManager, db };
}

describe("Task Routes", () => {
  let app: Hono;
  let taskManager: TaskManager;

  beforeEach(() => {
    const setup = createTestApp();
    app = setup.app;
    taskManager = setup.taskManager;
  });

  describe("POST /api/v1/tasks", () => {
    it("creates a task with checkpoints", async () => {
      const res = await app.request("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          description: "Deliver package",
          webhook_url: "https://example.com/hook",
          checkpoints: [
            { type: "location", target: "123 Main St" },
            { type: "object", target: "package" },
          ],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.task_id).toBeTruthy();
      expect(body.status).toBe("pending");
      expect(body.stream_url).toBeTruthy();
      expect(body.checkpoints).toHaveLength(2);
    });

    it("rejects empty checkpoints", async () => {
      const res = await app.request("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          description: "Test",
          webhook_url: "https://example.com/hook",
          checkpoints: [],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("rejects unavailable checkpoint types", async () => {
      const res = await app.request("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          description: "Test",
          webhook_url: "https://example.com/hook",
          checkpoints: [{ type: "action", target: "waving" }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("CHECKPOINT_UNAVAILABLE");
    });

    it("rejects invalid webhook_url", async () => {
      const res = await app.request("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          description: "Test",
          webhook_url: "not-a-url",
          checkpoints: [{ type: "location", target: "office" }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/tasks/:id", () => {
    it("returns task detail with checkpoints", async () => {
      const taskId = taskManager.createTask({
        agent_id: "test",
        description: "Test",
        webhook_url: "https://example.com/hook",
        checkpoints: [{ type: "location", target: "office" }],
      });

      const res = await app.request(`/api/v1/tasks/${taskId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.task_id).toBe(taskId);
      expect(body.checkpoints).toHaveLength(1);
      expect(body.checkpoints[0].type).toBe("location");
    });

    it("returns 404 for unknown task", async () => {
      const res = await app.request("/api/v1/tasks/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/tasks/:id/claim", () => {
    it("claims a pending task", async () => {
      const taskId = taskManager.createTask({
        agent_id: "test",
        description: "Test",
        webhook_url: "https://example.com/hook",
        checkpoints: [{ type: "object", target: "box" }],
      });

      const res = await app.request(`/api/v1/tasks/${taskId}/claim`, {
        method: "POST",
        body: JSON.stringify({ human_id: "human-123" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("awaiting_stream");
      expect(body.human_id).toBe("human-123");
    });
  });

  describe("POST /api/v1/tasks/:id/stop", () => {
    it("cancels a task", async () => {
      const taskId = taskManager.createTask({
        agent_id: "test",
        description: "Test",
        webhook_url: "https://example.com/hook",
        checkpoints: [{ type: "document", target: "receipt" }],
      });

      const res = await app.request(`/api/v1/tasks/${taskId}/stop`, {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("cancelled");
    });
  });

  describe("GET /api/v1/tasks/:id/checkpoints", () => {
    it("returns checkpoint list", async () => {
      const taskId = taskManager.createTask({
        agent_id: "test",
        description: "Test",
        webhook_url: "https://example.com/hook",
        checkpoints: [
          { type: "location", target: "office" },
          { type: "object", target: "laptop" },
        ],
      });

      const res = await app.request(`/api/v1/tasks/${taskId}/checkpoints`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.checkpoints).toHaveLength(2);
    });
  });
});
