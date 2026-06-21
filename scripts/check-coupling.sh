#!/usr/bin/env bash
# scripts/check-coupling.sh — v17-T3 / L3 Coupling metric enforcement
#
# Runs cargo-modules structure across every substrate crate declared in
# .rust-audit.toml and fails the build if any module exceeds the
# `max_coupling` (Ca) threshold.
#
# Usage:
#   ./scripts/check-coupling.sh              # check all substrate crates
#   ./scripts/check-coupling.sh --dry-run    # print plan, exit 0
#   ./scripts/check-coupling.sh --crate pheno-config
#                                            # check one crate
#   ./scripts/check-coupling.sh --help
#
# Exit codes:
#   0  = all crates under threshold (or --dry-run)
#   1  = at least one crate exceeds a threshold
#   2  = tooling error (cargo-modules missing, no substrate_crates, etc.)
#
# Date: 2026-06-21 / ADR-023 Rule 3.1 / ADR-040 substrate quality bar

set -euo pipefail

# ── Locate repo root ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

CONFIG=".rust-audit.toml"
DRY_RUN=0
SINGLE_CRATE=""

# ── Parse flags ─────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=1; shift ;;
        --crate)   SINGLE_CRATE="${2:-}"; shift 2 || { echo "ERROR: --crate requires a value" >&2; exit 2; } ;;
        --help|-h)
            sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "ERROR: unknown flag '$1' (try --help)" >&2; exit 2 ;;
    esac
done

# ── Tool check ──────────────────────────────────────────────────────────────
if ! command -v cargo-modules >/dev/null 2>&1; then
    echo "ERROR: cargo-modules not found on PATH" >&2
    echo "  Install with:  cargo install cargo-modules --locked" >&2
    exit 2
fi

# ── Read thresholds from .rust-audit.toml (lightweight parser) ──────────────
if [[ ! -f "$CONFIG" ]]; then
    echo "ERROR: $CONFIG not found at $REPO_ROOT" >&2
    exit 2
fi

# Strip comments + extract a `key = value` pair from a section.
read_toml_value() {
    local section="$1" key="$2" file="$3"
    awk -v sec="[$section]" -v k="$key" '
        /^\[.*\]$/ { in_section = ($0 == sec) ; next }
        in_section && $0 ~ "^[[:space:]]*"k"[[:space:]]*=" {
            sub(/^[^=]*=[[:space:]]*/, "")
            gsub(/[[:space:]]+$/, "")
            print
            exit
        }
    ' "$file"
}

MAX_COUPLING=$(read_toml_value "cargo-modules" "max_coupling" "$CONFIG")
MAX_CYCLO=$(read_toml_value "cargo-modules" "max_cyclomatic_complexity" "$CONFIG")
MAX_LINES=$(read_toml_value "cargo-modules" "max_function_lines" "$CONFIG")
FAIL_ON_WARN=$(read_toml_value "cargo-modules" "fail_on_warning" "$CONFIG")

: "${MAX_COUPLING:=5}"
: "${MAX_CYCLO:=15}"
: "${MAX_LINES:=80}"
: "${FAIL_ON_WARN:=true}"

# ── Resolve substrate crates list ──────────────────────────────────────────
if [[ -n "$SINGLE_CRATE" ]]; then
    CRATES=("$SINGLE_CRATE")
