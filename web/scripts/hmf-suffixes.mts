import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "..");

/**
 * A plant that HMF lists only under a synonym row ("l=2.21669.3") shows the search page when opened without that suffix.
 * The suffixes seen in the cached name searches are tried in turn.
 */
const SEARCH_CACHES = ["hmf-search", "hmf-variants"].map((d) => path.join(ROOT, "cache", d));
export function suffixes(id: string): string[] {
  if (!id.startsWith("2.")) return [];
  const found = new Set<string>();
  const re = new RegExp(`l=${id.replace(".", "\\.")}(\\.\\d+)`, "g");
  for (const dir of SEARCH_CACHES) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(re)) found.add(m[1]);
  }
  return [...found];
}
