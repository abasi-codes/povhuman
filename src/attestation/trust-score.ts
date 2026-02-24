export interface TrustScore {
  score: number;
  grade: "A" | "B" | "C" | "F";
  breakdown: {
    vlm: number;
    vlm_weighted: number;
    gps: number;
    gps_weighted: number;
    attestation: number;
    attestation_weighted: number;
  };
  flags: string[];
}

const VLM_WEIGHT = 0.5;
const GPS_WEIGHT = 0.3;
const ATTESTATION_WEIGHT = 0.2;

function gradeFromScore(score: number): "A" | "B" | "C" | "F" {
  if (score >= 0.9) return "A";
  if (score >= 0.7) return "B";
  if (score >= 0.5) return "C";
  return "F";
}

/**
 * Compute a combined trust score from all available verification signals.
 *
 * @param vlmConfidence - VLM visual confidence (0-1)
 * @param gpsConfidence - GPS geofence confidence (0-1), undefined if no GPS data
 * @param attestationValid - Device attestation passed, undefined if not submitted
 */
export function computeTrustScore(
  vlmConfidence: number,
  gpsConfidence?: number,
  attestationValid?: boolean,
): TrustScore {
  const flags: string[] = [];

  const vlm = Math.max(0, Math.min(1, vlmConfidence));
  const gps = gpsConfidence != null ? Math.max(0, Math.min(1, gpsConfidence)) : 0;
  const attestation = attestationValid === true ? 1 : 0;

  // Track which signals are available
  if (gpsConfidence == null) flags.push("no_gps_data");
  if (attestationValid == null) flags.push("no_attestation");

  const vlmWeighted = vlm * VLM_WEIGHT;
  const gpsWeighted = gps * GPS_WEIGHT;
  const attestationWeighted = attestation * ATTESTATION_WEIGHT;

  const score = Math.round((vlmWeighted + gpsWeighted + attestationWeighted) * 1000) / 1000;

  return {
    score,
    grade: gradeFromScore(score),
    breakdown: {
      vlm,
      vlm_weighted: vlmWeighted,
      gps,
      gps_weighted: gpsWeighted,
      attestation,
      attestation_weighted: attestationWeighted,
    },
    flags,
  };
}
