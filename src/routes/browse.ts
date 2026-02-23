import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { TaskManager } from "../tasks/manager.js";
import type { TrioClient } from "../trio/client.js";
import type { TaskRow, CheckpointRow } from "../db/schema.js";
import { logger } from "../logger.js";

const CheckSchema = z.object({
  video_url: z.string().url("video_url must be a valid URL"),
});

export function createBrowseRoutes(
  taskManager: TaskManager,
  trio: TrioClient,
): Hono {
  const app = new Hono();

  // --- List available tasks for humans ---
  app.get("/", (c) => {
    const db = (taskManager as any).db;
    const rows = db
      .prepare(
        `SELECT t.task_id, t.agent_id, t.title, t.description, t.payout_cents, t.created_at,
                t.escrow_lamports, t.escrow_status, t.agent_wallet,
                a.name as agent_name, a.avatar as agent_avatar, a.description as agent_description,
                (SELECT target FROM checkpoints WHERE task_id = t.task_id ORDER BY ordering LIMIT 1) as condition
         FROM tasks t
         LEFT JOIN agents a ON t.agent_id = a.agent_id
         WHERE t.status = 'pending'
         ORDER BY t.created_at DESC`,
      )
      .all() as Array<{
      task_id: string;
      agent_id: string;
      title: string;
      description: string;
      payout_cents: number;
      created_at: string;
      escrow_lamports: number;
      escrow_status: string;
      agent_wallet: string | null;
      agent_name: string | null;
      agent_avatar: string | null;
      agent_description: string | null;
      condition: string | null;
    }>;

    return c.json(
      rows.map((r) => ({
        task_id: r.task_id,
        agent_id: r.agent_id,
        agent_name: r.agent_name ?? r.agent_id,
        agent_avatar: r.agent_avatar ?? "",
        agent_description: r.agent_description ?? "",
        title: r.title,
        description: r.description,
        payout_cents: r.payout_cents,
        escrow_lamports: r.escrow_lamports,
        escrow_sol: r.escrow_lamports / 1_000_000_000,
        escrow_status: r.escrow_status,
        condition: r.condition ?? "",
        created_at: r.created_at,
      })),
    );
  });

  // --- Get single task detail ---
  app.get("/:id", (c) => {
    const taskId = c.req.param("id");
    const task = taskManager.getTask(taskId);
    if (!task) {
      return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);
    }

    const checkpoints = taskManager.getCheckpoints(taskId);
    const condition = checkpoints.length > 0 ? checkpoints[0].target : "";

    // Look up agent info
    const db = (taskManager as any).db;
    const agent = db.prepare("SELECT * FROM agents WHERE agent_id = ?").get(task.agent_id) as {
      name: string; avatar: string; description: string;
    } | undefined;

    return c.json({
      task_id: task.task_id,
      agent_id: task.agent_id,
      agent_name: agent?.name ?? task.agent_id,
      agent_avatar: agent?.avatar ?? "",
      title: task.title,
      description: task.description,
      payout_cents: task.payout_cents,
      escrow_lamports: task.escrow_lamports,
      escrow_sol: task.escrow_lamports / 1_000_000_000,
      escrow_status: task.escrow_status,
      condition,
      status: task.status,
      created_at: task.created_at,
    });
  });

  // --- One-shot Trio verification ---
  app.post("/:id/check", async (c) => {
    const taskId = c.req.param("id");
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CheckSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; "),
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    const task = taskManager.getTask(taskId) as TaskRow | undefined;
    if (!task) {
      return c.json({ error: "Task not found", code: "NOT_FOUND" }, 404);
    }

    const checkpoints = taskManager.getCheckpoints(taskId);
    if (checkpoints.length === 0) {
      return c.json(
        { error: "Task has no checkpoints", code: "NO_CHECKPOINTS" },
        400,
      );
    }

    const condition = checkpoints[0].target;

    // Demo mode: mock verification when no real API key is configured
    if (!trio.hasApiKey) {
      const cp = checkpoints[0];

      if (task.agent_id === "BakeAssist") {
        return c.json({
          verified: false,
          explanation:
            "Could not detect cookie baking activity. No evidence of mixing ingredients or placing a tray in the oven was observed. Stream showed general kitchen activity but no cookie dough preparation was identified.",
          payout_cents: 0,
        });
      }

      // All other tasks pass in demo mode
      const mockResults: Record<string, { explanation: string }> = {
        HomeBot: {
          explanation: "Detected person standing at kitchen sink with running water. Dishes observed being scrubbed and placed on drying rack. Sink confirmed empty at end of stream.",
        },
        TidyUp: {
          explanation: "Detected person arranging books on a shelf. Books were sorted upright and grouped by size. Bookshelf appears organized at end of stream.",
        },
        ChefBot: {
          explanation: "Detected food preparation activity in kitchen. Ingredients were chopped and prepped on cutting board. Cooking on stovetop confirmed with visible heat and stirring.",
        },
        DataBot: {
          explanation: "Detected data entry activity on computer screen. Spreadsheet cells being populated with structured data. Form completion verified.",
        },
        ErrandBot: {
          explanation: "Detected package pickup at delivery location. Receipt visible and item successfully collected.",
        },
      };
      const result = mockResults[task.agent_id] ?? { explanation: "Task activity detected and verified by Trio VLM." };
      const explanation = result.explanation;

      // Mark checkpoint as verified
      const verifyStmt = (taskManager as any).db.prepare(
        `UPDATE checkpoints SET verified = 1, verified_at = datetime('now'),
         evidence_explanation = ? WHERE checkpoint_id = ?`,
      );
      verifyStmt.run(explanation, cp.checkpoint_id);

      // Complete the task
      const completeStmt = (taskManager as any).db.prepare(
        `UPDATE tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE task_id = ?`,
      );
      completeStmt.run(taskId);

      // Record verification event
      const eventId = nanoid(12);
      (taskManager as any).db
        .prepare(
          `INSERT INTO verification_events (event_id, task_id, job_id, checkpoint_id, event_type, confidence, explanation, evidence_frame_b64, metadata, expires_at)
         VALUES (?, ?, NULL, ?, 'checkpoint_verified', NULL, ?, NULL, '{}', NULL)`,
        )
        .run(eventId, taskId, cp.checkpoint_id, explanation);

      return c.json({
        verified: true,
        explanation,
        payout_cents: task.payout_cents,
        escrow_lamports: task.escrow_lamports,
        escrow_sol: task.escrow_lamports / 1_000_000_000,
      });
    }

    try {
      const result = await trio.checkOnce({
        stream_url: parsed.data.video_url,
        condition,
      });

      const verified = result.triggered === true;

      if (verified) {
        // Mark checkpoint as verified
        const cp = checkpoints[0];
        const verifyStmt = (taskManager as any).db.prepare(
          `UPDATE checkpoints SET verified = 1, verified_at = datetime('now'),
           evidence_explanation = ? WHERE checkpoint_id = ?`,
        );
        verifyStmt.run(
          result.explanation,
          cp.checkpoint_id,
        );

        // Complete the task
        const completeStmt = (taskManager as any).db.prepare(
          `UPDATE tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE task_id = ?`,
        );
        completeStmt.run(taskId);

        // Record verification event
        const eventId = nanoid(12);
        (taskManager as any).db
          .prepare(
            `INSERT INTO verification_events (event_id, task_id, job_id, checkpoint_id, event_type, confidence, explanation, evidence_frame_b64, metadata, expires_at)
           VALUES (?, ?, NULL, ?, 'checkpoint_verified', NULL, ?, ?, '{}', NULL)`,
          )
          .run(
            eventId,
            taskId,
            cp.checkpoint_id,
            result.explanation,
            result.frame_b64 ?? null,
          );
      }

      return c.json({
        verified,
        explanation: result.explanation,
        payout_cents: verified ? task.payout_cents : 0,
      });
    } catch (err) {
      logger.error({ err, taskId }, "Trio check-once failed");
      const message =
        err instanceof Error ? err.message : "Verification failed";
      return c.json({ error: message, code: "TRIO_ERROR" }, 502);
    }
  });

  return app;
}
