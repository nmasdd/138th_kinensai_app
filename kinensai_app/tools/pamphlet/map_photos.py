"""PDFページ内のテキストブロックと配置画像を突き合わせ、団体名→写真候補を推定する。

使い方:
  python tools/pamphlet/map_photos.py <pdf> <pages.json> <out.json> [first] [last]
出力: [{page, name, matchedText, image:{xref,bbox,w,h,area}, score}]
"""
import json
import re
import sys

import pymupdf

NORM_RE = re.compile(r"[^0-9A-Za-z\u3040-\u30ff\u4e00-\u9fff]")


def norm(s: str) -> str:
    return NORM_RE.sub("", s or "").lower()


def block_center(bbox):
    return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)


def main() -> int:
    pdf = sys.argv[1]
    pages_path = sys.argv[2]
    out_path = sys.argv[3]
    first = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    last = int(sys.argv[5]) if len(sys.argv) > 5 else 10**9

    names = json.load(open(sys.argv[6], encoding="utf-8")) if len(sys.argv) > 6 else []

    pages = json.load(open(pages_path, encoding="utf-8"))
    doc = pymupdf.open(pdf)

    report = []
    for p in pages:
        if not (first <= p["index"] <= last):
            continue
        page = doc[p["index"]]
        imgs = []
        for info in page.get_image_info(xrefs=True):
            if not info.get("xref"):
                continue
            b = info["bbox"]
            area = abs((b[2] - b[0]) * (b[3] - b[1]))
            imgs.append({"xref": info["xref"], "bbox": [round(v, 1) for v in b], "w": info["width"], "h": info["height"], "area": round(area)})
        for name in names:
            nn = norm(name)
            if len(nn) < 2:
                continue
            best = None
            for blk in p["blocks"]:
                txt = norm(blk["text"])
                if nn and nn in txt:
                    score = len(nn) / max(1, len(txt))
                    if best is None or score > best[0]:
                        best = (score, blk)
            if best is None:
                continue
            bc = block_center(best[1]["bbox"])
            cand = []
            for im in imgs:
                if im["area"] < 3000 or im["area"] > 120000:
                    continue
                ic = block_center(im["bbox"])
                dist = ((bc[0] - ic[0]) ** 2 + (bc[1] - ic[1]) ** 2) ** 0.5
                cand.append((dist, im))
            cand.sort(key=lambda x: x[0])
            report.append(
                {
                    "page": p["index"],
                    "name": name,
                    "matchedText": " ".join(best[1]["text"].split())[:80],
                    "image": cand[0][1] if cand else None,
                    "dist": round(cand[0][0], 1) if cand else None,
                }
            )
    json.dump(report, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"mapped={len(report)} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
