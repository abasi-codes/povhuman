import type Database from "better-sqlite3";
import type { TaskManager } from "../tasks/manager.js";
import { TASK_CATALOG } from "./catalogs.js";
import { PERSONALITIES } from "./personalities.js";
import type { AgentPersonality } from "./personalities.js";
import { logger } from "../logger.js";
import type { AgentRow, TaskRow } from "../db/schema.js";

export class DemoOrchestrator {
  private taskManager: TaskManager;
  private db: Database.Database;
  private webhookUrl: string;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private baseDelay: number;

  constructor(
    taskManager: TaskManager,
    db: Database.Database,
    webhookUrl: string,
    baseDelayMs: number = 60_000,
  ) {
    this.taskManager = taskManager;
    this.db = db;
    this.webhookUrl = webhookUrl;
    this.baseDelay = baseDelayMs;
  }

  start(): void {
    logger.info("Demo orchestrator starting");
    this.fillGaps();
    this.checkInterval = setInterval(() => this.fillGaps(), 30_000);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    logger.info("Demo orchestrator stopped");
  }

  scheduleRepost(agentId: string, delayMs: number): void {
    const personality = PERSONALITIES[agentId];
    if (!personality) return;

    const actualDelay = Math.max(delayMs, 5_000);
    const timer = setTimeout(async () => {
      this.pendingTimers.delete(timer);
      try {
        await this.postRandomTask(agentId);
      } catch (err) {
        logger.warn({ err, agentId }, "Demo repost failed");
      }
    }, actualDelay);
    this.pendingTimers.add(timer);

    logger.debug({ agentId, delayMs: actualDelay }, "Scheduled demo repost");
  }

  handleWebhookEvent(event: {
    event_type: string;
    task_id: string;
    metadata?: Record<string, unknown>;
  }): void {
    const task = this.taskManager.getTask(event.task_id);
    if (!task) return;

    const agentId = task.agent_id;
    const personality = PERSONALITIES[agentId];
    if (!personality) return;

    switch (event.event_type) {
      case "task_completed": {
        const delay = this.scaleDelay(personality.repost_delay_ms);
        logger.info({ agentId, taskId: event.task_id, repostIn: delay }, "Demo agent task completed, scheduling repost");
        this.scheduleRepost(agentId, delay);
        break;
      }
      case "task_cancelled": {
        const delay = this.scaleDelay(personality.repost_cancelled_delay_ms);
        logger.info({ agentId, taskId: event.task_id, repostIn: delay }, "Demo agent task cancelled, scheduling repost");
        this.scheduleRepost(agentId, delay);
        break;
      }
      case "checkpoint_verified": {
        logger.debug({ agentId, taskId: event.task_id }, "Demo agent checkpoint progress");
        break;
      }
    }
  }

  private fillGaps(): void {
    const agents = this.db
      .prepare("SELECT * FROM agents")
      .all() as AgentRow[];

    for (const agent of agents) {
      const personality = PERSONALITIES[agent.agent_id];
      if (!personality) continue;

      const catalog = TASK_CATALOG[agent.agent_id];
      if (!catalog || catalog.length === 0) continue;

      const activeTasks = this.db
        .prepare(
          "SELECT COUNT(*) as count FROM tasks WHERE agent_id = ? AND status IN ('pending', 'awaiting_stream', 'streaming', 'verifying')",
        )
        .get(agent.agent_id) as { count: number };

      const gap = personality.max_active_tasks - activeTasks.count;
      if (gap <= 0) continue;

      for (let i = 0; i < gap; i++) {
        this.postRandomTask(agent.agent_id).catch((err) => {
          logger.warn({ err, agentId: agent.agent_id }, "Failed to fill task gap");
        });
      }
    }
  }

  private async postRandomTask(agentId: string): Promise<void> {
    const catalog = TASK_CATALOG[agentId];
    if (!catalog || catalog.length === 0) return;

    const personality = PERSONALITIES[agentId];
    if (!personality) return;

    // Check active count before posting
    const activeTasks = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE agent_id = ? AND status IN ('pending', 'awaiting_stream', 'streaming', 'verifying')",
      )
      .get(agentId) as { count: number };

    if (activeTasks.count >= personality.max_active_tasks) return;

    const agent = this.db
      .prepare("SELECT * FROM agents WHERE agent_id = ?")
      .get(agentId) as AgentRow | undefined;

    const template = catalog[Math.floor(Math.random() * catalog.length)];

    const taskId = await this.taskManager.createTask({
      agent_id: agentId,
      title: template.title,
      description: template.description,
      webhook_url: this.webhookUrl,
      checkpoints: template.checkpoints,
      escrow_lamports: template.escrow_lamports,
      payout_cents: template.payout_cents,
      agent_wallet: agent?.wallet_address ?? undefined,
      max_duration_seconds: template.max_duration_seconds,
    });

    logger.info({ agentId, taskId, title: template.title }, "Demo agent posted new task");
  }

  private scaleDelay(personalityDelay: number): number {
    const ratio = this.baseDelay / 60_000;
    return Math.round(personalityDelay * ratio);
  }
}
