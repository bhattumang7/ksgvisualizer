# HMF matches still to decide

Fuzzy matches from `pnpm hmf-search` that were checked by hand and could not be confirmed. Candidates come from
`hmf-matches.csv`; the facts below were read from each plant's HMF page. To settle one:
`pnpm hmf-decide ROSE_ID <hmf plant url>` or `pnpm hmf-decide ROSE_ID --none` (in `web/`).

| Rose (KSG) | Top candidate | Why it is not confirmed | Other candidates |
|---|---|---|---|
| `barbarella`: hybrid tea, no breeder or year | l=2.28344, miniature, Barni, 1981 | class differs | l=2.84719, hybrid tea, Grandes Roseraies, 1973 (class fits) |
| `black-gold`: hybrid tea, no breeder or year | l=2.710, miniature, Clements, 1996 | class differs | l=2.63293, hybrid tea, Meilland, before 2008 (class fits); l=2.89486, florists rose, Meilland, 2020 |
| `bellisima`: Laperriere, 1992 | l=2.24825 ('SUNlampo', synonym Bellisima), floribunda, Schuurman (NZ), 1998 | breeder and year differ | none |
| `best-of-friends`: Poulson, 2002, hybrid tea | l=2.82798, floribunda, Rawlins, before 2018 | breeder, year and class differ | l=2.26791, hybrid tea, Olesen, 1999 (class fits, breeder and year do not) |

For the other 22 fuzzy matches, the name was the plant's name or a listed synonym and the breeder, class or year fit,
so they were recorded as `manual` in `data/overrides.json`.
