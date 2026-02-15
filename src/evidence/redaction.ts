import { logger } from "../logger.js";
import type { RedactionConfig, RedactionResult } from "./types.js";

/**
 * Evidence redaction middleware.
 *
 * DESIGN PRINCIPLE: Fail-closed.
 * If redaction service errors, DO NOT store the unredacted frame. Drop it.
 */

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

  async process(frameB64: string): Promise<RedactionResult> {
    const start = Date.now();

    if (!this.config.blur_faces && !this.config.blur_text) {
      return {
        redacted: false,
        dropped: false,
        frame_b64: frameB64,
        detections: [],
        processing_ms: Date.now() - start,
      };
    }

    if (this.serviceUrl) {
      return this.processWithService(frameB64, start);
    }

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
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(`Redaction service returned ${res.status}`);
      }

      const result = (await res.json()) as RedactionResult;
      result.processing_ms = Date.now() - startTime;
      return result;
    } catch (err) {
      logger.error({ err }, "Redaction service error");

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

      return {
        redacted: false,
        dropped: false,
        frame_b64: frameB64,
        detections: [],
        processing_ms: Date.now() - startTime,
      };
    }
  }

  static isPrivateLocation(sceneClass: string): boolean {
    return PRIVATE_LOCATION_CLASSES.has(sceneClass.toLowerCase());
  }
}
