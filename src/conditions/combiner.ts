/**
 * Combine multiple yes/no conditions into a single Trio prompt.
 *
 * This reduces job count (max 10 concurrent per account) by testing
 * multiple conditions in one job. The VLM will answer each sub-condition
 * and the explanation will indicate which ones triggered.
 */
export function combineConditions(conditions: string[]): string {
  if (conditions.length === 0) {
    throw new Error("At least one condition is required");
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  const numbered = conditions
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  return (
    `Check ALL of the following conditions and report YES if ANY of them are true. ` +
    `For each condition, state whether it is true or false, then give a brief explanation.\n\n` +
    `${numbered}\n\n` +
    `Respond YES if at least one condition is true. Respond NO if none are true.`
  );
}

/**
 * Validate that a condition is phrased as a yes/no question.
 * Returns null if valid, or an error message if invalid.
 */
export function validateCondition(condition: string): string | null {
  const trimmed = condition.trim();

  if (trimmed.length < 10) {
    return "Condition is too short. Provide a descriptive yes/no question.";
  }

  if (trimmed.length > 1000) {
    return "Condition is too long. Keep it under 1000 characters.";
  }

  // Check for yes/no question indicators
  const yesNoIndicators = [
    /^is\s/i,
    /^are\s/i,
    /^does\s/i,
    /^do\s/i,
    /^can\s/i,
    /^has\s/i,
    /^have\s/i,
    /^will\s/i,
    /^should\s/i,
    /\?$/,
  ];

  const hasIndicator = yesNoIndicators.some((re) => re.test(trimmed));
  if (!hasIndicator) {
    return "Condition should be a yes/no question (e.g., 'Is there a person visible?'). Start with Is/Are/Does/Do or end with a question mark.";
  }

  return null;
}
