import type Database from "better-sqlite3";
import type { TaskManager } from "../tasks/manager.js";
import { logger } from "../logger.js";

const DEMO_AGENTS = [
  {
    agent_id: "HomeBot",
    name: "HomeBot",
    description: "Home maintenance and cleaning task agent",
    avatar: "\uD83C\uDFE0",
    wallet_address: "HoMeBotXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1",
  },
  {
    agent_id: "BakeAssist",
    name: "BakeAssist",
    description: "Baking and kitchen assistant agent",
    avatar: "\uD83C\uDF6A",
    wallet_address: "BakeAsstXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2",
  },
  {
    agent_id: "TidyUp",
    name: "TidyUp",
    description: "Organization and tidying task agent",
    avatar: "\uD83D\uDCDA",
    wallet_address: "TidyUpXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3",
  },
  {
    agent_id: "ChefBot",
    name: "ChefBot",
    description: "Cooking and meal preparation agent",
    avatar: "\uD83D\uDC68\u200D\uD83C\uDF73",
    wallet_address: "ChefBotXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX4",
  },
  {
    agent_id: "DataBot",
    name: "DataBot",
    description: "Data entry and digital task verification agent",
    avatar: "\uD83D\uDCCA",
    wallet_address: "DataBotXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX5",
  },
  {
    agent_id: "ErrandBot",
    name: "ErrandBot",
    description: "Errand running and delivery verification agent",
    avatar: "\uD83D\uDCE6",
    wallet_address: "ErrandBtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX6",
  },
];

const DEMO_TASKS = [
  {
    task_id: "task-wash-dishes",
    agent_id: "HomeBot",
    title: "Wash the Dishes",
    description:
      "Clean all dishes in the sink until the sink is empty and dishes are on the drying rack.",
    escrow_lamports: 500_000_000, // 0.5 SOL
    payout_cents: 500,
    checkpoints: [
      { type: "object", target: "Is someone washing dishes at a kitchen sink?" },
      { type: "object", target: "Is the kitchen sink empty with clean dishes on a drying rack?" },
    ],
  },
  {
    task_id: "task-bake-cookies",
    agent_id: "BakeAssist",
    title: "Bake Cookies",
    description:
      "Bake a batch of cookies from scratch. Must show mixing ingredients and placing tray in oven.",
    escrow_lamports: 800_000_000, // 0.8 SOL
    payout_cents: 800,
    checkpoints: [
      { type: "object", target: "Is someone mixing cookie dough or batter in a bowl?" },
      { type: "object", target: "Is someone placing a baking tray with cookies into an oven?" },
      { type: "object", target: "Are freshly baked cookies visible on a cooling rack or tray?" },
    ],
  },
  {
    task_id: "task-organize-bookshelf",
    agent_id: "TidyUp",
    title: "Organize a Bookshelf",
    description:
      "Arrange books neatly on a bookshelf. Books should be upright and grouped.",
    escrow_lamports: 450_000_000, // 0.45 SOL
    payout_cents: 450,
    checkpoints: [
      { type: "object", target: "Is someone removing books from a messy or disorganized shelf?" },
      { type: "object", target: "Are books arranged upright and grouped neatly on a bookshelf?" },
    ],
  },
  {
    task_id: "task-make-food",
    agent_id: "ChefBot",
    title: "Cook a Meal",
    description:
      "Prepare a meal from scratch. Must show ingredients being prepped and cooked on the stove or in the oven.",
    escrow_lamports: 600_000_000, // 0.6 SOL
    payout_cents: 600,
    checkpoints: [
      { type: "object", target: "Is someone chopping or preparing ingredients on a cutting board?" },
      { type: "object", target: "Is food being cooked on a stovetop or in an oven?" },
    ],
  },
  {
    task_id: "task-data-entry",
    agent_id: "DataBot",
    title: "Complete Data Entry Form",
    description:
      "Fill out a structured data form on a computer. All required fields must be completed.",
    escrow_lamports: 300_000_000, // 0.3 SOL
    payout_cents: 300,
    checkpoints: [
      { type: "object", target: "Is someone typing data into a spreadsheet or form on a computer screen?" },
      { type: "document", target: "Is a completed form or spreadsheet visible with all fields filled in?" },
    ],
  },
  {
    task_id: "task-pickup-package",
    agent_id: "ErrandBot",
    title: "Pick Up Package",
    description:
      "Go to the designated pickup location and collect the package. Show the receipt.",
    escrow_lamports: 750_000_000, // 0.75 SOL
    payout_cents: 750,
    checkpoints: [
      { type: "location", target: "Is the person at a store, post office, or pickup counter?" },
      { type: "object", target: "Is the person holding a package or parcel?" },
      { type: "document", target: "Is a receipt or proof of pickup visible?" },
    ],
  },
];

export async function seedDemoTasks(
  db: Database.Database,
  taskManager: TaskManager,
): Promise<void> {
  // Seed agents table first
  const agentCount = db
    .prepare("SELECT COUNT(*) as count FROM agents")
    .get() as { count: number };

  if (agentCount.count === 0) {
    const insertAgent = db.prepare(
      "INSERT OR IGNORE INTO agents (agent_id, name, description, avatar, wallet_address) VALUES (?, ?, ?, ?, ?)",
    );
    for (const agent of DEMO_AGENTS) {
      insertAgent.run(agent.agent_id, agent.name, agent.description, agent.avatar, agent.wallet_address);
    }
    logger.info({ count: DEMO_AGENTS.length }, "Seeded demo agents");
  }

  // Seed tasks
  const taskCount = db
    .prepare("SELECT COUNT(*) as count FROM tasks")
    .get() as { count: number };

  if (taskCount.count > 0) {
    logger.debug("Tasks table not empty, skipping seed");
    return;
  }

  for (const demo of DEMO_TASKS) {
    const agent = DEMO_AGENTS.find((a) => a.agent_id === demo.agent_id);
    await taskManager.createTask({
      task_id: demo.task_id,
      agent_id: demo.agent_id,
      title: demo.title,
      description: demo.description,
      payout_cents: demo.payout_cents,
      escrow_lamports: demo.escrow_lamports,
      agent_wallet: agent?.wallet_address,
      webhook_url: "http://localhost:3000/webhooks/demo",
      checkpoints: demo.checkpoints,
    });
  }

  logger.info({ count: DEMO_TASKS.length }, "Seeded demo tasks");
}
