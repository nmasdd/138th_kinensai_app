"""パンフレットのクラス企画「整理券 有/無」バッジから bundled/tickets.json を生成する。

- 整理券「有」のクラス: 1B, 1D, 1F, 1G, 1H, 1J, 2A, 2G, 2H, 2J
- それ以外のクラス（中学・高校3年模擬店を含む）と有志企画: 「不要」
使い方: python tools/pamphlet/gen_tickets.py <bundledDir>
"""
import json
import os
import sys

REQUIRED = {"1B", "1D", "1F", "1G", "1H", "1J", "2A", "2G", "2H", "2J"}


def main() -> int:
    base = sys.argv[1]
    classes = json.load(open(os.path.join(base, "class-catalog.json"), encoding="utf-8"))
    vols = json.load(open(os.path.join(base, "volunteers.json"), encoding="utf-8"))
    out = {}
    for c in classes:
        out[c["id"]] = {"required": "required" if c["id"] in REQUIRED else "none"}
    for v in vols:
        out[v["id"]] = {"required": "none"}
    with open(os.path.join(base, "tickets.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    req = sorted(k for k, v in out.items() if v["required"] == "required")
    print(f"entries={len(out)} required={len(req)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
