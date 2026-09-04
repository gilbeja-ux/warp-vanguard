#!/usr/bin/env python3
"""Generate the iOS app icon and launch image from src/icons/wv-512.png.

The companion to make-icons.py, which only ever fed Android. Nothing wrote the
iOS asset catalogue, so `ios/` still carried what `cap add ios` scaffolded: a
blue W shield from before the monogram landed on a V, and the stock Capacitor
launch image — a white square with the Capacitor logo, which flashes white on
the way into a game that is almost black.

Two iOS-specific rules the Android generator does not have to care about:

  1. NO ALPHA IN THE APP ICON. App Store Connect rejects an icon with an alpha
     channel outright, and the failure arrives after upload rather than at
     build time. The icon is flattened onto the theme navy and saved as RGB.

  2. THE LAUNCH IMAGE IS A FITTED BADGE, NOT A WALLPAPER. LaunchScreen.storyboard
     paints the game's navy itself and pins one SQUARE image view to the centre
     at a third of the screen height, aspectFit. So the image here is the badge
     alone on a navy square with a small margin — the storyboard decides how big
     it is, the same on every device, and nothing is ever cropped. (The scaffold
     did the opposite: one 2732px square, aspectFill, on a white background —
     on a landscape phone only the middle ~46% of it survived.)

Run: python3 scripts/make-ios-assets.py   (idempotent; safe to re-run each build)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "icons", "wv-512.png")
ASSETS = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets")
ICONSET = os.path.join(ASSETS, "AppIcon.appiconset")
SPLASHSET = os.path.join(ASSETS, "Splash.imageset")

NAVY = (3, 6, 14)               # #03060e — matches manifest theme_color

ICON_PX = 1024                  # the single size modern Xcode asks for
ICON_FRAC = 0.70                # ~matches the Android legacy square icon (0.66)

SPLASH_PX = 512                 # the storyboard scales it; @3x of a 170pt view is 510px
SPLASH_FRAC = 0.82              # the badge fills the square, with a margin of navy

# Capacitor names three scales; all three point at the same square art.
SPLASH_NAMES = ["splash-2732x2732.png",
                "splash-2732x2732-1.png",
                "splash-2732x2732-2.png"]


def shield(canvas_px, frac):
    """The bare shield, trimmed to its own bounds and scaled so its longest
    side is `frac` of the canvas, centered on transparent canvas_px square."""
    im = Image.open(SRC).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    w, h = im.size
    scale = (canvas_px * frac) / max(w, h)
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    canvas.paste(im, ((canvas_px - im.width) // 2, (canvas_px - im.height) // 2), im)
    return canvas


def flatten(layer, px):
    """Composite onto the theme navy and drop alpha — RGB out, always."""
    base = Image.new("RGBA", (px, px), NAVY + (255,))
    return Image.alpha_composite(base, layer).convert("RGB")


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f"no master art at {os.path.relpath(SRC, ROOT)} — run `npm run icons` first")

    icon = flatten(shield(ICON_PX, ICON_FRAC), ICON_PX)
    os.makedirs(ICONSET, exist_ok=True)
    icon.save(os.path.join(ICONSET, "AppIcon-512@2x.png"))
    print(f"  AppIcon-512@2x.png  {ICON_PX}x{ICON_PX}  opaque @ {int(ICON_FRAC * 100)}%")

    splash = flatten(shield(SPLASH_PX, SPLASH_FRAC), SPLASH_PX)
    os.makedirs(SPLASHSET, exist_ok=True)
    for name in SPLASH_NAMES:
        splash.save(os.path.join(SPLASHSET, name))
    print(f"  splash x{len(SPLASH_NAMES)}  {SPLASH_PX}x{SPLASH_PX}  badge @ {int(SPLASH_FRAC * 100)}% on navy")

    print("✓ iOS assets generated")


if __name__ == "__main__":
    main()
