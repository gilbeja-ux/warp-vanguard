#!/usr/bin/env python3
"""Drop a badge in src/, run `npm run icons`, done.

    npm run icons

Takes whatever badge art is sitting in src/ and rebuilds every icon the game
ships, then bumps the cache key so the new one is actually seen. Idempotent —
safe to run on every build.

It exists because "replace the icon" was three fiddly steps that all had to be
right or the game shipped brandless:

  1. THE FILENAME. Art arrives named things like "Logo - Small.png". macOS has a
     case-insensitive filesystem, so the game asking for `logo-small.png` finds
     it locally and looks perfect — then 404s on Linux hosting and inside the
     Android package, where nothing in development would ever have shown it.
     Anything that looks like the badge gets normalised to `logo-small.png`.

  2. ONE IMAGE IS NOT FOUR ICONS. Launchers want 192 and 512 in two different
     framings, and the maskable pair is the one people get wrong: Android crops
     it to a circle or squircle, so the art has to sit inside a safe zone or the
     corners of the shield are sliced off. 62% is what survives the tightest
     crop with this shield.

  3. BROWSERS CACHE ICONS HARD. Without moving the ?v= on the <link rel="icon">
     tags, returning players keep the old tile forever and it reads as "the
     icon didn't update".
"""
import os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ICONS = os.path.join(SRC, 'icons')
BADGE = os.path.join(SRC, 'logo-small.webp')
LOCKUP = os.path.join(SRC, 'logo.webp')
BG = (3, 6, 14, 255)          # manifest background_color, #03060e

# `any` nearly fills its tile; `maskable` sits inside the circular safe zone
SIZES = [(192, 0.94, False, 'df-192.png'),
         (512, 0.94, False, 'df-512.png'),
         (192, 0.62, True,  'df-mask-192.png'),
         (512, 0.62, True,  'df-mask-512.png')]


def adopt(target, *patterns):
    """Turn whatever the art was actually called into the file the game loads.

    The game ships WebP (lossless — same pixels, a third less weight), but art
    arrives as PNG, so a dropped PNG is CONVERTED here rather than renamed. The
    original is left alone: it is the thing to re-drop if this ever needs redoing,
    and it must not sit in src/ afterwards or Capacitor packages both copies.
    """
    if os.path.exists(target):
        return False
    for pat in patterns:
        for hit in sorted(glob.glob(os.path.join(SRC, pat))):
            if os.path.abspath(hit) == os.path.abspath(target):
                continue
            from PIL import Image
            Image.open(hit).convert('RGBA').save(target, 'WEBP', lossless=True, exact=True, quality=100)
            print(f'  adopted {os.path.basename(hit)} -> {os.path.basename(target)} (lossless webp)')
            print(f'  NOTE: {os.path.basename(hit)} is still in src/ — move it out, it ships otherwise')
            return True
    return False


def main():
    try:
        from PIL import Image
    except ImportError:
        sys.exit('needs Pillow:  python3 -m pip install --user Pillow')

    adopt(BADGE, '[Ll]ogo*[Ss]mall*.png', '*small*.png')
    adopt(LOCKUP, '[Ll]ogo.png')
    if not os.path.exists(BADGE):
        sys.exit(f'no badge found — put the icon art in {os.path.relpath(BADGE, ROOT)}')

    src = Image.open(BADGE).convert('RGBA')
    box = src.crop(src.split()[-1].getbbox())   # trim the transparent margin, so the
    w, h = box.size                             # shield centres on ITS bounds, not the canvas
    os.makedirs(ICONS, exist_ok=True)
    for sz, frac, opaque, name in SIZES:
        canvas = Image.new('RGBA', (sz, sz), BG if opaque else (0, 0, 0, 0))
        s = (sz * frac) / max(w, h)
        art = box.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        canvas.alpha_composite(art, ((sz - art.width) // 2, (sz - art.height) // 2))
        canvas.save(os.path.join(ICONS, name))
        print(f'  {name}  {sz}x{sz}  {"maskable" if opaque else "any"} @ {int(frac*100)}%')

    # move the cache key, or none of the above is visible to anyone who has played before
    page = os.path.join(SRC, 'index.html')
    html = open(page, encoding='utf-8').read()
    vs = [int(v) for v in re.findall(r'\.png\?v=(\d+)', html)]
    if vs:
        nxt = max(vs) + 1
        html = re.sub(r'(\.png)\?v=\d+', lambda m: f'{m.group(1)}?v={nxt}', html)
        open(page, 'w', encoding='utf-8').write(html)
        print(f'  cache key -> v={nxt}')
    print('icons up to date.')


if __name__ == '__main__':
    main()
