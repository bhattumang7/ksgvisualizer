import { describe, expect, it } from "vitest";
import { joinBreeders } from "@/lib/catalogue";
import { loadStoredPhotos, withCardPhotos } from "@/lib/photos";
import { RoseSchema } from "@/lib/schema";
import { z } from "zod";

const base = {
  id: "x", ksg_name: "X", canonical_name: "X", is_new: false, class: "Hybrid Tea", breeder_raw: null, breeder_id: null,
  year_raw: null, year: null, awards: [], colour_text: "", colour_group: "red", fragrance: null, description: "",
  price_inr: null, ksg_page: null, links: { wikidata: null, breeder_url: null, ars: null },
};
const make = (hmfId: string | null) =>
  joinBreeders(z.array(RoseSchema).parse([{ ...base, hmf: { id: hmfId, url: null, match_confidence: hmfId ? "manual" : "none" } }]), []);

describe("withCardPhotos", () => {
  it("attaches stored photos to a matched rose", () => {
    const [r] = withCardPhotos(make("96406"));
    expect(r.photos?.length).toBeGreaterThan(1);
    expect(r.photos?.[0].src).toBe("/photos/96406/1.jpg");
  });
  it("leaves unmatched and unsnapshotted roses alone", () => {
    expect(withCardPhotos(make(null))[0].photos).toBeUndefined();
    expect(withCardPhotos(make("1"))[0].photos).toBeUndefined();
    expect(loadStoredPhotos("../x")).toBeNull();
  });
});
