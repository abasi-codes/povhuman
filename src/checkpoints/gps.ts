const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lng points in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export interface GpsReading {
  lat: number;
  lng: number;
  accuracy_m: number;
  timestamp?: string;
}

export interface GpsTarget {
  lat: number;
  lng: number;
  radius_m: number;
}

export interface GpsResult {
  distance_m: number;
  within_radius: boolean;
  confidence: number;
}

/**
 * Evaluate a GPS reading against a target geofence.
 * Confidence:
 *   - Within radius: 1.0
 *   - Up to 2x radius: linear decay from 1.0 to 0.0
 *   - Beyond 2x radius: 0.0
 */
export function evaluateGpsCheckpoint(
  reading: GpsReading,
  target: GpsTarget,
): GpsResult {
  const distance = haversineDistance(reading.lat, reading.lng, target.lat, target.lng);
  const within = distance <= target.radius_m;

  let confidence: number;
  if (within) {
    confidence = 1.0;
  } else if (distance <= target.radius_m * 2) {
    confidence = 1.0 - (distance - target.radius_m) / target.radius_m;
  } else {
    confidence = 0.0;
  }

  return {
    distance_m: Math.round(distance),
    within_radius: within,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}
