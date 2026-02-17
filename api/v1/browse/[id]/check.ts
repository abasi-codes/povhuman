const DEMO_TASKS = [
  {
    task_id: "task-wash-dishes",
    agent_id: "HomeBot",
    title: "Wash the Dishes",
    payout_cents: 500,
    condition: "Is someone washing dishes at a kitchen sink?",
  },
  {
    task_id: "task-bake-cookies",
    agent_id: "BakeAssist",
    title: "Bake Cookies",
    payout_cents: 800,
    condition: "Is someone baking or preparing cookie dough in a kitchen?",
  },
  {
    task_id: "task-organize-bookshelf",
    agent_id: "TidyUp",
    title: "Organize a Bookshelf",
    payout_cents: 450,
    condition: "Is someone organizing or arranging books on a shelf?",
  },
  {
    task_id: "task-make-food",
    agent_id: "ChefBot",
    title: "Make Food",
    payout_cents: 600,
    condition: "Is someone preparing or cooking food in a kitchen?",
  },
];

const confidenceByAgent: Record<string, number> = {
  HomeBot: 0.95,
  TidyUp: 0.91,
  ChefBot: 0.97,
};

export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const { id } = req.query;
  const task = DEMO_TASKS.find((t) => t.task_id === id);

  if (!task) {
    return res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
  }

  if (task.agent_id === "BakeAssist") {
    return res.json({
      verified: false,
      explanation:
        "Could not detect cookie baking activity. No evidence of mixing ingredients or placing a tray in the oven was observed.",
      confidence: 0.25,
      payout_cents: 0,
    });
  }

  const confidence = confidenceByAgent[task.agent_id] ?? 0.93;

  return res.json({
    verified: true,
    explanation: "Task activity detected and verified.",
    confidence,
    payout_cents: task.payout_cents,
  });
}
