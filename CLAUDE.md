# KSG Visualizer

A searchable, filterable, mobile-friendly catalogue of the roses sold by **K.S.G. Son (KSG's Roses)**, a rose nursery in Bangalore. Each rose links to HelpMeFind (HMF) and other rose databases.

## Goals

1. **Extract** every rose from `KSG'S CATALOGUE 2024.pdf` (breeder, year, class, colour, description, price, awards) in a form that can be matched to HMF and other rose databases.
2. **Build a modern web platform** to browse the roses with rich filters and photos. It must be mobile-first.

## Status

KSG extraction is done: `python -m pipeline.run` (venv in `pipeline/.venv`) writes `data/raw/entries.json`, `data/roses.json`, `data/breeders.json` and `data/review/extraction-report.md` (1,262 entries; 1,261 roses after merging a duplicate). HMF matching is done: `pnpm hmf-search` (see `docs/matching.md`) searched every name, and the fuzzy matches were checked by hand against each plant page (844 exact, 354 decided by hand, 60 none, 3 fuzzy, every decision logged in `data/review/hmf-decisions.md`). Roses the matcher can't settle are listed in `data/review/hmf-matches.csv`; resolve them with `pnpm hmf-decide ROSE_ID <hmf url | --none | --undo>` in `web/` (writes `data/overrides.json`, see "Resolving what the matcher could not" in `docs/matching.md`). Never hard-code specific roses in the matcher; hand decisions are data.

## Core rules

- **The PDF is read-only.** Never modify it.
- **HMF data is stored locally (changed 2026-10-08):** the plant-page details (colour, fragrance, class, bloom, habit, parentage and so on) are snapshotted into `data/hmf/<hmfId>.json` by `pnpm hmf-data` in `web/`, so we never need to read them from HMF again. Refreshing is manual only (`--refresh`, `--id`, `--older-than`). Always link back to HMF.
- **Hosting (2026-10-08):** the site is a static export at `https://umangbhatt.in/ksgvisualizer/` (GitHub Pages, sub-path via `NEXT_PUBLIC_BASE_PATH`). There is no server code; never add API routes or live HMF requests. See `docs/web-platform.md`.
- **Photos (changed 2026-10-07):** HMF rate-limits live requests, so small HMF thumbnails are snapshotted into `web/public/photos/<hmfId>/` (with `index.json` holding credits and photo-page links) by `pnpm photos` in `web/`. Always show the photographer credit and link back to HMF. The KSG PDF images are still never stored. Photos are stored as small WebP files so the site stays under the GitHub Pages size limit; roses without a snapshot show a placeholder.
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
  web/                       # static Next.js site (output: export), deployed to GitHub Pages by .github/workflows/pages.yml
```

Pipeline steps are idempotent: each reads from and writes to `data/`, and none re-fetch from the network what is already cached.
