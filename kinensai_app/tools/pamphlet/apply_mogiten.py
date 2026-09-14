"""模擬店フラグを bundled JSON に付与する。

- 3年模擬店 (3A..3J): mogiten=true、説明から調査用の接頭辞「3年模擬店。」を除去
- ビジネス愛好会 (club-10) / 高校PTA ポン菓子 (club-30): mogiten=false

使い方: python tools/pamphlet/apply_mogiten.py <bundledDir>
"""
import json
import os
import sys


def load(path):
    return json.load(open(path, encoding="utf-8"))


def dump(path, data):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def main() -> int:
    base = sys.argv[1]
    cpath = os.path.join(base, "class-catalog.json")
    vpath = os.path.join(base, "volunteers.json")
    classes = load(cpath)
    for c in classes:
        if c["id"] in {f"3{s}" for s in "ABCDEFGHIJ"}:
            c["detail"] = c["detail"].replace("3年模擬店。", "", 1)
            c["mogiten"] = True
    dump(cpath, classes)

    vols = load(vpath)
    for v in vols:
        if v["id"] in ("club-10", "club-30"):
            v["mogiten"] = False
    dump(vpath, vols)
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
