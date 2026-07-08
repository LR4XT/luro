#!/usr/bin/env bash
# Staple notarization ticket onto the latest DMG in release/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DMG="${1:-$(ls -t "$ROOT"/release/*.dmg 2>/dev/null | head -1)}"

if [[ -z "$DMG" || ! -f "$DMG" ]]; then
  echo "Usage: $0 [path/to/app.dmg]" >&2
  echo "No DMG found under release/." >&2
  exit 1
fi

echo "Stapling: $DMG"
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
echo "DMG is stapled and ready to distribute."
