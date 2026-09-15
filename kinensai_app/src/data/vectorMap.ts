/**
ベクターマップ用フロア幾何データ（配置修正版）。
座標系は 1000 x 700 (左上原点)。
修正方針:
- 同列の部屋は隙間なく連続配置（h=70/ステップ70、南列は y=600 h=60）。
- 廊下は必ず部屋の辺と接する（西廊下 x=220 / 北廊下 y=130 / 南廊下 y=570）。
- 1階は元図どおり: 中庭=事務室南西(中央廊下の西)、放送室=事務室真下、
  生徒会室=東中央(上に2F階段)、東中央に出口列(2F階段/出口/自販機)、
  ステージ=南東の縦長ブロック。
- 他フロアも重複解消（2階学習室、3階工作室/美術室、2階面談室など）。
ID規約: 高校HRは `1A` 形式、中学HRはカタログID (`J3A` 等)。特別教室は `club-NN`、
階段・トイレ・廊下等は `sys-*`。エレベーターは `sys-ev*` で `kind: 'elevator'` とする
(階段アイコンと混同しないため `stairs` とは区別)。
*/
export type VectorFloor = '1階' | '2階' | '3階' | '4階 5階';

/**
 * トイレの性別区分。校内マップ (`校内マップ/*.jpg`) のアイコンに対応する。
 * 男子=青 / 女子=赤 / 男女=青と赤の2色 (`kind: 'toilet'` のとき有効)。
 */
export type ToiletGender = 'male' | 'female' | 'both';

