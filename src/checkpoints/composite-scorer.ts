import type { GpsResult } from "./gps.js";
import type { IpGeoResult } from "./ip-geo.js";
import { haversineDistance } from "./gps.js";

export interface CompositeScore {
  score: number;
  breakdown: {
    vlm: number;
    gps: number;
    ip_penalty: number;
  };
  flags: string[];
}

const VLM_WEIGHT = 0.6;
const GPS_WEIGHT = 0.4;
const IP_DISTANCE_THRESHOLD_KM = 500;
const IP_PENALTY = 0.2;

/**
 * Compute a composite verification score from VLM confidence, GPS result,
 * and optional IP geolocation cross-check.
 */
export function computeCompositeScore(
  vlmConfidence: number,
  gpsResult: GpsResult | null,
  ipGeoResult?: IpGeoResult | null,
  gpsReading?: { lat: number; lng: number },
): CompositeScore {
  const flags: string[] = [];

  const vlmComponent = Math.max(0, Math.min(1, vlmConfidence));
  const gpsComponent = gpsResult ? gpsResult.confidence : 0;

  let ipPenalty = 0;

  if (ipGeoResult && gpsReading) {
    const ipToGpsKm = haversineDistance(
      ipGeoResult.lat,
      ipGeoResult.lng,
      gpsReading.lat,
      gpsReading.lng,
    ) / 1000;

    if (ipToGpsKm > IP_DISTANCE_THRESHOLD_KM) {
      ipPenalty = IP_PENALTY;
      flags.push(`ip_geo_mismatch: IP location ${Math.round(ipToGpsKm)}km from GPS reading`);
    }
  }

  if (gpsResult && !gpsResult.within_radius) {
    flags.push(`outside_geofence: ${gpsResult.distance_m}m from target`);
  }

  const rawScore = vlmComponent * VLM_WEIGHT + gpsComponent * GPS_WEIGHT;
  const score = Math.max(0, rawScore - ipPenalty);

  return {
    score: Math.round(score * 1000) / 1000,
    breakdown: {
      vlm: vlmComponent,
      gps: gpsComponent,
      ip_penalty: ipPenalty,
    },
    flags,
  };
}
