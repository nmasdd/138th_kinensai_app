"""申請フォーム回答 xlsx を構造化 JSON に書き出す。

使い方:
  python tools/pamphlet/export_form.py <xlsx> <out.json>
"""
import json
import sys

import openpyxl

COLS = {
    "category": 1,
    "class": 2,
    "classTitle": 3,
    "format": 4,
    "genre": 5,
    "groupName": 6,
    "schedule": 7,
    "place": 8,
    "content": 9,
    "performance": 11,
    "groupFormal": 12,
    "members": 13,
    "photoStage": 21,
    "songs": 22,
    "groupVolunteer": 26,
    "photoVolunteer": 27,
    "intro": 32,
}


def cell(row, idx):
    if idx >= len(row):
        return None
    v = row[idx]
    if v is None:
        return None
    return str(v).strip()


def main() -> int:
    xlsx = sys.argv[1]
    out = sys.argv[2]
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))[1:]
    records = []
    for i, row in enumerate(rows):
        rec = {"row": i + 2}
        for key, idx in COLS.items():
            rec[key] = cell(row, idx)
        if not any(rec[k] for k in ("category", "class", "groupName", "groupVolunteer", "groupFormal")):
            continue
        records.append(rec)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(records, fh, ensure_ascii=False, indent=1)
    print(f"records={len(records)} out={out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
