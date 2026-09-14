"""extract_photos.py の _index.json から content-images.ts を生成し、画像を assets/content へ配置する。

使い方: python tools/pamphlet/gen_content_images.py <photosDir> <assetsContentDir> <tsOut>
"""
import json
import os
import shutil
import sys


def main() -> int:
    photos_dir = sys.argv[1]
    assets_dir = sys.argv[2]
    ts_out = sys.argv[3]
    os.makedirs(assets_dir, exist_ok=True)
    idx = json.load(open(os.path.join(photos_dir, "_index.json"), encoding="utf-8"))

    lines = ["export const CONTENT_IMAGES: Record<string, number> = {"]
    count = 0
    for e in idx:
        if not e.get("file"):
            continue
        src = os.path.join(photos_dir, e["file"])
        dst = os.path.join(assets_dir, e["file"])
        shutil.copyfile(src, dst)
        lines.append(f"  '{e['id']}': require('../../../assets/content/{e['file']}'),")
        count += 1
    lines.append("};")
    lines.append("")
    with open(ts_out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"images={count} assets={assets_dir} ts={ts_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
