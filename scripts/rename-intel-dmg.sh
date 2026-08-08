#!/usr/bin/env bash
# Rename mac x64 DMG artifacts to *-intel.* so Intel downloads are obvious.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE="$ROOT/release"

rename_one() {
  local src="$1"
  local dest="$2"
  if [[ -f "$src" ]]; then
    mv -f "$src" "$dest"
    echo "Renamed: $(basename "$src") -> $(basename "$dest")"
  fi
}

shopt -s nullglob
for src in "$RELEASE"/*-x64.dmg; do
  rename_one "$src" "${src%-x64.dmg}-intel.dmg"
done
for src in "$RELEASE"/*-x64.dmg.blockmap; do
  rename_one "$src" "${src%-x64.dmg.blockmap}-intel.dmg.blockmap"
done

# Legacy electron-builder name: no arch suffix means x64 when arm64 sibling exists.
for src in "$RELEASE"/*.dmg; do
  base="$(basename "$src")"
  [[ "$base" == *"-arm64.dmg" || "$base" == *"-intel.dmg" || "$base" == *"-x64.dmg" ]] && continue
  if [[ "$base" =~ ^(.+)-([0-9]+\.[0-9]+\.[0-9]+)\.dmg$ ]]; then
    name="${BASH_REMATCH[1]}"
    ver="${BASH_REMATCH[2]}"
    if [[ -f "$RELEASE/${name}-${ver}-arm64.dmg" ]]; then
      rename_one "$src" "$RELEASE/${name}-${ver}-intel.dmg"
      rename_one "$RELEASE/${name}-${ver}.dmg.blockmap" "$RELEASE/${name}-${ver}-intel.dmg.blockmap"
    fi
  fi
done

if [[ -f "$RELEASE/latest-mac.yml" ]]; then
  RELEASE_YML="$RELEASE/latest-mac.yml" python3 - <<'PY'
from pathlib import Path
import os, re
p = Path(os.environ["RELEASE_YML"])
text = p.read_text()
text = text.replace("-x64.dmg", "-intel.dmg")
# Unsuffixed product-version.dmg (x64 default) -> -intel.dmg, leave -arm64 alone
text = re.sub(
    r"(?<!arm64)(?<!intel)(?<!x64)(luro-\d+\.\d+\.\d+)\.dmg",
    r"\1-intel.dmg",
    text,
)
p.write_text(text)
print("Updated latest-mac.yml urls to use -intel where applicable.")
PY
fi
