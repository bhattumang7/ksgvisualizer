# Web platform

## Stack

**Decided (2026-10-07):** Next.js, self-hosted on a VPS with Docker. Not yet scaffolded.

- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix)**, pages statically generated from `data/roses.json`. pnpm as package manager.
- About 1,200 roses is small enough to filter and search on the client. Use **MiniSearch** (field boosting, prefix match) for fuzzy search.
- Filter state in the URL via `nuqs`. **Pagination (decided 2026-10-07)**, with the page number in the URL. No infinite scroll or virtualisation.
- The only server piece is the stateless HMF photo route (see below). It rules out GitHub Pages and `output: 'export'`.
- **Deploy:** `output: 'standalone'` in a Docker image behind a reverse proxy (Caddy or nginx) that handles TLS. The photo route needs a per-IP rate limit and a small throttle towards HMF, both in memory.
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

## Live HMF photos

**Decision (2026-10-07, revised):** HMF throttles frequent live requests, so photos are snapshotted. `web/scripts/fetch-photos.mts` (`pnpm photos [--limit N] [--id HMF_ID] [--refresh]`) drives a real, visible Chromium (persistent profile in `cache/hmf-browser`; HMF 403s plain HTTP clients and headless browsers on photo pages) and downloads up to 12 full-size images per matched rose (the thumbnail path with `tn` swapped for `fs`, typically 600-900 px; the 72x96 thumbnail is only a fallback; `--headless` is available but likely blocked), 4-5.5 s apart, into `web/public/photos/<hmfId>/` plus an `index.json` with credits and HMF photo-page links. It skips roses already done, so it is resumable, and it stops at the first 403/429/5xx. The rose page serves the snapshot; roses without one fall back to the live route below. Credit and an HMF link are always shown. The earlier 'links only, never store photos' rule no longer applies to these thumbnails, and (2026-10-08) the 'links only' rule is gone for plant-page details too: see `data/hmf/` and `pnpm hmf-data`.

**Confirmed (2026-10-07):** with `web/hotlink-test.html` served from the custom domain, one HMF image (896x672) loaded in a plain `<img>` under the default referrer policy. The other policies were not reported. Only one image was tested.

- The browser can't read HMF pages directly (CORS). A thin server-side route (a Next.js route handler or edge function) takes an HMF plant ID, fetches that plant's photo listing, and returns the image URLs and photographer credits.
- The route **must not write anything to disk or a database**. Short in-memory/HTTP cache headers are the most it may keep.
- Images load straight from HMF's URLs. Always show the photographer credit and a link back to the HMF page.
- Risks to check early: HMF may block hotlinking (Referer checks), limit how often we can request pages, or change its page markup. When no photo is available, show a placeholder plus a "View on HelpMeFind" link.
