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
};

function trioHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey.startsWith("AIza")) {
    headers["X-Google-Api-Key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

async function validateStreamUrl(
  videoUrl: string,
  apiKey: string,
): Promise<{ valid: boolean; is_live?: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${TRIO_BASE}/validate-url?url=${encodeURIComponent(videoUrl)}`,
      { headers: trioHeaders(apiKey) },
    );
    if (!res.ok) return { valid: false, error: `validate-url returned ${res.status}` };
    return await res.json();
  } catch {
    return { valid: false, error: "validate-url request failed" };
  }
}

async function callCheckOnce(
  videoUrl: string,
  condition: string,
  apiKey: string,
): Promise<{ ok: boolean; body: any; status: number }> {
  const res = await fetch(`${TRIO_BASE}/check-once`, {
    method: "POST",
    headers: trioHeaders(apiKey),
    body: JSON.stringify({ stream_url: videoUrl, condition }),
  });
  const body = await res.json();
  return { ok: res.ok, body, status: res.status };
}

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
        payout_cents: 0,
      });
    }

    const result = mockResults[task.agent_id] ?? { explanation: "Task activity detected and verified by Trio VLM." };
    return res.json({
      verified: true,
      explanation: result.explanation,
      payout_cents: task.payout_cents,
    });
  }

  // --- Real Trio verification ---
  try {
    // Step 1: Validate the URL with Trio before check-once
    const validation = await validateStreamUrl(video_url, apiKey);

    // Step 2: Call check-once
    let result = await callCheckOnce(video_url, task.condition, apiKey);

    // Step 3: If NOT_LIVESTREAM but validate-url said it's valid/live, retry once
    if (!result.ok && result.body?.error?.code === "NOT_LIVESTREAM") {
      if (validation.valid && validation.is_live !== false) {
        // Wait briefly and retry — Trio may need a moment to pick up the stream
        await new Promise((r) => setTimeout(r, 2000));
        result = await callCheckOnce(video_url, task.condition, apiKey);
      }
    }

    if (!result.ok) {
      const code = result.body?.error?.code;
      if (code === "NOT_LIVESTREAM") {
        const hint = validation.is_live === false
          ? "Trio could not detect an active livestream at this URL. The stream may have ended or is not publicly accessible."
          : "Trio could not verify this as an active livestream. Please ensure the stream is live and publicly accessible, then try again.";
        return res.json({ verified: false, explanation: hint });
      }
      const msg = result.body?.error?.message ?? `Trio returned ${result.status}`;
      return res.json({ verified: false, explanation: `Stream error: ${msg}` });
    }

    if (result.body.triggered) {
      return res.json({
        verified: true,
        explanation: result.body.explanation,
        payout_cents: task.payout_cents,
      });
    }

    return res.json({
      verified: false,
      explanation: result.body.explanation,
    });
  } catch (err: any) {
    return res.json({
      verified: false,
      explanation: `Stream error: ${err.message ?? "Unknown error"}`,
    });
  }
}
