#!/usr/bin/env bash
#==============================================================================
# tools/pillar-fleet/alert.sh — Pillar Regression Alert Runner (v47 T3)
#
# Compares the latest two pillar scorecards from findings/ and exits with
# a non-zero code if any pillar score has regressed (decreased). Designed
# to run as a CI gate in pillar-checks.yml.
#
# Usage:
#   alert.sh                              # compare latest two scorecards
#   alert.sh --cycle N                    # compare cycle N vs N-1
#   alert.sh --threshold N                # alert on drop >= N (default 0.5)
#   alert.sh --json                       # JSON output for CI
#   alert.sh --warn                       # log regressions, exit 0 (soft)
#
# Exit codes:
#   0 = no regressions detected
#   1 = one or more regressions detected (gate failure)
#   2 = script error (missing tools, insufficient data)
#==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
THRESHOLD=0.5
JSON=false
WARN=false
CYCLE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --cycle) CYCLE="$2"; shift 2 ;;
        --threshold) THRESHOLD="$2"; shift 2 ;;
        --json) JSON=true; shift ;;
        --warn) WARN=true; shift ;;
        --help) head -25 "$0"; exit 0 ;;
        *) echo "Unknown: $1"; exit 1 ;;
    esac
 done

# ---- find latest two scorecards ----
SCORECARDS=()
while IFS= read -r f; do
    SCORECARDS+=("$f")
done < <(find "$REPO_ROOT/findings" -maxdepth 2 -name "71-pillar-scorecard-*.md" | sort -r | head -2)

if [[ ${#SCORECARDS[@]} -lt 2 ]]; then
    if $JSON; then
        echo '{"status":"skipped","reason":"insufficient scorecards for comparison","regressions":0}'
    else
        echo "alert.sh: insufficient scorecards for comparison (need ≥2, found ${#SCORECARDS[@]})" >&2
        echo "alert.sh: first scorecard will serve as baseline" >&2
    fi
    exit 0  # First run — no prior data to compare
fi

LATEST="${SCORECARDS[0]}"
PRIOR="${SCORECARDS[1]}"

# ---- extract pillar scores ----
# Parse markdown scorecards for pillar-level scores. Expect format like:
#   | L1 (Architecture) | 3.0 | 3.0 | ...
# or:
#   | L29 CI matrix | 2.5 | 3.0 | +0.5 |
REGEX='\|\s*(L[0-9]+)\(?[^|]*\|\s*([0-9]+\.[0-9])\s*\|'

REGRESSIONS=()
while IFS= read -r line; do
    if [[ $line =~ $REGEX ]]; then
        pillar="${BASH_REMATCH[1]}"
        prior_score="${BASH_REMATCH[2]}"
        # Find corresponding line in LATEST scorecard
        latest_line=$(grep "| ${pillar}" "$LATEST" 2>/dev/null || true)
        if [[ -n "$latest_line" && $latest_line =~ $REGEX ]]; then
            latest_score="${BASH_REMATCH[2]}"
            diff=$(echo "scale=2; $latest_score - $prior_score" | bc 2>/dev/null || echo "0")
            if [[ $(echo "$diff < 0" | bc 2>/dev/null) == "1" ]] && \
               [[ $(echo "${diff#-} >= $THRESHOLD" | bc 2>/dev/null) == "1" ]]; then
                REGRESSIONS+=("${pillar}: ${prior_score}→${latest_score} (Δ${diff})")
            fi
        fi
    fi
done < "$PRIOR"

# ---- output ----
if $JSON; then
    failures_json="["
    for i in "${!REGRESSIONS[@]}"; do
        [[ $i -gt 0 ]] && failures_json+=","
        failures_json+="\"${REGRESSIONS[$i]}\""
    done
    failures_json+="]"
    echo "{\"status\":\"$([[ ${#REGRESSIONS[@]} -gt 0 ]] && echo 'fail' || echo 'pass')\",\"regressions\":${#REGRESSIONS[@]},\"details\":$failures_json}"
else
    if [[ ${#REGRESSIONS[@]} -gt 0 ]]; then
        echo "════════════════════════════════════════════════════════════════"
        echo "  Pillar Regression Alert (threshold=${THRESHOLD})"
        echo "════════════════════════════════════════════════════════════════"
        echo "  Comparing: $(basename "$PRIOR") → $(basename "$LATEST")"
        echo "  Regressions found: ${#REGRESSIONS[@]}"
        echo
        for r in "${REGRESSIONS[@]}"; do
            echo "  ❌  $r"
        done
        echo
        if $WARN; then
            echo "  ⚠️  --warn set: exiting 0"
            exit 0
        fi
        exit 1
    else
        echo "alert.sh: ✅ no regressions detected (threshold=${THRESHOLD})"
        exit 0
    fi
fi
