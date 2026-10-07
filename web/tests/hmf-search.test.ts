import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { breederTerms, matchRose } from "../src/lib/hmf-match";
import { hasMorePages, hmfSearchUrl, isSearchPage, parseSearchRows } from "../src/lib/hmf-search";

const html = fs.readFileSync(path.join(__dirname, "fixtures", "hmf-search-earth-angel.html"), "utf8");

describe("hmf search page", () => {
  it("builds the name-search url", () => {
    expect(hmfSearchUrl("Bull's Eye")).toBe("https://www.helpmefind.com/rose/plants.php?searchNm=Bull%27s+Eye&searchNmTyp=5&rid=2558&tab=1&sbSearch=SEARCH");
  });

  it("parses one row per name, with the breeder and year in the snippet", () => {
    const rows = parseSearchRows(html);
    expect(rows.map((r) => [r.title, r.url])).toEqual([
      ["Earth Angel", "https://www.helpmefind.com/rose/l.php?l=2.69538.4"],
      ["Parfuma Earth Angel", "https://www.helpmefind.com/rose/l.php?l=2.69538.8"],
    ]);
    expect(rows[0].snippet).toMatch(/^Floribunda\./);
    expect(rows[0].snippet).toContain("Tim Hermann Kordes (2003)");
    expect(rows[0].snippet).not.toMatch(/&nbsp;|<\w/);
  });

  it("builds the looser contains-search url and spots a paged list", () => {
    expect(hmfSearchUrl("Monaco", "contains")).toContain("searchNmTyp=1");
    expect(hasMorePages("&laquo; BACK &nbsp; | &nbsp; PAGE &nbsp;1 &nbsp;2 &nbsp;3")).toBe(true);
    expect(hasMorePages(html)).toBe(false);
  });

  it("returns nothing for a page without rows, and tells a search page apart from other pages", () => {
    expect(parseSearchRows("<html></html>")).toEqual([]);
    expect(isSearchPage('<form name="searchFrm">')).toBe(true);
    expect(isSearchPage("<html>blocked</html>")).toBe(false);
  });

  it("matches Earth Angel (KSG: Kor, 2015) to the one plant behind both rows", () => {
    const m = matchRose({ name: "EARTH ANGEL", year: 2015, cls: "Floribunda", breeders: breederTerms("Kor", "W. Kordes' Söhne") }, parseSearchRows(html));
    expect(m).toMatchObject({ match_confidence: "exact", hmf_title: "Earth Angel", url: "https://www.helpmefind.com/gardening/l.php?l=2.69538" });
    expect(m.candidates).toHaveLength(1);
  });
});
