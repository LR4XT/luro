#!/usr/bin/env bash
# Map electron-builder arch suffixes to shorter download names:
#   arm64 → arm
#   x64   → intel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE="$ROOT/release"

rename_one() {
  local src="$1"
  local dest="$2"
  if [[ -f "$src" && "$src" != "$dest" ]]; then
    mv -f "$src" "$dest"
    echo "Renamed: $(basename "$src") -> $(basename "$dest")"
  fi
}

shopt -s nullglob

# macOS DMG + blockmap
for src in "$RELEASE"/*-arm64.dmg; do
  rename_one "$src" "${src%-arm64.dmg}-arm.dmg"
done
for src in "$RELEASE"/*-arm64.dmg.blockmap; do
  rename_one "$src" "${src%-arm64.dmg.blockmap}-arm.dmg.blockmap"
done
for src in "$RELEASE"/*-x64.dmg; do
  rename_one "$src" "${src%-x64.dmg}-intel.dmg"
done
for src in "$RELEASE"/*-x64.dmg.blockmap; do
  rename_one "$src" "${src%-x64.dmg.blockmap}-intel.dmg.blockmap"
done

# Legacy electron-builder name: no arch suffix means x64 when an Apple Silicon sibling exists.
for src in "$RELEASE"/*.dmg; do
  base="$(basename "$src")"
  [[ "$base" == *"-arm.dmg" || "$base" == *"-arm64.dmg" || "$base" == *"-intel.dmg" || "$base" == *"-x64.dmg" ]] && continue
  if [[ "$base" =~ ^(.+)-([0-9]+\.[0-9]+\.[0-9]+)\.dmg$ ]]; then
    name="${BASH_REMATCH[1]}"
    ver="${BASH_REMATCH[2]}"
    if [[ -f "$RELEASE/${name}-${ver}-arm.dmg" || -f "$RELEASE/${name}-${ver}-arm64.dmg" ]]; then
      rename_one "$src" "$RELEASE/${name}-${ver}-intel.dmg"
      rename_one "$RELEASE/${name}-${ver}.dmg.blockmap" "$RELEASE/${name}-${ver}-intel.dmg.blockmap"
    fi
  fi
done

# Windows zip
for src in "$RELEASE"/*-arm64-win.zip; do
  rename_one "$src" "${src%-arm64-win.zip}-arm-win.zip"
done
for src in "$RELEASE"/*-x64-win.zip; do
  rename_one "$src" "${src%-x64-win.zip}-intel-win.zip"
done

if [[ -f "$RELEASE/latest-mac.yml" ]]; then
  RELEASE_YML="$RELEASE/latest-mac.yml" python3 - <<'PY'
from pathlib import Path
import os, re
p = Path(os.environ["RELEASE_YML"])
text = p.read_text()
text = text.replace("-arm64.dmg", "-arm.dmg")
text = text.replace("-x64.dmg", "-intel.dmg")
# Unsuffixed product-version.dmg (x64 default) -> -intel.dmg
text = re.sub(
    r"(?<!arm)(?<!intel)(?<!x64)(?<!arm64)(luro-\d+\.\d+\.\d+)\.dmg",
    r"\1-intel.dmg",
    text,
)
p.write_text(text)
print("Updated latest-mac.yml urls to -arm / -intel.")
PY
fi
