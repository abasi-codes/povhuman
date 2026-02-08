import { describe, it, expect, afterEach } from "vitest";
import { RedactionMiddleware } from "./redaction.js";
import type { RedactionConfig } from "./types.js";
import { mockFetch } from "../test-helpers.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const allDisabled: RedactionConfig = {
  blur_faces: false,
  blur_screens: false,
  blur_text: false,
  block_private_locations: false,
};

const allEnabled: RedactionConfig = {
  blur_faces: true,
  blur_screens: true,
  blur_text: true,
  block_private_locations: true,
};

describe("RedactionMiddleware", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes through when all config is disabled", async () => {
    const mw = new RedactionMiddleware(allDisabled);
    const result = await mw.process("framedata");
    expect(result.dropped).toBe(false);
    expect(result.redacted).toBe(false);
    expect(result.frame_b64).toBe("framedata");
  });

  it("passes through with warning when no service URL (config enabled)", async () => {
    const mw = new RedactionMiddleware(allEnabled, true, null);
    const result = await mw.process("framedata");
    expect(result.dropped).toBe(false);
    expect(result.frame_b64).toBe("framedata");
  });

  it("delegates to service when URL is configured", async () => {
    mockFetch([{
      ok: true,
      body: {
        redacted: true,
        dropped: false,
        frame_b64: "blurred",
        detections: [{ type: "face", confidence: 0.95, action: "blur" }],
        processing_ms: 25,
      },
    }]);
    const mw = new RedactionMiddleware(allEnabled, true, "http://redact:8080");
    const result = await mw.process("raw");
    expect(result.redacted).toBe(true);
    expect(result.frame_b64).toBe("blurred");
  });

  it("fail-closed drops frame on service error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const mw = new RedactionMiddleware(allEnabled, true, "http://redact:8080");
    const result = await mw.process("raw");
    expect(result.dropped).toBe(true);
    expect(result.frame_b64).toBeNull();
  });

  it("fail-open passes frame on service error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const mw = new RedactionMiddleware(allEnabled, false, "http://redact:8080");
    const result = await mw.process("raw");
    expect(result.dropped).toBe(false);
    expect(result.frame_b64).toBe("raw");
  });

  it("fail-closed drops on non-ok response", async () => {
    mockFetch([{ ok: false, status: 500 }]);
    const mw = new RedactionMiddleware(allEnabled, true, "http://redact:8080");
    const result = await mw.process("raw");
    expect(result.dropped).toBe(true);
  });

  it("processing_ms is always present", async () => {
    const mw = new RedactionMiddleware(allDisabled);
    const result = await mw.process("f");
    expect(typeof result.processing_ms).toBe("number");
    expect(result.processing_ms).toBeGreaterThanOrEqual(0);
  });
});

describe("RedactionMiddleware.isPrivateLocation", () => {
  it("returns true for known private locations", () => {
    expect(RedactionMiddleware.isPrivateLocation("bathroom")).toBe(true);
    expect(RedactionMiddleware.isPrivateLocation("bedroom")).toBe(true);
    expect(RedactionMiddleware.isPrivateLocation("locker_room")).toBe(true);
    expect(RedactionMiddleware.isPrivateLocation("dressing_room")).toBe(true);
    expect(RedactionMiddleware.isPrivateLocation("hospital_room")).toBe(true);
    expect(RedactionMiddleware.isPrivateLocation("nursery")).toBe(true);
  });

  it("returns false for public locations", () => {
    expect(RedactionMiddleware.isPrivateLocation("office")).toBe(false);
    expect(RedactionMiddleware.isPrivateLocation("kitchen")).toBe(false);
    expect(RedactionMiddleware.isPrivateLocation("park")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(RedactionMiddleware.isPrivateLocation("Bathroom")).toBe(true);
    expect(RedactionMiddleware.isPrivateLocation("BEDROOM")).toBe(true);
  });
});
