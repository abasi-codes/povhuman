import type Database from "better-sqlite3";
import { logger } from "../logger.js";

/**
 * Purge expired verification events and clear old evidence frames.
 */
export function startRetentionWorker(
  db: Database.Database,
  intervalMs = 60_000,
): ReturnType<typeof setInterval> {
  const purgeExpired = db.prepare(`
    DELETE FROM verification_events
    WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
  `);

  const clearExpiredFrames = db.prepare(`
    UPDATE verification_events
    SET evidence_frame_b64 = NULL
    WHERE evidence_frame_b64 IS NOT NULL
      AND created_at < datetime('now', '-60 minutes')
  `);

  const clearCheckpointFrames = db.prepare(`
    UPDATE checkpoints
    SET evidence_frame_b64 = NULL
    WHERE evidence_frame_b64 IS NOT NULL
      AND verified_at IS NOT NULL
      AND verified_at < datetime('now', '-60 minutes')
  `);

  return setInterval(() => {
    try {
      const deleted = purgeExpired.run();
      const cleared = clearExpiredFrames.run();
      const checkpointCleared = clearCheckpointFrames.run();
      if (deleted.changes > 0 || cleared.changes > 0 || checkpointCleared.changes > 0) {
        logger.debug(
          {
            eventsDeleted: deleted.changes,
            eventFramesCleared: cleared.changes,
            checkpointFramesCleared: checkpointCleared.changes,
          },
          "Retention cleanup",
        );
      }
    } catch (err) {
      logger.error({ err }, "Retention worker error");
    }
  }, intervalMs);
}
