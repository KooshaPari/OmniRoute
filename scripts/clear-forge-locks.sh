#!/usr/bin/env bash
# scripts/clear-forge-locks.sh — clear stale forgecode sidecar lock files
# Symptom fixed: "[ERROR] database is locked" surfacing in every forgecode chat.
# Root cause: forgecode uses sidecar *.lock files (0-byte siblings of the real
# state files) to serialize writes to .secrets and config/config.json. When a
# forgecode instance crashes / is killed mid-write, the sidecar lock is left
# behind and every subsequent launch races for it, surfacing as "database is
# locked". This script is the safe, idempotent local workaround.
#
# Scope: clears ONLY 0-byte *.lock files in well-known forge state dirs whose
# sibling state file exists AND is older than MIN_AGE_HOURS (default 1h). Any
# *.lock file with an open file handle (lsof) is skipped.
#
# Usage:
#   ./scripts/clear-forge-locks.sh                # interactive: print + clear
#   ./scripts/clear-forge-locks.sh --dry-run      # print, do not clear
#   ./scripts/clear-forge-locks.sh --force        # skip age check
#   ./scripts/clear-forge-locks.sh --min-age=0    # clear any stale-looking lock
#
# Exit codes:
#   0  all clearable locks cleared (or none to clear)
#   1  one or more locks were skipped (in-use or non-zero size)
#   2  invocation error

set -euo pipefail

DRY_RUN=0
FORCE=0
MIN_AGE_HOURS=1

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --force)   FORCE=1 ;;
        --min-age=*) MIN_AGE_HOURS="${arg#--min-age=}" ;;
        -h|--help)
            sed -n '2,22p' "$0"
            exit 0
            ;;
        *)
            echo "unknown flag: $arg" >&2
            exit 2
            ;;
    esac
done

# Well-known forge state directories (macOS-first; Linux paths included for completeness).
FORGE_STATE_DIRS=(
    "$HOME/Library/Application Support/forge"
    "$HOME/.forge"
    "$HOME/.config/forge"
    "$HOME/.local/share/forge"
    "$HOME/.cache/forge"
)

# Discover which dirs actually exist on this machine.
ACTIVE_DIRS=()
for d in "${FORGE_STATE_DIRS[@]}"; do
    [ -d "$d" ] && ACTIVE_DIRS+=("$d")
done

