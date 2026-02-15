import { CHECKPOINT_TEMPLATES } from "./types.js";
import type { CheckpointType } from "./types.js";
import type { CheckpointRow } from "../db/schema.js";

/**
 * Build a Trio condition string from a checkpoint type and target.
 */
export function buildTrioCondition(type: CheckpointType, target: string): string {
  const template = CHECKPOINT_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown checkpoint type: ${type}`);
  }
  return template.prompt_template.replace("{target}", target);
}

/**
 * Build a combined Trio condition for multiple checkpoints.
 * Each checkpoint is numbered so the VLM response can be parsed per-checkpoint.
 */
export function buildCombinedCondition(checkpoints: CheckpointRow[]): string {
  if (checkpoints.length === 0) {
    throw new Error("At least one checkpoint is required");
  }

  if (checkpoints.length === 1) {
    return buildTrioCondition(checkpoints[0].type as CheckpointType, checkpoints[0].target);
  }

  const numbered = checkpoints
    .map((cp, i) => {
      const condition = buildTrioCondition(cp.type as CheckpointType, cp.target);
      return `CHECKPOINT ${i + 1} [${cp.checkpoint_id}]: ${condition}`;
    })
    .join("\n\n");

  return (
    `You are verifying task completion. Check ALL of the following checkpoints ` +
    `and report the status of EACH one individually.\n\n` +
    `${numbered}\n\n` +
    `For each checkpoint, respond with:\n` +
    `- CHECKPOINT <number>: YES (confidence: 0.0-1.0) - <brief explanation>\n` +
    `- CHECKPOINT <number>: NO - <brief explanation>\n\n` +
    `Respond YES for a checkpoint ONLY if you have clear visual evidence. ` +
    `Be precise about what you see.`
  );
}

interface CheckpointResult {
  checkpoint_id: string;
  passed: boolean;
  confidence: number;
  explanation: string;
}

/**
 * Parse a Trio VLM response to extract per-checkpoint results.
 */
export function parseTrioResponse(
  explanation: string,
  checkpoints: CheckpointRow[],
): CheckpointResult[] {
  if (checkpoints.length === 1) {
    // Single checkpoint: parse YES/NO from the full explanation
    const passed = /\byes\b/i.test(explanation);
    const confidenceMatch = explanation.match(/confidence:\s*([\d.]+)/i);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : passed ? 0.85 : 0.1;

    return [
      {
        checkpoint_id: checkpoints[0].checkpoint_id,
        passed,
        confidence: Math.min(1, Math.max(0, confidence)),
        explanation: explanation.trim(),
      },
    ];
  }

  // Multi-checkpoint: parse per-checkpoint responses
  const results: CheckpointResult[] = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const cpNum = i + 1;
    // Match patterns like "CHECKPOINT 1: YES" or "CHECKPOINT 1: NO"
    const pattern = new RegExp(
      `CHECKPOINT\\s+${cpNum}\\s*:\\s*(YES|NO)(?:\\s*\\(confidence:\\s*([\\d.]+)\\))?\\s*[-–]?\\s*(.*)`,
      "i",
    );
    const match = explanation.match(pattern);

    if (match) {
      const passed = match[1].toUpperCase() === "YES";
      const confidence = match[2] ? parseFloat(match[2]) : passed ? 0.85 : 0.1;
      results.push({
        checkpoint_id: checkpoints[i].checkpoint_id,
        passed,
        confidence: Math.min(1, Math.max(0, confidence)),
        explanation: match[3]?.trim() || "",
      });
    } else {
      // Fallback: mark as not passed if we can't parse the response
      results.push({
        checkpoint_id: checkpoints[i].checkpoint_id,
        passed: false,
        confidence: 0,
        explanation: "Could not parse verification response for this checkpoint",
      });
    }
  }

  return results;
}
