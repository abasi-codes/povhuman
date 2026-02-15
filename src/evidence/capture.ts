import { RedactionMiddleware } from "./redaction.js";
import type { RedactionConfig, EvidenceCapture } from "./types.js";

/**
 * Captures and processes evidence frames at checkpoint verification moments.
 * Applies redaction before storing.
 */
export class EvidenceCaptureService {
  private redaction: RedactionMiddleware;

  constructor(config: RedactionConfig, failClosed = true) {
    this.redaction = new RedactionMiddleware(config, failClosed);
  }

  /**
   * Capture evidence for a verified checkpoint.
   * Returns the (optionally redacted) frame and metadata.
   */
  async capture(
    checkpointId: string,
    frameB64: string | null,
    explanation: string,
    confidence: number,
  ): Promise<EvidenceCapture> {
    let processedFrame: string | null = null;

    if (frameB64) {
      const result = await this.redaction.process(frameB64);
      if (!result.dropped) {
        processedFrame = result.frame_b64;
      }
    }

    return {
      checkpoint_id: checkpointId,
      frame_b64: processedFrame,
      explanation,
      confidence,
      captured_at: new Date().toISOString(),
    };
  }
}
