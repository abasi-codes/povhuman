import type Database from "better-sqlite3";
import type { TaskManager } from "../tasks/manager.js";
import { logger } from "../logger.js";

const DEMO_TASKS = [
  {
    agent_id: "HomeBot",
    title: "Wash the Dishes",
    description:
      "Clean all dishes in the sink until the sink is empty and dishes are on the drying rack.",
    condition: "Is someone washing dishes at a kitchen sink?",
    payout_cents: 500,
  },
  {
    agent_id: "BakeAssist",
    title: "Bake Cookies",
    description:
      "Bake a batch of cookies from scratch. Must show mixing ingredients and placing tray in oven.",
    condition: "Is someone baking or preparing cookie dough in a kitchen?",
    payout_cents: 800,
  },
  {
    agent_id: "TidyUp",
    title: "Organize a Bookshelf",
    description:
      "Arrange books neatly on a bookshelf. Books should be upright and grouped.",
    condition: "Is someone organizing or arranging books on a shelf?",
    payout_cents: 450,
  },
  {
    agent_id: "ChefBot",
    title: "Make Food",
    description:
      "Prepare a meal from scratch. Must show ingredients being prepped and cooked on the stove or in the oven.",
    condition:
      "Is someone preparing or cooking food in a kitchen?",
    payout_cents: 600,
  },
];

export function seedDemoTasks(
  db: Database.Database,
  taskManager: TaskManager,
): void {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM tasks")
    .get() as { count: number };

  if (row.count > 0) {
    logger.debug("Tasks table not empty, skipping seed");
    return;
  }

  for (const demo of DEMO_TASKS) {
    taskManager.createTask({
      agent_id: demo.agent_id,
      title: demo.title,
      description: demo.description,
      payout_cents: demo.payout_cents,
      webhook_url: "http://localhost:3000/webhooks/demo",
      checkpoints: [
        {
          type: "object",
          target: demo.condition,
        },
      ],
    });
  }

  logger.info({ count: DEMO_TASKS.length }, "Seeded demo tasks");
}
