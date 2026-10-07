/**
 * Parser for the HelpMeFind plant "Description" page. Pure functions only, so it can be used by
 * the snapshot script and the tests alike. The page is a list of `<div class="row">` blocks, each
 * with a heading (`hdg`) and a value (`dsc`).
 */

import { hmfPlantUrl } from "./hmf.ts";

export interface HmfDetails {
  hmfId: string;
  sourceUrl: string;
  fetchedAt: string;
  /** Every labelled row of the page as plain text, e.g. { Bloom: "Light pink... Strong fragrance." }. */
  rows: Record<string, string>;
  /** Bloom colour sentence(s), up to the first "fragrance"/petal sentence. */
  colour: string | null;
  /** The fragrance sentence, e.g. "Strong fragrance.". */
  fragrance: string | null;
  classes: string[];
  parentage: { seed: string | null; pollen: string | null } | null;
  synonyms: string[];
  /** Number of favourite votes and the average rating word, when present. */
  favorites: number | null;
  rating: string | null;
}

const decode = (s: string) =>
  s
    .replaceAll("&nbsp;", " ")
    .replaceAll(/&#0?39;|&#039;|&apos;/g, "'")
    .replaceAll(/&#(\d+);?/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&times;", "×")
    .replaceAll("&bull;", "•")
    .replaceAll("&amp;", "&");

function text(html: string): string {
  return decode(
    html
      .replaceAll(/<br\s*\/?>/gi, "\n")
      .replaceAll(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replaceAll(/<[^<>]+>/g, ""),
  )
    .replaceAll(/[ \t]+/g, " ")
    .replaceAll(/ ?\n ?/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseDetails(html: string, hmfId: string, fetchedAt = new Date().toISOString()): HmfDetails {
  const rows: Record<string, string> = {};
  const rowHtml: Record<string, string> = {};
  for (const part of html.split(/<div class="row">/i).slice(1)) {
    const m = /<div class="hdg">([\s\S]*?)<\/div>\s*<div class="grp"><div class="dsc">([\s\S]*)/i.exec(part);
    if (!m) continue;
    const heading = text(m[1]).replace(/:$/, "");
    if (!heading) continue;
    // The value runs to the end of this row; the next row's split already cut the rest off.
    rowHtml[heading] = m[2];
    rows[heading] = text(m[2]);
  }

  const bloom = rows.Bloom ?? "";
  const sentences = bloom.split(/(?<=\.\]?)\s+/);
  const fragrance = sentences.find((s) => /fragrance/i.test(s)) ?? null;
  const colourParts: string[] = [];
  for (const s of sentences) {
    if (/fragrance|petals|diameter|bloom form|blooms in/i.test(s)) break;
    colourParts.push(s);
  }

  let parentage: HmfDetails["parentage"] = null;
  const par = rowHtml.Parentage;
  if (par) {
    const grab = (label: string) => {
      const m = new RegExp(String.raw`<th>${label}:</th><td>([\s\S]*?)</td>`, "i").exec(par);
      return m ? text(m[1]).replaceAll(/\s+/g, " ") : null;
    };
    parentage = { seed: grab("seed"), pollen: grab("pollen") };
  }

  const syn = rowHtml.Synonyms;
  const synonyms = syn
    ? [...syn.matchAll(/&bull;\s*<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => text(m[1])).filter(Boolean)
    : [];

  const fav = /id="idFavCt"[^>]*>(\d+)</i.exec(html)?.[1];
  const rating = /id="idRatingAvg"[^>]*>([^<]+)</i.exec(html)?.[1];

  return {
    hmfId,
    sourceUrl: hmfPlantUrl(hmfId),
    fetchedAt,
    rows,
    colour: colourParts.join(" ").trim() || null,
    fragrance,
    classes: rows.Class ? rows.Class.replace(/\.$/, "").split(/,\s*/).filter(Boolean) : [],
    parentage,
    synonyms,
    favorites: fav ? Number(fav) : null,
    rating: rating ? decode(rating).trim() : null,
  };
}
