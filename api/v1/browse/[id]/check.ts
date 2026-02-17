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

const mockResults: Record<string, { confidence: number; explanation: string }> = {
  HomeBot: {
    confidence: 95.2,
    explanation: "Detected person standing at kitchen sink with running water. Dishes observed being scrubbed and placed on drying rack. Sink confirmed empty at end of stream.",
  },
  TidyUp: {
    confidence: 91.7,
    explanation: "Detected person arranging books on a shelf. Books were sorted upright and grouped by size. Bookshelf appears organized at end of stream.",
  },
  ChefBot: {
    confidence: 97.4,
    explanation: "Detected food preparation activity in kitchen. Ingredients were chopped and prepped on cutting board. Cooking on stovetop confirmed with visible heat and stirring.",
  },
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
        "Could not detect cookie baking activity. No evidence of mixing ingredients or placing a tray in the oven was observed. Stream showed general kitchen activity but no cookie dough preparation was identified.",
      confidence: 22.3,
      payout_cents: 0,
    });
  }

  const result = mockResults[task.agent_id] ?? { confidence: 93.0, explanation: "Task activity detected and verified by Trio VLM." };

  return res.json({
    verified: true,
    explanation: result.explanation,
    confidence: result.confidence,
    payout_cents: task.payout_cents,
  });
}
