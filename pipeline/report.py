"""Write data/review/extraction-report.md and check class counts."""
import collections
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
EXPECTED = {"Hybrid Tea": 757, "Floribunda": 270, "Miniature": 60, "Climber": 55, "Shrub": 49, "Polyantha": 26}


def write_report(roses, review):
    counts = collections.Counter(r["class"] for r in roses)
    names = collections.Counter(r["ksg_name"] for r in roses)
    lines = ["# Extraction report", "", f"Total entries: **{len(roses)}** (docs expected ~{sum(EXPECTED.values())})", "",
             "| Class | Extracted | Docs estimate |", "|---|---|---|"]
    lines += [f"| {c} | {counts[c]} | {n} |" for c, n in EXPECTED.items()]
    lines += ["", "## Repeated names (same name listed more than once)", ""]
    lines += [f"- {n} x{k}" for n, k in sorted(names.items()) if k > 1] or ["none"]
    by_issue = collections.defaultdict(list)
    for r in review:
        by_issue[r["issue"]].append(r)
    for issue, items in sorted(by_issue.items()):
        lines += ["", f"## {issue} ({len(items)})", ""]
        lines += [f"- p{i['page']} {i.get('id', '')} {i.get('raw', '')[:100]}".rstrip() for i in items]
    out = DATA / "review" / "extraction-report.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n")
    return counts
