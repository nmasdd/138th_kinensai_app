"""検索に出る企画 (クラス企画 + 有志企画) を一覧ダンプする。

使い方: python tools/pamphlet/dump_items.py <bundledDir>
"""
import json
import os
import sys


def main() -> int:
    base = sys.argv[1]
    classes = json.load(open(os.path.join(base, "class-catalog.json"), encoding="utf-8"))
    vols = json.load(open(os.path.join(base, "volunteers.json"), encoding="utf-8"))
    out = [f"== classes: {len(classes)} =="]
    for c in classes:
        out.append(f"[{c['id']}] {c['className']} | {c['title']} | {c['detail']}")
    out.append(f"== volunteers: {len(vols)} ==")
    for v in vols:
        out.append(f"[{v['id']}] {v['className']} | {v['projectName']} | {v.get('description','')} | place={v.get('place')}")
    sys.stdout.buffer.write("\n".join(out).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
