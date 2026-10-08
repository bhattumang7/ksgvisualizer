import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { joinBreeders } from "@/lib/catalogue";
import { BreederSchema, RoseSchema } from "@/lib/schema";

const dir = path.join(__dirname, "..", "..", "data", "sample");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

export const breeders = z.array(BreederSchema).parse(read("breeders.json"));
export const roses = joinBreeders(z.array(RoseSchema).parse(read("roses.json")), breeders);

export const photo = (n: number, credit: string | null = "Ann") => ({
  src: `/photos/1/${n}.webp`, width: 72, height: 96, pageUrl: `https://hmf.test/p${n}`, credit,
});
