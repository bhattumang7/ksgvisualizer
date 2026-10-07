/**
 * Offline matching of KSG roses to HelpMeFind plant pages, using Google search results
 * (url, title, snippet) as the only evidence. Nothing here touches the network.
 */

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  /** The name that was searched, when HMF redirected it to this plant: the plant is known by that name, as a synonym. */
  alias?: string;
}

export interface RoseQuery {
  name: string;
  year: number | null;
  /** Every spelling of the breeder worth looking for in a title or snippet (raw KSG name, canonical name, aliases). */
  breeders: string[];
  cls: string | null;
}

export type Confidence = "exact" | "fuzzy" | "none";

export interface Candidate {
  key: string;
  id: string | null;
  url: string;
  title: string;
  snippet: string;
  score: number;
  nameExact: boolean;
  evidence: string[];
  /** Set when the snippet contradicts the KSG entry (years that don't fit, no breeder match): another rose with the same name. */
  conflict: boolean;
}

export interface MatchOutcome {
  id: string | null;
  url: string | null;
  match_confidence: Confidence;
  hmf_title: string | null;
  evidence: string[];
  candidates: Candidate[];
}

const HMF_HOSTS = new Set(["helpmefind.com", "www.helpmefind.com"]);

/**
 * Recognises an HMF plant page. HMF has two forms for one rose and their numbers differ:
 * `/rose/pl.php?n=<id>` (the id we store) and `/(rose|gardening)/l.php?l=2.<x>[.<tab>]` (url only, id unknown).
 * Photo (`l=21.`), breeder (`l=99.`) and every other page type return null.
 */
export function parseHmfUrl(raw: string): { key: string; id: string | null; url: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
    if (u.hostname.endsWith("google.com") && u.searchParams.get("q")) u = new URL(u.searchParams.get("q")!);
  } catch {
    return null;
  }
  if (!HMF_HOSTS.has(u.hostname)) return null;
  const n = /^\/rose\/pl\.php$/.test(u.pathname) ? /^\d{1,8}$/.exec(u.searchParams.get("n") ?? "") : null;
  if (n) return { key: `n:${n[0]}`, id: n[0], url: `https://www.helpmefind.com/rose/pl.php?n=${n[0]}` };
  const l = /^\/(?:rose|gardening)\/l\.php$/.test(u.pathname) ? /^(2\.\d+)(?:\.\d+)?$/.exec(u.searchParams.get("l") ?? "") : null;
  if (l) return { key: `l:${l[1]}`, id: null, url: `https://www.helpmefind.com/gardening/l.php?l=${l[1]}` };
  return null;
}

export function normalizeName(s: string): string {
  return s
    .replaceAll(/[®™]/g, "") // before NFKD, which would turn ™ into "TM"
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/['’‘`"“”]/g, "")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

const DESCRIPTORS =
  /\b(hybrid tea|floribunda|grandiflora|miniature|mini flora|polyantha|climber|climbing|shrub|rambler|rose|roses|description|plant|helpmefind|photos?|reviews?)\b/g;

const squish = (s: string) => s.replaceAll(/\s+/g, " ").trim();
const stripDescriptors = (s: string) => squish(s.replaceAll(DESCRIPTORS, " "));
const tokenSort = (s: string) => s.split(" ").sort().join(" ");

/**
 * Every name a KSG entry goes by: "ROSE SULLIVAN (VIR WINE)" is both "rose sullivan" and "vir wine",
 * "SA GARDEN / TUIN" is both halves. The full text is kept last as a fallback. The first variant is the primary name.
 */
export function nameVariants(name: string): string[] {
  const inner = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const base = name.replaceAll(/\([^)]*\)/g, " ");
  const all = [...base.split("/"), ...inner.flatMap((p) => p.split("/")), name].map((v) => stripDescriptors(normalizeName(v)));
  return [...new Set(all.filter(Boolean))];
}

/** The rose name inside an HMF result title, e.g. "'Earth Angel' Floribunda Rose - HelpMeFind" -> "earth angel". */
export function titleName(title: string): string {
  const first = title.replaceAll(/\([^)]*\)/g, " ").split(/\s[-–|:]\s/)[0];
  return stripDescriptors(normalizeName(first));
}

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const range = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const am: boolean[] = new Array(la).fill(false);
  const bm: boolean[] = new Array(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - range); j <= Math.min(lb - 1, i + range); j++) {
      if (!bm[j] && a[i] === b[j]) {
        am[i] = bm[j] = true;
        m++;
        break;
      }
    }
  }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (m / la + m / lb + (m - t / 2) / m) / 3;
}

export function similarity(a: string, b: string): number {
  const x = tokenSort(a);
  const y = tokenSort(b);
  const j = jaro(x, y);
  let p = 0;
  while (p < 4 && x[p] && x[p] === y[p]) p++;
  return j + p * 0.1 * (1 - j);
}

