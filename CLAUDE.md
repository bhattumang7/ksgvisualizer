# KSG Visualizer

A searchable, filterable, mobile-friendly catalogue of the roses sold by **K.S.G. Son (KSG's Roses)**, a rose nursery in Bangalore. Each rose links to HelpMeFind (HMF) and other rose databases.

## Goals

1. **Extract** every rose from `KSG'S CATALOGUE 2024.pdf` (breeder, year, class, colour, description, price, awards) in a form that can be matched to HMF and other rose databases.
2. **Build a modern web platform** to browse the roses with rich filters and photos. It must be mobile-first.

## Status

KSG extraction is done: `python -m pipeline.run` (venv in `pipeline/.venv`) writes `data/raw/entries.json`, `data/roses.json`, `data/breeders.json` and `data/review/extraction-report.md` (1,262 entries). HMF matching has not started. Don't start matching or scraping until the user asks.

## Core rules

- **The PDF is read-only.** Never modify it.
- **HMF data is stored locally (changed 2026-10-08):** the plant-page details (colour, fragrance, class, bloom, habit, parentage and so on) are snapshotted into `data/hmf/<hmfId>.json` by `pnpm hmf-data` in `web/`, so we never need to read them from HMF again. Refreshing is manual only (`--refresh`, `--id`, `--older-than`). Always link back to HMF.
- **Photos (changed 2026-10-07):** HMF rate-limits live requests, so small HMF thumbnails are snapshotted into `web/public/photos/<hmfId>/` (with `index.json` holding credits and photo-page links) by `pnpm photos` in `web/`. Always show the photographer credit and link back to HMF. The KSG PDF images are still never stored. Roses without a snapshot fall back to the live route.
- Be polite when scraping: rate-limit requests, respect robots.txt, and keep any cache temporary and gitignored.
- Keep manual corrections in `data/overrides.json`, apply them last, and never overwrite them.

## Detailed docs (read when working on that area)

- `docs/pdf-extraction.md`: PDF page layout, entry format, parsing gotchas, expected counts.
- `docs/matching.md`: the breeder map, the HMF lookup process, match confidence, secondary sources.
- `docs/data-model.md`: the `roses.json` schema and the files in `data/`.
- `docs/web-platform.md`: proposed stack, features and filters, the live HMF photo route and its risks.

## Layout

```
ksgvisualizer/
  KSG'S CATALOGUE 2024.pdf   # source, read-only
  docs/                      # detailed notes (above)
  pipeline/                  # Python 3.11+: extract → normalize → match → export (venv in pipeline/.venv)
  data/                      # extraction output, breeder map, overrides, final roses.json
  cache/                     # temporary HTTP cache for matching runs (gitignored)
  web/                       # web app, including the live HMF photo route
```

Pipeline steps are idempotent: each reads from and writes to `data/`, and none re-fetch from the network what is already cached.
