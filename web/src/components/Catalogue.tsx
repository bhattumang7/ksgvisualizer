"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates,
} from "nuqs";
import {
  SORTS, applyFilters, buildSearch, facetCounts, paginate, sortRoses,
  type CatalogueRose, type FacetKey, type Filters, type Sort,
} from "@/lib/catalogue";
import { COLOUR_GROUPS, ROSE_CLASSES, type Breeder } from "@/lib/schema";
import { FilterPanel, type Option } from "./FilterPanel";
import { RoseCard } from "./RoseCard";

const SORT_LABELS: Record<Sort, string> = {
  relevance: "Best match",
  name: "Name A–Z",
  "year-desc": "Newest first",
  "year-asc": "Oldest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  breeder: "Breeder A–Z",
};

const params = {
  q: parseAsString.withDefault(""),
  class: parseAsArrayOf(parseAsString).withDefault([]),
  colour: parseAsArrayOf(parseAsString).withDefault([]),
  breeder: parseAsArrayOf(parseAsString).withDefault([]),
  country: parseAsArrayOf(parseAsString).withDefault([]),
  indian: parseAsBoolean.withDefault(false),
  fragrant: parseAsBoolean.withDefault(false),
  new: parseAsBoolean.withDefault(false),
  awards: parseAsBoolean.withDefault(false),
  hmf: parseAsStringLiteral(["all", "matched", "unmatched"] as const).withDefault("all"),
  from: parseAsInteger,
  to: parseAsInteger,
  pmin: parseAsInteger,
  pmax: parseAsInteger,
  sort: parseAsStringLiteral(SORTS),
  view: parseAsStringLiteral(["grid", "list"] as const).withDefault("grid"),
  page: parseAsInteger.withDefault(1),
};

