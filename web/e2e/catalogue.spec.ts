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
  const panel = page.locator('aside, [role="dialog"]').filter({ visible: true });
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

test("rose page loads more photos from HelpMeFind", async ({ page }) => {
  const photo = (n: number) => ({
    src: `https://www.helpmefind.com/gardening/tn/897/${n}.jpg`,
    width: 96,
    height: 96,
    pageUrl: `https://www.helpmefind.com/gardening/l.php?l=21.${n}`,
    credit: "Someone",
    creditUrl: "https://www.helpmefind.com/gardening/l.php?l=99.1",
  });
  await page.route("https://www.helpmefind.com/**", (route) => route.abort());
  await page.route("**/api/hmf/97659/photos*", (route) => {
    const more = new URL(route.request().url()).searchParams.get("cursor") === "1.0";
    return route.fulfill({
      json: {
        hmfUrl: "https://www.helpmefind.com/rose/pl.php?n=97659",
        status: "ok",
        photos: more ? [photo(3), photo(4)] : [photo(1), photo(2)],
        next: more ? null : "1.0",
      },
    });
  });

  await page.goto("/rose/earth-angel");
  await expect(page.getByAltText(/Earth Angel, photo from HelpMeFind/)).toHaveCount(2);
  await page.getByRole("button", { name: "More photos" }).click();
  await expect(page.getByAltText(/Earth Angel, photo from HelpMeFind/)).toHaveCount(4);
  await expect(page.getByRole("button", { name: "More photos" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View on HelpMeFind" })).toHaveAttribute("href", /n=97659/);
});

test("unmatched rose shows the placeholder", async ({ page }) => {
  await page.goto("/rose/raven");
  await expect(page.getByText("hasn't been matched to HelpMeFind yet")).toBeVisible();
});
