import { expect, test, type Page } from "@playwright/test";

/** Opens the filters: always visible on desktop, behind a button on phones. */
async function openFilters(page: Page) {
  const button = page.getByRole("button", { name: /^Filters/ });
  if (await button.isVisible()) await button.click();
}

async function closeFilters(page: Page) {
  const done = page.getByRole("button", { name: /^Show \d+ rose/ });
  if (await done.isVisible()) await done.click();
}

test("has no horizontal scroll and paginates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("23 roses")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await expect(page.getByText("Page 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Page 2 of 4")).toBeVisible();
});

test("filters by section and colour, and resets to page 1", async ({ page }) => {
  await page.goto("/?page=2");
  await openFilters(page);
  // The panel is in the DOM twice (sidebar and phone sheet); only one is visible.
  const panel = page.locator('aside, dialog').filter({ visible: true });
  await panel.getByLabel(/^Hybrid Teas/).check();
  await panel.getByLabel(/^White/).check();
  await closeFilters(page);
  await expect(page).toHaveURL(/class=Hybrid/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByRole("heading", { name: "Alliance" })).toBeVisible();
  await expect(page.getByText(/\d+ roses?$/).first()).toBeVisible();
});

test("shows an empty state for a combination with no roses", async ({ page }) => {
  await page.goto("/?class=Climber&colour=yellow");
  await expect(page.getByText("No roses match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("23 roses")).toBeVisible();
});

test("searches with typos", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search roses").fill("winchster");
  await expect(page.getByRole("heading", { name: "Winchester Cathedral" })).toBeVisible();
});

test("rose page shows the stored photos with credits and a link back to HelpMeFind", async ({ page }) => {
  // Everything is served from the static site: HMF must never be contacted.
  await page.route("https://www.helpmefind.com/**", (route) => route.abort());
  await page.goto("/rose/princess-charlene-de-monaco");
  const photos = page.getByAltText(/Princess Charlene de Monaco, from HelpMeFind/);
  expect(await photos.count()).toBeGreaterThan(1);
  await expect(photos.first()).toHaveJSProperty("complete", true);
  await expect(page.getByText(/^Photo: /).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View on HelpMeFind" })).toHaveAttribute("href", /n=96406/);
});

test("unmatched rose shows the placeholder", async ({ page }) => {
  await page.goto("/rose/raven");
  await expect(page.getByText("hasn't been matched to HelpMeFind yet")).toBeVisible();
});
