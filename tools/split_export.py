"""Split a full export (skyrim-map-data.json, from the site's "Export all" button)
back into the per-file layout used in data/.

Usage:  py -3 tools/split_export.py path/to/skyrim-map-data.json
"""
import json, sys, pathlib

src = pathlib.Path(sys.argv[1])
root = pathlib.Path(__file__).resolve().parent.parent / "data"
d = json.loads(src.read_text(encoding="utf-8"))
for group in ("holds", "locations", "ores", "ingredients", "other"):
    items = d.get(group, [])
    out = root / f"{group}.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{out.name}: {len(items)} items")
