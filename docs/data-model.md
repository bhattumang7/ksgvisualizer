# Data model (target)

`data/roses.json` holds one record per KSG entry:

```jsonc
{
  "id": "abbaye-de-cluny",
  "ksg_name": "ABBAYE DE CLUNY",
  "canonical_name": "Abbaye de Cluny",
  "is_new": false,
  "class": "Hybrid Tea",            // HT | Floribunda | Miniature | Climber | Shrub | Polyantha
  "breeder_raw": "Meilland",
  "breeder_id": "meilland",         // → data/breeders.json
  "year_raw": "'93", "year": 1993,
  "awards": [],
  "colour_text": "Orange apricot.",
  "colour_group": "orange",         // derived; used for filters
  "fragrance": null,                // derived from text, e.g. "fragrant", "spicy fragrance"
  "description": "Orange apricot. Huge flowers.",
  "price_inr": 100,
  "ksg_page": 30,
  "hmf": { "id": null, "url": null, "match_confidence": "none" },
  "links": { "wikidata": null, "breeder_url": null, "ars": null }   // URLs/IDs only
}
```

Every field except `hmf` and `links` comes from the KSG catalogue. There are no image fields, because photos are fetched live using `hmf.id`.

## Files

```
data/
  raw/            # direct extraction output (entries.json)
  breeders.json   # curated breeder map
  overrides.json  # manual corrections, applied last
  roses.json      # final: KSG data + external links/IDs
  review/         # CSVs of uncertain matches
```
