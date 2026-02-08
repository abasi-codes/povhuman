import { describe, it, expect } from "vitest";
import { combineConditions, validateCondition } from "./combiner.js";

describe("combineConditions", () => {
  it("throws on empty array", () => {
    expect(() => combineConditions([])).toThrow("At least one condition");
  });

  it("returns single condition unchanged", () => {
    const c = "Is there a person visible?";
    expect(combineConditions([c])).toBe(c);
  });

  it("combines two conditions with numbering", () => {
    const result = combineConditions(["Is there a dog?", "Is it raining?"]);
    expect(result).toContain("1. Is there a dog?");
    expect(result).toContain("2. Is it raining?");
  });

  it("includes ANY/ALL instruction", () => {
    const result = combineConditions(["A?", "B?"]);
    expect(result).toContain("Check ALL");
    expect(result).toContain("YES if ANY");
  });

  it("includes closing instruction", () => {
    const result = combineConditions(["A?", "B?"]);
    expect(result).toContain("Respond YES if at least one");
    expect(result).toContain("Respond NO if none");
  });

  it("numbers three conditions correctly", () => {
    const result = combineConditions(["A?", "B?", "C?"]);
    expect(result).toContain("1. A?");
    expect(result).toContain("2. B?");
    expect(result).toContain("3. C?");
  });
});

describe("validateCondition", () => {
  it("returns null for a valid yes/no question starting with Is", () => {
    expect(validateCondition("Is there a person visible in the frame?")).toBeNull();
  });

  it("returns null for a question ending with ?", () => {
    expect(validateCondition("The scene shows a laptop screen?")).toBeNull();
  });

  it("returns null for questions starting with Are", () => {
    expect(validateCondition("Are there more than 5 people present?")).toBeNull();
  });

  it("returns null for questions starting with Does", () => {
    expect(validateCondition("Does the scene show a vehicle dashboard?")).toBeNull();
  });

  it("returns error for too-short condition", () => {
    const result = validateCondition("hi?");
    expect(result).toContain("too short");
  });

  it("returns error for too-long condition", () => {
    const result = validateCondition("x".repeat(1001));
    expect(result).toContain("too long");
  });

  it("returns error for condition without yes/no indicators", () => {
    const result = validateCondition("Describe what you see in detail");
    expect(result).toContain("yes/no question");
  });

  it("accepts condition starting with Can", () => {
    expect(validateCondition("Can you see a QR code in the frame?")).toBeNull();
  });

  it("accepts condition starting with Has", () => {
    expect(validateCondition("Has the scene changed significantly?")).toBeNull();
  });

  it("accepts condition starting with Have", () => {
    expect(validateCondition("Have any new people entered the scene?")).toBeNull();
  });

  it("accepts condition starting with Will", () => {
    expect(validateCondition("Will this scene be classified as private?")).toBeNull();
  });

  it("accepts condition starting with Should", () => {
    expect(validateCondition("Should this frame be flagged for review?")).toBeNull();
  });
});
