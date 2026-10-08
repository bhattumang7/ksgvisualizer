/** Helpers for HelpMeFind ids and photo-tab markup, used by the snapshot scripts (scripts/fetch-photos.mts) and by the site at build time. */

import { HMF_ORIGIN as HMF } from "./hmf-client.ts";

export interface HmfPhoto {
  src: string;
  width: number;
  height: number;
  pageUrl: string;
  credit: string | null;
  creditUrl: string | null;
}

/** Numeric ids use pl.php; listing codes like "2.87704" (roses matched through an l.php link) use l.php, which serves the same page and tabs. */
export const hmfPlantUrl = (id: string) => (id.includes(".") ? `${HMF}/gardening/l.php?l=${id}` : `${HMF}/rose/pl.php?n=${id}`);
export const isValidHmfId = (id: string) => /^(2\.)?\d{1,8}$/.test(id);
/** Key of a rose's local snapshots: the numeric plant id, else the listing code ("2.87704") from its l.php link. */
export const hmfKey = (h: { id: string | null; url: string | null }): string | null =>
  h.id ?? /[?&]l=(2\.\d+)/.exec(h.url ?? "")?.[1] ?? null;

const decode = (s: string) =>
  s.replaceAll("&amp;", "&").replaceAll(/&#0?39;|&apos;/g, "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">");

/** Pulls thumbnails and photographer credits out of the photos-tab markup. */
export function parsePhotos(html: string): HmfPhoto[] {
  const photos: HmfPhoto[] = [];
  const cells = html.split(/<td\b/i).slice(1);
  for (const cell of cells) {
    const thumb = /<a href="(\/gardening\/l\.php\?l=21\.\d+)"[^>]*class="imgEn"[^>]*>\s*<img src="(\/gardening\/tn\/\d+\/\d+\.jpg)"[^>]*?width="(\d+)" height="(\d+)"/i.exec(cell);
    if (!thumb) continue;
    const credit = /courtesy of\s*<a href="(\/gardening\/l\.php\?l=99\.\d+)"[^>]*>([^<]+)<\/a>/i.exec(cell);
    photos.push({
      src: HMF + thumb[2],
      width: Number(thumb[3]),
      height: Number(thumb[4]),
      pageUrl: HMF + thumb[1],
      credit: credit ? decode(credit[2].trim()) : null,
      creditUrl: credit ? HMF + credit[1] : null,
    });
  }
  return photos;
}

/** HMF serves the full-size image next to the thumbnail: same path, "fs" instead of "tn". */
export const fullSizeUrl = (thumbSrc: string) => thumbSrc.replace("/gardening/tn/", "/gardening/fs/");

/** Reads the "OLDER" link of the photo list and turns its paging numbers into a cursor. */
export function parseNext(html: string): string | null {
  for (const m of html.matchAll(/<a\s[^>]*>/gi)) {
    const tag = m[0];
    if (!/title="\s*View older\s*"/i.test(tag)) continue;
    const href = /href="([^"]*)"/i.exec(tag)?.[1] ?? "";
    const qn = /[?&;]qn=(\d+)/.exec(href)?.[1];
    const qc = /[?&;]qc=(\d+)/.exec(href)?.[1];
    if (qn !== undefined && qc !== undefined) return `${qn}.${qc}`;
  }
  return null;
}
