const TRIO_BASE = "https://trio.machinefi.com/api";

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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const { id } = req.query;
  const task = DEMO_TASKS.find((t) => t.task_id === id);

  if (!task) {
    return res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
  }

  const { video_url } = req.body ?? {};
  if (!video_url || typeof video_url !== "string") {
    return res.status(400).json({ error: "video_url is required", code: "VALIDATION_ERROR" });
  }

  const apiKey = process.env.TRIO_API_KEY;

  // --- Mock fallback when no API key is configured ---
  if (!apiKey) {
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

  // --- Real Trio verification ---
  try {
    const trioRes = await fetch(`${TRIO_BASE}/check-once`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        stream_url: video_url,
        condition: task.condition,
      }),
    });

    const body = await trioRes.json();

    // Trio returns 4xx with error object for non-livestream URLs
    if (!trioRes.ok) {
      const code = body?.error?.code;
      if (code === "NOT_LIVESTREAM") {
        return res.json({
          verified: false,
          explanation:
            "The URL provided is not an active YouTube livestream. Please submit a URL with a LIVE badge.",
        });
      }
      const msg = body?.error?.message ?? `Trio returned ${trioRes.status}`;
      return res.json({ verified: false, explanation: `Stream error: ${msg}` });
    }

    if (body.triggered) {
      return res.json({
        verified: true,
        explanation: body.explanation,
        payout_cents: task.payout_cents,
      });
    }

    return res.json({
      verified: false,
      explanation: body.explanation,
    });
  } catch (err: any) {
    return res.json({
      verified: false,
      explanation: `Stream error: ${err.message ?? "Unknown error"}`,
    });
  }
}
