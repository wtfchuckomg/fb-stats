"""Small copies of the school logos (Chuck, 2026-10-27: "do it").

The logos are 400 pixels and up, and the scoreboards, schedules and team lists show them 20 to 56 pixels wide — the
Teams page alone was pulling about 8 MB of them. logos/sm/<same file name> is each one at 112 pixels on its longest
side, sharp up to 56 on a phone's screen; markFor() in pb/10-logos.js asks for it at those sizes and falls back to the
full logo if a small one isn't there yet. The nightly job runs this, so a logo added or changed gets its copy by
morning, and a removed one loses it.

    python3 .github/logos_sm.py          needs: pip install Pillow
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'logos')
OUT = os.path.join(SRC, 'sm')
SIDE = 112


def main():
    os.makedirs(OUT, exist_ok=True)
    have = {f for f in os.listdir(SRC) if f.lower().endswith('.png')}
    made = 0
    for f in sorted(have):
        src, dst = os.path.join(SRC, f), os.path.join(OUT, f)
        # Only what's new or changed since its copy was made; a checkout gives every file the same time, so the
        # nightly job remakes them all, and the same picture comes out byte for byte the same.
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        im = Image.open(src)
        im = im.convert('RGBA') if im.mode not in ('RGBA', 'LA') else im
        if max(im.size) > SIDE:
            im.thumbnail((SIDE, SIDE), Image.LANCZOS)
        # 256 colors, the way most of the full logos are kept already: a fifth of the size of full color at this size.
        im.quantize(256, method=Image.FASTOCTREE).save(dst, optimize=True)
        made += 1
    gone = [f for f in os.listdir(OUT) if f not in have]
    for f in gone:
        os.remove(os.path.join(OUT, f))
    print(f'logos/sm: {made} made, {len(gone)} removed, {len(have)} in all')


if __name__ == '__main__':
    main()
