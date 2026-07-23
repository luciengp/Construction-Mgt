import { test, expect } from "@playwright/test";

// Placeholder smoke test. The real happy-path e2e (PIN login → fill ITP →
// countersign → gate advances) arrives in build milestone 9.
test("app shell renders and is installable", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Construction Management System" })
  ).toBeVisible();

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
});
