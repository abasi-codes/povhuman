export interface RedactionResult {
  redacted: boolean;
  dropped: boolean;
  frame_b64: string | null;
  detections: Detection[];
  processing_ms: number;
}

export interface Detection {
  type: "face" | "text" | "private_location";
  confidence: number;
  action: "blur" | "drop";
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface RedactionConfig {
  blur_faces: boolean;
  blur_text: boolean;
}

export interface EvidenceCapture {
  checkpoint_id: string;
  frame_b64: string | null;
  explanation: string;
  confidence: number;
  captured_at: string;
}
