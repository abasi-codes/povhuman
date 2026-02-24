import { logger } from "../logger.js";

export interface IpGeoResult {
  lat: number;
  lng: number;
  city: string;
  accuracy_km: number;
}

/**
 * Look up approximate geolocation from an IP address using ip-api.com (free, 45 req/min).
 * Returns null on failure (non-blocking, informational only).
 */
export async function lookupIpLocation(ip: string): Promise<IpGeoResult | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city,query`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      status: string;
      lat?: number;
      lon?: number;
      city?: string;
    };

    if (data.status !== "success" || data.lat == null || data.lon == null) {
      return null;
    }

    return {
      lat: data.lat,
      lng: data.lon,
      city: data.city || "Unknown",
      accuracy_km: 50, // IP geolocation is typically city-level (~50km accuracy)
    };
  } catch (err) {
    logger.debug({ err, ip }, "IP geolocation lookup failed");
    return null;
  }
}
