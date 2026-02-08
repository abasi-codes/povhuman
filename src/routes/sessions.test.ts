import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createSessionRoutes } from "./sessions.js";
import { SessionManager } from "../sessions/manager.js";
import { TrioClient } from "../trio/client.js";
import { QuotaTracker } from "../youtube/quota.js";
import { createTestDb, createMockTrioClient } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("session routes", () => {
  let db: Database.Database;
  let mockTrio: ReturnType<typeof createMockTrioClient>;
  let manager: SessionManager;
  let quota: QuotaTracker;
  let app: ReturnType<typeof createSessionRoutes>;

  beforeEach(() => {
    // Mock fetch to return valid YouTube Data API response
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{
          snippet: { title: "Live Stream", channelTitle: "Channel", liveBroadcastContent: "live" },
          status: { embeddable: true },
        }],
      }),
      text: async () => "",
    }));

    db = createTestDb();
    mockTrio = createMockTrioClient();
    manager = new SessionManager(db, mockTrio as unknown as TrioClient, "https://webhook.example.com");
    quota = new QuotaTracker(10_000);
    app = createSessionRoutes(manager, mockTrio as unknown as TrioClient, quota, "yt-key");
  });

  afterEach(() => vi.unstubAllGlobals());

  function json(path: string, body: unknown, method = "POST") {
    return app.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // --- POST /validate ---

  describe("POST /validate", () => {
    it("validates a YouTube URL with Trio", async () => {
      mockTrio.validateUrl.mockResolvedValue({
        valid: true, is_live: true, url: "u", platform: "youtube", title: "Trio Title", channel: "Ch",
      });
      const res = await json("/validate", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(true);
      expect(body.is_live).toBe(true);
      expect(body.platform).toBe("youtube");
    });

    it("returns 400 when url is missing", async () => {
      const res = await json("/validate", {});
      expect(res.status).toBe(400);
    });

    it("returns 400 when YouTube validation fails", async () => {
      // Mock fetch to return non-ok for both oEmbed and Data API
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false, status: 404, json: async () => ({}), text: async () => "",
      }));
      const res = await json("/validate", { url: "https://www.youtube.com/watch?v=xxxxxxxxxxx" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.valid).toBe(false);
    });

    it("falls back when Trio validation throws", async () => {
      mockTrio.validateUrl.mockRejectedValue(new Error("trio down"));
      const res = await json("/validate", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(true);
      expect(body.trio_validation).toBe("unavailable");
    });

    it("skips YouTube API key when quota exhausted", async () => {
      const lowQuota = new QuotaTracker(0);
      const lowApp = createSessionRoutes(manager, mockTrio as unknown as TrioClient, lowQuota, "yt-key");
      mockTrio.validateUrl.mockResolvedValue({ valid: true, is_live: true, url: "u", platform: "youtube" });
      const res = await lowApp.request("/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      });
      expect(res.status).toBe(200);
    });
  });

  // --- POST /preview ---

  describe("POST /preview", () => {
    it("returns stream preview from Trio", async () => {
      mockTrio.prepareStream.mockResolvedValue({ stream_id: "s1", embed_url: "http://embed", cached: true });
      const res = await json("/preview", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.stream_id).toBe("s1");
      expect(body.cached).toBe(true);
    });

    it("returns 400 when url is missing", async () => {
      const res = await json("/preview", {});
      expect(res.status).toBe(400);
    });

    it("falls back to embed URL when Trio fails", async () => {
      mockTrio.prepareStream.mockRejectedValue(new Error("fail"));
      const res = await json("/preview", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fallback).toBe(true);
      expect(body.embed_url).toContain("dQw4w9WgXcQ");
    });

    it("returns 500 when Trio fails and URL has no video ID", async () => {
      mockTrio.prepareStream.mockRejectedValue(new Error("fail"));
      const res = await json("/preview", { url: "https://not-youtube.com/foo" });
      expect(res.status).toBe(500);
    });
  });

  // --- GET /presets ---

  describe("GET /presets", () => {
    it("returns all condition presets", async () => {
      const res = await app.request("/presets");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.presets).toHaveLength(6);
    });
  });

  // --- POST /test-condition ---

  describe("POST /test-condition", () => {
    it("tests a condition via check_once", async () => {
      mockTrio.checkOnce.mockResolvedValue({ triggered: true, explanation: "yes", frame_b64: "f" });
      const res = await json("/test-condition", {
        url: "https://youtube.com/watch?v=abc",
        condition: "Is there a person visible?",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.triggered).toBe(true);
      expect(body.has_frame).toBe(true);
    });

    it("accepts preset_id", async () => {
      mockTrio.checkOnce.mockResolvedValue({ triggered: false, explanation: "no" });
      const res = await json("/test-condition", {
        url: "https://youtube.com/watch?v=abc",
        preset_id: "driving",
      });
      expect(res.status).toBe(200);
      const call = mockTrio.checkOnce.mock.calls[0][0];
      expect(call.input_mode).toBe("clip"); // driving preset recommends clip
    });

    it("returns 400 for unknown preset_id", async () => {
      const res = await json("/test-condition", {
        url: "https://youtube.com/watch?v=abc",
        preset_id: "nonexistent",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid custom condition", async () => {
      const res = await json("/test-condition", {
        url: "https://youtube.com/watch?v=abc",
        condition: "short",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when neither condition nor preset_id given", async () => {
      const res = await json("/test-condition", { url: "https://youtube.com/watch?v=abc" });
      expect(res.status).toBe(400);
    });

    it("respects explicit input_mode over preset", async () => {
      mockTrio.checkOnce.mockResolvedValue({ triggered: false, explanation: "no" });
      const res = await json("/test-condition", {
        url: "https://youtube.com/watch?v=abc",
        preset_id: "driving",
        input_mode: "frames",
      });
      expect(res.status).toBe(200);
      expect(mockTrio.checkOnce.mock.calls[0][0].input_mode).toBe("frames");
    });
  });

  // --- POST / (create session) ---

  describe("POST / (create session)", () => {
    it("creates and starts a session with preset_ids", async () => {
      const res = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        preset_ids: ["person_talking"],
        agent_ids: ["a1"],
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.session_id).toBeTruthy();
      expect(body.state).toBe("live");
      expect(body.job_id).toBe("job-1");
    });

    it("creates session with custom conditions", async () => {
      const res = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        conditions: ["Is there a person visible in the frame?"],
      });
      expect(res.status).toBe(201);
    });

    it("returns 400 when stream_url is missing", async () => {
      const res = await json("/", { conditions: ["Is there a person?"] });
      expect(res.status).toBe(400);
    });

    it("returns 400 when no conditions or presets given", async () => {
      const res = await json("/", { stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for unknown preset_id", async () => {
      const res = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        preset_ids: ["nonexistent"],
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid custom condition", async () => {
      const res = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        conditions: ["bad"],
      });
      expect(res.status).toBe(400);
    });

    it("returns error when startSession fails", async () => {
      mockTrio.validateUrl.mockResolvedValue({ valid: true, is_live: false, url: "", platform: "youtube" });
      const res = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        preset_ids: ["person_talking"],
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.state).toBe("error");
      expect(body.session_id).toBeTruthy();
    });
  });

  // --- GET /:id ---

  describe("GET /:id", () => {
    it("returns session info with jobs", async () => {
      const createRes = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        preset_ids: ["person_talking"],
      });
      const { session_id } = await createRes.json();

      const res = await app.request(`/${session_id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.session_id).toBe(session_id);
      expect(body.active_jobs).toBe(1);
      expect(body.jobs).toHaveLength(1);
    });

    it("returns 404 for nonexistent session", async () => {
      const res = await app.request("/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // --- POST /:id/pause ---

  describe("POST /:id/pause", () => {
    it("pauses a session", async () => {
      const createRes = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        preset_ids: ["person_talking"],
      });
      const { session_id } = await createRes.json();

      const res = await json(`/${session_id}/pause`, {});
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.state).toBe("paused");
    });
  });

  // --- POST /:id/stop ---

  describe("POST /:id/stop", () => {
    it("stops a session", async () => {
      const createRes = await json("/", {
        stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        preset_ids: ["person_talking"],
      });
      const { session_id } = await createRes.json();

      const res = await json(`/${session_id}/stop`, {});
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.state).toBe("stopped");
    });
  });
});
