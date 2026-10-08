import { describe, expect, it } from "vitest";
import { fullSizeUrl, isValidHmfId, parseNext, parsePhotos } from "@/lib/hmf";

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
  it("accepts only numeric ids", () => {
    expect(isValidHmfId("97659")).toBe(true);
    expect(isValidHmfId("97659/../x")).toBe(false);
    expect(isValidHmfId("")).toBe(false);
  });
});

import { parseDetails } from "@/lib/hmf-details";

describe("parseDetails", () => {
  const page = `<div class="row">
<div class="hdg">Bloom:</div>
<div class="grp"><div class="dsc">Light pink, peach shading. &nbsp;Strong fragrance. &nbsp;66 to 71 petals. &nbsp;</div></div>
</div><div class="row">
<div class="hdg">Class:</div>
<div class="grp"><div class="dsc">Grandiflora, Hybrid Tea. &nbsp;</div></div>
</div><div class="row">
<div class="hdg">Parentage:</div>
<div class="grp"><div class="dsc"><table id="parentage"><tr><th>seed:</th><td><a><span>Louis de Fun&#232;s</span></a></td></tr><tr><th>pollen:</th><td><span>A</span> &times; <span>B</span></td></tr></table></div></div>
</div>`;
  const d = parseDetails(page, "1", "2026-01-01T00:00:00Z");
  it("reads rows, colour and fragrance", () => {
    expect(d.colour).toBe("Light pink, peach shading.");
    expect(d.fragrance).toBe("Strong fragrance.");
    expect(parseDetails(page.replace("peach shading.", "peach shading. [Light apricot.]"), "1").fragrance).toBe("Strong fragrance.");
    expect(d.classes).toEqual(["Grandiflora", "Hybrid Tea"]);
    expect(d.parentage).toEqual({ seed: "Louis de Funès", pollen: "A × B" });
  });
  it("returns no rows for unrelated markup", () => {
    expect(parseDetails("<html></html>", "1").rows).toEqual({});
  });
});

describe("full-size helpers", () => {
  it("swaps the thumbnail path for the full-size one", () => {
    expect(fullSizeUrl("https://www.helpmefind.com/gardening/tn/897/459393.jpg")).toBe("https://www.helpmefind.com/gardening/fs/897/459393.jpg");
  });
});

it("parseNext copes with HTML-escaped ampersands in the paging link", () => {
  expect(parseNext('<a title="View older" href="/rose/pl.php?n=1&amp;tab=36&amp;qn=5&amp;qc=7">')).toBe("5.7");
});
