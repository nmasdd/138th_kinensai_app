"""パンフレット照合で見つかった差異を bundled JSON に反映する。

使い方: python tools/pamphlet/apply_fixes.py <bundledDir>
"""
import json
import os
import sys


def dump(path, data):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def main() -> int:
    base = sys.argv[1]
    cpath = os.path.join(base, "class-catalog.json")
    vpath = os.path.join(base, "volunteers.json")
    classes = json.load(open(cpath, encoding="utf-8"))
    vols = json.load(open(vpath, encoding="utf-8"))

    cmap = {c["id"]: c for c in classes}

    # --- クラス企画の修正 ---
    cmap["1H"]["detail"] = (
        "アムロ達ホワイトベース隊に課せられたのは東海までの避難民護送任務。君は生き延びることができるか？"
    )
    cmap["2C"]["detail"] = (
        "「皆さんに警告です。校内に爆弾を仕掛けました。条件が満たされた時爆発します。」爆弾を見つけ出せ。"
    )
    # 2F は「Club girlsnight.⋆𖤐」のみ（「美女と賭博」はパンフ非掲載）
    cmap["2F"]["title"] = "Club girlsnight.⋆𖤐"
    cmap["2F"]["detail"] = "傾国の美女と魂をかけた大博打！誇りにかけて賭博に踊れ！"

    # --- 並べ替え: 1A..2J / 3A..3J / 中学3A.. / 中学2A..（2F-2 は削除、J2F 追加） ---
    order = [c for c in classes if c["id"] != "2F-2"]
    ids = {c["id"] for c in order}

    if "J2F" not in ids:
        j2f = {
            "id": "J2F",
            "className": "中学2F",
            "title": "君の名は。〜your name〜",
            "detail": "決して出会うことはない2人。それでも俺は、私は、ずっと誰か1人を探している。",
            "place": None,
            "kind": "class",
        }
        idx = next(i for i, c in enumerate(order) if c["id"] == "J2E") + 1
        order.insert(idx, j2f)

    stalls = [
        ("3A", "単振堂", "TAKOYAKI BOYZなる東海生が計算し尽くした「単振堂」の揚げたこ焼き。「腹」を満たして、心の振幅を強め合おう。"),
        ("3B", "いま何時？クルンジ", "クロワッサンをギュッと潰してサクサク食感に！話題の韓国スイーツ「クルンジ」、香ばしい焼きたてを召し上がれ！"),
        ("3C", "これさえ食べれば桜が咲く頃には受験受かったルネードポテト", "日々受験戦争に勤しむ我々3Cがお届けする至極の一品。来年の春への希望を胸に、いただきます。"),
        ("3D", "Waffる。", "皆さんが自分でチョコやメープルシロップ、アイスなどのトッピングを決めて、好きな味でワッフルを楽しむことができます！"),
        ("3E", "麺屋ののち", "漢のロマン二郎ガツンと食べごたえ十分な東海生のこだわりの一杯、ぜひご賞味あれ #二郎だけど二浪は避けたい"),
        ("3F", "King Pro\"patty\"", "ふっくらバンズでパティを\"はさみうち\"にし、味を\"極限\"まで追求したバーガー。旨さの\"極値\"で、お客様を幸せ気分に。"),
        ("3G", "チ。-チャーハンはギョーザのついで-", "「餃子がご飯の脇役」という固定観念に挑戦。あくまで「炒飯は餃子のついで」とし、食べた者にコペルニクス的転回をもたらす。"),
        ("3H", "鳥海族", "「速い！安い！美味い！」の三拍子が揃った鳥海族が東海に出張販売！またとないこの絶好のチャンスを見逃すな！"),
        ("3I", "Baisen", "私達がこの模擬店で販売するのはチュロスです。シナモンやチョコなど、様々な味付けを楽しむことができます。"),
        ("3J", "揚げパン本仕込み", "4種類の味から選べる揚げパンと見た目もかわいいフルーツ飴の二本立て！！甘くておいしいスイーツを、ぜひご賞味あれ!!"),
    ]
    existing3 = {c["id"] for c in order}
    insert_at = next(i for i, c in enumerate(order) if c["id"] == "2J") + 1
    added = []
    for sid, title, detail in stalls:
        if sid in existing3:
            continue
        added.append(
            {
                "id": sid,
                "className": sid,
                "title": title,
                "detail": "3年模擬店。" + detail,
                "place": None,
                "kind": "class",
            }
        )
    order[insert_at:insert_at] = added

    dump(cpath, order)

    # --- 有志企画の修正 ---
    vmap = {v["id"]: v for v in vols}
    if "club-02" in vmap:
        vmap["club-02"]["className"] = "中高美術部"
    if "club-03" in vmap:
        vmap["club-03"]["description"] = "プラモデルの展示を行います。見に来てください！"
    if "club-05" in vmap:
        vmap["club-05"]["description"] = "26日13時30分から、部員による弁論を行います。ぜひお越し下さい。"
    if "club-15" in vmap:
        vmap["club-15"]["className"] = "永井抱陽写真館"
        vmap["club-15"]["projectName"] = "写真展示"
        vmap["club-15"]["place"] = "大回廊"
    if "club-25" in vmap:
        vmap["club-25"]["place"] = "放送室前"
        vmap["club-25"]["description"] = "部員が撮った写真を展示しています。お気軽にお越し下さい。"
    if "club-30" in vmap:
        vmap["club-30"]["className"] = "高校PTA"
        vmap["club-30"]["projectName"] = "ポン菓子"
        vmap["club-30"]["description"] = (
            "恒例の「ポン菓子」の配布を行います。模擬店付近で実施していますのでぜひお越しください。27日10:00～"
        )
    if "club-33" in vmap:
        vmap["club-33"]["className"] = "中学美術科"
    if "club-38" in vmap:
        vmap["club-38"]["place"] = "本館西ピロティ"
    if "club-45" in vmap:
        vmap["club-45"]["place"] = "大回廊"

    if "club-46" not in vmap:
        vols.append(
            {
                "id": "club-46",
                "className": "作品展",
                "projectName": "展示",
                "description": "夏休みの課題の展示などを行っています。生徒たちの力作をぜひご覧ください。",
                "ticketRequired": "unknown",
                "ticketTime": None,
                "kind": "volunteer",
                "place": "中学一年教室",
            }
        )
    dump(vpath, vols)
    print(f"classes={len(order)} volunteers={len(vols)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
