#!/usr/bin/env bash
#==============================================================================
# tools/pillar-fleet/push-scorecard.sh — Daily Scorecard Push (v47 T2)
#
# Generates a fleet pillar scorecard, commits it to findings/, and pushes
# to origin. Designed to run as a cron job (systemd timer or CI scheduled
# workflow).
#
# Usage:
#   push-scorecard.sh                          # generate + commit + push
#   push-scorecard.sh --dry-run                # generate only, no commit
#   push-scorecard.sh --cycle N                # specify cycle number
#   push-scorecard.sh --out findings/          # output dir
#   push-scorecard.sh --no-push                # commit but don't push
#
# Exit codes:
#   0 = scorecard pushed (or nothing to do)
#   1 = scorecard generation failed
#   2 = git operation failed
#==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="${REPO_ROOT}/findings"
DRY_RUN=false
NO_PUSH=false
CYCLE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --cycle) CYCLE="$2"; shift 2 ;;
        --out) OUT_DIR="$2"; shift 2 ;;
        --no-push) NO_PUSH=true; shift ;;
        --help) head -30 "$0"; exit 0 ;;
        *) echo "Unknown: $1"; exit 1 ;;
    esac
 done

DATE_STAMP=$(date -u +%Y-%m-%d)

# ---- generate scorecard ----
echo "push-scorecard.sh: generating scorecard for ${DATE_STAMP}..." >&2

# Get repo root name
REPO_NAME=$(basename "$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null)" || echo "fleet")

# Run the scorecard generator
if [ -x "$SCRIPT_DIR/scorecard.sh" ]; then
    SCORECARD_OUTPUT=$(bash "$SCRIPT_DIR/scorecard.sh" 2>/dev/null) || {
        echo "push-scorecard.sh: scorecard generation failed" >&2
        exit 1
    }
else
    # Fallback: generate minimal scorecard
    SCORECARD_OUTPUT="# Fleet Pillar Scorecard — ${DATE_STAMP}\n\n(Fallback: scorecard.sh not found)\n"
fi

# Write scorecard to findings/
SCORECARD_FILE="${OUT_DIR}/71-pillar-scorecard-${DATE_STAMP}.md"
mkdir -p "$OUT_DIR"
printf '%s\n' "$SCORECARD_OUTPUT" > "$SCORECARD_FILE"
echo "push-scorecard.sh: wrote $SCORECARD_FILE" >&2

if $DRY_RUN; then
    echo "push-scorecard.sh: dry-run — stopping before commit" >&2
    exit 0
fi

# ---- commit ----
cd "$REPO_ROOT"

# Check if there are changes
if git diff --quiet -- "$SCORECARD_FILE" 2>/dev/null && \
   ! git ls-files --error-unmatch "$SCORECARD_FILE" >/dev/null 2>&1; then
    echo "push-scorecard.sh: no new scorecard to commit (already up to date)" >&2
    exit 0
fi

git add "$SCORECARD_FILE"
CYCLE_TAG="${CYCLE:+cycle-${CYCLE} }"
git commit -m "docs(71-pillar): ${CYCLE_TAG}scorecard push ${DATE_STAMP}" \
  --author="Phenotype Scorecard Bot <bot+scorecard@phenotype.org>"

echo "push-scorecard.sh: committed scorecard for ${DATE_STAMP}" >&2

if $NO_PUSH; then
    echo "push-scorecard.sh: --no-push set, not pushing" >&2
    exit 0
fi

# ---- push ----
if ! git push origin HEAD 2>/dev/null; then
    echo "push-scorecard.sh: WARNING: push failed (non-fatal — commit exists locally)" >&2
    exit 2
fi

echo "push-scorecard.sh: scorecard pushed for ${DATE_STAMP}" >&2