// Filter field -> URL key.
const KEYS: Record<keyof Filters, keyof typeof params> = {
  q: "q", classes: "class", colours: "colour", breeders: "breeder", countries: "country", indian: "indian",
  fragrant: "fragrant", isNew: "new", awards: "awards", hmf: "hmf", yearFrom: "from", yearTo: "to", priceMin: "pmin", priceMax: "pmax",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Catalogue({ roses, breeders, pageSize }: Readonly<{ roses: CatalogueRose[]; breeders: Breeder[]; pageSize: number }>) {
  const [p, setP] = useQueryStates(params);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filters: Filters = {
    q: p.q, classes: p.class, colours: p.colour, breeders: p.breeder, countries: p.country, indian: p.indian,
    fragrant: p.fragrant, isNew: p.new, awards: p.awards, hmf: p.hmf, yearFrom: p.from, yearTo: p.to, priceMin: p.pmin, priceMax: p.pmax,
  };
  const sort: Sort = p.sort ?? (p.q.trim() ? "relevance" : "name");

  const index = useMemo(() => buildSearch(roses), [roses]);
  const results = useMemo(
    () => sortRoses(applyFilters(roses, index, filters), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filters` is rebuilt from `p` each render
    [roses, index, p, sort],
  );
  const page = paginate(results, p.page, pageSize);

  // Out-of-range page numbers in a shared URL snap back to the last page.
  useEffect(() => {
    if (p.page !== page.page) setP({ page: page.page === 1 ? null : page.page }, { history: "replace" });
  }, [p.page, page.page, setP]);

  const options = useMemo(() => {
    const count = (key: FacetKey) => facetCounts(roses, index, filters, key);
    const classes = count("classes");
    const colours = count("colours");
    const brd = count("breeders");
    const countries = count("countries");
    return {
      classes: ROSE_CLASSES.map((c) => ({ value: c, label: c === "Shrub" ? "Shrub Roses" : `${c}s`, count: classes.get(c) ?? 0 })),
      colours: COLOUR_GROUPS.map((c) => ({ value: c, label: cap(c), count: colours.get(c) ?? 0 })),
      breeders: breeders
        .map((b) => ({ value: b.id, label: b.name, count: brd.get(b.id) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      countries: [...new Set(breeders.map((b) => b.country))]
        .map((c) => ({ value: c, label: regionNames.of(c) ?? c, count: countries.get(c) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filters` is rebuilt from `p` each render
  }, [roses, index, breeders, p]);

  const change = (patch: Partial<Filters>) => {
    const next: Record<string, unknown> = { page: null };
    for (const [field, value] of Object.entries(patch)) {
      const empty = value === null || value === false || value === "" || value === "all" || (Array.isArray(value) && value.length === 0);
      next[KEYS[field as keyof Filters]] = empty ? null : value;
    }
    setP(next, { history: "push" });
  };

  const labelOf = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...filters.classes.map((v) => ({ key: `c-${v}`, label: labelOf(options.classes, v), clear: () => change({ classes: filters.classes.filter((x) => x !== v) }) })),
    ...filters.colours.map((v) => ({ key: `o-${v}`, label: labelOf(options.colours, v), clear: () => change({ colours: filters.colours.filter((x) => x !== v) }) })),
    ...filters.breeders.map((v) => ({ key: `b-${v}`, label: labelOf(options.breeders, v), clear: () => change({ breeders: filters.breeders.filter((x) => x !== v) }) })),
    ...filters.countries.map((v) => ({ key: `n-${v}`, label: labelOf(options.countries, v), clear: () => change({ countries: filters.countries.filter((x) => x !== v) }) })),
    ...(filters.indian ? [{ key: "indian", label: "Indian-bred", clear: () => change({ indian: false }) }] : []),
    ...(filters.fragrant ? [{ key: "fragrant", label: "Fragrant", clear: () => change({ fragrant: false }) }] : []),
    ...(filters.isNew ? [{ key: "new", label: "New", clear: () => change({ isNew: false }) }] : []),
    ...(filters.awards ? [{ key: "awards", label: "Has awards", clear: () => change({ awards: false }) }] : []),
    ...(filters.hmf === "all" ? [] : [{ key: "hmf", label: filters.hmf === "matched" ? "On HelpMeFind" : "Not on HelpMeFind", clear: () => change({ hmf: "all" }) }]),
    ...(filters.yearFrom !== null || filters.yearTo !== null ? [{ key: "year", label: `Year ${filters.yearFrom ?? "…"}–${filters.yearTo ?? "…"}`, clear: () => change({ yearFrom: null, yearTo: null }) }] : []),
    ...(filters.priceMin !== null || filters.priceMax !== null ? [{ key: "price", label: `₹${filters.priceMin ?? "…"}–${filters.priceMax ?? "…"}`, clear: () => change({ priceMin: null, priceMax: null }) }] : []),
  ];
  const clearAll = () => setP({ ...Object.fromEntries(Object.values(KEYS).map((k) => [k, null])), page: null }, { history: "push" });

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const panel = <FilterPanel filters={filters} options={options} onChange={change} />;
  const list = p.view === "list";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <div className="sticky top-0 z-20 -mx-4 flex gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <input
          type="search"
          value={p.q}
          onChange={(e) => setP({ q: e.target.value || null, page: null }, { history: "replace" })}
          placeholder="Search names, breeders, colours"
          aria-label="Search roses"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-base"
        />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium lg:hidden"
        >
          Filters{chips.length > 0 && ` (${chips.length})`}
        </button>
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">{panel}</aside>

        <section aria-label="Results">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              {page.total} {page.total === 1 ? "rose" : "roses"}
            </p>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="sort">Sort by</label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setP({ sort: e.target.value as Sort, page: null })}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
              >
                {SORTS.filter((s) => s !== "relevance" || p.q.trim()).map((s) => (
                  <option key={s} value={s}>{SORT_LABELS[s]}</option>
                ))}
              </select>
              <fieldset aria-label="View" className="m-0 flex min-w-0 overflow-hidden rounded-lg border border-border p-0 text-sm">
                {(["grid", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={p.view === v}
                    onClick={() => setP({ view: v === "grid" ? null : v })}
                    className={`px-3 py-1.5 ${p.view === v ? "bg-accent text-accent-fg" : "bg-card"}`}
                  >
                    {cap(v)}
                  </button>
                ))}
              </fieldset>
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c.key}>
                  <button type="button" onClick={c.clear} aria-label={`Remove filter ${c.label}`} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">
                    {c.label} &times;
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={clearAll} className="px-2 py-1 text-sm text-muted underline">Clear all</button>
              </li>
            </ul>
          )}

          {page.total === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="font-serif text-xl">No roses match these filters.</p>
              <button type="button" onClick={clearAll} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
                Clear filters
              </button>
            </div>
          ) : (
            <ul className={`mt-4 grid gap-3 ${list ? "" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
              {page.items.map((r) => (
                <li key={r.id}><RoseCard rose={r} list={list} /></li>
              ))}
            </ul>
          )}

          {page.pages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page.page <= 1}
                onClick={() => { setP({ page: page.page - 1 === 1 ? null : page.page - 1 }); window.scrollTo({ top: 0 }); }}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm disabled:opacity-40"
              >
                &larr; Previous
              </button>
              <span className="text-sm text-muted">Page {page.page} of {page.pages}</span>
              <button
                type="button"
                disabled={page.page >= page.pages}
                onClick={() => { setP({ page: page.page + 1 }); window.scrollTo({ top: 0 }); }}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm disabled:opacity-40"
              >
                Next &rarr;
              </button>
            </nav>
          )}
        </section>
      </div>

      {sheetOpen && (
        <dialog open aria-modal="true" aria-label="Filters" className="fixed inset-0 z-30 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-foreground lg:hidden">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-black/50" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-serif text-lg font-semibold">Filters</h2>
              <button type="button" onClick={clearAll} className="text-sm text-muted underline">Clear all</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">{panel}</div>
            <div className="border-t border-border p-3">
              <button type="button" onClick={() => setSheetOpen(false)} className="w-full rounded-lg bg-accent py-3 text-base font-medium text-accent-fg">
                Show {page.total} {page.total === 1 ? "rose" : "roses"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
