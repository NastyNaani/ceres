"""Export Play Store + Expo assets from generated masters."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BRAND = ROOT / "brand"
STORE = ROOT / "store"
CACHE = Path(r"C:\Users\rolvin\.cursor\projects\e-Ceres\assets")

ICON_CANDIDATES = [
    CACHE / "ceres-app-icon-master.png",
    CACHE / "ceres-premium-logo.png",
    BRAND / "app-icon.png",
    ASSETS / "icon.png",
]

FEATURE_SRC = CACHE / "ceres-play-feature.png"
SHOTS = [
    ("ceres-shot-scan.png", "play-screenshot-01-scan.png"),
    ("ceres-shot-verdict.png", "play-screenshot-02-verdict.png"),
    ("ceres-shot-history.png", "play-screenshot-03-history.png"),
]


def load_square(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    side = min(w, h)
    return im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))


def fit(im: Image.Image, size: tuple[int, int], fill=(6, 7, 8, 255)) -> Image.Image:
    return ImageOps.contain(im.convert("RGBA"), size).convert("RGBA")


def canvas_paste(im: Image.Image, size: tuple[int, int], fill=(6, 7, 8, 255)) -> Image.Image:
    fitted = ImageOps.contain(im.convert("RGBA"), size)
    out = Image.new("RGBA", size, fill)
    out.paste(fitted, ((size[0] - fitted.size[0]) // 2, (size[1] - fitted.size[1]) // 2), fitted)
    return out


def main() -> None:
    STORE.mkdir(parents=True, exist_ok=True)
    BRAND.mkdir(parents=True, exist_ok=True)

    src = next(p for p in ICON_CANDIDATES if p.exists())
    icon = load_square(src)
    print("icon source", src)

    icon1024 = icon.resize((1024, 1024), Image.Resampling.LANCZOS)
    icon1024.save(BRAND / "app-icon.png")
    icon1024.save(BRAND / "emblem.png")
    icon1024.save(ASSETS / "icon.png")
    icon1024.save(ASSETS / "splash-icon.png")
    icon.resize((512, 512), Image.Resampling.LANCZOS).save(STORE / "play-icon-512.png")
    icon.resize((48, 48), Image.Resampling.LANCZOS).save(ASSETS / "favicon.png")

    # Adaptive foreground with safe padding
    fg_canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fg = icon.resize((760, 760), Image.Resampling.LANCZOS)
    fg_canvas.paste(fg, ((1024 - 760) // 2, (1024 - 760) // 2), fg)
    fg_canvas.save(ASSETS / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), (6, 7, 8, 255)).save(ASSETS / "android-icon-background.png")

    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    gray = icon1024.convert("L")
    gp, sp, op = gray.load(), icon1024.load(), mono.load()
    for y in range(1024):
        for x in range(1024):
            a = sp[x, y][3]
            if a >= 20 and gp[x, y] > 40:
                op[x, y] = (255, 255, 255, a)
    mono.save(ASSETS / "android-icon-monochrome.png")

    if FEATURE_SRC.exists():
        feat = canvas_paste(Image.open(FEATURE_SRC), (1024, 500))
        feat.convert("RGB").save(STORE / "play-feature-graphic.png", "PNG")
        print("wrote feature graphic 1024x500")

    logo_src = CACHE / "ceres-premium-logo.png"
    if logo_src.exists():
        logo = load_square(logo_src).resize((1024, 1024), Image.Resampling.LANCZOS)
        logo.save(BRAND / "wordmark.png")
        print("wrote brand wordmark")

    # Play phone screenshots — 1080x1920
    for src_name, out_name in SHOTS:
        p = CACHE / src_name
        if not p.exists():
            print("missing shot", p)
            continue
        shot = canvas_paste(Image.open(p), (1080, 1920))
        shot.convert("RGB").save(STORE / out_name, "PNG")
        print("wrote", out_name)

    print("done")


if __name__ == "__main__":
    main()
