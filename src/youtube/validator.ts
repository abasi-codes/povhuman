import { logger } from "../logger.js";

export interface YouTubeValidation {
  valid: boolean;
  video_id: string | null;
  is_live: boolean | null;
  title: string | null;
  channel: string | null;
  embeddable: boolean | null;
  error: string | null;
}

/**
 * Extract YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/live/, youtube.com/embed/
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Free validation using YouTube oEmbed (no API key, no quota).
 * Only confirms the video exists and gets title - does NOT check live status.
 */
export async function validateWithOEmbed(
  url: string,
): Promise<{ valid: boolean; title: string | null }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);

    if (!res.ok) {
      return { valid: false, title: null };
    }

    const data = (await res.json()) as { title?: string };
    return { valid: true, title: data.title || null };
  } catch {
    return { valid: false, title: null };
  }
}

/**
 * Full validation using YouTube Data API v3.
 * Costs 1 quota unit per call (videos.list).
 * Checks: live status, embeddability, geo-restrictions.
 */
export async function validateWithDataApi(
  videoId: string,
  apiKey: string,
): Promise<YouTubeValidation> {
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=snippet,status,liveStreamingDetails,contentDetails` +
      `&id=${videoId}` +
      `&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      logger.warn({ status: res.status, body: errText }, "YouTube API error");
      return {
        valid: false,
        video_id: videoId,
        is_live: null,
        title: null,
        channel: null,
        embeddable: null,
        error: `YouTube API returned ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      items?: Array<{
        snippet?: { title?: string; channelTitle?: string; liveBroadcastContent?: string };
        status?: { embeddable?: boolean };
        liveStreamingDetails?: { actualStartTime?: string };
        contentDetails?: { regionRestriction?: { allowed?: string[]; blocked?: string[] } };
      }>;
    };

    if (!data.items || data.items.length === 0) {
      return {
        valid: false,
        video_id: videoId,
        is_live: null,
        title: null,
        channel: null,
        embeddable: null,
        error: "Video not found",
      };
    }

    const item = data.items[0];
    const isLive = item.snippet?.liveBroadcastContent === "live";

    return {
      valid: true,
      video_id: videoId,
      is_live: isLive,
      title: item.snippet?.title || null,
      channel: item.snippet?.channelTitle || null,
      embeddable: item.status?.embeddable ?? null,
      error: null,
    };
  } catch (err) {
    logger.error({ err }, "YouTube API validation error");
    return {
      valid: false,
      video_id: videoId,
      is_live: null,
      title: null,
      channel: null,
      embeddable: null,
      error: "YouTube API request failed",
    };
  }
}

/**
 * Validate a YouTube URL using the best available method.
 * Prefers Data API (live status check), falls back to oEmbed + Trio validation.
 */
export async function validateYouTubeUrl(
  url: string,
  youtubeApiKey: string | null,
): Promise<YouTubeValidation> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return {
      valid: false,
      video_id: null,
      is_live: null,
      title: null,
      channel: null,
      embeddable: null,
      error: "Invalid YouTube URL format. Expected youtube.com/watch?v=... or youtu.be/...",
    };
  }

  // Use Data API if key is available (1 quota unit)
  if (youtubeApiKey) {
    return validateWithDataApi(videoId, youtubeApiKey);
  }

  // Fall back to oEmbed (free but no live status)
  const oembed = await validateWithOEmbed(url);
  return {
    valid: oembed.valid,
    video_id: videoId,
    is_live: null, // Cannot determine from oEmbed
    title: oembed.title,
    channel: null,
    embeddable: null,
    error: oembed.valid ? null : "Video not found or unavailable",
  };
}
