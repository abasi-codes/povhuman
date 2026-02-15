import { Hono } from "hono";

export function createHealthRoutes(): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({
      status: "ok",
      service: "proofstream",
      version: "0.2.0",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
