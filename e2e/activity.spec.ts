import { test, expect } from "@playwright/test";

test("activity tab is reachable from the nav and shows its heading", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Activity" }).click();
  await expect(page).toHaveURL(/\/activity\/?$/);
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(
    page.getByText("Public check-ins from across the community.")
  ).toBeVisible();
});

test("activity link is exposed on the log page so the feed is one click away", async ({
  page,
}) => {
  await page.goto("/log/");
  await expect(page.getByRole("link", { name: "Activity" })).toBeVisible();
});
