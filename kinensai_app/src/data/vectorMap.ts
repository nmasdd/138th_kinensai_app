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
  kind: 'class' | 'club' | 'corridor' | 'stairs' | 'elevator' | 'vending' | 'toilet' | 'outdoor' | 'hall';
}
export const VECTOR_FLOORS: VectorFloor[] = ['1階', '2階', '3階', '4階 5階'];
export const VECTOR_ROOMS: Record<VectorFloor, VectorRoom[]> = {
  // ── 1階 ──
  '1階': [
    // 廊下 (背景・タップ不可。先に描画されるよう先頭に置く)
    { id: 'sys-c1n', label: '', name: '北廊下', x: 220, y: 30, w: 730, h: 30, kind: 'corridor' },
    { id: 'sys-c1w', label: '', name: '西廊下', x: 220, y: 60, w: 30, h: 510, kind: 'corridor' },
    { id: 'sys-c1e', label: '', name: '東廊下', x: 920, y: 60, w: 30, h: 310, kind: 'corridor' },
    { id: 'sys-c1s', label: '', name: '南廊下', x: 80, y: 570, w: 550, h: 30, kind: 'corridor' },
    { id: 'sys-c1sc', label: '', name: '南中央廊下 (放送室東)', x: 570, y: 370, w: 30, h: 200, kind: 'corridor' },
    { id: 'sys-c1se', label: '', name: '南東廊下 (出口列南)', x: 600, y: 370, w: 420, h: 30, kind: 'corridor' },
    // 北列 (中学3年F〜I + 1階学習室)
    { id: 'J3I', label: '3I', name: '中学3I', x: 250, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J3H', label: '3H', name: '中学3H', x: 360, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J3G', label: '3G', name: '中学3G', x: 470, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J3F', label: '3F', name: '中学3F', x: 580, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'club-22', label: '1学', name: '1階学習室', x: 690, y: 60, w: 110, h: 70, kind: 'club' },
    { id: 'sys-t1ne', label: '', name: '北女子トイレ', x: 800, y: -30, w: 60, h: 60, kind: 'toilet' },
    // 西列 (高校1E〜1J)
    { id: 'sys-s1wtop', label: '', name: '西上階段', x: 80, y: 100, w: 140, h: 50, kind: 'stairs' },
    { id: '1E', label: '1E', name: '高校1E', x: 80, y: 150, w: 140, h: 70, kind: 'class' },
    { id: '1F', label: '1F', name: '高校1F', x: 80, y: 220, w: 140, h: 70, kind: 'class' },
    { id: '1G', label: '1G', name: '高校1G', x: 80, y: 290, w: 140, h: 70, kind: 'class' },
    { id: '1H', label: '1H', name: '高校1H', x: 80, y: 360, w: 140, h: 70, kind: 'class' },
    { id: '1I', label: '1I', name: '高校1I', x: 80, y: 430, w: 140, h: 70, kind: 'class' },
    { id: '1J', label: '1J', name: '高校1J', x: 80, y: 500, w: 140, h: 70, kind: 'class' },
    // 中央 (男子トイレ・事務室・放送室・中庭)
    { id: 'sys-t1m', label: 'WC', name: '男子トイレ (西)', x: 250, y: 300, w: 50, h: 120, kind: 'toilet' },
    { id: 'sys-h1j', label: '事務室', name: '事務室', x: 430, y: 390, w: 140, h: 120, kind: 'hall' },
    { id: 'sys-h1b', label: '放送室', name: '放送室', x: 430, y: 510, w: 140, h: 60, kind: 'hall' },
    { id: 'sys-t1c', label: 'WC', name: '中央トイレ', x: 250, y: 510, w: 50, h: 60, kind: 'toilet' },
    { id: 'sys-s1c', label: '階段', name: '中央階段', x: 250, y: 450, w: 50, h: 60, kind: 'stairs' },
    { id: 'sys-yard1', label: '中庭', name: '中庭', x: 300, y: 220, w: 130, h: 350, kind: 'corridor' },
    { id: 'sys-t1p', label: '', name: '中庭前トイレ', x: 800, y: 60, w: 70, h: 70, kind: 'toilet' }, //北廊下トイレに名前変更
    // 東中央 (生徒会室 + 出口列)
    { id: 'sys-s1se', label: '2F', name: '東階段 (生徒会室前)', x: 870, y: 60, w: 50, h: 70, kind: 'stairs' },
    { id: 'club-39', label: '生徒会', name: '中学生徒会室', x: 760, y: 220, w: 160, h: 90, kind: 'club' },
    { id: 'sys-s1e', label: '2F', name: '東階段 (2Fへ)', x: 600, y: 400, w: 40, h: 50, kind: 'stairs' },
    { id: 'sys-e1me', label: '出口', name: '中東出口', x: 640, y: 400, w: 150, h: 60, kind: 'hall' },
    { id: 'sys-h1vend', label: '', name: '東自販機コーナー', x: 970, y: 400, w: 50, h: 50, kind: 'vending' },
    { id: 'sys-ev1e', label: '', name: '東EV', x: 960, y: 330, w: 26, h: 35, kind: 'elevator' },
    // 南列 (家庭科室・食堂・出口・南階段) + 南東ステージ
    { id: 'club-03', label: '家庭科', name: '家庭科室', x: 80, y: 600, w: 180, h: 60, kind: 'club' },
    { id: 'club-29', label: '食堂', name: '食堂', x: 340, y: 600, w: 130, h: 60, kind: 'club' },
    { id: 'sys-e1out', label: '出口', name: '南出口', x: 470, y: 600, w: 120, h: 60, kind: 'hall' },
    { id: 'sys-s1s', label: '2F', name: '南階段 (2Fへ)', x: 590, y: 600, w: 60, h: 60, kind: 'stairs' },
    { id: 'club-27', label: 'ステージ', name: 'ステージ (晴天時)', x: 800, y: 600, w: 160, h: 190, kind: 'outdoor' },
  ],
  // ── 2階 (西列・北列のクラスは1階と同形式。西列は階段50+教室70の連続配置、
  // 北列は y=60 h=70 の連続配置。5室のため幅のみ90に圧縮) ──
  '2階': [
    // 廊下 (背景・タップ不可。先に描画されるよう先頭に置く)
    { id: 'sys-c2n', label: '', name: '北廊下', x: 220, y: 30, w: 730, h: 30, kind: 'corridor' },
    { id: 'sys-c2w', label: '', name: '西廊下', x: 220, y: 60, w: 30, h: 510, kind: 'corridor' },
    { id: 'sys-c2e', label: '', name: '東廊下', x: 920, y: 60, w: 30, h: 310, kind: 'corridor' },
    { id: 'sys-c2s', label: '', name: '南廊下 (体育館方面)', x: 130, y: 480, w: 380, h: 30, kind: 'corridor' },
    { id: 'sys-h2o', label: '大回廊', name: '大回廊 (講堂・食堂方面)', x: 690, y: 700, w: 40, h: 150, kind: 'corridor' },
    { id: 'sys-c2ne', label: '', name: '北東廊下 (北廊下の東延長)', x: 680, y: 350, w: 210, h: 30, kind: 'corridor' }, //高校職員室前廊下に名前変更
    { id: 'sys-c2cn', label: '', name: '中央北廊下 (トイレ列北)', x: 680, y: 180, w: 150, h: 30, kind: 'corridor' }, //中学職員室前廊下に名前変更
    { id: 'sys-c2ce', label: '', name: '職員室東廊下', x: 700, y: 380, w: 30, h: 257, kind: 'corridor' },
    //{ id: 'sys-c2se', label: '', name: 'スタディーホール東廊下', x: 700, y: 430, w: 30, h: 135, kind: 'corridor' },
    //{ id: 'sys-c2s2', label: '', name: '205南廊下 (大回廊方面)', x: 510, y: 565, w: 320, h: 30, kind: 'corridor' },
    //{ id: 'sys-c2te', label: '', name: '技術室西廊下', x: 800, y: 420, w: 30, h: 145, kind: 'corridor' },
    // 北列 (中学3年A〜E。1階北列と同形式 y=60 h=70 の連続配置)
    { id: 'J3E', label: '3E', name: '中学3E', x: 250, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J3D', label: '3D', name: '中学3D', x: 360, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J3C', label: '3C', name: '中学3C', x: 470, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J3B', label: '3B', name: '中学3B', x: 580, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J3A', label: '3A', name: '中学3A', x: 690, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'sys-s2n', label: '', name: '北東階段', x: 800, y: 45, w: 50, h: 55, kind: 'stairs' },
    { id: 'club-20', label: '2学', name: '2階学習室', x: 830, y: 100, w: 100, h: 60, kind: 'club' },
    // 西列 (高校1A〜1D + 201。1階西列と同一形状 x=80 w=140・階段50+教室70の連続配置。
    // 202は南列先頭へ移動し、南列は202+5室の連続配置に組み替え)
    { id: 'sys-s2wtop', label: '', name: '西上階段', x: 80, y: 100, w: 140, h: 50, kind: 'stairs' },
    { id: '1A', label: '1A', name: '高校1A', x: 80, y: 150, w: 140, h: 70, kind: 'class' },
    { id: '1B', label: '1B', name: '高校1B', x: 80, y: 220, w: 140, h: 70, kind: 'class' },
    { id: '1C', label: '1C', name: '高校1C', x: 80, y: 290, w: 140, h: 70, kind: 'class' },
    { id: '1D', label: '1D', name: '高校1D', x: 80, y: 360, w: 140, h: 70, kind: 'class' },
    { id: 'club-09', label: '201', name: '高校201補助教室', x: 80, y: 430, w: 140, h: 70, kind: 'club' },
    { id: 'sys-h2202', label: '202', name: '202補助教室', x: 130, y: 515, w: 140, h: 70, kind: 'hall' },
    // 中央 (職員室)
    { id: 'sys-h2jm', label: '中学職員室', name: '中学職員室', x: 465, y: 175, w: 215, h: 130, kind: 'hall' },
    { id: 'sys-h2hs', label: '高校職員室', name: '高校職員室', x: 465, y: 300, w: 215, h: 130, kind: 'hall' },
    // 東 (多目的室・面談室・技術室)
    { id: 'club-11', label: '多目的', name: '多目的室', x: 745, y: 215, w: 65, h: 95, kind: 'club' },
    { id: 'club-37', label: '中面談', name: '中学面談室', x: 730, y: 380, w: 110, h: 60, kind: 'club' },
    { id: 'club-17', label: '高面談', name: '高校面談室', x: 730, y: 440, w: 60, h: 95, kind: 'club' },
    { id: 'sys-s2e1', label: '', name: '東階段 (1Fへ)', x: 840, y: 380, w: 50, h: 50, kind: 'stairs' },
    { id: 'club-28', label: '技術室', name: '技術室', x: 890, y: 345, w: 100, h: 100, kind: 'club' },
    // 中央南 (スタディーホール・205)
    { id: 'club-01', label: 'スタディーホール', name: 'スタディーホール', x: 510, y: 430, w: 190, h: 80, kind: 'club' },
    { id: 'club-14', label: '205', name: '205補助教室', x: 530, y: 515, w: 110, h: 50, kind: 'club' },
    { id: 'sys-s2s', label: '1F', name: '南階段 (1Fへ)', x: 640, y: 515, w: 50, h: 50, kind: 'stairs' },
    // 南列 (202・英語2室・203・204・会議室の連続配置 ※原図どおり西側にまとめる)
    { id: 'club-10', label: '英コミュ', name: '英語コミュニケーションルーム', x: 200, y: 515, w: 68, h: 50, kind: 'club' },
    { id: 'club-08', label: '英リス', name: '英語リスニングルーム', x: 268, y: 515, w: 68, h: 50, kind: 'club' },
    { id: 'club-24', label: '203', name: '203補助教室', x: 336, y: 515, w: 68, h: 50, kind: 'club' },
    { id: 'club-18', label: '204', name: '204補助教室', x: 404, y: 515, w: 68, h: 50, kind: 'club' },
    { id: 'club-21', label: '会議室', name: '高校会議室', x: 472, y: 515, w: 58, h: 50, kind: 'club' },
    // トイレ・EV
    { id: 'sys-t2n', label: '', name: '北東男子トイレ', x: 745, y: 15, w: 105, h: 30, kind: 'toilet' },
    { id: 'sys-t2m', label: 'WC', name: '西男子トイレ', x: 255, y: 244, w: 55, h: 76, kind: 'toilet' },
    { id: 'sys-t2w', label: 'WC', name: '南西トイレ (多目的)', x: 255, y: 375, w: 30, h: 55, kind: 'toilet' },
    { id: 'sys-s2wc', label: '', name: '中央西階段', x: 285, y: 375, w: 70, h: 55, kind: 'stairs' },
    { id: 'sys-t2f', label: '', name: '南女子トイレ', x: 355, y: 375, w: 35, h: 55, kind: 'toilet' },
    { id: 'sys-t2m2', label: '', name: '南男子トイレ', x: 390, y: 375, w: 35, h: 55, kind: 'toilet' },
    { id: 'sys-ev2e', label: '', name: '東EV', x: 850, y: 290, w: 25, h: 35, kind: 'stairs' },
  ],
  // ── 3階 ──
  '3階': [
    { id: 'sys-c3n', label: '', name: '北廊下', x: 220, y: 130, w: 670, h: 30, kind: 'corridor' },
    { id: 'sys-c3w', label: '', name: '西廊下', x: 220, y: 160, w: 30, h: 410, kind: 'corridor' },
    { id: 'sys-c3e', label: '', name: '東廊下', x: 670, y: 130, w: 30, h: 440, kind: 'corridor' },
    { id: 'sys-c3s', label: '', name: '南廊下', x: 80, y: 570, w: 520, h: 30, kind: 'corridor' },
    // 北列 (中学2I,2H,2G,2F + 3階学習室)
    { id: 'J2I', label: '2I', name: '中学2I', x: 250, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J2H', label: '2H', name: '中学2H', x: 360, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J2G', label: '2G', name: '中学2G', x: 470, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J2F', label: '2F', name: '中学2F', x: 580, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'club-36', label: '3学', name: '3階学習室', x: 690, y: 60, w: 110, h: 70, kind: 'club' },
    // 西列 (高校2A〜2F)
    { id: 'sys-s3wtop', label: '', name: '西上階段', x: 80, y: 80, w: 140, h: 50, kind: 'stairs' },
    { id: '2A', label: '2A', name: '高校2A', x: 80, y: 150, w: 140, h: 70, kind: 'class' },
    { id: '2B', label: '2B', name: '高校2B', x: 80, y: 220, w: 140, h: 70, kind: 'class' },
    { id: '2C', label: '2C', name: '高校2C', x: 80, y: 290, w: 140, h: 70, kind: 'class' },
    { id: '2D', label: '2D', name: '高校2D', x: 80, y: 360, w: 140, h: 70, kind: 'class' },
    { id: '2E', label: '2E', name: '高校2E', x: 80, y: 430, w: 140, h: 70, kind: 'class' },
    { id: '2F', label: '2F', name: '高校2F', x: 80, y: 500, w: 140, h: 70, kind: 'class' },
    // 東列 (中学2E〜2A)
    { id: 'J2E', label: '2E', name: '中学2E', x: 700, y: 160, w: 130, h: 70, kind: 'class' },
    { id: 'J2D', label: '2D', name: '中学2D', x: 700, y: 230, w: 130, h: 70, kind: 'class' },
    { id: 'J2C', label: '2C', name: '中学2C', x: 700, y: 300, w: 130, h: 70, kind: 'class' },
    { id: 'J2B', label: '2B', name: '中学2B', x: 700, y: 370, w: 130, h: 70, kind: 'class' },
    { id: 'J2A', label: '2A', name: '中学2A', x: 700, y: 440, w: 130, h: 70, kind: 'class' },
    // 東 (工作室・美術室)
    { id: 'club-02', label: '工作室', name: '工作室', x: 840, y: 370, w: 60, h: 60, kind: 'club' },
    { id: 'club-33', label: '美術室', name: '美術室', x: 900, y: 370, w: 100, h: 60, kind: 'club' },
    // 中央南 (301補助教室)
    { id: 'sys-t3c', label: 'WC', name: '中央トイレ', x: 250, y: 420, w: 30, h: 40, kind: 'toilet' },
    { id: 'sys-s3c', label: '階段', name: '中央階段', x: 280, y: 420, w: 50, h: 60, kind: 'stairs' },
    { id: 'sys-h3301', label: '301', name: '301補助教室', x: 330, y: 420, w: 100, h: 60, kind: 'hall' },
    // 南列 (高校2G〜2J)
    { id: '2G', label: '2G', name: '高校2G', x: 80, y: 600, w: 130, h: 60, kind: 'class' },
    { id: '2H', label: '2H', name: '高校2H', x: 210, y: 600, w: 130, h: 60, kind: 'class' },
    { id: '2I', label: '2I', name: '高校2I', x: 340, y: 600, w: 130, h: 60, kind: 'class' },
    { id: '2J', label: '2J', name: '高校2J', x: 470, y: 600, w: 130, h: 60, kind: 'class' },
    // トイレ・階段・EV
    { id: 'sys-t3n', label: '', name: '北東男子トイレ', x: 740, y: 20, w: 100, h: 40, kind: 'toilet' },
    { id: 'sys-t3m', label: 'WC', name: '西男子トイレ', x: 250, y: 300, w: 80, h: 100, kind: 'toilet' },
    { id: 'sys-s3n', label: '', name: '北東階段', x: 855, y: 60, w: 35, h: 70, kind: 'stairs' },
    { id: 'sys-ev3w', label: '', name: '中央EV', x: 250, y: 460, w: 30, h: 25, kind: 'elevator' },
    { id: 'sys-ev3e', label: '', name: '東EV', x: 860, y: 300, w: 30, h: 35, kind: 'elevator' },
  ],
  // ── 4階 5階 ──
  '4階 5階': [
    { id: 'sys-c45n', label: '', name: '北廊下', x: 220, y: 130, w: 670, h: 30, kind: 'corridor' },
    { id: 'sys-c45w', label: '', name: '西廊下 (立入禁止手前まで)', x: 220, y: 130, w: 30, h: 80, kind: 'corridor' },
    { id: 'sys-c45e', label: '', name: '東廊下', x: 840, y: 130, w: 30, h: 330, kind: 'corridor' },
    // 北列 (中学1I,1H,1G,1F + 4階学習室)
    { id: 'J1I', label: '1I', name: '中学1I', x: 250, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J1H', label: '1H', name: '中学1H', x: 360, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J1G', label: '1G', name: '中学1G', x: 470, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'J1F', label: '1F', name: '中学1F', x: 580, y: 60, w: 110, h: 70, kind: 'class' },
    { id: 'club-32', label: '4学', name: '4階学習室', x: 690, y: 60, w: 110, h: 70, kind: 'club' },
    // 東列 (中学1E〜1A)
    { id: 'J1E', label: '1E', name: '中学1E', x: 700, y: 160, w: 140, h: 70, kind: 'class' },
    { id: 'J1D', label: '1D', name: '中学1D', x: 700, y: 230, w: 140, h: 70, kind: 'class' },
    { id: 'J1C', label: '1C', name: '中学1C', x: 700, y: 300, w: 140, h: 70, kind: 'class' },
    { id: 'J1B', label: '1B', name: '中学1B', x: 700, y: 370, w: 140, h: 70, kind: 'class' },
    { id: 'J1A', label: '1A', name: '中学1A', x: 700, y: 440, w: 140, h: 70, kind: 'class' },
    // 東 (高校美術室)
    { id: 'sys-h45art', label: '美術室', name: '高校美術室', x: 870, y: 380, w: 110, h: 80, kind: 'hall' },
    // 中央塔 (高校音楽室 + 5F白教室群)
    { id: 'club-44', label: '音楽室', name: '高校音楽室', x: 420, y: 200, w: 160, h: 140, kind: 'club' },
    { id: 'sys-h5a', label: '', name: '5F教室A', x: 420, y: 340, w: 70, h: 80, kind: 'hall' },
    { id: 'sys-h5b', label: '', name: '5F教室B', x: 490, y: 340, w: 90, h: 80, kind: 'hall' },
    { id: 'sys-h5c', label: '', name: '5F教室C', x: 420, y: 420, w: 70, h: 60, kind: 'hall' },
    { id: 'sys-h5d', label: '', name: '5F教室D', x: 490, y: 420, w: 90, h: 60, kind: 'hall' },
    // トイレ・階段・EV
    { id: 'sys-t45n', label: '', name: '北東男子トイレ', x: 740, y: 20, w: 100, h: 40, kind: 'toilet' },
    { id: 'sys-t45s', label: '', name: '5Fトイレ', x: 480, y: 480, w: 40, h: 40, kind: 'toilet' },
    { id: 'sys-s45n', label: '', name: '北東階段', x: 865, y: 60, w: 35, h: 70, kind: 'stairs' },
    { id: 'sys-s45w', label: '立入禁止', name: '西階段 (この階まで・立入禁止)', x: 120, y: 170, w: 100, h: 40, kind: 'stairs' },
    { id: 'sys-s45e', label: '', name: '美術室前階段', x: 840, y: 460, w: 30, h: 50, kind: 'stairs' },
    { id: 'sys-s45s', label: '', name: '5F階段', x: 420, y: 480, w: 55, h: 40, kind: 'stairs' },
    { id: 'sys-ev45e', label: '', name: '東EV', x: 844, y: 300, w: 24, h: 35, kind: 'elevator' },
  ],
};
/** 部屋種別ごとの塗り色 (M3ロール由来の淡色で統一) */
export const ROOM_FILL: Record<VectorRoom['kind'], string> = {
  class: '#FFDBCA', // primaryContainer
  club: '#FED8B7', // secondaryContainer
  corridor: '#FFFFFF', // 通路は白 (原図どおり。背景 #E7E2DD と区別するため)
  stairs: '#FFE3C2', // tertiaryContainer
  elevator: '#FFE3C2', // EVも階段系の淡色 (アイコンで階段と区別)
  vending: '#F8F3EE', // 自販機コーナー (hall系の淡色、アイコンで識別)
  toilet: '#D3E8F5', // 水回りは淡青 (白廊下・灰背景のどちらとも区別するため)
  outdoor: '#D9F2D0', // 中庭・屋外 (緑系の淡色、M3外だが図示専用)
  hall: '#F8F3EE', // surfaceContainerLow
};