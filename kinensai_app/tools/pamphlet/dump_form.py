"""form.json をカテゴリ別にダンプする補助スクリプト。

使い方: python tools/pamphlet/dump_form.py <form.json> <categorySubstr>
"""
import json
import sys


def main() -> int:
    path = sys.argv[1]
    needle = sys.argv[2] if len(sys.argv) > 2 else ""
    records = json.load(open(path, encoding="utf-8"))
    out = []
    for r in records:
        if needle and needle not in (r.get("category") or ""):
            continue
        out.append(
            json.dumps(
                {
                    "row": r["row"],
                    "cat": r["category"],
                    "class": r["class"],
                    "title": r["classTitle"],
                    "genre": r["genre"],
                    "name": r["groupName"] or r["groupVolunteer"] or r["groupFormal"],
                    "schedule": r["schedule"],
                    "place": r["place"],
                    "intro": r["intro"],
                    "photoStage": r["photoStage"],
                    "photoVolunteer": r["photoVolunteer"],
                },
                ensure_ascii=False,
            )
        )
    sys.stdout.buffer.write("\n".join(out).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
