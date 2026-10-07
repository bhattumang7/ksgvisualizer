import { describe, expect, it } from "vitest";
import { breederTerms, matchRose, nameVariants, normalizeName, parseHmfUrl, similarity, titleName, type RoseQuery } from "../src/lib/hmf-match";

const q = (over: Partial<RoseQuery>): RoseQuery => ({ name: "Earth Angel", year: 2015, breeders: breederTerms("Kor", "W. Kordes' Söhne"), cls: "Floribunda", ...over });

describe("parseHmfUrl", () => {
  it("accepts both plant-page forms and canonicalises them", () => {
    expect(parseHmfUrl("https://www.helpmefind.com/rose/pl.php?n=97659&tab=36")).toEqual({
      key: "n:97659",
      id: "97659",
      url: "https://www.helpmefind.com/rose/pl.php?n=97659",
    });
    expect(parseHmfUrl("https://www.helpmefind.com/gardening/l.php?l=2.65539.2")).toEqual({
      key: "l:2.65539",
      id: null,
      url: "https://www.helpmefind.com/gardening/l.php?l=2.65539",
    });
    expect(parseHmfUrl("https://www.helpmefind.com/rose/l.php?l=2.69538")?.id).toBeNull();
  });

  it("rejects photo, breeder, other-site and malformed urls", () => {
    expect(parseHmfUrl("https://www.helpmefind.com/gardening/l.php?l=21.123456")).toBeNull();
    expect(parseHmfUrl("https://www.helpmefind.com/gardening/l.php?l=99.4")).toBeNull();
    expect(parseHmfUrl("https://www.helpmefind.com/rose/pl.php?n=abc")).toBeNull();
    expect(parseHmfUrl("https://example.com/rose/pl.php?n=1")).toBeNull();
    expect(parseHmfUrl("not a url")).toBeNull();
  });

  it("unwraps a Google redirect", () => {
    const u = "https://www.google.com/url?q=" + encodeURIComponent("https://www.helpmefind.com/rose/pl.php?n=18083") + "&sa=U";
    expect(parseHmfUrl(u)?.id).toBe("18083");
  });
});

describe("names", () => {
  it("normalises accents, quotes and ampersands", () => {
    expect(normalizeName("Princesse d’Été & Co®")).toBe("princesse dete and co");
  });
  it("pulls the rose name out of an HMF title", () => {
    expect(titleName("'Earth Angel' Floribunda Rose - HelpMeFind")).toBe("earth angel");
    expect(titleName("Rose Gaujard Hybrid Tea | HelpMeFind")).toBe("gaujard");
    expect(titleName("Princesse de Monaco ® (hybrid tea, Meilland, 1971/81)")).toBe("princesse de monaco");
  });
  it("scores near-identical names high and different ones low", () => {
    expect(similarity("princess de monaco", "princesse de monaco")).toBeGreaterThan(0.95);
    expect(similarity("earth angel", "black baccara")).toBeLessThan(0.6);
  });
});

