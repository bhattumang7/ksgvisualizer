/**
 * HelpMeFind's own name search (/rose/plants.php). Each result row is one name of one plant: a synonym gets
 * its own row, with the same plant number and a different last segment (l=2.69538.4 and l=2.69538.8).
 * The description ends with "Breeder (year)", which is what the matcher uses. Pure parsing, no network.
 */

import { HMF_ORIGIN } from "./hmf-client.ts";
import type { SearchResult } from "./hmf-match.ts";

/** "best" is HMF's own best-match search; "contains" finds the text anywhere in a name (used for the rare-word fallback). */
export const hmfSearchUrl = (name: string, mode: "best" | "contains" = "best") =>
  `${HMF_ORIGIN}/rose/plants.php?${new URLSearchParams({ searchNm: name, searchNmTyp: mode === "best" ? "5" : "1", rid: "2558", tab: "1", sbSearch: "SEARCH" })}`;

/** A long list continues on further pages ("PAGE 1 2 3 ..."); only the first page is read. */
export const hasMorePages = (html: string) => /PAGE(?:&nbsp;|\s)+1(?:&nbsp;|\s)+2\b/.test(html);

const decode = (s: string) =>
  s
    .replaceAll("&nbsp;", " ")
    .replaceAll("&reg;", "®")
    .replaceAll("&amp;", "&")
    .replaceAll(/&#0?39;|&apos;/g, "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));

const text = (html: string) => decode(html.replaceAll(/<br\s*\/?>/gi, " ").replaceAll(/<[^>]+>/g, " ")).replaceAll(/\s+/g, " ").trim();

/** True when the page is a search page at all, so an empty result list can be told apart from changed markup. */
export const isSearchPage = (html: string) => html.includes('name="searchFrm"');

export function parseSearchRows(html: string): SearchResult[] {
  const out: SearchResult[] = [];
  for (const block of html.split(/<div class="bg[^"]*\bplant">/).slice(1)) {
    const a = /<a href="(\/(?:rose|gardening)\/l\.php\?l=2\.[\d.]+)"[^>]*class="bld"[^>]*>([^<]+)<\/a>/.exec(block);
    if (!a) continue;
    const t = /<div class="t"><p>([\s\S]*?)<\/p>/.exec(block);
    out.push({ url: HMF_ORIGIN + a[1], title: decode(a[2]).trim(), snippet: text(t?.[1] ?? "") });
  }
  return out;
}
