import { describe, expect, it } from "vitest";
import { allowRequest, isValidCursor, isValidHmfId, parseNext, parsePhotos } from "@/lib/hmf";

const html = `<table id="imgLst"><tr>
 <td width="50%" class="c1 o">
<div class="tn"><div class="imgTnDs"><a href="/gardening/l.php?l=21.459704" rel="nofollow noindex" class="imgEn" title=" x " ><img src="/gardening/tn/897/459704.jpg" border="0" alt="Earth Angel rose photo" width="92" height="96" /></a></div></div>
<div class="des">Rose photo  courtesy of <a href="/gardening/l.php?l=99.4903887" class="bld" >Amy &amp; Co</a></div></td>
 <td width="50%" class="c2 e">
<div class="tn"><div class="imgTnDs"><a href="/gardening/l.php?l=21.457761" rel="nofollow noindex" class="imgEn" ><img src="/gardening/tn/894/457761.jpg" border="0" alt="x" width="140" height="96" /></a></div></div>
</td></tr></table><img src="/imgs/hmfLogo.jpg" width="168" height="43">`;

describe("parsePhotos", () => {
  const photos = parsePhotos(html);
  it("finds thumbnails and ignores site chrome", () => {
    expect(photos).toHaveLength(2);
    expect(photos[0]).toMatchObject({
      src: "https://www.helpmefind.com/gardening/tn/897/459704.jpg",
      width: 92,
      height: 96,
      pageUrl: "https://www.helpmefind.com/gardening/l.php?l=21.459704",
    });
  });
  it("reads and decodes the credit, tolerating a missing one", () => {
    expect(photos[0].credit).toBe("Amy & Co");
    expect(photos[0].creditUrl).toBe("https://www.helpmefind.com/gardening/l.php?l=99.4903887");
    expect(photos[1].credit).toBeNull();
  });
  it("returns nothing for unrelated markup", () => {
    expect(parsePhotos("<html>nope</html>")).toEqual([]);
  });
});

describe("parseNext", () => {
  it("reads the paging numbers from the OLDER link", () => {
    const page = `<a href="/rose/pl.php?n=97659&tab=36&qn=1&qc=0" style="x" rel="nofollow noindex" title=" View older " >OLDER &raquo;</a>`;
    expect(parseNext(page)).toBe("1.0");
  });
  it("returns null on the last page", () => {
    expect(parseNext(`<span>&laquo; NEWER</span> | <span>OLDER &raquo;</span>`)).toBeNull();
  });
});

describe("guards", () => {
  it("accepts only well-formed cursors", () => {
    expect(isValidCursor("2.0")).toBe(true);
    expect(isValidCursor("2")).toBe(false);
    expect(isValidCursor("2.0&x=1")).toBe(false);
  });
  it("accepts only numeric ids", () => {
    expect(isValidHmfId("97659")).toBe(true);
    expect(isValidHmfId("97659/../x")).toBe(false);
    expect(isValidHmfId("")).toBe(false);
  });
  it("limits requests per client to 30 a minute", () => {
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) expect(allowRequest("a", now)).toBe(true);
    expect(allowRequest("a", now)).toBe(false);
    expect(allowRequest("b", now)).toBe(true);
    expect(allowRequest("a", now + 61_000)).toBe(true);
  });
});
