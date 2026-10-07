/**
 * Slow, resumable snapshot of HelpMeFind photo thumbnails into web/public/photos/<hmfId>/.
 *
 *   node --experimental-strip-types scripts/fetch-photos.mts [--limit N] [--id HMF_ID] [--refresh]
 *
 * Roses that already have a manifest are skipped, so an interrupted run can simply be restarted.
 * The run stops at the first 403/429/5xx so we never hammer HMF while it is pushing back.
 */
import fs from "node:fs";
import path from "node:path";
import { hmfPlantUrl, parseNext, parsePhotos, type HmfPhoto } from "../src/lib/hmf.ts";

const USER_AGENT = "KSGVisualizer/0.1 (personal catalogue project)";
const MAX_PAGES = 2;
const MAX_PHOTOS = 12;
const GAP_MS = 4000;
const OUT = path.join(import.meta.dirname, "..", "public", "photos");
const DATA = process.env.KSG_DATA_DIR ?? path.join(import.meta.dirname, "..", "..", "data", "sample");

class Blocked extends Error {}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function polite(url: string): Promise<Response> {
  const wait = last + GAP_MS + Math.random() * 1500 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15000) });
  if (res.status === 403 || res.status === 429 || res.status >= 500) throw new Blocked(`HTTP ${res.status} from ${url}`);
  return res;
}

async function snapshot(id: string) {
  const found: HmfPhoto[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES && found.length < MAX_PHOTOS; page++) {
    const paging = cursor ? `&qn=${cursor.split(".")[0]}&qc=${cursor.split(".")[1]}` : "";
    const res = await polite(`${hmfPlantUrl(id)}&tab=36${paging}`);
    if (!res.ok) break;
    const html = await res.text();
    found.push(...parsePhotos(html));
    cursor = parseNext(html);
    if (!cursor) break;
  }

  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const photos: { file: string; width: number; height: number; pageUrl: string; credit: string | null; creditUrl: string | null }[] = [];
  for (const p of found.slice(0, MAX_PHOTOS)) {
    const res = await polite(p.src);
    if (!res.ok) continue;
    const file: string = `${photos.length + 1}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
    photos.push({ file, width: p.width, height: p.height, pageUrl: p.pageUrl, credit: p.credit, creditUrl: p.creditUrl });
  }
  fs.writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({ hmfId: id, fetchedAt: new Date().toISOString(), photos }, null, 2) + "\n",
  );
  return photos.length;
}

const roses: { hmf: { id: string | null } }[] = JSON.parse(fs.readFileSync(path.join(DATA, "roses.json"), "utf8"));
let ids = [...new Set(roses.map((r) => r.hmf.id).filter((i): i is string => !!i))];
if (flag("id")) ids = [value("id")];
if (!flag("refresh")) ids = ids.filter((i) => !fs.existsSync(path.join(OUT, i, "index.json")));
if (flag("limit")) ids = ids.slice(0, Number(value("limit")));

console.log(`${ids.length} roses to fetch`);
for (const [n, id] of ids.entries()) {
  try {
    console.log(`[${n + 1}/${ids.length}] ${id}: ${await snapshot(id)} photos`);
  } catch (e) {
    if (e instanceof Blocked) {
      console.error(`Stopped: ${e.message}. Wait a while, then re-run to resume.`);
      process.exit(2);
    }
    console.error(`${id}: failed (${(e as Error).message}); will retry on the next run`);
  }
}
