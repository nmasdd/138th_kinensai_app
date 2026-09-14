"""団体名→写真の対応付け用に、名前リストとページ範囲を指定して map_photos を回す補助。

使い方: python tools/pamphlet/photos_probe.py <pdf> <pages.json> <out.json> <first> <last> <names.json>
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

STAGE = [
    "BREAKER 今井",
    "Tee's",
    "バカボンド",
    "Genesis",
    "TKI48",
    "vola",
    "Impression",
    "Tourmaline",
    "LATE!",
    "Acoustics",
    "COTAROT",
    "オーケストラ部",
    "S²",
]


def main() -> int:
    pdf, pages_path, out_path, first, last, names_path = sys.argv[1:7]
    names = json.load(open(names_path, encoding="utf-8"))
    json.dump(STAGE + names, open(os.path.join(os.path.dirname(out_path), "all_names.json"), "w", encoding="utf-8"), ensure_ascii=False)
    rc = subprocess.call([sys.executable, os.path.join(HERE, "map_photos.py"), pdf, pages_path, out_path, first, last, os.path.join(os.path.dirname(out_path), "all_names.json")])
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
