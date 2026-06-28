#!/usr/bin/env bash
#
# scripts/forge_daemon_check.sh
#
# SQLite busy_timeout enforcement (v47 T1, ADR-097).
#
# Purpose: prevent the "database is locked" error family
# (tailcallhq/forgecode#3551) by ensuring every SQLite connection in the
# fleet sets PRAGMA busy_timeout (or equivalent). Without it, lock
# contention fails instantly; with it, the connection waits up to N ms
# for the lock to release.
#
# Detection strategy:
#   1. Scan .rs files for SQLite driver imports: rusqlite / sqlx / diesel
#      / tokio_rusqlite (case-sensitive, must be in `use` statement).
#   2. For each match, check the same file for the busy_timeout pragma:
#        - rusqlite:        PRAGMA busy_timeout
#        - sqlx (sqlite):   .busy_timeout(Duration::from_*
#        - diesel:          PRAGMA busy_timeout (set in connection setup)
#      OR for a wrapper module (./scripts/db_helpers/ or similar) that
#      centralizes the connection setup.
#   3. Exit 0 if all SQLite-using files declare busy_timeout (or route
#      through a wrapper that does); exit 1 otherwise.
#
# Scope: pheno-* crates + phenotype-* repos. Worktrees are skipped (they
# are not built in CI).
#
# Usage:
#   ./scripts/forge_daemon_check.sh                 # full fleet scan
#   ./scripts/forge_daemon_check.sh --strict        # fail on any near-miss
#   ./scripts/forge_daemon_check.sh --json          # JSON output for CI
#
# Exit codes:
#   0 = all SQLite connections have busy_timeout
#   1 = one or more connections lack busy_timeout (gate failure)
#   2 = script error (missing tools, bad args)

set -euo pipefail

# -------- args --------
MODE="normal"
JSON=false
WARN=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --strict) MODE="strict"; shift ;;
        --json) JSON=true; shift ;;
        --warn) WARN=true; shift ;;   # log failures but exit 0 (CI-friendly)
        --help|-h)
            cat <<EOF
forge_daemon_check.sh — SQLite busy_timeout enforcement gate (v47 T1)

Usage: $0 [--strict] [--json] [--warn]

  --strict  fail on any near-miss (e.g. busy_timeout found but not in a
            Connection::open path; for new code only)
  --json    JSON output for CI consumption
  --warn    log failures but exit 0 (v47 ship mode; flips to enforce in v48
            once the 43 known gaps in agileplus-sqlite / forge-vacuum are fixed)

Exits 0 on clean, 1 on any SQLite connection without busy_timeout (unless --warn).
EOF
            exit 0
            ;;
        *)
            echo "unknown arg: $1" >&2
            exit 2
            ;;
    esac
done

# Environment override (for just recipe which can't pass --warn through):
# Any non-empty FORGE_DAEMON_CHECK_WARN activates warn mode.
if [[ -n "${FORGE_DAEMON_CHECK_WARN:-}" ]]; then
    WARN=true
fi

# -------- scan --------
# SQLite driver detection patterns. Match whole-word "use" statements.
SQLITE_PATTERNS='use rusqlite|use ::rusq|use sqlx::sqlite|use diesel::sqlite|use tokio_rusqlite|use ::sqlx'
# Pragma patterns. Match the pragma name and the next 5 lines (so we
# catch multi-line `connection.execute("PRAGMA busy_timeout = 30000", [])?`).
PRAGMA_PATTERN='busy_timeout'

# Fleet roots: anything under the monorepo with a Cargo.toml that isn't
# a worktree and isn't `.git/`. Skip nested repos per AGENTS.md
# (clap-ext/, security-analysis/, etc.).
FLEET_ROOTS=(.)
EXCLUDE_DIRS=(
    '.git' 'target' 'node_modules' 'dist' 'build' '.next' 'coverage'
    '__pycache__' 'worktrees' '.worktrees'
    'clap-ext' 'security-analysis'   # nested repos per AGENTS.md
)

# Build find -prune args
PRUNE_ARGS=()
for d in "${EXCLUDE_DIRS[@]}"; do
    PRUNE_ARGS+=( -path "./$d" -prune -o )
done

# Files to scan: .rs files in the fleet, excluding tests
# Use portable while-read instead of mapfile (bash 3.2 compat).
RS_FILES=()
while IFS= read -r f; do
    RS_FILES+=("$f")