describe("matchRose", () => {
  const earth = [
    { url: "https://www.helpmefind.com/gardening/l.php?l=21.5", title: "Earth Angel photo - HelpMeFind", snippet: "" },
    {
      url: "https://www.helpmefind.com/rose/pl.php?n=97659",
      title: "'Earth Angel' Floribunda Rose - HelpMeFind",
      snippet: "Floribunda. Bred by Tim Hermann Kordes (Germany, 2003). Introduced in United States by Kordes in 2015.",
    },
  ];

  it("is exact when the name matches and the breeder or year is confirmed", () => {
    const m = matchRose(q({}), earth);
    expect(m).toMatchObject({ id: "97659", match_confidence: "exact", url: "https://www.helpmefind.com/rose/pl.php?n=97659" });
    expect(m.evidence).toEqual(expect.arrayContaining(["breeder:kordes", "year:2015"]));
  });

  it("is fuzzy for a spelling variant, with the year off by one", () => {
    const m = matchRose(
      q({ name: "PRINCESS DE MONACO", year: 1982, breeders: breederTerms("Meilland", null), cls: "Hybrid Tea" }),
      [{ url: "https://www.helpmefind.com/rose/pl.php?n=18083", title: "'Princesse de Monaco' Hybrid Tea Rose - HelpMeFind", snippet: "Introduced in 1981 by Meilland." }],
    );
    expect(m).toMatchObject({ id: "18083", match_confidence: "fuzzy" });
  });

  it("is fuzzy when the name matches but nothing confirms the breeder or year", () => {
    const other = { url: "https://www.helpmefind.com/rose/pl.php?n=9", title: "'Black Baccara' Rose - HelpMeFind", snippet: "Hybrid Tea. Meilland 2000." };
    const m = matchRose(q({ year: null, breeders: [] }), [...earth, other]);
    expect(m.match_confidence).toBe("fuzzy");
  });

  it("is exact when the search yields a single plant and the name is equal, even with no breeder or year", () => {
    const m = matchRose(q({ year: null, breeders: [] }), earth);
    expect(m).toMatchObject({ id: "97659", match_confidence: "exact" });
    expect(m.evidence).toContain("sole-result");
  });

  it("keeps a sole result with a close but different name as fuzzy, and a contradicting sole result as none", () => {
    const close = [{ url: "https://www.helpmefind.com/rose/pl.php?n=18083", title: "Princesse de Monaco", snippet: "Hybrid Tea." }];
    expect(matchRose(q({ name: "Princess de Monaco", year: null, breeders: [] }), close).match_confidence).toBe("fuzzy");
    const other = [{ url: "https://www.helpmefind.com/rose/pl.php?n=5", title: "Earth Angel", snippet: "Treloar Roses (2017)." }];
    expect(matchRose(q({}), other).match_confidence).toBe("none");
  });

  it("is fuzzy when two same-named plants are equally plausible", () => {
    const two = ["1", "2"].map((n) => ({ url: `https://www.helpmefind.com/rose/pl.php?n=${n}`, title: "'Earth Angel' Rose - HelpMeFind", snippet: "Kordes 2015" }));
    expect(matchRose(q({}), two).match_confidence).toBe("fuzzy");
  });

  it("prefers the plant whose breeder matches among same-named roses", () => {
    const m = matchRose(q({ name: "Raven", year: null, breeders: ["kordes"] }), [
      { url: "https://www.helpmefind.com/rose/pl.php?n=1", title: "'Raven' Rose - HelpMeFind", snippet: "Bred by Someone Else" },
      { url: "https://www.helpmefind.com/rose/pl.php?n=2", title: "'Raven' Rose - HelpMeFind", snippet: "Bred by Kordes" },
    ]);
    expect(m).toMatchObject({ id: "2", match_confidence: "exact" });
  });

  it("is none for unrelated or empty results", () => {
    expect(matchRose(q({ name: "Ajatashatru Kasturi" }), earth).match_confidence).toBe("none");
    expect(matchRose(q({}), []).match_confidence).toBe("none");
  });

  it("keeps a url without an id for the l.php form", () => {
    const m = matchRose(q({}), [{ url: "https://www.helpmefind.com/gardening/l.php?l=2.69538.4", title: "Earth Angel Rose - HelpMeFind", snippet: "Kordes" }]);
    expect(m).toMatchObject({ id: null, url: "https://www.helpmefind.com/gardening/l.php?l=2.69538", match_confidence: "exact" });
  });

  it("treats a same-named rose by another breeder and year as not on HMF", () => {
    const treloar = [{ url: "https://www.helpmefind.com/rose/pl.php?n=5", title: "'Earth Angel' Rose", snippet: "Introduced in Australia by Treloar Roses in 2017 as 'Earth Angel'." }];
    const m = matchRose(q({}), treloar);
    expect(m).toMatchObject({ id: null, match_confidence: "none" });
    expect(m.candidates[0].conflict).toBe(true);
  });

  it("picks the right one of two same-named plants by year, even without a breeder", () => {
    const m = matchRose(q({ name: "Raven", year: 1990, breeders: [] }), [
      { url: "https://www.helpmefind.com/rose/pl.php?n=1", title: "'Raven' Rose", snippet: "Hybrid Tea. Introduced 2005." },
      { url: "https://www.helpmefind.com/rose/pl.php?n=2", title: "'Raven' Rose", snippet: "Floribunda. Introduced 1990." },
    ]);
    expect(m).toMatchObject({ id: "2", match_confidence: "exact" });
  });

  it("counts a synonym row of the same plant (l=2.69538.4 and .8) as one rose, not a tie", () => {
    const m = matchRose(q({}), [
      { url: "https://www.helpmefind.com/rose/l.php?l=2.69538.4", title: "Earth Angel", snippet: "Floribunda. Tim Hermann Kordes (2003)." },
      { url: "https://www.helpmefind.com/rose/l.php?l=2.69538.8", title: "Parfuma Earth Angel", snippet: "Floribunda. Tim Hermann Kordes (2003)." },
    ]);
    expect(m.candidates).toHaveLength(1);
    expect(m).toMatchObject({ url: "https://www.helpmefind.com/gardening/l.php?l=2.69538", match_confidence: "exact", hmf_title: "Earth Angel" });
  });

  it("matches a KSG entry that carries two names under either name", () => {
    expect(nameVariants("ROSE SULLIVAN (VIR WINE)").slice(0, 2)).toEqual(["sullivan", "vir wine"]);
    expect(nameVariants("SA GARDEN / TUIN").slice(0, 2)).toEqual(["sa garden", "tuin"]);
    expect(nameVariants("SOMASILA (SPICE TRAIL).")).toContain("spice trail");
    const m = matchRose(q({ name: "COFFEE COUNTRY (MERCARA)", year: null, breeders: ["kasturi"] }), [
      { url: "https://www.helpmefind.com/rose/l.php?l=2.111.4", title: "Mercara", snippet: "Hybrid Tea. Kasturi & Sriram (2012)." },
    ]);
    expect(m).toMatchObject({ match_confidence: "exact", hmf_title: "Mercara" });
  });
});
