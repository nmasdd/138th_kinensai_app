"""指定ページの配置画像とテキストブロックを一覧する。

使い方: python tools/pamphlet/page_info.py <pdf> <pageIndex>
"""
import sys

import pymupdf


def main() -> int:
    doc = pymupdf.open(sys.argv[1])
    page = doc[int(sys.argv[2])]
    out = ["--- images ---"]
    for info in page.get_image_info(xrefs=True):
        b = info["bbox"]
        area = abs((b[2] - b[0]) * (b[3] - b[1]))
        out.append(
            "xref={:5d} bbox=({:.0f},{:.0f},{:.0f},{:.0f}) {:d}x{:d} area={:.0f}".format(
                info.get("xref", 0), b[0], b[1], b[2], b[3], info["width"], info["height"], area
            )
        )
    out.append("--- blocks ---")
    for b in page.get_text("blocks"):
        out.append("bbox=({:.0f},{:.0f},{:.0f},{:.0f}) :: {}".format(*b[:4], " ".join(str(b[4]).split())[:70]))
    sys.stdout.buffer.write("\n".join(out).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
