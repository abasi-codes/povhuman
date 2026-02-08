/**
 * Preset conditions for common monitoring scenarios.
 * All conditions MUST be phrased as yes/no questions with context.
 */
export interface ConditionPreset {
  id: string;
  label: string;
  condition: string;
  recommended_interval: number;
  recommended_input_mode: "frames" | "clip" | "hybrid";
}

export const CONDITION_PRESETS: ConditionPreset[] = [
  {
    id: "person_talking",
    label: "Person talking to me",
    condition:
      "Is there a person facing the camera and appearing to speak or address the viewer? Look for an individual who is looking directly at the camera, has their mouth open or moving, and is within conversational distance (roughly within 2 meters).",
    recommended_interval: 15,
    recommended_input_mode: "hybrid",
  },
  {
    id: "indoors",
    label: "Am I indoors?",
    condition:
      "Is the scene currently indoors? Look for ceilings, walls, artificial lighting, furniture, or other indoor indicators. Answer yes if the scene is clearly inside a building.",
    recommended_interval: 30,
    recommended_input_mode: "frames",
  },
  {
    id: "laptop_screen",
    label: "Laptop/screen visible",
    condition:
      "Is there a laptop screen, computer monitor, tablet, or phone screen clearly visible in the frame? The screen should be readable or at least identifiable as an electronic display that is turned on.",
    recommended_interval: 30,
    recommended_input_mode: "frames",
  },
  {
    id: "driving",
    label: "Am I driving?",
    condition:
      "Does the scene show a vehicle dashboard, steering wheel, road view through a windshield, or any other clear indicator that the viewer is inside a moving vehicle or driving? Look for road markings, other vehicles, traffic signals, or dashboard instruments.",
    recommended_interval: 15,
    recommended_input_mode: "clip",
  },
  {
    id: "crowd",
    label: "Crowd or line present",
    condition:
      "Are there more than 5 people visible in the scene, forming a crowd, queue, line, or group? Look for a gathering of people in close proximity.",
    recommended_interval: 30,
    recommended_input_mode: "frames",
  },
  {
    id: "qr_code",
    label: "QR code visible",
    condition:
      "Is there a QR code, barcode, or similar scannable code visible in the frame? Look for a square or rectangular pattern of black and white modules that appears to be a machine-readable code.",
    recommended_interval: 15,
    recommended_input_mode: "frames",
  },
];

export function getPreset(id: string): ConditionPreset | undefined {
  return CONDITION_PRESETS.find((p) => p.id === id);
}