const STOP_TOKENS = new Set(["roses", "rosen", "rose", "international", "sons", "sohne", "nursery", "nurseries", "david", "john", "thomas"]);

/** Breeder spellings worth searching for: the raw KSG name, the canonical name, its surnames, and known aliases. */
export function breederTerms(raw: string | null, canonical: string | null): string[] {
  const out = new Set<string>();
  const alias: Record<string, string[]> = {
    kor: ["kordes"],
    poulson: ["poulsen"],
    "j and p": ["jackson", "perkins"],
    dorrieux: ["dorieux"],
    dorieux: ["dorrieux"],
    winchel: ["winchell"],
    mcgredy: ["mcgredy"],
  };
  for (const src of [raw, canonical]) {
    if (!src) continue;
    const n = normalizeName(src.replaceAll(/\(.*?\)/g, " "));
    if (!n) continue;
    if (n.length >= 3) out.add(n);
    for (const t of n.split(" ")) if (t.length >= 5 && !STOP_TOKENS.has(t)) out.add(t);
    for (const a of alias[n] ?? []) out.add(a);
  }
  return [...out];
}

const hasTerm = (text: string, term: string) => ` ${text} `.includes(` ${term} `);

const CLASS_WORDS: [string, RegExp][] = [
  ["Hybrid Tea", /hybrid tea/],
  ["Floribunda", /floribunda/],
  ["Miniature", /miniature|mini flora/],
  ["Climber", /climb/],
  ["Shrub", /shrub/],
  ["Polyantha", /polyantha/],
];

const yearsIn = (text: string) => [...text.matchAll(/\b(1[89]\d\d|20\d\d)\b/g)].map((m) => Number(m[1]));

function evidenceFor(q: RoseQuery, text: string): string[] {
  const ev: string[] = [];
  const t = normalizeName(text);
  const b = q.breeders.find((x) => hasTerm(t, x));
  if (b) ev.push(`breeder:${b}`);
  if (q.year) {
    const y = yearsIn(text).find((v) => Math.abs(v - q.year!) <= 1);
    if (y) ev.push(`year:${y}`);
  }
  const c = CLASS_WORDS.find(([name, re]) => name === q.cls && re.test(t));
  if (c) ev.push(`class:${c[0]}`);
  return ev;
}

const strong = (c: Candidate) => c.evidence.filter((e) => !e.startsWith("class:") && e !== "sole-result").length;

/** Scores every HMF plant page in the results and decides the best match. */
export function matchRose(q: RoseQuery, results: SearchResult[]): MatchOutcome {
  const wants = nameVariants(q.name);
  const byKey = new Map<string, Candidate>();
  for (const r of results) {
    const p = parseHmfUrl(r.url);
    if (!p) continue;
    const got = titleName(r.title);
    const c: Candidate = {
      key: p.key,
      id: p.id,
      url: p.url,
      title: r.title,
      snippet: r.snippet,
      score: Number(Math.max(...wants.map((w) => similarity(w, got)), r.alias && wants.includes(stripDescriptors(normalizeName(r.alias))) ? 0.9 : 0).toFixed(3)),
      nameExact: wants.includes(got),
      evidence: evidenceFor(q, `${r.title} ${r.snippet}`),
      conflict: false,
    };
    // The same name belongs to many HMF roses: years that all miss ours, with no breeder match, mean a different rose.
    const years = yearsIn(r.snippet);
    c.conflict = !!q.year && years.length > 0 && !c.evidence.some((e) => e.startsWith("year:") || e.startsWith("breeder:"));
    const old = byKey.get(p.key);
    if (!old || strong(c) > strong(old) || c.score > old.score) byKey.set(p.key, c);
  }
  // One plant in the whole result list: the name search found exactly one rose by that name, so the name alone settles it.
  const sole = byKey.size === 1;
  if (sole) for (const c of byKey.values()) c.evidence.push("sole-result");
  const candidates = [...byKey.values()].sort(
    (a, b) => Number(a.conflict) - Number(b.conflict) || Number(b.nameExact) - Number(a.nameExact) || strong(b) - strong(a) || b.score - a.score,
  );
  const best = candidates.find((c) => !c.conflict);
  const none: MatchOutcome = { id: null, url: null, match_confidence: "none", hmf_title: null, evidence: [], candidates: candidates.slice(0, 3) };
  if (!best || (!best.nameExact && best.score < 0.85)) return none;
  const next = candidates.filter((c) => !c.conflict)[1];
  const tied = !!next && next.nameExact === best.nameExact && strong(next) === strong(best);
  const exact = best.nameExact && (strong(best) > 0 || sole) && !tied;
  return {
    id: best.id,
    url: best.url,
    match_confidence: exact ? "exact" : "fuzzy",
    hmf_title: best.title,
    evidence: best.evidence,
    candidates: candidates.slice(0, 3),
  };
}
