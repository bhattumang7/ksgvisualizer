# Matching to HelpMeFind and other databases

Matching key: **name + breeder + year (+ class)**. Name alone is not enough, because HMF has many same-named roses.

## Breeder normalization

`data/breeders.json` is hand-curated. It maps the catalogue's short breeder names to canonical names, HMF breeder names and the country:

- `Kordes` → W. Kordes' Söhne (DE)
- `Meilland` → Meilland International (FR)
- `Tantau` → Rosen Tantau (DE)
- `Fryer` → Fryer's Roses (UK)
- `Cocker` → Cocker & Sons (UK)
- `McGredy` → Sam McGredy (NZ/UK)
- `Carruth` → Tom Carruth (US)
- `Barni` → Rose Barni (IT)
- `Viraraghavan` / `M.S. Viraraghavan` → M.S. Viraraghavan (IN)
- Also Shastri, Ghosh, Kasturi Rangan/KSG and IARI (all IN). Many Indian cultivars are missing from HMF or spelled differently there.

## HelpMeFind

HelpMeFind (helpmefind.com/roses) has **no public API**.

- Look up by name search, then confirm the match with breeder and year. Matching stores the HMF plant ID (`l.php?l=<id>`) and the URL; the plant-page details are snapshotted separately into `data/hmf/<id>.json` by `pnpm hmf-data`.
- Rate-limit lookups (≥ 2–3 s apart) and respect robots.txt and the HMF terms of use. Any HTTP cache in `cache/` is a temporary aid for the matching run. It is gitignored, never shipped, and can be deleted.
- Record a `match_confidence` (exact / fuzzy / manual / none). Put every match that isn't exact into `data/review/*.csv` for a person to confirm.
- Synonyms and trade names may be used *during matching*, because KSG often uses names that differ from HMF's main name. Don't store them as content.

## Secondary sources

Breeder sites (kordes-rosen.com, meilland.com, tantau.com, etc.), the American Rose Society / Modern Roses database, Wikipedia/Wikidata, and Indian rose society sources for Indian cultivars. Store only the URL or ID for each one.
