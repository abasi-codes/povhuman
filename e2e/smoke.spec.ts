import { test, expect } from "@playwright/test";

test.describe("Dashboard Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads the dashboard with header", async ({ page }) => {
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".brand-name")).toContainText("ProofStream");
  });

  test("shows three-column layout", async ({ page }) => {
    await expect(page.locator(".left")).toBeVisible();
    await expect(page.locator(".center")).toBeVisible();
    await expect(page.locator(".right")).toBeVisible();
  });

  test("task creator card is present", async ({ page }) => {
    await expect(page.locator(".form-textarea").or(page.locator("textarea"))).toBeVisible();
  });

  test("stats cards section is visible", async ({ page }) => {
    await expect(page.locator(".stats-row")).toBeVisible();
  });

  test("event feed section is visible", async ({ page }) => {
    await expect(page.locator(".event-feed").or(page.locator(".monitor-split"))).toBeVisible();
  });

  test("health endpoint returns 200", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("proofstream");
  });

  test("metrics endpoint returns prometheus format", async ({ request }) => {
    const response = await request.get("/metrics");
    expect(response.ok()).toBe(true);
    const text = await response.text();
    expect(text).toContain("trio_webhooks_total");
    expect(text).toContain("tasks_created_total");
    expect(text).toContain("active_tasks");
  });
});
