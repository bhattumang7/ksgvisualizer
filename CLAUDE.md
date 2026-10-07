# KSG Visualizer

A searchable, filterable, mobile-friendly catalogue of the roses sold by **K.S.G. Son (KSG's Roses)**, a rose nursery in Bangalore. Each rose links to HelpMeFind (HMF) and other rose databases.

## Goals

1. **Extract** every rose from `KSG'S CATALOGUE 2024.pdf` (breeder, year, class, colour, description, price, awards) in a form that can be matched to HMF and other rose databases.
2. **Build a modern web platform** to browse the roses with rich filters and photos. It must be mobile-first.

## Status

Planning only. **Nothing has been extracted yet.** Don't start extraction or scraping until the user asks.

## Core rules

- **The PDF is read-only.** Never modify it.
- **Links only:** for HMF and other sites, store only IDs and URLs. Never copy their descriptions, attributes or other content.
- **No photos are stored or re-hosted**, including the KSG PDF images. Photos are fetched live from HMF, with credit and a link back to HMF.
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
