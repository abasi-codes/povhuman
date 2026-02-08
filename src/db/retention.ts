import type Database from "better-sqlite3";
import { logger } from "../logger.js";

/**
 * Purge expired perception events based on retention policy.
 * - Event metadata: retained for `eventHours` hours
 * - Frame data (frame_b64): retained for `frameMinutes` minutes
 * - No-storage mode: events have immediate expiry
 */
export function startRetentionWorker(
  db: Database.Database,
  intervalMs = 60_000,
): ReturnType<typeof setInterval> {
  const purgeExpired = db.prepare(`
    DELETE FROM perception_events
    WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
  `);

  const clearExpiredFrames = db.prepare(`
    UPDATE perception_events
    SET frame_b64 = NULL
    WHERE frame_b64 IS NOT NULL
      AND created_at < datetime('now', '-15 minutes')
  `);

  return setInterval(() => {
    try {
      const deleted = purgeExpired.run();
      const cleared = clearExpiredFrames.run();
      if (deleted.changes > 0 || cleared.changes > 0) {
        logger.debug(
          { eventsDeleted: deleted.changes, framesCleared: cleared.changes },
          "Retention cleanup",
        );
      }
    } catch (err) {
      logger.error({ err }, "Retention worker error");
    }
  }, intervalMs);
}
