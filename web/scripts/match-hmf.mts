/**
 * Finds HelpMeFind candidates by searching Google (`site:helpmefind.com "<name>" rose`) in your own Chrome,
 * so no request goes to HMF. NOTE: Google hides the destination of result links in automated browsers (every
 * link is a /goto redirect), so this stops at the first search unless your Chrome shows direct links.
 * `pnpm hmf-search` (HMF's own name search) is the main route.
 *
 *   pnpm hmf-match [--limit N] [--id ROSE_ID] [--refresh] [--score-only] [--cdp URL]
 *
 * Attaches over CDP to a Chrome you start once (default http://127.0.0.1:9222):
 *   google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.config/ksg-chrome"
 * Raw results are cached per name in cache/google/ (gitignored); scoring and outputs are shared with
 * `pnpm hmf-search` (see match-common.mts). Searches are 8-15 s apart; --limit defaults to 150.
 */
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import type { SearchResult } from "../src/lib/hmf-match.ts";
import { ROOT, cacheFor, jitter, pendingTerms, roses, score, sleep, writeJson, type Cached } from "./match-common.mts";

const CACHE = path.join(ROOT, "cache", "google");
const DEFAULT_LIMIT = 150;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];
const CDP = (flag("cdp") ? value("cdp") : undefined) ?? process.env.KSG_CHROME_CDP ?? "http://127.0.0.1:9222";
const cacheFile = cacheFor(CACHE);

/** Collects url, title and snippet for each organic result on the page. */
async function readResults(page: Page): Promise<SearchResult[]> {
  return page.evaluate(() => {
    const out: { url: string; title: string; snippet: string }[] = [];
    for (const h3 of document.querySelectorAll("#search h3")) {
      const a = h3.closest("a");
      if (!a) continue;
      // Climb to the largest ancestor that still holds only this result's heading.
      let block: Element = a;
      while (block.parentElement && block.parentElement.querySelectorAll("h3").length === 1 && block.parentElement.id !== "search") block = block.parentElement;
      const title = h3.textContent ?? "";
      const text = (block as HTMLElement).innerText ?? "";
      out.push({ url: a.href, title, snippet: text.replace(title, "").replaceAll(/\s+/g, " ").trim() });
    }
    return out;
  });
}

/** Waits for results, giving the person up to 10 minutes to clear a consent page or CAPTCHA. */
async function waitForResults(page: Page): Promise<boolean> {
  const deadline = Date.now() + 10 * 60_000;
  let warned = false;
  await page.waitForSelector("#search, #result-stats", { timeout: 6000 }).catch(() => undefined);
  while (Date.now() < deadline) {
    if (await page.locator("#search, #result-stats").count()) return true;
    if (await page.locator("text=/did not match any documents/i").count()) return true;
    if (!warned) {
      console.error("Google is asking for something (CAPTCHA or consent). Handle it in the browser window; waiting up to 10 minutes...");
      warned = true;
    }
    await sleep(2000);
  }
  return false;
}

async function search(todo: string[]): Promise<number> {
  console.log(`${todo.length} names to search`);
  const browser = await chromium.connectOverCDP(CDP).catch(() => null);
  if (!browser) {
    console.error(`Could not reach Chrome at ${CDP}. Start it first:\n  google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.config/ksg-chrome"`);
    return 1;
  }
  const page = await (browser.contexts()[0] ?? (await browser.newContext())).newPage();
  let code = 0;
  try {
    for (const [n, term] of todo.entries()) {
      if (n > 0) await sleep(n % 25 === 0 ? jitter(120_000, 180_000) : jitter(8000, 15000));
      const query = `site:helpmefind.com "${term}" rose`;
      await page.goto(`https://www.google.com/search?hl=en&num=10&q=${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (!(await waitForResults(page))) {
        console.error("Stopped: Google did not show results. Re-run later to resume.");
        code = 2;
        break;
      }
      const results = await readResults(page);
      if (results.length && results.every((x) => /^https?:\/\/(www\.)?google\.[a-z.]+\/(goto|url)\?/.test(x.url))) {
        console.error("Stopped: Google is hiding the result urls (every link is a /goto redirect), so HMF plant urls cannot be read from it. Nothing was saved for this name.");
        code = 3;
        break;
      }
      writeJson(cacheFile(term), { query, fetchedAt: new Date().toISOString(), results } satisfies Cached);
      console.log(`[${n + 1}/${todo.length}] ${term}: ${results.length} results`);
    }
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined); // only disconnects; your Chrome keeps running
  }
  return code;
}

let code = 0;
if (!flag("score-only")) {
  const wanted = flag("id") ? roses.filter((r) => r.id === value("id")) : roses;
  if (flag("id") && !wanted.length) {
    console.error(`No rose with id ${value("id")}`);
    process.exit(1);
  }
  const todo = pendingTerms(CACHE, wanted, flag("refresh") || flag("id")).slice(0, flag("limit") ? Number(value("limit")) : DEFAULT_LIMIT);
  if (todo.length) code = await search(todo);
  else console.log("Nothing left to search");
}
score(CACHE);
process.exit(code);
