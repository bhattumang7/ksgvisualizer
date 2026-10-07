import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { BreederSchema, RoseSchema, type Breeder, type Rose } from "./schema";

export interface Dataset {
  roses: Rose[];
  breeders: Breeder[];
}

let cached: Dataset | null = null;

/** Directory holding roses.json and breeders.json. Defaults to the full catalogue in data/; tests point it at data/sample. */
function dataDir(): string {
  return process.env.KSG_DATA_DIR ?? path.join(process.cwd(), "..", "data");
}

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  // Only read while building the static pages, so keep the bundler from tracing the data directory.
  const raw = JSON.parse(fs.readFileSync(path.join(/* turbopackIgnore: true */ dataDir(), file), "utf8"));
  return schema.parse(raw);
}

export function loadDataset(): Dataset {
  if (!cached) {
    const roses = readJson("roses.json", z.array(RoseSchema));
    const breeders = readJson("breeders.json", z.array(BreederSchema));
    const ids = new Set(breeders.map((b) => b.id));
    const seen = new Set<string>();
    for (const r of roses) {
      if (seen.has(r.id)) throw new Error(`Duplicate rose id: ${r.id}`);
      seen.add(r.id);
      if (r.breeder_id && !ids.has(r.breeder_id)) {
        throw new Error(`Rose ${r.id} references unknown breeder ${r.breeder_id}`);
      }
    }
    cached = { roses, breeders };
  }
  return cached;
}
