import { test, expect } from "@playwright/test";

test("home and map shell load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Track & rate coffee" })).toBeVisible();
  await page.goto("/map/");
  await expect(page.getByRole("heading", { name: "Discovery map" })).toBeVisible();
});

test("log page has heading", async ({ page }) => {
  await page.goto("/log/");
  await expect(page.getByRole("heading", { name: "Your log" })).toBeVisible();
});
