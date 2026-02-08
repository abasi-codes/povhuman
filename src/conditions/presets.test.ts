import { describe, it, expect } from "vitest";
import { CONDITION_PRESETS, getPreset } from "./presets.js";

describe("CONDITION_PRESETS", () => {
  it("contains 6 presets", () => {
    expect(CONDITION_PRESETS).toHaveLength(6);
  });

  it("has unique IDs", () => {
    const ids = CONDITION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all presets have valid input modes", () => {
    const valid = new Set(["frames", "clip", "hybrid"]);
    for (const p of CONDITION_PRESETS) {
      expect(valid.has(p.recommended_input_mode)).toBe(true);
    }
  });

  it("all presets have non-empty condition strings", () => {
    for (const p of CONDITION_PRESETS) {
      expect(p.condition.length).toBeGreaterThan(10);
    }
  });

  it("all presets have positive recommended intervals", () => {
    for (const p of CONDITION_PRESETS) {
      expect(p.recommended_interval).toBeGreaterThan(0);
    }
  });
});

describe("getPreset", () => {
  it("returns preset by id", () => {
    const preset = getPreset("driving");
    expect(preset).toBeDefined();
    expect(preset!.label).toBe("Am I driving?");
  });

  it("returns undefined for unknown id", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });
});
