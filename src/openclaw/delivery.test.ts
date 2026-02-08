import { describe, it, expect, afterEach } from "vitest";
import { OpenClawDelivery } from "./delivery.js";
import type { PerceptionEvent } from "./delivery.js";
import { mockFetch } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const event: PerceptionEvent = {
  event_id: "evt-1",
  session_id: "sess-1",
  type: "triggered",
  timestamp: "2025-01-01T00:00:00Z",
  explanation: "person detected",
  frame_b64: "base64data",
  metadata: { check: 1 },
};

describe("OpenClawDelivery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("deliverEvent posts to /hooks/wake with auth header", async () => {
    const fetchFn = mockFetch([{ ok: true, body: {} }]);
    const delivery = new OpenClawDelivery("https://claw.example.com", "tok-123");
    await delivery.deliverEvent(event);
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe("https://claw.example.com/hooks/wake");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
  });

  it("deliverEvent excludes frame by default", async () => {
    const fetchFn = mockFetch([{ ok: true, body: {} }]);
    const delivery = new OpenClawDelivery("https://claw.example.com", "tok");
    await delivery.deliverEvent(event);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.data.frame).toBeUndefined();
  });

  it("deliverEvent includes frame when option is set", async () => {
    const fetchFn = mockFetch([{ ok: true, body: {} }]);
    const delivery = new OpenClawDelivery("https://claw.example.com", "tok");
    await delivery.deliverEvent(event, { processing: "now", include_frame: true });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.data.frame).toBe("base64data");
  });

  it("launchAgentSession posts to /hooks/agent", async () => {
    const fetchFn = mockFetch([{ ok: true, body: {} }]);
    const delivery = new OpenClawDelivery("https://claw.example.com", "tok");
    await delivery.launchAgentSession(event, { model: "opus" });
    const [url] = fetchFn.mock.calls[0];
    expect(url).toBe("https://claw.example.com/hooks/agent");
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.agent_config.model).toBe("opus");
  });

  it("returns false when baseUrl is empty", async () => {
    const delivery = new OpenClawDelivery("", "tok");
    const result = await delivery.deliverEvent(event);
    expect(result).toBe(false);
  });

  it("returns false on non-ok response", async () => {
    mockFetch([{ ok: false, status: 500 }]);
    const delivery = new OpenClawDelivery("https://claw.example.com", "tok");
    const result = await delivery.deliverEvent(event);
    expect(result).toBe(false);
  });

  it("returns false on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const delivery = new OpenClawDelivery("https://claw.example.com", "tok");
    const result = await delivery.deliverEvent(event);
    expect(result).toBe(false);
  });

  it("strips trailing slash from baseUrl", async () => {
    const fetchFn = mockFetch([{ ok: true, body: {} }]);
    const delivery = new OpenClawDelivery("https://claw.example.com/", "tok");
    await delivery.deliverEvent(event);
    expect(fetchFn.mock.calls[0][0]).toBe("https://claw.example.com/hooks/wake");
  });
});
