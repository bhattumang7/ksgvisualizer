import "server-only";
import fs from "node:fs";
import path from "node:path";
import { isValidHmfId } from "./hmf";
import type { HmfDetails } from "./hmf-details";

/** Details saved by scripts/fetch-hmf-data.mts, or null when this rose hasn't been snapshotted yet. */
export function loadHmfDetails(hmfId: string): HmfDetails | null {
  if (!isValidHmfId(hmfId)) return null;
  const dir = process.env.KSG_HMF_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "..", "data", "hmf");
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, `${hmfId}.json`), "utf8"));
  } catch {
    return null;
  }
}