export interface VectorRoom {
  /** 展示IDまたは施設ID (階段/トイレ等は `sys-*`) */
  id: string;
  /** 短縮ラベル (マーカー内・部屋内に表示、2〜4文字推奨) */
  label: string;
  /** フルネーム */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 部屋種別 (色分け用) */
  kind: 'class' | 'jclass' | 'club' | 'corridor' | 'stairs' | 'elevator' | 'vending' | 'toilet' | 'outdoor' | 'hall';
  /** トイレの性別 (校内マップ由来の色分け・アイコン用)。`kind: 'toilet'` のとき有効 */
  gender?: ToiletGender;
}
export const VECTOR_FLOORS: VectorFloor[] = ['1階', '2階', '3階', '4階 5階'];
export const VECTOR_ROOMS: Record<VectorFloor, VectorRoom[]> = {
  "1階": [
    { id: "sys-c1n", label: "", name: "北廊下", x: 220, y: 30, w: 730, h: 30, kind: "corridor" },
    { id: "sys-c1w", label: "", name: "西廊下", x: 220, y: 60, w: 30, h: 510, kind: "corridor" },
    { id: "sys-c1e", label: "", name: "東廊下", x: 920, y: 60, w: 30, h: 310, kind: "corridor" },
    { id: "sys-c1s", label: "", name: "南廊下", x: 20, y: 570, w: 710, h: 30, kind: "corridor" },
    { id: "sys-c1sc", label: "", name: "南中央廊下 (放送室東)", x: 680, y: 180, w: 30, h: 390, kind: "corridor" },
    { id: "sys-c1se", label: "", name: "南東廊下 (出口列南)", x: 710, y: 370, w: 310, h: 30, kind: "corridor" },
    { id: "J3I", label: "3I", name: "中学3I", x: 250, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J3H", label: "3H", name: "中学3H", x: 360, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J3G", label: "3G", name: "中学3G", x: 470, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J3F", label: "3F", name: "中学3F", x: 580, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "club-22", label: "1階学習室", name: "1階学習室", x: 690, y: 60, w: 110, h: 70, kind: "club" },
    { id: "sys-t1ne", label: "", name: "北女子トイレ", x: 800, y: -30, w: 60, h: 60, kind: "toilet", gender: "female" },
    { id: "sys-s1wtop", label: "", name: "西上階段", x: 80, y: 100, w: 140, h: 50, kind: "stairs" },
    { id: "1E", label: "1E", name: "高校1E", x: 80, y: 150, w: 140, h: 70, kind: "class" },
    { id: "1F", label: "1F", name: "高校1F", x: 80, y: 220, w: 140, h: 70, kind: "class" },
    { id: "1G", label: "1G", name: "高校1G", x: 80, y: 290, w: 140, h: 70, kind: "class" },
    { id: "1H", label: "1H", name: "高校1H", x: 80, y: 360, w: 140, h: 70, kind: "class" },
    { id: "1I", label: "1I", name: "高校1I", x: 80, y: 430, w: 140, h: 70, kind: "class" },
    { id: "1J", label: "1J", name: "高校1J", x: 80, y: 500, w: 140, h: 70, kind: "class" },
    { id: "sys-t1m", label: "", name: "男子トイレ (西)", x: 250, y: 300, w: 50, h: 120, kind: "toilet", gender: "male" },
    { id: "sys-h1j", label: "事務室", name: "事務室", x: 540, y: 390, w: 140, h: 120, kind: "hall" },
    { id: "sys-h1b", label: "放送室", name: "放送室", x: 540, y: 510, w: 140, h: 60, kind: "hall" },
    { id: "sys-t1c", label: "", name: "中央トイレ", x: 360, y: 510, w: 50, h: 60, kind: "toilet", gender: "both" },
    { id: "sys-s1c", label: "", name: "中央階段", x: 300, y: 510, w: 60, h: 60, kind: "stairs" },
    { id: "sys-yard1", label: "中庭", name: "中庭", x: 410, y: 220, w: 130, h: 350, kind: "corridor" },
    { id: "sys-t1p", label: "", name: "北トイレ", x: 800, y: 60, w: 70, h: 70, kind: "toilet", gender: "female" },
    { id: "sys-s1se", label: "", name: "東階段 (生徒会室前)", x: 870, y: 60, w: 50, h: 70, kind: "stairs" },
    { id: "club-39", label: "生徒会", name: "中学生徒会室", x: 760, y: 260, w: 160, h: 90, kind: "club" },
    { id: "sys-s1e", label: "", name: "東階段", x: 710, y: 400, w: 50, h: 60, kind: "stairs" },
    { id: "sys-e1me", label: "出口", name: "中東出口", x: 760, y: 400, w: 150, h: 60, kind: "hall" },
    { id: "sys-h1vend", label: "", name: "東自販機コーナー", x: 970, y: 400, w: 50, h: 50, kind: "vending" },
    { id: "sys-ev1e", label: "", name: "東EV", x: 960, y: 330, w: 26, h: 35, kind: "elevator" },
    { id: "sys-h1kt", label: "整理券配布", name: "家庭科室", x: 80, y: 600, w: 180, h: 70, kind: "club" },
    { id: "club-29", label: "食堂", name: "食堂", x: 420, y: 700, w: 160, h: 200, kind: "outdoor" },
    { id: "sys-e1out", label: "出口", name: "南出口", x: 520, y: 600, w: 120, h: 60, kind: "hall" },
    { id: "sys-s1s", label: "", name: "南階段", x: 650, y: 600, w: 60, h: 60, kind: "stairs" },
    { id: "sys-stage", label: "ステージ", name: "ステージ (晴天時)", x: 810, y: 700, w: 160, h: 200, kind: "outdoor" },
    { id: "custom-1789345451551", label: "入口", name: "入口", x: 730, y: 530, w: 110, h: 110, kind: "hall" },
    { id: "custom-1789345598723", label: "", name: "渡り廊下", x: 430, y: 600, w: 30, h: 100, kind: "corridor" },
    { id: "custom-1789366324245", label: "", name: "生徒会廊下", x: 710, y: 180, w: 210, h: 30, kind: "corridor" },
    { id: "custom-1789366512885", label: "", name: "生徒会前階段", x: 870, y: 210, w: 50, h: 50, kind: "stairs" },
    { id: "custom-1789366895764", label: "", name: "高校ev", x: 250, y: 510, w: 50, h: 60, kind: "elevator" },
    { id: "custom-1789368013567", label: "", name: "中学階段", x: 910, y: 400, w: 60, h: 60, kind: "stairs" },
    { id: "custom-1789458959184", label: "", name: "高校自販機", x: 20, y: 600, w: 50, h: 50, kind: "vending" },
  ],
  "2階": [
    { id: "sys-c2n", label: "", name: "北廊下", x: 220, y: 30, w: 730, h: 30, kind: "corridor" },
    { id: "sys-c2w", label: "", name: "西廊下", x: 220, y: 60, w: 30, h: 510, kind: "corridor" },
    { id: "sys-c2e", label: "", name: "東廊下", x: 920, y: 60, w: 30, h: 320, kind: "corridor" },
    { id: "sys-c2s", label: "", name: "南廊下 (体育館方面)", x: 80, y: 570, w: 420, h: 30, kind: "corridor" },
    { id: "sys-h2o", label: "大回廊", name: "大回廊 (講堂・食堂方面)", x: 610, y: 690, w: 150, h: 170, kind: "corridor" },
    { id: "sys-c2ne", label: "", name: "北東廊下 (北廊下の東延長)", x: 680, y: 350, w: 240, h: 30, kind: "corridor" },
    { id: "sys-c2cn", label: "", name: "中央北廊下 ", x: 680, y: 160, w: 240, h: 30, kind: "corridor" },
    { id: "sys-c2ce", label: "", name: "職員室東廊下", x: 730, y: 380, w: 30, h: 310, kind: "corridor" },
    { id: "J3E", label: "3E", name: "中学3E", x: 250, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J3D", label: "3D", name: "中学3D", x: 360, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J3C", label: "3C", name: "中学3C", x: 470, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J3B", label: "3B", name: "中学3B", x: 580, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J3A", label: "3A", name: "中学3A", x: 690, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "sys-s2n", label: "", name: "北東階段", x: 870, y: 60, w: 50, h: 70, kind: "stairs" },
    { id: "club-20", label: "2階学習室", name: "2階学習室", x: 800, y: 60, w: 70, h: 70, kind: "club" },
    { id: "sys-s2wtop", label: "", name: "西上階段", x: 80, y: 100, w: 140, h: 50, kind: "stairs" },
    { id: "1A", label: "1A", name: "高校1A", x: 80, y: 150, w: 140, h: 70, kind: "class" },
    { id: "1B", label: "1B", name: "高校1B", x: 80, y: 220, w: 140, h: 70, kind: "class" },
    { id: "1C", label: "1C", name: "高校1C", x: 80, y: 290, w: 140, h: 70, kind: "class" },
    { id: "1D", label: "1D", name: "高校1D", x: 80, y: 360, w: 140, h: 70, kind: "class" },
    { id: "club-09", label: "201", name: "高校201補助教室", x: 80, y: 430, w: 140, h: 70, kind: "club" },
    { id: "sys-h2202", label: "整理券配布", name: "202補助教室", x: 80, y: 500, w: 140, h: 70, kind: "club" },
    { id: "sys-h2jm", label: "中学職員室", name: "中学職員室", x: 465, y: 155, w: 215, h: 130, kind: "hall" },
    { id: "sys-h2hs", label: "高校職員室", name: "高校職員室", x: 465, y: 280, w: 215, h: 150, kind: "hall" },
    { id: "club-11", label: "多目的室", name: "多目的室", x: 770, y: 240, w: 150, h: 90, kind: "club" },
    { id: "club-37", label: "中面談", name: "中学面談室", x: 760, y: 380, w: 110, h: 60, kind: "club" },
    { id: "club-17", label: "高面談", name: "高校面談室", x: 760, y: 440, w: 60, h: 95, kind: "club" },
    { id: "sys-s2e1", label: "", name: "中学階段", x: 950, y: 320, w: 50, h: 60, kind: "stairs" },
    { id: "club-28", label: "技術室", name: "技術室", x: 1000, y: 260, w: 150, h: 100, kind: "club" },
    { id: "club-01", label: "スタディーホール", name: "スタディーホール", x: 530, y: 430, w: 200, h: 160, kind: "club" },
    { id: "club-14", label: "205", name: "205補助教室", x: 530, y: 590, w: 150, h: 70, kind: "club" },
    { id: "club-10", label: "英コミュ", name: "英語コミュニケーションルーム", x: 80, y: 600, w: 75, h: 70, kind: "club" },
    { id: "club-08", label: "英リス", name: "英語リスニングルーム", x: 155, y: 600, w: 75, h: 70, kind: "club" },
    { id: "club-24", label: "203", name: "203補助教室", x: 230, y: 600, w: 110, h: 70, kind: "club" },
    { id: "club-18", label: "204", name: "204補助教室", x: 330, y: 600, w: 110, h: 70, kind: "club" },
    { id: "club-21", label: "会議室", name: "高校会議室", x: 440, y: 600, w: 60, h: 70, kind: "club" },
    { id: "sys-t2n", label: "", name: "北東男子トイレ", x: 800, y: -30, w: 60, h: 60, kind: "toilet", gender: "male" },
    { id: "sys-t2m", label: "", name: "西男子トイレ", x: 255, y: 244, w: 55, h: 76, kind: "toilet", gender: "male" },
    { id: "sys-s2wc", label: "", name: "中央西階段", x: 300, y: 510, w: 70, h: 60, kind: "stairs" },
    { id: "sys-t2m2", label: "", name: "トイレ", x: 370, y: 510, w: 50, h: 60, kind: "toilet", gender: "both" },
    { id: "sys-ev2e", label: "", name: "中学職員室前階段", x: 860, y: 190, w: 60, h: 50, kind: "stairs" },
    { id: "custom-1789265242606", label: "", name: "スタホ前廊下", x: 500, y: 430, w: 30, h: 260, kind: "corridor" },
    { id: "custom-1789265676101", label: "", name: "205廊下", x: 530, y: 660, w: 200, h: 30, kind: "corridor" },
    { id: "custom-1789368213412", label: "", name: "高校職員室前階段", x: 680, y: 380, w: 50, h: 50, kind: "stairs" },
    { id: "custom-1789368551129", label: "", name: "205階段", x: 680, y: 590, w: 50, h: 70, kind: "stairs" },
    { id: "custom-1789368836753", label: "", name: "技術室通路", x: 950, y: 290, w: 50, h: 30, kind: "corridor" },
    { id: "custom-1789458739083", label: "", name: "高校ev", x: 250, y: 510, w: 50, h: 60, kind: "elevator" },
    { id: "custom-1789458858671", label: "", name: "中学ev", x: 950, y: 240, w: 50, h: 50, kind: "elevator" },
  ],
  "3階": [
    { id: "sys-c3n", label: "", name: "北廊下", x: 220, y: 30, w: 660, h: 30, kind: "corridor" },
    { id: "sys-c3w", label: "", name: "西廊下", x: 220, y: 60, w: 30, h: 510, kind: "corridor" },
    { id: "sys-c3e", label: "", name: "東廊下", x: 850, y: 60, w: 30, h: 450, kind: "corridor" },
    { id: "sys-c3s", label: "", name: "南廊下", x: 80, y: 570, w: 520, h: 30, kind: "corridor" },
    { id: "J2I", label: "2I", name: "中学2I", x: 250, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J2H", label: "2H", name: "中学2H", x: 360, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J2G", label: "2G", name: "中学2G", x: 470, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "J2F", label: "2F", name: "中学2F", x: 580, y: 60, w: 110, h: 70, kind: "jclass" },
    { id: "club-36", label: "3階学習室", name: "3階学習室", x: 690, y: 60, w: 110, h: 70, kind: "club" },
    { id: "sys-s3wtop", label: "", name: "西上階段", x: 80, y: 100, w: 140, h: 50, kind: "stairs" },
    { id: "2A", label: "2A", name: "高校2A", x: 80, y: 150, w: 140, h: 70, kind: "class" },
    { id: "2B", label: "2B", name: "高校2B", x: 80, y: 220, w: 140, h: 70, kind: "class" },
    { id: "2C", label: "2C", name: "高校2C", x: 80, y: 290, w: 140, h: 70, kind: "class" },
    { id: "2D", label: "2D", name: "高校2D", x: 80, y: 360, w: 140, h: 70, kind: "class" },
    { id: "2E", label: "2E", name: "高校2E", x: 80, y: 430, w: 140, h: 70, kind: "class" },
    { id: "2F", label: "2F", name: "高校2F", x: 80, y: 500, w: 140, h: 70, kind: "class" },
    { id: "J2E", label: "2E", name: "中学2E", x: 720, y: 160, w: 130, h: 70, kind: "jclass" },
    { id: "J2D", label: "2D", name: "中学2D", x: 720, y: 230, w: 130, h: 70, kind: "jclass" },
    { id: "J2C", label: "2C", name: "中学2C", x: 720, y: 300, w: 130, h: 70, kind: "jclass" },
    { id: "J2B", label: "2B", name: "中学2B", x: 720, y: 370, w: 130, h: 70, kind: "jclass" },
    { id: "J2A", label: "2A", name: "中学2A", x: 720, y: 440, w: 130, h: 70, kind: "jclass" },
    { id: "club-02", label: "工作室", name: "工作室", x: 930, y: 450, w: 80, h: 60, kind: "club" },
    { id: "club-33", label: "美術室", name: "美術室", x: 1010, y: 400, w: 140, h: 100, kind: "club" },
    { id: "sys-s3c", label: "階段", name: "中央階段", x: 300, y: 510, w: 80, h: 60, kind: "stairs" },
    { id: "sys-h3301", label: "整理券配布", name: "301補助教室", x: 470, y: 510, w: 130, h: 60, kind: "club" },
    { id: "2G", label: "2G", name: "高校2G", x: 80, y: 600, w: 130, h: 60, kind: "class" },
    { id: "2H", label: "2H", name: "高校2H", x: 210, y: 600, w: 130, h: 60, kind: "class" },
    { id: "2I", label: "2I", name: "高校2I", x: 340, y: 600, w: 130, h: 60, kind: "class" },
    { id: "2J", label: "2J", name: "高校2J", x: 470, y: 600, w: 130, h: 60, kind: "class" },
    { id: "sys-t3n", label: "", name: "北東男子トイレ", x: 780, y: -30, w: 80, h: 60, kind: "toilet", gender: "male" },
    { id: "sys-t3m", label: "", name: "西男子トイレ", x: 250, y: 320, w: 80, h: 100, kind: "toilet", gender: "male" },
    { id: "sys-s3n", label: "", name: "北東階段", x: 800, y: 60, w: 50, h: 70, kind: "stairs" },
    { id: "sys-ev3w", label: "", name: "中央EV", x: 250, y: 510, w: 50, h: 60, kind: "elevator" },
    { id: "sys-ev3e", label: "", name: "東EV", x: 880, y: 370, w: 50, h: 50, kind: "elevator" },
    { id: "custom-1789367772251", label: "", name: "美術室廊下", x: 880, y: 420, w: 130, h: 30, kind: "corridor" },
    { id: "custom-1789367889099", label: "", name: "中学階段", x: 880, y: 450, w: 50, h: 60, kind: "stairs" },
  ],
  "4階 5階": [
    { id: "sys-c45n", label: "", name: "北廊下", x: 220, y: 30, w: 660, h: 30, kind: "corridor" },
    { id: "sys-c45w", label: "", name: "西廊下", x: 220, y: 60, w: 30, h: 70, kind: "corridor" },
    { id: "sys-c45e", label: "", name: "東廊下", x: 850, y: 60, w: 30, h: 450, kind: "corridor" },
    { id: "J1I", label: "1I", name: "中学1I", x: 250, y: 60, w: 110, h: 70, kind: "class" },
    { id: "J1H", label: "1H", name: "中学1H", x: 360, y: 60, w: 110, h: 70, kind: "class" },
    { id: "J1G", label: "1G", name: "中学1G", x: 470, y: 60, w: 110, h: 70, kind: "class" },
    { id: "J1F", label: "1F", name: "中学1F", x: 580, y: 60, w: 110, h: 70, kind: "class" },
    { id: "club-32", label: "4階学習室", name: "4階学習室", x: 690, y: 60, w: 110, h: 70, kind: "club" },
    { id: "J1E", label: "1E", name: "中学1E", x: 710, y: 160, w: 140, h: 70, kind: "class" },
    { id: "J1D", label: "1D", name: "中学1D", x: 710, y: 230, w: 140, h: 70, kind: "class" },
    { id: "J1C", label: "1C", name: "中学1C", x: 710, y: 300, w: 140, h: 70, kind: "class" },
    { id: "J1B", label: "1B", name: "中学1B", x: 710, y: 370, w: 140, h: 70, kind: "class" },
    { id: "J1A", label: "1A", name: "中学1A", x: 710, y: 440, w: 140, h: 70, kind: "class" },
    { id: "sys-h45art", label: "美術室", name: "高校美術室", x: 930, y: 390, w: 150, h: 100, kind: "hall" },
    { id: "club-44", label: "音楽室", name: "高校音楽室", x: 310, y: 300, w: 160, h: 140, kind: "club" },
    { id: "sys-h5b", label: "", name: "5F教室B", x: 310, y: 500, w: 130, h: 90, kind: "hall" },
    { id: "sys-h5d", label: "", name: "5F教室D", x: 310, y: 440, w: 130, h: 60, kind: "hall" },
    { id: "sys-t45n", label: "", name: "北東男子トイレ", x: 720, y: -30, w: 100, h: 60, kind: "toilet", gender: "male" },
    { id: "sys-t45s", label: "", name: "5Fトイレ", x: 470, y: 530, w: 50, h: 50, kind: "toilet", gender: "male" },
    { id: "sys-s45n", label: "", name: "北東階段", x: 800, y: 60, w: 50, h: 70, kind: "stairs" },
    { id: "sys-s45w", label: "", name: "西階段 (この階まで・立入禁止)", x: 120, y: 80, w: 100, h: 50, kind: "stairs" },
    { id: "sys-s45e", label: "", name: "中学階段", x: 880, y: 450, w: 50, h: 60, kind: "stairs" },
    { id: "sys-s45s", label: "", name: "5F階段", x: 470, y: 580, w: 50, h: 50, kind: "stairs" },
    { id: "sys-ev45e", label: "", name: "東EV", x: 880, y: 370, w: 50, h: 50, kind: "elevator" },
    { id: "custom-1789369960862", label: "", name: "美術通路", x: 880, y: 420, w: 50, h: 30, kind: "corridor" },
    { id: "custom-1789456687859", label: "", name: "5階廊下", x: 440, y: 440, w: 30, h: 190, kind: "corridor" },
    { id: "custom-1789456922538", label: "", name: "5階ev", x: 470, y: 480, w: 50, h: 50, kind: "elevator" },
  ],
};

/**
 * ベクター図に重ねる注記 (部屋とは独立した案内要素)。
 * 座標系は部屋と同じ 1000 x 700 のワールド座標 (x,y は中心位置)。
 * パンフレット原図 (校内マップ/ の 4.5階 図) の注記を写したもの。
 * - badge: 階を示す丸バッジ (4F/5F)
 * - label: 短い文字ラベル (中学校舎・この階まで・立入禁止)
 * - note : 補足の注意書き
 * `tone: "danger"` は警告表示 (立入禁止など) で赤系にする。
 *
 * この定義は管理者の「配置を保存」で `metro.config.js` の
 * `buildAnnotationsLiteral` が生成し直すため、各要素は1行1件で保つこと
 * (コメントはここより下に書かない)。
 */
export interface VectorAnnotation {
  kind: 'badge' | 'label' | 'note';
  text: string;
  x: number;
  y: number;
  tone?: 'normal' | 'danger';
}

export const VECTOR_ANNOTATIONS: Partial<Record<VectorFloor, VectorAnnotation[]>> = {
  "1階": [
    { kind: "badge", text: "1F", x: 160, y: 780 },
  ],
  "2階": [
    { kind: "badge", text: "2F", x: 966, y: 538 },
    { kind: "label", text: "至 講堂 明照殿 百志館", x: 680, y: 870 },
  ],
  "3階": [
    { kind: "badge", text: "3F", x: 150, y: -50 },
  ],
  "4階 5階": [
    { kind: "badge", text: "4F", x: 975, y: 125 },
    { kind: "badge", text: "5F", x: 220, y: 320 },
  ],
};

/** 部屋種別ごとの塗り色 (M3ロール由来の淡色で統一) */
export const ROOM_FILL: Record<VectorRoom['kind'], string> = {
  class: '#FFDBCA', // 高校教室 (primaryContainer)
  jclass: '#BBDEFB', // 中学教室 (淡青。高校教室と区別するため)
  club: '#FED8B7', // secondaryContainer
  corridor: '#FFFFFF', // 通路は白 (原図どおり。背景 #E7E2DD と区別するため)
  stairs: '#FFE3C2', // tertiaryContainer
  elevator: '#FFE3C2', // EVも階段系の淡色 (アイコンで階段と区別)
  vending: '#F8F3EE', // 自販機コーナー (hall系の淡色、アイコンで識別)
  toilet: '#D3E8F5', // 性別未設定のトイレ (gender があれば TOILET_FILL を使う)
  outdoor: '#D9F2D0', // 中庭・屋外 (緑系の淡色、M3外だが図示専用)
  hall: '#F8F3EE', // surfaceContainerLow
};

/**
 * トイレ区分ごとの塗り色 (校内マップのアイコン色に対応)。
 * 男子=青 / 女子=赤。男女 (`both`) は2色で描くため描画側で塗り分ける。
 */
export const TOILET_FILL: Record<'male' | 'female', string> = {
  male: '#2078BF',
  female: '#D93025',
};

/** トイレ区分の凡例ラベル。 */
export const TOILET_GENDER_LABEL: Record<ToiletGender, string> = {
  male: '男子トイレ',
  female: '女子トイレ',
  both: '男女トイレ',
};

/**
 * 部屋名からトイレ区分を推定する。
 * `gender` を持たない既存の管理者上書き (`map-layout.json`) のフォールバック用。
 */
export function inferToiletGender(name: string): ToiletGender | undefined {
  if (/男女|だれでも|誰でも|多目的/.test(name)) return 'both';
  if (/女子|女性/.test(name)) return 'female';
  if (/男子|男性/.test(name)) return 'male';
  return undefined;
}
