#!/usr/bin/env bash
# scripts/worklog_schema_check.sh — v15 L65-adjacent WORKLOG.md v2.1 schema gate
#
# Validates every staged WORKLOG.md has the v2.1 schema (ADR-025 / ADR-030).
# v2.1 is the 11-column schema that adds `device | scope | risk | deps | links`
# after the original v2.0 6 columns. The v2.0 schema is deprecated 2026-06-22.
#
# Usage:
#   bash scripts/worklog_schema_check.sh [<WORKLOG.md> ...]
#   bash scripts/worklog_schema_check.sh --staged        # read git diff --cached
#   bash scripts/worklog_schema_check.sh --all           # scan every WORKLOG.md in tree
#   bash scripts/worklog_schema_check.sh --check schema  # CI gate (exits non-zero on miss)
#
# Wire into .githooks/pre-commit (this repo) or as a CI step.
#
# Exit codes:
#   0 — all WORKLOG.md files conform to v2.1 (or have no rows yet — empty scaffold OK)
#   1 — at least one WORKLOG.md fails the schema check (with reason)
#   2 — invocation error (missing arg, etc.)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

MODE="explicit"
if [ "${1:-}" = "--staged" ] || [ "${1:-}" = "--all" ] || [ "${1:-}" = "--check" ]; then
    MODE="${1#--}"
    shift
fi

# ---------------------------------------------------------------------------
# v2.1 canonical schema (ADR-030). Order is significant; the script enforces
# exact header match so a typo or column drift is caught at commit time.
# ---------------------------------------------------------------------------
V21_HEADER='| Date | Task ID | Layer | Action | Files | Notes | device | scope | risk | deps | links |'
V21_DEVICES_REGEX='macbook|heavy-runner|subagent|ci'

# Expected 11 leading-pipe columns (5 in v2.0; 11 in v2.1).
V21_COL_COUNT=11

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

is_worklog_header_v21() {
    # Normalize trailing whitespace and compare.
    local actual="$1"
    actual=$(printf '%s' "$actual" | sed -e 's/[[:space:]]*$//' -e 's/^[[:space:]]*//')
    [ "$actual" = "$V21_HEADER" ]
}

count_columns() {
    # Count non-empty cells between pipes.
    local header="$1"
    local cells
    cells=$(printf '%s' "$header" | awk -F'|' '{ for (i=1;i<=NF;i++) if ($i ~ /[^[:space:]]/) print $i }')
    echo "$cells" | wc -l | tr -d ' '
}

# ---------------------------------------------------------------------------
# File collection
# ---------------------------------------------------------------------------

collect_targets() {
    case "$MODE" in
        staged)
            git diff --cached --name-only --diff-filter=ACM | grep -E '/?WORKLOG\.md$' || true
            ;;
        all)
            find . -name WORKLOG.md \
                -not -path './node_modules/*' \
                -not -path './.git/*' \
                -not -path '*/target/*' \
                -not -path '*/.venv/*' \
                -not -path '*/__pycache__/*' \
                2>/dev/null
            ;;
        check)
            echo "$@"
            ;;
        explicit)
            if [ $# -eq 0 ]; then
                echo "usage: $0 [--staged|--all|--check] <file>..." >&2
                exit 64
            fi
            for f in "$@"; do echo "$f"; done
            ;;
    esac
}

# ---------------------------------------------------------------------------
# Per-file check
# ---------------------------------------------------------------------------

