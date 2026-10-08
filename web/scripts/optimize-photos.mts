/**
 * Converts the JPEG photo snapshots in web/public/photos/<hmfId>/ to small WebP files, in place:
 *
 *   pnpm photos:optimize
 *
 * Each N.jpg becomes N.webp, index.json is updated (file name and the new width/height) and the JPEG is
 * deleted. Safe to re-run; folders that are already converted are skipped. New downloads made by
 * `pnpm photos` are converted as they arrive, so this is only needed for older snapshots.
 */
import fs from "node:fs";
import path from "node:path";
import { toWebp } from "./webp.mts";

const ROOT = path.join(import.meta.dirname, "..", "public", "photos");
let before = 0;
let after = 0;
let folders = 0;

for (const id of fs.readdirSync(ROOT)) {
  const dir = path.join(ROOT, id);
  const manifest = path.join(dir, "index.json");
  if (!fs.existsSync(manifest)) continue;
  const m = JSON.parse(fs.readFileSync(manifest, "utf8")) as { photos: { file: string; width: number; height: number }[] };
  if (m.photos.every((p) => p.file.endsWith(".webp"))) continue;
  for (const p of m.photos) {
    if (p.file.endsWith(".webp")) continue;
    const src = path.join(dir, p.file);
    const input = fs.readFileSync(src);
    const out = await toWebp(input);
    const file = p.file.replace(/\.jpe?g$/i, ".webp");
    fs.writeFileSync(path.join(dir, file), out.data);
    fs.rmSync(src);
    before += input.length;
    after += out.data.length;
    Object.assign(p, { file, width: out.width, height: out.height });
  }
  // Drop any JPEG that no manifest entry points to (left over from an interrupted fetch).
  for (const f of fs.readdirSync(dir)) if (/\.jpe?g$/i.test(f)) fs.rmSync(path.join(dir, f));
  fs.writeFileSync(manifest, JSON.stringify(m, null, 2) + "\n");
  folders++;
}
console.log(`${folders} folders converted: ${(before / 1e6).toFixed(0)} MB -> ${(after / 1e6).toFixed(0)} MB`);
