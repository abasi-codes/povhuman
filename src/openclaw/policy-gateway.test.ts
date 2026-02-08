import { describe, it, expect } from "vitest";
import {
  evaluatePolicy,
  redactPayload,
  requiresConfirmation,
  CONFIRMATION_REQUIRED_ACTIONS,
} from "./policy-gateway.js";
import type { AgentPermissions } from "./policy-gateway.js";

const allPerms: AgentPermissions = { events: true, frames_on_trigger: true, digests: true };
const noPerms: AgentPermissions = { events: false, frames_on_trigger: false, digests: false };

describe("evaluatePolicy", () => {
  it("denies when payload contains stream_url", () => {
    const decision = evaluatePolicy("receive_event", allPerms, { stream_url: "http://x" });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toContain("stream URLs");
    expect(decision.redacted_fields).toContain("stream_url");
  });

  it("denies when payload contains url", () => {
    const decision = evaluatePolicy("receive_event", allPerms, { url: "http://x" });
    expect(decision.allow).toBe(false);
    expect(decision.redacted_fields).toContain("url");
  });

  it("denies receive_event without events permission", () => {
    const decision = evaluatePolicy("receive_event", noPerms, { foo: "bar" });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toContain("event permission");
  });

  it("allows receive_event with events permission", () => {
    const decision = evaluatePolicy("receive_event", allPerms, { foo: "bar" });
    expect(decision.allow).toBe(true);
  });

  it("denies receive_frame without frames_on_trigger permission", () => {
    const decision = evaluatePolicy("receive_frame", { ...allPerms, frames_on_trigger: false }, {});
    expect(decision.allow).toBe(false);
    expect(decision.redacted_fields).toContain("frame_b64");
  });

  it("allows receive_frame with frames_on_trigger permission", () => {
    const decision = evaluatePolicy("receive_frame", allPerms, {});
    expect(decision.allow).toBe(true);
  });

  it("denies receive_digest without digests permission", () => {
    const decision = evaluatePolicy("receive_digest", { ...allPerms, digests: false }, {});
    expect(decision.allow).toBe(false);
  });

  it("allows receive_digest with digests permission", () => {
    const decision = evaluatePolicy("receive_digest", allPerms, {});
    expect(decision.allow).toBe(true);
  });

  it("allows unknown actions with any permissions", () => {
    const decision = evaluatePolicy("unknown_action", noPerms, {});
    expect(decision.allow).toBe(true);
  });

  it("url check takes priority over permission check", () => {
    const decision = evaluatePolicy("receive_event", allPerms, { stream_url: "http://x" });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toContain("stream URLs");
  });
});

describe("redactPayload", () => {
  it("removes specified fields", () => {
    const result = redactPayload({ a: 1, b: 2, c: 3 }, ["b"]);
    expect(result).toHaveProperty("a", 1);
    expect(result).not.toHaveProperty("b");
    expect(result).toHaveProperty("c", 3);
  });

  it("always strips stream_url, url, google_api_key", () => {
    const result = redactPayload(
      { stream_url: "x", url: "y", google_api_key: "z", safe: true },
      [],
    );
    expect(result).not.toHaveProperty("stream_url");
    expect(result).not.toHaveProperty("url");
    expect(result).not.toHaveProperty("google_api_key");
    expect(result).toHaveProperty("safe", true);
  });

  it("does not mutate the original payload", () => {
    const original = { a: 1, stream_url: "x" };
    redactPayload(original, ["a"]);
    expect(original).toHaveProperty("a", 1);
    expect(original).toHaveProperty("stream_url", "x");
  });

  it("handles empty fieldsToRedact", () => {
    const result = redactPayload({ data: "keep" }, []);
    expect(result).toHaveProperty("data", "keep");
  });
});

describe("requiresConfirmation", () => {
  it("returns true for all 5 required actions", () => {
    for (const action of CONFIRMATION_REQUIRED_ACTIONS) {
      expect(requiresConfirmation(action)).toBe(true);
    }
  });

  it("returns false for non-confirmation actions", () => {
    expect(requiresConfirmation("receive_event")).toBe(false);
    expect(requiresConfirmation("receive_frame")).toBe(false);
    expect(requiresConfirmation("unknown")).toBe(false);
  });
});
