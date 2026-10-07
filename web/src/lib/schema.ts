import { z } from "zod";

export const ROSE_CLASSES = ["Hybrid Tea", "Floribunda", "Miniature", "Climber", "Shrub", "Polyantha"] as const;
export const COLOUR_GROUPS = ["red", "pink", "orange", "yellow", "white", "mauve", "bicolour", "multicolour"] as const;

export const BreederSchema = z.object({
  id: z.string(),
  ksg_name: z.string(),
  name: z.string(),
  country: z.string().length(2),
  indian: z.boolean(),
});

export const RoseSchema = z.object({
  id: z.string(),
  ksg_name: z.string(),
  canonical_name: z.string(),
  is_new: z.boolean(),
  class: z.enum(ROSE_CLASSES),
  breeder_raw: z.string().nullable(),
  breeder_id: z.string().nullable(),
  year_raw: z.string().nullable(),
  year: z.number().int().nullable(),
  awards: z.array(z.object({ name: z.string(), year: z.number().int().nullable() })),
  colour_text: z.string(),
  colour_group: z.enum(COLOUR_GROUPS),
  fragrance: z.string().nullable(),
  description: z.string(),
  price_inr: z.number().int().nullable(),
  ksg_page: z.number().int(),
  hmf: z.object({
    id: z.string().nullable(),
    url: z.string().url().nullable(),
    match_confidence: z.enum(["exact", "fuzzy", "manual", "none"]),
  }),
  links: z.object({
    wikidata: z.string().nullable(),
    breeder_url: z.string().url().nullable(),
    ars: z.string().nullable(),
  }),
});

export type Rose = z.infer<typeof RoseSchema>;
export type Breeder = z.infer<typeof BreederSchema>;