else
    # Pull the multi-line `substrate_crates = [ ... ]` array from the
    # [paths] section, one entry per line, trimming quotes and commas.
    CRATES=()
    in_array=0
    while IFS= read -r line; do
        if [[ "$line" =~ substrate_crates[[:space:]]*=\ *\[ ]]; then
            in_array=1
            # Maybe inline single entry on the same line.
            if [[ "$line" =~ \][[:space:]]*$ ]]; then
                in_array=0
            fi
            continue
        fi
        if [[ $in_array -eq 1 ]]; then
            [[ "$line" =~ \][[:space:]]*$ ]] && in_array=0
            entry=$(echo "$line" | tr -d ',"' | xargs)
            [[ -n "$entry" ]] && CRATES+=("$entry")
        fi
    done < "$CONFIG"

    if [[ ${#CRATES[@]} -eq 0 ]]; then
        echo "ERROR: no substrate_crates in [$CONFIG] [paths] section" >&2
        exit 2
    fi
fi

# ── Dry-run: print plan and exit 0 ──────────────────────────────────────────
if [[ $DRY_RUN -eq 1 ]]; then
    echo "── check-coupling.sh DRY RUN ─────────────────────────────"
    echo "  config:        $REPO_ROOT/$CONFIG"
    echo "  max_coupling:  $MAX_COUPLING"
    echo "  max_cyclo:     $MAX_CYCLO"
    echo "  max_fn_lines:  $MAX_LINES"
    echo "  fail_on_warn:  $FAIL_ON_WARN"
    echo "  crates:        ${CRATES[*]}"
    echo "  command:       cargo-modules structure --package <crate> --max-coupling $MAX_COUPLING"
    echo "──────────────────────────────────────────────────────────"
    exit 0
fi

# ── Real run ────────────────────────────────────────────────────────────────
REPORT_DIR="$REPO_ROOT/findings"
REPORT_FILE="$REPORT_DIR/coupling-report.json"
mkdir -p "$REPORT_DIR"

echo "── check-coupling.sh ─────────────────────────────────────"
echo "  max_coupling: $MAX_COUPLING | max_cyclo: $MAX_CYCLO | max_fn_lines: $MAX_LINES"
echo "  crates: ${#CRATES[@]}"
echo "──────────────────────────────────────────────────────────"

OVERALL_RC=0
RESULTS_JSON="["
FIRST=1

for crate in "${CRATES[@]}"; do
    if [[ ! -d "$REPO_ROOT/$crate" ]]; then
        echo "WARN: substrate crate '$crate' not present locally (sparse-checkout); skipping"
        continue
    fi
    if [[ ! -f "$REPO_ROOT/$crate/Cargo.toml" ]]; then
        echo "WARN: '$crate' has no Cargo.toml; not a Rust crate; skipping"
        continue
    fi

    echo "→ $crate"

    # cargo-modules structure emits JSON-ish output; we use --max-coupling
    # which fails non-zero if any module exceeds the threshold. Capture
    # both stdout and exit code.
    set +e
    OUTPUT=$(cargo-modules structure --package "$crate" --max-coupling "$MAX_COUPLING" 2>&1)
    RC=$?
    set -e

    if [[ $RC -ne 0 ]]; then
        echo "  ✗ FAIL: coupling threshold exceeded"
        # Surface first 5 lines of cargo-modules output for triage.
        echo "$OUTPUT" | head -5 | sed 's/^/    /'
        OVERALL_RC=1
        VERDICT="fail"
    else
        echo "  ✓ pass"
        VERDICT="pass"
    fi

    if [[ $FIRST -eq 1 ]]; then FIRST=0; else RESULTS_JSON+=","; fi
    # Naive JSON-line; cargo-modules JSON output is not strict so we wrap
    # the verdict ourselves. Use printf %q to keep the string JSON-safe.
    ESCAPED=$(printf '%s' "$OUTPUT" | head -c 4096 | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '""')
    RESULTS_JSON+="{\"crate\":\"$crate\",\"verdict\":\"$VERDICT\",\"output\":$ESCAPED}"
done

RESULTS_JSON+="]"

cat > "$REPORT_FILE" <<EOF
{
  "tool": "check-coupling.sh",
  "version": "v17-T3",
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "thresholds": {
    "max_coupling": $MAX_COUPLING,
    "max_cyclomatic_complexity": $MAX_CYCLO,
    "max_function_lines": $MAX_LINES,
    "fail_on_warning": $FAIL_ON_WARN
  },
  "results": $RESULTS_JSON,
  "overall_verdict": $([ "$OVERALL_RC" -eq 0 ] && echo '"pass"' || echo '"fail"')
}
EOF

echo "──────────────────────────────────────────────────────────"
if [[ $OVERALL_RC -eq 0 ]]; then
    echo "✓ All substrate crates under L3 coupling threshold"
else
    echo "✗ One or more substrate crates exceed L3 coupling threshold"
fi
echo "  report: $REPORT_FILE"
echo "──────────────────────────────────────────────────────────"

exit $OVERALL_RC
