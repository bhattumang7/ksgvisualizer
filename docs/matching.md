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

- **Lookup (`pnpm hmf-search` in `web/`).** HMF's own name search (`/rose/plants.php?searchNm=<name>&searchNmTyp=5`) is a plain GET. Each result row is one *name* of one plant and shows the class, colour and "Breeder (year)", so matching needs no plant-page loads. A synonym is its own row with the same plant number and a different last segment (`l=2.69538.4` and `.8`), so the matcher keys on `l=2.<plant>` and treats those rows as one rose. KSG entries with two names (`ROSE SULLIVAN (VIR WINE)`, `SA GARDEN / TUIN`) are searched under each name.
- **Request budget.** One request per unique name (about 1,230), at most 100 per run (`--limit`), 5-8 s apart, stopping at the first 403/429/5xx. `--delay MIN-MAX` (seconds) and `--threads N` speed it up; the full run used 3 threads at 0.5 s. When HMF finds exactly one plant it redirects to that plant's page; the script reads its title and description once and keeps that as the single result. If the searched name differs from the page's name, the name is a synonym and the match is `fuzzy` for a person to check. Raw rows are cached per name in `cache/hmf-search/` (gitignored), so nothing is fetched twice. If a name finds no usable match (HMF spells it "Princesse", KSG "Princess"), one looser `contains` search on the name's rarest word follows (rarity = how few catalogue names contain it; HMF pages long lists, only page 1 is read).
- **Scoring is offline** (`web/src/lib/hmf-match.ts`, `pnpm hmf-search --score-only`): name similarity over all KSG names vs all HMF names, plus breeder (main signal), year (±1; HMF's year is often the breeding year), and class. `exact` = name equal and no tie, and either breeder or year confirmed, or the search yielded only one plant (`sole-result`: the name alone settles it, unless its years/breeder contradict the KSG entry). `fuzzy` = close name, or nothing confirms it, or a tie. A same-named plant whose years don't fit and whose breeder doesn't match is a different rose (`none`, "probably not on HMF"). Entries that land on one plant are the same rose if breeder and year agree (`duplicate_of`), otherwise the best-supported one keeps the plant.
- Output: `data/hmf-matches.json` (merged into `roses.json` by `python -m pipeline.run`) and `data/review/hmf-matches.csv` (every non-exact match with its top 3 candidates). The `l=2.` form has no numeric `n` id, so `hmf.id` stays null until the details step fills it in.
- `pnpm hmf-match` (Google in your own Chrome over CDP) exists but Google hides result urls in automated browsers, so it is not the main route.
- Synonyms and trade names may be used *during matching*, because KSG often uses names that differ from HMF's main name. Don't store them as content.

## Secondary sources

Breeder sites (kordes-rosen.com, meilland.com, tantau.com, etc.), the American Rose Society / Modern Roses database, Wikipedia/Wikidata, and Indian rose society sources for Indian cultivars. Store only the URL or ID for each one.

## Resolving what the matcher could not

Every non-exact rose is listed in `data/review/hmf-matches.csv` with its top 3 candidates; the raw search pages stay in `cache/hmf-search/`. Decide each one by hand (from `web/`):

- `pnpm hmf-decide ROSE_ID <hmf plant url>` links the rose (`match_confidence: "manual"`).
- `pnpm hmf-decide ROSE_ID --none` records that it was checked and is not on HMF.
- `pnpm hmf-decide ROSE_ID --undo` removes the decision.

Cases checked and still open are listed in `data/review/hmf-open-cases.md`.

Decisions are written to `data/overrides.json` (applied last by `python -m pipeline.run`, never overwritten), and decided roses drop out of the review CSV.

**Decision log.** `data/review/hmf-decisions.md` records, for every hand decision in `data/overrides.json`, the KSG entry, the HMF plant and the reason (synonym, breeder, year, class or colour; or why the HMF plant is a different rose). Add a line there when you run `pnpm hmf-decide`.
