import { describe, it, expect, afterEach } from "vitest";
import { createWebhookReceiver } from "./receiver.js";
import { signPayload, buildWebhookPayload } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("webhook receiver", () => {
  const secret = "webhook-secret";

  afterEach(() => vi.restoreAllMocks());

  function makeApp(handler = vi.fn().mockResolvedValue(undefined)) {
    return { app: createWebhookReceiver(secret, handler), handler };
  }

  function post(app: ReturnType<typeof createWebhookReceiver>, body: string, signature?: string) {
    const headers: Record<string, string> = { "Content-Type": "text/plain" };
    if (signature !== undefined) {
      headers["X-Trio-Signature"] = signature;
    }
    return app.request("/trio", {
      method: "POST",
      headers,
      body,
    });
  }

  it("accepts valid signed webhook and responds 200", async () => {
    const { app, handler } = makeApp();
    const payload = buildWebhookPayload("monitor_triggered");
    const body = JSON.stringify(payload);
    const sig = signPayload(body, secret);

    const res = await post(app, body, sig);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("accepted");

    // handler should be called (async, but within this tick in tests)
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it("returns 401 for invalid signature", async () => {
    const { app } = makeApp();
    const body = JSON.stringify(buildWebhookPayload("monitor_triggered"));
    const res = await post(app, body, "sha256=bad");
    expect(res.status).toBe(401);
  });

  it("returns 401 for missing signature", async () => {
    const { app } = makeApp();
    const body = JSON.stringify(buildWebhookPayload("monitor_triggered"));
    const res = await post(app, body);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { app } = makeApp();
    const body = "not json {{{";
    const sig = signPayload(body, secret);
    const res = await post(app, body, sig);
    expect(res.status).toBe(400);
  });

  it("deduplicates repeated webhooks", async () => {
    const { app, handler } = makeApp();
    const payload = buildWebhookPayload("monitor_triggered");
    const body = JSON.stringify(payload);
    const sig = signPayload(body, secret);

    const res1 = await post(app, body, sig);
    expect(res1.status).toBe(200);

    const res2 = await post(app, body, sig);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.status).toBe("duplicate");

    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("processes different events separately", async () => {
    const { app, handler } = makeApp();
    const p1 = buildWebhookPayload("monitor_triggered", { timestamp: "t1" });
    const p2 = buildWebhookPayload("monitor_triggered", { timestamp: "t2" });
    const b1 = JSON.stringify(p1);
    const b2 = JSON.stringify(p2);

    await post(app, b1, signPayload(b1, secret));
    await post(app, b2, signPayload(b2, secret));

    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("responds 200 even when handler throws", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("handler crash"));
    const { app } = makeApp(handler);
    const payload = buildWebhookPayload("job_error");
    const body = JSON.stringify(payload);
    const sig = signPayload(body, secret);

    const res = await post(app, body, sig);
    expect(res.status).toBe(200);
  });

  it("skips verification when secret is empty", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const app = createWebhookReceiver("", handler);
    const payload = buildWebhookPayload("job_status");
    const body = JSON.stringify(payload);

    const res = await app.request("/trio", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalled();
  });

  it("handles all webhook payload types", async () => {
    const { app, handler } = makeApp();
    const types = ["monitor_triggered", "digest_ready", "job_status", "job_error"] as const;

    for (const type of types) {
      const payload = buildWebhookPayload(type, { timestamp: `t-${type}` });
      const body = JSON.stringify(payload);
      const sig = signPayload(body, secret);
      const res = await post(app, body, sig);
      expect(res.status).toBe(200);
    }

    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalledTimes(4);
  });
});
