/**
 * Slow, resumable snapshot of HelpMeFind plant-page details into data/hmf/<hmfId>.json.
 *
 *   pnpm hmf-data [--limit N] [--id HMF_ID] [--refresh] [--older-than DAYS]
 *
 * Roses that already have a file are skipped, so an interrupted run can simply be restarted and the
 * data is never re-read from HMF unless you ask: --refresh redoes everything, --id redoes one rose,
 * --older-than redoes files fetched more than DAYS ago. Stops at the first 403/429/5xx.
 *
 * Pages are opened in a real, visible Chromium (persistent profile in cache/hmf-browser, shared with
 * `pnpm photos`, so cookies carry over); pass --headless to hide the window.
 */
import fs from "node:fs";
import path from "node:path";
import { hmfPlantUrl } from "../src/lib/hmf.ts";
import { chromium } from "@playwright/test";
import { parseDetails } from "../src/lib/hmf-details.ts";
import { suffixes } from "./hmf-suffixes.mts";

const GAP_MS = Number(process.env.KSG_GAP_MS ?? 4000);
const ROOT = path.join(import.meta.dirname, "..", "..");
const OUT = process.env.KSG_HMF_DIR ?? path.join(ROOT, "data", "hmf");
const DATA = process.env.KSG_DATA_DIR ?? path.join(ROOT, "data", "sample");

const PROFILE = process.env.KSG_PROFILE ?? path.join(ROOT, "cache", "hmf-browser");

class Blocked extends Error {}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
const blocked = (status: number) => status === 403 || status === 429 || status >= 500;
const file = (id: string) => path.join(OUT, `${id}.json`);

function needsFetch(id: string): boolean {
  if (flag("refresh") || flag("id")) return true;
  if (!fs.existsSync(file(id))) return true;
  if (flag("older-than")) {
    const at = Date.parse(JSON.parse(fs.readFileSync(file(id), "utf8")).fetchedAt);
    return !(Date.now() - at < Number(value("older-than")) * 86_400_000);
  }
  return false;
}

const roses: { hmf: { id: string | null; url: string | null } }[] = JSON.parse(fs.readFileSync(path.join(DATA, "roses.json"), "utf8"));
// Roses matched through an l.php link have no numeric id; their listing code ("2.87704") stands in for it.
const idOf = (h: { id: string | null; url: string | null }) => h.id ?? /[?&]l=(2\.\d+)/.exec(h.url ?? "")?.[1] ?? null;
let ids = [...new Set(roses.map((r) => idOf(r.hmf)).filter((i): i is string => !!i))];
if (flag("id")) ids = [value("id")];
ids = ids.filter(needsFetch);
if (flag("limit")) ids = ids.slice(0, Number(value("limit")));

fs.mkdirSync(OUT, { recursive: true });
console.log(`${ids.length} roses to fetch`);
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: flag("headless"), locale: "en-IN" });
const page = ctx.pages()[0] ?? (await ctx.newPage());
let code = 0;
try {
  for (const [n, id] of ids.entries()) {
    try {
      const wait = last + GAP_MS + Math.random() * Math.min(1500, GAP_MS) - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const url = hmfPlantUrl(id);
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (res && blocked(res.status())) throw new Blocked(`HTTP ${res.status()} from ${url}`);
      if (!res?.ok()) {
        console.error(`${id}: HTTP ${res?.status()}; will retry on the next run`);
        continue;
      }
      let details = parseDetails(await page.content(), id);
      for (const suffix of Object.keys(details.rows).length ? [] : suffixes(id)) {
        await sleep(GAP_MS);
        await page.goto(url + suffix, { waitUntil: "domcontentloaded", timeout: 30000 });
        details = parseDetails(await page.content(), id);
        if (Object.keys(details.rows).length) break;
      }
      if (!Object.keys(details.rows).length) {
        console.error(`${id}: no details found in the page (markup changed?); not saved`);
        continue;
      }
      // Write-then-rename so an interrupted run never leaves a half-written file.
      fs.writeFileSync(file(id) + ".tmp", JSON.stringify(details, null, 2) + "\n");
      fs.renameSync(file(id) + ".tmp", file(id));
      console.log(`[${n + 1}/${ids.length}] ${id}: ${Object.keys(details.rows).join(", ")}`);
    } catch (e) {
      if (e instanceof Blocked) {
        console.error(`Stopped: ${e.message}. Wait a while, then re-run to resume.`);
        code = 2;
        break;
      }
      console.error(`${id}: failed (${(e as Error).message}); will retry on the next run`);
    }
  }
} finally {
  await ctx.close();
}
process.exit(code);
