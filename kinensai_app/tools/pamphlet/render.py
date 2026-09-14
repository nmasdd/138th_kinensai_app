"""PDF各ページをPNGに描画する。

使い方: python tools/pamphlet/render.py <pdf> <outdir> [dpi] [first] [last]
"""
import os
import sys

import pymupdf


def main() -> int:
    pdf = sys.argv[1]
    out = sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 150
    first = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    last = int(sys.argv[5]) if len(sys.argv) > 5 else 10**9
    os.makedirs(out, exist_ok=True)
    doc = pymupdf.open(pdf)
    zoom = dpi / 72
    mat = pymupdf.Matrix(zoom, zoom)
    n = 0
    for pno in range(doc.page_count):
        if not (first <= pno <= last):
            continue
        pix = doc[pno].get_pixmap(matrix=mat)
        pix.save(os.path.join(out, f"p{pno:02d}.png"))
        n += 1
    print(f"rendered={n} out={out} dpi={dpi}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
