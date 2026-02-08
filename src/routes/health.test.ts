import { describe, it, expect } from "vitest";
import { createHealthRoutes } from "./health.js";

describe("health route", () => {
  const app = createHealthRoutes();

  it("returns 200 status", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
  });

  it("returns correct service name and status", async () => {
    const res = await app.request("/");
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("world-through-my-eyes");
  });

  it("returns ISO timestamp", async () => {
    const res = await app.request("/");
    const body = await res.json();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
