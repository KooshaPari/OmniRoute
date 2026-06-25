#!/usr/bin/env bash
# add_eco_xrefs.sh — insert "## Authoritative Org ADRs (Upstream Cross-Reference)"
# block into each of the 8 absorption-justification audits.
# Idempotent: skips files that already contain the section header.

set -euo pipefail

REG_ROOT="/c/Users/koosh/phenotype-registry"
AUDITS_DIR="${REG_ROOT}/audits/absorption-justifications"

# Map audit file -> list of relevant ECO ADR numbers (space-separated, no "ECO-" prefix)
declare -A ADR_MAP=(
  ["BytePort-2026-06-23.md"]="020 022"
  ["McpKit-2026-06-23.md"]="022"
  ["go-nippon-2026-06-23.md"]="022"
  ["nanovms-2026-06-23.md"]="019 022"
  ["phenocompose-2026-06-23.md"]="021 022"
  ["phenotype-go-sdk-2026-06-23.md"]="022"
  ["phenotype-infra-2026-06-23.md"]="018 022"
  ["smart-mcp-go-2026-06-23.md"]="022"
)

# Map ECO number -> ADR title (matches the filenames on origin/main)
declare -A ADR_TITLE=(
  ["018"]="phenotype-infra path-dep hygiene"
  ["019"]="nanovms sandbox hardening"
  ["020"]="BytePort hygiene + security"
  ["021"]="PhenoCompose dead-cuda feature"
  ["022"]="compute-infra subtree registry correction"
)

MARKER="## Authoritative Org ADRs (Upstream Cross-Reference)"

inserted=0
skipped=0
for file in "${!ADR_MAP[@]}"; do
  fp="${AUDITS_DIR}/${file}"
  if [ ! -f "$fp" ]; then
    echo "MISSING: $file"
    continue
  fi
  if grep -qF "$MARKER" "$fp"; then
    skipped=$((skipped+1))
    continue
  fi
  # Build the block
  block="${MARKER}\n\n"
  block+="This audit is consistent with the following upstream ADRs (approved 2026-06-23 by the org governance session):\n\n"
  for n in ${ADR_MAP[$file]}; do
    title="${ADR_TITLE[$n]}"
    block+="- **ECO-${n}** (${title}): \`phenotype-registry/docs/adrs/ADR-ECO-${n}-*.md\`\n"
  done
  block+="\nThese ADRs are the authoritative reference; the audit below provides the deletion-justification evidence and traceability matrix for the same source repos.\n"

  # Insert before the first "## Source" header
  # awk: print lines until /^## Source/, then inject block, then continue
  tmp=$(mktemp)
  awk -v blk="$block" '
    /^## Source/ && !done {
      print blk
      print ""
      done=1
    }
    { print }
  ' "$fp" > "$tmp"
  mv "$tmp" "$fp"
  inserted=$((inserted+1))
  echo "Patched: $file"
done

echo ""
echo "=== Summary ==="
echo "Inserted: $inserted"
echo "Skipped (already present): $skipped"
