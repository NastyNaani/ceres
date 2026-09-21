"""Resize Ceres brand masters into Expo / Play assets."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BRAND = ROOT / "brand"
STORE = ROOT / "store"

# Prefer freshly generated masters from Cursor asset cache, else brand/
CANDIDATES = [
    Path(r"C:\Users\rolvin\.cursor\projects\e-Ceres\assets\ceres-metallic-icon.png"),
    Path(r"C:\Users\rolvin\.cursor\projects\e-Ceres\assets\ceres-app-icon.png"),
    BRAND / "app-icon.png",
    ASSETS / "icon.png",
]
SPLASH_CANDIDATES = [
    Path(r"C:\Users\rolvin\.cursor\projects\e-Ceres\assets\ceres-metallic-icon.png"),
    Path(r"C:\Users\rolvin\.cursor\projects\e-Ceres\assets\ceres-splash.png"),
    BRAND / "splash-master.png",
]


def load_square(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    side = min(w, h)
    return im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))


def save_resized(im: Image.Image, path: Path, size: int) -> None:
    out = im.resize((size, size), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, "PNG")
    print("wrote", path, out.size)


def main() -> None:
    src = next(p for p in CANDIDATES if p.exists())
    icon = load_square(src)
    print("source", src, icon.size)

    BRAND.mkdir(exist_ok=True)
    STORE.mkdir(exist_ok=True)
    icon.resize((1024, 1024), Image.Resampling.LANCZOS).save(BRAND / "app-icon.png")
    icon.resize((1024, 1024), Image.Resampling.LANCZOS).save(BRAND / "emblem.png")

    save_resized(icon, ASSETS / "icon.png", 1024)
    save_resized(icon, ASSETS / "splash-icon.png", 1024)
    save_resized(icon, ASSETS / "favicon.png", 48)
    save_resized(icon, STORE / "play-icon-512.png", 512)

    # Android adaptive foreground with safe padding
    fg_canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fg = icon.resize((760, 760), Image.Resampling.LANCZOS)
    fg_canvas.paste(fg, ((1024 - 760) // 2, (1024 - 760) // 2), fg)
    fg_canvas.save(ASSETS / "android-icon-foreground.png")

    Image.new("RGBA", (1024, 1024), (6, 7, 8, 255)).save(ASSETS / "android-icon-background.png")

    mono_src = icon.resize((1024, 1024), Image.Resampling.LANCZOS)
    gray = mono_src.convert("L")
    mono_out = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    gp = gray.load()
    sp = mono_src.load()
    op = mono_out.load()
    for y in range(1024):
        for x in range(1024):
            a = sp[x, y][3]
            if a < 20:
                continue
            if gp[x, y] > 40:
                op[x, y] = (255, 255, 255, a)
    mono_out.save(ASSETS / "android-icon-monochrome.png")
    print("wrote android adaptive set")

    splash_path = next((p for p in SPLASH_CANDIDATES if p.exists()), None)
    if splash_path:
        sp = Image.open(splash_path).convert("RGBA")
        sp.save(BRAND / "splash-master.png")
        sp.save(BRAND / "wordmark.png")
        tw, th = 1024, 500
        scale = max(tw / sp.width, th / sp.height)
        nw, nh = int(sp.width * scale), int(sp.height * scale)
        sp2 = sp.resize((nw, nh), Image.Resampling.LANCZOS)
        left = (nw - tw) // 2
        top = (nh - th) // 2
        sp2.crop((left, top, left + tw, top + th)).save(STORE / "play-feature-graphic.png")
        print("wrote feature graphic from", splash_path)

    print("done")


if __name__ == "__main__":
    main()
