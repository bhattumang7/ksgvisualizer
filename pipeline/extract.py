"""Extract raw list entries from the KSG catalogue PDF into data/raw/entries.json.

Reads words with positions (PyMuPDF), separates the right-hand price column, starts a
new entry at every `NAME [(NEW)] - <Class>,` line and glues the rest on as continuation.
"""
import json
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "KSG'S CATALOGUE 2024.pdf"
OUT = ROOT / "data" / "raw" / "entries.json"

LIST_PAGES = list(range(30, 57)) + list(range(60, 71)) + list(range(74, 82))
PRICE_X = 495  # price column starts right of this
FOOTER_Y = 755
LINE_TOL = 3.0
START_RE = re.compile(
    r"^(?P<name>[^\W_a-z][^a-z]*?)(?P<new> \(NEW\))? - "
    r"(?P<cls>Hybrid Teas?|Floribundas?|Miniatures?|Climbers?|Shrubs?|Shrub Roses?|Polyanthas?)\s*(?:,|$)"
)


def page_lines(page):
    """Return (text_lines, prices) for a page; each is a list of (y, text)."""
    words = [w for w in page.get_text("words") if w[1] < FOOTER_Y]
    prices, text = [], []
    for w in words:
        (prices if w[0] >= PRICE_X else text).append(w)
    plines = []
    for w in sorted(prices, key=lambda w: (w[1], w[0])):
        t = w[4]
        if t == "₹":
            plines.append([w[1], ""])
        elif plines and abs(plines[-1][0] - w[1]) < LINE_TOL:
            plines[-1][1] += t
        else:  # stray text in the right margin: treat as text
            text.append(w)
    lines = []
    for w in sorted(text, key=lambda w: (round(w[1] / LINE_TOL), w[0])):
        if lines and abs(lines[-1][0] - w[1]) < LINE_TOL:
            lines[-1][1].append(w)
        else:
            lines.append([w[1], [w]])
    out = [(y, " ".join(x[4] for x in sorted(ws, key=lambda x: x[0]))) for y, ws in lines]
    return out, [(y, p) for y, p in plines]


def extract():
    doc = pymupdf.open(str(PDF))
    entries, cur = [], None
    for pn in LIST_PAGES:
        lines, prices = page_lines(doc[pn - 1])
        events = [(y, 0, t) for y, t in lines] + [(y, 1, p) for y, p in prices]
        for y, kind, t in sorted(events, key=lambda e: (e[0], e[1])):
            if kind == 1:
                if cur is not None:
                    cur["price_raw"] = t
                continue
            if t.startswith("List of "):
                continue
            if START_RE.match(t):
                cur = {"page": pn, "y0": round(y, 1), "raw_text": t, "price_raw": None}
                entries.append(cur)
            elif cur is not None:
                cur["raw_text"] += " " + t
    return entries


if __name__ == "__main__":
    es = extract()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(es, ensure_ascii=False, indent=1))
    print(len(es), "entries")
