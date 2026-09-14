"""完成パンフレットPDFからページ単位のテキストと配置画像を抽出する。

出力 (既定: テンポラリディレクトリ pamphlet/):
  pages.json  ページごとの {index, width, height, blocks:[{bbox,text}], images:[{xref,bbox,w,h,name}]}
  images.json xref -> {w,h,bytes,cs,ext} の一覧
使い方:
  python tools/pamphlet/extract.py <pdf> <outdir>
"""
import json
import os
import sys

import pymupdf


def main() -> int:
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    doc = pymupdf.open(pdf_path)
    pages = []
    images = {}

    for pno in range(doc.page_count):
        page = doc[pno]
        rect = page.rect
        blocks = []
        for b in page.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            text = "".join(
                s.get("text", "") for line in b.get("lines", []) for s in line.get("spans", [])
            )
            if text.strip():
                blocks.append({"bbox": [round(v, 1) for v in b["bbox"]], "text": text})
        imgs = []
        for info in page.get_image_info(xrefs=True):
            xref = info.get("xref", 0)
            if not xref:
                continue
            entry = {
                "xref": xref,
                "bbox": [round(v, 1) for v in info["bbox"]],
                "w": info.get("width"),
                "h": info.get("height"),
                "name": info.get("name"),
            }
            imgs.append(entry)
            if xref not in images:
                try:
                    raw = doc.extract_image(xref)
                    images[xref] = {
                        "w": raw["width"],
                        "h": raw["height"],
                        "ext": raw["ext"],
                        "cs": raw.get("colorspace"),
                        "bytes": len(raw["image"]),
                    }
                except Exception as exc:  # noqa: BLE001
                    images[xref] = {"error": str(exc)}
        pages.append(
            {
                "index": pno,
                "width": round(rect.width, 1),
                "height": round(rect.height, 1),
                "blocks": blocks,
                "images": imgs,
            }
        )

    with open(os.path.join(out_dir, "pages.json"), "w", encoding="utf-8") as fh:
        json.dump(pages, fh, ensure_ascii=False)
    with open(os.path.join(out_dir, "images.json"), "w", encoding="utf-8") as fh:
        json.dump(images, fh, ensure_ascii=False)
    print(f"pages={len(pages)} images={len(images)} out={out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
