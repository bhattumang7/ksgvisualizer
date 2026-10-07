import "server-only";
import fs from "node:fs";
import path from "node:path";
import { hmfKey, isValidHmfId } from "./hmf";
import type { CatalogueRose } from "./catalogue";

export interface StoredPhoto {
  /** Public URL of the snapshot image. */
  src: string;
  width: number;
  height: number;
  pageUrl: string;
  credit: string | null;
  creditUrl: string | null;
}

/** Photos saved by scripts/fetch-photos.ts, or null when this rose hasn't been snapshotted yet. */
export function loadStoredPhotos(hmfId: string): StoredPhoto[] | null {
  if (!isValidHmfId(hmfId)) return null;
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "photos", hmfId);
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
    return m.photos.map((p: Omit<StoredPhoto, "src"> & { file: string }) => ({
      src: `/photos/${hmfId}/${p.file}`,
      width: p.width,
      height: p.height,
      pageUrl: p.pageUrl,
      credit: p.credit,
      creditUrl: p.creditUrl,
    }));
  } catch {
    return null;
  }
}

/** Attaches the stored photos (without credit-page URLs we don't need) to each rose for listing cards. */
export function withCardPhotos(roses: CatalogueRose[]): CatalogueRose[] {
  return roses.map((r) => {
    const key = hmfKey(r.hmf);
    const stored = key ? loadStoredPhotos(key) : null;
    if (!stored?.length) return r;
    return { ...r, photos: stored.map(({ src, width, height, pageUrl, credit }) => ({ src, width, height, pageUrl, credit })) };
  });
}
