export interface AgentPersonality {
  repost_delay_ms: number;
  repost_cancelled_delay_ms: number;
  max_active_tasks: number;
  verification_strictness: "low" | "medium" | "high";
}

export const PERSONALITIES: Record<string, AgentPersonality> = {
  HomeBot: {
    repost_delay_ms: 60_000,
    repost_cancelled_delay_ms: 30_000,
    max_active_tasks: 2,
    verification_strictness: "medium",
  },
  BakeAssist: {
    repost_delay_ms: 90_000,
    repost_cancelled_delay_ms: 45_000,
    max_active_tasks: 1,
    verification_strictness: "high",
  },
  TidyUp: {
    repost_delay_ms: 45_000,
    repost_cancelled_delay_ms: 20_000,
    max_active_tasks: 2,
    verification_strictness: "medium",
  },
  ChefBot: {
    repost_delay_ms: 75_000,
    repost_cancelled_delay_ms: 35_000,
    max_active_tasks: 1,
    verification_strictness: "high",
  },
  DataBot: {
    repost_delay_ms: 30_000,
    repost_cancelled_delay_ms: 15_000,
    max_active_tasks: 3,
    verification_strictness: "low",
  },
  ErrandBot: {
    repost_delay_ms: 120_000,
    repost_cancelled_delay_ms: 60_000,
    max_active_tasks: 2,
    verification_strictness: "medium",
  },
};
