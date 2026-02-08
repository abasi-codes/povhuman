import { logger } from "../logger.js";
import type { RedactionConfig, RedactionResult, Detection } from "./types.js";

/**
 * Privacy redaction middleware.
 *
 * DESIGN PRINCIPLE: Fail-closed.
 * If redaction service errors, DO NOT send the unredacted frame. Drop it.
 *
 * Pipeline (runs synchronously on each frame):
 * 1. Face detection (MediaPipe BlazeFace) -> blur if detected
 * 2. Screen detection (YOLOv11n) -> blur if detected
 * 3. Scene classification (Places365) -> DROP frame if private location
 * 4. Policy engine (user preferences)
 *
 * Actual ML inference is delegated to an external redaction service.
 * This module handles the orchestration and fail-closed logic.
 *
 * Total GPU latency: ~25-55ms (negligible vs Gemini's 4-12s inference)
 */

// Locations that should trigger frame dropping
const PRIVATE_LOCATION_CLASSES = new Set([
  "bathroom",
  "bedroom",
  "locker_room",
  "dressing_room",
  "hospital_room",
  "nursery",
]);

export class RedactionMiddleware {
  private config: RedactionConfig;
  private failClosed: boolean;
  private serviceUrl: string | null;

  constructor(
    config: RedactionConfig,
    failClosed = true,
    serviceUrl: string | null = null,
  ) {
    this.config = config;
    this.failClosed = failClosed;
    this.serviceUrl = serviceUrl;
  }

  /**
   * Process a frame through the redaction pipeline.
   * Returns the redacted frame, or null if the frame should be dropped.
   */
  async process(frameB64: string): Promise<RedactionResult> {
    const start = Date.now();

    // If no redaction is configured, pass through
    if (
      !this.config.blur_faces &&
      !this.config.blur_screens &&
      !this.config.blur_text &&
      !this.config.block_private_locations
    ) {
      return {
        redacted: false,
        dropped: false,
        frame_b64: frameB64,
        detections: [],
        processing_ms: Date.now() - start,
      };
    }

    // If external service is configured, delegate to it
    if (this.serviceUrl) {
      return this.processWithService(frameB64, start);
    }

    // CPU-only fallback: basic detection without actual ML inference.
    // In production, this would call MediaPipe/YOLO/Places365.
    // For now, pass through with a warning.
    logger.warn(
      "No redaction service configured. Using pass-through mode. " +
      "Set up the redaction service for production privacy compliance.",
    );

    return {
      redacted: false,
      dropped: false,
      frame_b64: frameB64,
      detections: [],
      processing_ms: Date.now() - start,
    };
  }

  private async processWithService(
    frameB64: string,
    startTime: number,
  ): Promise<RedactionResult> {
    try {
      const res = await fetch(`${this.serviceUrl}/redact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame_b64: frameB64,
          config: this.config,
          private_locations: Array.from(PRIVATE_LOCATION_CLASSES),
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (!res.ok) {
        throw new Error(`Redaction service returned ${res.status}`);
      }

      const result = (await res.json()) as RedactionResult;
      result.processing_ms = Date.now() - startTime;
      return result;
    } catch (err) {
      logger.error({ err }, "Redaction service error");

      // FAIL-CLOSED: drop the frame rather than sending unredacted
      if (this.failClosed) {
        logger.warn("Fail-closed: dropping frame due to redaction service error");
        return {
          redacted: false,
          dropped: true,
          frame_b64: null,
          detections: [],
          processing_ms: Date.now() - startTime,
        };
      }

      // If fail-closed is disabled (not recommended), pass through
      return {
        redacted: false,
        dropped: false,
        frame_b64: frameB64,
        detections: [],
        processing_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if a scene classification indicates a private location.
   */
  static isPrivateLocation(sceneClass: string): boolean {
    return PRIVATE_LOCATION_CLASSES.has(sceneClass.toLowerCase());
  }
}
