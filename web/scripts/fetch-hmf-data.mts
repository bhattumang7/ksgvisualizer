/**
 * Slow, resumable snapshot of HelpMeFind plant-page details into data/hmf/<hmfId>.json.
 *
 *   pnpm hmf-data [--limit N] [--id HMF_ID] [--refresh] [--older-than DAYS]
 *
 * Roses that already have a file are skipped, so an interrupted run can simply be restarted and the
 * data is never re-read from HMF unless you ask: --refresh redoes everything, --id redoes one rose,
 * --older-than redoes files fetched more than DAYS ago. Stops at the first 403/429/5xx.
 */
import fs from "node:fs";
import path from "node:path";
import { hmfPlantUrl } from "../src/lib/hmf.ts";
import { hmfFetch, persistCookies } from "../src/lib/hmf-client.ts";
import { parseDetails } from "../src/lib/hmf-details.ts";

const GAP_MS = 4000;
const ROOT = path.join(import.meta.dirname, "..", "..");
const OUT = process.env.KSG_HMF_DIR ?? path.join(ROOT, "data", "hmf");
const DATA = process.env.KSG_DATA_DIR ?? path.join(ROOT, "data", "sample");

persistCookies(path.join(import.meta.dirname, "..", "..", "cache", "hmf-cookies.json"));

class Blocked extends Error {}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function polite(url: string, referer?: string): Promise<Response> {
  const wait = last + GAP_MS + Math.random() * 1500 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await hmfFetch(url, { referer, signal: AbortSignal.timeout(15000) });
  if (res.status === 403 || res.status === 429 || res.status >= 500) throw new Blocked(`HTTP ${res.status} from ${url}`);
  return res;
}

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

const roses: { hmf: { id: string | null } }[] = JSON.parse(fs.readFileSync(path.join(DATA, "roses.json"), "utf8"));
let ids = [...new Set(roses.map((r) => r.hmf.id).filter((i): i is string => !!i))];
if (flag("id")) ids = [value("id")];
ids = ids.filter(needsFetch);
if (flag("limit")) ids = ids.slice(0, Number(value("limit")));

fs.mkdirSync(OUT, { recursive: true });
console.log(`${ids.length} roses to fetch`);
for (const [n, id] of ids.entries()) {
  try {
    const res = await polite(hmfPlantUrl(id));
    if (!res.ok) {
      console.error(`${id}: HTTP ${res.status}; will retry on the next run`);
      continue;
    }
    const details = parseDetails(await res.text(), id);
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
      process.exit(2);
    }
    console.error(`${id}: failed (${(e as Error).message}); will retry on the next run`);
  }
}
