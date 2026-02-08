export interface RedactionResult {
  /** Whether redaction was applied */
  redacted: boolean;
  /** Whether the frame was dropped entirely (e.g., private location) */
  dropped: boolean;
  /** Base64 of the redacted frame, or null if dropped */
  frame_b64: string | null;
  /** What was detected and redacted */
  detections: Detection[];
  /** Processing time in ms */
  processing_ms: number;
}

export interface Detection {
  type: "face" | "screen" | "text" | "private_location";
  confidence: number;
  action: "blur" | "drop";
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface RedactionConfig {
  blur_faces: boolean;
  blur_screens: boolean;
  blur_text: boolean;
  block_private_locations: boolean;
}