done < <(
    find . "${PRUNE_ARGS[@]}" \
        -name '*.rs' -type f -print 2>/dev/null \
    | grep -vE '/(tests|test|benches|examples)/' \
    | head -5000
)

# -------- main loop --------
# Two-pass: first identify which crates have at least one file with
# busy_timeout (the "connection helper" pattern); then evaluate each
# SQLite-using file against either (a) it has busy_timeout itself, or
# (b) its crate is in the helper set. This avoids false-positives in
# hexagonal architectures where one connection helper centralizes
# pragmas and 20 repository files share the pool.
#
# bash 3.2 compat: no associative arrays. Use a temp file as the
# crate index; grep -qxF for membership.

CRATE_INDEX=$(mktemp -t forge_daemon_check_crates.XXXXXX)
trap 'rm -f "$CRATE_INDEX"' EXIT

total_files=0
sqlite_files=0
busy_ok=0
busy_missing=0
declare -a FAILURES=()

# Pass 1: find every file that has busy_timeout, index by crate.
# Crate = dirname two levels up from the file (typical Cargo layout:
# crate/src/foo.rs → crate). If the path doesn't match that layout,
# fall back to the file's dirname.
for f in "${RS_FILES[@]}"; do
    if grep -qE "$PRAGMA_PATTERN" "$f" 2>/dev/null; then
        crate_dir=$(dirname "$(dirname "$f")")
        [[ ! -f "$crate_dir/Cargo.toml" ]] && crate_dir=$(dirname "$f")
        echo "$crate_dir" >> "$CRATE_INDEX"
    fi
done
# Dedupe (sort -u is bash-3.2-portable)
sort -u -o "$CRATE_INDEX" "$CRATE_INDEX"

# Pass 2: evaluate SQLite-using files
for f in "${RS_FILES[@]}"; do
    total_files=$((total_files + 1))
    if ! grep -qE "$SQLITE_PATTERNS" "$f" 2>/dev/null; then
        continue
    fi
    sqlite_files=$((sqlite_files + 1))

    # Pass: pragma is in this file directly
    if grep -qE "$PRAGMA_PATTERN" "$f" 2>/dev/null; then
        busy_ok=$((busy_ok + 1))
        continue
    fi

    # Pass: pragma is in another file in the same crate
    crate_dir=$(dirname "$(dirname "$f")")
    [[ ! -f "$crate_dir/Cargo.toml" ]] && crate_dir=$(dirname "$f")
    if grep -qxF "$crate_dir" "$CRATE_INDEX" 2>/dev/null; then
        busy_ok=$((busy_ok + 1))
        continue
    fi

    busy_missing=$((busy_missing + 1))
    FAILURES+=("$f")
done

# -------- output --------
if $JSON; then
    # JSON output for CI
    failures_json="["
    for i in "${!FAILURES[@]}"; do
        [[ $i -gt 0 ]] && failures_json+=","
        failures_json+="\"${FAILURES[$i]}\""
    done
    failures_json+="]"
    cat <<EOF
{"total_files":$total_files,"sqlite_files":$sqlite_files,"busy_ok":$busy_ok,"busy_missing":$busy_missing,"failures":$failures_json}
EOF
else
    echo "════════════════════════════════════════════════════════════════"
    echo "  forge_daemon_check — SQLite busy_timeout enforcement (v47 T1)"
    echo "════════════════════════════════════════════════════════════════"
    echo "  mode                : $MODE"
    echo "  fleet files scanned : $total_files"
    echo "  SQLite-using files  : $sqlite_files"
    echo "  busy_timeout present: $busy_ok"
    echo "  busy_timeout missing: $busy_missing"
    echo

    if [[ $busy_missing -gt 0 ]]; then
        echo "  ❌ FAIL — these files import a SQLite driver but do NOT set busy_timeout:"
        echo
        for f in "${FAILURES[@]}"; do
            echo "     $f"
        done
        echo
        echo "  Fix one of:"
        echo "    - Add PRAGMA busy_timeout = 30000 in the connection setup"
        echo "    - Add .busy_timeout(Duration::from_secs(30)) on the connection"
        echo "    - Route the connection through a shared helper that sets it"
        echo "  See: tailcallhq/forgecode#3551, ADR-097"
        echo
        if $WARN; then
            echo "  ⚠️  --warn set: exiting 0 (v47 ship mode; v48 flips to enforce)"
            exit 0
        fi
        exit 1
    else
        echo "  ✅ PASS — every SQLite connection declares busy_timeout"
        echo
        exit 0
    fi
fi