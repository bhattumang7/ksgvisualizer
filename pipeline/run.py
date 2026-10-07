from . import extract, normalize, report
import json

es = extract.extract()
extract.OUT.parent.mkdir(parents=True, exist_ok=True)
extract.OUT.write_text(json.dumps(es, ensure_ascii=False, indent=1))
roses, review = normalize.build()
counts = report.write_report(roses, review)
print(len(roses), "roses;", dict(counts), ";", len(review), "review items")
