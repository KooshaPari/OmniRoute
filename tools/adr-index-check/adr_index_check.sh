#!/usr/bin/env bash
set -euo pipefail

# L38 ADR index auto-refresh (v28 T3)
# Validates that every ADR markdown file is linked from docs/adr/INDEX.md

INDEX="docs/adr/INDEX.md"
[ -f "$INDEX" ] || { echo "MISSING $INDEX (create an ADR index first)"; exit 2; }

missing=0
for f in docs/adr/20*/*.md; do
  [ -f "$f" ] || continue
  name=$(basename "$f" .md)
  if ! grep -q "$name" "$INDEX" 2>/dev/null; then
    echo "ADR NOT IN INDEX: $f"
    missing=$((missing + 1))
  fi
done

if [ "$missing" -gt 0 ]; then
  echo "ACTION: add the $missing ADR(s) above to $INDEX"
  exit 1
fi

echo "ADR index check: all ADRs linked ($(grep -c '^\[' "$INDEX") entries)"
