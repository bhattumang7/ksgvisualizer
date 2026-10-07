"""Pure functions that split a raw entry string into fields."""
import re

CLASS_MAP = {
    "hybrid tea": "Hybrid Tea", "floribunda": "Floribunda", "miniature": "Miniature",
    "climber": "Climber", "shrub": "Shrub", "shrub rose": "Shrub", "polyantha": "Polyantha",
}
HEAD_RE = re.compile(
    r"^(?P<name>[^\W_a-z][^a-z]*?)(?P<new> \(NEW\))? - "
    r"(?P<cls>[A-Za-z ]+?)\s*(?:,\s*|$)(?P<rest>.*)$", re.S)
YEAR_RE = re.compile(r"(?:'|’)(\d{2})(?!\d)|\b((?:18|19|20)\d{2})(?!\d)")
AWARD_RE = re.compile(
    r"^\s*((?:AARS|ARS|RNRS|ADR|Gold Medal|Silver Medal|Bronze Medal|Certificate of Merit|"
    r"Trial Ground Certificate|Fragrance Award|Hall of Fame|Rose Hall of Fame|"
    r"World Rose|Portland Gold Medal|AIRS|JRS)[^.]*?)\.", re.I)


def expand_year(yy: str) -> int:
    n = int(yy)
    return 1900 + n if n > 26 else 2000 + n


def parse_entry(raw_text: str, price_raw: str | None, known_breeders: frozenset = frozenset()) -> dict:
    warnings = []
    m = HEAD_RE.match(" ".join(raw_text.split()))
    if not m:
        return {"parse_warnings": ["no head match"], "raw_text": raw_text}
    cls_key = m["cls"].strip().lower()
    cls_key = cls_key[:-1] if cls_key.endswith("s") and cls_key not in CLASS_MAP else cls_key
    cls = CLASS_MAP.get(cls_key) or CLASS_MAP.get(cls_key.rstrip("s"))
    if not cls:
        warnings.append(f"unknown class {m['cls']!r}")
    rest = m["rest"].strip()

    # breeder = text before the first year marker, else before the first ". " / "."
    ym = YEAR_RE.search(rest)
    year_raw = year = None
    if ym and ym.start() < 60:
        breeder = rest[: ym.start()].strip(" ,.")
        year_raw = ym.group(0)
        year = expand_year(ym.group(1)) if ym.group(1) else int(ym.group(2))
        tail = rest[ym.end():]
    else:
        # no year: accept a breeder only if it is one we have seen alongside a year elsewhere
        breeder, tail = "", rest
        for k in sorted(known_breeders, key=len, reverse=True):
            if rest.startswith(k) and re.match(r"\s*(?:[.,]|$)", rest[len(k):]):
                breeder, tail = k, rest[len(k):].lstrip(" .,")
                break
        warnings.append("no year")
    tail = tail.lstrip(" .,")

    awards = []
    while True:
        am = AWARD_RE.match(tail)
        if not am:
            break
        awards.append(am.group(1).strip())
        tail = tail[am.end():].lstrip()
    if not breeder:
        warnings.append("no breeder")
    price = int(re.sub(r"\D", "", price_raw)) if price_raw and re.search(r"\d", price_raw) else None
    if price is None:
        warnings.append("no price")
    return {
        "ksg_name": m["name"].strip(), "is_new": bool(m["new"]), "class": cls, "class_raw": m["cls"],
        "breeder_raw": breeder, "year_raw": year_raw, "year": year, "awards": awards,
        "description": tail.strip(), "price_inr": price, "parse_warnings": warnings,
    }
