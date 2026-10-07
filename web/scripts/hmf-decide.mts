/**
 * Records a hand decision for a rose the matcher could not settle (see data/review/hmf-matches.csv), in
 * data/overrides.json, which the pipeline applies last and never overwrites.
 *
 *   pnpm hmf-decide ROSE_ID <hmf-url>    the rose is this HMF plant (match_confidence "manual")
 *   pnpm hmf-decide ROSE_ID --none       checked: the rose is not on HMF
 *   pnpm hmf-decide ROSE_ID --undo       remove the decision
 */
import fs from "node:fs";
import path from "node:path";
import { parseHmfUrl } from "../src/lib/hmf-match.ts";
import { DATA, ROOT, roses, score, writeJson } from "./match-common.mts";

const [id, arg] = process.argv.slice(2);
if (!id || !arg || !roses.some((r) => r.id === id)) {
  console.error("Usage: pnpm hmf-decide ROSE_ID <hmf-plant-url | --none | --undo>");
  process.exit(1);
}
const file = path.join(DATA, "overrides.json");
const overrides: Record<string, Record<string, unknown>> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8") || "{}") : {};

if (arg === "--undo") {
  if (overrides[id]) delete overrides[id].hmf;
  if (overrides[id] && !Object.keys(overrides[id]).length) delete overrides[id];
} else {
  let hmf = { id: null as string | null, url: null as string | null, match_confidence: "none" };
  if (arg !== "--none") {
    const p = parseHmfUrl(arg);
    if (!p) {
      console.error("Not an HMF plant page url (photo and breeder pages do not count).");
      process.exit(1);
    }
    hmf = { id: p.id, url: p.url, match_confidence: "manual" };
  }
  overrides[id] = { ...overrides[id], hmf };
}
writeJson(file, overrides);
console.log(`${id}: ${arg === "--undo" ? "decision removed" : arg === "--none" ? "marked not on HMF" : "linked"}. Run \`python -m pipeline.run\` to apply.`);
score(path.join(ROOT, "cache", "hmf-search"));
