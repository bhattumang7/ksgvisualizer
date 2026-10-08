import sharp from "sharp";

/** Longest side we keep. Photos show at most ~450px wide on screen, so 800 covers high-density phones. */
export const MAX_SIDE = 800;
const QUALITY = 74;

/** Re-encodes a downloaded photo as a small WebP (no EXIF/GPS) so the whole snapshot can be served as a static site. */
export async function toWebp(input: Uint8Array): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .rotate() // apply EXIF orientation before the metadata is dropped
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
