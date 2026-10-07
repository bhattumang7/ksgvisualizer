# KSG catalogue PDF: structure and extraction notes

Source: `KSG'S CATALOGUE 2024.pdf` (81 pages, exported from Word). It is read-only.

## Layout

| Pages | Content |
|---|---|
| 1–9 | Welcome letter, testimonials, care notes, pests and diseases table |
| 10–29 | **Photo grid: Hybrid Teas.** 4 photos per row with a caption under each (Title Case name only) |
| 30–56 | **List of Hybrid Teas:** the text entries with all the details |
| 57–59 | Photo grid: Floribundas |
| 60–70 | List of Floribundas |
| 71–73 | Photo grids: Miniatures, Climbers, Shrub Roses |
| 74–81 | Lists of Miniatures, Climbers, Polyanthas and Shrub Roses |

There are about 1,217 list entries: HT 757, Floribunda 270, Miniature 60, Climber 55, Shrub 49 and Polyantha 26. Use these counts to check the extraction.

## Entry format

```
NAME [(NEW)] - <Class>, <Breeder> '<YY>. [<Award> '<YY>.] <Colour/description...>      ₹ <price>
```

```
ABBAYE DE CLUNY - Hybrid Teas, Meilland '93.Orange apricot. Huge flowers.            ₹ 100
ABOUT FACE - Hybrid Teas, Carruth '04. AARS '05. Unique grandiflora.Dark bronzy red  ₹ 100
ADRIANA - Hybrid Teas, Fryer 2000. Delicate creamy caramel. Large with spicy fragrance.
AJATASHATRU KASTURI - Hybrid Teas, M.S. Viraraghavan, Pink, deep pink reverse. ...   ₹ 300
```

## Gotchas

- **Line wrapping:** descriptions span several lines, and the `₹ price` often sits on a *middle* line in the right column. Parse by x-coordinate (PyMuPDF/pdfplumber words with positions), not only with `pdftotext -layout`. A new entry starts with an UPPERCASE name followed by ` - <Class>,`.
- **Years:** most are 2-digit (`'93`, `'02`), but some are 4-digit (`2000`) and some are missing, which is common for Indian breeders. Expand `'YY` with a cutoff: values above 26 map to 19YY, the rest to 20YY. Keep the raw string as well.
- **Missing space after the period:** e.g. `Meilland '93.Orange`. Split on the breeder/year pattern, not on `. `.
- **Markers:** `(NEW)` next to the name means it is new this season. Strip it from the name and store it as a flag. Awards (`AARS '05`, gold medals and so on) appear right after the year.
- **Spelling:** names and breeders are sometimes misspelled or use a local spelling, e.g. `Kupferkongin` (Kupferkönigin), `La Parissiene` (La Parisienne), `Bella 'Roma`, `Winchel` (Winchell). Keep the original as `ksg_name` and add a `canonical_name` after matching.
- **Photo grid pages:** we don't use the KSG images. The Title Case captions are only useful for checking the spelling of list names (lists are in UPPERCASE). Polyanthas have no photo grid section.

## After extraction

Check the counts per class against the numbers above. Report any entry that is missing a price or a breeder.
