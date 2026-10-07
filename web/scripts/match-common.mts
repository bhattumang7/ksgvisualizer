/**
 * Shared by the two ways of finding HMF candidates (`pnpm hmf-search` on HMF's own name search, `pnpm hmf-match`
 * on Google): the rose list, the per-name result cache, and the offline scoring that writes
 * data/hmf-matches.json and data/review/hmf-matches.csv. Scoring never makes a request.
 */
import fs from "node:fs";
import path from "node:path";
import { breederTerms, matchRose, normalizeName, type MatchOutcome, type RoseQuery, type SearchResult } from "../src/lib/hmf-match.ts";

export const ROOT = path.join(import.meta.dirname, "..", "..");
export const DATA = process.env.KSG_DATA_DIR ?? path.join(ROOT, "data");

export interface Rose {
  id: string;
  canonical_name: string;
  breeder_raw: string | null;
  breeder_id: string | null;
  year: number | null;
  class: string | null;
}
export interface Cached {
  query: string;
  fetchedAt: string;
  results: SearchResult[];
  /** HMF showed more result pages than the one read. */
  paged?: boolean;
}

export const roses: Rose[] = JSON.parse(fs.readFileSync(path.join(DATA, "roses.json"), "utf8"));
const breeders: { id: string; name: string }[] = JSON.parse(fs.readFileSync(path.join(DATA, "breeders.json"), "utf8"));
const breederName = new Map(breeders.map((b) => [b.id, b.name]));

/** Roses a person has already decided (data/overrides.json has an hmf entry): they are left out of the review list. */
const overridesFile = path.join(DATA, "overrides.json");
const decided = (): Set<string> => {
  try {
    const o = JSON.parse(fs.readFileSync(overridesFile, "utf8")) as Record<string, { hmf?: unknown }>;
    return new Set(Object.keys(o).filter((id) => o[id]?.hmf));
  } catch {
    return new Set();
  }
};

export const breederTermsFor = (r: Rose) => breederTerms(r.breeder_raw, r.breeder_id ? (breederName.get(r.breeder_id) ?? null) : null);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const jitter = (min: number, max: number) => min + Math.random() * (max - min);

const titleCase = (s: string) => s.toLowerCase().replaceAll(/(^|[\s(-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

/**
 * The names to search for one KSG entry: "ROSE SULLIVAN (VIR WINE)" is searched as "Rose Sullivan" and "Vir Wine",
 * "SA GARDEN / TUIN" as both halves. Spelling is kept (apostrophes and all) because the site does the matching.
 */
export function searchTerms(name: string): string[] {
  const base = name.replaceAll(/\([^)]*\)/g, " ");
  const inner = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const parts = [...base.split("/"), ...inner.flatMap((p) => p.split("/"))].map((s) => s.replaceAll(/^[\s.]+|[\s.]+$/g, "")).filter(Boolean);
  return [...new Set((parts.length ? parts : [name]).map(titleCase))];
}

const termKey = (term: string) => normalizeName(term).replaceAll(" ", "-");

/**
 * When the name search finds nothing usable (HMF spells it "Princesse", KSG "Princess"), one looser search is made on
 * the rarest word of the name, rarity being how few catalogue names contain it. A long list is paged by HMF and only
 * the first page is read, so a common word would be useless: words in more than 5 catalogue names are not used.
 */
const tokenCount = new Map<string, number>();
for (const r of roses) for (const t of new Set(normalizeName(r.canonical_name).split(" "))) tokenCount.set(t, (tokenCount.get(t) ?? 0) + 1);

export function fallbackTerm(term: string): string | null {
  const words = normalizeName(term).split(" ").filter((t) => t.length >= 4 && (tokenCount.get(t) ?? 0) <= 5);
  words.sort((a, b) => (tokenCount.get(a) ?? 0) - (tokenCount.get(b) ?? 0) || b.length - a.length);
  const w = words[0];
  return w && w !== normalizeName(term) ? w : null;
}

/** One cache file per searched name, shared by every rose that has that name. */
export const cacheFor = (dir: string) => (term: string) => path.join(dir, `${termKey(term)}.json`);
/** The looser follow-up search for a name lives next to it. */
export const fallbackCacheFor = (dir: string) => (word: string) => path.join(dir, `contains-${termKey(word)}.json`);

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(file + ".tmp", file);
}

/** Names still to search, de-duplicated across roses, in catalogue order. */
export function pendingTerms(dir: string, only: Rose[], refresh: boolean): string[] {
  const file = cacheFor(dir);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of only) {
    for (const t of searchTerms(r.canonical_name)) {
      const k = termKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      if (refresh || !fs.existsSync(file(t))) out.push(t);
    }
  }
  return out;
}

const csvCell = (s: string) => `"${s.replaceAll('"', '""')}"`;

interface Row {
  rose: Rose;
  m: MatchOutcome;
  cached: Cached;
  /** Set when another KSG entry is the same rose (same name, breeder and year): it shares the match instead of competing for it. */
  duplicateOf?: string;
}

const strongCount = (m: MatchOutcome) => m.evidence.filter((e) => !e.startsWith("class:") && e !== "sole-result").length;
const sameRose = (a: Rose, b: Rose) =>
  (a.breeder_id ?? "") === (b.breeder_id ?? "") && (a.year === b.year || a.year === null || b.year === null || Math.abs(a.year - b.year) <= 1);

/**
 * Same-named KSG roses can land on one HMF plant. Entries that are the same rose (a repeated listing) all keep it;
 * entries that differ in breeder or year are different roses, so only the best-supported one keeps the plant and
 * the others are dropped to "none" for review (the plant belongs to the other one).
 */
function resolveDuplicates(rows: Row[]) {
  const byUrl = new Map<string, Row[]>();
  for (const r of rows) if (r.m.url) byUrl.set(r.m.url, [...(byUrl.get(r.m.url) ?? []), r]);
  for (const group of byUrl.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => strongCount(b.m) - strongCount(a.m) || Number(b.m.match_confidence === "exact") - Number(a.m.match_confidence === "exact"));
    const keeper = group[0];
    for (const r of group.slice(1)) {
      if (sameRose(r.rose, keeper.rose)) r.duplicateOf = keeper.rose.id;
      else r.m = { ...r.m, id: null, url: null, match_confidence: "none", hmf_title: null, evidence: [] };
    }
  }
}

