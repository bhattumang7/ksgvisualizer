import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sortRoses } from "@/lib/catalogue";
import { parseDetails } from "@/lib/hmf-details";
import { roses } from "./helpers";

describe("sortRoses", () => {
  const ids = (s: Parameters<typeof sortRoses>[1]) => sortRoses(roses, s).map((r) => r.id);
  it("sorts by year both ways with unknown years last", () => {
    const desc = sortRoses(roses, "year-desc");
    const asc = sortRoses(roses, "year-asc");
    expect(desc[0].year).toBe(2018);
    expect(asc[0].year).toBe(1977);
    expect(desc.at(-1)!.year).toBeNull();
    expect(asc.at(-1)!.year).toBeNull();
  });
  it("sorts by price with unknown prices last", () => {
    expect(sortRoses(roses, "price-asc").at(-1)!.price_inr).toBeNull();
    expect(sortRoses(roses, "price-desc")[0].price_inr).toBe(300);
  });
  it("sorts by breeder with unlisted breeders last, by name, and keeps relevance order", () => {
    expect(ids("breeder").at(-1)).toBe("clg-quick-silver");
    expect(ids("name")[0]).toBe("abbaye-de-cluny");
    expect(ids("relevance")).toEqual(roses.map((r) => r.id));
  });
  it("orders ties among two unknown values by name", () => {
    const blank = roses.filter((r) => r.year === null);
    const out = sortRoses(blank, "year-asc").map((r) => r.canonical_name);
    expect(out).toEqual([...out].sort((a, b) => a.localeCompare(b)));
  });
});

describe("parseDetails", () => {
  const row = (h: string, v: string) => `<div class="row"><div class="hdg">${h}:</div><div class="grp"><div class="dsc">${v}</div></div></div>`;

  it("parses a minimal page with nothing optional", () => {
    const d = parseDetails("<html></html>", "9", "2026-01-01T00:00:00Z");
    expect(d).toMatchObject({ hmfId: "9", rows: {}, colour: null, fragrance: null, classes: [], parentage: null, synonyms: [], favorites: null, rating: null });
  });

  it("parses every section", () => {
    const html =
      row("Bloom", "Light pink. Strong fragrance. 30 petals.") +
      row("Class", "Hybrid Tea, Grandiflora.") +
      row("Synonyms", "&bull; <a href='x'>Alpha &amp; Co</a><br>&bull; <a href='y'></a>") +
      row("Parentage", "<table><tr><th>seed:</th><td>A  <b>B</b></td></tr><tr><th>pollen:</th><td>C</td></tr></table>") +
      `<div class="row"><div class="hdg"></div><div class="grp"><div class="dsc">skipped</div></div></div>` +
      `<div class="row">malformed</div>` +
      '<span id="idFavCt">12</span><span id="idRatingAvg">GOOD &amp; fine</span>';
    const d = parseDetails(html, "1");
    expect(d.colour).toBe("Light pink.");
    expect(d.fragrance).toBe("Strong fragrance.");
    expect(d.classes).toEqual(["Hybrid Tea", "Grandiflora"]);
    expect(d.synonyms).toEqual(["Alpha & Co"]);
    expect(d.parentage).toEqual({ seed: "A B", pollen: "C" });
    expect(d.favorites).toBe(12);
    expect(d.rating).toBe("GOOD & fine");
  });

  it("returns null parentage parts that are missing, and decodes entities", () => {
    const html = row("Parentage", "<table><tr><th>seed:</th><td>Caf&eacute; &#233; &#39;x&#39; &quot;y&quot; &lt;&gt; &times; &nbsp;z<script>1</script></td></tr></table>") + row("Bloom", "Red.<br/>Blooms in clusters.");
    const d = parseDetails(html, "1");
    expect(d.parentage?.pollen).toBeNull();
    expect(d.parentage?.seed).toContain("é 'x' \"y\" <> ×");
    expect(d.colour).toBe("Red.");
  });
});

describe("hmf-store", () => {
  afterEach(() => {
    delete process.env.KSG_HMF_DIR;
  });
  it("reads snapshots from the default folder, ignoring bad ids and missing files", async () => {
    const { loadHmfDetails } = await import("@/lib/hmf-store");
    expect(loadHmfDetails("96406")?.hmfId).toBe("96406");
    expect(loadHmfDetails("../x")).toBeNull();
    expect(loadHmfDetails("1")).toBeNull();
  });
  it("honours KSG_HMF_DIR", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hmf-"));
    fs.writeFileSync(path.join(dir, "7.json"), JSON.stringify({ hmfId: "7" }));
    process.env.KSG_HMF_DIR = dir;
    const { loadHmfDetails } = await import("@/lib/hmf-store");
    expect(loadHmfDetails("7")).toEqual({ hmfId: "7" });
  });
});

describe("loadDataset", () => {
  afterEach(() => {
    delete process.env.KSG_DATA_DIR;
    vi.resetModules();
  });
  const write = (rosesJson: unknown[], breedersJson: unknown[]) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ksg-"));
    fs.writeFileSync(path.join(dir, "roses.json"), JSON.stringify(rosesJson));
    fs.writeFileSync(path.join(dir, "breeders.json"), JSON.stringify(breedersJson));
    process.env.KSG_DATA_DIR = dir;
  };
  const rose = (id: string, breeder_id: string | null) => ({ ...roses[0], id, breeder_id, photos: undefined, breeder_name: undefined });

  it("loads the sample set once and caches it", async () => {
    const { loadDataset } = await import("@/lib/data");
    const a = loadDataset();
    expect(a.roses).toHaveLength(roses.length);
    expect(loadDataset()).toBe(a);
  });
  it("rejects duplicate ids", async () => {
    write([rose("a", null), rose("a", null)], []);
    const { loadDataset } = await import("@/lib/data");
    expect(() => loadDataset()).toThrow("Duplicate rose id: a");
  });
  it("rejects unknown breeders", async () => {
    write([rose("a", "ghost")], []);
    const { loadDataset } = await import("@/lib/data");
    expect(() => loadDataset()).toThrow("unknown breeder ghost");
  });
  it("accepts a rose with a known breeder", async () => {
    write([rose("a", "b1")], [{ id: "b1", ksg_name: "B", name: "B", country: "FR", indian: false }]);
    const { loadDataset } = await import("@/lib/data");
    expect(loadDataset().roses).toHaveLength(1);
  });
});
