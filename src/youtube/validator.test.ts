import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractVideoId, validateWithOEmbed, validateWithDataApi, validateYouTubeUrl } from "./validator.js";
import { mockFetch } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("extractVideoId", () => {
  it("extracts from youtube.com/watch?v=ID", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtu.be/ID", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtube.com/live/ID", () => {
    expect(extractVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtube.com/embed/ID", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts with extra query params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from http (non-https)", () => {
    expect(extractVideoId("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractVideoId("https://vimeo.com/123456")).toBeNull();
  });

  it("returns null for malformed URL", () => {
    expect(extractVideoId("not-a-url")).toBeNull();
  });

  it("returns null for short ID (< 11 chars)", () => {
    expect(extractVideoId("https://youtube.com/watch?v=abc")).toBeNull();
  });

  it("extracts ID with hyphens and underscores", () => {
    expect(extractVideoId("https://youtube.com/watch?v=abc-_DEF123")).toBe("abc-_DEF123");
  });
});

describe("validateWithOEmbed", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns valid with title on success", async () => {
    mockFetch([{ ok: true, body: { title: "My Live Stream" } }]);
    const result = await validateWithOEmbed("https://youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.valid).toBe(true);
    expect(result.title).toBe("My Live Stream");
  });

  it("returns invalid on non-ok response", async () => {
    mockFetch([{ ok: false, status: 404 }]);
    const result = await validateWithOEmbed("https://youtube.com/watch?v=bad");
    expect(result.valid).toBe(false);
    expect(result.title).toBeNull();
  });

  it("returns invalid on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await validateWithOEmbed("https://youtube.com/watch?v=x");
    expect(result.valid).toBe(false);
  });
});

describe("validateWithDataApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns valid live stream info", async () => {
    mockFetch([{
      ok: true,
      body: {
        items: [{
          snippet: { title: "Live!", channelTitle: "Me", liveBroadcastContent: "live" },
          status: { embeddable: true },
        }],
      },
    }]);
    const result = await validateWithDataApi("abc12345678", "key");
    expect(result.valid).toBe(true);
    expect(result.is_live).toBe(true);
    expect(result.title).toBe("Live!");
    expect(result.embeddable).toBe(true);
  });

  it("returns video_id in result", async () => {
    mockFetch([{
      ok: true,
      body: { items: [{ snippet: { liveBroadcastContent: "none" }, status: {} }] },
    }]);
    const result = await validateWithDataApi("abc12345678", "key");
    expect(result.video_id).toBe("abc12345678");
    expect(result.is_live).toBe(false);
  });

  it("returns invalid when no items returned", async () => {
    mockFetch([{ ok: true, body: { items: [] } }]);
    const result = await validateWithDataApi("abc12345678", "key");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Video not found");
  });

  it("returns error on API failure", async () => {
    mockFetch([{ ok: false, status: 403, text: "Forbidden" }]);
    const result = await validateWithDataApi("abc12345678", "key");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("403");
  });

  it("returns error on fetch exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const result = await validateWithDataApi("abc12345678", "key");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("YouTube API request failed");
  });
});

describe("validateYouTubeUrl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns error for invalid URL format", async () => {
    const result = await validateYouTubeUrl("not-a-url", null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid YouTube URL");
  });

  it("uses Data API when key is provided", async () => {
    mockFetch([{
      ok: true,
      body: {
        items: [{
          snippet: { title: "T", channelTitle: "C", liveBroadcastContent: "live" },
          status: { embeddable: true },
        }],
      },
    }]);
    const result = await validateYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ", "api-key");
    expect(result.valid).toBe(true);
    expect(result.is_live).toBe(true);
  });

  it("falls back to oEmbed when no API key", async () => {
    mockFetch([{ ok: true, body: { title: "Fallback" } }]);
    const result = await validateYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ", null);
    expect(result.valid).toBe(true);
    expect(result.is_live).toBeNull();
    expect(result.title).toBe("Fallback");
  });
});
