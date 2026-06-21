#!/usr/bin/env bash
# scripts/check-hex-ports.sh — L4 Hexagonal Port pattern gate (ADR-038)
#
# Verifies that every `pub struct` declared under the `adapters/` module
# of pheno-port-adapter implements a known Port trait (PortAdapter,
# HexCachePort, HexTimePort, or any future Hex*Port trait).
#
# This is the CI gate that enforces the "every adapter must implement a
# port" rule from docs/architecture/hexagonal-ports.md §3.1 and §5.3.
#
# Usage:
#   ./scripts/check-hex-ports.sh [path/to/pheno-port-adapter]
#
# Default path: ./pheno-port-adapter (relative to repo root)
#
# Exit codes:
#   0 — every adapter struct implements a Port trait.
#   1 — at least one adapter struct is missing a Port impl.
#   2 — the adapters directory does not exist or has no .rs files.
#   3 — the Rust toolchain is missing (rustc/cargo not on PATH).

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve target directory
# ---------------------------------------------------------------------------
TARGET="${1:-pheno-port-adapter}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -d "$TARGET" ]; then
    TARGET="$REPO_ROOT/$TARGET"
fi

ADAPTERS_DIR="$TARGET/src/adapters"

if [ ! -d "$ADAPTERS_DIR" ]; then
    printf 'check-hex-ports: FATAL: adapters directory not found at %s\n' "$ADAPTERS_DIR" >&2
    exit 2
fi

