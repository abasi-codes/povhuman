import { Hono } from "hono";

export function createHealthRoutes(): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({
      status: "ok",
      service: "world-through-my-eyes",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
