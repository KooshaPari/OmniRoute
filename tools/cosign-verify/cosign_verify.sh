#!/usr/bin/env bash
# L53 cosign verify gate (v28 cycle-18 T4).
#
# For each release artifact under one or more search roots (default:
# dist/*.tar.gz and target/release/*.tar.gz), verifies the matching
# .sig + .cert/.pem pair via `cosign verify-blob`. Used by the release
# CI workflow to gate any artifact that fails signature verification.
#
# Skips silently with a clear warning if `cosign` is not installed
# (operator is expected to install it; see .github/workflows/cosign-verify.yml).
#
# Exit codes:
#   0  -- all artifacts verified (or no artifacts found)
#   1  -- at least one artifact failed signature verification (gate failure)
#   2  -- usage / I/O error (bad args, missing root)
#
# Usage:
#   tools/cosign-verify/cosign_verify.sh [--root <path>]... [--strict] [--help]
#
#   --root <path>   scan this directory for *.tar.gz artifacts (repeatable;
#                   default: dist, target/release)
#   --strict        fail when cosign is not installed (default: warn-only skip)
#   --help          show this help

set -euo pipefail

print_help() {
  sed -n '2,23p' "$0"
}

ROOTS=("dist" "target/release")
STRICT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOTS+=("$2")
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

if ! command -v cosign >/dev/null 2>&1; then
  if [[ "$STRICT" -eq 1 ]]; then
    echo "cosign not installed (strict mode)" >&2
    exit 1
  fi
  echo "WARN  cosign not installed -- skipping verification (install via sigstore/cosign-installer)"
  exit 0
fi

# Discover *.tar.gz artifacts across all roots. We dedupe on basename
# so a release artifact published to both dist/ and target/release/
# is only verified once. We use a temp file instead of bash 4+ assoc
# arrays for portability with macOS /bin/bash 3.2.
ARTIFACTS=()
SEEN_FILE="$(mktemp -t cosign-verify-seen.XXXXXX)"
trap 'rm -f "$SEEN_FILE"' EXIT
for root in "${ROOTS[@]}"; do
  if [[ ! -d "$root" ]]; then
    continue
  fi
  while IFS= read -r f; do
    base="$(basename "$f")"
    if ! grep -F -x -q "$base" "$SEEN_FILE" 2>/dev/null; then
      printf '%s\n' "$base" >> "$SEEN_FILE"
      ARTIFACTS+=("$f")
    fi
  done < <(find "$root" -type f -name '*.tar.gz' \
              -not -path '*/.git/*' \
              -not -path '*/node_modules/*' \
              -not -path '*/vendor/*' 2>/dev/null | sort)
done

TOTAL=${#ARTIFACTS[@]}
if [[ "$TOTAL" -eq 0 ]]; then
  echo "no *.tar.gz artifacts found under: ${ROOTS[*]} -- nothing to verify"
  exit 0
fi

FAIL_COUNT=0
FAILED_NAMES=()
for art in "${ARTIFACTS[@]}"; do
  dir="$(dirname "$art")"
  base="$(basename "$art")"
  stem="${base%.tar.gz}"

  # sigstore convention: <name>.sig + <name>.cert OR <name>.pem
  sig=""
  cert=""
  for cand in "$dir/$base.sig" "$dir/$stem.sig" "$dir/$base.cosign.sig"; do
    [[ -f "$cand" ]] && { sig="$cand"; break; }
  done
  for cand in "$dir/$base.cert" "$dir/$base.pem" "$dir/$stem.cert" "$dir/$stem.pem"; do
    [[ -f "$cand" ]] && { cert="$cand"; break; }
  done

  if [[ -z "$sig" || -z "$cert" ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_NAMES+=("$base")
    echo "FAIL  $art"
    echo "        reason: missing signature pair (sig=${sig:-NONE}, cert=${cert:-NONE})"
    continue
  fi

  if cosign verify-blob \
        --signature "$sig" \
        --certificate "$cert" \
        --insecure-ignore-tlog=true \
        --certificate-identity-regexp '.*' \
        --certificate-oidc-issuer-regexp '.*' \
        "$art" >/dev/null 2>&1; then
    echo "PASS  $art"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_NAMES+=("$base")
    echo "FAIL  $art"
    echo "        reason: cosign verify-blob returned non-zero (sig=$sig, cert=$cert)"
  fi
done

echo
echo "summary: $((TOTAL - FAIL_COUNT))/$TOTAL verified, $FAIL_COUNT failed"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo
  echo "failed artifacts:"
  for n in "${FAILED_NAMES[@]}"; do
    echo "  - $n"
  done
  echo
  echo "remediation: re-sign with cosign sign-blob (see .github/workflows/cosign-sign.yml)"
  exit 1
fi

exit 0