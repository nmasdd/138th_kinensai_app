"""ページごとの配置画像を抽出し、団体名ラベル付きコンタクトシートを作る。

使い方: python tools/pamphlet/extract_photos.py <pdf> <plan.json> <outdir>
plan.json: [{"page":45,"names":["mars18",...],"ids":["aud-mars18",...]}, ...]
"""
import json
import os
import sys

import pymupdf
from PIL import Image, ImageDraw


def main() -> int:
    pdf = sys.argv[1]
    plan = json.load(open(sys.argv[2], encoding="utf-8"))
    out_dir = sys.argv[3]
    os.makedirs(out_dir, exist_ok=True)
    doc = pymupdf.open(pdf)

    thumbs = []
    index = []
    for item in plan:
        page = doc[item["page"]]
        imgs = []
        for info in page.get_image_info(xrefs=True):
            x = info.get("xref", 0)
            if not x:
                continue
            b = info["bbox"]
            w = abs(b[2] - b[0])
            h = abs(b[3] - b[1])
            area = w * h
            ratio = w / h if h else 99
            if area < 2500 or area > 200000:
                continue
            if w > 400:
                continue
            if ratio < 0.5 or ratio > 3.2:
                continue
            imgs.append((b[1], b[0], x, b))
        imgs.sort(key=lambda t: (round(t[0] / 20), t[1]))
        skip = item.get("skip", 0)
        imgs = imgs[skip:]
        names = item["names"]
        ids = item.get("ids") or names
        for i, name in enumerate(names):
            if i >= len(imgs):
                index.append({"page": item["page"], "name": name, "id": ids[i], "xref": None})
                continue
            xref = imgs[i][2]
            raw = doc.extract_image(xref)
            img = Image.open(__import__("io").BytesIO(raw["image"])).convert("RGB")
            if img.width > 1200:
                img = img.resize((1200, round(img.height * 1200 / img.width)))
            fn = f"p{item['page']:02d}_{i:02d}.jpg"
            img.save(os.path.join(out_dir, fn), quality=88)
            index.append({"page": item["page"], "name": name, "id": ids[i], "xref": xref, "file": fn})
            thumb = img.copy()
            thumb.thumbnail((300, 300))
            thumbs.append((f"{item['page']}:{name}", thumb))

    cols = 5
    cell_w, cell_h = 310, 250
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (label, th) in enumerate(thumbs):
        cx = (i % cols) * cell_w
        cy = (i // cols) * cell_h
        sheet.paste(th, (cx + 5, cy + 22))
        draw.text((cx + 5, cy + 4), label[:34], fill=(0, 0, 0))
    sheet.save(os.path.join(out_dir, "_contact.jpg"), quality=80)
    json.dump(index, open(os.path.join(out_dir, "_index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"photos={len(thumbs)} out={out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
