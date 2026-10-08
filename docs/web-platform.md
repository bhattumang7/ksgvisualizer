# Web platform

## Stack

**Decided (2026-10-08):** Next.js as a fully static export (`output: "export"`), hosted on GitHub Pages at `https://umangbhatt.in/<repo name>/`, like the other project sites on that domain. No server code at all.

- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix)**, pages statically generated from `data/roses.json`. pnpm as package manager.
- About 1,200 roses is small enough to filter and search on the client. Use **MiniSearch** (field boosting, prefix match) for fuzzy search.
- Filter state in the URL via `nuqs`. **Pagination (decided 2026-10-07)**, with the page number in the URL. No infinite scroll or virtualisation.
- **No server.** The old live HMF photo route (rate limiter, throttle, `/api/hmf/...`) was removed because HMF rate-limits live requests. All photos and plant details are snapshotted and served by the site itself.
- **Deploy:** `.github/workflows/pages.yml` runs the tests, builds with `NEXT_PUBLIC_BASE_PATH=/<repo name>` (sub-path hosting; `next.config.ts` turns it into `basePath`, `src/lib/base-path.ts` prefixes plain `<img>` URLs) and publishes `web/out`. In the repo settings, set Pages > Source to "GitHub Actions". Locally: `pnpm build && pnpm preview` serves `out/` on port 3000 at the root. Keep the published site under 1 GB (Pages limit).
- **Tests:** Vitest for data helpers, Playwright at 360, 414 and 1280 px widths.

## Features

- Grid and list views with image cards, lazy-loaded images and pagination. Changing a filter resets to page 1.
- **Filters** (from KSG data plus the breeder map): section/class (Hybrid Tea, Floribunda, Miniature, Climber, Shrub, Polyantha), colour group, breeder, breeder country, Indian-bred, year range, decade, fragrance, price range, new this season, has awards, and HMF match status.
- Full-text fuzzy search across names, breeders and descriptions.
- Sorting by name, year, price and breeder.
- Filter state stored in the URL, so views can be shared.
- Detail page/sheet: a live HMF photo gallery with credits, the KSG attributes, description and price, and links to HMF and other sources.
- Breeder pages that list every rose from that breeder.
- Mobile-first: bottom-sheet filters, a sticky search bar and swipeable galleries. Dark mode. Fast (Lighthouse ≥ 90). Accessible: keyboard navigation and alt text.
- Test at mobile widths (360–414 px) as well as desktop before calling UI work done.

## HMF photos

**Decision (2026-10-07, revised):** HMF throttles frequent live requests, so photos are snapshotted. `web/scripts/fetch-photos.mts` (`pnpm photos [--limit N] [--id HMF_ID] [--refresh]`) drives a real, visible Chromium (persistent profile in `cache/hmf-browser`; HMF 403s plain HTTP clients and headless browsers on photo pages) and downloads up to 12 full-size images per matched rose (the thumbnail path with `tn` swapped for `fs`, typically 600-900 px; the 72x96 thumbnail is only a fallback; `--headless` is available but likely blocked), 4-5.5 s apart, into `web/public/photos/<hmfId>/` plus an `index.json` with credits and HMF photo-page links. It skips roses already done, so it is resumable, and it stops at the first 403/429/5xx. The rose page serves the snapshot; roses without one show a placeholder. Credit and an HMF link are always shown. The earlier 'links only, never store photos' rule no longer applies to these thumbnails, and (2026-10-08) the 'links only' rule is gone for plant-page details too: see `data/hmf/` and `pnpm hmf-data`.

**Confirmed (2026-10-07):** with `web/hotlink-test.html` served from the custom domain, one HMF image (896x672) loaded in a plain `<img>` under the default referrer policy. The other policies were not reported. Only one image was tested.

- Photos are self-hosted (2026-10-08): `pnpm photos` re-encodes each download as a WebP (longest side 800 px, quality 74, via `scripts/webp.mts`) so the 7,000+ photos take about 280 MB instead of 1 GB. `pnpm photos:optimize` converts older JPEG snapshots in place. Always show the photographer credit and a link back to HMF; with no photo, show a placeholder plus a "View on HelpMeFind" link.
