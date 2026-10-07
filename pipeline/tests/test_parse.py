import json
from pathlib import Path

from pipeline.parse import parse_entry

ROOT = Path(__file__).resolve().parents[2]


def test_plain_entry():
    p = parse_entry("ABBAYE DE CLUNY - Hybrid Teas, Meilland '93.Orange apricot. Huge flowers.", "100")
    assert (p["ksg_name"], p["class"], p["breeder_raw"], p["year"], p["price_inr"]) == (
        "ABBAYE DE CLUNY", "Hybrid Tea", "Meilland", 1993, 100)
    assert p["description"] == "Orange apricot. Huge flowers."


def test_award_and_missing_space():
    p = parse_entry("ABOUT FACE - Hybrid Teas, Carruth '04. AARS '05. Unique grandiflora.Dark bronzy red", "100")
    assert p["awards"] == ["AARS '05"] and p["year"] == 2004


def test_new_flag_and_four_digit_year():
    assert parse_entry("ABRACADABRA (NEW) - Hybrid Teas, Kordes '02. Striped", "200")["is_new"]
    p = parse_entry("ADRIANA - Hybrid Teas, Fryer 2000. Delicate creamy caramel.", "100")
    assert p["year"] == 2000 and p["breeder_raw"] == "Fryer"


def test_no_year_known_breeder():
    p = parse_entry("AJATASHATRU KASTURI - Hybrid Teas, M.S. Viraraghavan, Pink, deep pink reverse.", "300",
                    frozenset({"M.S. Viraraghavan"}))
    assert p["breeder_raw"] == "M.S. Viraraghavan" and p["year"] is None
    assert p["description"].startswith("Pink")


def test_accented_name_and_no_comma():
    assert parse_entry("IRISH CRÈME - Hybrid Teas, A.Perry '99. Creamy.", "1")["ksg_name"] == "IRISH CRÈME"
    assert parse_entry("YESAMIN CAVAS - Hybrid Teas", None)["class"] == "Hybrid Tea"


def test_sample_roses_match():
    sample = {(r["ksg_name"], r["class"]): r for r in json.loads((ROOT / "data/sample/roses.json").read_text())}
    full = {(r["ksg_name"], r["class"]): r for r in json.loads((ROOT / "data/roses.json").read_text())}
    for name, s in sample.items():
        if s["ksg_page"] is None:
            continue  # placeholder in the hand-made sample, not in the PDF
        assert name in full, name
        for k in ("class", "breeder_raw", "year", "price_inr", "is_new"):
            if s[k] is None and k == "price_inr":
                continue  # the hand-made sample left some prices blank; the PDF has them
            assert full[name][k] == s[k], (name, k)
