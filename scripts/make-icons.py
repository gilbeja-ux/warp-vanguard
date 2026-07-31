#!/usr/bin/env python3
"""Generate the Android launcher icon from src/icons/df-512.png.

The shield is drawn bare. It used to carry a cyan outline so the stable
installed build could be told apart from the dev / PWA icon on the home
screen; that marker is retired, and both now show the same shield. Emits
every mipmap density for both the adaptive-icon foreground and the legacy
square/round icons, and sets the adaptive background to the game's theme
navy.

Run: python3 scripts/make-icons.py   (idempotent; safe to re-run each build)
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "icons", "df-512.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

NAVY = (3, 6, 14, 255)          # #03060e — matches manifest theme_color
MASTER = 512

# Adaptive foreground canvas sizes (108dp base) and legacy icon sizes (48dp base)
FG = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def load_shield(target_frac):
    """Crop df-512 to its shield and scale so its longest side is
    target_frac of the master canvas, returned centered on a transparent
    MASTER x MASTER canvas."""
    im = Image.open(SRC).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    im = im.crop(bbox)
    target = int(MASTER * target_frac)
    w, h = im.size
    scale = target / max(w, h)
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    canvas.paste(im, ((MASTER - im.width) // 2, (MASTER - im.height) // 2), im)
    return canvas


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def circle_mask(size):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
    return m


def save_each(master, sizes, name):
    for dens, px in sizes.items():
        out = master.resize((px, px), Image.LANCZOS)
        d = os.path.join(RES, f"mipmap-{dens}")
        os.makedirs(d, exist_ok=True)
        out.save(os.path.join(d, name))


def main():
    # --- Adaptive foreground: bare shield, kept inside the ~66% safe zone
    save_each(load_shield(0.55), FG, "ic_launcher_foreground.png")

    # --- Legacy square icon: navy rounded background + shield
    sq = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    bg = Image.new("RGBA", (MASTER, MASTER), NAVY)
    sq.paste(bg, (0, 0), rounded_mask(MASTER, int(MASTER * 0.16)))
    sq = Image.alpha_composite(sq, load_shield(0.66))
    save_each(sq, LEGACY, "ic_launcher.png")

    # --- Legacy round icon: navy circle + shield
    rd = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    rd.paste(bg, (0, 0), circle_mask(MASTER))
    rd = Image.alpha_composite(rd, load_shield(0.62))
    save_each(rd, LEGACY, "ic_launcher_round.png")

    # --- Adaptive background color -> theme navy
    with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#03060E</color>\n</resources>\n')

    print("✓ launcher icons generated")


if __name__ == "__main__":
    main()
