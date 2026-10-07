/**
 * Finds the HelpMeFind plant for each KSG rose using HMF's own name search (/rose/plants.php), then
 * matches the result rows (name, class, "Breeder (year)") against the KSG breeder, year and class offline.
 * One request per unique name; the page is plain HTML, so no browser is needed.
 *
 *   pnpm hmf-search [--limit N] [--id ROSE_ID] [--refresh] [--score-only] [--delay MIN-MAX] [--threads N]
 *
 * Gentle by design: --limit defaults to 100 requests per run, 5-8 s apart by default (--delay 2-3 to go faster), one at a time. It stops at the
 * first 403/429/5xx or unexpected page. Raw result pages are parsed and cached per name in cache/hmf-search/
 * (gitignored), so an interrupted or later run resumes and no name is ever fetched twice unless --refresh.
 * Output: data/hmf-matches.json (merged into roses.json by `python -m pipeline.run`) and
 * data/review/hmf-matches.csv (every match that is not exact). Scoring is offline: --score-only re-runs it for free.
 */
import path from "node:path";
import { persistCookies, hmfFetch } from "../src/lib/hmf-client.ts";
import { parseHmfUrl } from "../src/lib/hmf-match.ts";
import { hasMorePages, hmfSearchUrl, isSearchPage, parseSearchRows } from "../src/lib/hmf-search.ts";
import fs from "node:fs";
import { matchRose } from "../src/lib/hmf-match.ts";
import { ROOT, breederTermsFor, cacheFor, fallbackCacheFor, fallbackTerm, jitter, pendingTerms, roses, score, searchTerms, sleep, writeJson, type Cached } from "./match-common.mts";

const CACHE = path.join(ROOT, "cache", "hmf-search");
const DEFAULT_LIMIT = 100;
const REFERER = "https://www.helpmefind.com/rose/plants.php";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];
const cacheFile = cacheFor(CACHE);

/** Seconds between requests, "--delay 2-3" or "--delay 2"; default 5-8. */
const [DELAY_MIN, DELAY_MAX] = (flag("delay") ? value("delay") : "5-8").split("-").map((x) => Number(x) * 1000) as [number, number?];
const THREADS = Math.max(1, Number(flag("threads") ? value("threads") : 1));
const gap = () => jitter(DELAY_MIN, DELAY_MAX ?? DELAY_MIN);

const blocked = (status: number) => status === 403 || status === 429 || status >= 500;

const decode = (s: string) => s.replaceAll("&amp;", "&").replaceAll("&#039;", "'").replaceAll("&quot;", '"').replaceAll(/\s+/g, " ").trim();

/**
 * HMF sends a search with exactly one hit straight to that plant's page (a redirect with no body). The page is read
 * once for its title and description, which stand in for the one result row.
 */
async function followSingleHit(location: string): Promise<{ url: string; title: string; snippet: string } | null> {
  const plant = parseHmfUrl(new URL(location, "https://www.helpmefind.com").href);
  if (!plant) return null;
  await sleep(gap());
  const res = await hmfFetch(plant.url, { referer: REFERER });
  if (!res.ok) return null;
  const html = await res.text();
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1];
  if (!title) return null;
  const desc = /<meta[^>]+name="description"[^>]+content="([^"]*)"/i.exec(html)?.[1] ?? "";
  return { url: plant.url, title: decode(title), snippet: decode(desc) };
}