shopt -s nullglob
ADAPTER_FILES=("$ADAPTERS_DIR"/*.rs)
shopt -u nullglob

if [ "${#ADAPTER_FILES[@]}" -eq 0 ]; then
    printf 'check-hex-ports: FATAL: no .rs files found under %s\n' "$ADAPTERS_DIR" >&2
    exit 2
fi

# ---------------------------------------------------------------------------
# Toolchain check (only if running the deeper cargo-based check)
# ---------------------------------------------------------------------------
# We keep this script *toolchain-free* by default so it can run in any CI
# container. The basic AST-shaped grep check below uses only bash + grep.
# An optional CARGO_CHECK mode is enabled by setting CHECK_HEX_PORTS_CARGO=1.

# ---------------------------------------------------------------------------
# Collect adapter struct names
# ---------------------------------------------------------------------------
# An "adapter struct" is a `pub struct <Name> { ... }` or
# `pub struct <Name>(...)` or `pub struct <Name>;` declared at the top
# level of a file under src/adapters/. We deliberately skip:
#   - test-only structs (those inside `#[cfg(test)] mod tests { ... }`)
#   - re-exports (`pub use ...;`)
#   - private structs (no `pub`)

declare -a ADAPTER_STRUCTS=()
declare -A ADAPTER_LOCATIONS=()

# We process the file top-to-bottom; when we see a `#[cfg(test)]` we set
# a flag that skips struct / impl collection until matching brace closes.
# Bash + grep can't do that perfectly, so we use a sentinel: any `pub
# struct` whose line index is greater than the first `#[cfg(test)]` AND
# before the corresponding `mod tests` close brace is treated as
# test-only.
#
# For simplicity (and to keep this script robust against formatting
# drift), we instead use a structural rule: the file's *first* `mod
# tests` line marks the start of the test region; any `pub struct`
# after that line is treated as test-only and ignored.

collect_structs() {
    local file="$1"
    local test_region_started=0
    local line_no=0
    while IFS= read -r line; do
        line_no=$((line_no + 1))
        # Detect start of test module (heuristic — top-level `mod tests`).
        if [[ $test_region_started -eq 0 && $line =~ ^[[:space:]]*mod[[:space:]]+(tests|chaos|integration)_?[a-z_]*[[:space:]]*\{? ]]; then
            test_region_started=1
            continue
        fi
        if [[ $test_region_started -eq 1 ]]; then
            continue
        fi
        # Match `pub struct Name {` / `pub struct Name(` / `pub struct Name;`.
        if [[ $line =~ ^[[:space:]]*pub[[:space:]]+struct[[:space:]]+([A-Z][A-Za-z0-9_]*) ]]; then
            local name="${BASH_REMATCH[1]}"
            ADAPTER_STRUCTS+=("$name")
            ADAPTER_LOCATIONS["$name"]="$file:$line_no"
        fi
    done < "$file"
}

for f in "${ADAPTER_FILES[@]}"; do
    collect_structs "$f"
done

if [ "${#ADAPTER_STRUCTS[@]}" -eq 0 ]; then
    printf 'check-hex-ports: FATAL: no pub struct declarations found under %s\n' "$ADAPTERS_DIR" >&2
    exit 2
fi

# ---------------------------------------------------------------------------
# Collect all `impl <Trait> for <Struct>` across adapters/
# ---------------------------------------------------------------------------
# A "Port impl" is an `impl ... for <AdapterStruct>` line where the trait
# path's last segment matches the regex `^(Hex.*Port|PortAdapter)$`.

declare -A ADAPTER_PORT_IMPLS=()

collect_impls() {
    local file="$1"
    local line_no=0
    while IFS= read -r line; do
        line_no=$((line_no + 1))
        # Match `impl <something> for <StructName> {` where StructName
        # starts with a capital letter and has only alphanumerics + _.
        # We capture the trait path's last segment and the struct name.
        if [[ $line =~ ^[[:space:]]*impl(.+)[[:space:]]+for[[:space:]]+([A-Z][A-Za-z0-9_]*)[[:space:]]*(\{|$) ]]; then
            local trait_part="${BASH_REMATCH[1]}"
            local struct_name="${BASH_REMATCH[2]}"
            # Strip leading whitespace + any generics
            trait_part="${trait_name## }"
            # Pull the last `::` segment of the trait path
            local trait_short="${trait_part##*::}"
            # Strip generic params like `<T>` from the short name
            trait_short="${trait_short%%<*}"
            trait_short="${trait_short// /}"
            # If the trait is a known Port trait, record the impl
            if [[ $trait_short =~ ^(Hex.*Port|PortAdapter)$ ]]; then
                ADAPTER_PORT_IMPLS["$struct_name"]="${ADAPTER_PORT_IMPLS["$struct_name"]:-} $trait_short ($file:$line_no)"
            fi
        fi
    done < "$file"
}

for f in "${ADAPTER_FILES[@]}"; do
    collect_impls "$f"
done

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
EXIT_CODE=0
TOTAL="${#ADAPTER_STRUCTS[@]}"
WITH_IMPL=0
WITHOUT_IMPL=0

printf 'check-hex-ports: scanning %d adapter struct(s) under %s\n' "$TOTAL" "$ADAPTERS_DIR"
printf -- '------------------------------------------------------------\n'

for name in "${ADAPTER_STRUCTS[@]}"; do
    loc="${ADAPTER_LOCATIONS[$name]}"
    if [ -n "${ADAPTER_PORT_IMPLS[$name]:-}" ]; then
        WITH_IMPL=$((WITH_IMPL + 1))
        printf '  PASS  %-30s  %s\n' "$name" "${ADAPTER_PORT_IMPLS[$name]}"
    else
        WITHOUT_IMPL=$((WITHOUT_IMPL + 1))
        printf '  FAIL  %-30s  %s   (no Port impl found)\n' "$name" "$loc"
        EXIT_CODE=1
    fi
done

printf -- '------------------------------------------------------------\n'
printf 'check-hex-ports: %d pass, %d fail, %d total\n' "$WITH_IMPL" "$WITHOUT_IMPL" "$TOTAL"

if [ $EXIT_CODE -ne 0 ]; then
    printf '\nFAIL: at least one adapter struct does not implement a known Port trait.\n' >&2
    printf 'See docs/architecture/hexagonal-ports.md §3.1 and §5.3 for the rule.\n' >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Optional deeper check via cargo expand (CHECK_HEX_PORTS_CARGO=1)
# ---------------------------------------------------------------------------
# When this env var is set, we additionally verify the crate compiles and
# the Port trait is reachable from the adapter module. This catches
# orphan-impl / missing-import errors that the AST-shaped check above
# cannot detect (e.g. `impl HexCachePort for InMemoryCache` when the
# trait is renamed in a refactor).

if [ "${CHECK_HEX_PORTS_CARGO:-0}" = "1" ]; then
    if ! command -v cargo >/dev/null 2>&1; then
        printf 'check-hex-ports: CHECK_HEX_PORTS_CARGO=1 but cargo not on PATH\n' >&2
        exit 3
    fi
    printf 'check-hex-ports: running cargo check (CHECK_HEX_PORTS_CARGO=1)\n'
    (
        cd "$TARGET"
        cargo check --quiet --tests
    )
fi

exit 0
