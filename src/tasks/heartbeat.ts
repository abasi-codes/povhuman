import { logger } from "../logger.js";
import { TaskManager } from "./manager.js";
import { TrioClient } from "../trio/client.js";

/**
 * Task heartbeat: periodically polls Trio job status as a fallback
 * to webhooks, and detects jobs that stopped without a webhook notification.
 *
 * Runs every 30 seconds for all active tasks.
 */
export class HeartbeatMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private taskManager: TaskManager;
  private trio: TrioClient;
  private onJobStopped: (jobId: string, reason: string) => Promise<void>;

  constructor(
    taskManager: TaskManager,
    trio: TrioClient,
    onJobStopped: (jobId: string, reason: string) => Promise<void>,
  ) {
    this.taskManager = taskManager;
    this.trio = trio;
    this.onJobStopped = onJobStopped;
  }

  start(intervalMs = 30_000): void {
    this.interval = setInterval(() => this.check(), intervalMs);
    logger.info("Heartbeat monitor started");
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async check(): Promise<void> {
    const runningJobs = this.taskManager.getAllRunningJobs();

    for (const job of runningJobs) {
      try {
        const status = await this.trio.getJobStatus(job.job_id);

        if (status.status === "stopped" || status.status === "completed") {
          logger.info(
            { jobId: job.job_id, reason: status.stop_reason },
            "Heartbeat detected stopped job",
          );
          await this.onJobStopped(
            job.job_id,
            status.stop_reason || "unknown",
          );
        }
      } catch (err) {
        logger.debug({ err, jobId: job.job_id }, "Heartbeat check failed");
      }
    }
  }
}
