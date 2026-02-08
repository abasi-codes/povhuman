import { logger } from "../logger.js";

/**
 * YouTube Data API v3 quota tracker.
 *
 * Default quota: 10,000 units/day per Google Cloud project.
 * - videos.list: 1 unit (batch up to 50 IDs)
 * - search.list: 100 units (NEVER use for status checks)
 * - channels.list: 1 unit
 */
export class QuotaTracker {
  private dailyUsed = 0;
  private dailyLimit: number;
  private resetDate: string;

  constructor(dailyLimit = 10_000) {
    this.dailyLimit = dailyLimit;
    this.resetDate = this.todayKey();
  }

  /** Record quota usage. Returns false if over budget. */
  use(units: number): boolean {
    this.maybeReset();
    if (this.dailyUsed + units > this.dailyLimit) {
      logger.warn(
        { used: this.dailyUsed, limit: this.dailyLimit },
        "YouTube API quota exhausted",
      );
      return false;
    }
    this.dailyUsed += units;
    return true;
  }

  /** Check if we can afford `units` without recording them. */
  canAfford(units: number): boolean {
    this.maybeReset();
    return this.dailyUsed + units <= this.dailyLimit;
  }

  remaining(): number {
    this.maybeReset();
    return this.dailyLimit - this.dailyUsed;
  }

  private maybeReset(): void {
    const today = this.todayKey();
    if (today !== this.resetDate) {
      this.dailyUsed = 0;
      this.resetDate = today;
    }
  }

  private todayKey(): string {
    // YouTube quota resets at midnight Pacific Time
    return new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });
  }
}
