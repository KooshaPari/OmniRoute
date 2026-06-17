#!/usr/bin/env bash
# pin-components.sh — Refresh SHA pins in registry/components.lock
#
# Resolves each component's `ref` (default branch) to an immutable commit SHA
# via the GitHub API and rewrites the lock file in place.
#
# Usage:
#   ./scripts/pin-components.sh                # update all components with a ref
#   ./scripts/pin-components.sh --check          # exit 1 if any pin is stale
#   ./scripts/pin-components.sh --component HexaKit
#   ./scripts/pin-components.sh --help
#
# Requires: gh (authenticated), jq
#
# See also: scripts/validate-ecosystem.sh (fleet meta-file drift)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="${ROOT}/registry/components.lock"
CHECK_ONLY=false
FILTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      CHECK_ONLY=true
      shift
      ;;
    --component)
      shift
      FILTER="${1:-}"
      [[ -n "$FILTER" ]] || { echo "Missing component name after --component" >&2; exit 2; }
      shift
      ;;
    --component=*)
      FILTER="${1#--component=}"
      shift
      ;;
    -h|--help)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI required" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq required" >&2; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated" >&2; exit 2; }

[[ -f "$LOCK_FILE" ]] || { echo "ERROR: lock file not found: $LOCK_FILE" >&2; exit 2; }

resolve_sha() {
  local repo="$1"
  local ref="$2"
  gh api "repos/${repo}/commits/${ref}" --jq '.sha' 2>/dev/null
}

STALE=0
COMPONENTS="$(jq -r '.components | keys[]' "$LOCK_FILE")"

while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  [[ -n "$FILTER" && "$name" != "$FILTER" ]] && continue

  repo="$(jq -r ".components[\"${name}\"].repo" "$LOCK_FILE")"
  ref="$(jq -r ".components[\"${name}\"].ref // \"main\"" "$LOCK_FILE")"
  current="$(jq -r ".components[\"${name}\"].sha // \"\"" "$LOCK_FILE")"

  remote="$(resolve_sha "$repo" "$ref")"
  if [[ -z "$remote" ]]; then
    echo "ERROR: could not resolve ${repo}@${ref}" >&2
    exit 2
  fi

  if [[ "$current" == "$remote" ]]; then
    echo "ok  ${name}  ${remote:0:12}"
  elif [[ "$CHECK_ONLY" == true ]]; then
    echo "stale  ${name}  pinned=${current:0:12}  remote=${remote:0:12}"
    STALE=$((STALE + 1))
  else
    prev="${current:-none}"
    echo "pin  ${name}  ${prev:0:12} -> ${remote:0:12}"
    tmp="$(mktemp)"
    jq --arg n "$name" --arg sha "$remote" \
      '.components[$n].sha = $sha | .updated = (now | strftime("%Y-%m-%d"))' \
      "$LOCK_FILE" >"$tmp"
    mv "$tmp" "$LOCK_FILE"
  fi
done <<<"$COMPONENTS"

if [[ "$CHECK_ONLY" == true && "$STALE" -gt 0 ]]; then
  echo "${STALE} stale pin(s) — run ./scripts/pin-components.sh to refresh" >&2
  exit 1
fi

echo "Lock file: ${LOCK_FILE}"