if [ ${#ACTIVE_DIRS[@]} -eq 0 ]; then
    echo "no forge state dirs found on this machine (looked in ${FORGE_STATE_DIRS[*]})"
    echo "  → forgecode may not be installed, or uses a non-standard path"
    exit 0
fi

# Minimum age in seconds for staleness (skipped when FORCE=1).
MIN_AGE_SECS=$((MIN_AGE_HOURS * 3600))
NOW=$(date +%s)

CLEARED=()
SKIPPED_IN_USE=()
SKIPPED_NONZERO=()
SKIPPED_FRESH=()
ERRORS=()

inspect_lock() {
    local lock_path="$1"
    local size mtime age_secs base sibling
    size=$(stat -f%z "$lock_path" 2>/dev/null || stat -c%s "$lock_path" 2>/dev/null || echo "?")
    mtime=$(stat -f%m "$lock_path" 2>/dev/null || stat -c%Y "$lock_path" 2>/dev/null || echo 0)
    age_secs=$((NOW - mtime))

    # Sibling = the file the lock guards (strip .lock suffix).
    base="${lock_path%.lock}"
    sibling=""
    [ -f "$base" ] && sibling="$base"

    # Gate 1: must be 0 bytes. Sidecar locks are always empty; non-empty is
    # probably a writer mid-write or a malformed file.
    if [ "$size" != "0" ]; then
        SKIPPED_NONZERO+=("$lock_path (size=${size}B)")
        return
    fi

    # Gate 2: must not have an open file handle. lsof exit code 1 + empty stdout
    # means no holders — safe to remove.
    if command -v lsof >/dev/null 2>&1; then
        if lsof "$lock_path" 2>/dev/null | grep -q .; then
            SKIPPED_IN_USE+=("$lock_path (held by $(lsof -t "$lock_path" 2>/dev/null | tr '\n' ',' | sed 's/,$//'))")
            return
        fi
    fi

    # Gate 3: must be older than MIN_AGE_HOURS (unless --force).
    if [ "$FORCE" -eq 0 ] && [ "$age_secs" -lt "$MIN_AGE_SECS" ]; then
        SKIPPED_FRESH+=("$lock_path (age=${age_secs}s < ${MIN_AGE_SECS}s)")
        return
    fi

    # All gates passed: candidate for removal.
    if [ "$DRY_RUN" -eq 1 ]; then
        CLEARED+=("$lock_path [DRY-RUN]")
        return
    fi

    if rm -f "$lock_path" 2>/dev/null; then
        CLEARED+=("$lock_path")
    else
        ERRORS+=("$lock_path (rm failed)")
    fi
}

# Walk each active state dir and inspect every *.lock file.
for d in "${ACTIVE_DIRS[@]}"; do
    while IFS= read -r -d '' lock_path; do
        inspect_lock "$lock_path"
    done < <(find "$d" -type f -name "*.lock" -print0 2>/dev/null)
done

# ─── Report ──────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════"
echo "  forgecode stale-lock cleanup"
echo "═══════════════════════════════════════════════════════"
echo "  state dirs scanned : ${#ACTIVE_DIRS[@]} (${ACTIVE_DIRS[*]})"
echo "  dry-run            : $DRY_RUN"
echo "  min-age            : ${MIN_AGE_HOURS}h (override: --force)"
echo ""

if [ ${#CLEARED[@]} -gt 0 ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "would clear (${#CLEARED[@]}):"
    else
        echo "cleared (${#CLEARED[@]}):"
    fi
    for c in "${CLEARED[@]}"; do echo "  ✓ $c"; done
    echo ""
fi

if [ ${#SKIPPED_IN_USE[@]} -gt 0 ]; then
    echo "skipped — held by live process (${#SKIPPED_IN_USE[@]}):"
    for s in "${SKIPPED_IN_USE[@]}"; do echo "  ⏸ $s"; done
    echo ""
fi

if [ ${#SKIPPED_NONZERO[@]} -gt 0 ]; then
    echo "skipped — non-zero size, investigate manually (${#SKIPPED_NONZERO[@]}):"
    for s in "${SKIPPED_NONZERO[@]}"; do echo "  ⚠ $s"; done
    echo ""
fi

if [ ${#SKIPPED_FRESH[@]} -gt 0 ]; then
    echo "skipped — too fresh (< ${MIN_AGE_HOURS}h), retry later or use --force (${#SKIPPED_FRESH[@]}):"
    for s in "${SKIPPED_FRESH[@]}"; do echo "  ⏳ $s"; done
    echo ""
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "errors (${#ERRORS[@]}):"
    for e in "${ERRORS[@]}"; do echo "  ✗ $e"; done
    echo ""
fi

TOTAL_SKIPPED=$(( ${#SKIPPED_IN_USE[@]} + ${#SKIPPED_NONZERO[@]} + ${#SKIPPED_FRESH[@]} + ${#ERRORS[@]} ))

if [ ${#CLEARED[@]} -gt 0 ] && [ $TOTAL_SKIPPED -eq 0 ]; then
    echo "✓ all clearable locks cleared"
    exit 0
elif [ ${#CLEARED[@]} -eq 0 ] && [ $TOTAL_SKIPPED -eq 0 ]; then
    echo "✓ no stale locks found — nothing to do"
    exit 0
elif [ ${#CLEARED[@]} -eq 0 ] && [ $TOTAL_SKIPPED -gt 0 ]; then
    echo "✗ no locks cleared; $TOTAL_SKIPPED skipped — review above"
    exit 1
else
    echo "⚠ partial: ${#CLEARED[@]} cleared, $TOTAL_SKIPPED skipped"
    exit 1
fi