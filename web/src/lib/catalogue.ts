import MiniSearch from "minisearch";
import type { Breeder, Rose } from "./schema";

/** A rose joined with its breeder, as sent to the browser. */
export interface CatalogueRose extends Rose {
  breeder_name: string | null;
  breeder_country: string | null;
  breeder_indian: boolean;
}

export const SORTS = ["relevance", "name", "year-desc", "year-asc", "price-asc", "price-desc", "breeder"] as const;
export type Sort = (typeof SORTS)[number];
export type HmfFilter = "all" | "matched" | "unmatched";

export interface Filters {
  q: string;
  classes: string[];
  colours: string[];
  breeders: string[];
  countries: string[];
  indian: boolean;
  fragrant: boolean;
  isNew: boolean;
  awards: boolean;
  hmf: HmfFilter;
  yearFrom: number | null;
  yearTo: number | null;
  priceMin: number | null;
  priceMax: number | null;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  classes: [],
  colours: [],
  breeders: [],
  countries: [],
  indian: false,
  fragrant: false,
  isNew: false,
  awards: false,
  hmf: "all",
  yearFrom: null,
  yearTo: null,
  priceMin: null,
  priceMax: null,
};

export type FacetKey = "classes" | "colours" | "breeders" | "countries";

export function joinBreeders(roses: Rose[], breeders: Breeder[]): CatalogueRose[] {
  const byId = new Map(breeders.map((b) => [b.id, b]));
  return roses.map((r) => {
    const b = r.breeder_id ? byId.get(r.breeder_id) : undefined;
    return {
      ...r,
      breeder_name: b?.name ?? r.breeder_raw,
      breeder_country: b?.country ?? null,
      breeder_indian: b?.indian ?? false,
    };
  });
}

export function buildSearch(roses: CatalogueRose[]): MiniSearch<CatalogueRose> {
  const index = new MiniSearch<CatalogueRose>({
    fields: ["canonical_name", "ksg_name", "breeder_name", "colour_text"],
    storeFields: [],
    searchOptions: {
      boost: { canonical_name: 3, ksg_name: 2, breeder_name: 1.5 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: "AND",
    },
  });
  index.addAll(roses);
  return index;
}

function inRange(v: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  if (v === null) return false;
  return (min === null || v >= min) && (max === null || v <= max);
}

function matches(r: CatalogueRose, f: Filters, skip?: FacetKey): boolean {
  if (skip !== "classes" && f.classes.length && !f.classes.includes(r.class)) return false;
  if (skip !== "colours" && f.colours.length && !f.colours.includes(r.colour_group)) return false;
  if (skip !== "breeders" && f.breeders.length && !(r.breeder_id && f.breeders.includes(r.breeder_id))) return false;
  if (skip !== "countries" && f.countries.length && !(r.breeder_country && f.countries.includes(r.breeder_country))) return false;
  if (f.indian && !r.breeder_indian) return false;
  if (f.fragrant && !r.fragrance) return false;
  if (f.isNew && !r.is_new) return false;
  if (f.awards && r.awards.length === 0) return false;
  if (f.hmf === "matched" && !r.hmf.id) return false;
  if (f.hmf === "unmatched" && r.hmf.id) return false;
  if (!inRange(r.year, f.yearFrom, f.yearTo)) return false;
  if (!inRange(r.price_inr, f.priceMin, f.priceMax)) return false;
  return true;
}

/** Rose id to rank (0 = best hit), or null when there is no query. */
function searchRanks(index: MiniSearch<CatalogueRose>, q: string): Map<string, number> | null {
  const text = q.trim();
  if (!text) return null;
  return new Map(index.search(text).map((hit, i) => [hit.id as string, i]));
}

export function applyFilters(
  roses: CatalogueRose[],
  index: MiniSearch<CatalogueRose>,
  f: Filters,
  skip?: FacetKey,
): CatalogueRose[] {
  const ranks = searchRanks(index, f.q);
  const hits = roses.filter((r) => (!ranks || ranks.has(r.id)) && matches(r, f, skip));
  return ranks ? hits.sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!) : hits;
}

/** Counts per option, ignoring the facet's own selection so other options stay visible. */
export function facetCounts(
  roses: CatalogueRose[],
  index: MiniSearch<CatalogueRose>,
  f: Filters,
  key: FacetKey,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of applyFilters(roses, index, f, key)) {
    const value =
      key === "classes" ? r.class : key === "colours" ? r.colour_group : key === "breeders" ? r.breeder_id : r.breeder_country;
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

const byName = (a: CatalogueRose, b: CatalogueRose) => a.canonical_name.localeCompare(b.canonical_name);
/** Nulls always sort last, whichever direction. */
function nullsLast(get: (r: CatalogueRose) => number | null, dir: 1 | -1) {
  return (a: CatalogueRose, b: CatalogueRose) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return byName(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * dir || byName(a, b);
  };
}

/** `relevance` keeps the order applyFilters produced (search rank, or catalogue order). */
export function sortRoses(roses: CatalogueRose[], sort: Sort): CatalogueRose[] {
  const out = [...roses];
  switch (sort) {
    case "year-desc": return out.sort(nullsLast((r) => r.year, -1));
    case "year-asc": return out.sort(nullsLast((r) => r.year, 1));
    case "price-asc": return out.sort(nullsLast((r) => r.price_inr, 1));
    case "price-desc": return out.sort(nullsLast((r) => r.price_inr, -1));
    case "breeder":
      return out.sort((a, b) => (a.breeder_name ?? "￿").localeCompare(b.breeder_name ?? "￿") || byName(a, b));
    case "name": return out.sort(byName);
    default: return out;
  }
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pages, total: items.length };
}
