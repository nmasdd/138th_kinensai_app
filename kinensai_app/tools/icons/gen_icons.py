"""icon/logo.png からアプリアイコン (app.json) と PWA アイコン (public/) を生成する。

使い方: python tools/icons/gen_icons.py [logo.png]
既定のロゴは icon/logo.png (カレントディレクトリが kinensai_app であること)。

生成物:
  assets/images/icon.png                     1024 白背景 (Launcher / iOS / 汎用)
  assets/images/android-icon-foreground.png  1024 透過 (アダプティブ前景。セーフゾーン内に収める)
  assets/images/android-icon-background.png  1024 白 (アダプティブ背景)
  assets/images/android-icon-monochrome.png  1024 透過 + 単色シルエット (テーマアイコン)
  assets/images/splash-icon.png              1024 透過 (スプラッシュ)
  assets/images/favicon.png                    48 白背景 (Web favicon の原版)
  public/icons/icon-192.png                   192 白背景 (PWA)
  public/icons/icon-512.png                   512 白背景 (PWA)
  public/icons/maskable-512.png               512 白背景 + 余白 (maskable)
  public/apple-touch-icon.png                 180 白背景 (iOS ホーム画面)
"""
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)
INK = (26, 26, 26, 255)
NEAR_WHITE = 235


def fit(logo: Image.Image, size: int, ratio: float, background: tuple) -> Image.Image:
    """ロゴを一辺 size*ratio に収まるよう縮小し、中央に置いた正方形キャンバスを返す。"""
    canvas = Image.new("RGBA", (size, size), background)
    side = size * ratio
    scale = min(side / logo.width, side / logo.height)
    width = max(1, round(logo.width * scale))
    height = max(1, round(logo.height * scale))
    resized = logo.resize((width, height), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - width) // 2, (size - height) // 2))
    return canvas


def monochrome(logo: Image.Image, size: int, ratio: float) -> Image.Image:
    """白背景を透明に、図柄を単色 (テーマアイコン用) に置き換える。"""
    canvas = fit(logo, size, ratio, TRANSPARENT)
    pixels = canvas.load()
    for y in range(size):
        for x in range(size):
            r, g, b, a = pixels[x, y]
            if a < 10 or (r > NEAR_WHITE and g > NEAR_WHITE and b > NEAR_WHITE):
                pixels[x, y] = TRANSPARENT
            else:
                pixels[x, y] = INK
    return canvas


def save(image: Image.Image, relative_path: str) -> None:
    path = os.path.join(ROOT, relative_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path)
    print(f"{relative_path} {image.width}x{image.height}")


def main() -> int:
    logo_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "icon", "logo.png")
    logo = Image.open(logo_path).convert("RGBA")

    # アプリ本体のアイコン (app.json / expo-splash-screen が参照)
    save(fit(logo, 1024, 0.78, WHITE), "assets/images/icon.png")
    save(fit(logo, 1024, 0.62, TRANSPARENT), "assets/images/android-icon-foreground.png")
    save(Image.new("RGBA", (1024, 1024), WHITE), "assets/images/android-icon-background.png")
    save(monochrome(logo, 1024, 0.62), "assets/images/android-icon-monochrome.png")
    save(fit(logo, 1024, 0.82, TRANSPARENT), "assets/images/splash-icon.png")
    save(fit(logo, 48, 0.88, WHITE), "assets/images/favicon.png")

    # PWA (public/ は expo export で dist/ 直下にコピーされる)
    save(fit(logo, 192, 0.78, WHITE), "public/icons/icon-192.png")
    save(fit(logo, 512, 0.78, WHITE), "public/icons/icon-512.png")
    save(fit(logo, 512, 0.58, WHITE), "public/icons/maskable-512.png")
    save(fit(logo, 180, 0.80, WHITE), "public/apple-touch-icon.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
