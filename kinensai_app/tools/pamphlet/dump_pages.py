"""pages.json を人間が読める形でダンプする補助スクリプト。

使い方:
  python tools/pamphlet/dump_pages.py <pages.json> [start] [end] [substr]
  - start/end: ページ番号の範囲 (省略時は全ページ)
  - substr: 指定語を含むページのみ表示
"""
import json
import sys


def main() -> int:
    path = sys.argv[1]
    start = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else 0
    end = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else 10**9
    needle = sys.argv[4] if len(sys.argv) > 4 else ""
    pages = json.load(open(path, encoding="utf-8"))
    out = []
    for p in pages:
        if not (start <= p["index"] <= end):
            continue
        text = " ".join(" ".join(b["text"].split()) for b in p["blocks"])
        if needle and needle not in text:
            continue
        out.append(f"[{p['index']:02d}] imgs={len(p['images'])} :: {text}")
    sys.stdout.buffer.write("\n".join(out).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