/** Fetches one search page and caches its rows; returns a process exit code when the run must stop, else null. */
async function fetchOne(term: string, mode: "best" | "contains", file: string, n: number, total: number): Promise<number | null> {
  try {
    const res = await hmfFetch(hmfSearchUrl(term, mode), { referer: REFERER, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const hit = await followSingleHit(location);
      if (!hit) {
        console.error(`"${term}": redirected to ${location}, which is not a readable plant page; will retry on the next run`);
        return null;
      }
      writeJson(file, { query: mode === "best" ? term : `contains: ${term}`, fetchedAt: new Date().toISOString(), results: [hit] } satisfies Cached);
      console.log(`[${n}/${total}] ${mode === "best" ? "" : "contains "}${term}: single hit "${hit.title}"`);
      return null;
    }
    if (blocked(res.status)) {
      console.error(`Stopped: HTTP ${res.status} from HMF for "${term}". Wait a while, then re-run to resume.`);
      return 2;
    }
    if (!res.ok) {
      console.error(`"${term}": HTTP ${res.status}; will retry on the next run`);
      return null;
    }
    const html = await res.text();
    if (!isSearchPage(html)) {
      console.error(`Stopped: HMF returned something other than a search page for "${term}" (blocked, or the markup changed). Nothing was saved.`);
      return 3;
    }
    const results = parseSearchRows(html);
    writeJson(file, { query: mode === "best" ? term : `contains: ${term}`, fetchedAt: new Date().toISOString(), results, ...(hasMorePages(html) && { paged: true }) } satisfies Cached);
    console.log(`[${n}/${total}] ${mode === "best" ? "" : "contains "}${term}: ${results.length} rows${hasMorePages(html) ? " (more pages not read)" : ""}`);
  } catch (e) {
    console.error(`"${term}": failed (${(e as Error).message}); will retry on the next run`);
  }
  return null;
}

/** Second pass: roses the name search could not match get one looser search on their rarest word. */
function fallbackWords(wanted: typeof roses): string[] {
  const done = fallbackCacheFor(CACHE);
  const out = new Set<string>();
  for (const r of wanted) {
    const terms = searchTerms(r.canonical_name);
    if (!terms.every((t) => fs.existsSync(cacheFile(t)))) continue;
    const results = terms.flatMap((t) => (JSON.parse(fs.readFileSync(cacheFile(t), "utf8")) as Cached).results);
    const q = { name: r.canonical_name, year: r.year, cls: r.class, breeders: breederTermsFor(r) };
    if (matchRose(q, results).match_confidence !== "none") continue;
    for (const t of terms) {
      const w = fallbackTerm(t);
      if (w && !fs.existsSync(done(w))) out.add(w);
    }
  }
  return [...out];
}

/** Runs `work` over the items with `threads` workers, each waiting `gap()` between its own requests; all stop on the first non-null exit code. */
async function pool<T>(items: T[], threads: number, work: (item: T, n: number) => Promise<number | null>): Promise<number> {
  let next = 0;
  let stop = 0;
  await Promise.all(
    Array.from({ length: Math.min(threads, items.length) }, async (_, w) => {
      await sleep(w * 400);
      for (let first = true; !stop && next < items.length; first = false) {
        if (!first) await sleep(gap());
        const n = next++;
        stop ||= (await work(items[n], n)) ?? 0;
      }
    }),
  );
  return stop;
}

async function search(todo: string[], fallbacks: (() => string[]) | null, limit: number): Promise<number> {
  persistCookies(path.join(ROOT, "cache", "hmf-search-cookies.json"));
  console.log(`${todo.length} names to search, ${THREADS} at a time`);
  const stop = await pool(todo, THREADS, (term, n) => fetchOne(term, "best", cacheFile(term), n + 1, todo.length));
  if (stop) return stop;
  const words = fallbacks && todo.length < limit ? fallbacks().slice(0, limit - todo.length) : [];
  if (words.length) console.log(`${words.length} names with no match get one looser search each`);
  return pool(words, THREADS, (w, n) => fetchOne(w, "contains", fallbackCacheFor(CACHE)(w), n + 1, words.length));
}

let code = 0;
if (!flag("score-only")) {
  const wanted = flag("id") ? roses.filter((r) => r.id === value("id")) : roses;
  if (flag("id") && !wanted.length) {
    console.error(`No rose with id ${value("id")}`);
    process.exit(1);
  }
  const limit = flag("limit") ? Number(value("limit")) : DEFAULT_LIMIT;
  const todo = pendingTerms(CACHE, wanted, flag("refresh") || flag("id")).slice(0, limit);
  const fallbacks = () => fallbackWords(wanted);
  if (todo.length || fallbacks().length) code = await search(todo, fallbacks, limit);
  else console.log("Nothing left to search");
}
score(CACHE);
process.exit(code);
