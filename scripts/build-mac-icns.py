#!/usr/bin/env python3
"""Build build/icon.icns + build/icon.iconset from build/icon.png."""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "build" / "icon.png"
ICNS = ROOT / "build" / "icon.icns"
ICONSET_OUT = ROOT / "build" / "icon.iconset"

# (pixel size, iconset filename)
ENTRIES: list[tuple[int, str]] = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}", file=sys.stderr)
        return 1

    src = Image.open(SRC).convert("RGBA")
    if src.getpixel((0, 0))[3] != 0:
        print("warning: corner pixel is not transparent", file=sys.stderr)

    names = [n for _, n in ENTRIES]
    if len(names) != len(set(names)):
        print(f"duplicate iconset names: {names}", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "icon.iconset"
        iconset.mkdir()
        for px, name in ENTRIES:
            im = src.resize((px, px), Image.Resampling.LANCZOS)
            # Avoid Pillow treating "@2x.png" oddly: save via plain temp name.
            tmp_png = iconset / f"tmp_{px}.png"
            im.save(tmp_png, format="PNG")
            tmp_png.replace(iconset / name)

        got = sorted(p.name for p in iconset.iterdir())
        expect = sorted(names)
        if got != expect:
            print(f"iconset mismatch\n got: {got}\n want: {expect}", file=sys.stderr)
            return 1

        ICNS.parent.mkdir(parents=True, exist_ok=True)
        r = subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(ICNS)],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            print(r.stderr or r.stdout, file=sys.stderr)
            return r.returncode

        if ICONSET_OUT.exists():
            shutil.rmtree(ICONSET_OUT)
        shutil.copytree(iconset, ICONSET_OUT)

    print(f"wrote {ICNS} ({ICNS.stat().st_size} bytes)")
    print(f"wrote {ICONSET_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
