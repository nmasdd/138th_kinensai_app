"""photo_map.json を見やすくダンプする。

使い方: python tools/pamphlet/dump_photomap.py <photo_map.json>
"""
import json
import sys


def main() -> int:
    rows = json.load(open(sys.argv[1], encoding="utf-8"))
    best = {}
    for e in rows:
        if e.get("image") is None:
            continue
        k = e["name"]
        if k not in best or e["dist"] < best[k]["dist"]:
            best[k] = e
    out = []
    for k, v in best.items():
        im = v["image"]
        out.append(
            "p{:02d} d={:6.0f} xref={:5d} {}x{} a={:6d} | {} | {}".format(
                v["page"], v["dist"], im["xref"], im["w"], im["h"], im["area"], k, v["matchedText"][:44]
            )
        )
    sys.stdout.buffer.write("\n".join(out).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
