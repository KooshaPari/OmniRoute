#!/usr/bin/env bash
# L30 reproducible-build gate (v28 cycle-18 T1).
#
# Scans fleet repos for nix flake.nix files whose nixpkgs (or any other)
# input is NOT pinned to a specific git revision. A pinned reference looks
# like:
#
#     nixpkgs.url = "github:NixOS/nixpkgs/<40-char-sha>";
#
# while an unpinned reference (which is what we want to fail on) looks like:
#
#     nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
#     nixpkgs.url = "github:NixOS/nixpkgs/release-24.05";
#     nixpkgs.url = "github:NixOS/nixpkgs/master";
#
# Exit codes:
#   0  -- all flakes pin their nixpkgs (or no flakes exist)
#   1  -- at least one flake has an unpinned nixpkgs input (gate failure)
#   2  -- usage / I/O error (no flake.nix found, bad args)
#
# Usage:
#   tools/reproducible-build/repro_build.sh [--root <path>] [--strict] [--help]
#
#   --root <path>   scan this directory for sub-repo flake.nix files (default: cwd)
#   --strict        treat any unpinned input as failure (default: nixpkgs + flake-utils only)
#   --help          show this help

set -euo pipefail

print_help() {
  sed -n '2,27p' "$0"
}

ROOT="$(pwd)"
STRICT=0
TARGETS=("nixpkgs" "flake-utils")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    --strict)
      STRICT=1
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      print_help >&2
      exit 2
      ;;
  esac
done

if [[ ! -d "$ROOT" ]]; then
  echo "root directory not found: $ROOT" >&2
  exit 2
fi

# Collect flake.nix files, skipping vendored / .git / node_modules / docs trees.
FLAKES=()
while IFS= read -r f; do
  FLAKES+=("$f")
done < <(
  find "$ROOT" \
    -type f -name flake.nix \
    -not -path '*/.git/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/vendor/*' \
    -not -path '*/target/*' \
    -not -path '*/docs/absorbed-*/*' \
    2>/dev/null | sort
)

FLAKE_TOTAL=${#FLAKES[@]}
if [[ "$FLAKE_TOTAL" -eq 0 ]]; then
  echo "no flake.nix files found under $ROOT -- nothing to verify"
  exit 0
fi

# A pinned github:<owner>/<repo>/<ref> URL has the form
#   github:NixOS/nixpkgs/<sha>   where sha is 40 hex chars
# or   github:NixOS/nixpkgs/<sha>#<attr>
PIN_RE='github:[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/[0-9a-f]{40}(#.*)?$'
UNPINNED_LINES=()
FLAKE_FAIL_COUNT=0

for flake in "${FLAKES[@]}"; do
  rel="${flake#$ROOT/}"
  repo_unpinned=()
  while IFS= read -r line; do
    # Only inspect input.url assignments (the value after the `=`).
    url="${line#*=}"
    url="${url//\"/}"
    url="${url## }"; url="${url%% }"
    # Strip trailing nix syntax characters: ; , ]
    url="${url%;}"; url="${url%,}"; url="${url%\]}"
    [[ -z "$url" ]] && continue
    if [[ "$url" =~ $PIN_RE ]]; then
      continue
    fi
    # Decide whether this input name is in our watch list.
    name=""
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z0-9._-]+)\.url[[:space:]]*= ]]; then
      name="${BASH_REMATCH[1]}"
    fi
    if [[ "$STRICT" -eq 1 ]]; then
      repo_unpinned+=("$name -> $url")
    else
      for t in "${TARGETS[@]}"; do
        if [[ "$name" == "$t" ]]; then
          repo_unpinned+=("$name -> $url")
          break
        fi
      done
    fi
  done < <(grep -E '\.url[[:space:]]*=' "$flake" 2>/dev/null | sed -E $'s/\x1b\\[[0-9;]*[a-zA-Z]//g' || true)

  if [[ ${#repo_unpinned[@]} -gt 0 ]]; then
    FLAKE_FAIL_COUNT=$((FLAKE_FAIL_COUNT + 1))
    echo "FAIL  $rel"
    for u in "${repo_unpinned[@]}"; do
      echo "        unpinned: $u"
      UNPINNED_LINES+=("$rel: $u")
    done
  else
    echo "PASS  $rel"
  fi
done

echo
echo "summary: $FLAKE_FAIL_COUNT/$FLAKE_TOTAL flake(s) have unpinned nixpkgs inputs"

if [[ "$FLAKE_FAIL_COUNT" -gt 0 ]]; then
  echo
  echo "remediation: pin nixpkgs (or the failing input) to a 40-char commit SHA:"
  echo "  nixpkgs.url = \"github:NixOS/nixpkgs/\$(git -C ~/.cache/nix rev-parse --verify refs/nixpkgs/nixos-unstable)\";"
  exit 1
fi

exit 0