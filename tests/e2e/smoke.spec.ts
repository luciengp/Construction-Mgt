import { test, expect } from "@playwright/test";

// Smoke: the app shell renders and is installable. The full acceptance-criteria
// flow lives in happy-path.spec.ts.
test("app shell renders and is installable", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Construction Management System" })
  ).toBeVisible();

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
});
