/**
 * Slow, resumable snapshot of HelpMeFind photos into web/public/photos/<hmfId>/.
 *
 *   pnpm photos [--limit N] [--id HMF_ID] [--refresh] [--headless]
 *
 * HMF refuses plain HTTP clients and headless browsers on its photo pages, so this drives a real,
 * visible Chromium (persistent profile in cache/hmf-browser, so cookies carry over between runs).
 * It opens each rose's photos tab, reads the thumbnail list from the page, then downloads the
 * full-size image (the thumbnail's "fs" twin), falling back to the thumbnail if that is refused.
 *
 * Roses that already have a manifest are skipped, so an interrupted run can simply be restarted.
 * The run stops at the first 403/429/5xx so we never hammer HMF while it is pushing back.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { fullSizeUrl, hmfPlantUrl, jpegSize, parseNext, parsePhotos, type HmfPhoto } from "../src/lib/hmf.ts";

const MAX_PAGES = 1;
const MAX_PHOTOS = Number(process.env.KSG_MAX_PHOTOS ?? 4);
const GAP_MS = Number(process.env.KSG_GAP_MS ?? 4000);
const OUT = path.join(import.meta.dirname, "..", "public", "photos");
const DATA = process.env.KSG_DATA_DIR ?? path.join(import.meta.dirname, "..", "..", "data", "sample");
const PROFILE = process.env.KSG_PROFILE ?? path.join(import.meta.dirname, "..", "..", "cache", "hmf-browser");

class Blocked extends Error {}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function gap() {
  const wait = last + GAP_MS + Math.random() * Math.min(1500, GAP_MS) - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
}
const blocked = (status: number) => status === 403 || status === 429 || status >= 500;

/** Opens a list page like a visitor would and returns the markup the browser actually rendered. */
async function listHtml(page: Page, url: string): Promise<string | null> {
  await gap();
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!res) return null;
  if (blocked(res.status())) throw new Blocked(`HTTP ${res.status()} from ${url}`);
  return res.ok() ? page.content() : null;
}

async function download(ctx: BrowserContext, p: HmfPhoto): Promise<Buffer | null> {
  for (const url of [fullSizeUrl(p.src), p.src]) {
    await gap();
    const res = await ctx.request.get(url, { headers: { referer: p.pageUrl }, timeout: 20000 });
    if (res.ok()) return Buffer.from(await res.body());
    if (blocked(res.status()) && url === p.src) throw new Blocked(`HTTP ${res.status()} from ${url}`);
  }
  return null;
}

async function snapshot(ctx: BrowserContext, page: Page, id: string) {
  const found: HmfPhoto[] = [];
  let cursor: string | null = null;
  for (let n = 0; n < MAX_PAGES && found.length < MAX_PHOTOS; n++) {
    const paging = cursor ? `&qn=${cursor.split(".")[0]}&qc=${cursor.split(".")[1]}` : "";
    const html = await listHtml(page, `${hmfPlantUrl(id)}&tab=36${paging}`);
    if (!html) break;
    found.push(...parsePhotos(html));
    cursor = parseNext(html);
    if (!cursor) break;
  }

  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const photos: { file: string; width: number; height: number; pageUrl: string; credit: string | null; creditUrl: string | null }[] = [];
  for (const p of found.slice(0, MAX_PHOTOS)) {
    const body = await download(ctx, p);
    if (!body) continue;
    const size = jpegSize(body) ?? { width: p.width, height: p.height };
    const file = `${photos.length + 1}.jpg`;
    fs.writeFileSync(path.join(dir, file), body);
    photos.push({ file, ...size, pageUrl: p.pageUrl, credit: p.credit, creditUrl: p.creditUrl });
  }
  fs.writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({ hmfId: id, fetchedAt: new Date().toISOString(), photos }, null, 2) + "\n",
  );
  return photos;
}

const roses: { hmf: { id: string | null; url: string | null } }[] = JSON.parse(fs.readFileSync(path.join(DATA, "roses.json"), "utf8"));
// Roses matched through an l.php link have no numeric id; their listing code ("2.87704") stands in for it.
const idOf = (h: { id: string | null; url: string | null }) => h.id ?? /[?&]l=(2\.\d+)/.exec(h.url ?? "")?.[1] ?? null;
let ids = [...new Set(roses.map((r) => idOf(r.hmf)).filter((i): i is string => !!i))];
if (flag("id")) ids = [value("id")];
if (!flag("refresh")) ids = ids.filter((i) => !fs.existsSync(path.join(OUT, i, "index.json")));
if (flag("limit")) ids = ids.slice(0, Number(value("limit")));

console.log(`${ids.length} roses to fetch`);
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: flag("headless"), locale: "en-IN" });
const page = ctx.pages()[0] ?? (await ctx.newPage());
let code = 0;
try {
  for (const [n, id] of ids.entries()) {
    try {
      const photos = await snapshot(ctx, page, id);
      console.log(`[${n + 1}/${ids.length}] ${id}: ${photos.length} photos, largest ${Math.max(0, ...photos.map((p) => p.width))}px wide`);
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
