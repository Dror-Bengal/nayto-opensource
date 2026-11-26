"""Refresh the demo from a freshly seeded local dashboard; reject any non-fixture row."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from sample_posts import example_posts

def read(path, **params):
    with urlopen("http://127.0.0.1:18808/api/" + path + "?" + urlencode(params), timeout=10) as response:
        return json.load(response)

saved = read("posts", limit=100)["posts"]
start = datetime.fromisoformat(saved[0]["created_time"])
rows = []
for record, sample in zip(saved, example_posts(start), strict=True):
    for key, value in sample.items():
        if key not in ("created_time", "comments"):
            assert record[key] == value, f"Unexpected fixture field {key}"
    assert datetime.fromisoformat(record["created_time"]) == sample["created_time"]
    rows.append({**sample, "_id": sample["fb_post_id"], "created_time": sample["created_time"].isoformat()})
pages = sorted({p["page_name"] for p in rows})
assert len(rows) == 72 and len(pages) == 3
matrices = {}
for page in ["all", *pages]:
    matrix = read("dashboard/kpi-matrix", page_id=page)
    count = sum(cell["count"] for row in matrix["kpi_matrix"].values() for cell in row.values())
    now = datetime.fromisoformat(matrix["calculated_at"])
    assert count == sum((now - datetime.fromisoformat(p["created_time"])).total_seconds() <= 28*86400
                        and page in ("all",p["page_name"]) for p in rows)
    matrices[page] = matrix
out = Path(__file__).resolve().parents[1] / "src/services"
(out / "posts.json").write_text(json.dumps(rows, separators=(",",":"))+"\n")
(out / "benchmarks.json").write_text(json.dumps(matrices, separators=(",",":"))+"\n")
