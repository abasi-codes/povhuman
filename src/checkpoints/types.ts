export type CheckpointType =
  | "location"
  | "object"
  | "document"
  | "gps"
  | "person"
  | "action"
  | "duration"
  | "text";

export interface GpsCheckpointConfig {
  lat: number;
  lng: number;
  radius_m: number;
}

export interface CheckpointTemplate {
  type: CheckpointType;
  label: string;
  description: string;
  prompt_template: string;
  default_confidence: number;
  available: boolean; // false = scaffolded for later
}

/**
 * POC: 3 checkpoint types (location, object, document).
 * Remaining 4 scaffolded for future implementation.
 */
export const CHECKPOINT_TEMPLATES: Record<CheckpointType, CheckpointTemplate> = {
  location: {
    type: "location",
    label: "Location Verification",
    description: "Verify the person is at a specific location",
    prompt_template:
      "Is the person currently at or near {target}? Look for visual indicators " +
      "like signs, landmarks, street names, building facades, or distinctive features " +
      "that confirm the location. Respond YES if location is confirmed, NO if not.",
    default_confidence: 0.8,
    available: true,
  },
  gps: {
    type: "gps",
    label: "GPS Geofence",
    description: "Verify the device is within a GPS geofence radius",
    prompt_template:
      "GPS geofence checkpoint: target coordinates in {target}. " +
      "This checkpoint is verified via device GPS, not visual analysis.",
    default_confidence: 0.9,
    available: true,
  },
  object: {
    type: "object",
    label: "Object Detection",
    description: "Verify a specific object is visible in the scene",
    prompt_template:
      "Is {target} clearly visible in the current scene? Look carefully for the " +
      "object. It should be identifiable and prominently visible. Respond YES if " +
      "the object is present, NO if not.",
    default_confidence: 0.8,
    available: true,
  },
  document: {
    type: "document",
    label: "Document Verification",
    description: "Verify a document or receipt is shown to the camera",
    prompt_template:
      "Is the person showing {target} to the camera? The document should be " +
      "legible enough to confirm its type and key details. Respond YES if the " +
      "document is visible and identifiable, NO if not.",
    default_confidence: 0.85,
    available: true,
  },
  person: {
    type: "person",
    label: "Person Detection",
    description: "Verify a specific person or role is present",
    prompt_template:
      "Is {target} visible in the scene? Look for identifying characteristics. " +
      "Respond YES if confirmed, NO if not.",
    default_confidence: 0.75,
    available: false,
  },
  action: {
    type: "action",
    label: "Action Verification",
    description: "Verify a specific action is being performed",
    prompt_template:
      "Is the person currently performing the following action: {target}? " +
      "Respond YES if the action is clearly happening, NO if not.",
    default_confidence: 0.7,
    available: false,
  },
  duration: {
    type: "duration",
    label: "Duration Check",
    description: "Verify continuous presence over a time period",
    prompt_template:
      "Is {target} still present and active in the scene? This is a duration " +
      "check — confirm continued presence. Respond YES if still present, NO if not.",
    default_confidence: 0.7,
    available: false,
  },
  text: {
    type: "text",
    label: "Text Recognition",
    description: "Verify specific text is visible in the scene",
    prompt_template:
      "Is the text \"{target}\" visible anywhere in the scene? Look for signs, " +
      "labels, screens, or documents containing this text. Respond YES if found, NO if not.",
    default_confidence: 0.85,
    available: false,
  },
};
