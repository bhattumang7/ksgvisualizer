# Web platform

## Stack (proposed, not final; confirm with the user before scaffolding)

- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**, built as a static site from `data/roses.json`.
- About 1,200 roses is small enough to filter and search on the client. Use Fuse.js or MiniSearch for fuzzy search.
- The only server piece is the stateless HMF photo route (see below).
- Deploy to Vercel, Netlify or GitHub Pages.

## Features

- Grid and list views with image cards, lazy-loaded images and infinite scroll.
- **Filters** (from KSG data plus the breeder map): class, colour group, breeder, breeder country, Indian-bred, year range, decade, fragrance, price range, new this season, has awards, and HMF match status.
- Full-text fuzzy search across names, breeders and descriptions.
- Sorting by name, year, price and breeder.
- Filter state stored in the URL, so views can be shared.
- Detail page/sheet: a live HMF photo gallery with credits, the KSG attributes, description and price, and links to HMF and other sources.
- Breeder pages that list every rose from that breeder.
- Mobile-first: bottom-sheet filters, a sticky search bar and swipeable galleries. Dark mode. Fast (Lighthouse ≥ 90). Accessible: keyboard navigation and alt text.
- Test at mobile widths (360–414 px) as well as desktop before calling UI work done.

## Live HMF photos

**Decision (2026-10-07):** we store only the HMF rose URL/ID per rose. Photo URLs are never stored; they are discovered on the fly by the server route when a client opens a rose, and rendered in the UI with credit and a link back to HMF.

**Confirmed (2026-10-07):** with `web/hotlink-test.html` served from the custom domain, one HMF image (896x672) loaded in a plain `<img>` under the default referrer policy. The other policies were not reported. Only one image was tested.

- The browser can't read HMF pages directly (CORS). A thin server-side route (a Next.js route handler or edge function) takes an HMF plant ID, fetches that plant's photo listing, and returns the image URLs and photographer credits.
- The route **must not write anything to disk or a database**. Short in-memory/HTTP cache headers are the most it may keep.
- Images load straight from HMF's URLs. Always show the photographer credit and a link back to the HMF page.
- Risks to check early: HMF may block hotlinking (Referer checks), limit how often we can request pages, or change its page markup. When no photo is available, show a placeholder plus a "View on HelpMeFind" link.
