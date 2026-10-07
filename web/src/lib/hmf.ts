/**
 * Live HelpMeFind photo lookup. Nothing here is written to disk: results live in
 * a small in-memory cache, requests to HMF are spaced out, and visitors are rate-limited.
 */

import { HMF_ORIGIN as HMF, hmfFetch } from "./hmf-client.ts";

const MIN_GAP_MS = 2500;
const OK_TTL_MS = 10 * 60_000;
const EMPTY_TTL_MS = 60_000;
const MAX_CACHE = 500;

export interface HmfPhoto {
  src: string;
  width: number;
  height: number;
  pageUrl: string;
  credit: string | null;
  creditUrl: string | null;
}

export interface HmfPhotos {
  hmfUrl: string;
  photos: HmfPhoto[];
  /** Opaque cursor for the next (older) page of photos, or null on the last page. */
  next: string | null;
  /** "unavailable" means HMF could not be reached or refused; the UI falls back to a link. */
  status: "ok" | "empty" | "unavailable";
}

/** Numeric ids use pl.php; listing codes like "2.87704" (roses matched through an l.php link) use l.php, which serves the same page and tabs. */
export const hmfPlantUrl = (id: string) => (id.includes(".") ? `${HMF}/gardening/l.php?l=${id}` : `${HMF}/rose/pl.php?n=${id}`);
export const isValidHmfId = (id: string) => /^(2\.)?\d{1,8}$/.test(id);
/** Key of a rose's local snapshots: the numeric plant id, else the listing code ("2.87704") from its l.php link. */
export const hmfKey = (h: { id: string | null; url: string | null }): string | null =>
  h.id ?? /[?&]l=(2\.\d+)/.exec(h.url ?? "")?.[1] ?? null;
/** A cursor is "<qn>.<qc>", the two numbers HMF puts in its own paging links. */
export const isValidCursor = (c: string) => /^\d{1,3}\.\d{1,3}$/.test(c);

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

/** Width and height from a JPEG's first start-of-frame marker, or null if it isn't a readable JPEG. */
export function jpegSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] };
    i += 2 + ((buf[i + 2] << 8) | buf[i + 3]);
  }
  return null;
}

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastRequest = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Runs fn one at a time, at least MIN_GAP_MS after the previous HMF request. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequest + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function fetchPhotos(id: string, cursor: string | null): Promise<HmfPhotos> {
  const hmfUrl = hmfPlantUrl(id);
  const [qn, qc] = cursor ? cursor.split(".") : [];
  const paging = cursor ? `&qn=${qn}&qc=${qc}` : "";
  try {
    const res = await throttled(() =>
      hmfFetch(`${hmfUrl}&tab=36${paging}`, { referer: hmfUrl, signal: AbortSignal.timeout(8000), cache: "no-store" }),
    );
    if (!res.ok) return { hmfUrl, photos: [], next: null, status: "unavailable" };
    const html = await res.text();
    const photos = parsePhotos(html);
    return { hmfUrl, photos, next: photos.length ? parseNext(html) : null, status: photos.length ? "ok" : "empty" };
  } catch {
    return { hmfUrl, photos: [], next: null, status: "unavailable" };
  }
}

const cache = new Map<string, { at: number; value: HmfPhotos }>();
const inflight = new Map<string, Promise<HmfPhotos>>();

export async function getPhotos(id: string, cursor: string | null = null): Promise<HmfPhotos> {
  const key = `${id}:${cursor ?? ""}`;
  const hit = cache.get(key);
  if (hit) {
    const ttl = hit.value.status === "ok" ? OK_TTL_MS : EMPTY_TTL_MS;
    if (Date.now() - hit.at < ttl) return hit.value;
    cache.delete(key);
  }
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchPhotos(id, cursor)
      .then((value) => {
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
        cache.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

const hits = new Map<string, number[]>();

/** Sliding-window limit per client key: 30 requests a minute. */
export function allowRequest(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 30) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return true;
}