export function score(dir: string) {
  const file = cacheFor(dir);
  const rows: Row[] = [];
  let unsearched = 0;
  for (const r of [...roses].sort((a, b) => a.id.localeCompare(b.id))) {
    const terms = searchTerms(r.canonical_name);
    if (!terms.every((t) => fs.existsSync(file(t)))) {
      unsearched++;
      continue;
    }
    const fbFile = fallbackCacheFor(dir);
    const parts: Cached[] = terms.flatMap((t) => {
      const fb = fallbackTerm(t);
      return [t, ...(fb && fs.existsSync(fbFile(fb)) ? [fb] : [])].map((x, i) => JSON.parse(fs.readFileSync(i ? fbFile(x) : file(x), "utf8")) as Cached);
    });
    const cached: Cached = { query: parts.map((p) => p.query).join(" | "), fetchedAt: parts[0].fetchedAt, results: parts.flatMap((p) => p.results) };
    const q: RoseQuery = {
      name: r.canonical_name,
      year: r.year,
      cls: r.class,
      breeders: breederTermsFor(r),
    };
    rows.push({ rose: r, m: matchRose(q, cached.results), cached });
  }
  resolveDuplicates(rows);

  const matches: Record<string, unknown> = {};
  const review: string[] = [["rose_id", "ksg_name", "breeder", "year", "confidence", "note", "rank", "url", "title", "score", "evidence", "snippet"].join(",")];
  const counts = { exact: 0, fuzzy: 0, none: 0 };
  const done = decided();
  let reviewed = 0;
  for (const { rose: r, m, cached, duplicateOf } of rows) {
    if (done.has(r.id)) {
      reviewed++;
      continue;
    }
    counts[m.match_confidence]++;
    matches[r.id] = { id: m.id, url: m.url, match_confidence: m.match_confidence, hmf_title: m.hmf_title, evidence: m.evidence, query: cached.query, ...(duplicateOf && { duplicate_of: duplicateOf }) };
    if (m.match_confidence === "exact") continue;
    const head = [r.id, r.canonical_name, r.breeder_raw ?? "", String(r.year ?? ""), m.match_confidence];
    const conflicted = m.candidates.length > 0 && m.candidates.every((c) => c.conflict);
    const note = conflicted ? "same name on HMF but different year/breeder: probably not on HMF" : m.candidates.length ? "" : "no HMF plant page in the results";
    if (!m.candidates.length) review.push([...head, note, "", "", "", "", "", ""].map(csvCell).join(","));
    for (const [i, c] of m.candidates.entries()) {
      review.push([...head, i ? "" : note, String(i + 1), c.url, c.title, String(c.score), c.evidence.join(" ") + (c.conflict ? " CONFLICT" : ""), c.snippet].map(csvCell).join(","));
    }
  }
  writeJson(path.join(DATA, "hmf-matches.json"), matches);
  fs.mkdirSync(path.join(DATA, "review"), { recursive: true });
  fs.writeFileSync(path.join(DATA, "review", "hmf-matches.csv"), review.join("\n") + "\n");
  console.log(`Matches: ${counts.exact} exact, ${counts.fuzzy} fuzzy, ${counts.none} none (probably not on HMF or needs review), ${reviewed} decided by hand (data/overrides.json), ${unsearched} not searched yet`);
}

