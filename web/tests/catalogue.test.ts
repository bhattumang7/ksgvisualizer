import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS, applyFilters, buildSearch, facetCounts, joinBreeders, paginate, sortRoses, type Filters,
} from "@/lib/catalogue";
import { BreederSchema, RoseSchema } from "@/lib/schema";
import { z } from "zod";

const dir = path.join(__dirname, "..", "..", "data", "sample");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const roses = joinBreeders(z.array(RoseSchema).parse(read("roses.json")), z.array(BreederSchema).parse(read("breeders.json")));
const index = buildSearch(roses);
const run = (f: Partial<Filters>) => applyFilters(roses, index, { ...EMPTY_FILTERS, ...f });

describe("sample data", () => {
  it("passes the schema and has unique ids", () => {
    expect(new Set(roses.map((r) => r.id)).size).toBe(roses.length);
  });
});

describe("filters", () => {
  it("filters by section, colour and breeder together", () => {
    const hits = run({ classes: ["Hybrid Tea"], colours: ["white"], breeders: ["meilland"] });
    expect(hits.map((r) => r.id).sort()).toEqual(["alliance"]);
  });
  it("ORs values within one facet", () => {
    expect(run({ classes: ["Climber", "Polyantha"] }).every((r) => ["Climber", "Polyantha"].includes(r.class))).toBe(true);
  });
  it("has an empty combination", () => {
    expect(run({ classes: ["Climber"], colours: ["yellow"] })).toEqual([]);
  });
  it("filters Indian-bred, new, awards and HMF status", () => {
    expect(run({ indian: true }).every((r) => r.breeder_indian)).toBe(true);
    expect(run({ isNew: true }).map((r) => r.id)).toEqual(["abracadabra"]);
    expect(run({ awards: true }).map((r) => r.id).sort()).toEqual(["about-face", "starry-night"]);
    expect(run({ hmf: "matched" }).map((r) => r.id).sort()).toEqual(["earth-angel", "princess-charlene-de-monaco", "princess-de-monaco"]);
  });
  it("excludes roses with no year or price when a range is set", () => {
    expect(run({ yearFrom: 1900 }).some((r) => r.year === null)).toBe(false);
    expect(run({ priceMax: 1000 }).some((r) => r.price_inr === null)).toBe(false);
  });
});

describe("search", () => {
  it("matches prefixes and typos, ranked by relevance", () => {
    expect(run({ q: "earth" })[0].id).toBe("earth-angel");
    expect(run({ q: "winchster" }).map((r) => r.id)).toContain("winchester-cathedral");
  });
  it("searches breeder names", () => {
    expect(run({ q: "carruth" }).map((r) => r.id)).toContain("diamond-eyes");
  });
  it("combines with filters", () => {
    expect(run({ q: "monaco", classes: ["Floribunda"] })).toEqual([]);
  });
});

describe("facet counts", () => {
  it("ignores the facet's own selection but respects the others", () => {
    const counts = facetCounts(roses, index, { ...EMPTY_FILTERS, classes: ["Climber"], colours: ["pink"] }, "classes");
    expect(counts.get("Climber")).toBe(1);
    expect(counts.get("Hybrid Tea")).toBeGreaterThan(0);
    expect(counts.get("Shrub")).toBeUndefined();
  });
});

describe("sort and paginate", () => {
  it("puts missing values last in either direction", () => {
    expect(sortRoses(roses, "year-asc").at(-1)!.year).toBeNull();
    expect(sortRoses(roses, "price-desc").at(-1)!.price_inr).toBeNull();
    expect(sortRoses(roses, "price-asc")[0].price_inr).toBe(100);
  });
  it("clamps the page", () => {
    const p = paginate(roses, 99, 6);
    expect(p.page).toBe(p.pages);
    expect(paginate([], 1, 6)).toMatchObject({ pages: 1, total: 0, items: [] });
  });
});
