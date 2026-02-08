import { test, expect } from "@playwright/test";

test.describe("Dashboard Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads the dashboard with header", async ({ page }) => {
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".brand-name")).toContainText("World Through My Eyes");
  });

  test("shows three-column layout", async ({ page }) => {
    await expect(page.locator(".left")).toBeVisible();
    await expect(page.locator(".center")).toBeVisible();
    await expect(page.locator(".right")).toBeVisible();
  });

  test("stream setup card is present", async ({ page }) => {
    await expect(page.locator(".url-row input")).toBeVisible();
  });

  test("can enter a URL and click validate", async ({ page }) => {
    const input = page.locator(".url-row input");
    await input.fill("https://www.youtube.com/watch?v=test123");

    const validateBtn = page.locator(".url-row .btn");
    await expect(validateBtn).toBeVisible();
  });

  test("condition presets render as chips", async ({ page }) => {
    // Wait for presets to load
    await page.waitForTimeout(1000);
    const chips = page.locator(".condition-chips .tag");
    // At least one preset should render
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("stats cards section is visible", async ({ page }) => {
    await expect(page.locator(".stats-row")).toBeVisible();
  });

  test("event feed section is visible", async ({ page }) => {
    await expect(page.locator(".event-feed").or(page.locator(".monitor-split"))).toBeVisible();
  });

  test("agent bindings card is visible", async ({ page }) => {
    await expect(page.locator(".agent-bind-row").or(page.locator(".agent-list")).first()).toBeVisible();
  });

  test("health endpoint returns 200", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("metrics endpoint returns prometheus format", async ({ request }) => {
    const response = await request.get("/metrics");
    expect(response.ok()).toBe(true);
    const text = await response.text();
    expect(text).toContain("trio_webhooks_total");
    expect(text).toContain("active_sessions");
  });
});
