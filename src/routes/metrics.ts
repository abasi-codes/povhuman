import { Hono } from "hono";

/**
 * Simple Prometheus-compatible metrics.
 * Counters and gauges are stored in-memory and exposed at /metrics.
 */

const counters: Record<string, number> = {
  trio_webhooks_total: 0,
  events_delivered_total: 0,
  sessions_created_total: 0,
  job_restarts_total: 0,
  http_requests_total: 0,
};

const gauges: Record<string, number> = {
  active_sessions: 0,
  active_jobs: 0,
};

export function incrementCounter(name: string, amount = 1) {
  if (name in counters) counters[name] += amount;
}

export function setGauge(name: string, value: number) {
  if (name in gauges) gauges[name] = value;
}

export function getCounterValue(name: string): number {
  return counters[name] ?? 0;
}

export function getGaugeValue(name: string): number {
  return gauges[name] ?? 0;
}

export function createMetricsRoutes(): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const lines: string[] = [];

    // Counters
    for (const [name, value] of Object.entries(counters)) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Gauges
    for (const [name, value] of Object.entries(gauges)) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    return c.text(lines.join("\n") + "\n", 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  return app;
}
