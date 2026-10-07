"""entries.json -> data/roses.json + data/breeders.json (HMF/links left empty)."""
import json
import re
import unicodedata
from pathlib import Path

from .parse import parse_entry

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# explicit multi/bi-colour wording wins; otherwise the earliest colour word in the text decides
MULTI_RE = re.compile(r"multi-?colou?r|rainbow|colou?r[- ]changing|changing colou?r|tri-?colou?r")
BI_RE = re.compile(r"bi-?colou?r|two-?tone|picotee|striped|stripes|streak|splash|handpaint|hand-painted")
# Only direct colour names; a text naming more than one family is left undecided.
COLOUR_WORDS = [
    ("red", r"\b(?:red|crimson|scarlet|maroon|burgundy)\b"),
    ("pink", r"\b(?:pink|cerise)\b"),
    ("orange", r"\borange\b"),
    ("yellow", r"\b(?:yellow|golden|canary|lemon)\b"),
    ("white", r"\b(?:white|ivory)\b"),
    ("mauve", r"\b(?:mauve|lavender|lilac|purple|violet)\b"),
]
FRAGRANCE_RE = re.compile(
    r"([^.,]*?\b(?:(?:very |mild |strong |light |spicy |sweet |rich |intense |delicious |fruity |lovely )*"
    r"(?:fragran(?:t|ce)|perfum(?:e|ed)|scent(?:ed)?))\b[^.,]*)", re.I)


# Well-known breeders only; anything not listed stays unset for manual curation. Confirmed by the user.
BREEDER_COUNTRY = {
    "Kordes": "DE", "Tantau": "DE", "Meilland": "FR", "Delbard": "FR", "Orard": "FR", "Sauvageot": "FR",
    "Gaujard": "FR", "Fryer": "GB", "Harkness": "GB", "Dickson": "GB", "Cocker": "GB", "Austin": "GB",
    "Carruth": "US", "Zary": "US", "Weeks": "US", "Warriner": "US", "Moore": "US", "Bedard": "US",
    "Armstrong": "US", "Christensen": "US", "J & P": "US", "Swim": "US", "Williams": "US",
    "McGredy": "NZ", "Barni": "IT", "Poulsen": "DK", "Interplant": "NL", "Dot": "ES",
    "Teranishi": "JP", "Keisei": "JP", "Suzuki": "JP",
    "IARI": "IN", "G.Kasturi Rangan": "IN", "M.S.Viraraghavan": "IN", "M.S. Viraraghavan": "IN",
    "Dr.N.V.Shastri": "IN", "Kasturi & Sriram": "IN", "Kasturi & Sriram(KSG Son)": "IN",
    "G.Kasturi Rangan(KSG Son)": "IN",
}


def slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def colour_text(desc: str) -> str:
    m = re.match(r"(.+?[a-z)])\.(?=[A-Z\s]|$)", desc, re.S)
    return (m.group(1) if m else desc).strip()


def colour_group(text: str) -> str | None:
    t = text.lower()
    if MULTI_RE.search(t):
        return "multicolour"
    if BI_RE.search(t):
        return "bicolour"
    found = [g for g, pat in COLOUR_WORDS if re.search(pat, t)]
    return found[0] if len(found) == 1 else None


def award_obj(a: str) -> dict:
    m = re.search(r"(?:'|’)(\d{2})\b|\b((?:18|19|20)\d{2})\b", a)
    year = None
    if m:
        year = (1900 + int(m[1]) if int(m[1]) > 26 else 2000 + int(m[1])) if m[1] else int(m[2])
    return {"name": re.sub(r"\s*(?:'|’)?\d{2,4}\s*$", "", a).strip() or a, "year": year}


def build():
    entries = json.loads((DATA / "raw" / "entries.json").read_text())
    first = [parse_entry(e["raw_text"], e["price_raw"]) for e in entries]
    known = {p["breeder_raw"] for p in first if p.get("year_raw") and p["breeder_raw"]}
    sample = json.loads((DATA / "sample" / "breeders.json").read_text())
    known |= {b["ksg_name"] for b in sample}
    known = frozenset(known)

    sample_by_name = {b["ksg_name"]: b for b in sample}
    breeders, roses, seen, review = {}, [], {}, []
    for e in entries:
        p = parse_entry(e["raw_text"], e["price_raw"], known)
        if "class" not in p:
            review.append({"page": e["page"], "issue": "unparsed", "raw": e["raw_text"]})
            continue
        base = slug(p["ksg_name"]) or "rose"
        seen[base] = seen.get(base, 0) + 1
        rid = base if seen[base] == 1 else f"{base}-{seen[base]}"
        b = p["breeder_raw"]
        bid = None
        if b:
            bid = slug(b)
            if bid not in breeders:
                s = sample_by_name.get(b)
                breeders[bid] = ({**s, "id": s["id"]} if s else
                                 {"id": bid, "ksg_name": b, "name": b,
                                  "country": BREEDER_COUNTRY.get(b), "indian": True if BREEDER_COUNTRY.get(b) == "IN" else (False if b in BREEDER_COUNTRY else None)})
            bid = breeders[bid]["id"]
        ctext = colour_text(p["description"])
        group = colour_group(ctext)
        frag = FRAGRANCE_RE.search(p["description"])
        for w in p["parse_warnings"]:
            review.append({"page": e["page"], "id": rid, "issue": w})
        roses.append({
            "id": rid, "ksg_name": p["ksg_name"], "canonical_name": p["ksg_name"],
            "is_new": p["is_new"], "class": p["class"], "breeder_raw": b or None, "breeder_id": bid,
            "year_raw": p["year_raw"], "year": p["year"], "awards": [award_obj(a) for a in p["awards"]],
            "colour_text": ctext, "colour_group": group,
            "fragrance": frag.group(1).strip().lower() if frag else None,
            "description": p["description"], "price_inr": p["price_inr"], "ksg_page": e["page"],
            "hmf": {"id": None, "url": None, "match_confidence": "none"},
            "links": {"wikidata": None, "breeder_url": None, "ars": None},
        })

    ov_path = DATA / "overrides.json"
    if not ov_path.exists():
        ov_path.write_text("{}\n")
    overrides = json.loads(ov_path.read_text() or "{}")
    for r in roses:
        r.update(overrides.get(r["id"], {}))

    (DATA / "roses.json").write_text(json.dumps(roses, ensure_ascii=False, indent=1) + "\n")
    (DATA / "breeders.json").write_text(json.dumps(sorted(breeders.values(), key=lambda b: b["id"]), ensure_ascii=False, indent=1) + "\n")
    return roses, review
