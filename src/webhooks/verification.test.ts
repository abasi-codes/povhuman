import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyTrioSignature } from "./verification.js";

describe("verifyTrioSignature", () => {
  const secret = "test-secret-key";
  const body = '{"event":"live_monitor_triggered","job_id":"j1"}';

  function sign(b: string, s: string): string {
    return createHmac("sha256", s).update(b).digest("hex");
  }

  it("returns true for a valid hex signature", () => {
    const sig = sign(body, secret);
    expect(verifyTrioSignature(body, sig, secret)).toBe(true);
  });

  it("returns true for a valid sha256= prefixed signature", () => {
    const sig = `sha256=${sign(body, secret)}`;
    expect(verifyTrioSignature(body, sig, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    expect(verifyTrioSignature(body, "deadbeef", secret)).toBe(false);
  });

  it("returns false for a wrong-length hex string", () => {
    expect(verifyTrioSignature(body, "ab", secret)).toBe(false);
  });

  it("returns false when signature is undefined", () => {
    expect(verifyTrioSignature(body, undefined, secret)).toBe(false);
  });

  it("returns true (skips verification) when secret is empty", () => {
    expect(verifyTrioSignature(body, undefined, "")).toBe(true);
  });

  it("returns false when signature is from a different body", () => {
    const sig = sign("wrong body", secret);
    expect(verifyTrioSignature(body, sig, secret)).toBe(false);
  });

  it("returns false when signature is from a different secret", () => {
    const sig = sign(body, "other-secret");
    expect(verifyTrioSignature(body, sig, secret)).toBe(false);
  });

  it("handles empty body with valid HMAC", () => {
    const sig = sign("", secret);
    expect(verifyTrioSignature("", sig, secret)).toBe(true);
  });

  it("handles sha256= prefix with wrong hash", () => {
    const wrongHex = sign("wrong", secret);
    expect(verifyTrioSignature(body, `sha256=${wrongHex}`, secret)).toBe(false);
  });
});
