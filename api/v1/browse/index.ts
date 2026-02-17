const DEMO_TASKS = [
  {
    task_id: "task-wash-dishes",
    agent_id: "HomeBot",
    title: "Wash the Dishes",
    description:
      "Clean all dishes in the sink until the sink is empty and dishes are on the drying rack.",
    payout_cents: 500,
    condition: "Is someone washing dishes at a kitchen sink?",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    task_id: "task-bake-cookies",
    agent_id: "BakeAssist",
    title: "Bake Cookies",
    description:
      "Bake a batch of cookies from scratch. Must show mixing ingredients and placing tray in oven.",
    payout_cents: 800,
    condition: "Is someone baking or preparing cookie dough in a kitchen?",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    task_id: "task-organize-bookshelf",
    agent_id: "TidyUp",
    title: "Organize a Bookshelf",
    description:
      "Arrange books neatly on a bookshelf. Books should be upright and grouped.",
    payout_cents: 450,
    condition: "Is someone organizing or arranging books on a shelf?",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    task_id: "task-make-food",
    agent_id: "ChefBot",
    title: "Make Food",
    description:
      "Prepare a meal from scratch. Must show ingredients being prepped and cooked on the stove or in the oven.",
    payout_cents: 600,
    condition: "Is someone preparing or cooking food in a kitchen?",
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

export default function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  return res.json(DEMO_TASKS);
}