check_file() {
    local file="$1"
    local rc=0
    local status="OK"

    if [ ! -f "$file" ]; then
        echo "  ✗ MISSING  $file"
        return 1
    fi

    # Pull the first non-blank line as the header. grep -m1 gets the first
    # match; -n includes a line-number prefix which we strip (awk would
    # otherwise treat the "6:" prefix as a non-empty cell and inflate ncols).
    # --color=never guards against GREP_OPTIONS=--color=always env-leak,
    # which would inject ANSI escapes that awk treats as content.
    local header
    header=$(grep -m1 -nE --color=never '^\|.*\|$' "$file" 2>/dev/null | sed -E 's/^[0-9]+://' || true)
    if [ -z "$header" ]; then
        # No header yet — treat as empty scaffold (allowed under v2.1 migration).
        echo "  ⚠ EMPTY    $file (no header row; allowed as scaffold)"
        return 0
    fi

    # v2.1 exact-match check first (strictest).
    if is_worklog_header_v21 "$header"; then
        echo "  ✓ V21      $file"
        return 0
    fi

    # Otherwise count columns.
    local ncols
    ncols=$(count_columns "$header")

    if [ "$ncols" -eq "$V21_COL_COUNT" ]; then
        # 11 cols but wrong wording — surface the actual header for human review.
        echo "  ✗ V21-MISMATCH  $file"
        echo "      got:      $header"
        echo "      expected: $V21_HEADER"
        return 1
    fi

    if [ "$ncols" -eq 6 ]; then
        echo "  ✗ V20-DEPRECATED  $file"
        echo "      v2.0 (6-col) is deprecated 2026-06-22. Migrate with:"
        echo "          python3 scripts/migrate-worklog-v20-to-v21.py $file"
        return 1
    fi

    echo "  ✗ UNKNOWN-COLS($ncols)  $file"
    echo "      expected $V21_COL_COUNT (v2.1) or 6 (v2.0 — deprecated); got $ncols"
    return 1
}

# ---------------------------------------------------------------------------
# Device-value audit (only when the file has rows). Looks at column 7.
# ---------------------------------------------------------------------------

audit_devices() {
    local file="$1"
    # Skip if file is empty scaffold.
    local data_start
    data_start=$(grep -nE --color=never '^\| [0-9]{4}-[0-9]{2}-[0-9]{2}' "$file" 2>/dev/null | head -1 | cut -d: -f1 || true)
    [ -z "$data_start" ] && return 0

    # Print a short audit of distinct device values in column 8
    # (Date|Task ID|Layer|Action|Files|Notes|device — device is the 7th data col).
    local distinct
    distinct=$(awk -F'|' -v start="$data_start" 'NR >= start { gsub(/[[:space:]]/, "", $8); if ($8 != "") print $8 }' "$file" | sort -u || true)
    if [ -z "$distinct" ]; then
        echo "  ⚠ NO-DEVICE-VALUES  $file (header is v2.1 but rows have no `device` cell)"
        return 0
    fi

    local unknown=""
    local v
    for v in $distinct; do
        if ! echo "$v" | grep -qE "^($V21_DEVICES_REGEX)$"; then
            unknown="$unknown $v"
        fi
    done
    if [ -n "$unknown" ]; then
        echo "  ⚠ UNKNOWN-DEVICE  $file ->${unknown}"
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

mapfile -t TARGETS < <(collect_targets "$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
    echo "WORKLOG-SCHEMA-CHECK: no WORKLOG.md files to check (mode=$MODE)" >&2
    exit 0
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  WORKLOG v2.1 schema check (ADR-025 / ADR-030)"
echo "  Mode: $MODE  Files: ${#TARGETS[@]}"
echo "═══════════════════════════════════════════════════════════════"

ERRORS=0
for f in "${TARGETS[@]}"; do
    if ! check_file "$f"; then
        ERRORS=$((ERRORS + 1))
        continue
    fi
    audit_devices "$f" || true
done

echo "═══════════════════════════════════════════════════════════════"
if [ "$ERRORS" -eq 0 ]; then
    echo "  ✓ WORKLOG v2.1 schema check passed (${#TARGETS[@]} files)"
    exit 0
else
    echo "  ✗ WORKLOG v2.1 schema check failed ($ERRORS / ${#TARGETS[@]} files)"
    echo "  Fix: migrate v2.0 files with scripts/migrate-worklog-v20-to-v21.py"
    exit 1
fi
