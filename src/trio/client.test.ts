import { describe, it, expect, afterEach } from "vitest";
import { TrioClient, TrioApiError } from "./client.js";
import { mockFetch } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("TrioClient", () => {
  const client = new TrioClient("https://trio.example.com", "gk-test");

  afterEach(() => vi.unstubAllGlobals());

  it("validateUrl sends GET with correct path and API key header", async () => {
    const fetchFn = mockFetch([{ ok: true, body: { valid: true, url: "u", platform: "youtube" } }]);
    await client.validateUrl("https://youtube.com/watch?v=abc");
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toContain("/validate-url?url=");
    expect(opts.method).toBe("GET");
    expect(opts.headers["Authorization"]).toBe("Bearer gk-test");
  });

  it("prepareStream sends POST with url in body", async () => {
    const fetchFn = mockFetch([{ ok: true, body: { stream_id: "s", embed_url: "e", cached: false } }]);
    await client.prepareStream("https://youtube.com/watch?v=x");
    const [, opts] = fetchFn.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toHaveProperty("url");
  });

  it("startLiveMonitor defaults max_duration_seconds to 600", async () => {
    const fetchFn = mockFetch([{ ok: true, body: { job_id: "j1", status: "started" } }]);
    await client.startLiveMonitor({ stream_url: "u", condition: "c", webhook_url: "w" });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.max_duration_seconds).toBe(600);
  });

  it("startLiveMonitor preserves explicit max_duration_seconds", async () => {
    const fetchFn = mockFetch([{ ok: true, body: { job_id: "j1", status: "started" } }]);
    await client.startLiveMonitor({ stream_url: "u", condition: "c", webhook_url: "w", max_duration_seconds: 300 });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.max_duration_seconds).toBe(300);
  });

  it("startLiveDigest posts to /live-digest", async () => {
    const fetchFn = mockFetch([{ ok: true, body: { job_id: "j2", status: "started" } }]);
    await client.startLiveDigest({ stream_url: "u", webhook_url: "w" });
    expect(fetchFn.mock.calls[0][0]).toContain("/live-digest");
  });

  it("checkOnce posts to /check-once", async () => {
    const fetchFn = mockFetch([{ ok: true, body: { triggered: false, explanation: "no" } }]);
    await client.checkOnce({ stream_url: "u", condition: "c" });
    expect(fetchFn.mock.calls[0][0]).toContain("/check-once");
  });

  it("getJobStatus sends GET to /jobs/:id", async () => {
    const fetchFn = mockFetch([{ ok: true, body: { job_id: "j1", status: "running" } }]);
    await client.getJobStatus("j1");
    expect(fetchFn.mock.calls[0][0]).toContain("/jobs/j1");
    expect(fetchFn.mock.calls[0][1].method).toBe("GET");
  });

  it("cancelJob sends POST to /jobs/:id/cancel", async () => {
    const fetchFn = mockFetch([{ ok: true, body: {} }]);
    await client.cancelJob("j1");
    expect(fetchFn.mock.calls[0][0]).toContain("/jobs/j1/cancel");
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
  });

  it("throws TrioApiError on non-ok response", async () => {
    mockFetch([{ ok: false, status: 422, text: "bad request" }]);
    await expect(client.validateUrl("u")).rejects.toThrow(TrioApiError);
  });

  it("TrioApiError includes status, body, and path", async () => {
    mockFetch([{ ok: false, status: 500, text: "server error" }]);
    try {
      await client.getJobStatus("j1");
      expect.unreachable("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TrioApiError);
      const e = err as TrioApiError;
      expect(e.status).toBe(500);
      expect(e.body).toBe("server error");
      expect(e.path).toContain("/jobs/j1");
    }
  });

  it("strips trailing slash from baseUrl", async () => {
    const c = new TrioClient("https://trio.example.com/", "gk");
    const fetchFn = mockFetch([{ ok: true, body: { job_id: "j", status: "running" } }]);
    await c.getJobStatus("j");
    expect(fetchFn.mock.calls[0][0]).toBe("https://trio.example.com/jobs/j");
  });
});
